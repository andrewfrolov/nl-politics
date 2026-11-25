# Dutch Politics Explained

Dutch politics in English: parties, people, votes and issues — facts, figures and direct quotes, each linked to its source.

- **App**: `app/` (static, no build). Run locally with `python3 -m http.server -d app` and open http://localhost:8000.
- **Data**: `data/generated/` is fetched from official sources by the scripts in `pipeline/`; `data/content/` holds researched explainers (see `docs/content-guidelines.md`).
- **Refresh**: the GitHub Actions workflow re-fetches parliament data every Monday and redeploys. Researched content is refreshed separately.

Sources of parliamentary data: [Tweede Kamer Open Data](https://opendata.tweedekamer.nl), [Eerste Kamer](https://www.eerstekamer.nl).
