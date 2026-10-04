/**
 * Communes that post the lists their instruction service prints — Cart@DS's
 * « Liste des avis de dépôt » and « Liste des décisions », the reports
 * Valence and Décines-Charpieu post too — as PDF links on a page of their own
 * site, refreshed every week or so. One protocol for all of them
 * (`posted-lists`): the page's links whose name or words say which list they
 * are, newest edition first; the files are read by the report readers of
 * `permitBoardsReports.js`. See `permitBoards.js` for the contract.
 *
 * The ATIP 67, which instructs for some 400 communes of the Bas-Rhin, prints
 * one export per commune; its own Cart@DS board is empty (2026-10-02), so the
 * communes' pages are the only place these lists are public. A row whose
 * number is not the commune's is dropped by the reader (`reportDossier`).
 *
 * A city's `source` may name its own `lists` patterns (`{filings, decisions}`,
 * RegExp sources matched on the file name and the link's words, folded to
 * upper case without accents) and `layouts`; the defaults fit Cart@DS's file
 * names. `workbookSheets` opts a board into XLSX with an exact sheet name;
 * other workbooks are ignored. Applicants: the readers keep an organisation at most.
 */

import { municipalDate, municipalDossier, municipalSite } from './municipalPermitsFeed.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").replace(/[_-]+/g, ' ').toUpperCase();
const ENTITIES = { amp: '&', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', eacute: 'é', egrave: 'è', agrave: 'à', ocirc: 'ô' }; // i18n-ignore-line — HTML entity names
const decode = (value) => String(value ?? '').replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (whole, name) => {
  if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  return ENTITIES[name.toLowerCase()] ?? whole;
});

// i18n-ignore-start — the lists' own titles and month names, matched on
export const POSTED_LIST_PATTERNS = Object.freeze({
  filings: '\\bLISTE (?:DES )?AVIS DE DEPOTS?\\b|\\bAVIS DE DEPOTS? (?:DU|AU|LISTE)\\b',
  decisions: '\\bLISTE (?:DES )?DECISIONS\\b',
});
const MONTHS = ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE'];
// i18n-ignore-end
const LAYOUTS = Object.freeze({ filings: 'cartds-report-filings', decisions: 'cartds-report-decisions' });

/** Every `<a href>` of a page, resolved: its address, decoded path and words. */
function pageLinks(html, base) {
  const out = [];
  // The quote that opens the address closes it: Rurange's `/RENOV'EST arrêté.pdf` holds an apostrophe.
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi)) {
    let url;
    try { url = new URL(decode(match[1] ?? match[2]).trim(), base); } catch { continue; }
    if (!/^https?:$/.test(url.protocol)) continue;
    let name = url.pathname;
    try { name = decodeURIComponent(url.pathname); } catch { /* a stray % keeps the raw path */ }
    const title = /\btitle\s*=\s*["']([^"']*)["']/i.exec(match[0].slice(0, match[0].indexOf('>') + 1))?.[1];
    out.push({ url: url.href, name, words: clean(decode(match[3].replace(/<[^>]*>/g, ' '))), title: clean(decode(title ?? '')) });
  }
  return out;
}

/**
 * The day a link names, or null: `28_09_2026`, `28 09 2026`, `21/09/2026`,
 * `2026-10-01`, `20261002`, `26-10-01` (Saverne's year first), `au 22 septembre 2026`;
 * failing that, the upload month of a WordPress or Drupal path.
 */
export function postedListDay(name, words = '') {
  // Do not combine the upload directory with a numeric filename into a day
  // (Quimperlé's /2026/09/09-24-… is the edition of 24 September).
  const text = fold(`${words} ${name.split('/').at(-1)}`);
  const iso = (y, m, d) => {
    const year = y.length === 2 ? `20${y}` : y;
    if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31 || year < '2015' || year > '2099') return null;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };
  let match = /(?:^|\D)(20\d{2})(\d{2})(\d{2})(?!\d)/.exec(text);
  if (match) return iso(match[1], match[2], match[3]);
  // A day-first filename can append a time after its year. Read the full
  // day first, before interpreting that year and time as a second date.
  match = /(?:^|\D)(\d{1,2})[ ./](\d{1,2})[ ./](20\d{2})(?!\d)/.exec(text);
  if (match) return iso(match[3], match[2], match[1]);
  match = /(?:^|\D)(20\d{2})[ ./](\d{1,2})[ ./](\d{1,2})(?!\d)/.exec(text);
  if (match) return iso(match[1], match[2], match[3]);
  match = new RegExp(`(?:^|\\D)(\\d{1,2})(?:ER)? (${MONTHS.join('|')}) (20\\d{2})\\b`).exec(text);
  if (match) return iso(match[3], String(MONTHS.indexOf(match[2]) + 1), match[1]);
  // Two digits each: the one that reads as a recent year is the year.
  match = /(?:^|\D)(\d{2})[ .](\d{2})[ .](\d{2})(?!\d)/.exec(text);
  const recent = (value) => Number(value) >= 20 && Number(value) <= 35;
  if (match && recent(match[3])) return iso(match[3], match[2], match[1]);
  if (match && recent(match[1])) return iso(match[1], match[2], match[3]);
  match = /\/(20\d{2})[/-](\d{2})\//.exec(name);
  return match ? `${match[1]}-${match[2]}-01` : null;
}

/**
 * The lists a page links, as files: each board's links, newest first. A link
 * that names no day is the board refreshed in place (`rolling`): only the
 * first such link of a board is kept. A page that links neither list is not
 * the board. `source.listOcr` sends a list with no text to the sweep's OCR
 * (`true`), or straight to it when every edition is a scan (`'scan'`,
 * Sélestat), with `source.ocrPsm`; `source.ocr` concerns acts, which every
 * WordPress commune posts as scans while its lists are text.
 */
export function postedListFiles(city, html, pageUrl) {
  return listFiles(city, pageLinks(html, pageUrl));
}

/** {@link postedListFiles} over links already gathered: `{url, name, words, published?}`. */
function listFiles(city, links) {
  const patterns = { ...POSTED_LIST_PATTERNS, ...(city.source?.lists ?? {}) };
  const layouts = { ...LAYOUTS, ...(city.source?.layouts ?? {}) };
  const files = [];
  const rolling = new Set();
  for (const link of links) {
    const target = fold(`${link.name} ${link.words}`);
    const board = new RegExp(patterns.decisions).test(target) ? 'decisions'
      : new RegExp(patterns.filings).test(target) ? 'filings' : null;
    if (!board || files.some((file) => file.url === link.url)) continue;
    const workbook = /\.xlsx$/i.test(link.name);
    const sheet = city.source?.workbookSheets?.[board];
    if (workbook ? !sheet : !/\.pdf$/i.test(link.name) && !/download|document|fichier|file|telecharg/i.test(link.url)) continue;
    const published = postedListDay(link.name, link.words) ?? link.published ?? null;
    if (!published) {
      if (rolling.has(board)) continue;
      rolling.add(board);
    }
    files.push({ url: link.url, board, layout: layouts[board], ...(published ? { published } : { rolling: true }),
      ...(workbook ? { format: 'xlsx', sheet } : {}),
      ...(city.source?.rolling ? { rolling: true } : {}),
      ...(city.source?.listOcr ? { ocr: true, ...(city.source.listOcr === 'scan' ? { scan: true } : {}),
        ...(city.source.ocrPsm ? { ocrPsm: city.source.ocrPsm } : {}) } : {}) });
  }
  if (!files.length) return null;
  files.sort((a, b) => (b.published ?? '9').localeCompare(a.published ?? '9'));
  // Whole-register snapshots repeat dossiers. Older filings that left the
  // newest list must not become current again on the archive's first sweep.
  if (city.source?.latestOnly) {
    const boards = new Set();
    return files.filter((file) => {
      if (boards.has(file.board)) return false;
      boards.add(file.board);
      return true;
    });
  }
  return files;
}

/**
 * A town whose links open a page of their own (Benfeld's `documents_administratifs/81097`,
 * which links the current PDF on its app's file host) sets `source.follow`:
 * such a link is asked as a page, and the first PDF it links is the board's
 * file, with the day the first link named.
 */
const postedListsProtocol = {
  start(city) {
    return [city.page, ...(city.source?.pages ?? [])].map((url) => ({ url, as: 'html' }));
  },
  index(city, html, request) {
    if (request.board) {
      const pdf = pageLinks(html, request.url).find((link) => /\.pdf$/i.test(link.name));
      if (!pdf) return null;
      return { files: [{ url: pdf.url, board: request.board, layout: request.layout,
        ...(request.published ? { published: request.published } : { rolling: true }) }] };
    }
    const files = postedListFiles(city, html, request.url);
    if (!files) return null;
    if (!city.source?.follow) return { files };
    const pages = files.filter((file) => !/\.pdf(?:$|\?)/i.test(new URL(file.url).pathname));
    return {
      files: files.filter((file) => !pages.includes(file)),
      next: pages.map((file) => ({ url: file.url, as: 'html', board: file.board, layout: file.layout, published: file.published })),
    };
  },
};

// --- One PDF per act ---------------------------------------------------------

// i18n-ignore-start — the boards' own words, matched on
// What names an act when its link names no number: its kind, or a family first in its name or words.
const UNNUMBERED_ACT = /\b(?:AVIS ?(?:DE ?)?DEPOT|RECEPISSE|ARRETE)\b/;
const ACT_FILING = /\b(?:RECEPISSE|AVIS ?(?:DE ?)?DEPOT|DEPOT DE (?:LA )?DEMANDE|DEMANDE)\b/;
const ACT_DECISION = /\b(?:ARRETE|DECISION|ACCORD|REFUS|OPPOSITION|NON OPPOSITION|FAVORABLE|DEFAVORABLE|RETRAIT)\b/;
const STREET = 'rue|avenue|av\\.?|boulevard|bd|place|chemin|all[ée]es?|impasse|route|rte|quai|cours|faubourg|square|sentier|ruelle|passage|r[ée]sidence|lotissement|voie|cit[ée]|clos|hameau|lieu-dit|dr[èe]ve|zac';
const NUMBERED_STREET = new RegExp(`(?:^|\\s)(\\d{1,4}(?:\\s?(?:bis|ter|[a-d]))?\\s*,?\\s+(?:${STREET})\\b.*)$`, 'i');
// Saint-Jean-d'Angély names the street first: `rue-des-Marechaux-au-n°-4`.
const STREET_AT_NUMBER = new RegExp(`(?:^|\\s)((?:${STREET})\\s.*?)\\s+au\\s+n\\s*°?\\s*(\\d{1,4}(?:\\s?(?:bis|ter|[a-d]))?)(?![\\d\\p{L}])`, 'iu');
const AFTER_STREET = /\s+(?:arr[êe]t[ée]|r[ée]c[ée]piss[ée]|d[ée]cision|accord|refus|favorable|d[ée]favorable|opposition|avis|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})(?=\s|$).*$/i;
// What a link prints after the site: the works (« - Réalisation d'une extension »), the
// file's weight, the number again, a lot, the commune.
const AFTER_SITE = /\s+[-–—]\s.*$|\s*\(.*$|\s+(?:PC|DP|PA|PD|CU)\s*\d.*$|\s+lot\b.*$|\s+[àa]\s+[A-Z][A-Z' -]+$/;
// i18n-ignore-end

/** A link's numbered street, from its house number on — never the words before it. */
function actStreet(text) {
  const at = STREET_AT_NUMBER.exec(clean(text));
  const match = NUMBERED_STREET.exec(clean(text)) ?? (at ? [null, `${at[2]} ${at[1]}`] : null);
  if (!match) return null;
  const street = clean(match[1].replace(AFTER_SITE, '').replace(AFTER_STREET, '').replace(/[\s,;-]+$/, ''));
  return street.length >= 6 ? street : null;
}

/**
 * The commune's dossier a link names, also as file names abbreviate it: the
 * year run into its counter (Rousies' `DP-2600033`, Louverné's
 * `2026-09-28-DP-2600078-ARRETE`), or the counter's service letter or digit
 * set apart (Bégard's `DP-022-004-26-P-0048`, Pontorson's
 * `PC-050-410-26-0-0023`, Vif's `DP-38545-26-1-0035`), or its modification
 * after a dash (Mantes-la-Ville's « PC 2500004-M01 »).
 */
function actDossier(value, city) {
  const spaced = clean(value)
    .replace(/\b(PC|DP|PA|PD|CU)\s*(1[5-9]|2\d)(\d{5})(?!\d)/gi, '$1 $2 $3')
    .replace(/\b(PC|DP|PA|PD|CU)((?:\s*\d{3}){2}|\s*\d{5,6})?\s*(1[5-9]|2\d)\s+([A-Z\d])\s+(\d{4})(?!\d)/gi, '$1$2 $3 $4$5')
    .replace(/(\d{5})\s*-\s*([MT]\s*\d{1,2})\b/g, '$1 $2');
  return municipalDossier(value, city) ?? (spaced === clean(value) ? null : municipalDossier(spaced, city));
}

/**
 * A number written without its year (Montbéliard's « DP 176 CHOPARD »), for a
 * town that says so (`source.bareCounter`): the year is the upload's. The act's
 * own heading, read next, gives the full number.
 */
function bareDossier(city, words, published) {
  if (!city.source?.bareCounter || !published) return null;
  const match = /\b(PC|DP|PA|PD)\s+(\d{1,5})\b(?!\s*\d)/.exec(fold(words));
  return match ? `${match[1]} ${city.insee.padStart(6, '0')} ${published.slice(2, 4)} ${match[2].padStart(5, '0')}` : null;
}

/**
 * The acts a page links, one PDF each: a link is an act when its words or its
 * file name name one of the commune's dossiers (`DP-062758-26-00149-Recepisse-de-Depot.pdf`,
 * « arrete DP 0593862600095 », « DP 059.052.26.00024 », a DOCman address's
 * last folder `2087-avis-de-depot-dp-025-228-26-00050/file`). The act is read by
 * `dematdoc-notice`, which takes the number, the site and the board from the
 * act's own heading; meanwhile the link gives the number, a numbered street
 * when it names one, and the board its words say (`source.board`, else a
 * decision, when they say none). The day comes from the name or the words,
 * failing that the upload month; an undated act counts when its number is
 * of this year or the last, forty at most. A commune whose links name the
 * site but not the number (Rozay-en-Brie's `DP-15-FAUBOURG-DE-GIRONDE.pdf`,
 * Dargnies's `Avis-de-depot.pdf`) sets `source.unnumbered`: a dated link
 * that names an act's kind is read for the number its heading prints.
 * `source.actLayouts` names another reader for a board's acts
 * (Saint-Jean-d'Angély prints each avis de dépôt as a one-row list).
 *
 * A page that groups its acts under tabs says the board by them
 * (`source.sections`: `{words, board, bare?}`, `words` a RegExp source matched
 * on the heading link's folded words; `bare: false` keeps no row for an act
 * whose link names no site); one that lists the oldest first says so
 * (`source.oldestFirst`) and may widen the forty (`source.limit`); one whose
 * acts print the cadastral references as « S37 P0113 » (section 37, parcel
 * 113: Rurange) has them left unread (`source.noParcels`).
 */
export function postedActFiles(city, html, pageUrl, since = null) {
  return actFiles(city, pageLinks(html, pageUrl), since);
}

/** {@link postedActFiles} over links already gathered: `{url, name, words, title?, published?}`. */
function actFiles(city, links, since = null) {
  const entries = [];
  const sections = city.source?.sections ?? [];
  const noParcels = city.source?.noParcels ? { noParcels: true } : {};
  let section = null;
  for (const link of links) {
    // A heading link (the tabs of Hagondange's accordion) names the board of the acts under it.
    const heading = sections.find((candidate) => new RegExp(candidate.words).test(fold(link.words)));
    if (heading) { section = heading; continue; }
    if (!/\.pdf$/i.test(link.name) && !/download|document|fichier|file|telecharg/i.test(link.url)) continue;
    // A « Téléchargement » button names its file in its title (Rouvroy).
    const words = clean(`${link.words} ${(link.title ?? '').replace(/_+/g, ' ')}`);
    // DOCman serves an act at `…/2087-avis-de-depot-dp-025-228-26-00050/file` (Étupes): the segment before names it.
    const base = link.name.replace(/\/file\/?$/i, '').replace(/^.*\//, '').replace(/\.pdf$/i, '').replace(/[_.]+/g, ' ');
    const text = clean(`${words} ${base.replace(/-/g, ' ')}`);
    const published = postedListDay(link.name, words) ?? link.published ?? null;
    const dossier = actDossier(words, city) ?? actDossier(base.replace(/-/g, ' '), city) ?? actDossier(text, city)
      ?? bareDossier(city, words, published);
    const folded = fold(text);
    if (entries.some((entry) => entry.file.url === link.url)) continue;
    if (!dossier) {
      const named = UNNUMBERED_ACT.test(folded) || [base, link.words].some((value) => /^(?:PC|DP|PA|PD)\b/.test(fold(value)));
      if (city.source?.unnumbered && published && named) {
        const board = section?.board ?? (ACT_FILING.test(folded) ? 'filings' : 'decisions');
        entries.push({ dossier: null, file: { url: link.url, board, layout: city.source?.actLayouts?.[board] ?? 'dematdoc-notice', ocr: true, published, ...noParcels } });
      }
      continue;
    }
    const board = section?.board ?? (ACT_FILING.test(folded) ? 'filings' : ACT_DECISION.test(folded) ? 'decisions' : city.source?.board ?? 'decisions');
    const street = actStreet(link.words) ?? actStreet(base.replace(/-/g, ' '));
    // A section whose acts name no site in their link (`bare: false`) keeps no row of its own:
    // the act is read, or nothing is said of it.
    const row = street || section?.bare !== false
      ? { board, dossier, applicant: null, ...(street ? municipalSite(street, city) : { address: null, postcode: city.postcode }), postedOn: published ?? null }
      : null;
    entries.push({ dossier, file: { url: link.url, board, layout: city.source?.actLayouts?.[board] ?? 'dematdoc-notice', ocr: true,
      ...(published ? { published } : {}), ...(row ? { row } : {}), ...noParcels } });
  }
  // An undated act counts when its number is of this year or the last: a page
  // that keeps every year's decrees (Dourges) gives its forty newest — the
  // last forty of a page that lists the oldest first (`source.oldestFirst`),
  // `source.limit` of them when a board needs more (Hagondange: 109).
  const year = since ? Number(since.slice(2, 4)) - 1 : 0;
  const undated = entries.filter((entry) => !entry.file.published && Number(entry.dossier.split(' ')[2]) >= year);
  if (city.source?.oldestFirst) undated.reverse();
  const kept = [...entries.filter((entry) => entry.file.published), ...undated.slice(0, city.source?.limit ?? 40)].map((entry) => entry.file);
  return kept.length ? kept : null;
}

/**
 * A dossier posted on a page of its own (Sarralbe's `pc-057-628-26-00014…`,
 * titled with the number): the first PDF the page links is the act, posted
 * from the day the page says (« Disponible à compter du 06/08/2026 »). A
 * page posted before the window gives nothing.
 */
function followedAct(city, html, request, since) {
  const pdf = pageLinks(html, request.url).find((link) => /\.pdf$/i.test(link.name));
  if (!pdf) return null;
  // i18n-ignore-next-line — the page's own words
  const day = /\bcompter du (\d{1,2}\/\d{1,2}\/\d{4})/i.exec(clean(decode(String(html ?? '').replace(/<[^>]*>/g, ' '))))?.[1];
  const published = day ? municipalDate(day) : null;
  if (since && published && published < since) return null;
  const words = fold(`${pdf.words} ${pdf.name.replace(/^.*\//, '')}`);
  const board = ACT_FILING.test(words) ? 'filings' : ACT_DECISION.test(words) ? 'decisions' : city.source?.board ?? 'decisions';
  return { files: [{ url: pdf.url, board, layout: 'dematdoc-notice', ocr: true, ...(published ? { published } : {}),
    row: { board, dossier: request.act, applicant: null, address: null, postcode: city.postcode, postedOn: published } }] };
}

const postedActsProtocol = {
  start(city) {
    return [city.page, ...(city.source?.pages ?? [])].map((url) => ({ url, as: 'html' }));
  },
  index(city, html, request, options = {}) {
    if (request.act) return followedAct(city, html, request, options.since);
    // A page drawn inside another (Villeneuve-sur-Lot's lightbox) names its files
    // from the page it is drawn in: `source.linkBase`.
    const files = postedActFiles(city, html, city.source?.linkBase ?? request.url, options.since);
    if (!city.source?.follow) return files ? { files } : null;
    // `source.follow`: a link of the same site naming a dossier, and no file, opens the dossier's own page.
    const origin = new URL(request.url).origin;
    const next = new Map();
    for (const link of pageLinks(html, request.url)) {
      if (/\.pdf$/i.test(link.name) || new URL(link.url).origin !== origin || next.has(link.url)) continue;
      const dossier = actDossier(clean(`${link.title ?? ''} ${link.words}`).replace(/_+/g, ' '), city);
      if (dossier) next.set(link.url, { url: link.url, as: 'html', act: dossier });
    }
    return files || next.size ? { files: files ?? [], next: [...next.values()] } : null;
  },
};

// --- WordPress media --------------------------------------------------------

const WP_MEDIA_PAGE_SIZE = 100;
const WP_MEDIA_PAGES = 10;

function wpMediaRequest(city, since, page) {
  const url = new URL('/wp-json/wp/v2/media', city.source?.wpBase ?? city.page);
  url.search = new URLSearchParams({ mime_type: 'application/pdf', after: `${since}T00:00:00`,
    per_page: String(WP_MEDIA_PAGE_SIZE), page: String(page), orderby: 'date', order: 'desc',
    _fields: 'date,source_url,title' }).toString();
  return { url: url.href, as: 'json' };
}

/**
 * The PDFs a WordPress site uploaded since the window's first day, as its
 * media API lists them, newest first: no page to find, whatever the menu
 * that links them. Each is a list when its name or title says which
 * (`listFiles`, the commune's own `lists` patterns), else an act when it
 * names one of the commune's dossiers (`actFiles`); any other PDF — minutes,
 * menus, bulletins — is left. The day is the one the name gives, failing
 * that the upload's. `source.acts: false` keeps the lists only, for a
 * commune whose other PDFs name dossiers they do not post. 1 000 PDFs at
 * most a reading.
 */
const wpMediaProtocol = {
  start: (city, { since }) => [wpMediaRequest(city, since, 1)],
  index(city, body, request, { since, day } = {}) {
    if (!Array.isArray(body)) return null;
    const links = [];
    for (const item of body) {
      let url;
      try { url = new URL(String(item?.source_url ?? '')); } catch { continue; }
      const published = municipalDate(String(item?.date ?? '').slice(0, 10));
      if (!/^https?:$/.test(url.protocol) || !published || (day && published > day)) continue;
      let name = url.pathname.replace(/^.*\//, '');
      try { name = decodeURIComponent(name); } catch { /* a stray % keeps the raw name */ }
      links.push({ url: url.href, name, words: clean(decode(String(item?.title?.rendered ?? '').replace(/<[^>]*>/g, ' '))), published });
    }
    const lists = listFiles(city, links) ?? [];
    const listed = new Set(lists.map((file) => file.url));
    const acts = city.source?.acts === false ? [] : (actFiles(city, links.filter((link) => !listed.has(link.url)), since) ?? []);
    const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
    const next = body.length >= WP_MEDIA_PAGE_SIZE && page < WP_MEDIA_PAGES ? [wpMediaRequest(city, since, page + 1)] : [];
    return { files: [...lists, ...acts], next };
  },
};

export const POSTED_LIST_PROTOCOLS = Object.freeze({
  'posted-lists': Object.freeze(postedListsProtocol),
  'posted-acts': Object.freeze(postedActsProtocol),
  'wp-media': Object.freeze(wpMediaProtocol),
});
export const POSTED_LIST_READERS = Object.freeze({});
export const POSTED_LIST_TEXT = Object.freeze({});
