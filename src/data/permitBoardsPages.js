/**
 * Boards a city posts as HTML lists of acts or notices: Châlons-en-Champagne's
 * citizen portal, Saint-Germain-en-Laye's acts search, Boulogne-sur-Mer's
 * DOCman folders, Pantin's Docs2Web tree and Anglet's WebDev lists. Each
 * protocol reads its rows from the list itself — a title's number, site and
 * works — and names the PDFs that add what the list leaves out (a filing
 * date, a verdict, parcels), read once and kept; signed scans wait for the
 * sweep's OCR. See `permitBoards.js` for the contract.
 */
import { municipalDate, municipalDossier, municipalVerdict } from './municipalPermitsFeed.js';
import { readExtendedNotice } from './municipalPermitExtensions.js';
import messages from './municipalPermitsFeed.i18n.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const ENTITIES = { amp: '&', quot: '"', apos: '\'', nbsp: ' ', lt: '<', gt: '>', rsquo: '’', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', ocirc: 'ô', ccedil: 'ç' }; // i18n-ignore-line — HTML entity names
function decode(value) {
  return String(value ?? '').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, name) => {
    if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? whole;
    const code = name[1].toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
  });
}
const plain = (html) => clean(decode(String(html ?? '').replace(/<[^>]*>/g, ' ')));
const base64 = (value) => btoa(value);

/** The years a window from `since` to `day` spans, newest first. */
function windowYears(since, day) {
  const first = Number(String(since).slice(0, 4));
  const last = Number(String(day ?? since).slice(0, 4));
  const years = [];
  for (let year = last; year >= first; year -= 1) years.push(year);
  return years;
}

/** Every `<tr>` of the first `<tbody>`, as its cells' text and its first link. */
function bodyRows(html) {
  const start = html.indexOf('<tbody');
  const end = html.indexOf('</tbody>', start);
  if (start < 0 || end < 0) return null;
  return [...html.slice(start, end).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row]) => ({
    cells: [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, cell]) => plain(cell)),
    href: /\bhref\s*=\s*['"]([^'"]+)['"]/i.exec(row)?.[1] ?? null,
  }));
}

/** A document's runs, page by page, in stream order. */
const pageRuns = (document, pages = Infinity) => (document?.pages ?? []).slice(0, pages).map((page) => page.runs ?? []);

/** Runs on one height joined left to right: a printed line's text. */
function printedLines(runs) {
  const lines = [];
  for (const run of [...runs].sort((a, b) => b.y - a.y)) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - run.y) < 2) line.runs.push(run);
    else lines.push({ y: run.y, runs: [run] });
  }
  // A label and its value can sit half a point apart: order a line by x.
  return lines.map((line) => clean(line.runs.sort((a, b) => a.x - b.x).map((run) => run.text).join(' ')));
}

/**
 * Whether a PDF names the dossier its index row does, however it prints it
 * (`DP 051108 2600260`, `AP 051108 26 0001`, `DP 078 551 26 0321`): a file
 * that is another dossier's is not read.
 */
function namesDossier(texts, dossier) {
  const parts = /^([A-Z]{2}) (\d{6}) (\d{2}) ([A-Z]?)(\d+)/.exec(String(dossier ?? ''));
  if (!parts) return false;
  const [, kind, code, year, letter, counter] = parts;
  const commune = `0?\\s*${code.slice(1, 3)}\\s*${code.slice(3)}`;
  const pattern = new RegExp(`\\b${kind}[A-Z]{0,2}\\s*(?:${commune}\\s*)?${year}\\s*${letter}0*${Number(counter)}(?!\\d)`);
  return texts.some((value) => pattern.test(fold(value)));
}

/**
 * A number printed with the commune's full code and a counter of any length:
 * `DP 078 551 26 344` → `DP 078551 26 00344`, `dp-062-160-26-00368` → `DP
 * 062160 26 00368`, `PC 078 551 22 Z0031M01` → `PC 078551 22 Z0031 M01`.
 * `municipalDossier` wants four digits at least, and these boards print three.
 */
export function communeDossier(value, city) {
  const code = `0?[\\s-]*${city.insee.slice(0, 2)}[\\s-]*${city.insee.slice(2)}`;
  const match = new RegExp(`\\b(PC|DP|PA|PD|CU)[\\s-]*${code}[\\s-]*(\\d{2})[\\s-]*([A-Z]?)(\\d{1,5})(?:[\\s-]*([MT])[\\s-]*(\\d{1,2}))?(?![\\dA-Z])`).exec(fold(value));
  if (!match) return null;
  const [, kind, year, letter, digits, step, stepNumber] = match;
  const counter = letter ? `${letter}${digits.padStart(4, '0')}` : digits.padStart(5, '0');
  return `${kind} ${city.insee.padStart(6, '0')} ${year} ${counter}${step ? ` ${step}${stepNumber.padStart(2, '0')}` : ''}`;
}

/** A segment naming a person: never kept, wherever it sits in a title. */
// i18n-ignore-next-line — civilities, matched on
const PERSON_RE = /(?:^|\s)(?:m\.|mme|mr|mlle|monsieur|madame|messieurs|mesdames)(?:\s|$)/i;

// --- Châlons-en-Champagne: the citizen portal's two tables -------------------

const CHALONS_ORIGIN = 'https://citoyen.chalonsenchampagne.fr';
// i18n-ignore-start — the portal's own filter codes and labels, matched on
/** Type codes of the portal's filters: notices of filing, and dematerialised planning orders. */
const CHALONS_FILINGS_TYPE = '4201   -2';
const CHALONS_DECISIONS_TYPE = '4201   -377';
/** The families its numbers use: `DPC`/`DPA` are its own split of the DP, `PCMI`/`PC ERP` of the PC. */
const CHALONS_KINDS = [[/^(?:DPC|DPA|DP)$/, 'DP'], [/^(?:PCMI|PC ERP|PC)$/, 'PC'], [/^PA$/, 'PA'], [/^PD$/, 'PD'], [/^CUB?$/, 'CU']];
const CHALONS_NUMBER_RE = /^(PCMI|PC\s+ERP|PC|DPC|DPA|DP|PA|PD|CUB|CU)\s*((?:\d[\d ]*)?[A-Z]?\d+)\s*([MT]\s*\d{1,2})?(?![\dA-Z])/;
/** A works segment of a notice's title starts with one of these words; anything else (a co-applicant, a building's name) is left out. */
const CHALONS_WORKS_RE = /^(?:TRAVAUX|TRVAUX|NOUVELLE|CLOTURE|ENSEIGNE|POSE|AMENAGEMENT|REAMENAGEMENT|CHANGEMENT|MODIFICATIF|REHABILITATION|DEMOLITION|ACCESSIBILITE|ACCES|ABATT|TRANSFERT|EXTENSION|DIVISION|LOTISSEMENT|CREATION|AIRE|SURELEVATION|TOITURE|FRESQUE|RETRAIT CLOTURE|PISCINE)\b/;
/** Where a site starts: a house number (`3ter`, `14B`, `19-21`), or a street word. */
const STREET_WORDS = 'rue|avenue|av\\.?|boulevard|bd|bld|place|chemin|all[ée]es?|impasse|route|quai|cours|faubourg|chauss[ée]e|square|promenade|sentier|ruelle|passage|r[ée]sidence|esplanade|rond-point|parvis|voie|cit[ée]|clos|hameau|lieu-dit|zac|za|zi';
const HOUSE_NUMBER = '\\d{1,4}(?:\\s*-\\s*\\d{1,4})?(?:\\s*(?:bis|ter|quater|q|[a-d]))?';
const NUMBERED_SITE_RE = new RegExp(`(?:^|\\s)${HOUSE_NUMBER}\\s*(?:${STREET_WORDS})\\b.*$`, 'i');
/** A site with no number: the street word in lower or title case, never a capitalised surname's. */
const TITLE_STREET_WORDS = STREET_WORDS.split('|').map((word) => `[${word[0]}${word[0].toUpperCase()}]${word.slice(1)}`).join('|');
const BARE_SITE_RE = new RegExp(`(?:^|\\s)(?:${TITLE_STREET_WORDS})\\s.*$`);
const STREET_START_RE = new RegExp(`^(?:${HOUSE_NUMBER}(?:\\b|(?=${STREET_WORDS}))|(?:${STREET_WORDS})\\s)`, 'i');
// i18n-ignore-end

/**
 * A Châlons number as Sitadel writes it: `DPC 2600093` → `DP 051108 26
 * 00093`, `PC 22A0040M01` → `PC 051108 22 A0040 M01`, `DP 0511082600160` →
 * `DP 051108 26 00160`. The orders print the commune's code, the notices
 * leave it out; a clerk's slip (`05510082600280`, one of 85 orders) is no
 * number. `AP`, `AT` and `EN` (signs, works in buildings open to the public)
 * are not families the layer draws.
 */
export function chalonsDossier(value) {
  const match = CHALONS_NUMBER_RE.exec(fold(value));
  if (!match) return null;
  const kind = CHALONS_KINDS.find(([pattern]) => pattern.test(match[1].replace(/\s+/g, ' ')))?.[1];
  let body = match[2].replace(/\s/g, '').replace(/^0?51108/, '');
  if (/^0\d{2}/.test(body) && body.length === 8) body = body.slice(1);
  const parts = /^(\d{2})(?:([A-Z]\d{4})|(\d{3,6}))$/.exec(body);
  if (!kind || !parts) return null;
  const counter = parts[2] ?? (parts[3].replace(/^0+/, '').length <= 5 ? parts[3].slice(-5).padStart(5, '0') : null);
  if (!counter) return null;
  return `${kind} 051108 ${parts[1]} ${counter}${match[3] ? ` ${match[3].replace(/\s/g, '')}` : ''}`;
}

/** The site at the end of an order's title, after the applicant: `… 46 rue du Général Compère`. */
function chalonsOrderSite(title) {
  return clean(NUMBERED_SITE_RE.exec(title)?.[0] ?? BARE_SITE_RE.exec(title)?.[0]) || null;
}

/**
 * A notice's title, `APPLICANT - works - site`, split: the works segments
 * kept by their first word only, the site from the first segment that
 * starts with a number or a street. The applicant — and a co-applicant
 * after a dash, `DEHU - FAGOT - …` — is never kept.
 */
function chalonsNoticeTitle(title) {
  const segments = clean(title).split(/\s+-\s*|\s*-\s+/).map(clean);
  const siteAt = segments.findIndex((segment, i) => i > 0 && STREET_START_RE.test(segment));
  const works = segments.slice(1, siteAt < 0 ? undefined : siteAt).filter((segment) => CHALONS_WORKS_RE.test(fold(segment)));
  // A named place before the street, `Cimetière de l'Ouest, 4 bld Léon Blum`.
  const tail = siteAt < 0 && segments.length > 1 ? NUMBERED_SITE_RE.exec(segments.at(-1))?.[0] : null;
  return {
    address: clean(siteAt < 0 ? tail : segments.slice(siteAt).join(' - ')) || null,
    purpose: works.length ? works.join(' — ') : null,
  };
}

function chalonsRequest(board, year) {
  const filter = base64(board === 'filings' ? `${CHALONS_FILINGS_TYPE}&${year}&&` : `${CHALONS_DECISIONS_TYPE}&${year}&2&&`);
  const path = board === 'filings' ? `/avis/1/-1/0/${filter}/MA==` : `/arretes/1/-1/0/${filter}/MA==/MA==/MA==`;
  return { url: `${CHALONS_ORIGIN}${path}`, as: 'html' };
}

/**
 * The portal lists a year's notices of filing (533 from 5 Jan to 28 Sep
 * 2026) and its dematerialised planning orders (85 from 13 May to 2 Oct
 * 2026, none before) on one page each when asked for « Tous ». One request
 * per board and year of the window; rows older than `since` are dropped.
 */
const chalonsProtocol = {
  start(city, { since, day }) {
    return windowYears(since, day).flatMap((year) => [chalonsRequest('filings', year), chalonsRequest('decisions', year)]);
  },
  index(city, html, request, { since }) {
    const board = request.url.includes('/arretes/') ? 'decisions' : 'filings';
    // i18n-ignore-next-line — the portal's form names, matched on
    if (!html.includes(board === 'filings' ? 'avis-index-form' : 'arretes-index-form')) return null;
    const rows = bodyRows(html);
    if (!rows) return null;
    const files = [];
    const kept = [];
    for (const { cells, href } of rows) {
      if (cells.length < 4) continue;
      const day = municipalDate(cells[3]);
      if (!day || day < since) continue;
      const title = cells[1];
      let row;
      if (board === 'filings') {
        const dossier = chalonsDossier(cells[0]);
        if (!dossier) continue;
        row = { board, dossier, applicant: null, ...chalonsNoticeTitle(title), postcode: city.postcode, postedOn: day };
      } else {
        // An order's title is its number, the applicant, the site; or, for
        // one of 85, `Arrêté de retrait` before the number.
        const body = title.slice(Math.max(0, title.search(/\b(?:PC|DP|PA|PD|CU)\b/i)));
        const dossier = chalonsDossier(body);
        if (!dossier) continue;
        // i18n-ignore-next-line — the title's own words for a withdrawal
        const withdrawn = /^arr[êe]t[ée] de retrait\b/i.test(title);
        row = { board, dossier, applicant: null, address: chalonsOrderSite(body.replace(CHALONS_NUMBER_RE, ' ')),
          postcode: city.postcode, verdict: withdrawn ? verdicts.withdrawn.fr : verdicts.signed.fr, decidedOn: day, postedOn: day };
      }
      if (!href) { kept.push(row); continue; }
      files.push({ url: new URL(decode(href), CHALONS_ORIGIN).href, board, layout: `chalons-${board}`,
        published: day, row, ...(board === 'decisions' ? { ocr: true, ocrPages: 2 } : {}) });
    }
    return { files, rows: kept };
  },
};

/** A surface as printed: `505.00`, `1 250`, `1.250,5` → whole square metres. */
function squareMetres(value) {
  let digits = clean(value).replace(/\s/g, '');
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(digits)) digits = digits.replace(/\./g, '');
  const area = Number(digits.replace(',', '.'));
  return Number.isFinite(area) && digits ? String(Math.round(area)) : null;
}

/** The value printed after a label on its line, from the first line one of `patterns` opens. */
function labelled(lines, patterns) {
  for (const line of lines) {
    for (const pattern of patterns) {
      const value = pattern.exec(line)?.[1];
      if (value !== undefined && clean(value)) return clean(value);
    }
  }
  return null;
}

/**
 * A notice of filing, in either of the two layouts the planning software
 * printed in 2026: `Date de dépôt :` / `Surface de l'unité foncière:` /
 * `Nature des travaux :` until the summer, then `Déposé le` / `Superficie du
 * terrain` / `Parcelle cadastrale` / `Pour un projet de`. The applicant's,
 * representative's and owners' lines are never read.
 */
function readChalonsFiling(document, { file }) {
  const runs = pageRuns(document, 1)[0] ?? [];
  const lines = printedLines(runs);
  if (!file?.row || !namesDossier(lines, file.row.dossier)) return [];
  // i18n-ignore-start — the notice's own labels, matched on
  const filed = labelled(lines, [/^date de d[ée]p[ôo]t\s*:\s*(\d{2}\/\d{2}\/\d{4})/i, /^d[ée]pos[ée]e? le\s+(\d{2}\/\d{2}\/\d{4})/i]);
  const land = labelled(lines, [/^surface de l.unit[ée] fonci[èe]re\s*:\s*(\d[\d\s.,]*)\s*m/i, /^superficie du terrain\s*:?\s*(\d[\d\s.,]*)\s*m/i]);
  const floor = labelled(lines, [/^surface de plancher cr[ée]{2}e\s*:?\s*(\d[\d\s.,]*)\s*m/i]);
  const housing = labelled(lines, [/^nombre de logements\s*:?\s*(\d+)\b/i]);
  const parcels = labelled(lines, [/^[Pp]arcelles? cadastrales?\s*:?\s*([A-Z]{1,2}\s*\d.*)$/]);
  const worksLabel = runs.find((run) => /^(?:nature des travaux\s*:|pour un projet de)$/i.test(clean(run.text)));
  // i18n-ignore-end
  // A value that wraps is centred on its label, and the applicant's above it
  // may wrap down into the same band: only a value alone on its label's line
  // is read, else the title's works stand.
  const beside = worksLabel ? runs.filter((run) => run.x > worksLabel.x + 100 && Math.abs(run.y - worksLabel.y) < 14) : [];
  const works = beside.length === 1 && Math.abs(beside[0].y - worksLabel.y) < 2 ? clean(beside[0].text) : null;
  const found = parcels ? [...fold(parcels).matchAll(/\b([A-Z]{1,2})\s?0*(\d{1,4})\b/g)].map((m) => `${m[1]} ${m[2]}`) : [];
  return [{ ...file.row,
    purpose: works && !PERSON_RE.test(works) ? works : file.row.purpose ?? null,
    filedOn: municipalDate(filed) ?? file.row.filedOn ?? null,
    landArea: land ? squareMetres(land) : file.row.landArea ?? null,
    floorArea: floor ? squareMetres(floor) : file.row.floorArea ?? null,
    housing: housing ?? file.row.housing ?? null,
    parcels: found.length ? found.join(', ') : file.row.parcels ?? null }];
}

/**
 * An order, scanned and run through OCR by the town (37 of 40 read on
 * 2026-10-02 carry text; the rest await the sweep's OCR). The verdict is the
 * heading's — `NON-OPPOSITION À DÉCLARATION PRÉALABLE` — or, under a heading
 * that only names the act (`PORTANT PERMIS DE CONSTRUIRE`), the capitalised
 * word of its first article (`ACCORDÉ`). Never a recital's.
 */
function readChalonsDecision(document, { file }) {
  const pages = pageRuns(document, 2);
  // Runs first (a rotated scan's text layer prints each line as one), then
  // lines (the sweep's OCR prints words, and a run can break inside one).
  const lines = pages.flatMap(printedLines);
  const texts = [...pages.flat().map((run) => clean(run.text)), ...lines];
  if (!file?.row || !namesDossier(texts, file.row.dossier)) return [];
  // i18n-ignore-start — the orders' own words, matched on
  const heading = texts.find((value) => value.length < 90 && /[A-Z]{4}/.test(value) && value === value.toUpperCase()
    && /\b(?:NON-?\s?OPPOSITION|OPPOSITION|REFUS|ACCORD|RETRAIT)/.test(fold(value)));
  const article = articleVerdict([...texts.filter((value) => ARTICLE_ONE_RE.test(value)),
    ...lines.flatMap((line, i) => (ARTICLE_ONE_RE.test(line) ? [`${line} ${lines[i + 1] ?? ''}`] : []))]);
  const filed = texts.map((value) => /d[ée]pos[ée]e?\s+le\s+(\d{2}\/\d{2}\/\d{4})/i.exec(value)?.[1]).find(Boolean);
  const parcels = texts.map((value) => /r[ée]f[ée]rences\s+cadastrales\s*:\s*(.+)$/i.exec(value)?.[1]).find(Boolean);
  // i18n-ignore-end
  const verdict = file.row.verdict === verdicts.withdrawn.fr ? file.row.verdict
    : municipalVerdict(heading) ?? article ?? file.row.verdict;
  const found = parcels ? [...fold(parcels).matchAll(/\b([A-Z]{1,2})\s?0*(\d{1,4})\b/g)].map((m) => `${m[1]} ${m[2]}`) : [];
  return [{ ...file.row, verdict, filedOn: municipalDate(filed) ?? file.row.filedOn ?? null,
    parcels: found.length ? found.join(', ') : file.row.parcels ?? null }];
}

/** `ARTICLE 1 :`, `ARTICLE l :` and `ARTICLE 1er` as OCR prints them: the operative article. */
const ARTICLE_ONE_RE = /^ARTICLE\s*(?:1|l|I)(?:er)?\s*[:.-]/i;

/** The first operative article that states a verdict, read alone and then with its next line. */
function articleVerdict(candidates) {
  for (const value of candidates) {
    const verdict = municipalVerdict(value.replace(ARTICLE_ONE_RE, ''));
    if (verdict) return verdict;
  }
  return null;
}

// --- Saint-Germain-en-Laye: the TYPO3 acts search --------------------------

// i18n-ignore-start — the board's own verdict words and the town's name, matched on
/** The outcome a title opens with, as the town writes it (92 titles read on 2026-10-02). */
const SGL_VERDICT_RE = /^\s*(autorisation(?:\s+avec\s+prescriptions)?|accord(?:\s+avec\s+prescriptions)?|refus|rejet\s+tacite|d[ée]cision\s+tacite\s+de\s+rejet|certificat\s+de\s+non[\s-]opposition[^-]*?|non[\s-]opposition(?:\s+avec\s+prescriptions)?|opposition|annulation|retrait|transfert|prorogation|sursis\s+[àa]\s+statuer)(?![\p{L}])\s*(?:au\s+)?/iu;
const SGL_TOWN_RE = /^(?:st|saint)[\s-]+germain\b/i;
const SGL_TOWN_TAIL_RE = /\s+[àa]\s+(?:st|saint)[\s-]+germain\b.*$/i;
// i18n-ignore-end

/**
 * A title, `Outcome - site [- town] - works`: the outcome in the board's
 * words (`Autorisation` is its word for a grant, read as `Accord`), the site
 * from the first segment that starts with a number or a street, the works
 * after it. A segment before the site, or one naming a person, is dropped.
 */
export function sglTitle(title) {
  const value = clean(decode(title));
  const opening = SGL_VERDICT_RE.exec(value);
  const said = opening ? clean(opening[1]).toLowerCase() : null;
  // i18n-ignore-next-line — the board's word for a grant, and the canonical one
  const verdict = said ? `${said[0].toUpperCase()}${said.slice(1)}`.replace(/^Autorisation/, 'Accord') : verdicts.signed.fr;
  const segments = value.slice(opening ? opening[0].length : 0).split(/\s+-\s*|\s*-\s+|^-\s*/).map(clean).filter(Boolean);
  const siteAt = segments.findIndex((segment) => STREET_START_RE.test(segment) && !PERSON_RE.test(segment));
  if (siteAt < 0) return { verdict, address: null, purpose: null };
  const works = segments.slice(siteAt + 1).filter((segment) => !SGL_TOWN_RE.test(segment) && !PERSON_RE.test(segment));
  return { verdict, address: clean(segments[siteAt].replace(SGL_TOWN_TAIL_RE, '')) || null, purpose: works.join(' - ') || null };
}

/**
 * The acts search lists the orders of the last two months, newest first,
 * fifty a page (92 from 21 Aug to 29 Sep 2026); its pages are linked with
 * the `cHash` TYPO3 signs them with, taken from the page. Each row is one
 * order's PDF; its title gives the outcome, the site and the works.
 */
const sglProtocol = {
  start(city) {
    return [{ url: city.page, as: 'html' }];
  },
  index(city, html, request, { since }) {
    if (!html.includes('id="listingRecordResults"')) return null;
    const files = [];
    let oldest = null;
    for (const [, item] of html.matchAll(/<article\s+class="files-item">([\s\S]*?)<\/article>/g)) {
      const href = /<a\b[^>]*\bhref="([^"]+\.pdf)"/i.exec(item)?.[1];
      const title = /<span class="title">([\s\S]*?)<\/span>/.exec(item)?.[1];
      const infos = [...item.matchAll(/<span class="infos">([\s\S]*?)<\/span>/g)].map(([, info]) => plain(info));
      const posted = municipalDate(infos.find((info) => /\b20\d{2}\b/.test(info) && !/\bn°/.test(info)) ?? '');
      if (posted && (!oldest || posted < oldest)) oldest = posted;
      const dossier = communeDossier(infos.join(' '), city);
      if (!href || !title || !posted || posted < since || !dossier) continue;
      const row = { board: 'decisions', dossier, applicant: null, ...sglTitle(title), postcode: city.postcode, postedOn: posted };
      files.push({ url: new URL(decode(href), city.page).href, board: 'decisions', layout: 'sgl-decision', published: posted, row });
    }
    // Only pages after this one: the first is linked as `page=6911-1` too.
    const pageOf = (url) => Number(/[?&]page=\d+-(\d+)/.exec(url)?.[1] ?? 1);
    const next = oldest && oldest < since ? [] : [...new Set([...html.matchAll(/href="([^"]*[?&](?:amp;)?page=\d+-\d+[^"]*)"/g)]
      .map(([, href]) => new URL(decode(href), city.page).href))]
      .filter((url) => pageOf(url) > pageOf(request.url)).map((url) => ({ url, as: 'html' }));
    return { files, next };
  },
};

/**
 * An order in full text: `… déposée le 30/07/2026`, `Référence cadastrale :
 * AD016`, `Surface de plancher créée : 0 m²`. Its date is a signature stamp
 * the text does not carry; the posting date stands.
 */
function readSglDecision(document, { file }) {
  const lines = pageRuns(document, 2).flatMap(printedLines);
  if (!file?.row || !namesDossier(lines, file.row.dossier)) return [];
  // i18n-ignore-start — the order's own labels, matched on
  const filed = lines.map((line) => /\bd[ée]pos[ée]e?\s+le\s+(\d{2}\/\d{2}\/\d{4})/i.exec(line)?.[1]).find(Boolean);
  const parcels = lines.map((line) => /[Rr][ée]f[ée]rences?\s+cadastrales?\s*:\s*([A-Z0-9 ,;-]+?)\s*(?:$|[a-z])/.exec(line)?.[1]).find(Boolean);
  const floor = lines.map((line) => /surface\s+de\s+plancher\s+cr[ée]{2}e\s*:\s*([\d\s.,]+)\s*m/i.exec(line)?.[1]).find(Boolean);
  // i18n-ignore-end
  const found = parcels ? [...fold(parcels).matchAll(/\b([A-Z]{1,2})\s?0*(\d{1,4})\b/g)].map((m) => `${m[1]} ${m[2]}`) : [];
  return [{ ...file.row, filedOn: municipalDate(filed) ?? file.row.filedOn ?? null,
    parcels: found.length ? found.join(', ') : file.row.parcels ?? null,
    floorArea: floor ? squareMetres(floor) : file.row.floorArea ?? null }];
}

// --- Boulogne-sur-Mer: six DOCman folders --------------------------------------

const BOULOGNE_FOLDERS = Object.freeze([
  ['filings', 'avis-de-depot/declaration-prealable-1'], ['filings', 'avis-de-depot/permis-de-construire-1'],
  ['filings', 'avis-de-depot/permis-de-demolir-1'], ['decisions', 'affichage-des-arretes/declaration-prealable'],
  ['decisions', 'affichage-des-arretes/permis-de-construire'], ['decisions', 'affichage-des-arretes/permis-de-demolir'],
]);

/**
 * Each folder lists every notice still posted, on one page and without a
 * date (74 declarations, 11 permits and 2 demolitions filed, 118 orders, on
 * 2026-10-02): an item's title is its number and site, `DP 062 160 26 00368
 * - 19 Rue du Chemin Vert`. Notices leave when their posting ends, so the
 * folders hold two months at most; the PDFs give the dates. Notices of
 * filing are typed; orders are signed scans, read by OCR in the sweep.
 */
const boulogneProtocol = {
  start(city) {
    return BOULOGNE_FOLDERS.map(([, folder]) => ({ url: new URL(`${folder}/`, city.page).href, as: 'html' }));
  },
  index(city, html, request) {
    const [board, folder] = BOULOGNE_FOLDERS.find(([, name]) => request.url.includes(`/${name}/`)) ?? [];
    if (!board || !/class="docman_item"/.test(html) && !/class="k-pagination"/.test(html)) return null;
    const files = [];
    for (const [item] of html.matchAll(/<tr class="docman_item"[\s\S]*?<\/tr>/g)) {
      const link = /<a\b[^>]*\bhref="([^"]+\?layout=file)"[^>]*\bdata-title="([^"]*)"/.exec(item);
      // Only the folder's own items: a page that lists another's is not this board.
      if (!link || !link[1].includes(`/${folder}/`)) continue;
      const title = clean(decode(link[2]));
      const dossier = communeDossier(title, city);
      if (!dossier) continue;
      const site = clean(title.replace(/^.*?\b(?:PC|DP|PA|PD|CU)[\s-]*0?\d{2}[\s-]*\d{3}[\s-]*\d{2}[\s-]*[A-Z]?\d{1,5}(?:[\s-]*[MT]\d{1,2})?(?!\d)/i, '').replace(/^[\s\u2013\u2014-]+/, ''));
      const address = STREET_START_RE.test(site) && !PERSON_RE.test(site) ? site : null;
      files.push({ url: new URL(decode(link[1]), city.page).href, board, layout: `boulogne-${board}`,
        row: { board, dossier, applicant: null, address, postcode: city.postcode,
          ...(board === 'decisions' ? { verdict: verdicts.signed.fr } : {}) },
        ...(board === 'decisions' ? { scan: true, ocrPages: 3 } : {}) });
    }
    return { files };
  },
};

/**
 * A notice of filing: `POUR AFFICHAGE LE 30/09/2026`, `Référence à rappeler`,
 * `Déposée ou reçue le`, `Concernant un projet de`, `Surface de plancher
 * créée :`. The applicant's line (`Par`) is never read.
 */
function readBoulogneFiling(document, { file }) {
  const lines = pageRuns(document, 1).flatMap(printedLines);
  if (!file?.row || !namesDossier(lines, file.row.dossier)) return [];
  // i18n-ignore-start — the notice's own labels, matched on
  const posted = labelled(lines, [/^pour affichage le\s+(\d{2}\/\d{2}\/\d{4})/i]);
  const filed = labelled(lines, [/^d[ée]pos[ée]e? ou re[çc]ue? le\s+(\d{2}\/\d{2}\/\d{4})/i, /^d[ée]pos[ée]e? le\s+(\d{2}\/\d{2}\/\d{4})/i]);
  const works = labelled(lines, [/^concernant un projet de\s+(.+)$/i]);
  const floor = labelled(lines, [/^surface de plancher cr[ée]{2}e\s*:\s*(\d[\d\s.,]*)\s*m/i]);
  // i18n-ignore-end
  return [{ ...file.row, purpose: works && !PERSON_RE.test(works) ? works : file.row.purpose ?? null,
    filedOn: municipalDate(filed) ?? null, postedOn: municipalDate(posted) ?? null,
    floorArea: floor ? squareMetres(floor) : null }];
}

/**
 * An order, a signed scan (Boulogne's, Pantin's): `readExtendedNotice` reads
 * its first article's verdict, filing date and signature date from the
 * sweep's OCR. The site is the index title's — OCR read `52200` for the
 * postcode under « Sur un terrain sis à » on one Boulogne order of two.
 */
function readScannedOrder(document, { city, file }) {
  const [row] = readExtendedNotice(document, { city: { ...city, source: {} }, file });
  if (!row || row.dossier !== file?.row?.dossier) return [];
  return [{ ...row, address: file.row.address ?? row.address, postcode: city.postcode, parcels: null,
    postedOn: file.row.postedOn ?? row.postedOn ?? null }];
}

// --- Pantin: Screensoft Docs2Web ------------------------------------------------

/**
 * The Docs2Web board renders its cards with JavaScript, from the tree its
 * page loads as `params.js`: every folder (`subtheme`) and document
 * (`paper`) of the town's boards, as XML in a script — 3.7 MB, 372
 * planning notices since 2019, each twice. Under `Urbanisme > Autorisations
 * d'Urbanisme`, `Dépôt de demande` holds the notices of filing and
 * `Décision` the orders, one folder per family; a paper's `name` is its
 * number and site (`DP 26B0121_153 avenue Jean Lolive_depot`), its
 * `real_date_debut` the day it was posted, its `path` the PDF under
 * `content/`. 78 were posted from 1 Jan to 2 Oct 2026.
 */
const pantinProtocol = {
  start(city) {
    return [{ url: new URL('params.js', city.page).href, as: 'text' }];
  },
  index(city, script, request, { since }) {
    const xml = String(script).replace(/\\"/g, '"');
    // i18n-ignore-next-line — the board's own folder name, matched on
    if (!/<subtheme\b[^>]*\bname="Autorisations d(?:&apos;|')Urbanisme"/.test(xml)) return null;
    const stack = [];
    const files = new Map();
    for (const [, close, tag, attributes, selfClosing] of xml.matchAll(/<(\/?)(theme|subtheme|paper)\b([^>]*?)(\/?)>/g)) {
      if (close) { if (tag !== 'paper') stack.pop(); continue; }
      const attribute = (name) => decode(new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1] ?? '');
      if (tag !== 'paper') { if (!selfClosing) stack.push(attribute('name')); continue; }
      // i18n-ignore-start — the board's own folder names, matched on
      if (!stack.some((name) => /^Autorisations d'Urbanisme$/i.test(name))) continue;
      const board = stack.includes('Décision') ? 'decisions' : stack.includes('Dépôt de demande') ? 'filings' : null;
      // i18n-ignore-end
      const posted = municipalDate(attribute('real_date_debut')) ?? municipalDate(attribute('date_debut'));
      const path = attribute('path');
      const name = attribute('name');
      const dossier = municipalDossier(name.split('_')[0], city);
      if (!board || !posted || posted < since || !/^\/[\w.-]+\.pdf$/i.test(path) || !dossier) continue;
      const site = clean(name.split('_')[1]);
      const address = STREET_START_RE.test(site) && !PERSON_RE.test(site) ? site : null;
      const url = new URL(`content${path}`, city.page).href;
      files.set(url, { url, board, layout: `pantin-${board}`, published: posted,
        row: { board, dossier, applicant: null, address, postcode: city.postcode, postedOn: posted,
          ...(board === 'decisions' ? { verdict: verdicts.signed.fr } : {}) },
        ...(board === 'decisions' ? { scan: true, ocrPages: 3 } : {}) });
    }
    return { files: [...files.values()] };
  },
};

/**
 * A notice of filing, a one-row table typed in Word: `DATE AFFICHAGE DÉPÔT`,
 * then `Date de dépôt`, `Numéro de dossier`, `Pétitionnaire`, `Adresse du
 * projet`, `Description du projet` as columns. The description is read from
 * its own column only; the applicant's is never read.
 */
function readPantinFiling(document, { file }) {
  const runs = pageRuns(document, 1)[0] ?? [];
  const lines = printedLines(runs);
  if (!file?.row || !namesDossier(lines, file.row.dossier)) return [];
  // i18n-ignore-start — the notice's own headings, matched on
  const header = runs.find((run) => /^description du projet$/i.test(clean(run.text)));
  const filedHeader = runs.find((run) => /^date de d[ée]p[ôo]t$/i.test(clean(run.text)));
  const posted = labelled(lines, [/date affichage d[ée]p[ôo]t\s*:\s*(\d{2}\/\d{2}\/\d{4})/i]);
  // i18n-ignore-end
  const below = (run) => header && run.y < header.y - 2 && run.y > 60;
  const works = header ? clean(runs.filter((run) => below(run) && run.x >= header.x - 15)
    .sort((a, b) => b.y - a.y || a.x - b.x).map((run) => run.text).join(' ')) : null;
  const filed = filedHeader ? runs.filter((run) => below(run) && Math.abs(run.x - filedHeader.x) < 40)
    .map((run) => municipalDate(run.text)).find(Boolean) : null;
  return [{ ...file.row, purpose: works && !PERSON_RE.test(works) ? works : null,
    filedOn: filed ?? null, postedOn: municipalDate(posted) ?? file.row.postedOn ?? null }];
}

// --- Anglet: WebDev « arrêtés municipaux » ---------------------------------------

/** The board's sub-categories of planning orders, by the `P1` its links carry: probed on 2026-10-02. */
const ANGLET_CATEGORIES = Object.freeze([19, 20, 21, 28]);
// i18n-ignore-start — the publisher's words, matched on
/** A works phrase opens with one of these; anything else in a description (a name) is left out. */
const ANGLET_WORKS_RE = /^(?:CONSTRUCTION|INSTALLATION|POSE|RAVALEMENT|MISE|CHANGEMENT|CREATION|EXTENSION|MODIFICATION|REHABILITATION|PANNEAUX|DIVISION|DETACHEMENT|DEMOLITION|CLOTURE|SURELEVATION|REFECTION|REMPLACEMENT|AMENAGEMENT|TRAVAUX|ISOLATION|REALISATION|RENOVATION|TRANSFORMATION|ABATTAGE|DEPLACEMENT|AGRANDISSEMENT|PISCINE|ABRI|CARPORT|PERGOLA|VERANDA|LOTISSEMENT|REGULARISATION)\b/;
/** The order a description opens with, before the number: `Refus Dp 2600508`. */
const ANGLET_OPENING_RE = /^(refus|accord|transfert|retrait|sursis [àa] statuer|prorogation|annulation)\b/i;
// i18n-ignore-end
const ANGLET_NUMBER_RE = /\b(PC|DP|PA|PD)\s*(?:0?64\s*024\s*)?(\d{2})\s*([A-Z]?\d{4,5})(?:\s*([MT])\s*(\d{1,2}))?(?![\dA-Z])/;
const ANGLET_SITE_RE = new RegExp(`^${HOUSE_NUMBER}\\s*,?\\s*(?:${STREET_WORDS})\\b`, 'i');

/**
 * One order's description, free text typed by the clerk: the number, often
 * the applicant's name, the site, the works — on lines or between dashes,
 * in any order (`Dp2600477 [name]` / `2bis, Rue Du Clos De L'Ermitage` /
 * `Construction D'Un Mur…`). Only a numbered site and segments opening with a
 * works word are kept; every other segment is taken for a name.
 */
export function angletDescription(value, city) {
  const text = decode(value).replace(/\r/g, '');
  const number = ANGLET_NUMBER_RE.exec(fold(text));
  if (!number) return null;
  const [, kind, year, counter, step, stepNumber] = number;
  const dossier = `${kind} ${city.insee.padStart(6, '0')} ${year} ${/^\d+$/.test(counter) ? counter.padStart(5, '0') : counter}${step ? ` ${step}${stepNumber.padStart(2, '0')}` : ''}`;
  const opening = ANGLET_OPENING_RE.exec(clean(text))?.[1];
  const segments = text.split(/\n|\s+-\s+/).map(clean).filter(Boolean);
  const site = segments.find((segment) => ANGLET_SITE_RE.test(segment) && !PERSON_RE.test(segment));
  const works = segments.filter((segment) => ANGLET_WORKS_RE.test(fold(segment)));
  // i18n-ignore-next-line — the clerks' capitalised `Sursis A Statuer`, accented
  const said = opening ? clean(opening).toLowerCase().replace(/ a statuer$/, ' à statuer') : null;
  return {
    dossier,
    address: site ? clean(site.replace(/^(\d+\s*(?:bis|ter|quater|[a-d])?)\s*,\s*/i, '$1 ')) : null,
    purpose: works.length ? works.join(' - ') : null,
    verdict: said ? municipalVerdict(said) ?? `${said[0].toUpperCase()}${said.slice(1)}` : verdicts.signed.fr,
  };
}

/**
 * Anglet's WebDev board lists each family's orders still posted on one page,
 * a plain GET (128 declarations, 74 building permits, 3 development and 5
 * demolition permits on 2026-10-02). No date is printed, and the PDFs are
 * session-bound actions of the page: the rows are the board's own, undated.
 */
const angletProtocol = {
  start(city) {
    return ANGLET_CATEGORIES.map((category) => ({
      url: new URL(`PageArretesMunicipaux.awp?P1=${category}&P2=Urbanisme`, city.page).href, as: 'html' }));
  },
  index(city, html) {
    const count = /name="_A13_OCC" value="(\d+)"/.exec(html)?.[1];
    if (count === undefined) return null;
    const rows = [];
    for (const [, description] of html.matchAll(/id="zrl_\d+_A18"[^>]*>([\s\S]*?)<\/td>/g)) {
      const read = angletDescription(description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' '), city);
      if (!read) continue;
      rows.push({ board: 'decisions', applicant: null, postcode: city.postcode, ...read });
    }
    return { rows };
  },
};

export const PAGE_BOARD_PROTOCOLS = Object.freeze({
  chalons: Object.freeze(chalonsProtocol),
  'saint-germain-en-laye': Object.freeze(sglProtocol),
  'boulogne-sur-mer': Object.freeze(boulogneProtocol),
  pantin: Object.freeze(pantinProtocol),
  anglet: Object.freeze(angletProtocol),
});
export const PAGE_BOARD_READERS = Object.freeze({
  'chalons-filings': readChalonsFiling,
  'chalons-decisions': readChalonsDecision,
  'sgl-decision': readSglDecision,
  'boulogne-filings': readBoulogneFiling,
  'boulogne-decisions': readScannedOrder,
  'pantin-filings': readPantinFiling,
  'pantin-decisions': readScannedOrder,
});
export const PAGE_BOARD_TEXT = Object.freeze({});
