# nl-politics

English-language explainer of Dutch politics. Static site on GitHub Pages; no backend, no build step.

- `app/` — vanilla JS single-page app (`index.html`, `styles.css`, `app.js`). `app/data` is a symlink to `data/` for local dev: `python3 -m http.server -d app`.
- `data/generated/` — machine-fetched, never edit by hand. `pipeline/fetch_tk.py` (House members, parties, votes from the Tweede Kamer OData API), `pipeline/fetch_ek.py` (Senate members), `pipeline/build_index.py` (content index, validation, voting stats). All stdlib Python.
- `data/content/` — researched content (issues, parties, people, government, how-it-works) as JSON. Schemas and rules: `docs/content-guidelines.md`.
- `.github/workflows/site.yml` — deploys on push; every Monday also re-fetches parliament data and commits it.

## Editorial rules (owner's instruction)

- **Facts, figures and direct quotes only. No opinions or evaluation by the writer** — not in content, not in UI copy. Summaries of speeches/quotes are fine; judgements are not.
- Every statement carries a source URL that was actually opened. Quotes verbatim, Dutch original + English translation.
- No single "liar score" for people: show counted, sourced items (promises with evidence, third-party fact-checks).
- Content is researched by subagents following `docs/content-guidelines.md`; the owner's usage limit is finite, so run research agents in small batches (about 5 at a time), not all at once.

## After changing content or pipeline

Run `python3 pipeline/build_index.py` (must exit 0), then load the affected pages locally.
