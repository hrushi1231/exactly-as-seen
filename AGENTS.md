<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Collector fetch/parse logic lives in `src/lib/collector/strategies.server.ts` with no DB access — so it can move unchanged into an external Node.js worker (browser strategy) later.
- Collector server functions run as the signed-in admin (RLS + explicit `has_role` check), never with the service-role client — keeps admin enforcement server-side.
- Raw files are stored once per SHA-256 in the private `source-documents` bucket; extra sources become `document_provenance` rows — avoids duplicate physical copies.
- Internet discovery providers live in `src/lib/discovery/providers.server.ts` behind a `DiscoveryProvider` interface with no DB access — another search engine can be added without touching the document pipeline.
- Discovery never marks a year "exhaustive" automatically; only an admin does — one automated pass is not proof of absence.
- Lead resolution logic lives in `src/lib/discovery/resolver.server.ts` (no DB access); the shared download pipeline is `src/lib/collector/core.server.ts` so resolver and collector use one path.
- Real exam cycles (`exam_cycles`) are separate from calendar-year search rows; recruitment year and exam year are stored separately so one cycle is never counted twice.
- Video PYQ reconstruction runs only in the external Python worker `worker/video_pyq/` (yt-dlp, FFmpeg, faster-whisper, PaddleOCR) with its own service-role key — never in the browser or server functions.
- Video-derived answers are PRESENTER_STATED/PRESENTER_VISUAL only; a video's cycle is never assigned when it was uploaded before that cycle's `exam_start_date` — upload year is not exam year.
- Reconstructed questions keep `source_text`, raw option text and `question_evidence` rows untouched; admin edits change only normalized fields; merges move evidence, never delete it.
