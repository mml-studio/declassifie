/**
 * PDF readers for the lists communes print from their own instruction
 * software and post on their site, read by `wp-media` or `posted-lists`
 * (`permitBoardsPostedLists.js`) with the commune's own `lists` patterns and
 * `layouts`. See `permitBoards.js` for the contract.
 *
 * Applicants: never a person. Every list here prints the applicant in a
 * column of its own; a reader takes the columns it names and keeps an
 * organisation at most.
 */
import { paddedDay, readReportTable, reportApplicant, reportDossier } from './permitBoardsReports.js';
import { municipalSite } from './municipalPermitsFeed.js';
import { DIGILOR_C_BOARD_READERS } from './permitBoardsDigilorC.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const joined = (lines) => clean((lines ?? []).join(' ')) || null;

// i18n-ignore-start — the lists' own headers and family titles
/** A number's first line: `DP 29150 26 00111`, `PC 017347`. */
const HEAD_RE = /^(?:PC|DP|PA|PD|CU|AT|AP)\s*\d/;
const FAMILY_RE = /^(?:D[ÉE]CLARATION PR[ÉE]ALABLE|PERMIS (?:DE|D'|D’)|AUTORISATION (?:PR[ÉE]ALABLE|DE TRAVAUX)|CERTIFICAT D|SUPPORTANT DE LA PUBLICIT)/i;
const NOISE_RE = /^(?:Page \d+ sur \d+|\d+\s*\/\s*\d+)$/i;
const DAY_RE = /^\d{2}\/\d{2}\/\d{4}$/;
/** « Numéro de dossier » on one line, or « Numéro de » over « dossier ». */
const FILED_BEFORE_COLUMNS = [
  ['filedOn', 'DATE DE DEPOT'], ['dossier', 'NUMERO DE DOSSIER', { optional: true }], ['dossier', 'NUMERO DE', { optional: true }],
  ['applicant', 'PETITIONNAIRE'], ['site', 'ADRESSE DU PROJET'], ['purpose', 'DESCRIPTION DU PROJET'],
];
// i18n-ignore-end

/**
 * Where each column's cells start, read off the rows themselves: the median x
 * of each run over the lines that print all `fields` and open with
 * `first` (a filing day). Headers are set over their column in each
 * town's own way — Moëlan's left of its cells, Saint-Jean-d'Angély's centred
 * right of them — and a name must never land in the site's column.
 */
function dataColumns(document, fields, first) {
  const starts = fields.map(() => []);
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    for (const run of runs.filter((item) => first.test(clean(item.text)))) {
      const line = runs.filter((item) => Math.abs(item.y - run.y) < 1.5).sort((a, b) => a.x - b.x);
      if (line.length === fields.length && line[0] === run) line.forEach((item, i) => starts[i].push(item.x));
    }
  }
  if (starts.some((xs) => !xs.length)) return null;
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const columns = starts.map(median);
  return (run) => {
    let best = 0;
    columns.forEach((x, i) => { if (Math.abs(x - run.x) < Math.abs(columns[best] - run.x)) best = i; });
    return fields[best];
  };
}

function row(city, board, fields) {
  const site = municipalSite(fields.site, city);
  return {
    board, dossier: fields.dossier, applicant: fields.applicant ?? null, address: site.address, postcode: site.postcode,
    parcels: site.parcels, purpose: fields.purpose ?? null, filedOn: fields.filedOn ?? null,
    verdict: fields.verdict ?? null, decidedOn: fields.decidedOn ?? null, postedOn: fields.postedOn ?? null,
  };
}

/**
 * « Dossiers déposés avant le 23 septembre 2026 », under « VILLE DE … /
 * URBANISME »: every dossier still under instruction, a family to a section
 * and a row per dossier under Date de dépôt | Numéro de dossier |
 * Pétitionnaire | Adresse du projet | Description du projet, each cell
 * hanging from the row's top, the street over the postcode and town. Moëlan-
 * sur-Mer posts it every month or so (ten pages on 23 September 2026), and
 * its decisions as « Dossiers décidés jusqu'au … », which
 * `digilor-pontdeclaix-decisions` reads; Saint-Jean-d'Angély posts a
 * one-row edition per avis de dépôt. Columns are where the rows' cells start
 * ({@link dataColumns}): a list with no full row is read as none.
 */
export function readFiledBeforeList(document, { city, file }) {
  const field = dataColumns(document, ['filedOn', 'dossier', 'applicant', 'site', 'purpose'], DAY_RE);
  if (!field) return [];
  return readReportTable(document, {
    columns: FILED_BEFORE_COLUMNS, rule: 'nearest', field, place: 'top', head: HEAD_RE, noise: NOISE_RE,
    anchor: (text) => reportDossier(text, city),
    section: (text) => (FAMILY_RE.test(text) ? { title: text } : null),
    build: (cells, section, dossier) => row(city, 'filings', {
      dossier, site: joined(cells.site), applicant: reportApplicant(cells.applicant),
      purpose: joined(cells.purpose), filedOn: paddedDay(joined(cells.filedOn)), postedOn: file?.published ?? null,
    }),
  });
}

/**
 * « Dossiers décidés jusqu'au … », the same software's decisions: Le
 * Pont-de-Claix's columns (`digilor-pontdeclaix-decisions`). A site whose
 * street cell is empty prints the postcode and town alone (Moëlan's
 * « 29350 Moëlan-sur-Mer »): no site, rather than the town's centre.
 */
export function readDecidedUntilList(document, context) {
  return DIGILOR_C_BOARD_READERS['digilor-pontdeclaix-decisions'](document, context)
    .map((item) => (/^\d{5}\b/.test(item.address ?? '') ? { ...item, address: null } : item));
}

export const TOWN_LIST_READERS = Object.freeze({
  'town-filed-before': readFiledBeforeList,
  'town-decided-until': readDecidedUntilList,
});
export const TOWN_LIST_TEXT = Object.freeze({});
