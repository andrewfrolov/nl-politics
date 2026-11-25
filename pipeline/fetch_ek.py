#!/usr/bin/env python3
"""Fetch Senate (Eerste Kamer) member list from eerstekamer.nl -> data/generated/senate_members.json.

The Senate has no open-data API for members; this parses the public member list page.
Standard library only. If the page layout changes this fails loudly rather than writing bad data.
"""
import html, json, re, sys, urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "https://www.eerstekamer.nl/alle_leden"


def main():
    req = urllib.request.Request(URL, headers={"User-Agent": "nl-politics-explainer"})
    page = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
    out = []
    for block in re.findall(r'<li class="persoon grid-x nowr">(.*?)</li>', page, re.S):
        href = re.search(r'href="(/persoon/[^"]+)"', block).group(1)
        name = html.unescape(re.search(r'class="naam">(.*?)</div>', block, re.S).group(1)).strip()
        cap = re.search(r'class="naam">.*?</div></div><div>([^<]*)</div>(?:<div>([^<]*)</div>)?<div>Anci[^:]*: (\d+) dagen', block, re.S)
        city = re.search(r"Woonplaats: ([^<]*)<", block)
        born = re.search(r"Geboortedatum: (\d\d)-(\d\d)-(\d{4})", block)
        img = re.search(r'<img src="([^"?]+)', block)
        out.append({
            "id": href.rsplit("/", 1)[1], "name": name, "party": html.unescape(cap.group(1)).strip(),
            "role": html.unescape(cap.group(2)).strip() if cap.group(2) else None, "seniority_days": int(cap.group(3)),
            "city": html.unescape(city.group(1)).strip() if city else None,
            "born": f"{born.group(3)}-{born.group(2)}-{born.group(1)}" if born else None,
            "url": "https://www.eerstekamer.nl" + href,
            "photo": "https://www.eerstekamer.nl" + img.group(1) + "?sizew=160&sizeh=160" if img else None,
        })
    if not 60 <= len(out) <= 75:
        sys.exit(f"unexpected number of senators parsed: {len(out)}")
    out.sort(key=lambda m: (m["party"], m["name"]))
    seats = Counter(m["party"] for m in out)
    p = ROOT / "data" / "generated" / "senate_members.json"
    p.write_text(json.dumps({"members": out, "seats": dict(seats.most_common()), "source": URL}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {len(out)} senators; seats: {dict(seats.most_common())}", file=sys.stderr)


if __name__ == "__main__":
    main()
