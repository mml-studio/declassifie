/**
 * Boards a city posts as lists its instruction software prints — Cart@DS or
 * BIRT « Liste des avis de dépôt / des décisions » reports, Word or Excel
 * tables of filings and decisions — refreshed in place or posted under a new
 * name every week or month. Valence, Arles, Décines-Charpieu, Saint-Cloud,
 * Tassin-la-Demi-Lune, Saint-Genis-Laval, Sceaux and Pertuis, read on
 * 2026-10-02. See `permitBoards.js` for the contract.
 *
 * ONE READER FOR SEVEN LAYOUTS ({@link readReportTable}). Every one of these
 * tables prints a row per dossier under a header naming its columns, and
 * either CENTRES each cell on its row (Cart@DS's Aspose report, BIRT, Calc and
 * Excel exports: a three-line site beside a one-line date, both centred on the
 * same height) or hangs each cell from the row's top (Pertuis's Word table).
 * Centred rows are read cell by cell: a column's lines fall into blocks —
 * lines closer than a line and a half — and each block goes to the dossier
 * whose centre it spans. Neither a run of lines nor the nearest line will
 * do: a BIRT description of twenty lines starts nearer the row above than its
 * own number (Saint-Genis-Laval, 12 March 2026). Saint-Cloud's Word tables
 * clip every cell to its row, and are read by `readCellTable`.
 *
 * Applicants: most cells name private people (« Monsieur … », a bare name).
 * Only an organisation is kept, cut at the first civility or bracket: one
 * line of its own where a cell stacks names (a bare name over `EDF solutions
 * solaires` at Pertuis), a whole wrapped cell only when its first line is
 * already one. It still goes through `scrubPermitListRow`.
 */
import { municipalDate, municipalDossier, municipalSite } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';
import { listParcelCell, listVerdict, readCellTable, verdictCell } from './permitBoardsLists.js';
import { organisationApplicant } from './permitApplicant.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toUpperCase();
const ENTITIES = { amp: '&', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', eacute: 'é', egrave: 'è', agrave: 'à', ocirc: 'ô' }; // i18n-ignore-line — HTML entity names
const decode = (value) => String(value ?? '').replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (whole, name) => {
  if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  return ENTITIES[name.toLowerCase()] ?? whole;
});
const plain = (html) => clean(decode(String(html ?? '').replace(/<[^>]*>/g, ' ')));
const joined = (lines) => clean((lines ?? []).join(' ')) || null;
const area = (value) => /(\d[\d\s]*(?:[.,]\d+)?)/.exec(clean(value))?.[1]?.replace(/\s/g, '') ?? null;

/** Every `<a href>` of a page, resolved, with its words and its decoded path. */
function pageLinks(html, base) {
  const out = [];
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url;
    try { url = new URL(decode(match[1]).trim(), base); } catch { continue; }
    if (!/^https?:$/.test(url.protocol)) continue;
    let name = url.pathname;
    try { name = decodeURIComponent(url.pathname); } catch { /* a stray % keeps the raw path */ }
    out.push({ url: url.href, words: plain(match[2]), name, query: url.search });
  }
  return out;
}

// --- The reader ------------------------------------------------------------

/** A run's right edge: its glyphs' advances, or a guess where the font has none. */
const rightOf = (run) => (Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x + 0.5 * (run.size || 7) * clean(run.text).length);

/**
 * A page's header: each column's label found, in page order, each run used
 * once — Pertuis prints `Date de` over both its filing and its signing day.
 */
function reportHeader(runs, columns) {
  const used = new Set();
  const found = [];
  for (const [field, label, options] of columns) {
    const run = runs.filter((item) => !used.has(item) && fold(item.text) === label).sort((a, b) => a.x - b.x)[0];
    if (!run) {
      if (options?.optional) continue;
      return null;
    }
    used.add(run);
    found.push({ field, x: run.x, centre: (run.x + rightOf(run)) / 2, y: run.y });
  }
  return { bottom: Math.min(...found.map((column) => column.y)), columns: found.sort((a, b) => a.x - b.x) };
}

/**
 * A header read off the rows, for a table whose header is typed anew each
 * month (Sceaux: `Adresse`, `DOSSIERADRESSE`, `DOSSIER ADRESSE`; on one line
 * or four; `Décision` or `Dernière décision - Avis de l'autorité compétente`):
 * where each of `spec.derive`'s cells starts, the median over the rows that
 * print all of them on their number's line. Everything printed above the
 * first row but its own wrapped lines is the header.
 */
function rowHeader(runs, spec) {
  const anchors = runs.filter((run) => spec.head.test(clean(run.text)) && spec.anchor(run.text));
  if (!anchors.length) return null;
  const starts = spec.derive.map(() => []);
  for (const anchor of anchors) {
    const line = runs.filter((run) => Math.abs(run.y - anchor.y) < 1.5).sort((a, b) => a.x - b.x);
    if (line.length === spec.derive.length && line[0] === anchor) line.forEach((run, i) => starts[i].push(run.x));
  }
  if (!starts[0].length) return null;
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const first = anchors.reduce((top, run) => (run.y > top.y ? run : top));
  return {
    bottom: first.y + 1.2 * (first.size || 7) + 0.5,
    columns: spec.derive.map((field, i) => ({ field, x: median(starts[i]), centre: median(starts[i]) })),
  };
}

/**
 * The column of a run: `nearest`, the header that starts nearest where the
 * run starts (left-aligned cells, headers left-aligned or not); `centre`, the
 * header centred nearest the run's centre (cells and headers both centred);
 * `right`, the first header starting right of the run, or nearly (left-aligned
 * cells under centred headers, every cell starting left of its header).
 */
function columnOf(run, header, rule) {
  // Pertuis's second page sets its headers 6 points left of the first's.
  if (rule === 'right') return (header.columns.find((column) => column.x > run.x - 3) ?? header.columns.at(-1)).field;
  const at = rule === 'centre' ? (run.x + rightOf(run)) / 2 : run.x;
  let best = header.columns[0];
  for (const column of header.columns) {
    const key = rule === 'centre' ? column.centre : column.x;
    if (Math.abs(key - at) < Math.abs((rule === 'centre' ? best.centre : best.x) - at)) best = column;
  }
  return best.field;
}

/** Runs on one height, joined left to right, as lines top to bottom. */
function textLines(runs) {
  const lines = [];
  for (const run of [...runs].sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - run.y) < 1.5) line.runs.push(run);
    else lines.push({ y: run.y, size: run.size || 7, runs: [run] });
  }
  return lines.map((line) => ({ y: line.y, size: line.size, text: clean(line.runs.sort((a, b) => a.x - b.x).map((run) => run.text).join(' ')) }));
}

/**
 * The rows of one band — the stretch of a page between two section titles —
 * and what lies above its first row: `{anchors, before}`, `before` a map of
 * field to lines.
 *
 * `centre`: each column's lines fall into blocks, and a block goes to the
 * dossier centred nearest among those whose centre it spans — a cell centred
 * on its row spans the row's centre, whatever its height. `top`: lines go to
 * the last dossier at or above them.
 */
function bandRows(band, header, spec) {
  const byField = new Map();
  for (const run of band.runs) {
    const field = spec.field?.(run) ?? columnOf(run, header, spec.rule);
    if (!byField.has(field)) byField.set(field, []);
    byField.get(field).push(run);
  }
  const startsNumber = (text) => spec.head.test(text);
  const dossierLines = textLines(byField.get('dossier') ?? []);
  const anchors = [];
  const before = {};
  const keep = (anchor, field, lines) => {
    const into = anchor ? anchor.cells : before;
    (into[field] ??= []).push(...lines);
  };
  if (spec.place === 'top') {
    dossierLines.forEach((line, i) => {
      if (!startsNumber(line.text)) return;
      const tail = [];
      for (const next of dossierLines.slice(i + 1)) {
        if (startsNumber(next.text) || line.y - next.y > 3 * line.size) break;
        tail.push(next.text);
      }
      anchors.push({ dossier: spec.anchor([line.text, ...tail].join(' ')), top: line.y + 0.6 * line.size, section: band.section, cells: {} });
    });
    for (const [field, runs] of byField) {
      for (const line of textLines(runs)) {
        const anchor = anchors.findLast((item) => line.y <= item.top) ?? null;
        keep(anchor, field, [line.text]);
      }
    }
  } else {
    const blocksOf = (field, lines) => {
      const blocks = [];
      for (const line of lines) {
        const block = blocks.at(-1);
        const last = block?.lines.at(-1);
        if (block && last.y - line.y <= spec.gap * line.size && !(field === 'dossier' && startsNumber(line.text))) block.lines.push(line);
        else blocks.push({ field, lines: [line] });
      }
      for (const block of blocks) {
        block.top = block.lines[0].y + 0.8 * block.lines[0].size;
        block.bottom = block.lines.at(-1).y - 0.8 * block.lines.at(-1).size;
        block.centre = (block.lines[0].y + block.lines.at(-1).y) / 2;
      }
      return blocks;
    };
    const others = [];
    for (const block of blocksOf('dossier', dossierLines)) {
      const dossier = spec.anchor(block.lines.map((line) => line.text).join(' '));
      if (dossier || startsNumber(block.lines[0].text)) {
        anchors.push({ dossier, centre: block.centre, section: band.section, cells: { dossier: block.lines.map((line) => line.text) } });
      } else others.push(block);
    }
    for (const [field, runs] of byField) if (field !== 'dossier') others.push(...blocksOf(field, textLines(runs)));
    const first = anchors[0];
    const nearest = (block, spans) => {
      let best = null;
      for (const anchor of anchors) {
        if (spans ? anchor.centre > block.top || anchor.centre < block.bottom
          : Math.abs(anchor.centre - block.centre) > 2.5 * block.lines[0].size) continue;
        if (!best || Math.abs(anchor.centre - block.centre) < Math.abs(best.centre - block.centre)) best = anchor;
      }
      return best;
    };
    for (const block of others) {
      // A line a little off its row's centre — Calc spreads a two-line cell
      // over a taller row (Arles's first quarter of 2026) — spans none.
      const best = nearest(block, true) ?? (block.lines.length === 1 ? nearest(block, false) : null);
      // Above the band's first row, a block that spans no row's centre is
      // the end of a row the page before broke off.
      if (best || !first || block.bottom > first.centre) keep(best, block.field, block.lines.map((line) => line.text));
    }
  }
  return { anchors, before };
}

/**
 * A table of one row per dossier under a header of labelled columns.
 *
 * The header's labels (`spec.columns`, folded, each column's first line) are
 * looked for on every page and the last found is kept; any line of a header
 * (`spec.extra` names the second lines) is never a cell, nor `spec.noise`,
 * nor anything printed above the page's first header — titles, the edition's
 * date — save a section title (`spec.section`), which starts a band of its
 * own and is handed to `spec.build` with every row under it. A row the page
 * breaks keeps what the next page prints of it above its first row.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @param {{columns?: Array<[string, string, {optional?: boolean}?]>, derive?: Array<string>, extra?: Array<string>,
 *   rule: 'nearest'|'centre'|'right', place: 'centre'|'top', gap?: number,
 *   head: RegExp, anchor: (text: string) => ?string, section?: (text: string) => ?object,
 *   field?: (run: object) => ?string, noise?: RegExp, build: (cells: Record<string, Array<string>>, section: ?object, dossier: string) => ?object}} spec
 * @returns {Array<object>}
 */
export function readReportTable(document, spec) {
  const labels = new Set([...(spec.columns ?? []).map(([, label]) => label), ...(spec.extra ?? [])]);
  const anchors = [];
  let header = null;
  let section = null;
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text)).sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const found = spec.derive ? rowHeader(runs, spec) : reportHeader(runs, spec.columns);
    if (found) header = found;
    if (!header) continue;
    const above = found ? found.bottom - 0.5 : Infinity;
    const bands = [{ section, runs: [], titled: false }];
    for (const run of runs) {
      const words = clean(run.text);
      const title = spec.section?.(words) ?? null;
      if (title) { section = title; bands.push({ section, runs: [], titled: true }); continue; }
      if (run.y > above || labels.has(fold(words)) || spec.noise?.test(words)) continue;
      bands.at(-1).runs.push(run);
    }
    bands.forEach((band, i) => {
      if (!band.runs.length) return;
      const read = bandRows(band, header, spec);
      // Only the page's first band, untitled, can carry on the last page's row.
      const open = i === 0 && !band.titled ? anchors.at(-1) : null;
      if (open) for (const [field, lines] of Object.entries(read.before)) (open.cells[field] ??= []).push(...lines);
      anchors.push(...read.anchors);
    });
  }
  // A number that is no building permit's (Arles's sign `DP 013004 26 R002`)
  // still holds its row's cells, which no neighbour may take.
  return anchors.filter((anchor) => anchor.dossier)
    .map((anchor) => spec.build(anchor.cells, anchor.section, anchor.dossier)).filter(Boolean);
}

// --- Fields ------------------------------------------------------------------

// i18n-ignore-start — civilities and the words of the cities' own tables, matched on
/** A civility: where a person's name starts inside an applicant's line. */
const CIVILITY_RE = /(?:^|[\s,;(/-])(?:m|mme|mlle|mr|monsieur|madame|mademoiselle)\b\.?(?:\s|$)/i;
/** A number's first line, family and commune: `DP 026 362 24`, `AT 84089`. */
const HEAD_RE = /^(?:PC|DP|PA|PD|CU|AT|AP)\s*\d/;
// i18n-ignore-end

/**
 * The organisation an applicant cell names, or null, cut before the first
 * civility or bracket. `wrapped`: the cell is ONE name the column wraps
 * (Cart@DS's `SYNDIC DE` / `COPROPRIETE LES` / `TILLEULS`), read whole —
 * and only when its first line already reads as an organisation, so that no
 * person named before a company comes with it. Otherwise each line is a name
 * of its own — a person's over a company's at Arles and Pertuis — and the
 * first line that reads as an organisation is kept, never two joined.
 */
export function reportApplicant(lines, { wrapped = false } = {}) {
  const cut = (line) => clean(String(line).replace(/\(.*$/, '').split(CIVILITY_RE)[0]).replace(/[\s,;:-]+$/, '');
  if (wrapped) {
    const whole = cut((lines ?? []).join(' '));
    return organisationApplicant(cut(lines?.[0] ?? '')) && organisationApplicant(whole) ? whole : null;
  }
  for (const line of lines ?? []) {
    const name = cut(line);
    if (name && organisationApplicant(name)) return name;
  }
  return null;
}

/** `23/9/2026`, `28/06/26`: a day with its parts padded and its century added. */
export function paddedDay(value) {
  const match = /\b(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/.exec(String(value ?? ''));
  if (!match) return municipalDate(value);
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return municipalDate(`${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${year}`);
}

/**
 * A number as Sitadel keys it. Saint-Cloud and Tassin print the counter on
 * six digits (`DP 92064 26 000199`) and Saint-Cloud a bare `M1`: the counter
 * goes on five, the modification on two.
 */
export function reportDossier(value, city) {
  const text = clean(value)
    .replace(/\b(\d{2})\s+0(\d{5})(?!\d)/, '$1 $2')
    .replace(/\b([MT])\s*(\d)(?!\d)/, '$1 0$2');
  return municipalDossier(text, city)?.replace(/ ([MT]) ?(\d{2})$/, ' $1$2') ?? null;
}

/** A row with every field of the archive, those the city does not print null. */
function reportRow(city, board, fields) {
  const site = municipalSite(fields.site, city);
  return {
    board, dossier: fields.dossier, label: null, purpose: fields.purpose ?? null,
    applicant: fields.applicant ?? null, address: site.address, postcode: site.postcode, locality: null,
    filedOn: fields.filedOn ?? null, verdict: fields.verdict ?? null, decidedOn: fields.decidedOn ?? null,
    postedOn: fields.postedOn ?? null, landArea: fields.landArea ?? null, housing: fields.housing ?? null, lots: null,
    floorArea: fields.floorArea ?? null, parcels: fields.parcels ?? site.parcels ?? null,
  };
}

// --- Cart@DS's Aspose report: Valence, Décines-Charpieu ----------------------

// i18n-ignore-start — the report's own headers, page titles and labels
const CARTDS_COLUMNS = {
  filings: [
    ['dossier', 'N° DE DOSSIER'], ['filedOn', 'DATE DEPOT'], ['applicant', 'DEMANDEUR'], ['site', 'LIEUX DES TRAVAUX'],
    ['land', 'SUPERFICIE'], ['nature', 'NATURE DES TRAVAUX'], ['project', 'PROJET'],
  ],
  decisions: [
    ['dossier', 'N° DE DOSSIER'], ['filedOn', 'DATE DEPOT'], ['applicant', 'DEMANDEUR'], ['site', 'LIEUX DES'],
    ['land', 'SUPERFICIE'], ['nature', 'NATURE DES TRAVAUX'], ['project', 'PROJET'], ['verdict', 'DECISION'],
  ],
};
const CARTDS_EXTRA = ["DATE D'AFFICHAGE", 'TRAVAUX'];
const CARTDS_NOISE = /^\d+\s*\/\s*\d+$/;
const FLOOR_RE = /surface (?:de )?plancher cr[ée]{2}e\s*:\s*([\d\s.,]+)\s*m/i;
// i18n-ignore-end

/**
 * Cart@DS prints its two reports from the same template, a family to a page
 * and a row per dossier: the number over the day it was posted, the site with
 * its postcode and parcels in brackets (`20 RUE EXEMPLE 26000 (BI 1040)`),
 * the decision and its day in one cell (`Favorable tacite le 10/09/2026`).
 * Valence's lists of 28 September 2026: 145 filings, 152 decisions.
 */
function cartdsSpec(city, board) {
  return {
    columns: CARTDS_COLUMNS[board], extra: CARTDS_EXTRA, rule: 'nearest', place: 'centre', gap: 1.6,
    head: HEAD_RE, noise: CARTDS_NOISE, anchor: (text) => reportDossier(text, city),
    build: (cells, section, dossier) => {
      const days = (cells.dossier ?? []).map(paddedDay).filter(Boolean);
      const decision = joined(cells.verdict);
      const said = /^(.*?)\s+le\s+(\d{2}\/\d{2}\/\d{4})$/i.exec(decision ?? ''); // i18n-ignore-line — the report's own « le »
      return reportRow(city, board, {
        dossier, site: joined(cells.site), applicant: reportApplicant(cells.applicant, { wrapped: true }),
        purpose: joined(cells.nature), filedOn: paddedDay(joined(cells.filedOn)), postedOn: days.at(-1) ?? null,
        landArea: area(joined(cells.land)), floorArea: area(FLOOR_RE.exec(joined(cells.project) ?? '')?.[1]),
        verdict: board === 'decisions' ? listVerdict(said ? said[1] : decision) ?? verdicts.signed.fr : null,
        decidedOn: board === 'decisions' ? municipalDate(said?.[2]) : null,
      });
    },
  };
}

// --- Arles: quarterly Calc sheets, a section a week ---------------------------

// i18n-ignore-start — the column headers and titles of Arles's sheets
const ARLES_COLUMNS = {
  filings: [
    ['filedOn', 'DATE DE DEPOT'], ['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'PETITIONNAIRE'],
    ['site', 'ADRESSE DU PROJET'], ['purpose', 'DESCRIPTION DU PROJET'],
  ],
  decisions: [
    ['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'PETITIONNAIRE'], ['verdict', 'DECISION'],
    ['decidedOn', 'DATE DE SIGNATURE'], ['purpose', 'NATURE DES TRAVAUX'], ['site', 'ADRESSE DU PROJET'], ['floor', 'SURFACE'],
  ],
};
const ARLES_WEEK_RE = /^Dossiers (?:d[ée]pos[ée]s|d[ée]livr[ée]s) du /i;
const ARLES_FAMILY_RE = /^(?:D[ÉE]CLARATION PR[ÉE]ALABLE|PERMIS DE (?:CONSTRUIRE|D[ÉE]MOLIR)|PERMIS D'AM[ÉE]NAGER|CERTIFICAT D'URBANISME|AUTORISATION PR[ÉE]ALABLE|AUTORISATION DE TRAVAUX)S?$/i;
const ARLES_NOISE = /^(?:Feuille\d*|Page \d+)$/i;
// i18n-ignore-end

/**
 * Arles's sheets print a week to a section (`Dossiers déposés du 14 au 20
 * septembre 2026`) and a family under it, every cell centred both ways. The
 * third quarter of 2026: 210 filings and 219 decisions to 20 September; the
 * five editions back to 2025, 2 699 rows.
 */
function arlesSpec(city, board) {
  return {
    columns: ARLES_COLUMNS[board], rule: 'centre', place: 'centre', gap: 1.6,
    head: HEAD_RE, noise: ARLES_NOISE, anchor: (text) => reportDossier(text, city),
    section: (text) => (ARLES_WEEK_RE.test(text) || ARLES_FAMILY_RE.test(text) ? { title: text } : null),
    build: (cells, section, dossier) => reportRow(city, board, {
      dossier, site: joined(cells.site), applicant: reportApplicant(cells.applicant), purpose: joined(cells.purpose),
      filedOn: board === 'filings' ? paddedDay(joined(cells.filedOn)) : null,
      verdict: board === 'decisions' ? listVerdict(verdictCell(cells.verdict)) ?? verdicts.signed.fr : null,
      decidedOn: board === 'decisions' ? paddedDay(joined(cells.decidedOn)) : null,
      floorArea: area(joined(cells.floor)),
    }),
  };
}

// --- Saint-Genis-Laval: BIRT's two reports -------------------------------------

// i18n-ignore-start — the column headers of the reports
const SGL_COLUMNS = {
  filings: [
    ['dossier', 'N° DE DOSSIER'], ['postedOn', 'DATE'], ['applicant', 'DEMANDEUR'], ['site', 'LIEU DES TRAVAUX'],
    ['parcels', 'REF.'], ['purpose', 'OBJET DES TRAVAUX'], ['land', 'SUPERFICIE'], ['floor', 'SURFACE'],
    ['filedOn', 'DATE DEPOT'],
  ],
  decisions: [
    ['dossier', 'NOM DE DOSSIER'], ['postedOn', "DATE D'AFFICHAGE"], ['applicant', 'DEMANDEUR'],
    ['site', 'ADRESSE DES TRAVAUX'], ['purpose', 'DESCRIPTION DES TRAVAUX'], ['land', 'SURFACE DU'],
    ['floor', 'SURFACE DE'], ['housing', 'NB DE'], ['verdict', 'DECISION'],
  ],
};
const SGL_EXTRA = ["D'AFFICHAGE", 'CADASTRALES', 'DU', 'TERRAIN', 'PLANCHER', 'LOGEMENTS'];
const SGL_FAMILY_RE = /^(?:D[ée]claration pr[ée]alable|Permis de (?:construire|d[ée]molir)|Permis d'am[ée]nager|Certificat d'urbanisme)s?$/i;
const SGL_NOISE = /^(?:PC|DP|PA|PD|CU)$|^Page \d+|^\d+\s*\/\s*\d+$/i;
// i18n-ignore-end

/**
 * BIRT left-aligns each cell under a header that is not (`Demandeur` 40
 * points right of its names), centres the row on its tallest cell, and
 * prints days in words (`8 nov. 2024`). Its fonts carry no widths: a column
 * is the header starting nearest the run. The editions of 24 September 2026:
 * 61 filings, 79 decisions.
 */
function sglSpec(city, board) {
  return {
    columns: SGL_COLUMNS[board], extra: SGL_EXTRA, rule: 'nearest', place: 'centre', gap: 1.6,
    head: HEAD_RE, noise: SGL_NOISE, anchor: (text) => reportDossier(text, city),
    section: (text) => (SGL_FAMILY_RE.test(text) ? { title: text } : null),
    build: (cells, section, dossier) => {
      const verdictLines = (cells.verdict ?? []).filter((line) => !municipalDate(line));
      const decidedOn = (cells.verdict ?? []).map((line) => municipalDate(line)).find(Boolean) ?? null;
      return reportRow(city, board, {
        dossier, site: joined(cells.site), applicant: reportApplicant(cells.applicant, { wrapped: true }), purpose: joined(cells.purpose),
        parcels: listParcelCell(joined(cells.parcels)), filedOn: municipalDate(joined(cells.filedOn)),
        postedOn: paddedDay(joined(cells.postedOn)), landArea: area(joined(cells.land)), floorArea: area(joined(cells.floor)),
        housing: board === 'decisions' ? area(joined(cells.housing)) : null,
        verdict: board === 'decisions' ? listVerdict(joined(verdictLines)) ?? verdicts.signed.fr : null,
        decidedOn: board === 'decisions' ? decidedOn : null,
      });
    },
  };
}

// --- Sceaux: a month of decisions --------------------------------------------

/**
 * Sceaux types a table a month, « Dossiers décidés en septembre 2026 », and
 * its header anew each time — eleven spellings in twelve months — but always
 * the same five cells, left to right: number, site, works, verdict, signing
 * day. The columns are read off the rows (`spec.derive`). Its rows sit as
 * close as a cell's lines: each line goes to the row it is centred on. The
 * twelve tables to September 2026: 196 decisions, 6 to 25 a month.
 */
function sceauxSpec(city) {
  return {
    derive: ['dossier', 'site', 'purpose', 'verdict', 'decidedOn'], rule: 'nearest', place: 'centre', gap: 0,
    head: HEAD_RE, noise: /^Page \d+/i, anchor: (text) => reportDossier(text, city), // i18n-ignore-line — the footer's word
    build: (cells, section, dossier) => reportRow(city, 'decisions', {
      dossier, site: joined(cells.site), purpose: joined(cells.purpose),
      verdict: listVerdict(joined(cells.verdict)) ?? verdicts.signed.fr, decidedOn: paddedDay(joined(cells.decidedOn)),
    }),
  };
}

// --- Pertuis: two Word tables ------------------------------------------------

// i18n-ignore-start — the column headers of Pertuis's tables
const PERTUIS_COLUMNS = {
  filings: [
    ['filedOn', 'DATE DE'], ['dossier', 'NUMERO'], ['applicant', 'PETITIONNAIRE'], ['site', 'ADRESSE DU PROJET'],
    ['parcels', 'REFERENCE'], ['purpose', 'DESCRIPTION DU PROJET'],
  ],
  decisions: [
    ['dossier', 'NUMERO'], ['filedOn', 'DATE DE'], ['applicant', 'PETITIONNAIRE'], ['verdict', 'DECISION'],
    ['decidedOn', 'DATE DE'], ['purpose', 'NATURE DES TRAVAUX'], ['site', 'ADRESSE DES TRAVAUX'],
    ['parcels', 'REFERENCE'], ['floor', 'SURFACE'],
  ],
};
const PERTUIS_EXTRA = ['DEPOT', 'DE DOSSIER', 'CADASTRALE', 'DE', 'DOSSIER', 'SIGNATURE'];
const PERTUIS_FAMILY_RE = /^(?:AUTORISATION|D[ÉE]CLARATION PR[ÉE]ALABLE|PERMIS DE|PERMIS D'|CERTIFICAT D'URBANISME)/i;
// i18n-ignore-end

/**
 * Pertuis hangs every cell from its row's top and wraps the number
 * (`DP 84089` / `26 H0230`); a family's title runs across the table. The
 * tables of 29 September 2026: 78 filings and 83 decisions, two months each.
 */
function pertuisSpec(city, board) {
  return {
    columns: PERTUIS_COLUMNS[board], extra: PERTUIS_EXTRA, rule: 'right', place: 'top',
    head: HEAD_RE, noise: /^Page \d+/i, anchor: (text) => reportDossier(text, city), // i18n-ignore-line — the footer's word
    section: (text) => (PERTUIS_FAMILY_RE.test(text) && text.length > 20 ? { title: text } : null),
    build: (cells, section, dossier) => reportRow(city, board, {
      dossier, site: (cells.site ?? []).join(' '), applicant: reportApplicant(cells.applicant), purpose: joined(cells.purpose),
      parcels: listParcelCell(joined(cells.parcels)), filedOn: paddedDay(joined(cells.filedOn)),
      verdict: board === 'decisions' ? listVerdict(verdictCell(cells.verdict)) ?? verdicts.signed.fr : null,
      decidedOn: board === 'decisions' ? paddedDay(joined(cells.decidedOn)) : null,
      floorArea: area(joined(cells.floor)),
    }),
  };
}

// --- Tassin-la-Demi-Lune: one table a family, filed and decided --------------

// i18n-ignore-start — the column headers, titles and verdicts of Tassin's tables
const TASSIN_COLUMNS = [
  ['dossier', 'N°DOSSIER'], ['filedOn', 'DATE DEPOT'], ['applicant', 'DEMANDEUR'], ['purpose', 'NAT. PROJET'],
  ['site', 'ADRESS. PROJET'], ['decidedOn', 'DATE DELIV.'],
  ['postedOn', "DATE D'AFFICHAGE"], ['shown', "DATES D'AFFICHAGE DE LA"],
];
const TASSIN_EXTRA = ['DE LA DEMANDE', 'DECISION'];
const TASSIN_SECTION_RE = /D[ÉE]POS[ÉE]E?S\s*\/\s*D[ÉE]LIVR[ÉE]E?S/i;
const TASSIN_PENDING_RE = /^en cours d'instruction$/i;
const TASSIN_VERDICT_RE = /^(?:non[- ]opposition|accord(?: tacite)?|refus|opposition|rejet tacite|en cours d'instruction|annul\w*|retrait|op[ée]ration (?:non[- ])?r[ée]alisable|sursis [àa] statuer|d[ée]favorable|favorable.*)$/i;
// i18n-ignore-end

/**
 * Tassin keeps one table per family, every dossier of the year on it with
 * its decision, or « en cours d'instruction » while it has none: a row is a
 * decision once it has one. The table of declarations prints no header over
 * its decisions: a verdict is known by its words, wherever it falls. The
 * three tables of 28 September 2026: 72 dossiers.
 */
function tassinSpec(city) {
  return {
    columns: TASSIN_COLUMNS, extra: TASSIN_EXTRA, rule: 'centre', place: 'centre', gap: 1.6,
    head: HEAD_RE, noise: /^(?:\d{4}|\d+\s*\/\s*\d+|mise [àa] jour le .*)$/i, anchor: (text) => reportDossier(text, city), // i18n-ignore-line — the sheet's own banner
    section: (text) => (TASSIN_SECTION_RE.test(text) ? { title: text } : null),
    // Under no header in the table of declarations: a verdict by its words.
    field: (run) => (TASSIN_VERDICT_RE.test(clean(run.text)) ? 'verdict' : null),
    build: (cells, section, dossier) => {
      const verdict = joined(cells.verdict);
      const decided = verdict && !TASSIN_PENDING_RE.test(verdict);
      const board = decided ? 'decisions' : 'filings';
      return reportRow(city, board, {
        dossier, site: joined(cells.site), applicant: reportApplicant(cells.applicant, { wrapped: true }), purpose: joined(cells.purpose),
        filedOn: paddedDay(joined(cells.filedOn)),
        verdict: decided ? listVerdict(verdict) ?? verdicts.signed.fr : null,
        decidedOn: decided ? paddedDay(joined(cells.decidedOn)) : null,
        postedOn: decided ? paddedDay(joined(cells.shown)) : null,
      });
    },
  };
}

// --- Saint-Cloud: four Word tables, cells clipped to their row ---------------

// i18n-ignore-start — the column headers of Saint-Cloud's tables
const SAINT_CLOUD_COLUMNS = {
  filings: [['filedOn', 'DATE DE DEPOT'], ['dossier', 'NUMERO DE DOSSIER'], ['site', 'ADRESSE DU PROJET'], ['purpose', 'DESCRIPTION DU PROJET']],
  decisions: [['dossier', 'NUMERO DE DOSSIER'], ['verdict', 'DECISION'], ['decidedOn', 'DATE DE'], ['purpose', 'NATURE DES TRAVAUX'], ['site', 'ADRESSE DES TRAVAUX']],
};
// i18n-ignore-end

/**
 * Saint-Cloud's « Bilan au 25 septembre 2026 »: the dossiers under review
 * (52 declarations, 21 permits) and those decided in the last two months
 * (47 and 11). No applicant is printed.
 */
function saintCloudSpec(city, board) {
  return {
    columns: SAINT_CLOUD_COLUMNS[board],
    build: (cells) => {
      const dossier = reportDossier(joined(cells.dossier), city);
      if (!dossier) return null;
      return reportRow(city, board, {
        dossier, site: joined(cells.site), purpose: joined(cells.purpose), filedOn: paddedDay(joined(cells.filedOn)),
        verdict: board === 'decisions' ? listVerdict(verdictCell(cells.verdict)) ?? verdicts.signed.fr : null,
        decidedOn: board === 'decisions' ? paddedDay(joined(cells.decidedOn)) : null,
      });
    },
  };
}

// --- Readers -----------------------------------------------------------------

const cityOf = (context) => context?.city;

export const REPORT_BOARD_READERS = Object.freeze({
  'cartds-report-filings': (document, context) => readReportTable(document, cartdsSpec(cityOf(context), 'filings')),
  'cartds-report-decisions': (document, context) => readReportTable(document, cartdsSpec(cityOf(context), 'decisions')),
  'arles-filings': (document, context) => readReportTable(document, arlesSpec(cityOf(context), 'filings')),
  'arles-decisions': (document, context) => readReportTable(document, arlesSpec(cityOf(context), 'decisions')),
  'birt-filings': (document, context) => readReportTable(document, sglSpec(cityOf(context), 'filings')),
  'birt-decisions': (document, context) => readReportTable(document, sglSpec(cityOf(context), 'decisions')),
  sceaux: (document, context) => readReportTable(document, sceauxSpec(cityOf(context))),
  'pertuis-filings': (document, context) => readReportTable(document, pertuisSpec(cityOf(context), 'filings')),
  'pertuis-decisions': (document, context) => readReportTable(document, pertuisSpec(cityOf(context), 'decisions')),
  tassin: (document, context) => readReportTable(document, tassinSpec(cityOf(context))),
  'saint-cloud-filings': (document, context) => readCellTable(document, saintCloudSpec(cityOf(context), 'filings')),
  'saint-cloud-decisions': (document, context) => readCellTable(document, saintCloudSpec(cityOf(context), 'decisions')),
});

export const REPORT_BOARD_TEXT = Object.freeze({});

// --- Protocols ---------------------------------------------------------------

const htmlPage = (city) => [{ url: city.page, as: 'html' }];

/**
 * A page that links one file per board, both or none: a page without one is
 * not the board (`patterns` test the decoded path, or the link's words).
 */
function pairedFiles(patterns, layouts, extra = () => ({})) {
  return {
    start: htmlPage,
    index: (city, html, request, { day }) => {
      const links = pageLinks(html, request.url);
      const files = [];
      for (const board of ['filings', 'decisions']) {
        const link = links.find((item) => patterns[board].test(item.name) || patterns[board].test(item.words));
        if (!link) return null;
        files.push({ url: link.url, board, layout: layouts[board], ...extra(link, day) });
      }
      return { files };
    },
  };
}

// i18n-ignore-start — the cities' own file names and link words, matched on
/** The upload month of a WordPress or Drupal file (`/2026/09/`, `/2026-10/`): its first day. */
const uploadMonth = (url) => {
  const match = /\/(20\d{2})[/-](\d{2})\//.exec(url);
  return match ? `${match[1]}-${match[2]}-01` : null;
};

/** Valence posts each edition under its day: `Liste-des-avis-de-depot-28_09_2026.pdf`. */
const VALENCE = pairedFiles(
  { filings: /\/Liste-des-avis-de-depot-\d{2}_\d{2}_\d{4}\.pdf$/i, decisions: /\/Liste-des-decisions-\d{2}_\d{2}_\d{4}\.pdf$/i },
  { filings: 'cartds-report-filings', decisions: 'cartds-report-decisions' },
  (link) => ({ published: municipalDate(/-(\d{2})_(\d{2})_(\d{4})\.pdf$/i.exec(link.name)?.slice(1).join('/')) }),
);

/** Décines regenerates two files in place, under the same address: `rolling`. */
const DECINES = pairedFiles(
  { filings: /^Liste des avis de d[ée]p[ôo]ts?$/i, decisions: /^Liste des d[ée]cisions$/i },
  { filings: 'cartds-report-filings', decisions: 'cartds-report-decisions' },
  () => ({ rolling: true }),
);

/** Saint-Genis-Laval: `liste_des_avis_de_depot_24_09_26.pdf`, `liste_des_decisions_24_09_26.pdf`. */
const SAINT_GENIS_LAVAL = pairedFiles(
  { filings: /\/liste_des_avis_de_depot_\d{2}_\d{2}_\d{2}\.pdf$/i, decisions: /\/liste_des_decisions_\d{2}_\d{2}_\d{2}\.pdf$/i },
  { filings: 'birt-filings', decisions: 'birt-decisions' },
  (link) => ({ published: paddedDay(/_(\d{2})_(\d{2})_(\d{2})\.pdf$/i.exec(link.name)?.slice(1).join('/')) }),
);

/** Pertuis: `DEPOT 29-09-26.pdf` and `DECISION 29-09-26.pdf`. */
const PERTUIS = pairedFiles(
  { filings: /\/DEPOT \d{2}-\d{2}-\d{2}\.pdf$/i, decisions: /\/DECISION \d{2}-\d{2}-\d{2}\.pdf$/i },
  { filings: 'pertuis-filings', decisions: 'pertuis-decisions' },
  (link) => ({ published: paddedDay(/ (\d{2})-(\d{2})-(\d{2})\.pdf$/i.exec(link.name)?.slice(1).join('/')) }),
);

/**
 * Arles posts a cumulative sheet a quarter per board, on two pages, and
 * uploads it again under a new suffix (`depot-2026-3eme-tri-1.pdf`) as the
 * weeks are added: a new address is a new edition, the upload month its day.
 */
const ARLES_PAGES = {
  filings: 'laffichage-des-depots-durbanisme/',
  decisions: 'laffichage-des-decisions-durbanisme/',
};
const ARLES = {
  start: (city) => Object.values(ARLES_PAGES).map((tail) => ({ url: new URL(`../${tail}`, city.page).href, as: 'html' })),
  index: (city, html, request) => {
    const board = request.url.includes(ARLES_PAGES.decisions) ? 'decisions' : 'filings';
    const pattern = board === 'filings' ? /\/app\/uploads\/.*d[ée]p[ôo]ts?[^/]*\.pdf$/i : /\/app\/uploads\/.*d[ée]cisions?[^/]*\.pdf$/i;
    const files = pageLinks(html, request.url).filter((link) => pattern.test(link.name))
      .map((link) => ({ url: link.url, board, layout: `arles-${board}`, published: uploadMonth(link.url) }));
    return files.length ? { files } : null;
  },
};

/**
 * Saint-Cloud links four Word tables whose names change at each refresh
 * (`PC Decisions_131.pdf`, `DP Instruction_129.pdf`): permits and
 * declarations, decided or under review. A page without them is not the board.
 */
const SAINT_CLOUD = {
  start: htmlPage,
  index: (city, html, request) => {
    const files = pageLinks(html, request.url).flatMap((link) => {
      const match = /\/(?:PC|DP) (Decisions|Instruction)_\d+\.pdf$/i.exec(link.name);
      if (!match) return [];
      const board = /^Decisions$/i.test(match[1]) ? 'decisions' : 'filings';
      return [{ url: link.url, board, layout: `saint-cloud-${board}` }];
    });
    return files.some((file) => file.board === 'filings') && files.some((file) => file.board === 'decisions') ? { files } : null;
  },
};

/**
 * Tassin links one table per family, `DP SUIVI DEPOT - AFFICHAGE AU
 * 28-09-2026.pdf`, renamed at each edition (every few weeks).
 */
const TASSIN = {
  start: htmlPage,
  index: (city, html, request) => {
    const files = pageLinks(html, request.url).flatMap((link) => {
      const match = /\/[A-Z-]+ SUIVI DEPOT - AFFICHAGE AU (\d{2})-(\d{2})-(\d{4})\.pdf$/i.exec(link.name);
      return match ? [{ url: link.url, board: 'filings', layout: 'tassin', published: municipalDate(match.slice(1).join('/')) }] : [];
    });
    return files.length ? { files } : null;
  },
};

/**
 * Sceaux links a table a month, « Dossiers décidés en septembre 2026 », under
 * names it writes by hand (`9-septembre-2026.pdf`, `12.-decembre-2025.pdf`,
 * `liste-des-decisions-juillet.pdf`); the upload month is its day.
 */
const SCEAUX_MONTHS = 'janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre';
const SCEAUX_FILE_RE = new RegExp(`/(?:\\d{1,2}\\.?-|liste-des-decisions-)(?:\\d{1,2}-)?(?:${SCEAUX_MONTHS})(?:-\\d{4})?\\.pdf$`, 'i');
const SCEAUX = {
  start: htmlPage,
  index: (city, html, request) => {
    const files = pageLinks(html, request.url).flatMap((link) => {
      const name = link.name.normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (!SCEAUX_FILE_RE.test(name) || new URL(link.url).origin !== new URL(city.page).origin) return [];
      const year = /-(\d{4})\.pdf$/.exec(name)?.[1] ?? /\/(20\d{2})\//.exec(name)?.[1];
      return [{ url: link.url, board: 'decisions', layout: 'sceaux', published: uploadMonth(link.url) ?? (year ? `${year}-01-01` : null) }];
    });
    return files.length ? { files } : null;
  },
};
// i18n-ignore-end

export const REPORT_BOARD_PROTOCOLS = Object.freeze({
  valence: VALENCE, arles: ARLES, 'decines-charpieu': DECINES, 'saint-cloud': SAINT_CLOUD, 'tassin-la-demi-lune': TASSIN,
  'saint-genis-laval': SAINT_GENIS_LAVAL, sceaux: SCEAUX, pertuis: PERTUIS,
});
