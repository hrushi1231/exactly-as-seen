"""Phase 04A worker: reconstruct candidate OAVS PYQs from public Gold Corpus videos.

Every stored question keeps its raw OCR / transcript evidence and timestamps.
Nothing is auto-verified; video answers are PRESENTER_STATED / PRESENTER_VISUAL only.
"""
from __future__ import annotations

import base64
import difflib
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone

import requests
from PIL import Image

WORKER_VERSION = "04a-1.0"
SB = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1"
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
AI_KEY = os.environ["LOVABLE_API_KEY"]
AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions"
AI_MODEL = "google/gemini-2.5-flash"
H = {"apikey": KEY, "Content-Type": "application/json", "Prefer": "return=representation"}
if not KEY.startswith("sb_"):
    H["Authorization"] = f"Bearer {KEY}"
PY = sys.executable
KEYWORDS = re.compile(r"question|option|answer|correct|previous year|pyq|प्रश्न|उत्तर|सवाल|जवाब", re.I)


def log(*a):
    print(datetime.now().strftime("%H:%M:%S"), *a, flush=True)


# ---------------- DB (PostgREST, service role: worker host only) ----------------
def db(method, path, body=None, params=None):
    # PostgREST bulk inserts require identical keys on every row; fill missing keys with null.
    if isinstance(body, list) and body:
        keys = set().union(*(b.keys() for b in body))
        body = [{k: b.get(k) for k in keys} for b in body]
    for attempt in range(4):
        r = requests.request(method, f"{SB}/{path}", headers=H, json=body, params=params, timeout=60)
        if r.status_code < 500:
            break
        time.sleep(2 * (attempt + 1))
    if r.status_code >= 300:
        raise RuntimeError(f"{method} {path}: {r.status_code} {r.text[:300]}")
    return r.json() if r.text else None


# ---------------- AI (layout only) ----------------
def ai(messages, want_json=True):
    for attempt in range(5):
        r = requests.post(AI_URL, headers={"Authorization": f"Bearer {AI_KEY}"}, json={
            "model": AI_MODEL, "messages": messages, "temperature": 0,
            **({"response_format": {"type": "json_object"}} if want_json else {}),
        }, timeout=180)
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(10 * (attempt + 1)); continue
        r.raise_for_status()
        txt = r.json()["choices"][0]["message"]["content"]
        if not want_json:
            return txt
        txt = re.sub(r"^```(json)?|```$", "", txt.strip()).strip()
        return json.loads(txt)
    raise RuntimeError("AI gateway kept failing")


# ---------------- helpers ----------------
def norm(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9+\-*/=<>&|%#.()\[\]{} ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def sim(a: str, b: str) -> float:
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def contained(a: str, hay: str) -> float:
    """Share of `a`'s tokens that appear in `hay` (OCR agreement)."""
    ta = norm(a).split()
    hs = set(norm(hay).split())
    return sum(t in hs for t in ta) / len(ta) if ta else 0.0


def ahash(path, size=16):
    im = Image.open(path).convert("L").resize((size, size))
    px = list(im.getdata()); avg = sum(px) / len(px)
    return int("".join("1" if p > avg else "0" for p in px), 2)


def hamming(a, b):
    return bin(a ^ b).count("1")


def run(cmd, timeout=1800):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


# ---------------- pipeline steps ----------------
def fetch_metadata(url, work):
    p = run([PY, "-m", "yt_dlp", "--skip-download", "--write-info-json", "-o", f"{work}/v.%(ext)s", url], 300)
    f = f"{work}/v.info.json"
    if not os.path.exists(f):
        raise RuntimeError("metadata: " + (p.stderr.strip().splitlines() or ["unknown error"])[-1])
    return json.load(open(f))


def fetch_captions(url, work, info):
    langs = list((info.get("subtitles") or {}).keys())
    auto = list((info.get("automatic_captions") or {}).keys())
    # YouTube ASR in a mis-detected language (e.g. "gu-orig" for Odia speech) is garbage: only trust en/hi ASR.
    orig = [l for l in auto if l in ("en-orig", "hi-orig")]
    pick = langs[:2] or orig[:1]
    if not pick:
        return None, None
    flag = "--write-subs" if langs else "--write-auto-subs"
    for attempt in range(2):
        run([PY, "-m", "yt_dlp", "--skip-download", flag, "--sub-langs", ",".join(pick), "--sub-format", "json3",
             "-o", f"{work}/c.%(ext)s", url], 300)
        files = glob.glob(f"{work}/c.*.json3")
        if files:
            break
        time.sleep(20)
    if not files:
        return None, None
    segs = []
    j = json.load(open(files[0]))
    for ev in j.get("events", []):
        t = "".join(s.get("utf8", "") for s in ev.get("segs", []) or []).strip()
        if t:
            st = ev.get("tStartMs", 0) / 1000
            segs.append({"start": st, "end": st + ev.get("dDurationMs", 0) / 1000, "text": t})
    lang = files[0].split(".")[-2]
    return (segs or None), lang


def download_video(url, work):
    # YouTube intermittently answers 403 for one player client; retry with others. Public videos only — no cookies/login.
    err = "unknown"
    for client in (None, "web_safari", "tv", "ios", "mweb"):
        args = [PY, "-m", "yt_dlp", "-f", "bv*[height<=720][height>=480]+ba/b[height<=720]/bv*+ba/b", "--merge-output-format", "mkv",
                "-o", f"{work}/video.%(ext)s"]
        if client:
            args += ["--extractor-args", f"youtube:player_client={client}"]
        p = run(args + [url], 1200)
        files = [f for f in glob.glob(f"{work}/video.*") if not f.endswith(".part") and not f.endswith(".ytdl")]
        if files:
            return files[0]
        err = (p.stderr.strip().splitlines() or ["unknown"])[-1]
        time.sleep(15)
    raise RuntimeError("download: " + err)


_whisper = None


def transcribe(video, work):
    global _whisper
    from faster_whisper import WhisperModel
    if _whisper is None:
        _whisper = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=16)
    wav = f"{work}/a.wav"
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", video, "-ac", "1", "-ar", "16000", wav], 600)
    # Speakers mix Odia/Hindi/English; Whisper has no reliable Odia decoder and loops on it. Translate speech to
    # English and label it as a machine translation, never as verbatim speech.
    segs, inf = _whisper.transcribe(wav, vad_filter=True, beam_size=1, task="translate", condition_on_previous_text=False)
    out = [{"start": s.start, "end": s.end, "text": s.text.strip(), "conf": float(min(1.0, max(0.0, 2.718 ** s.avg_logprob)))} for s in segs]
    return out, f"{inf.language} (p={inf.language_probability:.2f}) -> en machine translation"


def candidate_frames(video, work, segs, duration):
    """Scene changes + samples around transcript keywords + a sparse safety sample."""
    fdir = f"{work}/frames"; os.makedirs(fdir, exist_ok=True)
    p = run(["ffmpeg", "-hide_banner", "-i", video, "-vf", "fps=2,select='gt(scene,0.12)',showinfo", "-f", "null", "-"], 1800)
    ts = [float(m) for m in re.findall(r"pts_time:([0-9.]+)", p.stderr)]
    for s in segs or []:
        if KEYWORDS.search(s["text"]):
            ts += [s["start"], s["start"] + 4]
    ts += list(range(5, int(duration or 0), 20))
    ts = sorted(set(round(t, 1) for t in ts if t >= 0))
    frames, last = [], None
    for t in ts:
        fp = f"{fdir}/{t:08.1f}.jpg"
        run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(t), "-i", video, "-frames:v", "1", "-q:v", "3", fp], 60)
        if not os.path.exists(fp):
            continue
        h = ahash(fp)
        if last is not None and hamming(h, last) <= 6:
            os.remove(fp); continue
        last = h
        frames.append((t, fp))
    return frames


_ocr = None


def ocr_frame(fp):
    # PP-OCRv5 mobile det + English rec (the PaddleOCR models) executed via ONNX Runtime (RapidOCR):
    # identical text output on our slides, ~30x faster than the Paddle CPU runtime without oneDNN.
    global _ocr
    if _ocr is None:
        from rapidocr import RapidOCR, OCRVersion, LangRec, ModelType
        _ocr = RapidOCR(params={"Det.ocr_version": OCRVersion.PPOCRV5, "Rec.ocr_version": OCRVersion.PPOCRV5,
                                "Rec.lang_type": LangRec.EN, "Det.model_type": ModelType.MOBILE, "Rec.model_type": ModelType.MOBILE})
    res = _ocr(fp)
    if not res.txts:
        return []
    return [(t, float(s)) for t, s in zip(res.txts, res.scores) if t.strip()]


QRE = re.compile(r"^\s*(q\.?\s*\d+|question\s*(no\.?)?\s*\d+|\d{1,3}\s*[.)])", re.I)
ORE = re.compile(r"^\s*(\(?[a-dA-D1-4][).:]|\(?(i{1,3}|iv)[).:]|[x×✓✔]\s*[1-4][.)]?)", re.I)


def looks_like_question(lines):
    q = sum(bool(QRE.search(t)) for t, _ in lines)
    o = sum(bool(ORE.search(t)) for t, _ in lines)
    return q >= 1 and o >= 2


def window(segs, t0, t1):
    return [s for s in (segs or []) if s["end"] >= t0 and s["start"] <= t1]


LAYOUT_PROMPT = """You are laying out text that is visible on ONE video frame from an Indian teacher-recruitment exam prep video.
You get the frame image, the raw OCR lines, and the speech/caption transcript around this moment.
Rules:
- Copy each fully or partially visible multiple-choice question exactly as shown. Do NOT solve, correct, paraphrase or complete anything.
- If text is cut off, copy what is visible and set complete=false.
- visual_answer_label: the option marked on screen (green tick, highlight, 'Ans:' line, circled). null if nothing is marked. Never infer it yourself.
- spoken_answer_label: the option the speaker says is correct, ONLY if the transcript says so explicitly; include the exact quote. Else null.
- pyq_claim for each question: ACTUAL_PYQ_CLAIM only if the screen or the speaker says this question came from an actual past exam
  (e.g. a candidate response sheet, 'asked in OAVS 2024', 'previous year question'). PRACTICE_QUESTION / MODEL_QUESTION if presented as practice/model/expected.
  EXPLANATION_ONLY if it is theory, not a question. UNKNOWN otherwise. Give the exact supporting text in pyq_claim_evidence.
- exam_header: copy any visible exam name / post / test date / shift header on the frame verbatim, else null.
Return JSON: {"exam_header": str|null, "questions":[{"number": int|null, "text": str, "options":[{"label":"1"|"2"|"3"|"4"|"A"|..., "text": str}],
"complete": bool, "visual_answer_label": str|null, "visual_answer_basis": str|null, "spoken_answer_label": str|null, "spoken_answer_quote": str|null,
"pyq_claim": str, "pyq_claim_evidence": str|null, "subject_is_computer_science": bool}]}"""


def layout(fp, lines, tr):
    b64 = base64.b64encode(open(fp, "rb").read()).decode()
    ocr_txt = "\n".join(t for t, _ in lines)
    tr_txt = "\n".join(f"[{s['start']:.0f}s] {s['text']}" for s in tr)[:4000]
    return ai([
        {"role": "system", "content": LAYOUT_PROMPT},
        {"role": "user", "content": [
            {"type": "text", "text": f"RAW OCR LINES:\n{ocr_txt}\n\nTRANSCRIPT NEAR THIS FRAME:\n{tr_txt or '(none)'}"},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        ]},
    ])


VIDEO_PROMPT = """Classify an exam-prep YouTube video using ONLY the evidence given (title, description, transcript excerpts, on-screen exam headers).
Return JSON {"pyq_claim": "ACTUAL_PYQ_CLAIM"|"PRACTICE_QUESTION"|"MODEL_QUESTION"|"EXPLANATION_ONLY"|"UNKNOWN", "pyq_claim_evidence": exact quote|null,
"claimed_exam": exact quote naming the exam the questions are said to come from|null, "claimed_exam_year": int|null, "claimed_exam_year_evidence": exact quote|null,
"claimed_post": "pgt_computer_science"|"computer_teacher"|null, "is_oavs": true|false|null, "is_oavs_evidence": exact quote|null}
Never guess a year: return null unless a quote states it. The video's upload date is NOT the exam year."""


def classify_video(info, segs, headers):
    tr = " ".join(s["text"] for s in (segs or []))
    kw = [s for s in (segs or []) if re.search(r"oavs|odisha|adarsha|20[12]\d|previous|pyq|asked|exam|परीक्षा|पिछले", s["text"], re.I)]
    ex = "\n".join(f"[{s['start']:.0f}s] {s['text']}" for s in kw[:80])
    return ai([
        {"role": "system", "content": VIDEO_PROMPT},
        {"role": "user", "content": f"TITLE: {info.get('title')}\nUPLOAD DATE: {info.get('upload_date')}\nDESCRIPTION: {(info.get('description') or '')[:1500]}\n"
                                    f"ON-SCREEN HEADERS: {json.dumps(sorted(set(headers))[:20])}\nTRANSCRIPT START: {tr[:2500]}\nKEY TRANSCRIPT LINES:\n{ex[:5000]}"},
    ])


def resolve_cycle(publish: datetime | None, claimed_year, cycles, headers, title=""):
    """Returns (cycle_id, confidence, evidence). Never assigns a cycle whose exam is after the upload."""
    # Only title years that could be a *past* paper at upload time count (a title naming an upcoming exam is a target, not a source).
    def past(y):
        c = next((c for c in cycles if y in (c["exam_year"], c["recruitment_cycle"]) and c["exam_start_date"]), None)
        return bool(c and publish and datetime.fromisoformat(c["exam_start_date"]).date() <= publish.date())
    title_years = sorted({int(y) for y in re.findall(r"\b(20[12]\d)\b", title or "") if past(int(y))})
    if claimed_year and title_years and claimed_year not in title_years:
        return None, "low", f"Conflicting years: title says {', '.join(map(str, title_years))}, speech/description says {claimed_year}. Not assigned."
    hdr_dates = []
    for h in headers:
        for d, m, y in re.findall(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d\d)\b", h):
            try: hdr_dates.append((datetime(int(y), int(m), int(d)).date(), h))
            except ValueError: pass
    for d, h in hdr_dates:
        for c in cycles:
            if c["exam_start_date"] and abs((d - datetime.fromisoformat(c["exam_start_date"]).date()).days) <= 20:
                return c["id"], "high", f"On-screen header '{h}' matches the {c['label']} exam dates ({c['exam_date']})"
    if not claimed_year:
        return None, "none", "No exam year stated in title, description, speech or on screen"
    for c in cycles:
        if claimed_year in (c["exam_year"], c["recruitment_cycle"]):
            if not c["exam_start_date"]:
                return None, "low", f"Claimed {claimed_year}, but no confirmed exam date is recorded for the {c['label']} cycle"
            ex = datetime.fromisoformat(c["exam_start_date"]).date()
            if publish and publish.date() < ex:
                return None, "none", f"Claimed {claimed_year}, but the video was uploaded {publish.date()} — before that exam started ({ex}). Cannot be its paper."
            return c["id"], "medium", f"Claimed {claimed_year} (title/speech); upload {publish.date() if publish else '?'} is after the exam ({ex})"
    return None, "low", f"Claimed {claimed_year}, but no matching recruitment cycle is recorded"


# ---------------- main per-video ----------------
def process(vs, cycles, exam_id):
    url = vs["canonical_url"]
    run_row = db("POST", "video_processing_runs", {"video_source_id": vs["id"], "worker_version": WORKER_VERSION})[0]
    steps = []
    def step(name, **kw):
        steps.append({"step": name, "at": datetime.now(timezone.utc).isoformat(), **kw}); log(vs["video_id"], name, kw)
        db("PATCH", f"video_processing_runs?id=eq.{run_row['id']}", {"steps": steps})
    db("PATCH", f"video_sources?id=eq.{vs['id']}", {"processing_status": "processing"})
    work = tempfile.mkdtemp(prefix="vpyq_")
    try:
        # 1. metadata
        try:
            info = fetch_metadata(url, work)
        except Exception as e:
            db("PATCH", f"video_sources?id=eq.{vs['id']}", {"metadata_status": "failed", "metadata_error": str(e)[:500]})
            raise
        pub = info.get("timestamp") and datetime.fromtimestamp(info["timestamp"], timezone.utc)
        if not pub and info.get("upload_date"):
            pub = datetime.strptime(info["upload_date"], "%Y%m%d").replace(tzinfo=timezone.utc)
        subs, autos = list((info.get("subtitles") or {}).keys()), list((info.get("automatic_captions") or {}).keys())
        db("PATCH", f"video_sources?id=eq.{vs['id']}", {
            "metadata_status": "resolved", "metadata_error": None, "title": info.get("title"), "channel": info.get("channel") or info.get("uploader"),
            "channel_id": info.get("channel_id"), "video_publish_date": pub.isoformat() if pub else None, "duration_seconds": info.get("duration"),
            "description": info.get("description"), "thumbnail_url": info.get("thumbnail"),
            "captions_available": bool(subs or autos), "caption_languages": subs, "auto_caption_languages": [l for l in autos if l.endswith("-orig")] or autos[:0],
        })
        step("metadata", channel=info.get("channel"), published=str(pub), duration=info.get("duration"), captions=subs, auto_orig=[l for l in autos if l.endswith("-orig")])

        # 2. transcript
        segs, lang = None, None
        cache = os.path.join(os.environ.get("VPYQ_CACHE", "/tmp/vtranscripts"), f"{vs['video_id']}.transcript.json")
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        try:
            segs, lang = fetch_captions(url, work, info)
        except Exception as e:
            step("captions_failed", error=str(e)[:200])
        video = download_video(url, work)
        step("downloaded_transient", bytes=os.path.getsize(video))
        source = "youtube_captions" if segs else None
        if not segs and os.path.exists(cache):
            c = json.load(open(cache)); segs, lang, source = c["segs"], c["lang"], c["source"]
        if not segs:
            step("captions_unavailable_using_whisper")
            segs, lang = transcribe(video, work)
            source = "whisper" if segs else "none"
        json.dump({"segs": segs, "lang": lang, "source": source}, open(cache, "w"))
        step("transcript", source=source, language=lang, segments=len(segs or []))

        # 3. frames + OCR
        frames = candidate_frames(video, work, segs, info.get("duration"))
        step("candidate_frames", count=len(frames))
        ocrd = []
        for t, fp in frames:
            lines = ocr_frame(fp)
            ocrd.append((t, fp, lines))
        qframes = [(t, fp, l) for t, fp, l in ocrd if looks_like_question(l)]
        step("ocr", frames=len(ocrd), question_frames=len(qframes))

        # 4. layout each question frame
        raw = []  # candidate observations
        headers = []
        for i, (t, fp, lines) in enumerate(qframes):
            nxt = qframes[i + 1][0] if i + 1 < len(qframes) else t + 60
            tr = window(segs, t - 10, min(nxt, t + 90))
            try:
                lay = layout(fp, lines, tr)
                if isinstance(lay, list):  # model occasionally returns a bare array of questions
                    lay = {"questions": lay}
                if not isinstance(lay, dict):
                    raise ValueError(f"unexpected layout JSON type {type(lay).__name__}")
            except Exception as e:
                step("layout_failed", t=t, error=str(e)[:200]); continue
            if lay.get("exam_header"):
                headers.append(lay["exam_header"])
            ocr_all = "\n".join(x for x, _ in lines)
            ocr_mean = sum(s for _, s in lines) / len(lines) if lines else 0
            for q in lay.get("questions") or []:
                if not isinstance(q, dict) or not (q.get("text") or "").strip():
                    continue
                raw.append({"t": t, "t_end": nxt, "q": q, "ocr_lines": lines, "ocr_all": ocr_all, "ocr_mean": ocr_mean,
                            "agree": contained(q["text"] + " " + " ".join(str(o.get("text", "")) for o in q.get("options") or [] if isinstance(o, dict)), ocr_all),
                            "tr": tr})
        step("layout", observations=len(raw))

        # 5. video-level classification + year model
        vc = classify_video(info, segs, headers)
        if isinstance(vc, list):
            vc = vc[0] if vc and isinstance(vc[0], dict) else {}
        cyc, conf, ev = resolve_cycle(pub, vc.get("claimed_exam_year"), cycles, headers, info.get("title") or "")
        db("PATCH", f"video_sources?id=eq.{vs['id']}", {
            "claimed_exam_year": vc.get("claimed_exam_year"), "claimed_exam_year_evidence": vc.get("claimed_exam_year_evidence"),
            "resolved_cycle_id": cyc, "exam_year_confidence": conf, "exam_year_evidence": ev,
            "pyq_claim": vc.get("pyq_claim") or "UNKNOWN", "pyq_claim_evidence": vc.get("pyq_claim_evidence"),
        })
        step("year_model", claimed=vc.get("claimed_exam_year"), cycle=cyc, confidence=conf, evidence=ev, video_claim=vc.get("pyq_claim"), is_oavs=vc.get("is_oavs"))
        cycle_year = next((c["exam_year"] for c in cycles if c["id"] == cyc), None)

        # 6. group observations of the same question inside this video
        groups = []
        for o in raw:
            key = o["q"].get("number")
            g = next((g for g in groups if (key is not None and g["num"] == key and sim(g["best"]["q"]["text"], o["q"]["text"]) > 0.5)
                      or sim(g["best"]["q"]["text"], o["q"]["text"]) > 0.85), None)
            if g:
                g["obs"].append(o)
                score = lambda x: (len(x["q"].get("options") or []), x["q"].get("complete", False), x["agree"])
                if score(o) > score(g["best"]):
                    g["best"] = o
            else:
                groups.append({"num": key, "best": o, "obs": [o]})

        n = 0
        for g in groups:
            b, q = g["best"], g["best"]["q"]
            opts = [o for o in q.get("options") or [] if isinstance(o, dict) and (o.get("text") or "").strip()]
            vis = next((x["q"].get("visual_answer_label") for x in g["obs"] if x["q"].get("visual_answer_label")), None)
            vis_basis = next((x["q"].get("visual_answer_basis") for x in g["obs"] if x["q"].get("visual_answer_label")), None)
            spk = next((x["q"] for x in g["obs"] if x["q"].get("spoken_answer_label") and x["q"].get("spoken_answer_quote")), None)
            claims = [x["q"].get("pyq_claim") for x in g["obs"]]
            qclaim = "ACTUAL_PYQ_CLAIM" if "ACTUAL_PYQ_CLAIM" in claims else next((c for c in ("PRACTICE_QUESTION", "MODEL_QUESTION", "EXPLANATION_ONLY") if c in claims), None)
            if not qclaim:
                qclaim = "ACTUAL_PYQ_CLAIM" if vc.get("pyq_claim") == "ACTUAL_PYQ_CLAIM" else "UNKNOWN"
            flags = []
            if not q.get("complete", False): flags.append("question_text_incomplete")
            if len(opts) < 4: flags.append("options_missing")
            if b["agree"] < 0.6: flags.append("ocr_heavily_corrupted")
            if len(re.findall(r"\bQ\.?\s*\d+", q["text"])) > 1: flags.append("multiple_questions_merged")
            if vc.get("is_oavs") is False: flags.append("not_oavs")
            if q.get("subject_is_computer_science") is False: flags.append("wrong_subject")
            if qclaim in ("PRACTICE_QUESTION", "MODEL_QUESTION"): flags.append("practice_or_model_question")
            if qclaim != "ACTUAL_PYQ_CLAIM": flags.append("pyq_claim_not_established")
            if not cyc: flags.append("year_unresolved")
            confidence = round(max(0.0, min(1.0, 0.5 * b["agree"] + 0.3 * b["ocr_mean"] + 0.2 * (len(opts) >= 4))), 3)
            if qclaim in ("PRACTICE_QUESTION", "MODEL_QUESTION", "EXPLANATION_ONLY") or "wrong_subject" in flags or "not_oavs" in flags:
                status = "REJECTED"
            elif flags:
                status = "NEEDS_REVIEW"
            else:
                status = "RAW_RECONSTRUCTION"
            ans_label = vis or (spk or {}).get("spoken_answer_label")
            ans_status = "PRESENTER_VISUAL" if vis else ("PRESENTER_STATED" if spk else "NONE")
            source_text = q["text"] + "\n" + "\n".join(f"{o['label']}. {o['text']}" for o in opts)
            qrow = db("POST", "questions", {
                "question_text": q["text"].strip(), "source_text": source_text, "question_type": "mcq_single" if opts else "unknown",
                "language": "en", "normalization_status": "auto_normalized", "verification_status": status, "pyq_claim": qclaim,
                "answer_label": ans_label, "answer_status": ans_status, "quality_flags": flags, "confidence": confidence,
            })[0]
            if opts:
                db("POST", "question_options", [{"question_id": qrow["id"], "label": str(o["label"]), "option_text": o["text"].strip(), "raw_text": o["text"],
                                                  "display_order": k, "is_presented_answer": ans_label is not None and str(o["label"]) == str(ans_label)} for k, o in enumerate(opts)])
            t0 = min(x["t"] for x in g["obs"]); t1 = max(x["t_end"] for x in g["obs"])
            occ = db("POST", "question_occurrences", {
                "question_id": qrow["id"], "exam_id": exam_id, "post_type": vs["post_type"], "resolved_cycle_id": cyc, "exam_year": cycle_year,
                "question_number": q.get("number"), "source_video_id": vs["id"], "source_timestamp_start": t0, "source_timestamp_end": t1,
                "verification_status": status, "confidence": confidence,
            })[0]
            link = f"https://www.youtube.com/watch?v={vs['video_id']}&t={int(b['t'])}s"
            evs = [
                {"evidence_type": "VIDEO_FRAME", "timestamp_start": b["t"], "raw_text": f"Frame at {b['t']:.1f}s (not stored; open the timestamp)",
                 "meta": {"frames_seen": [x["t"] for x in g["obs"]], "exam_header": headers[:3]}},
                {"evidence_type": "VIDEO_OCR", "timestamp_start": b["t"], "raw_text": b["ocr_all"], "normalized_text": source_text,
                 "confidence": round(b["ocr_mean"], 3), "meta": {"ocr_engine": "PP-OCRv5 mobile (en) via RapidOCR/ONNX Runtime", "lines": b["ocr_lines"], "layout_agreement": round(b["agree"], 3), "layout_model": AI_MODEL}},
            ]
            if b["tr"]:
                evs.append({"evidence_type": "CAPTION" if source == "youtube_captions" else "SPEECH_TRANSCRIPT", "timestamp_start": b["tr"][0]["start"],
                            "timestamp_end": b["tr"][-1]["end"], "raw_text": "\n".join(f"[{s['start']:.1f}s] {s['text']}" for s in b["tr"]),
                            "confidence": round(sum(s.get("conf", 1) for s in b["tr"]) / len(b["tr"]), 3) if source == "whisper" else None,
                            "meta": {"source": source, "language": lang}})
            if vis:
                evs.append({"evidence_type": "PRESENTER_ANSWER", "timestamp_start": b["t"], "raw_text": f"On-screen mark: option {vis}. {vis_basis or ''}".strip(), "meta": {"kind": "PRESENTER_VISUAL"}})
            if spk:
                evs.append({"evidence_type": "PRESENTER_ANSWER", "timestamp_start": b["t"], "raw_text": spk["spoken_answer_quote"], "meta": {"kind": "PRESENTER_STATED", "label": spk["spoken_answer_label"]}})
            db("POST", "question_evidence", [{**e, "question_id": qrow["id"], "occurrence_id": occ["id"], "video_source_id": vs["id"],
                                             "source_url": link, "meta": {**e.get("meta", {}), "pyq_claim_evidence": q.get("pyq_claim_evidence")}} for e in evs])
            if status != "REJECTED" and qclaim == "ACTUAL_PYQ_CLAIM":
                db("POST", "gold_corpus", {"post_type": vs["post_type"], "artifact_type": "reconstructed_question", "quality_level": "C" if cyc else "D",
                                           "candidate_id": vs["candidate_id"], "url": link, "title": q["text"][:200], "question_id": qrow["id"], "cycle_id": cyc,
                                           "reason": "Single-source video reconstruction" if cyc else "Video reconstruction; exam year unresolved"})
            n += 1
        db("PATCH", f"video_processing_runs?id=eq.{run_row['id']}", {"status": "succeeded", "finished_at": datetime.now(timezone.utc).isoformat(),
            "transcript_source": source, "transcript_language": lang, "frames_candidate": len(frames), "frames_ocr": len(ocrd), "candidates_found": n})
        db("PATCH", f"video_sources?id=eq.{vs['id']}", {"processing_status": "processed"})
        step("done", candidates=n)
    except Exception as e:
        import traceback
        log("FAILED", vs["video_id"], e, traceback.format_exc()[-800:])
        db("PATCH", f"video_processing_runs?id=eq.{run_row['id']}", {"status": "failed", "error": str(e)[:1000], "finished_at": datetime.now(timezone.utc).isoformat()})
        db("PATCH", f"video_sources?id=eq.{vs['id']}", {"processing_status": "failed"})
    finally:
        shutil.rmtree(work, ignore_errors=True)  # transient input only; never re-hosted


def cross_match():
    """Same cycle + same post only. Independent = different channel. No cross-exam analysis."""
    occ = db("GET", "question_occurrences", params={"select": "id,question_id,post_type,resolved_cycle_id,source_video_id,questions!inner(id,question_text,verification_status,merged_into_id),video_sources!inner(channel_id,video_id)",
                                                   "resolved_cycle_id": "not.is.null"})
    live = [o for o in occ if o["questions"]["verification_status"] != "REJECTED" and not o["questions"]["merged_into_id"]]
    opts = {}
    for o in live:
        qo = db("GET", "question_options", params={"select": "label,option_text", "question_id": f"eq.{o['question_id']}", "order": "display_order"})
        opts[o["question_id"]] = " ".join(x["option_text"] for x in qo)
    matched = 0
    for i, a in enumerate(live):
        for b in live[i + 1:]:
            if a["resolved_cycle_id"] != b["resolved_cycle_id"] or a["post_type"] != b["post_type"]:
                continue
            if a["source_video_id"] == b["source_video_id"] or a["video_sources"]["channel_id"] == b["video_sources"]["channel_id"]:
                continue
            s_q = sim(a["questions"]["question_text"], b["questions"]["question_text"])
            s_o = sim(opts[a["question_id"]], opts[b["question_id"]])
            s = 0.7 * s_q + 0.3 * s_o
            if s < 0.75:
                continue
            kind = "exact_same_wording" if s_q > 0.97 else "near_identical_wording" if s >= 0.88 else "likely_same_question"
            for x, y in ((a, b), (b, a)):
                db("POST", "question_evidence", {"question_id": x["question_id"], "occurrence_id": x["id"], "evidence_type": "SECOND_VIDEO_MATCH",
                    "video_source_id": y["source_video_id"], "source_url": f"https://www.youtube.com/watch?v={y['video_sources']['video_id']}",
                    "raw_text": y["questions"]["question_text"], "confidence": round(s, 3),
                    "meta": {"match": kind, "other_question_id": y["question_id"], "question_similarity": round(s_q, 3), "options_similarity": round(s_o, 3)}})
            if kind != "likely_same_question":
                for x in (a, b):
                    db("PATCH", f"questions?id=eq.{x['question_id']}&verification_status=in.(RAW_RECONSTRUCTION,NEEDS_REVIEW)", {"verification_status": "CROSS_SOURCE_RECONSTRUCTED"})
                    db("PATCH", f"question_occurrences?id=eq.{x['id']}&verification_status=in.(RAW_RECONSTRUCTION,NEEDS_REVIEW)", {"verification_status": "CROSS_SOURCE_RECONSTRUCTED"})
                    db("PATCH", f"gold_corpus?question_id=eq.{x['question_id']}", {"quality_level": "C+", "reason": f"Reconstructed; corroborated by a second independent video ({kind})"})
                matched += 1
    log("cross-video matches:", matched)


def sync_sources():
    """Create video_sources rows for every YouTube video in the OAVS Gold Corpus."""
    gold = db("GET", "gold_corpus", params={"select": "url,post_type,candidate_id", "artifact_type": "eq.video_reconstruction", "question_id": "is.null"})
    for g in gold:
        m = re.search(r"(?:v=|youtu\.be/|shorts/)([\w-]{11})", g["url"])
        if not m:
            continue
        vid = m.group(1)
        if db("GET", "video_sources", params={"select": "id", "video_id": f"eq.{vid}"}):
            continue
        db("POST", "video_sources", {"video_id": vid, "canonical_url": f"https://www.youtube.com/watch?v={vid}", "post_type": g["post_type"], "candidate_id": g["candidate_id"]})


def main():
    exam_id = db("GET", "exams", params={"select": "id", "slug": "eq.oavs-pgt-cs"})[0]["id"]
    cycles = db("GET", "exam_cycles", params={"select": "id,label,exam_year,recruitment_cycle,exam_date,exam_start_date", "exam_id": f"eq.{exam_id}"})
    sync_sources()
    if sys.argv[1:] == ["--match-only"]:
        cross_match(); return
    only = set(sys.argv[1:])
    vids = db("GET", "video_sources", params={"select": "*", "order": "video_publish_date.asc.nullslast"})
    for vs in vids:
        if only and vs["video_id"] not in only:
            continue
        if not only and vs["processing_status"] == "processed":
            continue
        process(vs, cycles, exam_id)
    if not only:
        cross_match()


if __name__ == "__main__":
    main()
