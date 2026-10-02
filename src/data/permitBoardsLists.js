/**
 * Six cities that post their permits as lists: a PDF a week, or a table
 * replaced in place. Garges-lès-Gonesse, Le Blanc-Mesnil, Troyes, Bourges,
 * Cergy and Alès, read on 2026-10-02 (see `permitBoards.js` for the contract).
 *
 * TWO KINDS OF TABLE. Word and LibreOffice draw every cell under a clipping
 * rectangle, and the cells of one row share its top and bottom: Garges,
 * Troyes and Cergy are read cell by cell ({@link readCellTable}).
 * « Microsoft: Print To PDF » keeps no rectangle, and LibreOffice clips Alès's
 * to the page; both centre each cell on its row: Le Blanc-Mesnil, Bourges
 * and Alès are read line by line, each line given to
 * the nearest dossier number of its section ({@link readNearestTable}). Both
 * print one section per family — « Permis de construire (PC) » — over its own
 * header, several to a page; neither section title nor header is a cell.
 *
 * Applicants: only an organisation's name may be kept (`scrubPermitListRow`).
 * Alès prints the applicant's own address under the name and writes « IDEM »
 * in the site column when the works are at that address; that address is
 * then the site, and is the only part of the cell read.
 */
import { municipalDate, municipalDossier, municipalSite } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toUpperCase();
const ENTITIES = { amp: '&', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', eacute: 'é', egrave: 'è', agrave: 'à', ocirc: 'ô' }; // i18n-ignore-line — HTML entity names
const decode = (value) => String(value ?? '').replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (whole, name) => {
  if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  return ENTITIES[name.toLowerCase()] ?? whole;
});
const plain = (html) => clean(decode(String(html ?? '').replace(/<[^>]*>/g, ' ')));

/** Every `<a href>` of a page, resolved, with its words. */
function pageLinks(html, base) {
  const out = [];
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url;
    try { url = new URL(decode(match[1]).trim(), base); } catch { continue; }
    if (/^https?:$/.test(url.protocol)) out.push({ url: url.href, words: plain(match[2]) });
  }
  return out;
}

/** A day printed without its year (`25-09`): the latest such day not after `today`. */
export function dayWithoutYear(day, month, today) {
  const year = Number(String(today).slice(0, 4));
  for (const candidate of [year, year - 1]) {
    const iso = municipalDate(`${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${candidate}`);
    if (iso && iso <= today) return iso;
  }
  return null;
}

/** `BH 562 - 216 m²`, `AW0085`, `(DA 69 ; 70)`, `33 IO 132`: parcels, a section carried over. */
export function listParcelCell(value) {
  const out = [];
  let section = null;
  // i18n-ignore-next-line — the PLU note Bourges appends to its references
  const cell = clean(value).replace(/\(PLU\s*:.*$/i, '').replace(/[()]/g, ' ').replace(/-\s*[\d\s.,]+m(?:²|2)/gi, ' ');
  for (const piece of cell.split(/[;,/]|\s+-\s+|\bET\b/i)) {
    const match = /^(?:\d{2,3}\s+)?([A-Z]{1,2})?\s*0*(\d{1,4})$/i.exec(clean(piece));
    if (!match) continue;
    section = match[1]?.toUpperCase() ?? section;
    if (section) out.push(`${section} ${match[2]}`);
  }
  return out.length ? out.join(', ') : null;
}

// --- Tables drawn cell by cell ------------------------------------------------

/** A cell's runs as its lines, top to bottom, runs of one line joined. */
function runLines(runs) {
  const lines = [];
  for (const run of [...runs].sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - run.y) < 2) line.parts.push(run.text);
    else lines.push({ y: run.y, parts: [run.text] });
  }
  return lines.map((line) => clean(line.parts.join(' '))).filter(Boolean);
}

/** The columns a header row names, or null when a required one is missing. */
function cellHeader(band, columns) {
  const found = [];
  for (const [field, label, options] of columns) {
    const cell = band.find((item) => fold(item.text).startsWith(label));
    if (cell) found.push({ field, x0: cell.x0, x1: cell.x1 });
    else if (!options?.optional) return null;
  }
  return found;
}

/**
 * A table whose runs carry their cell's clipping rectangle (Word,
 * LibreOffice). Cells are the runs under one rectangle, rows the cells of one
 * height band; a header row is found by its columns' words (`startsWith`, so
 * `NUMERO D'ENREGISTRE MENT` is `NUMERO`), and a page without one keeps the
 * last. A data cell belongs to the column it overlaps most. A row spanning the
 * whole table (one cell) is a section title, handed to `spec.build`.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @param {{columns: Array<[string, string, {optional?: boolean}?]>,
 *   build: (cells: Record<string, Array<string>>, section: ?string) => ?object}} spec
 * @returns {Array<object>}
 */
export function readCellTable(document, spec) {
  const rows = [];
  let columns = null;
  let section = null;
  for (const page of document?.pages ?? []) {
    const cells = new Map();
    for (const run of page.runs ?? []) {
      if (!run.clip || !clean(run.text)) continue;
      const key = [run.clip.x0, run.clip.y0, run.clip.x1, run.clip.y1].map(Math.round).join(',');
      if (!cells.has(key)) cells.set(key, { ...run.clip, runs: [] });
      cells.get(key).runs.push(run);
    }
    const bands = new Map();
    for (const cell of cells.values()) {
      cell.lines = runLines(cell.runs);
      cell.text = cell.lines.join(' ');
      const key = `${Math.round(cell.y0)},${Math.round(cell.y1)}`;
      if (!bands.has(key)) bands.set(key, []);
      bands.get(key).push(cell);
    }
    for (const band of [...bands.values()].sort((a, b) => b[0].y1 - a[0].y1)) {
      const header = cellHeader(band, spec.columns);
      if (header) { columns = header; continue; }
      if (band.length === 1) { section = band[0].text; continue; }
      if (!columns) continue;
      const byField = {};
      for (const cell of band) {
        let best = null;
        let overlap = 0;
        for (const column of columns) {
          const shared = Math.min(cell.x1, column.x1) - Math.max(cell.x0, column.x0);
          if (shared > overlap) { overlap = shared; best = column; }
        }
        if (best) (byField[best.field] ??= []).push(...cell.lines);
      }
      const row = spec.build(byField, section);
      if (row) rows.push(row);
    }
  }
  return rows;
}

// --- Tables printed line by line ----------------------------------------------

/**
 * A table printed without cell rectangles, every cell centred on its row
 * (« Print To PDF »). Columns from the first header of the file — the column
 * positions do not move between sections — each placed by its first label
 * (the others are lines of the same header, never cells), by
 * `spec.columnRule`: `centre`,
 * the header centred nearest the line's centre; `right`, the first header
 * starting right of the line (left-aligned cells under centred headers);
 * `left`, the last header starting at or left of it. Sections by their title
 * (`spec.section`), which neither line of a header nor a title is part of.
 * Inside a section each line goes to the nearest dossier number within
 * `spec.reach` points; a line further from every number is the page's own.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @param {{columns: Array<[string, Array<string>]>, columnRule: 'centre'|'right'|'left',
 *   noise: RegExp, section: (text: string) => ?object, reach: number,
 *   anchor: (text: string) => ?string, build: (cells: Record<string, Array<string>>, section: ?object, dossier: string) => ?object}} spec
 * @returns {Array<object>}
 */
export function readNearestTable(document, spec) {
  const labels = new Set(spec.columns.flatMap(([, words]) => words));
  let header = null;
  for (const page of document?.pages ?? []) {
    const found = [];
    for (const [field, [words]] of spec.columns) {
      const run = (page.runs ?? []).find((item) => fold(item.text) === words);
      if (run) found.push({ field, x: run.x, centre: (run.x + (run.x1 ?? run.x)) / 2 });
    }
    if (found.length === spec.columns.length) { header = found.sort((a, b) => a.x - b.x); break; }
  }
  if (!header) return [];
  const columnOf = (run) => {
    if (spec.columnRule === 'right') return (header.find((column) => column.x > run.x + 0.5) ?? header.at(-1)).field;
    if (spec.columnRule === 'left') {
      let found = header[0];
      for (const column of header) if (column.x <= run.x + 5) found = column;
      return found.field;
    }
    const centre = (run.x + (run.x1 ?? run.x)) / 2;
    return header.reduce((best, column) => (Math.abs(column.centre - centre) < Math.abs(best.centre - centre) ? column : best)).field;
  };
  const rows = [];
  let section = null;
  for (const page of document?.pages ?? []) {
    const runs = [...(page.runs ?? [])].filter((run) => clean(run.text)).sort((a, b) => (b.y - a.y) || (a.x - b.x));
    // Bands: a section title opens one, carried over from the page before.
    const bands = [{ section, runs: [] }];
    for (const run of runs) {
      const title = spec.section(clean(run.text));
      if (title) { section = title; bands.push({ section, runs: [] }); continue; }
      if (labels.has(fold(run.text)) || spec.noise.test(clean(run.text))) continue;
      bands.at(-1).runs.push(run);
    }
    for (const band of bands) {
      const anchors = band.runs.filter((run) => columnOf(run) === 'dossier' && spec.anchor(run.text));
      const members = anchors.map(() => []);
      for (const run of band.runs) {
        let at = -1;
        for (let i = 0; i < anchors.length; i += 1) {
          if (Math.abs(anchors[i].y - run.y) <= spec.reach
            && (at < 0 || Math.abs(anchors[i].y - run.y) < Math.abs(anchors[at].y - run.y))) at = i;
        }
        if (at >= 0) members[at].push(run);
      }
      anchors.forEach((anchor, i) => {
        const cells = {};
        for (const run of members[i]) (cells[columnOf(run)] ??= []).push(run);
        const byField = Object.fromEntries(Object.entries(cells).map(([field, cellRuns]) => [field, runLines(cellRuns)]));
        const row = spec.build(byField, band.section, spec.anchor(anchor.text));
        if (row) rows.push(row);
      });
    }
  }
  return rows;
}

// --- Fields -------------------------------------------------------------------

const joined = (lines) => clean((lines ?? []).join(' ')) || null;
const area = (value) => /(\d[\d\s]*(?:[.,]\d+)?)/.exec(clean(value))?.[1]?.replace(/\s/g, '') ?? null;

// i18n-ignore-start — the words of the cities' own tables, matched on
/** A street line: a house number, or a street word first. */
const STREET_RE = /^(?:\d{1,4}\s*(?:bis|ter|[A-Z])?\b|(?:rue|avenue|av\.?|boulevard|bd|chemin|route|impasse|all[ée]e|place|quai|cours|square|mont[ée]e|lotissement|lieu[- ]dit|zone|zac|za|zi|r[ée]sidence|hameau|mas|domaine|faubourg)\b)/i;
/** An applicant cell's signatory line, never part of an address. */
const AGENT_RE = /^(?:repr[ée]sent[ée]e?s?\s+par|en la personne de|c\/o)\b/i;
/** A grid's verdict cell as its own words: `Accord`, `Rejet tacite`, `défavorable`. */
const VERDICT_WORDS = [
  [/^(?:accord|favorable)\b.*tacite|^tacite/i, () => verdicts.tacit.fr],
  [/^(?:non[- ]?opposition)/i, () => verdicts.unopposed.fr],
  [/^(?:accord|favorable|octroi|r[ée]alisable)/i, () => verdicts.granted.fr],
  [/^(?:refus|d[ée]favorable|opposition|rejet|non[- ]r[ée]alisable)/i, () => verdicts.refused.fr],
  [/^(?:annulation|retrait|retir[ée])/i, () => verdicts.withdrawn.fr],
];
// i18n-ignore-end

/**
 * A verdict cell, kept in the city's words where the ladder takes them
 * (« Favorable avec réserve », « Rejet tacite », « Sursis à statuer »).
 * `Rejet tacite` and `Rejet implicite` are refusals: a DP or a permit
 * refused for want of an answer within the time limit.
 */
export function listVerdict(value) {
  // Le Blanc-Mesnil types « Favoble avec prescription » now and then.
  // i18n-ignore-next-line — the city's own typing of « favorable »
  const words = clean(value).replace(/^favo\w*ble\b/i, 'Favorable');
  if (!words) return null;
  // i18n-ignore-next-line — the cities' own verdicts, matched on
  if (/^rejet\s+(?:tacite|implicite)/i.test(words)) return words;
  for (const [pattern, verdict] of VERDICT_WORDS) {
    if (pattern.test(words)) return /\b(?:prescriptions?|r[ée]serves?)\b/i.test(words) ? words : verdict(); // i18n-ignore-line — the cities' own qualifiers
  }
  return words;
}

/**
 * A verdict cell's lines, a word Word broke across two of them mended:
 * Cergy's narrow column prints `Renonciatio` / `n tacite`.
 */
export function verdictCell(lines) {
  const spaced = clean((lines ?? []).join(' '));
  const glued = clean(`${lines?.[0] ?? ''}${(lines ?? []).slice(1).join(' ')}`);
  // i18n-ignore-next-line — the stems of the cities' own verdicts
  const known = /^(?:renonciation|d[ée]favorable|favorable|accord|refus|opposition|annulation|irrecevab|retrait|rejet)/i;
  return !known.test(spaced) && known.test(glued) ? glued : spaced || null;
}

/** The first line of an applicant cell, cut before any person in brackets. */
function applicantName(lines) {
  return clean(String(lines?.[0] ?? '').replace(/\(.*$/, '')) || null;
}

/** A row with every field of the archive, those the city does not print null. */
function listRow(city, board, fields) {
  const site = municipalSite(fields.site, city);
  return {
    board, dossier: fields.dossier, label: null, purpose: fields.purpose ?? null,
    applicant: fields.applicant ?? null, address: site.address, postcode: site.postcode, locality: null,
    filedOn: fields.filedOn ?? null, verdict: fields.verdict ?? null, decidedOn: fields.decidedOn ?? null,
    postedOn: fields.postedOn ?? null, landArea: fields.landArea ?? null, housing: null, lots: null,
    floorArea: fields.floorArea ?? null, parcels: fields.parcels ?? site.parcels ?? null,
  };
}

// --- Garges-lès-Gonesse and Cergy: Operis's two grids --------------------------

// i18n-ignore-start — the column headers of the cities' grids
const GRID_FILING_COLUMNS = [
  ['filedOn', 'DATE DE DEPOT'], ['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'PETITIONNAIRE'],
  ['site', 'ADRESSE DU PROJET'], ['purpose', 'DESCRIPTION DU PROJET'],
];
const GRID_DECISION_COLUMNS = [
  ['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'PETITIONNAIRE'], ['verdict', 'DECISION'],
  ['decidedOn', 'DATE DE SIGNATURE'], ['purpose', 'NATURE DES TRAVAUX'], ['site', 'ADRESSE DES'],
  ['floorArea', 'SURFACE', { optional: true }],
];
// i18n-ignore-end

/**
 * The two grids Garges and Cergy print from the same software: « Dossiers
 * déposés au … » and « Dossiers décidés au … », one section per family. A
 * Cergy number runs over two lines (`PC 95127 25 U0034` / `M01`).
 */
function gridSpec(city, board) {
  return {
    columns: board === 'filings' ? GRID_FILING_COLUMNS : GRID_DECISION_COLUMNS,
    build: (cells) => {
      const dossier = municipalDossier(joined(cells.dossier), city);
      if (!dossier) return null;
      return listRow(city, board, {
        dossier, applicant: applicantName(cells.applicant), site: (cells.site ?? []).map((line) => line.replace(/,\s*$/, '')).join(', '),
        purpose: joined(cells.purpose), filedOn: municipalDate(joined(cells.filedOn)),
        verdict: board === 'decisions' ? listVerdict(verdictCell(cells.verdict)) ?? verdicts.signed.fr : null,
        decidedOn: board === 'decisions' ? municipalDate(joined(cells.decidedOn)) : null,
        floorArea: area(joined(cells.floorArea)),
      });
    },
  };
}

// --- Troyes: a weekly list of filings ----------------------------------------

// i18n-ignore-start — the column headers of Troyes's list
const TROYES_COLUMNS = [
  ['dossier', 'DOSSIER'], ['filedOn', 'DEPOT'], ['site', 'ADRESSE OPERATION'], ['parcels', 'PARCELLE'],
  ['landArea', 'SUPERFICIE'], ['applicant', 'DEMANDEUR'], ['nature', 'NATURE DES TRAVAUX'],
  ['purpose', 'DESCRIPTION DU PROJET'],
];
// i18n-ignore-end

function troyesSpec(city) {
  return {
    columns: TROYES_COLUMNS,
    build: (cells) => {
      const dossier = municipalDossier(joined(cells.dossier), city);
      if (!dossier) return null;
      return listRow(city, 'filings', {
        dossier, applicant: applicantName(cells.applicant), site: joined(cells.site)?.replace(/,\s*$/, ''),
        purpose: joined(cells.purpose) ?? joined(cells.nature), filedOn: municipalDate(joined(cells.filedOn)),
        parcels: listParcelCell(joined(cells.parcels)), landArea: area(joined(cells.landArea)),
      });
    },
  };
}

// --- Alès: weekly lists, the applicant's address standing for the site ------

// i18n-ignore-start — the column headers of Alès's lists
const ALES_COLUMNS = {
  filings: [
    ['dossier', ['NUMERO']], ['filedOn', ['DATE DE']], ['applicant', ['NOM ET ADRESSE']],
    ['site', ['ADRESSE DU PROJET']], ['purpose', ['NATURE DU PROJET']],
  ],
  decisions: [
    ['dossier', ['DOSSIER N°']], ['filedOn', ['DEPOT LE']], ['decidedOn', ['DECISION LE']],
    ['applicant', ['NOM ET ADRESSE DU DEMANDEUR']], ['purpose', ['NATURE DU PROJET']], ['site', ['ADRESSE DU PROJET']],
  ],
};
const ALES_NOISE = /^(?:d.enregistre|ment|d[ée]p[ôo]t|du demandeur|semaine \d+)$/i;
// i18n-ignore-end

/**
 * The street lines of an applicant cell — name first, a signatory perhaps,
 * then street, postcode and town. Only read when the site column says
 * « IDEM »: the works are at the applicant's address, which is then public
 * as the site of the works and as nothing else.
 */
export function alesIdemSite(lines) {
  const at = (lines ?? []).findIndex((line, i) => i > 0 && !AGENT_RE.test(line) && STREET_RE.test(line));
  if (at < 0) return null;
  const street = [];
  for (const line of lines.slice(at)) {
    street.push(line);
    if (/^\d{5}\b/.test(line)) break;
  }
  return street.join(', ');
}

/** A two-digit year (`25/09/26`) on four digits. */
const fullYear = (value) => value?.replace(/\b(\d{2})\/(\d{2})\/(\d{2})$/, '$1/$2/20$3');

/**
 * LibreOffice clips Alès's lists to the page, not to a cell: every cell is
 * centred on its row, read line by line.
 */
function alesSpec(city, board) {
  return {
    columns: ALES_COLUMNS[board],
    columnRule: 'centre',
    noise: ALES_NOISE,
    reach: 22,
    anchor: (value) => municipalDossier(value, city),
    section: () => null,
    build: (cells, section, dossier) => {
      const siteLines = cells.site ?? [];
      const parcels = listParcelCell(siteLines.filter((line) => /^\(.*\)$/.test(line)).join(' ; '));
      const named = siteLines.filter((line) => !/^\(.*\)$/.test(line));
      // i18n-ignore-next-line — Alès's own word for « the applicant's address »
      const site = named.length && !/^idem$/i.test(clean(named.join(' '))) ? named.join(', ') : alesIdemSite(cells.applicant);
      if (!site) return null;
      return listRow(city, board, {
        dossier, site, parcels, applicant: applicantName(cells.applicant), purpose: joined(cells.purpose),
        filedOn: municipalDate(fullYear(joined(cells.filedOn))),
        // The list is titled « autorisations accordées »: a grant, by the city's own word.
        verdict: board === 'decisions' ? verdicts.granted.fr : null,
        decidedOn: board === 'decisions' ? municipalDate(fullYear(joined(cells.decidedOn))) : null,
      });
    },
  };
}

// --- Le Blanc-Mesnil: two Print To PDF tables -------------------------------

// i18n-ignore-start — the column headers and section titles of the city's tables
const BLANC_MESNIL_COLUMNS = {
  filings: [
    ['dossier', ['N° DOSSIER']], ['filedOn', ['DEPOSE LE']], ['applicant', ['DEMANDEUR']],
    ['site', ['ADRESSE TERRAIN']], ['parcels', ['PARCELLES ET SURFACE']], ['purpose', ['PROJET']],
    ['postedOn', ['AFFICHEE']],
  ],
  decisions: [
    ['dossier', ['N° DOSSIER']], ['filedOn', ['DEPOSE LE']], ['applicant', ['DEMANDEUR']],
    ['site', ['ADRESSE TERRAIN']], ['parcels', ['PARCELLES ET SURFACE']], ['purpose', ['PROJET']],
    ['verdict', ['DECISION']], ['decidedOn', ['DATE DE']],
  ],
};
const BLANC_MESNIL_SECTION_RE = /^(?:d[ée]claration pr[ée]alable|permis de \S+|certificat d.urbanisme)\s*\((DP|PC|PA|PD|CU)\)(?:\s+affichage au\s+(\d{2}\/\d{2}\/\d{4}))?/i;
const BLANC_MESNIL_NOISE = /^(?:depuis le|d[ée]cision|affich[ée]e|page \d+|\d+\s*\/\s*\d+)$/i;
// i18n-ignore-end

function blancMesnilSpec(city, board) {
  return {
    columns: BLANC_MESNIL_COLUMNS[board],
    columnRule: 'centre',
    noise: BLANC_MESNIL_NOISE,
    reach: 16,
    // `@` marks a dossier filed online.
    anchor: (value) => municipalDossier(clean(value).replace(/^@/, ''), city),
    section: (value) => {
      const match = BLANC_MESNIL_SECTION_RE.exec(value);
      return match ? { kind: match[1].toUpperCase(), postedOn: municipalDate(match[2]) } : null;
    },
    build: (cells, section, dossier) => {
      const parcelCell = joined(cells.parcels);
      return listRow(city, board, {
        dossier, applicant: applicantName(cells.applicant), site: joined(cells.site),
        purpose: joined(cells.purpose), filedOn: municipalDate(joined(cells.filedOn)),
        parcels: listParcelCell(parcelCell), landArea: area(/-\s*([\d\s.,]+)\s*m/.exec(parcelCell ?? '')?.[1]),
        verdict: board === 'decisions' ? listVerdict(joined(cells.verdict)) ?? verdicts.signed.fr : null,
        decidedOn: board === 'decisions' ? municipalDate(joined(cells.decidedOn)) : null,
        postedOn: board === 'decisions' ? section?.postedOn ?? null : municipalDate(joined(cells.postedOn)),
      });
    },
  };
}

// --- Bourges: the ADS software's two registers ------------------------------

// i18n-ignore-start — the column headers and section titles of Bourges's registers
const BOURGES_COLUMNS = {
  // Left-aligned cells under centred headers; two or three labels a column.
  filings: [
    ['dossier', ['N° DE DOSSIER']], ['dates', ['D. DEPOT', 'COMPLETE', 'NOTIFIE']],
    // `Demandeur` over `Références cadastrales` (183): a run is in the first
    // column whose header starts right of it, so the column is the one at 253.
    ['applicant', ['DEMANDEUR', 'REFERENCES CADASTRALES ET PLU']],
    ['works', ['OBJETS DES TRAVAUX', 'ADRESSE DU TERRAIN']], ['surface', ['SURFACE']],
    ['shon', ['SHON']], ['land', ['SUPERF.']], ['nature', ['NATURE DE']], ['limit', ['D. DECISION']],
  ],
  decisions: [
    ['dossier', ['N° DE DOSSIER']], ['applicant', ['DEMANDEUR']], ['works', ['OBJET DES TRAVAUX', 'LIEUX DES TRAVAUX']],
    ['decidedOn', ['DATE DE LA DECISION']], ['postedOn', ['DATE AFFICHAGE DECISION']], ['down', ['RETIRE LE']],
    ['verdict', ['NATURE DE LA DECISION']],
  ],
};
const BOURGES_SECTION_RE = /^(?:autorisation erp|certificat d.urbanisme|d[ée]claration pr[ée]alable|permis d.am[ée]nager|permis de construire|permis de d[ée]molir|autorisation de travaux)\b/i;
const BOURGES_NOISE = /^(?:\d{2}\s*-\s*BOURGES|registre (?:des dossiers ads|d.affichage de la d[ée]cision)|nature de|la|d[ée]cision|plancher|# hab\.|d[ée]lai|d\. limite|nb logts|hauteur|shob|page \d+.*)$/i;
// i18n-ignore-end

/**
 * Bourges's register of filings prints the applicant's name, the
 * applicant's own address and the parcel in one column, the site's address
 * over the works in another: only the parcel (`33 IO 132`, the commune's
 * cadastral prefix first) and the site's first line are read from them.
 */
function bourgesSpec(city, board) {
  return {
    columns: BOURGES_COLUMNS[board],
    columnRule: board === 'filings' ? 'right' : 'left',
    noise: BOURGES_NOISE,
    reach: board === 'filings' ? 36 : 24,
    anchor: (value) => municipalDossier(value, city),
    section: (value) => (BOURGES_SECTION_RE.test(value) ? { title: value } : null),
    build: (cells, section, dossier) => {
      if (board === 'filings') {
        const [site, ...works] = cells.works ?? [];
        const dates = (cells.dates ?? []).map((line) => municipalDate(line)).filter(Boolean);
        return listRow(city, board, {
          dossier, site, purpose: clean(works.join(' ')) || null, applicant: applicantName(cells.applicant),
          parcels: listParcelCell((cells.applicant ?? []).find((line) => /^\d{2}\s+[A-Z]{1,2}\s+\d{1,4}\b/.test(line))),
          filedOn: dates[0] ?? null,
        });
      }
      // i18n-ignore-next-line — the register's own dash before the site
      const site = (cells.works ?? []).find((line) => /^-\s+/.test(line));
      const siteAt = (cells.works ?? []).indexOf(site);
      return listRow(city, board, {
        dossier, site: site ? clean([site, ...(cells.works ?? []).slice(siteAt + 1).filter((line) => !/^[A-Z' -]+$/.test(line))].join(' ').replace(/^-\s+/, '')) : null,
        purpose: clean((cells.works ?? []).filter((line) => line !== site && /^[A-Z0-9'’ ,.()/-]+$/.test(line)).join(' ')) || null,
        applicant: applicantName(cells.applicant),
        verdict: listVerdict(joined(cells.verdict)) ?? verdicts.signed.fr,
        decidedOn: municipalDate(joined(cells.decidedOn)), postedOn: municipalDate(joined(cells.postedOn)),
      });
    },
  };
}

// --- Readers -----------------------------------------------------------------

const cityOf = (context) => context?.city;

export const LIST_BOARD_READERS = Object.freeze({
  'grid-filings': (document, context) => readCellTable(document, gridSpec(cityOf(context), 'filings')),
  'grid-decisions': (document, context) => readCellTable(document, gridSpec(cityOf(context), 'decisions')),
  troyes: (document, context) => readCellTable(document, troyesSpec(cityOf(context))),
  'ales-filings': (document, context) => readNearestTable(document, alesSpec(cityOf(context), 'filings')),
  'ales-decisions': (document, context) => readNearestTable(document, alesSpec(cityOf(context), 'decisions')),
  'blanc-mesnil-filings': (document, context) => readNearestTable(document, blancMesnilSpec(cityOf(context), 'filings')),
  'blanc-mesnil-decisions': (document, context) => readNearestTable(document, blancMesnilSpec(cityOf(context), 'decisions')),
  'bourges-filings': (document, context) => readNearestTable(document, bourgesSpec(cityOf(context), 'filings')),
  'bourges-decisions': (document, context) => readNearestTable(document, bourgesSpec(cityOf(context), 'decisions')),
});

export const LIST_BOARD_TEXT = Object.freeze({});

// --- Protocols ---------------------------------------------------------------

const htmlPage = (city) => [{ url: city.page, as: 'html' }];

/**
 * Garges and Le Blanc-Mesnil replace two tables in place, under a file name
 * that carries the update's day (`tableau_affichage_depot_01.10.2026.pdf`,
 * `dds_-_tableau_affichage_-_depot_-_25-09.pdf`): a new name is a new
 * edition, read once. Both tables or none: a page without one is not read.
 */
function rollingTables(pattern, layouts, dayOf) {
  return {
    start: htmlPage,
    index: (city, html, request, { day }) => {
      const files = [];
      for (const board of ['filings', 'decisions']) {
        const link = pageLinks(html, request.url).find((item) => pattern[board].test(decodeURIComponent(new URL(item.url).pathname)));
        if (!link) return null;
        files.push({ url: link.url, board, layout: layouts[board], published: dayOf(link.url, day) });
      }
      return { files };
    },
  };
}

// i18n-ignore-start — the cities' own file names and titles, matched on
const GARGES = rollingTables(
  { filings: /tableau_affichage_depot_[\d.]+\.pdf$/i, decisions: /tableau_affichage_decision_[\d.]+\.pdf$/i },
  { filings: 'grid-filings', decisions: 'grid-decisions' },
  (url) => municipalDate(/_(\d{2})\.(\d{2})\.(\d{4})\.pdf$/i.exec(url)?.slice(1).join('/')),
);
const BLANC_MESNIL = rollingTables(
  { filings: /dds_-_tableau_affichage_-_depot_-_[\d-]+\.pdf$/i, decisions: /dds_-_tableau_affichage_-_decision_-_[\d-]+\.pdf$/i },
  { filings: 'blanc-mesnil-filings', decisions: 'blanc-mesnil-decisions' },
  (url, day) => {
    const match = /_-_(\d{2})-(\d{2})\.pdf$/i.exec(url);
    return match ? dayWithoutYear(match[1], match[2], day) : null;
  },
);

/** Troyes links a file a week, `37-DOSSIERS_ADS_AU_26_SEPT_2026.pdf`; signs' lists apart. */
const TROYES = {
  start: htmlPage,
  index: (city, html, request) => {
    const files = pageLinks(html, request.url).flatMap((link) => {
      const name = decodeURIComponent(new URL(link.url).pathname.split('/').pop());
      if (!/\.pdf$/i.test(name) || !/DOSSIERS[_-](?:ADS[_-]AU|D.?AUTORISATIONS)/i.test(name) || /ENSEIGNE/i.test(name)) return [];
      const published = municipalDate(name.replace(/[_-]+/g, ' ').replace(/\bSEPT\b/i, 'sep'))
        ?? municipalDate(`01/${/\/(\d{4})\/(\d{2})\//.exec(link.url)?.slice(1).reverse().join('/')}`);
      return [{ url: link.url, board: 'filings', layout: 'troyes', published }];
    });
    return files.length ? { files } : null;
  },
};

/**
 * Bourges's document portal lists every act, oldest first, fifty a page; a
 * filter by theme lives in a session the reading does not keep. So the first
 * page says how many there are, and the reading walks back from the last
 * until a page holds nothing posted since the window opened.
 */
const BOURGES = {
  start: (city) => [{ url: city.page, as: 'html' }],
  index: (city, html, request, { since }) => {
    const pager = /Affichage page\s+(\d+)\s*\/\s*(\d+)/i.exec(html);
    if (!pager) return null;
    const [current, last] = [Number(pager[1]), Number(pager[2])];
    const files = [];
    let oldest = null;
    for (const match of String(html).matchAll(/<tr>\s*((?:<td>[\s\S]*?<\/td>\s*){7})<\/tr>/gi)) {
      const cells = [...match[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
      const [, theme, subject, , posted] = cells.map(plain);
      const href = /href="([^"]+\/download\/\d+)"/.exec(cells[6])?.[1];
      const published = municipalDate(posted);
      if (published && (!oldest || published < oldest)) oldest = published;
      if (!href || !/^urbanisme$/i.test(theme)) continue;
      const board = /liste des d[ée]p[ôo]ts/i.test(subject) ? 'filings' : /liste des d[ée]cisions/i.test(subject) ? 'decisions' : null;
      if (!board || !/droit des sols/i.test(subject)) continue;
      files.push({ url: new URL(href, request.url).href, board, layout: `bourges-${board}`, published });
    }
    const next = current === 1 && last > 1 ? last : current > 1 && (!oldest || oldest >= since) ? current - 1 : null;
    return { files, next: next && next !== 1 ? [{ url: new URL(`/tmp_diffusion_document/index/p=${next}`, city.page).href, as: 'html' }] : [] };
  },
};

/**
 * Cergy posts on A2Display: the category « Publications relatives à
 * l'Urbanisme » (10016) as JSON, newest first, two files a week —
 * « Affichage dépôt du 24-09-2026 » and « Affichage décision du … ». The 100
 * newest reached back to August 2025 on 2026-10-02.
 */
const CERGY_BOARD = '7JTBO0t24L6o8LHEahRkbluhcQStGXNed6DZA1qv8dxpIDXiYVs7CTFwZYiWnfjm';
const CERGY = {
  start: () => [{ url: `https://api.a2display.fr/cvv/documents/${CERGY_BOARD}?l=100&s=creationDatetime&d=desc&fc=10016&fo=true&fa=true`, as: 'json' }],
  index: (city, json) => {
    const items = json?.data?.items;
    if (!Array.isArray(items)) return null;
    const files = items.flatMap((item) => {
      const match = /^Affichage (d[ée]p[ôo]t|d[ée]cision)s? du (\d{2})-(\d{2})-(\d{4})/i.exec(clean(item?.name));
      const file = item?.file?.name;
      if (!match || !/^[\w.-]+\.pdf$/i.test(file ?? '')) return [];
      const board = /^d[ée]p/i.test(match[1]) ? 'filings' : 'decisions';
      return [{ url: `https://api.a2display.fr/file?filename=${encodeURIComponent(file)}`, board,
        layout: `grid-${board}`, published: municipalDate(`${match[2]}/${match[3]}/${match[4]}`) }];
    });
    return { files };
  },
};

/**
 * Alès posts a WordPress article a week per list, each embedding one PDF:
 * categories « au-depots » (12) and « au-accords » (13), about ten articles
 * each, the lists' two-month posting period.
 */
const ALES_CATEGORIES = { 12: 'filings', 13: 'decisions' };
const ALES = {
  start: (city) => [{ url: new URL('/wp-json/wp/v2/posts?categories=12,13&per_page=100&_fields=date,categories,content', city.page).href, as: 'json' }],
  index: (city, json, request) => {
    if (!Array.isArray(json)) return null;
    const files = json.flatMap((post) => {
      const board = (post?.categories ?? []).map((id) => ALES_CATEGORIES[id]).find(Boolean);
      const href = /href="([^"]+\/wp-content\/uploads\/[^"]+\.pdf)"/i.exec(post?.content?.rendered ?? '')?.[1];
      if (!board || !href) return [];
      return [{ url: new URL(decode(href), request.url).href, board, layout: `ales-${board}`, published: municipalDate(String(post.date ?? '').slice(0, 10)) }];
    });
    return { files };
  },
};
// i18n-ignore-end

export const LIST_BOARD_PROTOCOLS = Object.freeze({
  garges: GARGES, 'blanc-mesnil': BLANC_MESNIL, troyes: TROYES, bourges: BOURGES, cergy: CERGY, ales: ALES,
});

