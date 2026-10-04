/**
 * Sélestat's scanned Cart@DS tables, read from positioned daily-sweep OCR.
 * Their two fixed landscape templates put the applicant's residential
 * address beside the project address. Only the project column is read.
 * Publication, posting start, posting end and signing day are distinct.
 */
import { municipalDate, municipalDossier, municipalSite } from './municipalPermitsFeed.js';
import { listVerdict } from './permitBoardsLists.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** OCR words joined on their baseline, restricted to one column first. */
function lines(runs) {
  const out = [];
  for (const run of [...runs].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const last = out.at(-1);
    if (last && Math.abs(last.y - run.y) < 2) last.runs.push(run);
    else out.push({ y: run.y, runs: [run] });
  }
  return out.map((line) => ({ y: line.y,
    text: clean(line.runs.sort((a, b) => a.x - b.x).map((run) => run.text).join(' ')) }));
}

// Coordinates are fractions of the landscape page width, measured from both
// printed templates. The gaps exclude borders and the entire applicant cell.
const COLUMNS = {
  filings: { dossier: [.062, .216], site: [.382, .561], purpose: [.563, .690],
    landArea: [.694, .755], floorArea: [.758, .801], date: [.858, .945] },
  decisions: { dossier: [.05, .184], site: [.36, .537], purpose: [.539, .681],
    landArea: [.686, .739], floorArea: [.742, .787], date: [.845, .944] },
};
function column(page, field, board) {
  const [left, right] = COLUMNS[board][field];
  return (page.runs ?? []).filter((run) => Number.isFinite(run.x1)
    && run.x >= left * page.width && run.x1 <= right * page.width);
}
const landscape = (page) => Number.isFinite(page?.width) && Number.isFinite(page?.height)
  && page.width / page.height > 1.40 && page.width / page.height < 1.43;

// i18n-ignore-start — exact printed headers and OCR dossier/parcel syntax
const NUMBER = /^(?:[A-Z]{2}|\d{3})/;
const DAY = /^\d{2}\/\d{2}\/\d{4}$/;
const PARCEL = /^Section\b/i;
const VERDICT = /^(?:FAVORABLE|DEFAVORABLE|ACCORD|REFUS|REJET|RETRAIT|SURSIS)\b/;
const joined = (items) => clean(items.map((item) => item.text).join(' ')) || null;

/** Fail closed if the publisher, orientation or identifying columns change. */
function header(page, board) {
  if (!landscape(page)) return null;
  const number = lines(column(page, 'dossier', board));
  const title = number.find((line) => fold(line.text) === 'N° DE DOSSIER');
  if (!title || !number.some((line) => /^67462\s*-\s*SELESTAT$/.test(fold(line.text)))) return null;
  const above = (field) => lines(column(page, field, board)).filter((line) => line.y >= title.y - 18);
  if (board === 'filings') {
    if (!above('purpose').some((line) => fold(line.text) === 'OBJET DES TRAVAUX')
      || !above('site').some((line) => fold(line.text) === 'REFERENCES CADASTRALES')) return null;
  } else if (!above('purpose').some((line) => fold(line.text) === 'OBJET DES TRAVAUX')) return null;
  return title.y - 18;
}
// i18n-ignore-end

const numeric = (value) => /^\d+(?:[.,]\d+)?(?:\s*m[²2])?$/.test(value ?? '')
  ? value.replace(/\s*m[²2]$/, '').replace(',', '.') : null;

/** Both registers: unknown/misread numbers hold their row but yield no dossier. */
export function readSelestatRegister(document, { city, file }) {
  const board = file?.board;
  if (!COLUMNS[board] || city?.insee !== '67462') return [];
  const first = document?.pages?.[0];
  if (header(first, board) === null) return [];
  const rows = [];
  for (const page of document.pages) {
    if (!landscape(page)) return [];
    // Continuation pages have no header; the verified template stays fixed.
    const numberLines = lines(column(page, 'dossier', board));
    const title = numberLines.find((line) => fold(line.text) === 'N° DE DOSSIER');
    const anchors = numberLines.filter((line) => line.y < (title ? title.y - 18 : Infinity)
      && line.y > 20 && !line.text.includes('/') && NUMBER.test(fold(line.text))
      && (line.text.match(/\d/g)?.length ?? 0) >= 5);
    const fields = Object.fromEntries(Object.keys(COLUMNS[board]).map((field) => [field, lines(column(page, field, board))]));
    anchors.forEach((anchor, index) => {
      // Require a full local identity: OCR must not turn another municipality's
      // number into a short Sélestat number, or invent missing digits.
      if (!/^(?:PC|DP|PA|PD|CU)\s*067\s*462\s*\d{2}/i.test(anchor.text)) return;
      const dossier = municipalDossier(anchor.text, city);
      if (!dossier) return;
      const bottom = anchors[index + 1]?.y ?? 20;
      const cell = (field) => fields[field].filter((line) => line.y <= anchor.y + 2 && line.y > bottom + 2);
      const postingDays = cell('dossier').filter((line) => DAY.test(line.text));
      const start = postingDays[0];
      const postedOn = municipalDate(start?.text);
      // An unread number must not join the next row's cells to this one.
      // The only second posting day this template allows is its end, exactly
      // two months later. Repeated starts or more dates reveal merged rows.
      if (!postedOn || postingDays.length > 2) return;
      if (postingDays[1]) {
        const end = new Date(`${postedOn}T00:00:00Z`);
        end.setUTCMonth(end.getUTCMonth() + 2);
        if (municipalDate(postingDays[1].text) !== end.toISOString().slice(0, 10)) return;
      }
      const site = municipalSite(joined(cell('site').filter((line) => !PARCEL.test(line.text))), city);
      const dates = cell('date');
      if (dates.some((line) => /^DATE /i.test(fold(line.text)))) return;
      if (dates.filter((line) => DAY.test(line.text)).length > 1) return;
      const signing = dates.find((line) => DAY.test(line.text));
      const verdictLines = dates.filter((line) => VERDICT.test(fold(line.text)));
      if (verdictLines.length > 1) return;
      const day = (value) => {
        const parsed = municipalDate(value);
        return parsed && (!file.published || parsed <= file.published) ? parsed : null;
      };
      rows.push({ board, dossier, ...site, applicant: null, purpose: joined(cell('purpose')),
        filedOn: board === 'filings' ? day(signing?.text) : null,
        decidedOn: board === 'decisions' ? day(signing?.text) : null,
        verdict: board === 'decisions' ? listVerdict(verdictLines[0]?.text) : null,
        postedOn: day(start?.text), landArea: numeric(joined(cell('landArea'))),
        floorArea: numeric(joined(cell('floorArea'))), housing: null });
    });
  }
  return rows;
}

export const SELESTAT_BOARD_READERS = Object.freeze({ 'selestat-register': readSelestatRegister });
