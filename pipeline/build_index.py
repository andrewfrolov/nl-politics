#!/usr/bin/env python3
"""Validate data/content/ and derive index files the app needs -> data/generated/.

- content_index.json : list of issues / party profiles / person profiles + party positions per issue
- stats.json         : per-party voting statistics and party-to-party agreement matrix (from votes)
Exits non-zero if a content file is broken (invalid JSON, dangling source reference).
Standard library only.
"""
import json, sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
C, G = ROOT / "data" / "content", ROOT / "data" / "generated"
errors = []


def load(p):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:  # noqa
        errors.append(f"{p.relative_to(ROOT)}: invalid JSON: {e}")
        return None


def check_sources(doc, path):
    ids = {s.get("id") for s in doc.get("sources", [])}
    for s in doc.get("sources", []):
        if not str(s.get("url", "")).startswith("http"):
            errors.append(f"{path}: source {s.get('id')} has no URL")

    def walk(o, trail):
        if isinstance(o, dict):
            for k, v in o.items():
                if k == "source_ids":
                    for i in v or []:
                        if i not in ids:
                            errors.append(f"{path}: unknown source id {i!r} at {trail}")
                elif k == "source_id":
                    if v is not None and v not in ids:
                        errors.append(f"{path}: unknown source id {v!r} at {trail}")
                else:
                    walk(v, f"{trail}.{k}")
        elif isinstance(o, list):
            for n, v in enumerate(o):
                walk(v, f"{trail}[{n}]")
    walk({k: v for k, v in doc.items() if k != "sources"}, "")


def main():
    parties = json.loads((G / "parties.json").read_text(encoding="utf-8"))
    abbrs = [p["abbr"] for p in parties]
    index = {"issues": [], "parties": [], "people": [], "positions": {}}

    for f in sorted((C / "issues").glob("*.json")):
        d = load(f)
        if not d:
            continue
        rel = str(f.relative_to(ROOT))
        check_sources(d, rel)
        index["issues"].append({"id": d["id"], "title": d["title"], "tagline": d.get("tagline", ""),
                                "updated": d.get("updated"), "sources": len(d.get("sources", [])),
                                "impact_tags": sorted({t for i in d.get("impact", []) for t in i.get("applies_to", [])})})
        for pp in d.get("party_positions", []):
            if pp["party"] not in abbrs:
                print(f"note: {rel}: position for party not currently in House: {pp['party']}", file=sys.stderr)
            index["positions"].setdefault(pp["party"], []).append(
                {"issue": d["id"], "title": d["title"], "salience": pp.get("salience"), "position": pp.get("position")})

    for f in sorted((C / "parties").glob("*.json")):
        d = load(f)
        if d:
            check_sources(d, str(f.relative_to(ROOT)))
            index["parties"].append({"slug": d["slug"], "abbr": d["abbr"]})
    for f in sorted((C / "people").glob("*.json")):
        d = load(f)
        if d:
            check_sources(d, str(f.relative_to(ROOT)))
            index["people"].append({"slug": d["slug"], "name": d["name"], "role": d.get("role"), "party": d.get("party")})
    for name in ("government.json", "how-it-works.json"):
        if (C / name).exists():
            d = load(C / name)
            if d:
                check_sources(d, f"data/content/{name}")
                index[name.split(".")[0].replace("-", "_")] = True

    (G / "content_index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # ---- voting statistics ----
    same = defaultdict(lambda: defaultdict(int))
    both = defaultdict(lambda: defaultdict(int))
    st = {a: {"votes": 0, "for": 0, "against": 0, "with_majority": 0, "submitted": 0, "submitted_adopted": 0} for a in abbrs}
    for f in sorted((G / "votes").glob("2*.json")):
        for v in json.loads(f.read_text(encoding="utf-8")):
            pv = {k: x for k, x in v["pv"].items() if k in st and x in "fa"}
            for a, x in pv.items():
                s = st[a]
                s["votes"] += 1
                s["for" if x == "f" else "against"] += 1
                if v["r"] in ("adopted", "rejected") and (x == "f") == (v["r"] == "adopted"):
                    s["with_majority"] += 1
                for b, y in pv.items():
                    both[a][b] += 1
                    same[a][b] += x == y
            lead = next((s for s in v.get("subs", []) if s["r"] == "Indiener"), None)
            if lead and lead["p"] in st and v.get("k") == "Motie":
                st[lead["p"]]["submitted"] += 1
                st[lead["p"]]["submitted_adopted"] += v["r"] == "adopted"
    agreement = {a: {b: round(100 * same[a][b] / both[a][b]) for b in abbrs if both[a][b] >= 50} for a in abbrs}
    (G / "stats.json").write_text(json.dumps({"party": st, "agreement": agreement}, separators=(",", ":")), encoding="utf-8")

    print(f"index: {len(index['issues'])} issues, {len(index['parties'])} parties, {len(index['people'])} people", file=sys.stderr)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        if "--lenient" not in sys.argv:
            sys.exit(1)


if __name__ == "__main__":
    main()
