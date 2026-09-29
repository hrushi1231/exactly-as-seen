# OAVS video PYQ reconstruction worker (Phase 04A)

Runs outside the web app (never in the browser or a server function). It turns
public YouTube videos listed in the OAVS Gold Corpus into *candidate*
reconstructed questions with full evidence. Nothing is auto-verified.

## Tooling
- yt-dlp — metadata, public captions, transient video download (deleted after processing; never re-hosted)
- FFmpeg — audio extraction, scene-change frame detection
- faster-whisper — speech-to-text when public captions are unavailable
- PP-OCRv5 (PaddleOCR models) via RapidOCR/ONNX Runtime — on-screen text (raw text, per-line confidence kept)
- Lovable AI (Gemini, vision) — *only* to lay out OCR'd text into question / options / visible tick mark.
  It is instructed to copy, never solve. Its output is cross-checked against the OCR text; the similarity
  becomes the confidence, and low agreement flags `ocr_corrupted`.

## Setup
```
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python run.py            # all Gold Corpus videos
.venv/bin/python run.py VIDEO_ID   # one video
```
The service-role key lives only on the worker host.

## Year model
`video_publish_date`, `claimed_exam_year`, `resolved_cycle_id`, `exam_year_confidence` are separate.
A cycle is never assigned when the video was published before that cycle's exam. `high` needs on-screen
evidence (e.g. a response-sheet header date), `medium` = title/speech claim consistent with the publish date.
