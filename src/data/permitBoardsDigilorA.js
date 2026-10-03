/**
 * PDF readers for the Digilor Datahall towns of batch A (`digilorTownsA.js`),
 * by `layout`. See `permitBoards.js` for the contract.
 *
 * Applicants: never a person. Le Mans prints the applicant's name (and, on
 * its decisions, the applicant's own address) in a column of its own, and
 * Reims names the applicant and whoever represents them above the site:
 * the readers take an organisation's name off the first line at most, through
 * `organisationApplicant`, and never read the applicant's address.
 */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';
import { listVerdict } from './permitBoardsLists.js';
import { reportApplicant } from './permitBoardsReports.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toUpperCase();
const area = (value) => /(\d[\d\s]*(?:[.,]\d+)?)/.exec(clean(value))?.[1]?.replace(/\s/g, '') ?? null;

/** Runs on one height, joined left to right, as lines top to bottom. */
function textLines(runs, tolerance = 1.5) {
  const lines = [];
  for (const run of [...runs].sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - run.y) < tolerance) line.runs.push(run);
    else lines.push({ y: run.y, size: run.size || 8, runs: [run] });
  }
  return lines.map((line) => ({ y: line.y, size: line.size, x: Math.min(...line.runs.map((run) => run.x)),
    text: clean(line.runs.sort((a, b) => a.x - b.x).map((run) => run.text).join(' ')) }));
}

// --- Le Mans: the weekly lists the town hall posts --------------------------

// i18n-ignore-start — the lists' own headers and labels, matched on
const LE_MANS_HEADER = [
  ['dossier', /^DOSSIER\b/], ['site', /^ADRESSE DU PROJET$/], ['applicant', /^NOM\b/],
  ['purpose', /^DESCRIPTION DU PROJET$/], ['size', /^DIMENSIONS$/],
];
const LE_MANS_FILED_RE = /D[ée]pos[ée]e? le\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i;
const LE_MANS_DECISION_RE = /^D[ée]cision\s*:\s*(.*?)(?:\s+le\s+(\d{2}\/\d{2}\/\d{4}))?$/i;
const LE_MANS_TAIL_RE = /^(?:D[ée]pos[ée]e? le\b|Comp[ée]tence\s*:|D[ée]cision\s*:)/i;
const LE_MANS_TITLE_RE = /^(?:Permis de construire, D[ée]clarations|D[ée]cisions concernant les)\b/i;
const LE_MANS_POSTED_RE = /liste affich[ée]e le\s*(\d{2}\/\d{2}\/\d{4})|Document publi[ée] le\s*(\d{2}\/\d{2}\/\d{4})/i;
// i18n-ignore-end

/** The page's header: each column's label and where its cells start. */
function leMansHeader(runs) {
  const found = [];
  for (const [field, pattern] of LE_MANS_HEADER) {
    const run = runs.find((item) => pattern.test(fold(item.text)));
    if (!run) return null;
    found.push({ field, x: run.x, y: run.y });
  }
  // Cells are left-aligned and headers centred: a column runs from halfway
  // between its header and the one before it.
  const columns = found.map((column, i) => ({ field: column.field, from: i ? (found[i - 1].x + column.x) / 2 : -Infinity }));
  return { y: Math.min(...found.map((column) => column.y)), columns };
}

/**
 * Le Mans's weekly lists (« Affichage Mairie Dépôt », « Affichage Mairie
 * Décision - PC / DP / PA »), printed by its instruction software in
 * landscape: a row per dossier under DOSSIER (*) | ADRESSE DU PROJET | NOM |
 * DESCRIPTION DU PROJET | DIMENSIONS. Every cell hangs from its row's top but
 * the decisions' number, which is centred on the row, so a row is cut where
 * the site column starts a new block. The filings print « Déposé le » under
 * the number; the decisions under the description, with « Décision :
 * Favorable le 22/09/2026 » — which a long description pushes off the row, the
 * verdict then left as a signed decision. Measured on 2026-10-02: the filings
 * of 18-25 September 2026 give 37 rows, the decisions of 19-25 September 4 DP
 * and the PC list 5, every row with its site.
 */
export function readLeMansList(document, { city, file }) {
  const board = file?.board === 'decisions' ? 'decisions' : 'filings';
  const rows = [];
  // The decisions print the day they were posted in their header, the filings
  // on their first page only, in Digilor's stamp.
  const posted = LE_MANS_POSTED_RE.exec((document?.pages ?? []).flatMap((page) => textLines(page.runs ?? [])).map((line) => line.text).join('\n'));
  const postedOn = municipalDate(posted?.[1] ?? posted?.[2]) ?? file?.published ?? null;
  let header = null;
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text) && !LE_MANS_TITLE_RE.test(clean(run.text)));
    // The filings print the header on the first page only.
    const found = leMansHeader(runs);
    header = found ?? (header && { ...header, y: Infinity });
    if (!header) continue;
    const cells = new Map(header.columns.map((column) => [column.field, []]));
    for (const run of runs) {
      // The page's footer (`(*) PC : Permis de Construire…`) sits under 30.
      if (run.y >= header.y - 1 || run.y < 30) continue;
      const column = header.columns.findLast((item) => run.x >= item.from);
      cells.get(column.field).push(run);
    }
    const siteLines = textLines(cells.get('site'));
    const tops = siteLines.filter((line, i) => i === 0 || siteLines[i - 1].y - line.y > 1.8 * line.size).map((line) => line.y);
    tops.forEach((top, i) => {
      const bottom = tops[i + 1] ?? -Infinity;
      const inRow = (field) => textLines(cells.get(field).filter((run) => run.y <= top + 2 && run.y > bottom + 2)).map((line) => line.text);
      const dossierLines = inRow('dossier');
      const dossier = municipalDossier(dossierLines.filter((line) => !LE_MANS_FILED_RE.test(line)).join(' '), city);
      if (!dossier) return;
      const described = inRow('purpose');
      const tail = described.findIndex((line) => LE_MANS_TAIL_RE.test(line));
      const purpose = clean((tail < 0 ? described : described.slice(0, tail)).join(' ').replace(/_/g, ' ')) || null;
      const decision = described.map((line) => LE_MANS_DECISION_RE.exec(line)).find(Boolean);
      const size = inRow('size').join('\n');
      const site = municipalSite(inRow('site').join(' '), city);
      rows.push({
        board, dossier, applicant: reportApplicant(inRow('applicant').slice(0, 1)),
        address: site.address, postcode: site.postcode, parcels: site.parcels, purpose,
        filedOn: municipalDate(LE_MANS_FILED_RE.exec([...dossierLines, ...described].join('\n'))?.[1]),
        landArea: area(/Surface terrain\s*:\s*([\d\s]+)m/i.exec(size)?.[1]), // i18n-ignore-line — the list's own label
        floorArea: area(/Surface de plancher\s*:\s*([\d\s]+)m/i.exec(size)?.[1]), // i18n-ignore-line — the list's own label
        postedOn,
        verdict: board === 'decisions' ? listVerdict(decision?.[1]) ?? verdicts.signed.fr : null,
        decidedOn: board === 'decisions' ? municipalDate(decision?.[2]) : null,
      });
    });
  }
  return rows;
}

// --- Reims: one order per PDF -------------------------------------------------

// i18n-ignore-start — the orders' own labels and operative words, matched on
const REIMS_SITE_RE = /^Sur un terrain sis [àa]\s*:?$/i;
const REIMS_PURPOSE_RE = /^Pour\s*:?$/i;
const REIMS_OPERATIVE_RE = /\bARTICLE\s+(?:1(?:ER)?|UNIQUE)\b\s*:?([\s\S]*?)(?=\bARTICLE\s+\d|\bFait [àa]\b|$)/i;
const REIMS_ORDER_RE = /\b(?:EST|SONT)\s+(ACCORDEE?S?|REFUSEE?S?|RETIREE?S?)\b|\bN'EST PAS FAIT OPPOSITION\b|\bEST FAIT OPPOSITION\b/;
// i18n-ignore-end

/** The value a label of the order's header holds: its line and those hanging under it. */
function reimsField(lines, label, stop) {
  const at = lines.findIndex((line) => label.test(line.label));
  if (at < 0) return [];
  const out = [lines[at].value];
  for (const line of lines.slice(at + 1)) {
    if (line.label || stop?.test(line.value) || lines[at].y - line.y > 60) break;
    out.push(line.value);
  }
  return out.filter(Boolean);
}

/**
 * Reims's orders, one PDF per dossier on the shelves « Autorisations
 * délivrées » and « Autorisations retirées »: the number top right, then
 * labelled lines — « Par : » (the applicant), « Représenté par : », «
 * Demeurant à : » (the applicant's address, never read), « Pour : » (the
 * works), « Sur un terrain sis à : 51100 REIMS - 106 Rue Lesage » — and the
 * operative article (« Il n'est pas fait opposition », « est ACCORDE », « est
 * RETIREE »). No signing day is printed: the order is signed electronically.
 * Each file weighs about 3 MB.
 */
export function readReimsOrder(document, { city, file }) {
  const page = document?.pages?.[0];
  if (!page) return [];
  const runs = (page.runs ?? []).filter((run) => clean(run.text));
  // The header's right column (number, floor area) starts past 380 points.
  const left = textLines(runs.filter((run) => run.x < 380));
  const labelled = left.map((line) => {
    const match = /^(Par|Repr[ée]sent[ée]e? par|Demeurant [àa]|Pour|Sur un terrain sis [àa])\s*:\s*(.*)$/i.exec(line.text);
    return { y: line.y, label: match?.[1] ?? null, value: match ? clean(match[2]) : line.text };
  });
  const all = (document.pages ?? []).flatMap((item) => textLines(item.runs ?? [])).map((line) => line.text);
  const head = all.slice(0, 30).join(' ');
  const dossier = municipalDossier(head, city) ?? municipalDossier(clean(file?.title).replace(/_/g, ' '), city);
  if (!dossier) return [];
  const siteText = reimsField(labelled, REIMS_SITE_RE, /^LE MAIRE\b/i).join(' ');
  // `51100 REIMS - 52 AVENUE NATIONALE - LA NEUVILLETTE -`: the street is the
  // first part after the town that is not the quarter's name.
  const parts = siteText.split(/\s+-\s+|\s+-$/).map(clean).filter(Boolean)
    .filter((part) => !/^\d{5}\s+REIMS$/i.test(part));
  const street = parts.find((part) => /^\d/.test(part)) ?? parts[0] ?? null;
  const site = municipalSite(street, city);
  if (!site.address) return [];
  const body = all.join('\n');
  const operative = fold(REIMS_OPERATIVE_RE.exec(body)?.[1] ?? '');
  const order = REIMS_ORDER_RE.exec(operative);
  const verdict = order ? municipalVerdict(order[0].replace(/^(?:EST|SONT)\s+/, '')) : null;
  return [{
    board: 'decisions', dossier, applicant: reportApplicant(reimsField(labelled, /^Par$/i).slice(0, 1)),
    address: site.address, postcode: site.postcode,
    purpose: clean(reimsField(labelled, REIMS_PURPOSE_RE).join(' ')) || null,
    filedOn: municipalDate(/D[ée]pos[ée]e? le\s*:\s*(\d{1,2}(?:er)?\s+\S+\s+\d{4}|\d{2}\/\d{2}\/\d{4})/i.exec(head)?.[1]),
    postedOn: file?.published ?? municipalDate(/Document publi[ée] le\s*(\d{2}\/\d{2}\/\d{4})/i.exec(body)?.[1]),
    verdict: verdict ?? verdicts.signed.fr,
  }];
}

export const DIGILOR_A_BOARD_READERS = Object.freeze({
  'digilor-lemans-list': readLeMansList,
  'digilor-reims-order': readReimsOrder,
});
export const DIGILOR_A_BOARD_TEXT = Object.freeze({});
