// Dutch Politics Explained — static single-page app. No build step, no dependencies.
// All content comes from JSON under ./data (see /data and /pipeline in the repository).

const $app = document.getElementById('app');
const cache = new Map();
const load = (path) => {
  if (!cache.has(path)) {
    cache.set(path, fetch('data/' + path).then((r) => { if (!r.ok) throw new Error(path + ' → ' + r.status); return r.json(); })
      .catch((e) => { cache.delete(path); throw e; }));
  }
  return cache.get(path);
};
const tryLoad = (path) => load(path).catch(() => null);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => {
  if (!d) return '';
  const m = /^(\d{4})(?:-(\d\d))?(?:-(\d\d))?$/.exec(d);
  if (!m) return esc(d);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (m[3] ? +m[3] + ' ' : '') + (m[2] ? mon[+m[2] - 1] + ' ' : '') + m[1];
};
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- parties ----------
const COLORS = { D66: '#00a651', VVD: '#f47621', PRO: '#d4202c', PVV: '#0f2f5c', CDA: '#2c8a57', JA21: '#1d3f8f', 'Groep Markuszower': '#5b6f8f',
  FVD: '#7d1b1b', ChristenUnie: '#00a7eb', SP: '#ee2e22', PvdD: '#006b2d', SGP: '#e96b10', BBB: '#93c01f', DENK: '#00b4b6', '50PLUS': '#92278f',
  'Lid Keijzer': '#8a8f98', Volt: '#582c83', OPNL: '#3a7ca5' };
const color = (p) => COLORS[p] || '#8a8f98';
const partySlug = (abbr) => slugify(abbr);
const partyTag = (abbr, link = true) => {
  if (!abbr) return '';
  const inner = `<span class="dot" style="background:${color(abbr)}"></span>${esc(abbr)}`;
  return link && state.partyAbbrs?.has(abbr) ? `<a class="party" href="#/party/${partySlug(abbr)}">${inner}</a>` : `<span class="party">${inner}</span>`;
};

// ---------- sources / quotes ----------
function makeRefs(doc) {
  const idx = new Map((doc.sources || []).map((s, i) => [s.id, { n: i + 1, ...s }]));
  const ref = (ids) => {
    const list = (Array.isArray(ids) ? ids : ids ? [ids] : []).map((i) => idx.get(i)).filter(Boolean);
    if (!list.length) return '';
    return `<sup class="ref">${list.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc((s.publisher ? s.publisher + ': ' : '') + s.title)}">[${s.n}]</a>`).join('')}</sup>`;
  };
  const list = () => `<h2 id="sources">Sources</h2><ol class="sources">${(doc.sources || []).map((s) =>
    `<li>${esc(s.publisher || '')}${s.publisher ? ' — ' : ''}<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>${s.date ? ` (${fmtDate(s.date)})` : ''}</li>`).join('')}</ol>`;
  return { ref, list };
}
const quote = (q, ref) => !q || !(q.text_en || q.text_nl) ? '' : `<blockquote>“${esc(q.text_en || q.text_nl)}”${q.text_nl && q.text_en ? `<span class="nl">Original: “${esc(q.text_nl)}”</span>` : ''}
  <footer>— ${esc([q.speaker, q.context, fmtDate(q.date)].filter(Boolean).join(', '))}${ref(q.source_id)}</footer></blockquote>`;

// ---------- profile ----------
const PROFILE = [
  ['Housing', [['renter_social', 'I rent social housing'], ['renter_private', 'I rent in the private sector'], ['owner_mortgage', 'I own a home with a mortgage'], ['owner_outright', 'I own a home without a mortgage'], ['home_seeker', 'I am looking for a home']]],
  ['Work', [['employee', 'Employee'], ['self_employed', 'Self-employed (zzp)'], ['employer', 'I employ staff / own a company'], ['student', 'Student'], ['retired', 'Retired'], ['on_benefits', 'I receive benefits']]],
  ['Income (gross per year)', [['income_low', 'Under about €30,000'], ['income_middle', 'About €30,000–€80,000'], ['income_high', 'Over about €80,000']]],
  ['Wealth', [['investor', 'Savings or investments above the box 3 allowance'], ['second_home', 'I own a second home or rental property']]],
  ['Residency', [['dutch_citizen', 'Dutch citizen'], ['eu_citizen', 'EU citizen (not Dutch)'], ['non_eu_resident', 'Non-EU resident'], ['expat_ruling', 'I use the expat tax facility (30%/27% ruling)']]],
  ['Household', [['parent', 'I have children at home']]],
  ['Transport', [['ev_driver', 'I drive an electric car'], ['petrol_driver', 'I drive a petrol or diesel car']]],
  ['Energy', [['solar_owner', 'I have solar panels'], ['business_grid_user', 'My business needs a (bigger) grid connection']]],
];
const TAG_LABEL = Object.fromEntries(PROFILE.flatMap(([, opts]) => opts).concat([['everyone', 'Everyone']]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('nlp.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('nlp.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const myTags = () => new Set(store.get('tags', []));
const myIssues = () => new Set(store.get('issues', []));

// ---------- shared state ----------
const state = {};
async function base() {
  if (!state.ready) {
    const [parties, index, meta] = await Promise.all([load('generated/parties.json'), load('generated/content_index.json'), tryLoad('generated/meta.json')]);
    Object.assign(state, { parties, index, meta, partyAbbrs: new Set(parties.map((p) => p.abbr)), ready: true });
    if (meta) document.getElementById('fresh').textContent = `Parliament data fetched ${fmtDate(meta.fetched_at.slice(0, 10))}.`;
  }
  return state;
}
let votesAll;
const allVotes = async () => {
  if (!votesAll) {
    const idx = await load('generated/votes/index.json');
    const months = await Promise.all(idx.months.map((m) => load(`generated/votes/${m.month}.json`)));
    votesAll = months.flat().sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  }
  return votesAll;
};

// ---------- small components ----------
const seatBar = (items, total, linkFn) => `<div class="seatbar">${items.map((p) =>
  `<a href="${linkFn ? linkFn(p) : '#/parties'}" style="width:${(100 * p.seats) / total}%;background:${color(p.abbr)}" title="${esc(p.abbr)}: ${p.seats} seats">${p.seats >= total / 19 ? esc(p.abbr) : ''}</a>`).join('')}</div>`;
const SAL = { core: 4, high: 3, medium: 2, low: 1 };
const salience = (s) => `<span class="salience" title="Importance to this party: ${esc(s)}">${[1, 2, 3, 4].map((i) => `<i class="${i <= (SAL[s] || 0) ? 'on' : ''}"></i>`).join('')}</span> <span class="small muted">${esc(s || 'no position found')}</span>`;
const initials = (n) => n.replace(/\b(van|de|der|den|el|ten|ter|prof\.|dr\.|mr\.|drs\.|ir\.|ing\.)\s*/gi, '').split(/\s+/).map((w) => w[0]).filter((c) => /\p{L}/u.test(c || '')).slice(0, 2).join('').toUpperCase();
const avatar = (name, party, photo) => photo ? `<img class="avatar" loading="lazy" src="${esc(photo)}" alt="">` : `<span class="avatar" style="background:${color(party)}">${esc(initials(name))}</span>`;
const personCard = (href, name, party, sub, photo) => `<a class="card person" href="${href}">${avatar(name, party, photo)}<span><span class="nm">${esc(name)}</span><br><span class="sub">${partyTag(party, false)}${sub ? ' · ' + esc(sub) : ''}</span></span></a>`;
const KIND = { Motie: 'Motion', Amendement: 'Amendment', Wetgeving: 'Bill', Wet: 'Bill', 'Initiatiefwetgeving': 'Private member’s bill', Begroting: 'Budget bill', 'Brief regering': 'Government letter', Other: 'Other' };
const ADV = { Ontraden: 'Cabinet advised against', 'Oordeel Kamer': 'Cabinet left it to the House', Overgenomen: 'Cabinet adopted it', Ontijdig: 'Cabinet: premature', Onaanvaardbaar: 'Cabinet: unacceptable', Aanhouden: 'Cabinet asked to postpone' };
const VLABEL = { f: 'For', a: 'Against', n: 'Did not vote' };
const vpill = (v) => `<span class="pill ${v === 'f' ? 'good' : v === 'a' ? 'bad' : 'neutral'}">${VLABEL[v] || 'No record'}</span>`;
const tkLink = (v) => v.nr ? `https://www.tweedekamer.nl/zoeken?qry=${encodeURIComponent(v.nr)}` : 'https://www.tweedekamer.nl/kamerstukken/stemmingsuitslagen';

function voteRow(v, extra = '') {
  const tot = v.y + v.n || 1;
  const groups = { f: [], a: [], n: [] };
  for (const [p, x] of Object.entries(v.pv)) groups[x]?.push(p);
  const order = (a, b) => (state.parties.findIndex((p) => p.abbr === a) + 99) % 99 - (state.parties.findIndex((p) => p.abbr === b) + 99) % 99;
  const issueLinks = (v.is || []).map((i) => { const it = state.index.issues.find((x) => x.id === i); return it ? `<a class="pill" href="#/issue/${i}">${esc(it.title.split(':')[0])}</a>` : ''; }).join(' ');
  return `<details class="vote"><summary>
    <span class="meta">${fmtDate(v.d)}<br>${esc(KIND[v.k] || v.k || '')}</span>
    <span><span class="t">${esc(v.t)}</span><br><span class="meta">${v.subs?.length ? 'Submitted by ' + esc(v.subs.filter((s) => s.r === 'Indiener').map((s) => s.n + (s.p ? ` (${s.p})` : '')).join(', ') || v.subs[0].n) : ''} ${issueLinks}</span></span>
    <span style="text-align:right">${extra}<span class="pill ${v.r === 'adopted' ? 'good' : v.r === 'rejected' ? 'bad' : 'neutral'}">${v.r === 'adopted' ? 'Adopted' : v.r === 'rejected' ? 'Rejected' : 'Other'}</span>
      <span class="meta"> ${v.y}–${v.n}</span><div class="split"><i style="width:${(100 * v.y) / tot}%"></i></div></span></summary>
    <div class="body">
      ${v.ctx && v.ctx !== v.t ? `<p class="muted">Part of: ${esc(v.ctx)}</p>` : ''}
      ${v.adv ? `<p><span class="pill neutral">${esc(ADV[v.adv] || 'Cabinet advice: ' + v.adv)}</span></p>` : ''}
      ${['f', 'a', 'n'].map((k) => groups[k].length ? `<div><strong>${VLABEL[k]}</strong> <span class="muted small">(${groups[k].length} groups)</span><div class="pv">${groups[k].sort(order).map((p) => partyTag(p)).join('')}</div></div>` : '').join('')}
      ${v.iv ? '<p class="small muted">Roll-call vote: each member voted individually. Individual votes are shown on each member’s page.</p>' : `<p class="small muted">${esc(v.m === 'Met handopsteken' ? 'Voted by show of hands: each group votes as a block.' : v.m || '')}</p>`}
      ${v.subs?.length > 1 ? `<p class="small muted">Co-signed by: ${esc(v.subs.filter((s) => s.r !== 'Indiener').map((s) => s.n + (s.p ? ` (${s.p})` : '')).join(', '))}</p>` : ''}
      <p class="small"><a href="${tkLink(v)}" target="_blank" rel="noopener">Open on tweedekamer.nl${v.nr ? ' (' + esc(v.nr) + ')' : ''} ↗</a> · Title shown in Dutch as published by parliament.</p>
    </div></details>`;
}

function impactNotes(doc, ref, showAll) {
  const tags = myTags();
  const notes = (doc.impact || []).map((n) => ({ ...n, mine: n.applies_to.some((t) => tags.has(t)), all: n.applies_to.includes('everyone') }));
  const shown = showAll ? notes : notes.filter((n) => n.mine || n.all);
  shown.sort((a, b) => b.mine - a.mine);
  return shown.map((n) => `<div class="impact"><div class="tags">${n.applies_to.map((t) => `<span class="tag" ${tags.has(t) ? '' : 'style="color:var(--muted)"'}>${esc(TAG_LABEL[t] || t)}</span>`).join('')}</div>${esc(n.text)}${ref(n.source_ids)}</div>`).join('');
}

// ---------- pages ----------
const pages = {};

pages.home = async () => {
  const s = await base();
  const [gov, votes] = await Promise.all([tryLoad('content/government.json'), allVotes()]);
  const mine = myIssues();
  const issues = [...s.index.issues].sort((a, b) => mine.has(b.id) - mine.has(a.id));
  const coalition = new Set(gov?.cabinet?.parties || []);
  const lastDay = votes[0]?.d;
  const dayVotes = votes.filter((v) => v.d === lastDay);
  return `<section class="hero"><h1>Dutch politics, explained in English</h1>
    <p class="lead">Who governs, who sits in parliament, how every party voted, and what the big issues are about — in facts, figures and direct quotes, each linked to its source.</p></section>
    <h2>House of Representatives · 150 seats</h2>
    ${seatBar(s.parties, 150, (p) => '#/party/' + partySlug(p.abbr))}
    <div class="legend">${s.parties.map((p) => `<span>${partyTag(p.abbr)} ${p.seats}${coalition.has(p.abbr) ? ' <span class="pill">coalition</span>' : ''}</span>`).join('')}</div>
    ${gov?.cabinet ? `<div class="notice"><strong>${esc(gov.cabinet.name)}</strong> — ${esc(gov.cabinet.type)}. Sworn in ${fmtDate(gov.cabinet.sworn_in)}. ${gov.cabinet.seats_house ? `Coalition holds ${gov.cabinet.seats_house} of 150 House seats${gov.cabinet.seats_senate != null ? ` and ${gov.cabinet.seats_senate} of 75 Senate seats` : ''}.` : ''} <a href="#/government">Government →</a></div>` : ''}
    <h2>Issues</h2>
    ${mine.size || myTags().size ? '' : '<p class="muted small">Tell the app about your situation in <a href="#/me">My profile</a> to see how each issue affects you.</p>'}
    <div class="grid">${issues.map((i) => `<a class="card" href="#/issue/${i.id}"><h3>${esc(i.title)}</h3><p>${esc(i.tagline)}</p>${mine.has(i.id) ? '<p><span class="pill warn">Following</span></p>' : ''}</a>`).join('')}</div>
    <h2>Latest votes${lastDay ? ' · ' + fmtDate(lastDay) : ''}</h2>
    <p class="muted small">${dayVotes.length} votes that day: ${dayVotes.filter((v) => v.r === 'adopted').length} adopted, ${dayVotes.filter((v) => v.r === 'rejected').length} rejected. <a href="#/votes">All votes →</a></p>
    ${dayVotes.slice(0, 8).map((v) => voteRow(v)).join('')}`;
};

pages.issues = async () => {
  const s = await base();
  const vi = await tryLoad('generated/votes/index.json');
  return `<h1>Issues</h1><p class="lead">For each issue: what the problem is, how it arose, what is proposed, where every party stands and how much it matters to them, and what it means for you.</p>
    <div class="grid">${s.index.issues.map((i) => `<a class="card" href="#/issue/${i.id}"><h3>${esc(i.title)}</h3><p>${esc(i.tagline)}</p><p class="small">${i.sources} sources${vi?.by_issue?.[i.id] ? ` · ${vi.by_issue[i.id]} related votes` : ''} · updated ${fmtDate(i.updated)}</p></a>`).join('')}</div>`;
};

pages.issue = async (id, sub) => {
  const s = await base();
  const d = await load(`content/issues/${id}.json`);
  const { ref, list } = makeRefs(d);
  const showAll = sub === 'all-impact';
  const following = myIssues().has(id);
  const order = (p) => { const i = s.parties.findIndex((x) => x.abbr === p.party); return i < 0 ? 99 : i; };
  const positions = [...(d.party_positions || [])].sort((a, b) => order(a) - order(b));
  const sec = (key, title, html) => html ? `<h2 id="${key}">${title}</h2>${html}` : '';
  const blocks = (arr) => (arr || []).map((b) => `<div class="block"><h3>${esc(b.heading)}</h3><p>${esc(b.text)}${ref(b.source_ids)}</p></div>`).join('');
  const votes = (await allVotes()).filter((v) => v.is?.includes(id));
  const toc = [['facts', 'Key figures'], ['problem', 'The problem'], ['causes', 'How it came about'], ['timeline', 'Timeline'], ['policy', 'Current policy'], ['proposals', 'Proposed solutions'], ['claims', 'Contested claims'], ['parties', 'Party positions'], ['impact', 'What it means for you'], ['votes', 'Votes'], ['sources', 'Sources']];
  return `<div class="crumbs"><a href="#/issues">Issues</a> ›</div>
  <h1>${esc(d.title)}</h1><p class="lead">${esc(d.summary)}</p>
  <p><button class="btn ghost" data-follow="${id}">${following ? '★ Following' : '☆ Follow this issue'}</button> <span class="muted small">Updated ${fmtDate(d.updated)} · ${d.sources.length} sources</span></p>
  <div class="two"><div>
    ${sec('facts', 'Key figures', `<div class="facts">${(d.key_facts || []).map((f) => `<div class="fact"><div class="l">${esc(f.label)}</div><div class="v">${esc(f.value)}${ref(f.source_ids)}</div>${f.note ? `<div class="n">${esc(f.note)}</div>` : ''}</div>`).join('')}</div>`)}
    ${sec('problem', 'The problem', blocks(d.problem))}
    ${sec('causes', 'How it came about', blocks(d.causes))}
    ${sec('timeline', 'Timeline', `<ul class="timeline">${(d.timeline || []).map((t) => `<li><span class="d">${fmtDate(t.date)}</span>${esc(t.event)}${ref(t.source_ids)}</li>`).join('')}</ul>`)}
    ${sec('policy', 'Current policy', blocks(d.current_policy))}
    ${sec('proposals', 'Proposed solutions', (d.proposals || []).map((p) => `<div class="claim"><div class="q">${esc(p.title)}</div><p>${esc(p.description)}${ref(p.source_ids)}</p>
        <div class="pv">${(p.proposed_by || []).map((x) => partyTag(x)).join('')}</div><span class="pill neutral" style="white-space:normal">${esc(p.status)}</span></div>`).join(''))}
    ${sec('claims', 'Contested claims', (d.contested_claims || []).length ? `<p class="muted small">Claims made in the debate, next to what official and independent sources report.</p>` + d.contested_claims.map((c) => `<div class="claim"><div class="lab">Claim</div><div class="q">${esc(c.claim)}</div><div class="lab">Made by</div><div>${esc(c.claimed_by)}</div><div class="lab">What the data show</div><div>${esc(c.what_data_show)}${ref(c.source_ids)}</div></div>`).join('') : '')}
    ${sec('parties', 'Party positions', `<p class="muted small">Ordered by number of seats. The bars show how important the issue is to the party, with the factual basis for that rating.</p><div class="card">${positions.map((p) => `<div class="pos"><div class="pos-head">${partyTag(p.party)} ${salience(p.salience)}</div>
        <p>${esc(p.position)}${ref(p.source_ids)}</p>${p.salience_basis ? `<p class="small muted">Importance basis: ${esc(p.salience_basis)}</p>` : ''}${(p.quotes || []).map((q) => quote(q, ref)).join('')}</div>`).join('')}</div>`)}
    ${sec('impact', 'What it means for you', (myTags().size ? '' : `<div class="notice">Fill in <a href="#/me">your profile</a> to see only the notes that apply to you.</div>`) + impactNotes(d, ref, showAll || !myTags().size)
        + (myTags().size ? `<p class="small"><a href="#/issue/${id}/${showAll ? '' : 'all-impact'}">${showAll ? 'Show only notes for my profile' : 'Show notes for all profiles'}</a></p>` : ''))}
    ${sec('votes', `Votes in the House (${votes.length})`, votes.length ? `<p class="muted small">Votes whose title matches this issue’s Dutch keywords. Most recent first.</p>${votes.slice(0, 15).map((v) => voteRow(v)).join('')}${votes.length > 15 ? `<p><a href="#/votes/issue=${id}">All ${votes.length} votes →</a></p>` : ''}` : '<p class="muted">No matching votes found.</p>')}
    ${list()}
  </div><aside class="side card"><strong>On this page</strong>${toc.map(([k, t]) => `<a href="#${k}" data-scroll="${k}">${t}</a>`).join('')}</aside></div>`;
};

pages.parties = async () => {
  const s = await base();
  const [gov, stats, senate] = await Promise.all([tryLoad('content/government.json'), tryLoad('generated/stats.json'), tryLoad('generated/senate_members.json')]);
  const coalition = new Set(gov?.cabinet?.parties || []);
  const ab = s.parties.map((p) => p.abbr);
  const heat = (v) => `hsl(${Math.round(((v - 30) / 70) * 120)},45%,38%)`;
  return `<h1>Parties</h1><p class="lead">${s.parties.length} groups hold the 150 seats in the House of Representatives.</p>
    ${seatBar(s.parties, 150, (p) => '#/party/' + partySlug(p.abbr))}
    <div class="tablewrap"><table><thead><tr><th>Party</th><th>Name</th><th>House</th><th>Senate</th><th>Role</th><th>Motions adopted</th></tr></thead><tbody>
    ${s.parties.map((p) => { const st = stats?.party?.[p.abbr]; return `<tr><td>${partyTag(p.abbr)}</td><td>${esc(p.name_en || p.name_nl)}</td><td>${p.seats}</td><td>${senate?.seats?.[p.abbr] ?? 0}</td><td>${!gov ? '–' : coalition.has(p.abbr) ? '<span class="pill">Coalition</span>' : '<span class="muted">Opposition</span>'}</td><td>${st?.submitted ? `${st.submitted_adopted} of ${st.submitted} (${Math.round((100 * st.submitted_adopted) / st.submitted)}%)` : '–'}</td></tr>`; }).join('')}
    </tbody></table></div>
    ${stats ? `<h2>How often parties vote the same way</h2><p class="muted small">Share of House votes since ${fmtDate(s.meta?.term_start)} in which both groups voted the same (for or against). Calculated from the official voting records.</p>
    <div class="tablewrap"><table class="heat"><thead><tr><th></th>${ab.map((a) => `<th title="${esc(a)}">${esc(a.replace('Groep Markuszower', 'Mark.').replace('ChristenUnie', 'CU').replace('Lid Keijzer', 'Keij.'))}</th>`).join('')}</tr></thead><tbody>
    ${ab.map((a) => `<tr><th style="text-align:left;white-space:nowrap">${partyTag(a)}</th>${ab.map((b) => { const v = stats.agreement?.[a]?.[b]; return a === b ? '<td class="muted">·</td>' : v == null ? '<td></td>' : `<td class="c" style="background:${heat(v)}">${v}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : ''}`;
};

pages.party = async (slug) => {
  const s = await base();
  const p = s.parties.find((x) => partySlug(x.abbr) === slug);
  if (!p) return notFound();
  const [d, members, stats, senate, gov] = await Promise.all([tryLoad(`content/parties/${slug}.json`), load('generated/house_members.json'), tryLoad('generated/stats.json'), tryLoad('generated/senate_members.json'), tryLoad('content/government.json')]);
  const { ref, list } = makeRefs(d || {});
  const mem = members.filter((m) => m.current && m.party === p.abbr);
  const sen = (senate?.members || []).filter((m) => m.party === p.abbr);
  const cab = (gov?.members || []).filter((m) => m.party === p.abbr);
  const pos = s.index.positions[p.abbr] || [];
  const st = stats?.party?.[p.abbr];
  const agr = Object.entries(stats?.agreement?.[p.abbr] || {}).filter(([k]) => k !== p.abbr).sort((a, b) => b[1] - a[1]);
  return `<div class="crumbs"><a href="#/parties">Parties</a> ›</div>
    <h1><span class="dot" style="background:${color(p.abbr)};width:1.1rem;height:1.1rem"></span> ${esc(d?.name_en || p.name_en || p.abbr)}</h1>
    <p class="lead">${esc(p.abbr)}${d?.name_nl && d.name_nl !== d.name_en ? ' · ' + esc(d.name_nl) : ''}${d?.founded ? ' · founded ' + esc(d.founded) : ''}${d?.website ? ` · <a href="${esc(d.website)}" target="_blank" rel="noopener">website ↗</a>` : ''}</p>
    <div class="facts">
      <div class="fact"><div class="l">House seats</div><div class="v">${p.seats} of 150</div>${d?.seats_house_2025_election != null ? `<div class="n">${d.seats_house_2025_election} won in Oct 2025${d.seats_house_2023_election != null ? `; ${d.seats_house_2023_election} in 2023` : ''}</div>` : ''}</div>
      <div class="fact"><div class="l">Senate seats</div><div class="v">${sen.length} of 75</div></div>
      <div class="fact"><div class="l">Role</div><div class="v">${!gov ? '–' : gov.cabinet.parties.includes(p.abbr) ? 'Coalition' : 'Opposition'}</div>${cab.length ? `<div class="n">${cab.length} cabinet members</div>` : ''}</div>
      ${d?.party_leader ? `<div class="fact"><div class="l">Party leader</div><div class="v">${esc(d.party_leader)}</div>${d.house_group_leader && d.house_group_leader !== d.party_leader ? `<div class="n">House group leader: ${esc(d.house_group_leader)}</div>` : ''}</div>` : ''}
      ${st ? `<div class="fact"><div class="l">Voted with the majority</div><div class="v">${Math.round((100 * st.with_majority) / (st.votes || 1))}%</div><div class="n">of ${st.votes} House votes this term</div></div>
      <div class="fact"><div class="l">Own motions adopted</div><div class="v">${st.submitted_adopted} of ${st.submitted}</div></div>` : ''}
    </div>
    ${d ? `${(d.described_as || []).length ? `<h2>Profile</h2>${d.described_as.map((x) => `<p>${esc(x.text)}${ref(x.source_ids)}</p>`).join('')}` : ''}
      ${d.manifesto_2025?.key_points?.length ? `<h2>${d.manifesto_2025.title ? '2025 manifesto: ' + esc(d.manifesto_2025.title) : 'Stated positions'}</h2>${d.manifesto_2025.url ? `<p class="small"><a href="${esc(d.manifesto_2025.url)}" target="_blank" rel="noopener">Read the manifesto (Dutch) ↗</a></p>` : ''}
        <div class="tablewrap"><table><tbody>${d.manifesto_2025.key_points.map((k) => `<tr><th style="width:150px">${esc(k.topic)}</th><td>${esc(k.text)}${ref(k.source_ids)}</td></tr>`).join('')}</tbody></table></div>` : ''}` : '<div class="notice">A written profile for this party has not been compiled yet.</div>'}
    ${pos.length ? `<h2>Positions on the issues</h2><div class="card">${pos.map((x) => `<div class="pos"><div class="pos-head"><a href="#/issue/${x.issue}"><strong>${esc(x.title)}</strong></a> ${salience(x.salience)}</div><p>${esc(x.position)}</p></div>`).join('')}</div>` : ''}
    ${agr.length ? `<h2>Votes most and least often with</h2><p class="small muted">Share of House votes this term in which both groups voted the same.</p><div class="pv">${agr.slice(0, 4).map(([k, v]) => `<span>${partyTag(k)} <span class="pill good">${v}%</span></span>`).join('')} <span class="muted">…</span> ${agr.slice(-4).map(([k, v]) => `<span>${partyTag(k)} <span class="pill bad">${v}%</span></span>`).join('')}</div>` : ''}
    ${d?.recent_developments?.length ? `<h2>Recent developments</h2><ul class="timeline">${d.recent_developments.map((t) => `<li><span class="d">${fmtDate(t.date)}</span>${esc(t.event)}${ref(t.source_ids)}</li>`).join('')}</ul>` : ''}
    ${d?.history?.length ? `<h2>History</h2><ul class="timeline">${d.history.map((t) => `<li><span class="d">${fmtDate(t.date)}</span>${esc(t.event)}${ref(t.source_ids)}</li>`).join('')}</ul>` : ''}
    ${cab.length ? `<h2>In the cabinet (${cab.length})</h2><div class="grid tight">${cab.map((m) => personCard(profileHref(s, m.name) || '#/government', m.name, m.party, m.role_en)).join('')}</div>` : ''}
    <h2>Members of the House (${mem.length})</h2><div class="grid tight">${mem.map((m) => personCard('#/person/' + m.id, m.name, m.party, m.role === 'Fractievoorzitter' ? 'Group leader' : '')).join('')}</div>
    ${sen.length ? `<h2>Senators (${sen.length})</h2><div class="grid tight">${sen.map((m) => personCard(m.url, m.name, m.party, m.role || '', m.photo)).join('')}</div>` : ''}
    ${d ? list() : ''}`;
};
const profileHref = (s, name) => { const p = s.index.people.find((x) => x.name === name); return p ? '#/profile/' + p.slug : null; };

pages.people = async (tab = 'house') => {
  const s = await base();
  const [members, senate, gov] = await Promise.all([load('generated/house_members.json'), tryLoad('generated/senate_members.json'), tryLoad('content/government.json')]);
  const tabs = [['house', `House (${members.filter((m) => m.current).length})`], ['senate', `Senate (${senate?.members.length ?? 0})`], ['cabinet', `Cabinet (${gov?.members?.length ?? 0})`], ['former', 'Left the House this term']];
  let body = '';
  if (tab === 'house' || tab === 'former') {
    const list = members.filter((m) => (tab === 'house' ? m.current : !m.current));
    body = `<div class="filters"><input type="search" id="q" placeholder="Search by name…"><select id="fp"><option value="">All parties</option>${s.parties.map((p) => `<option>${esc(p.abbr)}</option>`).join('')}</select></div>
      <div class="grid tight" id="plist">${list.map((m) => `<div data-n="${esc(m.name.toLowerCase())}" data-p="${esc(m.party)}">${personCard('#/person/' + m.id, m.name, m.party, m.current ? (m.role === 'Fractievoorzitter' ? 'Group leader' : m.city || '') : 'left ' + fmtDate(m.left))}</div>`).join('')}</div>`;
  } else if (tab === 'senate') {
    const parties = Object.entries(senate?.seats || {}).map(([abbr, seats]) => ({ abbr, seats }));
    body = `${seatBar(parties, 75, (p) => (state.partyAbbrs.has(p.abbr) ? '#/party/' + partySlug(p.abbr) : '#/people/senate'))}<div class="legend">${parties.map((p) => `<span>${partyTag(p.abbr)} ${p.seats}</span>`).join('')}</div>
      <p class="muted small">The Senate was elected in May 2023 by the provincial councils. Cards link to the member’s page on eerstekamer.nl. Senate voting records are not yet included in this app.</p>
      <div class="filters"><input type="search" id="q" placeholder="Search by name…"></div>
      <div class="grid tight" id="plist">${(senate?.members || []).map((m) => `<div data-n="${esc(m.name.toLowerCase())}" data-p="${esc(m.party)}">${personCard(m.url, m.name, m.party, m.role || m.city?.split(',')[0] || '', m.photo)}</div>`).join('')}</div>`;
  } else {
    body = gov ? cabinetTable(s, gov, makeRefs(gov).ref) : '<p class="muted">Cabinet data not available yet.</p>';
  }
  return `<h1>People</h1><p class="lead">Everyone elected to the two chambers of parliament, and the ministers and state secretaries of the cabinet.</p>
    ${s.index.people.length ? `<div class="notice"><strong>Track records:</strong> ${s.index.people.map((p) => `<a href="#/profile/${p.slug}">${esc(p.name)}</a> (${esc(p.role || '')})`).join(' · ')} — speaking themes, promises and fact-checks with sources.</div>` : ''}
    <div class="tabs">${tabs.map(([k, t]) => `<a class="chip ${k === tab ? 'on' : ''}" href="#/people/${k}">${t}</a>`).join('')}</div>${body}`;
};
const cabinetTable = (s, gov, ref) => `<div class="tablewrap"><table><thead><tr><th>Name</th><th>Role</th><th>Party</th><th>Responsibilities</th></tr></thead><tbody>
  ${gov.members.map((m) => { const h = profileHref(s, m.name); return `<tr><td>${h ? `<a href="${h}"><strong>${esc(m.name)}</strong></a>` : `<strong>${esc(m.name)}</strong>`}${m.previous ? `<br><span class="small muted">Before: ${esc(m.previous)}</span>` : ''}</td><td>${esc(m.role_en)}${ref(m.source_ids)}<br><span class="small muted">${esc(m.ministry || '')}</span></td><td>${partyTag(m.party)}</td><td class="small">${esc(m.portfolio || '')}</td></tr>`; }).join('')}</tbody></table></div>`;

pages.person = async (id, sub) => {
  const s = await base();
  const members = await load('generated/house_members.json');
  const m = members.find((x) => x.id === id);
  if (!m) return notFound();
  const votes = await allVotes();
  const partyAt = (d) => m.memberships.find((x) => x.from <= d && (!x.to || d <= x.to))?.party;
  const mine = [];
  let dissent = 0;
  for (const v of votes) {
    const party = partyAt(v.d);
    if (!party) continue;
    const own = v.iv ? v.iv[m.id] : undefined;
    const pv = v.pv[party];
    const val = v.iv ? own ?? 'x' : pv;
    if (!val) continue;
    const dis = v.iv && own && pv && own !== pv;
    if (dis) dissent++;
    mine.push({ v, val, roll: !!v.iv, party });
  }
  const submitted = votes.filter((v) => v.subs?.some((x) => x.id === m.id && x.r === 'Indiener'));
  const cosigned = votes.filter((v) => v.subs?.some((x) => x.id === m.id && x.r !== 'Indiener')).length;
  const roll = mine.filter((x) => x.roll);
  const filt = sub === 'roll' ? roll : sub === 'submitted' ? submitted.map((v) => mine.find((x) => x.v === v) || { v, val: null }) : mine;
  const age = m.born ? Math.floor((Date.now() - new Date(m.born)) / 31557600000) : null;
  const prof = profileHref(s, m.name);
  return `<div class="crumbs"><a href="#/people">People</a> › <a href="#/party/${partySlug(m.party)}">${esc(m.party)}</a> ›</div>
    <div class="person" style="align-items:flex-start;gap:1.2rem">${m.has_photo ? `<img class="avatar" style="width:96px;height:96px" src="https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Persoon(${m.id})/resource" alt="">` : ''}
    <div><h1>${esc(m.name)}</h1><p class="lead">${partyTag(m.party)} · ${m.current ? (m.role === 'Fractievoorzitter' ? 'Group leader in the House of Representatives' : 'Member of the House of Representatives') : 'Former member of the House (left ' + fmtDate(m.left) + ')'}</p>
    ${prof ? `<p><a class="btn" href="${prof}">Track record: themes, promises, fact-checks →</a></p>` : ''}</div></div>
    <div class="facts">
      ${age ? `<div class="fact"><div class="l">Born</div><div class="v">${fmtDate(m.born)}</div><div class="n">age ${age}${m.birthplace ? ' · ' + esc(m.birthplace) : ''}</div></div>` : ''}
      ${m.city ? `<div class="fact"><div class="l">Lives in</div><div class="v">${esc(m.city)}</div></div>` : ''}
      <div class="fact"><div class="l">In this House since</div><div class="v">${fmtDate(m.since)}</div></div>
      <div class="fact"><div class="l">Motions submitted</div><div class="v">${submitted.filter((v) => v.k === 'Motie').length}</div><div class="n">${submitted.filter((v) => v.k === 'Motie' && v.r === 'adopted').length} adopted · co-signed ${cosigned} more</div></div>
      <div class="fact"><div class="l">Roll-call votes</div><div class="v">${roll.filter((x) => x.val !== 'x').length} of ${roll.length}</div><div class="n">took part${dissent ? ` · ${dissent} against own group` : ''}</div></div>
    </div>
    ${m.memberships.length > 1 ? `<h2>Group membership this term</h2><ul class="timeline">${m.memberships.map((x) => `<li><span class="d">${fmtDate(x.from)} – ${x.to ? fmtDate(x.to) : 'now'}</span>${partyTag(x.party)}</li>`).join('')}</ul>` : ''}
    ${m.committees.length ? `<h2>Committees</h2><div class="chips">${m.committees.map((c) => `<span class="chip" style="cursor:default">${esc(c.name)}${c.role && c.role !== 'Lid' ? ` <span class="muted">(${esc({ Vz: 'chair', OnderVz: 'vice-chair' }[c.role] || c.role)})</span>` : ''}</span>`).join('')}</div>` : ''}
    <h2>Voting record</h2>
    <div class="notice">Most House votes are taken by show of hands, with each group voting as a block; for those, this page shows the vote of ${esc(m.name)}’s group at the time. Only roll-call votes record each member individually.</div>
    <div class="tabs"><a class="chip ${!sub ? 'on' : ''}" href="#/person/${id}">All (${mine.length})</a><a class="chip ${sub === 'roll' ? 'on' : ''}" href="#/person/${id}/roll">Roll-call votes (${roll.length})</a><a class="chip ${sub === 'submitted' ? 'on' : ''}" href="#/person/${id}/submitted">Own motions and amendments (${submitted.length})</a></div>
    ${paged(filt, (x) => voteRow(x.v, x.val ? (x.val === 'x' ? '<span class="pill neutral">Absent</span>' : vpill(x.val)) + (x.roll ? ' <span class="pill">individual</span>' : '') + '<br>' : ''))}`;
};

// simple "show more" pager; rows are rendered lazily
let pagerSeq = 0; const pagers = new Map();
function paged(items, render, size = 40) {
  const id = 'pg' + ++pagerSeq; pagers.set(id, { items, render, shown: size, size });
  return `<div id="${id}">${items.slice(0, size).map(render).join('') || '<p class="muted">Nothing to show.</p>'}</div>${items.length > size ? `<p><button class="btn ghost" data-more="${id}">Show more (${items.length - size} left)</button></p>` : ''}`;
}

pages.votes = async (query = '') => {
  const s = await base();
  const votes = await allVotes();
  const idx = await load('generated/votes/index.json');
  const f = Object.fromEntries(query.split('&').filter(Boolean).map((kv) => kv.split('=').map(decodeURIComponent)));
  let list = votes;
  if (f.issue) list = list.filter((v) => v.is?.includes(f.issue));
  if (f.kind) list = list.filter((v) => (KIND[v.k] || 'Other') === f.kind);
  if (f.result) list = list.filter((v) => v.r === f.result);
  if (f.month) list = list.filter((v) => v.d.startsWith(f.month));
  if (f.roll) list = list.filter((v) => v.iv);
  if (f.by) list = list.filter((v) => v.subs?.some((x) => x.r === 'Indiener' && x.p === f.by));
  if (f.q) { const q = f.q.toLowerCase(); list = list.filter((v) => (v.t + ' ' + v.ctx + ' ' + (v.nr || '')).toLowerCase().includes(q)); }
  const opt = (name, label, opts) => `<select data-f="${name}"><option value="">${label}</option>${opts.map(([v, t]) => `<option value="${esc(v)}" ${f[name] === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  return `<h1>Votes in the House</h1><p class="lead">${idx.total.toLocaleString('en')} votes on motions, amendments and bills since ${fmtDate(s.meta?.term_start)}, from the official records. ${idx.roll_call} were roll-call votes.</p>
    <div class="filters"><input type="search" data-f="q" placeholder="Search titles (Dutch), e.g. box 3, asiel, netcongestie…" value="${esc(f.q || '')}">
      ${opt('issue', 'All issues', s.index.issues.map((i) => [i.id, i.title.split(':')[0]]))}
      ${opt('kind', 'All types', [...new Set(Object.values(KIND))].map((k) => [k, k]))}
      ${opt('result', 'Any result', [['adopted', 'Adopted'], ['rejected', 'Rejected']])}
      ${opt('by', 'Submitted by any party', s.parties.map((p) => [p.abbr, p.abbr]))}
      ${opt('month', 'All months', idx.months.map((m) => [m.month, fmtDate(m.month)]))}
      ${opt('roll', 'All voting methods', [['1', 'Roll-call only']])}</div>
    <p class="muted small">${list.length.toLocaleString('en')} votes · ${list.filter((v) => v.r === 'adopted').length.toLocaleString('en')} adopted · click a vote to see how each group voted.</p>
    ${paged(list, (v) => voteRow(v))}`;
};

pages.government = async () => {
  const s = await base();
  const g = await tryLoad('content/government.json');
  if (!g) return '<h1>Government</h1><p class="muted">Not compiled yet.</p>';
  const { ref, list } = makeRefs(g);
  const c = g.cabinet;
  return `<h1>Government</h1><p class="lead">${esc(c.summary)}${ref(c.source_ids)}</p>
    <div class="facts"><div class="fact"><div class="l">Cabinet</div><div class="v">${esc(c.name)}</div><div class="n">${esc(c.type)}</div></div>
      <div class="fact"><div class="l">Sworn in</div><div class="v">${fmtDate(c.sworn_in)}</div></div>
      <div class="fact"><div class="l">Coalition</div><div class="v pv">${c.parties.map((p) => partyTag(p)).join('')}</div></div>
      <div class="fact"><div class="l">Seats</div><div class="v">${c.seats_house} / 150 House</div><div class="n">${c.seats_senate} / 75 Senate</div></div></div>
    ${c.coalition_agreement ? `<p>Coalition agreement: <a href="${esc(c.coalition_agreement.url)}" target="_blank" rel="noopener">${esc(c.coalition_agreement.title_en || c.coalition_agreement.title_nl)} ↗</a> <span class="muted">(${esc(c.coalition_agreement.title_nl)}, ${fmtDate(c.coalition_agreement.date)})</span></p>` : ''}
    <h2>Ministers and state secretaries (${g.members.length})</h2>${cabinetTable(s, g, ref)}
    ${g.coalition_agreement_points?.length ? `<h2>What the coalition agreed</h2><div class="tablewrap"><table><tbody>${g.coalition_agreement_points.map((k) => `<tr><th style="width:170px">${esc(k.topic)}</th><td>${esc(k.text)}${ref(k.source_ids)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${g.ministries?.length ? `<h2>Ministries</h2><div class="tablewrap"><table><thead><tr><th>Ministry</th><th>Responsibilities</th><th>2027 budget (main budget chapter, rounded)</th></tr></thead><tbody>${g.ministries.map((m) => `<tr><td><strong>${esc(m.name_en)}</strong><br><span class="small muted">${esc(m.name_nl)}${m.abbr ? ' · ' + esc(m.abbr) : ''}</span></td><td class="small">${esc(m.responsibilities)}${ref(m.source_ids)}</td><td>${m.budget_2027_eur_bn != null ? '€' + m.budget_2027_eur_bn + ' bn' : '–'}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${g.election_2025 ? `<h2>The election of ${fmtDate(g.election_2025.date)}</h2><p class="muted small">Turnout ${g.election_2025.turnout_pct}%.${ref(g.election_2025.source_ids)} Seat numbers today differ where members have since switched groups.</p>
      <div class="tablewrap"><table><thead><tr><th>Party</th><th>Seats</th><th>Votes</th><th>Change vs 2023</th></tr></thead><tbody>${g.election_2025.results.map((r) => `<tr><td>${esc(r.party)}</td><td>${r.seats}</td><td>${r.votes_pct != null ? r.votes_pct + '%' : ''}</td><td>${r.change_vs_2023 > 0 ? '+' : ''}${r.change_vs_2023 ?? ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${g.formation_timeline?.length ? `<h2>Timeline: from the fall of the last cabinet to today</h2><ul class="timeline">${g.formation_timeline.map((t) => `<li><span class="d">${fmtDate(t.date)}</span>${esc(t.event)}${ref(t.source_ids)}</li>`).join('')}</ul>` : ''}
    ${g.upcoming?.length ? `<h2>Coming up</h2><ul class="timeline">${g.upcoming.map((t) => `<li><span class="d">${fmtDate(t.date)}</span>${esc(t.event)}${ref(t.source_ids)}</li>`).join('')}</ul>` : ''}
    ${list()}`;
};

pages.how = async () => {
  await base();
  const d = await tryLoad('content/how-it-works.json');
  if (!d) return '<h1>How it works</h1><p class="muted">Not compiled yet.</p>';
  const { ref, list } = makeRefs(d);
  return `<h1>How Dutch politics works</h1><p class="lead">A guide to the institutions, the elections and how laws are made.</p>
    <div class="two"><div>${d.sections.map((x) => `<h2 id="${esc(x.id)}">${esc(x.title)}</h2>${x.paragraphs.map((p, i) => `<p>${esc(p)}${i === x.paragraphs.length - 1 ? ref(x.source_ids) : ''}</p>`).join('')}
      ${x.facts?.length ? `<div class="facts">${x.facts.map((f) => `<div class="fact"><div class="l">${esc(f.label)}</div><div class="v">${esc(f.value)}</div></div>`).join('')}</div>` : ''}`).join('')}
      <h2 id="glossary">Glossary</h2><div class="tablewrap"><table><thead><tr><th>Dutch</th><th>English</th><th>Meaning</th></tr></thead><tbody>${(d.glossary || []).map((x) => `<tr><td><em>${esc(x.term_nl)}</em></td><td><strong>${esc(x.term_en)}</strong></td><td class="small">${esc(x.definition)}</td></tr>`).join('')}</tbody></table></div>
      ${list()}</div>
    <aside class="side card"><strong>On this page</strong>${d.sections.map((x) => `<a href="#${esc(x.id)}" data-scroll="${esc(x.id)}">${esc(x.title)}</a>`).join('')}<a href="#glossary" data-scroll="glossary">Glossary</a></aside></div>`;
};

const STATUS = { kept: ['Kept', 'good'], broken: ['Broken', 'bad'], partly_kept: ['Partly kept', 'warn'], in_progress: ['In progress', 'neutral'], not_yet_due: ['Not yet due', 'neutral'], unclear: ['Unclear / disputed', 'neutral'] };
const VERDICT = { true: ['True', 'good'], mostly_true: ['Mostly true', 'good'], half_true: ['Half true', 'warn'], mostly_false: ['Mostly false', 'bad'], false: ['False', 'bad'], unverifiable: ['Unverifiable', 'neutral'] };
const CSSVAR = { good: 'var(--good)', bad: 'var(--bad)', warn: 'var(--warn)', neutral: 'var(--neutral)' };
function tally(items, key, map) {
  const counts = {}; for (const i of items) counts[i[key]] = (counts[i[key]] || 0) + 1;
  const keys = Object.keys(map).filter((k) => counts[k]);
  if (!items.length) return '<p class="muted">None found.</p>';
  return `<div class="statbar">${keys.map((k) => `<span style="width:${(100 * counts[k]) / items.length}%;background:${CSSVAR[map[k][1]]};opacity:${k === 'mostly_true' || k === 'mostly_false' || k === 'in_progress' ? 0.6 : 1}" title="${map[k][0]}: ${counts[k]}"></span>`).join('')}</div>
    <div class="legend">${keys.map((k) => `<span><span class="pill ${map[k][1]}">${map[k][0]}</span> ${counts[k]}</span>`).join('')}</div>`;
}

pages.profile = async (slug) => {
  await base();
  const d = await tryLoad(`content/people/${slug}.json`);
  if (!d) return notFound();
  const { ref, list } = makeRefs(d);
  const toc = [['record', 'Summary'], ['themes', 'What they talk about'], ['promises', 'Promises'], ['checks', 'Fact-checks'], ['reversals', 'Changes of position'], ['controversies', 'Controversies'], ['bio', 'Career'], ['sources', 'Sources']];
  return `<div class="crumbs"><a href="#/people">People</a> › Track record ›</div>
    <h1>${esc(d.name)}</h1><p class="lead">${partyTag(d.party)} · ${esc(d.role)}</p>
    <p class="muted small">Updated ${fmtDate(d.updated)} · ${d.sources.length} sources</p>
    <div class="two"><div>
    <h2 id="record">Summary of the record</h2>
    <div class="notice">This page does not give a score. It counts documented items: promises with the evidence of what happened, and fact-checks carried out by named news organisations. Each classification follows from the cited sources; open the item to read the evidence.</div>
    <div class="grid"><div class="card"><h3>Promises (${(d.promises || []).length})</h3>${tally(d.promises || [], 'status', STATUS)}</div>
      <div class="card"><h3>Third-party fact-checks (${(d.fact_checks || []).length})</h3>${tally(d.fact_checks || [], 'verdict_class', VERDICT)}</div></div>
    <h2 id="themes">What they talk about</h2>${(d.speaking_themes || []).map((t) => `<div class="block"><h3>${esc(t.theme)}</h3><p>${esc(t.summary)}${ref(t.source_ids)}</p>${(t.quotes || []).map((q) => quote(q, ref)).join('')}</div>`).join('')}
    <h2 id="promises">Promises and what happened</h2>${(d.promises || []).map((p) => { const st = STATUS[p.status] || [p.status, 'neutral']; return `<div class="claim"><span class="pill ${st[1]}">${st[0]}</span> <span class="small muted">${esc([p.where, fmtDate(p.made)].filter(Boolean).join(' · '))}</span>
      <div class="q" style="margin-top:.4rem">${esc(p.promise)}</div>${quote(p.quote, ref)}<div class="lab">What happened</div><div>${esc(p.evidence)}${ref(p.source_ids)}</div></div>`; }).join('')}
    <h2 id="checks">Fact-checks by news organisations</h2>${d.fact_checks_note ? `<div class="notice">${esc(d.fact_checks_note)}</div>` : ''}${(d.fact_checks || []).length ? d.fact_checks.map((c) => { const st = VERDICT[c.verdict_class] || [c.verdict_class, 'neutral']; return `<div class="claim"><span class="pill ${st[1]}">${st[0]}</span> <span class="small muted">${esc([c.checker, c.where, fmtDate(c.date)].filter(Boolean).join(' · '))}</span>
      <div class="q" style="margin-top:.4rem">“${esc(c.claim)}”</div><div class="lab">Verdict of ${esc(c.checker)}</div><div>${esc(c.verdict)}. ${esc(c.explanation || '')}${ref(c.source_ids)} ${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">Read the fact-check ↗</a>` : ''}</div></div>`; }).join('') : '<p class="muted">No third-party fact-checks found.</p>'}
    ${(d.reversals || []).length ? `<h2 id="reversals">Changes of position</h2>${d.reversals.map((r) => `<div class="claim"><div class="q">${esc(r.topic)}</div><div class="lab">Before</div><div>${esc(r.before)}</div><div class="lab">After</div><div>${esc(r.after)}</div>${r.explanation_given ? `<div class="lab">Explanation given</div><div>${esc(r.explanation_given)}</div>` : ''}${ref(r.source_ids)}</div>`).join('')}` : ''}
    ${(d.controversies || []).length ? `<h2 id="controversies">Controversies</h2>${d.controversies.map((r) => `<div class="claim"><span class="small muted">${fmtDate(r.date)}</span><div>${esc(r.summary)}${ref(r.source_ids)}</div></div>`).join('')}` : ''}
    <h2 id="bio">Career</h2><ul class="timeline">${(d.bio || []).map((t) => `<li><span class="d">${fmtDate(t.date)}</span>${esc(t.event)}${ref(t.source_ids)}</li>`).join('')}</ul>
    ${list()}</div>
    <aside class="side card"><strong>On this page</strong>${toc.map(([k, t]) => `<a href="#${k}" data-scroll="${k}">${t}</a>`).join('')}</aside></div>`;
};

pages.me = async () => {
  const s = await base();
  const tags = myTags(), iss = myIssues();
  let impact = '';
  if (tags.size) {
    const docs = await Promise.all(s.index.issues.map((i) => tryLoad(`content/issues/${i.id}.json`)));
    impact = docs.filter(Boolean).sort((a, b) => iss.has(b.id) - iss.has(a.id)).map((d) => {
      const { ref } = makeRefs(d);
      const notes = (d.impact || []).filter((n) => n.applies_to.some((t) => tags.has(t)));
      return notes.length ? `<h3><a href="#/issue/${d.id}">${esc(d.title)}</a></h3>${impactNotes({ impact: notes }, ref, true)}` : '';
    }).join('');
  }
  return `<h1>My profile</h1><p class="lead">Tick what applies to you. The app then shows, for each issue, the consequences of current rules and pending proposals for people in your situation.</p>
    <p class="muted small">Your answers are stored only in this browser. Nothing is sent anywhere.</p>
    ${PROFILE.map(([group, opts]) => `<h3>${group}</h3><div class="chips">${opts.map(([k, l]) => `<span class="chip ${tags.has(k) ? 'on' : ''}" data-tag="${k}" role="button" tabindex="0">${l}</span>`).join('')}</div>`).join('')}
    <h3>Issues I follow</h3><div class="chips">${s.index.issues.map((i) => `<span class="chip ${iss.has(i.id) ? 'on' : ''}" data-issue="${i.id}" role="button" tabindex="0">${esc(i.title.split(':')[0])}</span>`).join('')}</div>
    <h2>What the issues mean for me</h2>${tags.size ? impact || '<p class="muted">No specific notes match your profile yet.</p>' : '<p class="muted">Select at least one option above.</p>'}`;
};

const notFound = () => '<h1>Not found</h1><p><a href="#/">Back to the start</a></p>';

// ---------- router ----------
const routes = { '': 'home', issues: 'issues', issue: 'issue', parties: 'parties', party: 'party', people: 'people', person: 'person', profile: 'profile', votes: 'votes', government: 'government', how: 'how', me: 'me' };
let renderSeq = 0;
async function render(keepScroll) {
  const hash = location.hash.replace(/^#\/?/, '');
  const [head, ...rest] = hash.split('/');
  const page = pages[routes[head]];
  if (!page) { if (document.getElementById(hash)) return; $app.innerHTML = notFound(); return; }
  const seq = ++renderSeq; const y = scrollY;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#/' + head || (head === 'issue' && a.getAttribute('href') === '#/issues') || (['party'].includes(head) && a.getAttribute('href') === '#/parties') || (['person', 'profile'].includes(head) && a.getAttribute('href') === '#/people')));
  document.getElementById('nav').classList.remove('open');
  try {
    if (!$app.dataset.route) $app.innerHTML = '<p class="loading">Loading…</p>';
    const html = await page(...rest.map(decodeURIComponent));
    if (seq !== renderSeq) return;
    $app.innerHTML = html; $app.dataset.route = hash;
    scrollTo(0, keepScroll ? y : 0);
    const h1 = $app.querySelector('h1'); document.title = (h1 ? h1.textContent.trim() + ' · ' : '') + 'Dutch Politics Explained';
  } catch (e) {
    console.error(e);
    $app.innerHTML = `<h1>Something went wrong</h1><p class="muted">${esc(e.message)}</p><p><a href="#/">Back to the start</a></p>`;
  }
}
addEventListener('hashchange', () => render(false));

// ---------- events ----------
document.querySelector('.menu-btn').addEventListener('click', (e) => { const open = document.getElementById('nav').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', open); });
const toggle = (key, val) => { const set = new Set(store.get(key, [])); set.has(val) ? set.delete(val) : set.add(val); store.set(key, [...set]); };
$app.addEventListener('click', (e) => {
  const t = e.target.closest('[data-scroll],[data-tag],[data-issue],[data-follow],[data-more]');
  if (!t) return;
  if (t.dataset.scroll) { e.preventDefault(); document.getElementById(t.dataset.scroll)?.scrollIntoView(); }
  else if (t.dataset.tag) { toggle('tags', t.dataset.tag); render(true); }
  else if (t.dataset.issue) { toggle('issues', t.dataset.issue); render(true); }
  else if (t.dataset.follow) { toggle('issues', t.dataset.follow); render(true); }
  else if (t.dataset.more) {
    const p = pagers.get(t.dataset.more); const next = p.items.slice(p.shown, p.shown + p.size * 2);
    document.getElementById(t.dataset.more).insertAdjacentHTML('beforeend', next.map(p.render).join('')); p.shown += next.length;
    if (p.shown >= p.items.length) t.parentElement.remove(); else t.textContent = `Show more (${p.items.length - p.shown} left)`;
  }
});
$app.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.chip[role=button]')) { e.preventDefault(); e.target.click(); } });
$app.addEventListener('input', (e) => {
  if (e.target.id === 'q' || e.target.id === 'fp') {
    const q = (document.getElementById('q')?.value || '').toLowerCase(), fp = document.getElementById('fp')?.value || '';
    document.querySelectorAll('#plist > div').forEach((el) => { el.hidden = !(el.dataset.n.includes(q) && (!fp || el.dataset.p === fp)); });
  }
});
$app.addEventListener('change', (e) => {
  if (!e.target.dataset.f) return;
  const f = {}; document.querySelectorAll('[data-f]').forEach((el) => { if (el.value) f[el.dataset.f] = el.value; });
  location.hash = '#/votes/' + Object.entries(f).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
});
render(false);
