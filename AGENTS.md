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
