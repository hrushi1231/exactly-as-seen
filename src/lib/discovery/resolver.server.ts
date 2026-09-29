// Lead resolver: fetch + analyse a single URL. Pure network/parse logic with no
// database access (same portability rule as the collector strategies).
import { assertPublicHttpUrl, robotsAllows, USER_AGENT } from "../collector/strategies.server";

export type ResolutionStatus =
  | "relevant" | "irrelevant" | "auto_irrelevant" | "wrong_post" | "wrong_year"
  | "index_page" | "artifact_found" | "blocked" | "dead_link";
export type Authority = "official" | "official_mirror" | "reputable_secondary" | "community" | "unknown";
export type ResolvedArtifact =
  | "question_paper" | "answer_key" | "final_answer_key" | "provisional_answer_key" | "response_sheet"
  | "exam_schedule" | "recruitment_notice" | "syllabus" | "memory_based_questions" | "solved_questions"
  | "video_reconstruction" | "other";

export interface ChildLink { url: string; anchor: string }

export interface PageFetch {
  ok: boolean;
  status: number | null;
  kind: "html" | "file" | "youtube" | "none";
  finalUrl: string;
  title: string | null;
  text: string;
  publicationDate: string | null;
  links: ChildLink[];
  fileMime?: string;
  blockedReason?: string;
  video?: VideoMeta;
}

export interface VideoMeta {
  videoId: string;
  title: string | null;
  channel: string | null;
  uploadDate: string | null;
  durationSeconds: number | null;
  description: string | null;
  captionsAvailable: boolean | null;
}

const OFFICIAL = /(^|\.)(oav\.edu\.in|ssbodisha\.ac\.in|odisha\.gov\.in|nic\.in|gov\.in)$/;
const MIRROR_HOSTS = /(img\.freejobalert\.com|cdn-images\.prepp\.in|cdn\.s3waas\.gov\.in|web\.archive\.org)/;
const REPUTABLE = /(testbook|adda247|oliveboard|jagranjosh|careerpower|pw\.live|aglasem|prepp|embibe|shiksha|collegedunia|examstocks|freejobalert|sarkariresult|careers360|indiatoday|timesofindia|hindustantimes|ndtv|odishatv|sambad|orissapost|newindianexpress)/;
const FILE_EXT = /\.(pdf|docx?|zip)(?:$|[?#])/i;
const TIMEOUT = 20_000;

async function tfetch(url: string, init: RequestInit = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    return await fetch(url, { redirect: "follow", ...init, signal: c.signal, headers: { "user-agent": USER_AGENT, ...(init.headers ?? {}) } });
  } finally {
    clearTimeout(t);
  }
}

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function htmlToParts(html: string, base: string) {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "") || null;
  const pub =
    html.match(/<meta[^>]+(?:article:published_time|datePublished|pubdate)[^>]+content=["']([^"']+)/i)?.[1] ??
    html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] ??
    null;
  const links: ChildLink[] = [];
  const re = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && links.length < 800) {
    const href = decode(m[1]!.trim());
    if (/^(javascript:|mailto:|tel:|#)/i.test(href)) continue;
    try {
      links.push({ url: new URL(href, base).toString(), anchor: decode(m[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 200) });
    } catch { /* skip */ }
  }
  for (const f of html.matchAll(/<(?:iframe|embed)\b[^>]*src=["']([^"']+)["']/gi)) {
    try { links.push({ url: new URL(decode(f[1]!), base).toString(), anchor: "[embedded]" }); } catch { /* skip */ }
  }
  const main = (html.match(/<(article|main)\b[\s\S]*?<\/\1>/i)?.[0] ?? html)
    .replace(/<(script|style|noscript|nav|footer|header)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return { title, pub, links, text: decode(main).replace(/\s+/g, " ").trim().slice(0, 60_000) };
}

export function youtubeId(url: string): string | null {
  const u = new URL(url);
  const h = u.hostname.replace(/^www\.|^m\./, "");
  if (h === "youtu.be") return u.pathname.slice(1) || null;
  if (h === "youtube.com") return u.searchParams.get("v") ?? u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1] ?? null;
  return null;
}

async function fetchYoutube(id: string): Promise<VideoMeta> {
  const meta: VideoMeta = { videoId: id, title: null, channel: null, uploadDate: null, durationSeconds: null, description: null, captionsAvailable: null };
  try {
    const o = await tfetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
    if (o.ok) {
      const j = (await o.json()) as { title?: string; author_name?: string };
      meta.title = j.title ?? null;
      meta.channel = j.author_name ?? null;
    }
  } catch { /* ignore */ }
  try {
    const w = await tfetch(`https://www.youtube.com/watch?v=${id}&hl=en`, { headers: { "accept-language": "en" } });
    if (w.ok) {
      const html = await w.text();
      meta.uploadDate = html.match(/"uploadDate"\s*:\s*"([^"]+)"/)?.[1] ?? html.match(/itemprop="uploadDate" content="([^"]+)"/)?.[1] ?? null;
      const len = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/)?.[1];
      meta.durationSeconds = len ? Number(len) : null;
      const d = html.match(/"shortDescription"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
      if (d) { try { meta.description = (JSON.parse(`"${d}"`) as string).slice(0, 4000); } catch { meta.description = d.slice(0, 4000); } }
      if (/"playabilityStatus"/.test(html)) meta.captionsAvailable = /"captionTracks"\s*:\s*\[/.test(html);
    }
  } catch { /* ignore */ }
  return meta;
}

type Scraper = (url: string) => Promise<{ markdown: string; title: string | null; links: string[]; status: number | null } | null>;

/** Fetch a page statically; fall back to the optional scraper (e.g. Firecrawl) when blocked or JS-only. */
export async function fetchLead(url: string, scraper?: Scraper): Promise<PageFetch> {
  const empty: PageFetch = { ok: false, status: null, kind: "none", finalUrl: url, title: null, text: "", publicationDate: null, links: [] };
  try { assertPublicHttpUrl(url); } catch (e) { return { ...empty, blockedReason: (e as Error).message }; }
  const vid = youtubeId(url);
  if (vid) {
    const v = await fetchYoutube(vid);
    return { ...empty, ok: !!v.title, status: v.title ? 200 : 404, kind: "youtube", title: v.title, text: `${v.title ?? ""} ${v.channel ?? ""} ${v.description ?? ""}`, publicationDate: v.uploadDate, video: v };
  }
  const robots = await robotsAllows(url);
  if (!robots.allowed) return { ...empty, blockedReason: robots.note };
  let res: Response | null = null;
  try {
    res = await tfetch(url);
  } catch (e) {
    empty.blockedReason = (e as Error).message;
  }
  if (res) {
    const ct = res.headers.get("content-type") ?? "";
    const finalUrl = res.url || url;
    if (res.ok && (!ct.includes("html") || FILE_EXT.test(finalUrl)) && !ct.includes("text/plain")) {
      await res.body?.cancel();
      return { ...empty, ok: true, status: res.status, kind: "file", finalUrl, fileMime: ct.split(";")[0] ?? ct };
    }
    if (res.ok && ct.includes("html")) {
      const html = await res.text();
      const p = htmlToParts(html, finalUrl);
      if (p.text.length > 400 || !scraper) {
        return { ok: true, status: res.status, kind: "html", finalUrl, title: p.title, text: p.text, publicationDate: p.pub, links: p.links };
      }
    }
    if (res.status === 404 || res.status === 410) return { ...empty, status: res.status };
    if (!res.ok) empty.status = res.status;
  }
  if (scraper) {
    try {
      const s = await scraper(url);
      if (s && s.markdown) {
        const mdLinks = [...s.markdown.matchAll(/\[([^\]]{0,200})\]\((https?:[^)\s]+)\)/g)].map((m) => ({ url: m[2]!, anchor: m[1]! }));
        const extra = s.links.map((l) => ({ url: l, anchor: "" }));
        return { ok: true, status: s.status ?? 200, kind: "html", finalUrl: url, title: s.title, text: s.markdown.slice(0, 60_000), publicationDate: null, links: [...mdLinks, ...extra] };
      }
    } catch (e) {
      empty.blockedReason = (e as Error).message;
    }
  }
  return { ...empty, blockedReason: empty.blockedReason ?? `HTTP ${empty.status ?? "no response"}` };
}

// ---------- analysis ----------

const PGT_CS = /\bpgt\s*[-–(]?\s*(?:in\s+)?(?:computer\s*science|comp\.?\s*sc(?:ience|\.)?|comp\.?\s*science|cs)\b|\bpost\s*graduate\s*teacher\s*[-–(]?\s*(?:in\s+)?computer\s*science/i;
const COMP_TEACHER = /\bcomputer\s*(?:science\s*)?teacher\b/i;
const OAVS = /\boavs?\b|adarsha\s*vidyalaya|oav\.edu\.in/i;
const OTHER_SUBJECTS = /\b(pgt|tgt)\s*[-–(]?\s*(physics|chemistry|mathematics|maths|biology|botany|zoology|english|odia|hindi|sanskrit|commerce|economics|history|geography|political\s*science|pol\.?\s*sc|pet|art|music|arts|science|social\s*studies|cbz|pcm)\b/gi;

const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const DATE_RE = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s.\\-/]+(${MONTHS}|\\d{1,2})[,\\s.\\-/]+(20[12]\\d)\\b`, "gi");
const ADVT_RE = /\badvt\.?\s*(?:no\.?)?\s*[:\-]?\s*(\d{1,3}\s*\/\s*20[12]\d|\d{1,3}\s*-\s*20[12]\d)/gi;

export interface Analysis {
  oavs: boolean;
  postMatches: string[];
  exactPgtCs: boolean;
  exactComputerTeacher: boolean;
  otherSubjectsOnly: boolean;
  yearValue: number | null;
  yearConfidence: "high" | "medium" | "low" | null;
  yearEvidence: string | null;
  conflictingYears: boolean;
  advertisementNumbers: string[];
  examDates: string[];
  artifact: ResolvedArtifact | null;
  genericListing: boolean;
  authority: Authority;
  score: number;
}

export function authorityFor(domain: string, officialHeader = false): Authority {
  if (OFFICIAL.test(domain)) return "official";
  if (MIRROR_HOSTS.test(domain) && officialHeader) return "official_mirror";
  if (REPUTABLE.test(domain)) return "reputable_secondary";
  if (/youtube|t\.me|telegram|scribd|blogspot|wordpress|facebook|instagram/.test(domain)) return "community";
  return "unknown";
}

export function analyze(input: { url: string; title: string | null; text: string; publicationDate: string | null; kind: PageFetch["kind"]; anchor?: string | null; targetYear?: number | null }): Analysis {
  const domain = new URL(input.url).hostname.replace(/^www\.|^m\./, "").toLowerCase();
  const head = `${input.title ?? ""} ${input.anchor ?? ""} ${decodeURIComponent(new URL(input.url).pathname).replace(/[-_+]/g, " ")}`;
  const body = input.text.slice(0, 20_000);
  const all = `${head} ${body}`;
  const matches = new Set<string>();
  for (const m of all.matchAll(new RegExp(PGT_CS.source, "gi"))) matches.add(m[0].replace(/\s+/g, " ").trim());
  for (const m of all.matchAll(/\bcomputer\s*(?:science\s*)?teacher\b/gi)) matches.add(m[0].replace(/\s+/g, " ").trim());
  const exactPgtCs = PGT_CS.test(all);
  const exactCT = COMP_TEACHER.test(all);
  const others = [...head.matchAll(OTHER_SUBJECTS)].length;
  const otherSubjectsOnly = others > 0 && !PGT_CS.test(head) && !COMP_TEACHER.test(head);

  // Year: title/heading > explicit dates > URL > publication metadata.
  let yearValue: number | null = null, yc: Analysis["yearConfidence"] = null, ye: string | null = null;
  const headYears = [...head.matchAll(/\b(20[12]\d)\b/g)].map((m) => Number(m[1]));
  const dates = [...all.matchAll(DATE_RE)].map((m) => m[0]).slice(0, 12);
  const dateYears = dates.map((d) => Number(d.match(/(20[12]\d)/)![1]));
  const conflictingYears = new Set(headYears.filter((y) => y >= 2017 && y <= 2026)).size > 2;
  if (headYears.length) {
    const pick = input.targetYear && headYears.includes(input.targetYear) ? input.targetYear : headYears[0]!;
    yearValue = pick; yc = conflictingYears ? "low" : "high"; ye = `title/heading/URL mentions ${pick}`;
  } else if (dateYears.length) {
    yearValue = dateYears[0]!; yc = "medium"; ye = `date in text: ${dates[0]}`;
  } else if (input.publicationDate && /20[12]\d/.test(input.publicationDate)) {
    yearValue = Number(input.publicationDate.match(/20[12]\d/)![0]); yc = "low"; ye = `publication date ${input.publicationDate}`;
  }

  const advt = [...new Set([...all.matchAll(ADVT_RE)].map((m) => m[1]!.replace(/\s+/g, "").replace("-", "/")))].slice(0, 6);

  const h = head.toLowerCase();
  const a = all.toLowerCase();
  let artifact: ResolvedArtifact | null = null;
  if (input.kind === "youtube") artifact = "video_reconstruction";
  else if (/final\s*answer\s*key/.test(h)) artifact = "final_answer_key";
  else if (/provisional\s*answer\s*key|model\s*answer\s*key/.test(h)) artifact = "provisional_answer_key";
  else if (/answer\s*key/.test(h)) artifact = "answer_key";
  else if (/response\s*sheet/.test(h)) artifact = "response_sheet";
  else if (/memory\s*based/.test(h)) artifact = "memory_based_questions";
  else if (/solved/.test(h)) artifact = "solved_questions";
  else if (/question\s*(paper|booklet)|previous\s*(year\s*)?(paper|question)|\bpyq/.test(h)) artifact = "question_paper";
  else if (/syllabus/.test(h)) artifact = "syllabus";
  else if (/exam\s*date|cbt\s*date|schedule|admit\s*card|call\s*letter/.test(h)) artifact = "exam_schedule";
  else if (/advt|advertisement|notification|recruitment|vacanc/.test(h)) artifact = "recruitment_notice";

  const docLinks = input.text ? 0 : 0;
  void docLinks;
  const genericListing =
    input.kind === "html" &&
    /previous\s*year|question\s*papers|all\s*posts|pgt,\s*tgt/.test(h) &&
    !PGT_CS.test(head) && !COMP_TEACHER.test(head);

  const authority = authorityFor(domain, /odisha\s+adarsha\s+vidyalaya\s+sangathan/i.test(body) && /advt|notice|answer\s*key/i.test(body));

  let score = 0;
  if (PGT_CS.test(head) || COMP_TEACHER.test(head)) score += 40;
  else if (exactPgtCs || exactCT) score += 20;
  if (input.targetYear && yearValue === input.targetYear) score += 25;
  if (OAVS.test(all)) score += 20;
  if (artifact && ["question_paper", "answer_key", "final_answer_key", "provisional_answer_key", "response_sheet"].includes(artifact)) score += 10;
  if (authority === "official") score += 15;
  if (otherSubjectsOnly) score -= 30;
  if (genericListing) score -= 40;
  if (conflictingYears) score -= 50;

  return {
    oavs: OAVS.test(all) || domain.endsWith("oav.edu.in"),
    postMatches: [...matches].slice(0, 10),
    exactPgtCs,
    exactComputerTeacher: exactCT,
    otherSubjectsOnly,
    yearValue,
    yearConfidence: yc,
    yearEvidence: ye,
    conflictingYears,
    advertisementNumbers: advt,
    examDates: [...new Set(dates)].slice(0, 8),
    artifact,
    genericListing,
    authority,
    score,
  };
}

/** Pick child links worth following (bounded; no open crawling). */
export function pickChildren(links: ChildLink[], pageUrl: string, max = 6): ChildLink[] {
  const pageHost = new URL(pageUrl).hostname;
  const seen = new Set<string>();
  const scored: { l: ChildLink; s: number }[] = [];
  for (const l of links) {
    let u: URL;
    try { u = new URL(l.url); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const key = u.toString().split("#")[0]!;
    if (seen.has(key) || key === pageUrl) continue;
    seen.add(key);
    const hay = `${l.anchor} ${decodeURIComponent(u.pathname)}`.replace(/[-_+]/g, " ");
    const exact = PGT_CS.test(hay) || COMP_TEACHER.test(hay) || /computer\s*sc/i.test(hay);
    if (!exact) continue; // only follow links that name the target subject/post
    let s = 10;
    if (FILE_EXT.test(key)) s += 20;
    if (/drive\.google|docs\.google|youtube|youtu\.be/.test(u.hostname)) s += 5;
    if (/question|paper|answer|key|response/i.test(hay)) s += 10;
    if (/oav/i.test(hay)) s += 5;
    if (u.hostname !== pageHost && !FILE_EXT.test(key)) s -= 5;
    scored.push({ l: { url: key, anchor: l.anchor }, s });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, max).map((x) => x.l);
}

export function classifyVideo(v: VideoMeta, a: Analysis): "official" | "secondary_explanation" | "memory_based_pyq" | "paper_walkthrough" | "unrelated" | "unknown" {
  const title = (v.title ?? "").toLowerCase();
  const all = `${title} ${v.description ?? ""}`.toLowerCase();
  if (!a.oavs && !/\boavs?\b|adarsha/.test(title)) return "unrelated";
  if (/class\W*\d|annual\s*exam|entrance|admission|half\s*yearly|pt-\d|pwt/.test(title)) return "unrelated";
  const titleNamesPost = /pgt\W*(computer|comp|cs)\b|computer\s*(science\s*)?teacher|computer\s*science/.test(title);
  const otherSubject = /\b(chemistry|physics|math|maths|biology|english|odia|hindi|sanskrit|commerce|economics|history|geography)\b/.test(title);
  if (!titleNamesPost || (otherSubject && !/computer/.test(title))) return "unrelated";
  if (/memory\s*based|asked\s*in|exam\s*analysis|question\s*analysis|questions\s*asked/.test(all)) return "memory_based_pyq";
  if (/question\s*paper|solved\s*paper|paper\s*solution|answer\s*key|pyq|previous\s*year/.test(title)) return "paper_walkthrough";
  if (/class|lecture|mcq|practice|syllabus|strategy|eligibility|pattern|network|security|everything/.test(title)) return "secondary_explanation";
  return "unknown";
}

/** Basic file-text checks (first pages only). Never extracts questions. */
export function fileChecks(text: string) {
  const t = text.slice(0, 15_000);
  const years = [...t.matchAll(/\b(20[12]\d)\b/g)].map((m) => Number(m[1]));
  const dates = [...t.matchAll(DATE_RE)].map((m) => m[0]).slice(0, 5);
  return {
    text_extracted: t.length > 50,
    oavs: OAVS.test(t),
    pgt_computer_science: PGT_CS.test(t),
    computer_teacher: COMP_TEACHER.test(t),
    years: [...new Set(years)].slice(0, 6),
    dates,
    advertisement_numbers: [...new Set([...t.matchAll(ADVT_RE)].map((m) => m[1]!.replace(/\s+/g, "")))].slice(0, 4),
    looks_like_question_paper: /question\s*booklet|booklet\s*(series|code)|\bq\.?\s*no\b|\(a\)[\s\S]{0,80}\(b\)[\s\S]{0,80}\(c\)/i.test(t),
    looks_like_answer_key: /answer\s*key/i.test(t),
    looks_like_response_sheet: /response\s*sheet|chosen\s*option|question\s*id/i.test(t),
    looks_like_notice: /advt|advertisement|notice|notification/i.test(t),
    sample: t.slice(0, 400),
  };
}
