/**
 * Boards a city posts one act at a time — an arrêté or an avis de dépôt per
 * dossier, on its own site or on an acts platform (Docs2Web, delibs.com) —
 * and the weekly scanned registers some post instead: Oullins-Pierre-Bénite,
 * L'Haÿ-les-Roses, Limeil-Brévannes, Villeneuve-Saint-Georges and Romainville,
 * read on 2 Oct 2026. See `permitBoards.js` for the contract.
 *
 * Applicants: never read. Every list here prints the applicant's name in a
 * column of its own, private people among them; a reader takes the columns
 * it names and no other, and a title is read for its number and site only.
 */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import { dayWithoutYear, listVerdict, readCellTable } from './permitBoardsLists.js';
import { readExtendedNotice } from './municipalPermitExtensions.js';
import messages from './municipalPermitsFeed.i18n.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").toUpperCase();

/** `14413 m 2`, `1 939 m²`, `22.264 m²` → `14413`, `1939`, `22264`; zero is no area. */
function squareMetres(value) {
  const match = /(\d[\d\s.]*)(?:,\d+)?\s*m/i.exec(clean(value));
  const digits = match ? match[1].replace(/[\s.]/g, '') : '';
  return /^\d+$/.test(digits) && Number(digits) > 0 ? String(Number(digits)) : null;
}

/** OCR's `OP`, `0P` for `DP`, and `M0l`, `MO1`, `T0l` for `M01`, `T01`. */
function ocrNumber(value) {
  return clean(value).replace(/^[O0]P\b/, 'DP')
    .replace(/\b([MT])[O0o]([1-9lIL|])\b/g, (whole, kind, digit) => `${kind}0${/\d/.test(digit) ? digit : '1'}`);
}

// --- Oullins-Pierre-Bénite: Cart@DS reports, printed and scanned ---------------

/** Pierre-Bénite, merged into Oullins on 1 January 2024: its older dossiers keep its code. */
const PIERRE_BENITE = Object.freeze({ insee: '69152' });

// i18n-ignore-start — the report's own column headers and file names, matched on
/** The first word of a verdict a list prints. */
const VERDICT_WORD_RE = /^(?:favorable|d[ée]favorable|accord|refus|rejet|annulation|retrait|retir[ée]|tacite|opposition|non[- ]opposition|sursis|irrecevable|caduc)/i;
/** The report's columns by their header's first word, left to right. */
const REPORT_HEADERS = [
  ['dates', /^DATE(?: DEPOT)?$/], ['applicant', /^DEMANDEUR/], ['site', /^LIEUX/], ['land', /^SUPERFICIE/],
  ['purpose', /^NATURE/], ['project', /^PROJET/], ['decision', /^DECISION/],
];
/** The words a list's file name is made of, besides its dates: anything else is another document. */
const OULLINS_FILE_WORDS = new Set(['LISTE', 'LISTES', 'URBANISME', 'URBANNISME', 'URBA', 'DEPOT', 'DEPOTS', 'AVIS',
  'DECISION', 'DECISIONS', 'AU', 'O', 'PB', 'OULLINS', 'PIERRE', 'BENITE']);
// i18n-ignore-end

/** A page's header: each column's left edge, or null when the page has none. */
function reportHeader(runs) {
  const words = runs.map((run) => ({ ...run, word: fold(run.text) }));
  const applicant = words.find((word) => /^DEMANDEUR/.test(word.word));
  if (!applicant) return null;
  const near = words.filter((word) => Math.abs(word.y - applicant.y) < 14);
  const columns = [{ field: 'dossier', x: -Infinity }];
  for (const [field, pattern] of REPORT_HEADERS) {
    const found = near.filter((word) => pattern.test(word.word) && (field !== 'dates' || (word.x > 60 && word.x < applicant.x)));
    if (found.length) columns.push({ field, x: Math.max(...found.map((word) => word.x)) });
  }
  if (!['dates', 'site', 'purpose'].every((field) => columns.some((column) => column.field === field))) return null;
  return { y: Math.min(...near.map((word) => word.y)), columns: columns.sort((a, b) => a.x - b.x) };
}

/** Runs grouped on their baseline, left to right, as lines with their height. */
function runLines(runs) {
  const lines = [];
  for (const run of [...runs].sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - run.y) < 2) line.runs.push(run);
    else lines.push({ y: run.y, runs: [run] });
  }
  return lines.map((line) => ({ y: line.y, text: clean(line.runs.sort((a, b) => a.x - b.x).map((run) => run.text).join(' ')) }));
}

/**
 * Oullins-Pierre-Bénite's « Liste des avis de dépôt » and « Liste des
 * décisions », as Cart@DS prints them, printed again on the town hall's
 * copier and scanned with its OCR text: one section per family, a row per
 * dossier — number over posting date, filing date, applicant, site over its
 * postcode and parcels, land area, works, floor area, and the decision
 * (« Favorable le 08/06/2026 ») on the decisions' list. Every cell is
 * centred on its row and left-aligned on its column, so a run belongs to
 * the last header starting at or left of it — runs, never lines: the
 * applicant's cell ends a few points before the site's — and a row is the
 * runs between two blank bands: rows are 14 points apart at least on the
 * lists of 22 July to 24 September 2026, the lines of one row 9 at most.
 * The same reader takes the sweep's OCR of the older scans, word by word.
 */
export function readOullinsReport(document, { city, file }) {
  const rows = [];
  let header = null;
  for (const page of document?.pages ?? []) {
    // OCR reads a cell's frame as `|`: never part of a value.
    const runs = (page.runs ?? []).map((run) => ({ ...run, text: clean(String(run.text ?? '').replace(/[|¦]/g, ' ')) })).filter((run) => run.text);
    const own = reportHeader(runs);
    header = own ?? header;
    if (!header) continue;
    const { columns } = header;
    const columnOf = (run) => {
      let found = columns[0].field;
      for (const column of columns) if (column.x <= run.x + 6) found = column.field;
      return found;
    };
    const body = runs.filter((run) => run.y < (own?.y ?? Infinity) - 6 && run.y > 30 && !/^\d+\s*\/\s*\d+$/.test(run.text))
      .sort((a, b) => b.y - a.y);
    const bands = [];
    for (const run of body) {
      const band = bands.at(-1);
      if (band && band.bottom - run.y <= 11) { band.runs.push(run); band.bottom = run.y; } else bands.push({ bottom: run.y, runs: [run] });
    }
    for (const band of bands) {
      const anchors = runLines(band.runs.filter((run) => columnOf(run) === 'dossier'))
        .filter((line) => /^(?:[DO0]P|PC|PA|PD)\s*0?\s*69\s*1/i.test(line.text));
      for (const anchor of anchors) {
        const nearest = (run) => anchors.reduce((best, other) => (Math.abs(other.y - run.y) < Math.abs(best.y - run.y) ? other : best));
        const cells = {};
        for (const run of band.runs) if (anchors.length < 2 || nearest(run) === anchor) (cells[columnOf(run)] ??= []).push(run);
        const row = oullinsRow(Object.fromEntries(Object.entries(cells).map(([field, list]) => [field, runLines(list).map((line) => line.text)])), { city, file });
        if (row) rows.push(row);
      }
    }
  }
  return rows;
}

/**
 * `(152 AH 221, 152 AH 351)`, `(AP 38, 37, 36)`: parcels, a section carried
 * over, and the prefix of Pierre-Bénite's cadastre kept — the merged
 * commune's sections keep their former commune's number, which
 * `cartdsParcelIdus` reads.
 */
export function prefixedParcels(value) {
  const out = [];
  let section = null;
  let prefix = null;
  // i18n-ignore-next-line — the conjunction a list of parcels may use
  for (const piece of clean(String(value ?? '').replace(/[()]/g, ' ')).split(/[;,/]|\bet\b/i)) {
    const match = /^(?:(\d{3})\s+)?([A-Z]{1,2})?\s*0*(\d{1,4})$/.exec(clean(piece));
    if (!match || (!match[2] && !section)) continue;
    if (match[2]) { section = match[2]; prefix = match[1] ?? null; }
    out.push(`${prefix ? `${prefix} ` : ''}${section} ${match[3]}`);
  }
  return out.length ? [...new Set(out)].join(', ') : null;
}

/** One row of Oullins's report, from its cells; the applicant's is never read. */
function oullinsRow(cells, { city, file }) {
  const numberLines = (cells.dossier ?? []).filter((line) => !/^\d{2}\/\d{2}\/\d{4}$/.test(line));
  const number = ocrNumber(numberLines.join(' '));
  const dossier = municipalDossier(number, city) ?? municipalDossier(number, PIERRE_BENITE);
  if (!dossier) return null;
  // The delegated commune a site names, `(Pierre-Bénite)`, its bracket
  // sometimes read as `!` or lost.
  // i18n-ignore-next-line — the delegated communes' names, matched on
  const siteText = clean((cells.site ?? []).join(' ').replace(/[(!]\s*(?:Oullins|Pierre[- ]B[ée]nite)\s*\)?|\b(?:Oullins|Pierre[- ]B[ée]nite)\s*\)/gi, ' '));
  const postcode = /\b(69600|69310)\b/.exec(siteText);
  const street = clean((postcode ? siteText.slice(0, postcode.index) : siteText.replace(/\(.*$/, ''))
    .replace(/\s+(?:\d{3}\s+)?[A-Z]{1,2}\s*\d{1,4}\s*\)?$/, '').replace(/[\s,;:(]+$/, ''));
  if (!/\p{L}{3}/u.test(street)) return null;
  const parcels = prefixedParcels(postcode ? siteText.slice(postcode.index + 5) : (/\(([^)]*)\)?/.exec(siteText)?.[1] ?? ''));
  // i18n-ignore-next-line — the report's own label, matched on
  const floor = /Surface plancher cr[ée]{2}e\s*:?\s*([\dO]+)\s*m/i.exec((cells.project ?? []).join(' '))?.[1]?.replace(/O/g, '0');
  const decision = clean((cells.decision ?? []).join(' '));
  const said = clean(decision.replace(/\ble\b.*$/i, ''));
  // OCR turns a stamp over the cell into noise (`1 �i;8ai�t2 t`): only a
  // verdict's own words are taken, else the decision is a signed one.
  const readable = VERDICT_WORD_RE.test(said) && !/[^\p{L}\s'’-]/u.test(said);
  return {
    board: file?.board ?? 'filings', dossier, applicant: null, address: street, postcode: postcode?.[1] ?? city.postcode,
    parcels, purpose: clean((cells.purpose ?? []).join(' ')) || null,
    filedOn: (cells.dates ?? []).map(municipalDate).find(Boolean) ?? null,
    postedOn: (cells.dossier ?? []).map(municipalDate).find(Boolean) ?? null,
    landArea: squareMetres((cells.land ?? []).find((line) => /\d/.test(line) && /m/i.test(line))),
    floorArea: floor && Number(floor) > 0 ? String(Number(floor)) : null,
    ...(file?.board === 'decisions' ? {
      verdict: (readable ? listVerdict(said) : null) ?? verdicts.signed.fr,
      decidedOn: municipalDate(decision),
    } : {}),
  };
}

/** The board an Oullins file name says it is, or null for any other document. */
export function oullinsFileBoard(url) {
  const name = fold(decodeURIComponent(String(url).split('/').pop() ?? '').replace(/\.pdf$/i, ''));
  const words = name.split(/[\s_.-]+/).filter((word) => word && !/^\d+[A-Z]{0,2}$/.test(word));
  if (!words.length || !words.every((word) => OULLINS_FILE_WORDS.has(word))) return null;
  if (words.some((word) => word.startsWith('DECISION'))) return 'decisions';
  return words.some((word) => word.startsWith('DEPOT') || word === 'AVIS') ? 'filings' : null;
}

/** What the media library is searched for: the names vary from week to week. */
const OULLINS_TERMS = ['urbanisme', 'depot', 'decision', 'avis'];
const OULLINS_PAGE_SIZE = 100;

/**
 * Oullins-Pierre-Bénite posts its two lists a week as WordPress media, under
 * a name that changes with the clerk (`depots_urbanisme_2026_09_24`,
 * `Urba_avis_2026-07-15`, `Liste_decisions_urbanisme_au_25_03_2026`): the
 * media API is searched for each word they use, from the window's first day
 * — 74 lists from 11 Dec 2025 to 24 Sep 2026 under « urbanisme » alone. The
 * lists from 22 July 2026 carry the copier's OCR text; the earlier ones are
 * bare scans, read by the sweep's OCR.
 */
const oullinsProtocol = Object.freeze({
  start: (city, { since }) => OULLINS_TERMS.map((term) => oullinsSearch(city, term, since, 1)),
  index(city, body, request, { since, day }) {
    if (!Array.isArray(body)) return null;
    const files = [];
    for (const item of body) {
      const url = String(item?.source_url ?? '');
      const published = municipalDate(String(item?.date ?? '').slice(0, 10));
      if (!/^https:\/\/[^/]+\/app\/uploads\/\d{4}\/\d{2}\/[^/]+\.pdf$/i.test(url) || !published) continue;
      if (published < since || (day && published > day)) continue;
      const board = oullinsFileBoard(url);
      if (board) files.push({ url, board, layout: 'oullins-report', published, ocr: true });
    }
    const params = new URL(request.url).searchParams;
    const next = body.length >= OULLINS_PAGE_SIZE
      ? [oullinsSearch(city, params.get('search'), since, Number(params.get('page') ?? 1) + 1)] : [];
    return { files, next };
  },
});

function oullinsSearch(city, term, since, page) {
  const url = new URL('/wp-json/wp/v2/media', city.page);
  url.search = new URLSearchParams({ search: term, after: `${since}T00:00:00`, per_page: String(OULLINS_PAGE_SIZE),
    page: String(page), orderby: 'date', order: 'desc', _fields: 'date,source_url' }).toString();
  return { url: url.href, as: 'json' };
}

// --- L'Haÿ-les-Roses: Screensoft Docs2Web ---------------------------------------

// i18n-ignore-start — French street words and the board's own folder names, matched on
const STREET_WORDS = 'rue|ruelle|avenue|av\\.?|boulevard|bd|place|chemin|all[ée]e|impasse|route|quai|cours|square|sentier|passage|villa|voie|venelle|r[ée]sidence|cit[ée]|parc|sente';
/** A site: a house number (`138-140`, `58/60`, `12 bis`) then a street word, or a street word first. */
const SITE_RE = new RegExp(`^(?:\\d{1,4}(?:\\s*[-/]\\s*\\d{1,4})?(?:\\s*(?:bis|ter|quater|[a-d]))?\\s*,?\\s+)?(?:${STREET_WORDS})\\b`, 'i');
/** A site holds a house number or a street word: `Limeil-Brevannes` alone is none. */
const isSite = (value) => /\d/.test(value ?? '') || new RegExp(`\\b(?:${STREET_WORDS}|grande rue)\\b`, 'i').test(value ?? '');
/** A civility or a person's marker: a title holding one is never read for a site. */
const PERSON_RE = /(?:^|\s)(?:m\.|mme|mr|mlle|monsieur|madame|messieurs|mesdames)(?:\s|$)/i;
const LHAY_FILINGS_FOLDER = /^01-Dossiers d'urbanisme en cours d'instruction$/i;
const LHAY_DECISIONS_FOLDER = /^02-Actes d'urbanisme d[ée]livr[ée]s$/i;
/** Signs and certificates are not permits the layer draws. */
const LHAY_SKIPPED_FOLDER = /^0[78]-/;
// i18n-ignore-end

const xmlEntities = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>' };
const xmlText = (value) => String(value ?? '').replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (whole, name) => {
  if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  return xmlEntities[name.toLowerCase()] ?? whole;
});

/**
 * A decision's title, `DP26W4061-48 rue de Fresnes-Accord` or `PC25W1047 -
 * 138-140 av Henri BArbusse... - Accord rectifié`: the number, the site
 * between the first dash and the last, the verdict after it. The site is
 * kept only when it reads as one — a number and a street word — and names
 * no one; the verdict is the title's word, a rectified act a signed one.
 */
export function lhayTitle(value, city) {
  const title = clean(xmlText(value));
  const match = /^((?:PC|DP|PA|PD)\s*\d{2}\s*[A-Z]?\d{4}(?:\s*[MT]\d{1,2})?)\s*-\s*(.+?)\s*-\s*([^-]+)$/i.exec(title);
  const dossier = match ? municipalDossier(match[1], city) : null;
  if (!dossier) return null;
  const site = clean(match[2].replace(/\.{2,}|…/g, ' '));
  const address = SITE_RE.test(site) && !PERSON_RE.test(site) ? site : null;
  const said = clean(match[3]);
  // i18n-ignore-next-line — a corrected act's own words
  const verdict = /rectifi/i.test(said) && !/^(?:accord|refus)/i.test(said) ? verdicts.signed.fr : listVerdict(said);
  return { dossier, address, verdict: verdict ?? verdicts.signed.fr };
}

/**
 * L'Haÿ-les-Roses posts on Screensoft Docs2Web, as Pantin does: the tree of
 * every folder and document is `params.js`, 0.5 MB. Under « 02-Urbanisme »,
 * « 01-Dossiers d'urbanisme en cours d'instruction » is one list of filings
 * replaced in place (refreshed on 25 Sep 2026), and « 02-Actes d'urbanisme
 * délivrés » one PDF per decision in a folder per family — 23 on 2 Oct 2026,
 * each posted twice, for its two months. A decision's title is its number,
 * site and verdict; its PDF is the arrêté, typed (some scanned), read for
 * the filing and signature dates and the works.
 */
const lhayProtocol = Object.freeze({
  start: (city) => [{ url: new URL('params.js', city.page).href, as: 'text' }],
  index(city, script, request, { since, day }) {
    const xml = String(script ?? '').replace(/\\"/g, '"');
    if (!/<subtheme\b[^>]*\bname="02-Urbanisme"/.test(xml)) return null;
    const stack = [];
    const files = new Map();
    for (const [, close, tag, attributes, selfClosing] of xml.matchAll(/<(\/?)(theme|subtheme|paper)\b([^>]*?)(\/?)>/g)) {
      if (close) { if (tag !== 'paper') stack.pop(); continue; }
      const attribute = (name) => xmlText(new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1] ?? '');
      if (tag !== 'paper') { if (!selfClosing) stack.push(clean(attribute('name'))); continue; }
      const board = stack.some((name) => LHAY_FILINGS_FOLDER.test(name)) ? 'filings'
        : stack.some((name) => LHAY_DECISIONS_FOLDER.test(name)) && !stack.some((name) => LHAY_SKIPPED_FOLDER.test(name)) ? 'decisions' : null;
      const path = attribute('path');
      const published = municipalDate(attribute('real_date_debut')) ?? municipalDate(attribute('date_debut'));
      if (!board || !published || !/^\/[\w.-]+\.pdf$/i.test(path)) continue;
      if (day && published > day) continue;
      const url = new URL(`content${path}`, city.page).href;
      if (board === 'filings') {
        // One list, replaced in place: always read, whatever its day.
        files.set(url, { url, board, layout: 'lhay-filings', published: published < since ? since : published, rolling: true });
        continue;
      }
      const title = lhayTitle(attribute('name'), city);
      if (!title || published < since) continue;
      files.set(url, { url, board, layout: 'lhay-decision', published, ocr: true,
        row: { board, dossier: title.dossier, applicant: null, address: title.address, postcode: city.postcode,
          verdict: title.verdict, postedOn: published } });
    }
    return { files: [...files.values()] };
  },
});

/**
 * An arrêté of L'Haÿ-les-Roses: « Déposé le : », « Pour : », « Sur un terrain
 * sis : », the operative article, and « L'Haÿ-les-Roses, le 18 SEP. 2026 ».
 * The applicant's block (« Par : », « Demeurant à : ») is never read. Its
 * number must be the title's, and its site is the title's when the title
 * has one: the form prints the commune after it.
 */
export function readLhayDecision(document, { city, file }) {
  const [row] = readExtendedNotice(document, { city: { ...city, source: {} }, file });
  if (!row || !file?.row || row.dossier !== file.row.dossier) return [];
  const body = (document?.pages ?? []).flatMap((page) => runLines(page.runs ?? [])).map((line) => line.text).join('\n');
  // i18n-ignore-start — the arrêté's own labels, matched on
  // The right-hand column (« Surface de plancher : 0 m2 ») shares the line.
  const works = /^Pour\s*:\s*(.+)$/im.exec(body)?.[1]?.replace(/\s+(?:Surface|Destination)\b.*$/i, '').replace(/\s+\d+(?:[.,]\d+)?\s*m[²2]?$/i, '');
  const signed = /Ha[ÿy]-les-Roses,?\s+le\s+([^\n]+)/i.exec(body)?.[1];
  // i18n-ignore-end
  const address = file.row.address ?? clean(String(row.address ?? '').replace(/[\s\-–—,]+$/, ''));
  if (!address) return [];
  return [{ ...row, address, postcode: city.postcode, parcels: null,
    purpose: works && !PERSON_RE.test(works) ? clean(works) : null,
    verdict: row.verdict ?? file.row.verdict,
    decidedOn: municipalDate(signed), postedOn: file.row.postedOn ?? null }];
}

/** The filings list's columns, by their headers' words. */
// i18n-ignore-start — the list's own column headers, matched on
const LHAY_HEADERS = { filed: 'DATE DE DEPOT', applicant: 'NOM DU DEMANDEUR', site: 'ADRESSE DU TERRAIN', land: 'TERRAIN',
  features: 'CARACTERISTIQUES', purpose: 'OBJET DE LA DEMANDE', posted: 'DATE AFFICHAGE' };
// i18n-ignore-end

/**
 * L'Haÿ-les-Roses's « Demandes d'autorisation du droit des sols déposées en
 * mairie », printed to PDF from a spreadsheet: no cell rectangles, each
 * value centred on its row, the house number right-aligned in a column of
 * its own left of the street. Each run goes to the nearest number of the
 * page; columns are spans between the centred headers. The applicant's span
 * is never read. 52 filings from 18 Dec 2025 to 25 Sep 2026 on 2 Oct 2026.
 */
export function readLhayFilings(document, { city }) {
  const rows = [];
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    const at = Object.fromEntries(Object.entries(LHAY_HEADERS).map(([field, words]) => [field, runs.find((run) => fold(run.text) === words)]));
    if (Object.values(at).some((run) => !run)) continue;
    const top = Math.min(...Object.values(at).map((run) => run.y)) - 4;
    const body = runs.filter((run) => run.y < top);
    const anchors = body.filter((run) => run.x < at.filed.x - 20 && /^(?:PC|DP|PA|PD)\s*0?\d/i.test(clean(run.text)));
    for (const anchor of anchors) {
      const own = body.filter((run) => run !== anchor && Math.abs(run.y - anchor.y) <= 40
        && anchors.every((other) => Math.abs(other.y - run.y) >= Math.abs(anchor.y - run.y)));
      const span = (from, to) => own.filter((run) => run.x >= from && run.x < to);
      const dossier = municipalDossier(clean(anchor.text), city);
      if (!dossier) continue;
      const numbers = span(at.site.x - 60, at.site.x - 10);
      const streets = span(at.site.x - 10, at.land.x - 80);
      const address = clean([...runLines(numbers), ...runLines(streets)].map((line) => line.text).join(' '));
      if (!/\p{L}{3}/u.test(address) || PERSON_RE.test(address)) continue;
      const land = span(at.land.x + 40, at.features.x - 40).find((run) => /m²|m2/.test(run.text));
      rows.push({
        board: 'filings', dossier, applicant: null, address, postcode: city.postcode,
        parcels: lhayParcels(runLines(span(at.land.x - 50, at.land.x + 10)).map((line) => line.text).join(' ')),
        purpose: clean(runLines(span(at.purpose.x - 50, at.posted.x - 5)).map((line) => line.text).join(' ')) || null,
        filedOn: span(at.filed.x - 20, at.filed.x + 40).map((run) => municipalDate(run.text)).find(Boolean) ?? null,
        postedOn: span(at.posted.x - 5, Infinity).map((run) => municipalDate(run.text)).find(Boolean) ?? null,
        landArea: land ? squareMetres(land.text) : null,
      });
    }
  }
  return rows;
}

/** `AF 185`, `AN 97 et AN 98`, `R 296-338-`, `0G 93, 234,`: parcels, a section carried over. */
function lhayParcels(value) {
  const out = [];
  let section = null;
  // i18n-ignore-next-line — the conjunction a list of parcels may use
  for (const piece of clean(value).replace(/\b0([A-Z])\b/g, '$1').split(/[;,/-]|\bet\b/i)) {
    const match = /^([A-Z]{1,2})?\s*0*(\d{1,4})$/.exec(clean(piece));
    if (!match || (!match[1] && !section)) continue;
    section = match[1] ?? section;
    out.push(`${section} ${match[2]}`);
  }
  return out.length ? [...new Set(out)].join(', ') : null;
}

// --- Limeil-Brévannes: two Word tables a week -----------------------------------

// i18n-ignore-start — the tables' file names, matched on
const LIMEIL_FILE = /\/Affichage[-_](d[ée]p[ôo]ts?|d[ée]cisions?)[-_](\d{1,2})[._-](\d{1,2})[^/]*\.pdf$/i;
// i18n-ignore-end

/**
 * Limeil-Brévannes's « Affichage numérique réglementaire » page (opened in
 * September 2026, R.423-6 as amended) links the week's two tables, renamed
 * with the day of each edition: `Affichage-depot-28.09.pdf`.
 */
const limeilProtocol = Object.freeze({
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html, request, { day }) {
    const files = new Map();
    for (const [, href] of String(html ?? '').matchAll(/<a\b[^>]*\bhref="([^"]+\.pdf)"/gi)) {
      let url;
      try { url = new URL(xmlText(href), request.url); } catch { continue; }
      const match = LIMEIL_FILE.exec(decodeURIComponent(url.pathname));
      if (!match || url.origin !== new URL(city.page).origin) continue;
      const board = /^d[ée]p/i.test(match[1]) ? 'filings' : 'decisions';
      // Read by the readers of every town printing the same two tables (`permitBoardsTownLists.js`).
      const layout = board === 'filings' ? 'town-filed-before' : 'town-decided-until';
      files.set(url.href, { url: url.href, board, layout, published: dayWithoutYear(match[2], match[3], day) });
    }
    return files.size ? { files: [...files.values()] } : null;
  },
});

// --- Villeneuve-Saint-Georges: weekly notices of filing, one extract per order ----

// i18n-ignore-start — the tables' headers, the extracts' words and the town's file names, matched on
const VSG_COLUMNS = [['dossier', 'N° DE DOSSIER'], ['applicant', 'DEMANDEUR'], ['site', 'ADRESSE DE LA'],
  ['parcels', 'PARCELLE'], ['filedOn', 'DATE'], ['purpose', 'NATURE DU PROJET']];
/** A week's notice of a family: `DP-29092026`, `PC-affichage-25-08-2026`, `PD_11AOUT2026`, `PC-23-06-2026-v2`. */
const VSG_WEEKLY = /^(?:AFFICHAGE[ _-]+)?(DP|PC|PD|PA)[ _-]+(?:AFFICHAGE[ _-]+)?(?:(\d{2})[ ._-]?(\d{2})[ ._-]*(\d{4})|(\d{1,2})([A-Z]{3,9})(\d{4}))(?:[ _-]*V\d)?$/;
const VSG_FOLDER = /\/URBANISME\/(\d{4})\/(\d{2})_[A-Z]+\/[^/]+\.pdf$/i;
const VSG_MONTHS = { JANVIER: 1, FEVRIER: 2, MARS: 3, AVRIL: 4, MAI: 5, JUIN: 6, JUILLET: 7, AOUT: 8, SEPTEMBRE: 9, OCTOBRE: 10, NOVEMBRE: 11, DECEMBRE: 12 };
// i18n-ignore-end

/**
 * The number a Villeneuve-Saint-Georges extract's file name carries, in any
 * of the clerks' spellings — `DP-94078-26-00116`, `affichage-dp-2600155`,
 * `extrait-darrete-DP26-139`, `EXTRAIT-DAFFICHAGE-DP940782600059`,
 * `pc-25-0007-M1` — or null (`affichage-dp-147` has no year). Only the
 * number is read: some names end with the applicant's.
 */
export function vsgFileDossier(name, city) {
  const words = fold(String(name ?? '').replace(/\.pdf$/i, '')).replace(/[\s._-]+/g, ' ');
  const match = /\b(DP|PC|PD|PA)M?\s*(?:0?94\s*078\s*)?(\d{2})\s*(\d{3,5})(?!\d)(?:\s*M\s*0?(\d))?/.exec(words);
  if (!match) return null;
  const [, kind, year, counter, modification] = match;
  return municipalDossier(`${kind} ${year} ${counter.padStart(5, '0')}${modification ? ` M0${modification}` : ''}`, city);
}

/**
 * Villeneuve-Saint-Georges's register page lists every urbanism file since
 * 2017, one folder a month (1 075 links on 2 Oct 2026): each week a Word
 * table of the filings of each family (`DP-29092026.pdf`) and, for each
 * decision, a one-page « extrait d'arrêté » scanned on the town hall's
 * copier, its only text the footer « Date de mise en ligne ». The extracts
 * are read by the sweep's OCR; until then a name that carries the number
 * stands for its row.
 */
const vsgProtocol = Object.freeze({
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html, request, { since, day }) {
    const page = String(html ?? '');
    if (!/ACTES\/URBANISME\//i.test(page)) return null;
    const files = new Map();
    for (const [, href] of page.matchAll(/<a\b[^>]*\bhref="([^"]+\.pdf)"/gi)) {
      let url;
      try { url = new URL(xmlText(href), request.url); } catch { continue; }
      const path = decodeURIComponent(url.pathname);
      const folder = VSG_FOLDER.exec(path);
      if (!folder || !path.startsWith('/images/') || url.origin !== new URL(city.page).origin) continue;
      const month = `${folder[1]}-${folder[2]}-01`;
      if (month < since || (day && month > day)) continue;
      const name = path.split('/').pop().replace(/\.pdf$/i, '');
      const weekly = VSG_WEEKLY.exec(fold(name));
      if (weekly) {
        if (weekly[1] === 'PA') continue;
        const published = weekly[2] ? municipalDate(`${weekly[2]}/${weekly[3]}/${weekly[4]}`)
          : municipalDate(`${weekly[5].padStart(2, '0')}/${String(VSG_MONTHS[weekly[6]] ?? 0).padStart(2, '0')}/${weekly[7]}`);
        files.set(url.href, { url: url.href, board: 'filings', layout: 'vsg-filings', published: published ?? month });
        continue;
      }
      const dossier = vsgFileDossier(name, city);
      files.set(url.href, { url: url.href, board: 'decisions', layout: 'vsg-decision', published: month, scan: true, ocrPages: 1,
        ...(dossier ? { row: { board: 'decisions', dossier, applicant: null, address: null, postcode: city.postcode,
          verdict: verdicts.signed.fr } } : {}) });
    }
    return { files: [...files.values()] };
  },
});

/** The weekly notices of filing: one Word table per family, a rectangle per cell. */
function vsgFilingSpec(city) {
  return {
    columns: VSG_COLUMNS,
    build: (cells) => {
      const dossier = municipalDossier((cells.dossier ?? []).join(' '), city);
      const site = municipalSite((cells.site ?? []).join(' '), city);
      if (!dossier || !site.address || !isSite(site.address)) return null;
      return { board: 'filings', dossier, applicant: null, address: site.address, postcode: site.postcode,
        parcels: lhayParcels((cells.parcels ?? []).join(', ').replace(/\b([A-Z]{1,2})0*(\d{1,4})\b/g, '$1 $2')),
        purpose: clean((cells.purpose ?? []).join(' ')) || null, filedOn: municipalDate((cells.filedOn ?? []).join(' ')) };
    },
  };
}

/**
 * An « extrait d'arrêté » of Villeneuve-Saint-Georges, as OCR reads it: the
 * heading (« portant refus », « de délivrance »), « Par décision municipale
 * n° DP 94078 26 00116 », the applicant and their home, « En vue de la
 * réalisation : », « Sur un terrain sis », « Cadastré », and « Villeneuve-
 * Saint-Georges, le … » stamped. Between « délivrée à » and « En vue de »
 * sits the applicant: never read. A stamped date is kept only within the
 * four months before the extract was posted (OCR read `2076` for `2026`).
 */
export function readVsgDecision(document, { city, file }) {
  const lines = (document?.pages ?? []).slice(0, 1).flatMap((page) => runLines(page.runs ?? [])).map((line) => line.text);
  const body = lines.join('\n');
  // i18n-ignore-start — the extract's own words, matched on
  const number = /d[ée]cision municipale n[°o]?\s*(.+)/i.exec(body)?.[1];
  const site = /^Sur un terrain sis\s*:?\s*(.+)$/im.exec(body)?.[1];
  const heading = lines.slice(0, 8).join(' ');
  const verdict = /PORTANT REFUS|REFUS[ÉE]E?\b/i.test(heading) || /a [ée]t[ée] REFUS/i.test(body) ? verdicts.refused.fr
    : /DE D[ÉE]LIVRANCE|a [ée]t[ée] d[ée]livr[ée]/i.test(`${heading}\n${body}`) ? verdicts.granted.fr : verdicts.signed.fr;
  const parcels = /^Cadastr[ée]e?s?\s*:?\s*(.+(?:\n[A-Z]{1,2}\s*\d.*)?)$/im.exec(body)?.[1];
  const works = /En vue d[eu] la r[ée]alisation\s*:?\s*([\s\S]+?)(?=\nSur un terrain|$)/i.exec(body)?.[1];
  const posted = municipalDate(/Date de mise en ligne\s*:?\s*([^\n]+)/i.exec(body)?.[1]);
  const signed = municipalDate(/Saint-Georges,?\s*le\s+([^\n]+)/i.exec(body)?.[1]);
  // i18n-ignore-end
  const dossier = municipalDossier(ocrNumber(number ?? ''), city);
  const address = clean(String(site ?? '').replace(/^[^\p{L}\d]+/u, '').replace(/[,\s]+\d{5}\b.*$/, '').replace(/\s+[àa]\s+Villeneuve.*$/i, ''));
  if (!dossier || !/\p{L}{3}/u.test(address)) return [];
  const window = posted && signed ? (Date.parse(posted) - Date.parse(signed)) / 86_400_000 : -1;
  const purpose = clean(String(works ?? '').replace(/\n/g, ' ')).replace(/^(.{20,}?[.!?])\s+[\s\S]*$/u, '$1');
  return [{ board: 'decisions', dossier, applicant: null, address, postcode: city.postcode,
    parcels: lhayParcels(String(parcels ?? '').replace(/\n/g, ', ').replace(/\b([A-Z]{1,2})0*(\d{1,4})\b/g, '$1 $2')),
    purpose: purpose ? (purpose.length > 200 ? `${purpose.slice(0, 199).replace(/\s+\S*$/, '')}…` : purpose) : null,
    verdict, decidedOn: window >= 0 && window <= 120 ? signed : null, postedOn: posted ?? null }];
}

// --- Romainville: one scanned arrêté per dossier, a select a month -------------

// i18n-ignore-start — the page's month headings and the arrêtés' own labels, matched on
const ROMAINVILLE_MONTHS = { JANVIER: 1, FEVRIER: 2, MARS: 3, AVRIL: 4, MAI: 5, JUIN: 6, JUILLET: 7, AOUT: 8, SEPTEMBRE: 9, OCTOBRE: 10, NOVEMBRE: 11, DECEMBRE: 12 };
const ROMAINVILLE_HEADING = /\b(JANVIER|F[ÉE]VRIER|MARS|AVRIL|MAI|JUIN|JUILLET|AO[ÛU]T|SEPTEMBRE|OCTOBRE|NOVEMBRE|D[ÉE]CEMBRE)\s+(20\d{2})\b/;
// i18n-ignore-end

/**
 * The number a Romainville arrêté's file name carries: `PC_26B0034`,
 * `DP17B0007M1`, `PC-25B0039-T01`, `DP-093-063-25B0064`. The town's counter
 * always has its letter (`B`); a name without one (`PC-26-41`) is left to
 * the arrêté itself, read by OCR.
 */
export function romainvilleFileDossier(name, city) {
  const words = fold(name).replace(/[\s._-]+/g, ' ');
  const match = /\b(PC|DP|PD|PA)M?\s*(?:0?93\s*063\s*)?(\d{2})\s*([A-Z])\s*(\d{3,4})(?!\d)(?:\s*([MT])\s*0?(\d{1,2}))?/.exec(words);
  if (!match) return null;
  const [, kind, year, letter, counter, step, stepNumber] = match;
  return municipalDossier(`${kind} ${year} ${letter}${counter.padStart(4, '0')}${step ? ` ${step}${stepNumber.padStart(2, '0')}` : ''}`, city);
}

/**
 * Romainville lists every act on one page, a drop-down list per kind and
 * month under the month's heading (« SEPTEMBRE 2026 »), 1 012 options on
 * 2 Oct 2026, 243 of them the urbanism service's — 28 under September 2026.
 * The arrêtés on permits name their number in the file name
 * (`A_2026_0583-URBA-DP-26B0092_-Arre-te.pdf`); all those sampled were scans
 * from the town hall's copier, read by the sweep's OCR. The month is the
 * heading's: the page gives no day.
 */
const romainvilleProtocol = Object.freeze({
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html, request, { since, day }) {
    const page = String(html ?? '');
    if (!/<select\b/i.test(page) || !/uploads\/Document\//i.test(page)) return null;
    const files = new Map();
    let month = null;
    for (const match of page.matchAll(new RegExp(`<option\\b[^>]*\\bvalue="([^"]*)"|${ROMAINVILLE_HEADING.source}`, 'g'))) {
      if (!match[0].startsWith('<')) {
        const heading = ROMAINVILLE_HEADING.exec(match[0]);
        const number = ROMAINVILLE_MONTHS[fold(heading[1])];
        month = number ? `${heading[2]}-${String(number).padStart(2, '0')}-01` : month;
        continue;
      }
      if (!match[1]) continue;
      let url;
      // One link of September 2026 starts `hhttps://`.
      try { url = new URL(xmlText(match[1]).replace(/^h+ttps?:/i, 'https:'), request.url); } catch { continue; }
      const name = decodeURIComponent(url.searchParams.get('path') ?? url.pathname.split('/').pop());
      if (!/A_\d{4}_\d{4}-URBA/i.test(name) || url.origin !== new URL(city.page).origin || !month) continue;
      if (month < since || (day && month > day)) continue;
      const dossier = romainvilleFileDossier(name.replace(/^.*?-URBA/i, ''), city);
      if (!dossier) continue;
      files.set(url.href, { url: url.href, board: 'decisions', layout: 'romainville-decision', published: month, scan: true, ocrPages: 1,
        row: { board: 'decisions', dossier, applicant: null, address: null, postcode: city.postcode, verdict: verdicts.signed.fr } });
    }
    return { files: [...files.values()] };
  },
});

/**
 * A Romainville arrêté, as OCR reads its first page: the heading
 * (« Décision de non-opposition »), « Demande déposée le », « N° DP 093 063
 * 26 B0092 », the applicant's block (« Par : », « Demeurant à : », never
 * read), « Pour : », « Sur un terrain sis » and the first article. The
 * number must be the file name's.
 */
export function readRomainvilleDecision(document, { city, file }) {
  const lines = (document?.pages ?? []).slice(0, 1).flatMap((page) => runLines(page.runs ?? []))
    .map((line) => clean(line.text.replace(/[|¦]/g, ' ')));
  const body = lines.join('\n');
  // i18n-ignore-start — the arrêté's own labels, matched on
  const number = /\bN[°o]\s*((?:PC|DP|PA|PD)\s*0?\s*93\s*063\s*\d{2}\s*[A-Z]?\d{4,5}(?:\s*[MT][O0]?\w{1,2})?)/i.exec(body)?.[1];
  const site = /^Sur un terrain sis\s*(?:[àa]\s*)?:?\s*(.+)$/im.exec(body)?.[1];
  const works = /^Pour\s*:?\s*(.+)$/im.exec(body)?.[1];
  const filed = /d[ée]pos[ée]e?\s+le\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(body)?.[1];
  const article = /\bARTICLE\s+(?:1(?:er)?|UNIQUE)\b\s*[:.\-–]?([\s\S]{0,400}?)(?=\bARTICLE\s+\d|$)/i.exec(body)?.[1];
  // i18n-ignore-end
  const dossier = number ? municipalDossier(ocrNumber(number), city) : null;
  // The right-hand column (« Destination : HABITATION ») shares the site's line.
  // OCR reads a frame's corner before the site as `*”`.
  const address = clean(String(site ?? '').replace(/^[^\p{L}\d]+/u, '').replace(/\s+(?:Destination|Surface|Superficie)\b.*$/i, '')
    .replace(/[,\s]+\d{5}\b.*$/, '').replace(/\s+[àa]\s*:?\s*$/i, ''));
  if (!dossier || (file?.row?.dossier && dossier !== file.row.dossier) || !/\p{L}{3}/u.test(address)) return [];
  return [{ board: 'decisions', dossier, applicant: null, address, postcode: city.postcode,
    purpose: works && !PERSON_RE.test(works) ? clean(works) : null, filedOn: municipalDate(filed),
    verdict: municipalVerdict(article) ?? municipalVerdict(lines.slice(0, 4).join(' ')) ?? verdicts.signed.fr,
    postedOn: null }];
}

// --- Registry ----------------------------------------------------------------

export const ACT_BOARD_PROTOCOLS = Object.freeze({
  'oullins-pierre-benite': oullinsProtocol,
  'lhay-les-roses': lhayProtocol,
  'limeil-brevannes': limeilProtocol,
  'villeneuve-saint-georges': vsgProtocol,
  romainville: romainvilleProtocol,
});

export const ACT_BOARD_READERS = Object.freeze({
  'oullins-report': readOullinsReport,
  'lhay-filings': readLhayFilings,
  'lhay-decision': readLhayDecision,
  'vsg-filings': (document, { city }) => readCellTable(document, vsgFilingSpec(city)),
  'vsg-decision': readVsgDecision,
  'romainville-decision': readRomainvilleDecision,
});

export const ACT_BOARD_TEXT = Object.freeze({});
