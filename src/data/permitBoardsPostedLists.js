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
 * names. Applicants: the readers keep an organisation at most.
 */

import { municipalDossier, municipalSite } from './municipalPermitsFeed.js';

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
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url;
    try { url = new URL(decode(match[1]).trim(), base); } catch { continue; }
    if (!/^https?:$/.test(url.protocol)) continue;
    let name = url.pathname;
    try { name = decodeURIComponent(url.pathname); } catch { /* a stray % keeps the raw path */ }
    const title = /\btitle\s*=\s*["']([^"']*)["']/i.exec(match[0].slice(0, match[0].indexOf('>') + 1))?.[1];
    out.push({ url: url.href, name, words: clean(decode(match[2].replace(/<[^>]*>/g, ' '))), title: clean(decode(title ?? '')) });
  }
  return out;
}

/**
 * The day a link names, or null: `28_09_2026`, `28 09 2026`, `21/09/2026`,
 * `2026-10-01`, `26-10-01` (Saverne's year first), `au 22 septembre 2026`;
 * failing that, the upload month of a WordPress or Drupal path.
 */
export function postedListDay(name, words = '') {
  const text = fold(`${name} ${words}`);
  const iso = (y, m, d) => {
    const year = y.length === 2 ? `20${y}` : y;
    if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31 || year < '2015' || year > '2099') return null;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };
  let match = /(?:^|\D)(20\d{2})[ ./](\d{1,2})[ ./](\d{1,2})(?!\d)/.exec(text);
  if (match) return iso(match[1], match[2], match[3]);
  match = /(?:^|\D)(\d{1,2})[ ./](\d{1,2})[ ./](20\d{2})(?!\d)/.exec(text);
  if (match) return iso(match[3], match[2], match[1]);
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
 * the board.
 */
export function postedListFiles(city, html, pageUrl) {
  const patterns = { ...POSTED_LIST_PATTERNS, ...(city.source?.lists ?? {}) };
  const layouts = { ...LAYOUTS, ...(city.source?.layouts ?? {}) };
  const files = [];
  const rolling = new Set();
  for (const link of pageLinks(html, pageUrl)) {
    const target = fold(`${link.name} ${link.words}`);
    if (!/\.pdf$/i.test(link.name) && !/download|document|fichier|file|telecharg/i.test(link.url)) continue;
    const board = new RegExp(patterns.decisions).test(target) ? 'decisions'
      : new RegExp(patterns.filings).test(target) ? 'filings' : null;
    if (!board || files.some((file) => file.url === link.url)) continue;
    const published = postedListDay(link.name, link.words);
    if (!published) {
      if (rolling.has(board)) continue;
      rolling.add(board);
    }
    files.push({ url: link.url, board, layout: layouts[board], ...(published ? { published } : { rolling: true }) });
  }
  return files.length ? files.sort((a, b) => (b.published ?? '9').localeCompare(a.published ?? '9')) : null;
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
const ACT_FILING = /\b(?:RECEPISSE|AVIS DE DEPOT|DEPOT DE (?:LA )?DEMANDE|DEMANDE)\b/;
const ACT_DECISION = /\b(?:ARRETE|DECISION|ACCORD|REFUS|OPPOSITION|NON OPPOSITION|FAVORABLE|DEFAVORABLE|RETRAIT)\b/;
const STREET = 'rue|avenue|av\\.?|boulevard|bd|place|chemin|all[ée]es?|impasse|route|rte|quai|cours|faubourg|square|sentier|ruelle|passage|r[ée]sidence|lotissement|voie|cit[ée]|clos|hameau|lieu-dit|dr[èe]ve|zac';
const NUMBERED_STREET = new RegExp(`(?:^|\\s)(\\d{1,4}(?:\\s?(?:bis|ter|[a-d]))?\\s*,?\\s+(?:${STREET})\\b.*)$`, 'i');
const AFTER_STREET = /\s+(?:arr[êe]t[ée]|r[ée]c[ée]piss[ée]|d[ée]cision|accord|refus|favorable|d[ée]favorable|opposition|avis|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})(?=\s|$).*$/i;
// What a link prints after the site: the works (« - Réalisation d'une extension »), the
// file's weight, the number again, a lot, the commune.
const AFTER_SITE = /\s+[-–—]\s.*$|\s*\(.*$|\s+(?:PC|DP|PA|PD|CU)\s*\d.*$|\s+lot\b.*$|\s+[àa]\s+[A-Z][A-Z' -]+$/;
// i18n-ignore-end

/** A link's numbered street, from its house number on — never the words before it. */
function actStreet(text) {
  const match = NUMBERED_STREET.exec(clean(text));
  if (!match) return null;
  const street = clean(match[1].replace(AFTER_SITE, '').replace(AFTER_STREET, '').replace(/[\s,;-]+$/, ''));
  return street.length >= 6 ? street : null;
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
 * « arrete DP 0593862600095 », « DP 059.052.26.00024 »). The act is read by
 * `dematdoc-notice`, which takes the number, the site and the board from the
 * act's own heading; meanwhile the link gives the number, a numbered street
 * when it names one, and the board its words say (`source.board`, else a
 * decision, when they say none). The day comes from the name or the words,
 * failing that the upload month; an undated act counts when its number is
 * of this year or the last, forty at most.
 */
export function postedActFiles(city, html, pageUrl, since = null) {
  const files = [];
  for (const link of pageLinks(html, pageUrl)) {
    if (!/\.pdf$/i.test(link.name) && !/download|document|fichier|file|telecharg/i.test(link.url)) continue;
    // A « Téléchargement » button names its file in its title (Rouvroy).
    const words = clean(`${link.words} ${(link.title ?? '').replace(/_+/g, ' ')}`);
    const base = link.name.replace(/^.*\//, '').replace(/\.pdf$/i, '').replace(/[_.]+/g, ' ');
    const text = clean(`${words} ${base.replace(/-/g, ' ')}`);
    const published = postedListDay(link.name, words);
    const dossier = municipalDossier(words, city) ?? municipalDossier(base.replace(/-/g, ' '), city) ?? municipalDossier(text, city)
      ?? bareDossier(city, words, published);
    if (!dossier || files.some((file) => file.url === link.url)) continue;
    const folded = fold(text);
    const board = ACT_FILING.test(folded) ? 'filings' : ACT_DECISION.test(folded) ? 'decisions' : city.source?.board ?? 'decisions';
    const street = actStreet(link.words) ?? actStreet(base.replace(/-/g, ' '));
    files.push({ url: link.url, board, layout: 'dematdoc-notice', ocr: true, ...(published ? { published } : {}),
      row: { board, dossier, applicant: null, ...(street ? municipalSite(street, city) : { address: null, postcode: city.postcode }), postedOn: published ?? null } });
  }
  // An undated act counts when its number is of this year or the last: a page
  // that keeps every year's decrees (Dourges) gives its forty newest.
  const year = since ? Number(since.slice(2, 4)) - 1 : 0;
  const undated = files.filter((file) => !file.published && Number(file.row.dossier.split(' ')[2]) >= year).slice(0, 40);
  const kept = [...files.filter((file) => file.published), ...undated];
  return kept.length ? kept : null;
}

const postedActsProtocol = {
  start(city) {
    return [city.page, ...(city.source?.pages ?? [])].map((url) => ({ url, as: 'html' }));
  },
  index(city, html, request, options = {}) {
    // A page drawn inside another (Villeneuve-sur-Lot's lightbox) names its files
    // from the page it is drawn in: `source.linkBase`.
    const files = postedActFiles(city, html, city.source?.linkBase ?? request.url, options.since);
    return files ? { files } : null;
  },
};

export const POSTED_LIST_PROTOCOLS = Object.freeze({
  'posted-lists': Object.freeze(postedListsProtocol),
  'posted-acts': Object.freeze(postedActsProtocol),
});
export const POSTED_LIST_READERS = Object.freeze({});
export const POSTED_LIST_TEXT = Object.freeze({});
