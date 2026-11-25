#!/usr/bin/env python3
"""Fetch House of Representatives (Tweede Kamer) open data -> data/generated/.

Source: https://opendata.tweedekamer.nl (OData v4 API, no key needed).
Standard library only. Run:  python3 pipeline/fetch_tk.py
"""
import json, re, sys, time, urllib.parse, urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "generated"
TERM_START = "2025-11-12"  # first sitting day of the House elected 29 Oct 2025


def get(entity, **params):
    q = urllib.parse.urlencode({"$" + k: v for k, v in params.items()}, quote_via=urllib.parse.quote)
    url = BASE + entity + ("?" + q if q else "")
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "nl-politics-explainer"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:  # noqa
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)


def get_all(entity, page=250, **params):
    rows, skip = [], 0
    params.setdefault("orderby", "Id")
    while True:
        d = get(entity, top=page, skip=skip, **params)
        rows += d["value"]
        if len(d["value"]) < page:
            return rows
        skip += page
        print(f"  {entity}: {len(rows)}", file=sys.stderr)


def day(s):
    return s[:10] if s else None


def write(name, obj):
    p = OUT / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {p.relative_to(ROOT)} ({p.stat().st_size // 1024} KB)", file=sys.stderr)


def main():
    # ---------- parties ----------
    fr = get_all("Fractie", filter="Verwijderd eq false")
    fr_by_id = {f["Id"]: f for f in fr}
    active = [f for f in fr if f["DatumInactief"] is None and (f["AantalZetels"] or 0) > 0]
    parties = sorted(
        [{"id": f["Id"], "abbr": f["Afkorting"], "name_nl": f["NaamNL"], "name_en": f["NaamEN"],
          "seats": f["AantalZetels"], "active_since": day(f["DatumActief"])} for f in active],
        key=lambda p: (-p["seats"], p["abbr"]))
    write("parties.json", parties)

    # ---------- members + membership history ----------
    fzp = get_all("FractieZetelPersoon",
                  filter=f"Verwijderd eq false and (TotEnMet eq null or TotEnMet ge {TERM_START}T00:00:00Z)",
                  expand="Persoon,FractieZetel($select=Gewicht,Fractie_Id)")
    comm = get_all("CommissieZetelVastPersoon", filter="Verwijderd eq false and TotEnMet eq null",
                   expand="CommissieZetel($select=Id;$expand=Commissie($select=NaamNL,NaamEN,Afkorting,DatumInactief))")
    comm_by_p = defaultdict(list)
    for c in comm:
        co = (c.get("CommissieZetel") or {}).get("Commissie")
        if co and not co.get("DatumInactief"):
            comm_by_p[c["Persoon_Id"]].append({"name": co["NaamEN"] or co["NaamNL"], "abbr": co["Afkorting"], "role": c["Functie"]})

    people = {}
    for z in fzp:
        p = z.get("Persoon")
        if not p or p.get("Verwijderd"):
            continue
        f = fr_by_id.get(z["FractieZetel"]["Fractie_Id"]) if z.get("FractieZetel") else None
        if not f:
            continue
        e = people.setdefault(p["Id"], {
            "id": p["Id"],
            "name": " ".join(x for x in [p["Roepnaam"] or p["Initialen"], p["Tussenvoegsel"], p["Achternaam"]] if x),
            "last": p["Achternaam"], "prefix": p["Tussenvoegsel"], "initials": p["Initialen"],
            "gender": p["Geslacht"], "born": day(p["Geboortedatum"]), "birthplace": p["Geboorteplaats"],
            "birth_country": p["Geboorteland"], "city": p["Woonplaats"], "has_photo": bool(p.get("ContentLength")),
            "memberships": [], "party": None, "current": False,
        })
        e["memberships"].append({"party": f["Afkorting"], "from": day(z["Van"]), "to": day(z["TotEnMet"]),
                                 "role": z["Functie"], "order": z["FractieZetel"].get("Gewicht")})
    for e in people.values():
        e["memberships"].sort(key=lambda m: m["from"] or "")
        cur = [m for m in e["memberships"] if m["to"] is None]
        if cur:
            e["current"], e["party"], e["role"], e["order"] = True, cur[-1]["party"], cur[-1]["role"], cur[-1]["order"]
        else:
            e["party"], e["role"], e["order"] = e["memberships"][-1]["party"], "Former member", 999
            e["left"] = e["memberships"][-1]["to"]
        e["since"] = e["memberships"][0]["from"]
        e["committees"] = sorted(comm_by_p.get(e["id"], []), key=lambda c: c["name"])
    members = sorted(people.values(), key=lambda e: (not e["current"], e["party"], e.get("order") or 999, e["last"]))
    write("house_members.json", members)

    # ---------- votes ----------
    besl = get_all(
        "Besluit", page=250,
        filter=f"StemmingsSoort ne null and Verwijderd eq false and GewijzigdOp ge {TERM_START}T00:00:00Z",
        expand=("Stemming($select=Soort,ActorNaam,ActorFractie,Fractie_Id,Persoon_Id,FractieGrootte,Vergissing;$filter=Verwijderd eq false),"
                "Zaak($select=Id,Nummer,Soort,Titel,Onderwerp,Vergaderjaar,Volgnummer,Kabinetsappreciatie;"
                "$expand=ZaakActor($select=ActorNaam,ActorFractie,Relatie,Persoon_Id)),"
                "Agendapunt($select=Id;$expand=Activiteit($select=Datum))"))
    VOTE = {"Voor": "f", "Tegen": "a", "Niet deelgenomen": "n"}
    votes = []
    for b in besl:
        if not b["Stemming"]:
            continue
        act = (b.get("Agendapunt") or {}).get("Activiteit") or {}
        date = day(act.get("Datum")) or day(b["GewijzigdOp"])
        if date < TERM_START:
            continue
        z = (b["Zaak"] or [None])[0]
        pv, iv, sizes = {}, {}, {}
        for s in b["Stemming"]:
            v = VOTE.get(s["Soort"])
            if not v:
                continue
            if s["Persoon_Id"]:
                iv[s["Persoon_Id"]] = v
            else:
                f = fr_by_id.get(s["Fractie_Id"])
                name = f["Afkorting"] if f else s["ActorNaam"]
                pv[name] = v
                sizes[name] = s["FractieGrootte"]
        if iv:
            yes = sum(1 for v in iv.values() if v == "f")
            no = sum(1 for v in iv.values() if v == "a")
        else:
            yes = sum(sizes[k] or 0 for k, v in pv.items() if v == "f")
            no = sum(sizes[k] or 0 for k, v in pv.items() if v == "a")
        bs = (b["BesluitSoort"] or "").lower()
        result = "adopted" if "aangenomen" in bs else "rejected" if "verworpen" in bs else "other"
        rec = {"id": b["Id"], "d": date, "r": result, "m": b["StemmingsSoort"], "y": yes, "n": no, "pv": pv}
        if iv:
            rec["iv"] = iv
        if z:
            subs = [{"n": a["ActorNaam"], "p": a["ActorFractie"], "id": a["Persoon_Id"], "r": a["Relatie"]}
                    for a in z.get("ZaakActor", []) if a["Relatie"] in ("Indiener", "Medeindiener")]
            subs.sort(key=lambda a: a["r"] != "Indiener")
            rec.update({"nr": z["Nummer"], "k": z["Soort"], "t": (z["Onderwerp"] or z["Titel"] or "").strip(),
                        "ctx": (z["Titel"] or "").strip(), "adv": z.get("Kabinetsappreciatie"), "subs": subs})
        else:
            rec.update({"k": "Other", "t": b.get("BesluitTekst") or "", "ctx": "", "subs": []})
        votes.append(rec)
    votes.sort(key=lambda r: (r["d"], r["id"]))

    # tag with issues by Dutch keyword (keywords come from the issue files)
    issue_terms = {}
    for f in sorted((ROOT / "data" / "content" / "issues").glob("*.json")):
        try:
            j = json.loads(f.read_text(encoding="utf-8"))
            issue_terms[j["id"]] = [t.lower() for t in j.get("search_terms_nl", []) if len(t) > 3]
        except Exception as e:  # noqa
            print(f"skip {f.name}: {e}", file=sys.stderr)
    for r in votes:
        text = (r["t"] + " " + r["ctx"]).lower()
        tags = [i for i, terms in issue_terms.items()
                if any(re.search(r"(?<![a-zà-ÿ])" + re.escape(t), text) for t in terms)]
        if tags:
            r["is"] = tags

    by_month = defaultdict(list)
    for r in votes:
        by_month[r["d"][:7]].append(r)
    for m, rows in by_month.items():
        write(f"votes/{m}.json", rows)
    for old in (OUT / "votes").glob("*.json"):
        if old.stem not in by_month and old.stem != "index":
            old.unlink()
    write("votes/index.json", {
        "months": [{"month": m, "count": len(by_month[m])} for m in sorted(by_month, reverse=True)],
        "total": len(votes), "roll_call": sum(1 for r in votes if "iv" in r),
        "by_issue": {i: sum(1 for r in votes if i in r.get("is", [])) for i in issue_terms},
    })
    write("meta.json", {"fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                        "term_start": TERM_START, "house_members": sum(1 for m in members if m["current"]),
                        "votes": len(votes)})


if __name__ == "__main__":
    main()
