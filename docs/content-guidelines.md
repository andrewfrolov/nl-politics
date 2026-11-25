# Content guidelines (for researchers / LLM agents writing files in `data/content/`)

The app explains Dutch politics **in English** to residents of the Netherlands. Readers want **facts, figures and direct quotes — never the writer's opinion.**

## Hard rules

1. **No opinions, no evaluation, no advice.** Do not say a policy is good, bad, sensible, extreme, fair, etc. Do not predict. Describe what is the case, what was said, what was decided, what official figures show. Value-laden words are allowed only inside attributed quotes or as attributed characterisations ("X calls this ...").
2. **Everything is sourced.** Every fact, figure, position and quote carries `source_ids` pointing to entries in the file's `sources` list. Each source needs a real URL that you actually opened in this session. Prefer primary sources: tweedekamer.nl, rijksoverheid.nl, CBS, CPB, PBL, SCP, DNB, Belastingdienst, UWV, IND, Netbeheer Nederland, party manifestos / party websites, coalition agreement; then quality media (NOS, NRC, Volkskrant, FD, Trouw, Telegraaf, AD, RTL, Nu.nl, DutchNews, NL Times).
3. **Quotes must be verbatim and verified.** Only include a quote if you saw the exact words on a fetched page. Give the original Dutch in `text_nl` and a faithful English translation in `text_en`. If the original is English, put it in `text_en` and set `text_nl` to null. Never invent, reconstruct or "tidy" quotes. If you could not verify a quote, use a sourced paraphrase in the surrounding text instead and no quote.
4. **Contested claims are presented as contested.** State who claims what, and what official/independent data show, including where data do not exist. Do not adjudicate beyond what the cited source itself states.
5. **Current.** Today is late November 2026. Your prior knowledge of Dutch politics is outdated — the House of Representatives was elected on 29 Oct 2025 and much has changed since. Verify everything by web search; prefer 2026 sources. Give dates for all figures.
6. **Party names.** Use exactly these abbreviations for current House groups (seats in brackets): `D66` (26), `VVD` (22), `PRO` (20, Progressief Nederland — the merged GroenLinks-PvdA), `PVV` (19), `CDA` (18), `JA21` (9), `Groep Markuszower` (7, split from PVV in Jan 2026), `FVD` (7), `ChristenUnie` (3), `SP` (3), `PvdD` (3), `SGP` (3), `BBB` (3), `DENK` (3), `50PLUS` (2), `Lid Keijzer` (1), `Volt` (1). Verify details yourself.
7. **Plain English.** Explain Dutch terms on first use (e.g. "box 3 (the tax on savings and investments)"). Short paragraphs. No markdown in strings except none — plain text only.
8. Output must be **valid UTF-8 JSON** matching the schema exactly. Validate with `python3 -m json.tool <file>` before finishing. Do not run git commands. Write only the file(s) you were assigned.

## Reader profile tags (used in `impact[].applies_to`)

`everyone`,
housing: `renter_social`, `renter_private`, `owner_mortgage`, `owner_outright`, `home_seeker`;
work: `employee`, `self_employed`, `employer`, `student`, `retired`, `on_benefits`;
income: `income_low` (< ~€30k gross), `income_middle`, `income_high` (> ~€80k gross);
wealth: `investor` (savings/investments above the box 3 tax-free allowance), `second_home`;
origin: `dutch_citizen`, `eu_citizen`, `non_eu_resident`, `expat_ruling` (30%/27% expat tax facility);
household: `parent`;
transport: `ev_driver`, `petrol_driver`;
energy: `solar_owner`, `business_grid_user`.

Impact notes state concrete, sourced consequences of **current rules, decided changes (with dates/amounts) and pending proposals (labelled as proposals, with who proposes them)** for people with that tag. No advice.

## Schema: issue file `data/content/issues/<id>.json`

```json
{
  "id": "box-3",
  "title": "Box 3: tax on savings and investments",
  "tagline": "One line, neutral, max 120 chars",
  "updated": "2026-11-25",
  "summary": "2-4 sentences: what the issue is and where it stands now.",
  "key_facts": [ {"label": "short label", "value": "figure with unit + date", "note": "optional context", "source_ids": ["s1"]} ],
  "problem": [ {"heading": "short heading", "text": "paragraph", "source_ids": ["s1"]} ],
  "causes": [ {"heading": "short heading", "text": "how/why this arose, per sources", "source_ids": ["s2"]} ],
  "timeline": [ {"date": "YYYY or YYYY-MM or YYYY-MM-DD", "event": "what happened", "source_ids": ["s3"]} ],
  "current_policy": [ {"heading": "short heading", "text": "what the current cabinet/coalition agreement/law says and does", "source_ids": ["s4"]} ],
  "proposals": [ {"title": "short", "description": "what it would do", "proposed_by": ["VVD"], "status": "e.g. bill pending in Senate / in manifesto / motion adopted 2026-03-10 / rejected", "source_ids": ["s5"]} ],
  "contested_claims": [ {"claim": "the claim as made", "claimed_by": "who", "what_data_show": "what official/independent sources report, incl. gaps", "source_ids": ["s6"]} ],
  "party_positions": [
    {"party": "VVD", "position": "2-4 sentences describing stated position and relevant votes",
     "salience": "core | high | medium | low",
     "salience_basis": "factual basis, e.g. 'one of 5 headline pledges in 2025 manifesto' or 'two sentences in manifesto, no motions filed in 2026'",
     "quotes": [ {"text_en": "...", "text_nl": "...", "speaker": "Name or 'VVD manifesto 2025'", "date": "YYYY-MM-DD or YYYY", "source_id": "s7"} ],
     "source_ids": ["s7"]}
  ],
  "impact": [ {"applies_to": ["investor"], "text": "concrete sourced consequence", "source_ids": ["s8"]} ],
  "search_terms_nl": ["Dutch keywords that identify motions/bills on this issue, lower-case, e.g. 'box 3', 'vermogensrendementsheffing'"],
  "sources": [ {"id": "s1", "title": "page title", "publisher": "CBS", "url": "https://...", "date": "YYYY-MM-DD or null"} ]
}
```

Targets: 6-10 key_facts, 2-4 problem blocks, 2-5 causes, 6-12 timeline entries, 2-4 current_policy blocks, 4-8 proposals, 2-5 contested_claims, positions for **every group with 3+ seats** (14 groups; smaller ones if found), 6-12 impact notes, 8-15 search terms, 20+ sources. `salience` meaning: core = defining theme of the party; high = prominent in manifesto/campaign and active in parliament; medium = addressed in manifesto; low = barely addressed. Always justify in `salience_basis` with observable facts.

## Schema: party file `data/content/parties/<slug>.json`

```json
{
  "abbr": "VVD", "slug": "vvd", "name_nl": "...", "name_en": "...", "founded": "1948",
  "updated": "2026-11-25",
  "seats_house": 22, "seats_senate": 0, "seats_house_2025_election": 22, "seats_house_2023_election": 24,
  "in_coalition": true,
  "party_leader": "Name", "house_group_leader": "Name", "senate_group_leader": "Name or null",
  "website": "https://...",
  "described_as": [ {"text": "how the party describes itself, or how named reference sources describe it (attributed)", "source_ids": ["s1"]} ],
  "history": [ {"date": "YYYY", "event": "...", "source_ids": ["s2"]} ],
  "manifesto_2025": {"title": "...", "url": "...", "key_points": [ {"topic": "Housing", "text": "what the manifesto pledges", "source_ids": ["s3"]} ]},
  "recent_developments": [ {"date": "YYYY-MM-DD", "event": "2026 events: leadership changes, splits, mergers, scandals as reported", "source_ids": ["s4"]} ],
  "key_people": [ {"name": "...", "role": "..."} ],
  "sources": [ {"id": "s1", "title": "...", "publisher": "...", "url": "https://...", "date": null} ]
}
```
Targets: 8-12 manifesto key points across different topics, 5-8 history entries, all notable 2026 developments.

## Schema: person profile `data/content/people/<slug>.json`

```json
{
  "slug": "rob-jetten", "name": "...", "role": "...", "party": "D66", "updated": "2026-11-25",
  "bio": [ {"date": "YYYY", "event": "career fact", "source_ids": ["s1"]} ],
  "speaking_themes": [
    {"theme": "short name", "summary": "neutral summary of what the person says on this theme, how often/where",
     "quotes": [ {"text_en": "...", "text_nl": "...", "context": "where/when said", "date": "YYYY-MM-DD", "source_id": "s2"} ],
     "source_ids": ["s2"]}
  ],
  "promises": [
    {"promise": "what was promised, as specifically as stated", "quote": {"text_en": "...", "text_nl": "...", "context": "...", "date": "...", "source_id": "s3"},
     "made": "YYYY-MM-DD or period", "where": "manifesto / debate / interview",
     "status": "kept | broken | partly_kept | in_progress | not_yet_due | unclear",
     "evidence": "the facts that determine the status: what was done or decided, with dates. If commentators/opponents dispute it, say who says what.",
     "source_ids": ["s3", "s4"]}
  ],
  "fact_checks": [
    {"claim": "the statement checked", "date": "YYYY-MM-DD", "where": "debate/tweet/interview",
     "checker": "organisation that did the fact-check", "verdict": "the checker's own verdict, translated", "verdict_class": "false | mostly_false | half_true | mostly_true | true | unverifiable",
     "explanation": "checker's reasoning in 1-3 sentences", "url": "https://...", "source_ids": ["s5"]}
  ],
  "reversals": [ {"topic": "...", "before": "earlier stated position with date", "after": "later position with date", "explanation_given": "the person's own stated reason, if any", "source_ids": ["s6"]} ],
  "controversies": [ {"date": "...", "summary": "what was reported, by whom, and the person's response", "source_ids": ["s7"]} ],
  "sources": [ {"id": "s1", "title": "...", "publisher": "...", "url": "https://...", "date": null} ]
}
```
`status` and `verdict_class` are the only classifications allowed; each must follow directly from the cited evidence. Only list fact-checks performed by a named third-party organisation (Nieuwscheckers, NOS, Nu.nl, Pointer, AD, Volkskrant, NRC, Factchecker of dpa/AFP etc.) — never fact-check claims yourself.
