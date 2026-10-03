/**
 * The pure half of `scripts/permit-boards-scan.mjs`: which hosts to ask, what a
 * board's commune menu means, which communes a scan keeps, and the module it
 * writes. No request is made here; the script does the asking.
 *
 * WHY A SCAN. Every Cart@DS instance serves the same public board at
 * `<base>/Login/AffichageReglementaire` (`cartdsFeed.js`), and most of them run
 * on one hosting family, `<tenant>.geosphere.fr`. Reading the communes' own
 * websites finds one board at a time; asking the hosting family which tenants
 * it has finds them all at once. Measured 2026-10-01: of 389 hosts asked —
 * the `geosphere.fr` tenants the Wayback Machine and the DNS know, and
 * nineteen boards on hosts of their own — 303 answered a board, and 1 230
 * communes no other register read had posted within three months, where the
 * registry read 21 instances and 194 communes by hand.
 *
 * A board appears whenever a commune or an intercommunality moves its
 * instruction to Cart@DS, and the Code de l'urbanisme has let the filing notice
 * be posted online since 28 September 2026 (art. R.423-6), so the scan is meant
 * to run again every quarter.
 */

import { COMMUNE_CODE_PATTERN } from '../../src/data/communeCode.js';

/** Hosts that are the vendor's demonstration or training tenants, not a commune's. */
const NOT_A_TENANT = /^(?:demo|demogfi|ogo-demo|formation|test|recette|preprod|qualif|www|online|guichetunique|cartads)$/i;

/**
 * Whether a host is the vendor's own — a demonstration or training tenant
 * whose boards hold made-up dossiers. A guessed name can land on one: the DNS
 * answered for `demo.geosphere.fr` on 2026-10-01, menu and rows included.
 */
export function isVendorTenant(host) {
  const labels = String(host ?? '').toLowerCase().split('.');
  return labels.length > 2 && labels.slice(0, -2).some((label) => NOT_A_TENANT.test(label));
}

/**
 * How long a commune may go without posting before its board counts as dead.
 * A board forgets a decision after its two months of posting (Trap 1 of
 * `cartdsFeed.js`), so a commune that posts at all shows a row younger than
 * that; three months leaves room for a quiet summer.
 */
export const LIVE_WITHIN_DAYS = 92;

/**
 * The hosts and the board paths to try on each, from Wayback CDX lines.
 *
 * The board path is not always `/guichet-unique`: Sète Agglopôle posts under
 * `/guichet-urbanisme`, Doué under `/guichet-doue`. The archive has usually
 * seen the instance's own path, so the paths it saw under a `/Login/` URL are
 * tried first, then any first segment that looks like a portal, then the
 * default.
 *
 * @param {string[]} lines One URL per line (`fl=original`).
 * @param {string} domain The hosting family, `geosphere.fr`.
 * @returns {Array<{host: string, prefixes: string[]}>}
 */
export function candidatesFromCdx(lines, domain) {
  const hosts = new Map();
  for (const line of lines) {
    const match = /^https?:\/\/([^/:?#]+)(?::\d+)?(\/[^?#]*)?/i.exec(String(line).trim());
    if (!match) continue;
    const host = match[1].toLowerCase();
    if (host !== domain && !host.endsWith(`.${domain}`)) continue;
    if (NOT_A_TENANT.test(host.slice(0, -domain.length - 1))) continue;
    if (!hosts.has(host)) hosts.set(host, { login: new Set(), portal: new Set() });
    const pathname = match[2] ?? '/';
    const first = pathname.split('/')[1];
    if (!first) continue;
    let segment;
    try { segment = `/${decodeURIComponent(first)}`; } catch { segment = `/${first}`; }
    if (/\/login\//i.test(pathname)) hosts.get(host).login.add(segment);
    else if (/^\/(?:guichet|portail|gu[_-])/i.test(segment)) hosts.get(host).portal.add(segment);
  }
  const out = [];
  for (const [host, seen] of hosts) {
    const prefixes = [];
    for (const prefix of [...seen.login, ...seen.portal, '/guichet-unique']) {
      if (!prefixes.some((known) => known.toLowerCase() === prefix.toLowerCase())) prefixes.push(prefix);
    }
    out.push({ host, prefixes: prefixes.slice(0, 5) });
  }
  return out.sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Tenant names to try on `geosphere.fr`, from commune and intercommunality
 * names.
 *
 * The archive does not know every tenant: on 2026-10-01 it missed Ollioules,
 * Gonesse, Tournefeuille and Fontainebleau among others. A tenant is usually
 * the name of who runs it — `ollioules`, `le-cannet`, `ca-cambrai`,
 * `pays-sabolien` — and the family has no wildcard DNS, so asking the DNS
 * about a guessed name costs the family's servers nothing and answers only
 * for tenants that exist. Every name comes joined and hyphenated, with and
 * without its article, with `saint` spelled out and as `st`; a commune's also
 * comes after `ville-` (`ville-matoury`, `ville-creteil`: the only prefix that
 * answered when `mairie-`, `commune-` and `ville-de-` were asked of the 6 000
 * most populous on 2026-10-03).
 *
 * @param {Array<{nom: string, population?: number}>} communes
 * @param {Array<{nom: string}>} epcis
 * @param {number} [limit] How many communes, the most populous first.
 * @returns {string[]} Tenant labels, without the domain.
 */
export function tenantGuesses(communes, epcis, limit = 6000) {
  const fold = (name) => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/['’]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  const spellings = (words) => {
    const out = new Set();
    const short = words.map((word) => (word === 'saint' ? 'st' : word === 'sainte' ? 'ste' : word));
    const bare = words.filter((word, i) => !(i === 0 && ['le', 'la', 'les', 'l'].includes(word)));
    for (const form of [words, short, bare]) { out.add(form.join('')); out.add(form.join('-')); }
    return [...out].filter((name) => name.length >= 3 && name.length <= 63);
  };
  const names = new Set();
  const ranked = [...communes].sort((a, b) => (b.population ?? 0) - (a.population ?? 0)).slice(0, limit);
  for (const commune of ranked) for (const name of spellings(fold(commune.nom))) { names.add(name); if (name.length <= 57) names.add(`ville-${name}`); }
  for (const epci of epcis) {
    let words = fold(epci.nom);
    while (['ca', 'cc', 'cu', 'communaute', 'de', 'communes', 'd', 'agglomeration', 'urbaine', 'metropole', 'du', 'la', 'des'].includes(words[0])) words = words.slice(1);
    for (const name of spellings(words)) for (const prefix of ['', 'ca-', 'cc-', 'ca', 'cc', 'grand']) names.add(`${prefix}${name}`);
  }
  return [...names].sort();
}

/**
 * A commune name folded for matching: no accent, no ligature, no article in
 * brackets, `St` spelled out. The ligature is spelled out because the COG
 * writes Chambœuf and the menus CHAMBOEUF, and `œ` has no accent to drop.
 */
export function foldCommuneName(name) {
  let folded = String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').trim();
  const article = /^(.*?)\s*\((l'|l’|la|le|les)\)\s*$/.exec(folded);
  if (article) folded = `${article[2].replace(/['’]/, '')} ${article[1]}`;
  return folded
    .replace(/\(.*?\)/g, ' ')
    .replace(/['’`-]/g, ' ')
    .replace(/\bst\b/g, 'saint')
    .replace(/\bste\b/g, 'sainte')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Names a board's menu gives a commune that the official list does not, folded,
 * and the official name they stand for. Clichy's own board calls it by its
 * usual name, Clichy-la-Garenne; the COG has only Clichy (92024).
 */
export const MENU_NAME_ALIASES = Object.freeze({
  'clichy la garenne': 'clichy',
});

/**
 * The INSEE code a board's menu entry stands for, or null.
 *
 * A menu sends one of three things as the commune's value: the INSEE code;
 * the commune's three-digit number with its zeros dropped (`247` for
 * Porto-Vecchio, 2A247); or the INSEE code with its leading zero dropped
 * (`3058` for Châtillon, 03058, on the Allier's agency). The name settles the
 * last two, and the instance's other communes settle a name two departments
 * share. A name the official list does not know is read through
 * {@link MENU_NAME_ALIASES}.
 *
 * @param {{value: string, name: string}} entry
 * @param {{byCode: Map, byName: Map}} index From {@link indexCommunes}.
 * @param {?Set<string>} [departments] The departments the instance's other communes are in.
 * @returns {?string}
 */
export function resolveMenuCommune(entry, index, departments = null) {
  const value = String(entry?.value ?? '').trim().toUpperCase();
  const name = foldCommuneName(entry?.name);
  if (COMMUNE_CODE_PATTERN.test(value) && index.byCode.has(value)) return value;
  if (/^\d{4}$/.test(value)) {
    const commune = index.byCode.get(`0${value}`);
    if (commune && foldCommuneName(commune.nom) === name) return commune.code;
  }
  const named = index.byName.get(name)
    ?? index.byName.get(name.replace(/^(?:l|la|le|les) /, ''))
    ?? index.byName.get(MENU_NAME_ALIASES[name]) ?? [];
  const narrow = (list) => (list.length > 1 && departments ? list.filter((c) => departments.has(c.codeDepartement)) : list);
  if (/^\d{1,3}$/.test(value)) {
    const numbered = narrow(named.filter((c) => c.code.endsWith(value.padStart(3, '0'))));
    if (numbered.length === 1) return numbered[0].code;
  }
  const only = narrow(named);
  if (only.length === 1) return only[0].code;
  return departments ? renamedCommune(value, name, index, departments) : null;
}

/** A folded name's first word that is neither an article nor a saint. */
function headWord(folded) {
  return folded.split(' ').find((word) => !['l', 'la', 'le', 'les', 'saint', 'sainte'].includes(word)) ?? '';
}

/**
 * A commune the menu names its own way, found by the code it sends.
 *
 * Boards keep the name a commune had, or the one it goes by: Colmars les
 * Alpes for Colmars, Senez - Le Poil for Senez, Château-Arnoux for
 * Château-Arnoux-Saint-Auban, Sanilhac-et-Sagries for Sanilhac-Sagriès — 10
 * entries that posted between July and September 2026, on 6 boards. Their
 * value is still the number or the unpadded code: in the departments of the
 * board's other communes it names one commune, which counts when the two
 * names start with the same word.
 *
 * @param {string} value What the menu sends, upper-cased.
 * @param {string} name The menu's name, folded.
 * @param {{byCode: Map}} index
 * @param {Set<string>} departments
 * @returns {?string}
 */
function renamedCommune(value, name, index, departments) {
  if (!/^\d{1,5}$/.test(value)) return null;
  const head = headWord(name);
  const sent = (code) => (value.length > 3 ? code === value.padStart(5, '0') : code.endsWith(value.padStart(3, '0')));
  const found = [...index.byCode.values()].filter((commune) => departments.has(commune.codeDepartement)
    && sent(commune.code) && headWord(foldCommuneName(commune.nom)) === head);
  return found.length === 1 ? found[0].code : null;
}

/** Lookups over geo.api.gouv.fr's commune list. */
export function indexCommunes(communes) {
  const byCode = new Map();
  const byName = new Map();
  for (const commune of communes) {
    byCode.set(commune.code, commune);
    const key = foldCommuneName(commune.nom);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(commune);
  }
  return { byCode, byName };
}

/**
 * What the instance's menu sends for its communes, as `cartdsCommuneValue`
 * reads it: the way most of its entries follow, and what the others send.
 * Null when no entry follows any way.
 *
 * A menu can mix them. The Bastides de Lomagne's sends the INSEE code for 24
 * communes and the bare number, 13, for Beaumont-de-Lomagne (82013), which
 * posts the most of the 25 (2026-10-01); `values` keeps that 13.
 *
 * @param {Array<{value: string, insee: string}>} entries Resolved entries.
 * @returns {?{codes: ('insee'|'number'|'unpadded'), values: Object<string, string>}}
 */
export function menuCodes(entries) {
  const ways = [
    ['insee', (insee) => insee],
    ['number', (insee) => String(Number.parseInt(insee.slice(-3), 10))],
    ['unpadded', (insee) => insee.replace(/^0+/, '')],
  ];
  const sent = (entry) => String(entry.value).toUpperCase();
  let best = null;
  for (const [way, write] of ways) {
    const follow = entries.filter((entry) => sent(entry) === write(entry.insee)).length;
    if (follow && (!best || follow > best.follow)) best = { way, write, follow };
  }
  if (!best) return null;
  const values = {};
  for (const entry of entries) if (sent(entry) !== best.write(entry.insee)) values[entry.insee] = sent(entry);
  return { codes: best.way, values };
}

/** `dd/mm/yyyy` → `yyyy-mm-dd`, or null. */
export function boardDay(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(value ?? '').trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/** The day `days` before `day`, both `yyyy-mm-dd`. */
function daysBefore(day, days) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Words a host carries for the service, not for who runs it. */
const SERVICE_WORDS = new Set([
  'guichet', 'unique', 'urbanisme', 'urba', 'urb', 'demarches', 'demarche', 'ads', 'sig', 'intrageo', 'dau',
  'gfi', 'demat', 'droit', 'sol', 'cartads', 'extrageo', 'geo', 'gu', 'www', 'ville', 'mairie',
  'portail', 'dia', 'clicurba',
]);

/**
 * An instance key from its host: the tenant on a hosting family; on a host of
 * its own, the name left once the service's words are dropped — the
 * subdomain's (`guichet-unique-bobigny.siib.fr` is `bobigny`), else the
 * domain's (`demarches-urbanisme.ville-massy.fr` is `massy`).
 */
export function instanceKey(host) {
  const labels = host.toLowerCase().split('.');
  const named = (label) => label.split('-').filter((word) => word && !SERVICE_WORDS.has(word)).join('');
  if (labels.length > 2 && labels.slice(-2).join('.') === 'geosphere.fr') return labels[0].replace(/[^a-z0-9]/g, '');
  for (const label of labels.slice(0, -1)) {
    const name = named(label).replace(/[^a-z0-9]/g, '');
    if (name) return name;
  }
  return 'board';
}

/**
 * The instances a scan keeps, ready to be written.
 *
 * Kept: a commune the menu offers, that resolves to an INSEE code, whose board
 * holds at least one row posted within {@link LIVE_WITHIN_DAYS}, and that no
 * other register already reads (`claimed`) — a hand-written Cart@DS instance,
 * a métropole portal, a Sirap board. A commune two boards post for goes to the
 * one with more rows. An instance is written with the way most of its menu
 * sends communes, and `values` for a kept commune it sends another way
 * (`menuCodes`).
 *
 * @param {object} options
 * @param {Array<object>} options.probes What the script read, one per host.
 * @param {{byCode: Map}} options.index
 * @param {Map<string, string>} options.claimed INSEE code → the register that reads it.
 * @param {Map<string, string>} [options.epciNames] EPCI SIREN → name.
 * @param {string} options.day The scan's day, `yyyy-mm-dd`.
 * @param {boolean} [options.respectRobots] Leave out the boards `robots.txt`
 *   refuses instead of marking them `robots: 'overridden'`.
 * @returns {{instances: Array<object>, skipped: Array<{host: string, why: string}>}}
 */
export function keepScannedInstances({ probes, index, claimed, epciNames = new Map(), day, respectRobots = false }) {
  const since = daysBefore(day, LIVE_WITHIN_DAYS);
  const best = new Map();
  const skipped = [];
  for (const probe of probes) {
    if (!probe.base || isVendorTenant(probe.host)) continue;
    if (respectRobots && probe.robotsAllows === false) { skipped.push({ host: probe.host, why: 'robots.txt refuses' }); continue; }
    const resolved = (probe.communes ?? []).filter((entry) => entry.insee);
    if (!resolved.length) { skipped.push({ host: probe.host, why: 'no commune on its menu' }); continue; }
    const codes = menuCodes(resolved);
    if (!codes) { skipped.push({ host: probe.host, why: 'menu sends communes no known way' }); continue; }
    for (const entry of resolved) {
      const rows = (Number(entry.filings) || 0) + (Number(entry.decisions) || 0);
      const latest = [boardDay(entry.latestFiling), boardDay(entry.latestDecision)].filter(Boolean).sort().pop() ?? null;
      if (!rows || !latest || latest < since) continue;
      if (claimed.has(entry.insee)) continue;
      const held = best.get(entry.insee);
      if (!held || rows > held.rows) best.set(entry.insee, { probe, codes, rows });
    }
  }
  const byBase = new Map();
  for (const [insee, { probe, codes }] of best) {
    if (!byBase.has(probe.base)) byBase.set(probe.base, { probe, codes, communes: [] });
    byBase.get(probe.base).communes.push(insee);
  }
  const keys = new Set();
  const instances = [];
  for (const { probe, codes, communes } of [...byBase.values()].sort((a, b) => a.probe.base.localeCompare(b.probe.base))) {
    let key = instanceKey(new URL(probe.base).host);
    for (let n = 2; keys.has(key); n += 1) key = `${instanceKey(new URL(probe.base).host)}${n}`;
    keys.add(key);
    communes.sort();
    const values = Object.fromEntries(communes.filter((insee) => insee in codes.values).map((insee) => [insee, codes.values[insee]]));
    instances.push({
      key,
      base: probe.base,
      label: `${boardPublisher(communes, index, epciNames, probe.host)} — affichage réglementaire`,
      codes: codes.codes,
      ...(Object.keys(values).length ? { values } : {}),
      ...(probe.robotsAllows === false ? { robots: 'overridden' } : {}),
      ...(probe.robots5xx ? { robots5xx: 'absent' } : {}),
      communes,
    });
  }
  return { instances, skipped };
}

/** Who posts the board: the one commune, the intercommunality they share, or the host. */
function boardPublisher(communes, index, epciNames, host) {
  if (communes.length === 1) return index.byCode.get(communes[0])?.nom ?? host;
  const epcis = new Set(communes.map((code) => index.byCode.get(code)?.codeEpci ?? null));
  if (epcis.size === 1) {
    const name = epciNames.get([...epcis][0]);
    if (name) return name;
  }
  return host;
}

/** A single-quoted JS string literal. */
function quote(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * The generated module, as text.
 *
 * @param {Array<object>} instances From {@link keepScannedInstances}.
 * @param {{day: string, hosts: number, boards: number}} meta
 * @returns {string}
 */
export function renderScannedModule(instances, meta) {
  const communes = instances.reduce((sum, instance) => sum + instance.communes.length, 0);
  const overridden = instances.filter((instance) => instance.robots === 'overridden').length;
  const lines = [
    '// GENERATED by `npm run permits:scan` — do not edit by hand; run the scan again.',
    '//',
    `// Scan of ${meta.day}: ${meta.hosts} hosts asked, ${meta.boards} boards answered,`,
    `// ${instances.length} instances and ${communes} communes kept, none of them read by another`,
    `// register. ${overridden} of the instances answer \`robots.txt\` with \`Disallow\` and carry`,
    "// `robots: 'overridden'`, as Trap 5 of `cartdsFeed.js` explains.",
    '',
    '/** Cart@DS instances found by the scan; `cartdsFeed.js` appends them to its own. */',
    'export const CARTDS_SCANNED_INSTANCES = Object.freeze([',
  ];
  for (const instance of instances) {
    lines.push('  Object.freeze({');
    lines.push(`    key: ${quote(instance.key)},`);
    lines.push(`    base: ${quote(instance.base)},`);
    lines.push(`    label: ${quote(instance.label)}, // i18n-ignore-line — the publisher and its page title`);
    lines.push(`    codes: ${quote(instance.codes)},`);
    if (instance.values) {
      const values = Object.entries(instance.values).map(([insee, value]) => `${quote(insee)}: ${quote(value)}`);
      lines.push(`    values: Object.freeze({ ${values.join(', ')} }),`);
    }
    if (instance.robots) lines.push(`    robots: ${quote(instance.robots)},`);
    if (instance.robots5xx) lines.push(`    robots5xx: ${quote(instance.robots5xx)},`);
    const codes = instance.communes.map(quote);
    if (codes.length <= 8) {
      lines.push(`    communes: Object.freeze([${codes.join(', ')}]),`);
    } else {
      lines.push('    communes: Object.freeze([');
      for (let i = 0; i < codes.length; i += 8) lines.push(`      ${codes.slice(i, i + 8).join(', ')},`);
      lines.push('    ]),');
    }
    lines.push('  }),');
  }
  lines.push(']);', '');
  return lines.join('\n');
}

/**
 * The Sirap boards a scan keeps, one `SIRAP_INSTANCES` entry per commune.
 *
 * A PU host may post for one city, an intercommunality, or — Sirap's own
 * shared portal, `portail-usager.sirap.com` — 2 692 communes all over France
 * on 2026-10-01. Each commune posts its own board there, so each is its own
 * instance and the card names the commune as the publisher; a board needs no
 * session, so instances sharing a host cost nothing more. Same rule as
 * {@link keepScannedInstances}: a row posted within {@link LIVE_WITHIN_DAYS},
 * a commune no other register reads, and the busier board when two hosts post
 * for one commune.
 *
 * @param {object} options
 * @param {Array<{host: string, communes: Array<{insee: string, rows: number, latest: ?string}>}>} options.probes
 *   `insee` as the PU writes it, on six characters.
 * @param {{byCode: Map}} options.index
 * @param {Map<string, string>} options.claimed
 * @param {string} options.day
 * @returns {Array<object>}
 */
export function keepScannedSirap({ probes, index, claimed, day }) {
  const since = daysBefore(day, LIVE_WITHIN_DAYS);
  const best = new Map();
  for (const probe of probes) {
    for (const entry of probe.communes ?? []) {
      const insee = String(entry.insee ?? '').replace(/^0(?=[0-9][0-9AB][0-9]{3}$)/, '');
      if (!index.byCode.has(insee) || claimed.has(insee)) continue;
      if (!entry.rows || !entry.latest || entry.latest < since || entry.latest > day) continue;
      const held = best.get(insee);
      if (!held || entry.rows > held.rows) best.set(insee, { host: probe.host, rows: entry.rows });
    }
  }
  return [...best].sort(([a], [b]) => a.localeCompare(b)).map(([insee, { host }]) => ({
    key: `pu${insee.toLowerCase()}`,
    base: `https://${host}`,
    label: `${index.byCode.get(insee).nom} — affichage réglementaire`,
    communes: [insee],
  }));
}

/** The generated Sirap module, as text: one line per commune. */
export function renderSirapModule(instances, meta) {
  const lines = [
    '// GENERATED by `npm run permits:scan` — do not edit by hand; run the scan again.',
    '//',
    `// Scan of ${meta.day}: ${meta.hosts} Sirap PU hosts, ${meta.listed} communes listed,`,
    `// ${instances.length} communes kept, none of them read by another register.`,
    '',
    '/** Sirap PU boards found by the scan; `sirapFeed.js` appends them to its own. */',
    'export const SIRAP_SCANNED_INSTANCES = Object.freeze([',
  ];
  for (const instance of instances) {
    lines.push(`  Object.freeze({ key: ${quote(instance.key)}, base: ${quote(instance.base)}, `
      + `label: ${quote(instance.label)}, communes: Object.freeze([${instance.communes.map(quote).join(', ')}]) }), `
      + '// i18n-ignore-line — the publisher and its page title');
  }
  lines.push(']);', '');
  return lines.join('\n');
}
