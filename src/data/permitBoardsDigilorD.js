/**
 * PDF readers for the Digilor Datahall towns of batch D (`digilorTownsD.js`),
 * by `layout`. See `permitBoards.js` for the contract.
 *
 * Applicants: never a person. Every town here prints the applicant's name,
 * and most their address, beside the site; the readers take the site from its
 * own label only and never return an applicant.
 */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';
import { readIllkirchList } from './permitBoardsDigilorB.js';
import { listVerdict, verdictCell } from './permitBoardsLists.js';
import { readReportTable, reportApplicant } from './permitBoardsReports.js';
import { readScannedNotice, readTitleAct, withoutTown } from './permitBoardsDigilorC.js';
import { readDematdocNotice } from './dematdocFeed.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/**
 * OCR words on one baseline, left to right, top to bottom. Tesseract gives
 * every word of a line its line's baseline, so a tolerance of a point keeps
 * two lines apart that a scan sets five points from each other.
 */
function ocrLines(runs, tolerance = 1) {
  const lines = [];
  for (const run of [...runs].filter((item) => clean(item.text)).sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - run.y) < tolerance) line.runs.push(run);
    else lines.push({ y: run.y, runs: [run] });
  }
  return lines.map((line) => {
    const runsLeftToRight = line.runs.sort((a, b) => a.x - b.x);
    return { y: line.y, runs: runsLeftToRight, text: clean(runsLeftToRight.map((run) => run.text).join(' ')) };
  });
}

// --- Le Grand-Quevilly: one scanned order per dossier ------------------------

// i18n-ignore-start — the orders' own labels and the town's name, matched on
const GRAND_QUEVILLY_NUMBER_RE = /\b(PC|DP|PA|PD)\s*(\d{2})\s*G\s*0*(\d{1,4})\b(?:\s*-?\s*([MT])\s*0*(\d{1,2})\b)?/i;
/** « Sur un terrain sis à : », which OCR reads as « Sucunierran sise » or « SuruntérremisistE ». */
const GRAND_QUEVILLY_LABEL_RE = /^Su[rcn]/i;
const GRAND_QUEVILLY_TOWN_RE = /[\s,]*(?:\b\d{5}\b.*|(?:Le\s+)?Grand[\s-]*Quevilly\b.*)$/i;
const GRAND_QUEVILLY_FILED_RE = /Demande\s+d[ée]pos[ée]e\s+le\s+(\d{1,2}\/\d{1,2}\/\d{4})/i;
const GRAND_QUEVILLY_STREET_RE = /^\d{1,4}(?:\s*(?:bis|ter|[a-d]))?\s+\p{L}{2,}/iu;
const GRAND_QUEVILLY_PARCELS_RE = /^(?:[A-Z]{1,2}\s*\d{1,4}\b[\s,;]*(?:et\s+)?)+$/;
const STREET_WORD_RE = /\b(?:rue|avenue|boulevard|chemin|impasse|all[ée]e|place|route|square|quai|esplanade|sente|cours)\b/i;
// i18n-ignore-end

/**
 * The number Sitadel joins, from the title Le Grand-Quevilly types for each
 * order: `DP 26 G 0085`, `PC 26 G0025`, `PC 23 G 0052 M01`, `DP 25 G 142` →
 * `DP 076322 26 G0085` (the orders print `N° DP 76322 26 G0085`, the
 * instructing service's letter G before a four-digit counter).
 */
export function grandQuevillyDossier(title, city) {
  const match = GRAND_QUEVILLY_NUMBER_RE.exec(clean(title));
  if (!match) return null;
  const change = match[4] ? ` ${match[4].toUpperCase()}${match[5].padStart(2, '0')}` : '';
  return municipalDossier(`${match[1].toUpperCase()} ${city.insee} ${match[2]} G${match[3].padStart(4, '0')}${change}`, city);
}

/** Where the frame's values start: the labels end left of it, « Destination » starts right of it. */
const VALUE_COLUMN = [140, 400];

/**
 * The site in the order's frame, beside « Sur un terrain sis à : » in the
 * value column: the street, then `76120 Grand Quevilly` and the odd parcel
 * (`AY 137`), three lines OCR sets anywhere from eighteen points above the
 * label's line to fourteen below — the works' last line is twenty-two above
 * or more, the recitals twenty-seven below. A numbered street first, else
 * one with a street word (« Chemin de la Poudrière »); never the building's
 * name (« Villa Thessalie ») alone.
 */
function grandQuevillySite(page) {
  const lines = ocrLines(page?.runs ?? []);
  const label = lines.find((line) => line.runs[0].x < 70 && GRAND_QUEVILLY_LABEL_RE.test(line.text) && /terrain|sis/i.test(line.text))
    ?? lines.find((line) => line.runs[0].x < 70 && GRAND_QUEVILLY_LABEL_RE.test(line.text));
  if (!label) return null;
  const values = lines
    .filter((line) => line.y <= label.y + 18 && line.y >= label.y - 14)
    .map((line) => clean(line.runs.filter((run) => run.x >= VALUE_COLUMN[0] && run.x < VALUE_COLUMN[1]).map((run) => run.text).join(' '))
      .replace(/^(?:[^\p{L}\d]+|[àa]\s*[.:,]\s*)+/u, '').replace(/[\s|]+$/, ''))
    .filter(Boolean);
  const parcels = values.filter((text) => GRAND_QUEVILLY_PARCELS_RE.test(text))
    .flatMap((text) => text.match(/[A-Z]{1,2}\s*\d{1,4}/g).map((parcel) => parcel.replace(/^([A-Z]+)\s*0*(\d)/, '$1 $2')));
  const streets = values.map((text) => clean(text.replace(GRAND_QUEVILLY_TOWN_RE, '')))
    .filter((text) => /\p{L}{2,}/u.test(text) && !GRAND_QUEVILLY_PARCELS_RE.test(text));
  const street = streets.find((text) => GRAND_QUEVILLY_STREET_RE.test(text)) ?? streets.find((text) => STREET_WORD_RE.test(text));
  return street ? { street, parcels: parcels.length ? parcels.join(', ') : null } : null;
}

/**
 * Le Grand-Quevilly's orders (app 134, « Urbanisme »): one scan per dossier,
 * named by its short number, read by the sweep's OCR. A frame « DESCRIPTION
 * DE LA DEMANDE » (« Demande déposée le 27/05/2026 … N° DP 76322 26 G0085 »,
 * « Par : » the applicant and their address, « Pour : » the works, « Sur un
 * terrain sis à : » the site), the recitals, then « ARTICLE 1 » and its
 * verdict. The number is the title's, typed by hand, else the frame's. The
 * day the order was signed is a stamp OCR misreads (« 2 8 JUIL, 2076 »): left
 * empty.
 */
export function readGrandQuevillyOrder(document, { city, file }) {
  const pages = document?.pages ?? [];
  const lines = pages.flatMap((page) => ocrLines(page.runs ?? [], 3)).map((line) => line.text);
  const body = lines.join('\n');
  const dossier = grandQuevillyDossier(file?.title, city) ?? municipalDossier(lines.slice(0, 30).join(' '), city);
  const site = grandQuevillySite(pages[0]);
  if (!dossier || !site) return [];
  const article = /\bARTICLE\s+1\b\s*:?([\s\S]{0,300})/i.exec(body)?.[1]?.split(/\bARTICLE\s+2\b/i)[0] ?? '';
  const heading = lines.slice(0, 12).join(' ');
  return [{
    board: 'decisions', dossier, applicant: null, ...municipalSite(site.street, city), parcels: site.parcels,
    filedOn: municipalDate(GRAND_QUEVILLY_FILED_RE.exec(body)?.[1]),
    verdict: municipalVerdict(article) ?? municipalVerdict(heading) ?? verdicts.signed.fr,
    decidedOn: null, postedOn: file?.published ?? null,
  }];
}

// --- Le Plessis-Trévise: acts titled by their site ----------------------------

// i18n-ignore-start — the receipts' and orders' own words, matched on
const FRAME_RE = /\bterrain\s+sis\b/i;
const PLESSIS_FILED_RE = /(?:Accus[ée] d[’']enregistrement [ée]lectronique|d[ée]pos[ée]e?(?: compl[eè]te?)? le|re[çc]ue? par la Mairie de\s*:[^:]{0,60}le)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i;
// i18n-ignore-end

/**
 * Le Plessis-Trévise's receipts of a permit filed (app 315, « Urbanisme » /
 * 6259): the State's electronic receipt (« Récépissé de dépôt d'un Permis de
 * Construire … n°PC0940592601016 … Accusé d'enregistrement électronique :
 * 28/09/2026 »), which prints no site. The file is titled by its site (« 24
 * avenue Clément Ader ») and the number typed in the record (`numero`), which
 * the shelf's `numbered` puts before the title: the row is the title's, with
 * the day the receipt states. A record left without a number gives no row:
 * the one such receipt since July prints the platform's provisional number
 * (`PC09405926N1011`), which the order then gives as `PC0940592601011`.
 */
export function readPlessisReceipt(document, { city, file }) {
  const [row] = readTitleAct(document, { city, file: { ...file, board: 'filings' } });
  if (!row) return [];
  const body = (document?.pages ?? []).flatMap((page) => ocrLines(page.runs ?? [], 3)).map((line) => line.text).join('\n');
  return [{ ...row, filedOn: municipalDate(PLESSIS_FILED_RE.exec(body)?.[1]) }];
}

/**
 * A scanned order the `digilor-amneville-notice` way, once the rule OCR glues
 * to the frame's number (`_PC0940592601011`) is taken off — or no row when
 * the text holds no frame: some scans carry a scrap of text layer («
 * DESCRIPTION DE DEMANDE », the board's stamp), and the sweep's OCR is then
 * to read them.
 */
function framedOrder(document, context) {
  const pages = (document?.pages ?? []).map((page) => ({ ...page,
    runs: (page.runs ?? []).map((run) => ({ ...run, text: String(run.text ?? '').replace(/^_+(?=[A-Z])/, '') })) }));
  if (!FRAME_RE.test(pages.flatMap((page) => page.runs.map((run) => run.text)).join(' '))) return [];
  return readScannedNotice({ ...document, pages }, context);
}

/**
 * Le Plessis-Trévise's orders (6221 DP, 6144 PC), scans the sweep's OCR reads:
 * a frame « Déposée le : 16/07/2026 … PC0940592601011 », « Par : » the
 * applicant, « Sur un terrain sis : » the site, then « ARRETE » or « DECIDE ».
 * The scan's number is the one to trust: the record's `numero` once named a
 * PC a DP.
 */
export function readPlessisOrder(document, context) {
  return framedOrder(document, context);
}

// --- Lattes: orders named by number ------------------------------------------

// i18n-ignore-start — the orders' own label, matched on
const LATTES_PARCELS_RE = /\bParcelles?\s*[!|:}lI1]?\s*((?:[A-Z]{1,2}\s?\d{1,4}\b(?:\s*(?:,|;|et)\s*)?)+)/;
// i18n-ignore-end
/** A title's counter and the change it names: `2600176M01`, `23M0050M02`, `25-0021M01`, `26 00024_T01`. */
const CHANGE_RE = /(\d{3,5})\s*-?\s*([MT])\s*0?(\d{1,2})(?!\d)/gi;

/**
 * The number with the change the title names, which the frame often leaves
 * out (« N° PC 34129 23 M0050 » for « PC34129 23M0050M02 »): the title's
 * `M02` or `T01` when its counter is the frame's.
 */
function withTitleChange(dossier, title) {
  if (/\s[MT]\d{2}$/.test(dossier ?? '')) return dossier;
  const change = [...String(title ?? '').replace(/_/g, ' ').matchAll(CHANGE_RE)].at(-1);
  const counter = /\s[A-Z]?(\d{4,5})$/.exec(dossier ?? '')?.[1];
  if (!change || !counter || Number(change[1]) !== Number(counter)) return dossier;
  return `${dossier} ${change[2].toUpperCase()}${change[3].padStart(2, '0')}`;
}

/**
 * Lattes's orders (app 317, « Urbanisme »), scans named by number (« arr20261720
 * _non_opposition_DP_341292600186 », « ARR PC3412926-0031 »): the State's frame
 * (« Déposée le 09/09/2026 N° DP 34129 26 00186 », « Par ! » the applicant, «
 * Sur un terrain sis } 12 Rue … 34970 Lattes », « Parcelle | DA0039 »), then «
 * ARTICLE UNIQUE ». The frame's number is the one to trust — a title once
 * named a withdrawal a non-opposition, and drops the service's letter (`24
 * 0009` for `24 M0009`) — with the change the title adds. OCR reads the
 * frame's dotted rule as `!`, `|`, `}` or `1` before the street (« 1 16 rue
 * des … »), and a `1` as `l`: both mended, the parcels read beside their own
 * label, and a decision day outside the filing and posting days (`2028`)
 * left empty.
 */
export function readLattesOrder(document, context) {
  const [row] = framedOrder(document, context);
  if (!row) return [];
  const lines = (document?.pages ?? []).slice(0, 1).flatMap((page) => ocrLines(page.runs ?? [], 4)).map((line) => line.text);
  const parcels = lines.map((line) => LATTES_PARCELS_RE.exec(line)?.[1]).find(Boolean)
    ?.match(/[A-Z]{1,2}\s?\d{1,4}/g).map((parcel) => parcel.replace(/^([A-Z]+)\s*0*(\d)/, '$1 $2')).join(', ');
  const street = clean(String(row.address ?? '')
    .replace(/^(?:[!|}{]\s*)+/, '').replace(/^(?:[Îîl1I]\s+)+(?=\d)/, '').replace(/^l(?=\d)/, '1').replace(/^[lI]\s+(?=\p{L})/u, ''));
  if (!/\p{L}{2,}/u.test(street)) return [];
  const decided = row.decidedOn && (!row.filedOn || row.decidedOn >= row.filedOn)
    && (!row.postedOn || row.decidedOn <= row.postedOn) ? row.decidedOn : null;
  return [{ ...row, dossier: withTitleChange(row.dossier, context.file?.title), ...municipalSite(street, context.city),
    parcels: row.parcels ?? parcels ?? null, decidedOn: decided }];
}

// --- Châtel-Saint-Germain and Longeville-lès-Saint-Avold: scanned notices and orders

// i18n-ignore-start — the acts' own labels and the towns' names, matched on
const ACT_FILED_RE = /(?:Date du d[ée]p[ôo]t|formul[ée]e? le|d[ée]pos[ée]e? le)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i;
const CHATEL_TOWN_RE = /[\s,]*(?:(?<=\s)[àa]\s+)?(?:\b57160\b.*|CH[AÂ]TEL[\s-]*S(?:AIN)?T[\s-]*GERMAIN\b.*)$/i;
const LONGEVILLE_TOWN_RE = /[\s,]*(?:(?<=\s)[àa]\s+)?(?:\b57740\b.*|LONGEVILLE[\s-]*L[ÈE]S[\s-]*S(?:AIN)?T[\s-]*AVOLD\b.*)$/i;
const ENNERY_TOWN_RE = /[\s,]+57365\b.*$/;
const MORHANGE_TOWN_RE = /[\s,-]*(?:(?<=\s)[àa]\s+)?(?:\b5734[09]\b.*|MORHANGE\b.*)$/i;
// i18n-ignore-end

/**
 * A scanned notice or order as the Amnéville scan reading gives it, with a
 * town's mends: its name after the street taken off, the change a title names
 * (`M01`) added to a number that lacks it, the filing day read by its own
 * label, and a decision day outside the filing and posting days (a stamp OCR
 * reads « 28 AT 2976 », a plan's approval) left empty.
 */
function readTownAct(document, context, townRe) {
  const [row] = readScannedNotice(document, context);
  if (!row) return [];
  const street = clean(String(row.address ?? '').replace(townRe, '').replace(/\(\s*\)/g, '').replace(/^[\s([{|]+/, '').replace(/[\s,;:-]+$/, ''));
  if (!/\p{L}{2,}/u.test(street)) return [];
  const body = (document?.pages ?? []).flatMap((page) => ocrLines(page.runs ?? [], 4)).map((line) => line.text).join('\n');
  const filedOn = row.filedOn ?? municipalDate(ACT_FILED_RE.exec(body)?.[1]);
  const decidedOn = row.decidedOn && (!filedOn || row.decidedOn >= filedOn)
    && (!row.postedOn || row.decidedOn <= row.postedOn) ? row.decidedOn : null;
  return [{ ...row, dossier: withTitleChange(row.dossier, context.file?.title), ...municipalSite(street, context.city), filedOn,
    ...(row.board === 'decisions' ? { decidedOn } : {}) }];
}

/**
 * Châtel-Saint-Germain's acts (app 295, « Urbanisme » 3289: 4782 the DP, 4776
 * the PC), scans named by number and kind (« DP 057 134 26 00037 AVIS DE DEPOT
 * », « … ARRETE »): the notice prints « Date du dépôt », « Adresse du terrain:
 * 22 Rue … à CHATEL-SAINT-GERMAIN () » and the number at its foot, the order
 * the State's frame (« Déclaration préalable formulée le : 30/06/2026 Dossier
 * N° : DP 057 134 26 00018 », « Sur un terrain sis à : »), both read the
 * `digilor-amneville-notice` way by the sweep's OCR, with `readTownAct`'s mends.
 */
export function readChatelAct(document, context) {
  return readTownAct(document, context, CHATEL_TOWN_RE);
}

// i18n-ignore-start — the titles' own kinds, matched on
const LONGEVILLE_KIND_RE = /^(?:AD)?(PC|DP|PA|PD)\b/i;
/** The year and counter after the kind and whatever name it brings: `26 00038`, `2600029`, `23 V0018`, then a change `M 01`. */
const LONGEVILLE_COUNTER_RE = /(?<!\d)(\d{2})\s*([A-Z]\d{4}|\d{5})(?!\d)(?:\s*([MT])\s*0?(\d{1,2})(?!\d))?/i;
// i18n-ignore-end

/**
 * The number a Longeville title carries, as `DP 057413 26 00038 M01`, or null:
 * « ADDP <name> 26 00038 du 02.10.2026 » (an avis de dépôt: AD + the
 * kind), « DP <name> 26 00034 - Arrêté n° 220/26 », « DP 26 00016 M 01 - … »,
 * « DP 057 413 26 00017 - Arrêté … ». The words between the kind and the
 * number are the applicant's: never read.
 */
export function longevilleNumber(title, city) {
  const text = clean(title).replace(/_/g, ' ');
  const kind = LONGEVILLE_KIND_RE.exec(text)?.[1]?.toUpperCase();
  if (!kind) return null;
  const full = municipalDossier(text.replace(/^AD/i, ''), city);
  if (full) return full;
  // Another commune's number is no short one of this.
  if (/^(?:AD)?(?:PC|DP|PA|PD)\s*0?\d\s*\d{2}\s*\d{3}\b/i.test(text)) return null;
  const found = LONGEVILLE_COUNTER_RE.exec(text);
  if (!found) return null;
  const counter = /^\d+$/.test(found[2]) ? found[2] : found[2].toUpperCase();
  return municipalDossier(`${kind} ${city.insee.padStart(6, '0')} ${found[1]} ${counter}${found[3] ? ` ${found[3].toUpperCase()}${found[4].padStart(2, '0')}` : ''}`, city);
}

// i18n-ignore-start — the titles' own words, matched on
const LONGEVILLE_DAY_RE = /\bdu\s+(\d{2})[./](\d{2})[./](\d{4}|\d{2})\b|\bdu\s+(\d{2})(\d{2})(\d{4})\b/i;
const LONGEVILLE_VERDICT_RE = /\b(?:non[- ]opposition|refus|opposition|retrait)\b/i;
// i18n-ignore-end

/** The day a Longeville title ends on (« … du 29.09.2026 », « du 22.09.26 », « du 01092026 »), as an ISO day, or null. */
function longevilleDay(title) {
  const found = LONGEVILLE_DAY_RE.exec(clean(title));
  if (!found) return null;
  const [day, month, year] = found[1] ? [found[1], found[2], found[3]] : [found[4], found[5], found[6]];
  return municipalDate(`${day}/${month}/${year.length === 2 ? `20${year}` : year}`);
}

/**
 * Longeville-lès-Saint-Avold's acts (app 399, « URBANISME » 3601), scans whose
 * titles carry the applicant's name beside the number: the avis de dépôt (`ADDP
 * …`) print « Dossier numéro : DP 057 413 26 00038 », « Date du dépôt »,
 * « Adresse du terrain » and « Nature des Travaux »; the orders (`DP … -
 * Arrêté n° 220/26 du 29.09.2026`) the State's frame, « Déclaration déposée
 * le », « Par : » the applicant and « Demeurant à : » his own address
 * (neither read), « Sur un terrain sis à : », which prints no number — it is
 * the title's, kept without the name. Read by `readTownAct`. The day an order
 * was signed is the one its title ends on — the scan's own stamp is garbled,
 * and a later « , le 24/09/2026 » (the Prefect's opinion) is no signing day —,
 * the verdict the one its title types when the frame leaves none (« Opposition
 * », « Retrait après décision »).
 */
export function readLongevilleAct(document, context) {
  const original = clean(context.file?.title);
  const title = longevilleNumber(original, context.city) ?? '';
  const named = longevilleDay(original);
  return readTownAct(document, { ...context, file: { ...context.file, title } }, LONGEVILLE_TOWN_RE).map((row) => {
    const plausible = named && (!row.filedOn || named >= row.filedOn) && (!row.postedOn || named <= row.postedOn) ? named : null;
    if (row.board !== 'decisions') return { ...row, filedOn: row.filedOn ?? plausible };
    return { ...row, decidedOn: plausible ?? (named ? null : row.decidedOn),
      verdict: row.verdict === verdicts.signed.fr ? municipalVerdict(LONGEVILLE_VERDICT_RE.exec(original)?.[0]) ?? row.verdict : row.verdict };
  });
}

// --- Morhange: the orders, printed with a header block --------------------------

/**
 * Morhange's orders (app 123, « Urbanisme / Documents relatifs à l'urbanisme »:
 * 2716 the DP, 2714 the PC, 9608 the certificates), scans titled by year, kind,
 * short number and applicant, then the act: `2026 - DP 029 - <applicant> -
 * DECISION`, `… - Décision et avis`. The act's first page prints a block —
 * « Numéro de dossier : DP 057 483 26 00029 », « Date de dépôt », « Par : » the
 * applicant and « Demeurant : » his own address (neither read), « Sur un
 * terrain situé : 29 Rue du 18 Novembre - 57340 Morhange », « Section(s) et
 * Parcelle(s) », « Nature des travaux » — then the State's frame and « Article
 * I : Il n'est pas fait opposition ». Read the Amnéville scan way, by
 * `readTownAct` (the title's `M01` added to a modification's number). The
 * receipts and « avis de dépôt » beside them are the State's blank form filled
 * in by hand, which OCR cannot read, and name no site in print: not read. The
 * certificates' orders (`CU`) are no permit's, and one of them read as a
 * « retrait » from the clay's « retrait-gonflement »: left out.
 */
export function readMorhangeOrder(document, context) {
  return readTownAct(document, context, MORHANGE_TOWN_RE).filter((row) => !/^CU\b/.test(row.dossier));
}

// --- Ennery: the commune's own frame, dotted days -----------------------------

// i18n-ignore-start — the orders' own words and the titles' kinds, matched on
/** « Vu la Déclaration Préalable susvisée déposée le 15.08.2026 et complétée le 12.09.2026 »: the first day. */
const ENNERY_FILED_RE = /\bd[ée]pos[ée]e?s?\s+le\s+(\d{1,2})[./](\d{1,2})[./](\d{4})/i;
/** The change a title names: `PCMODIF01 <name>`, `DP31MO1 <name>` (a letter O for the zero). */
const ENNERY_CHANGE_RE = /MODIF\s*0?(\d{1,2})\b|\dM[O0]\s*0?(\d{1,2})\b/i;
const ENNERY_TACIT_OPPOSITION_RE = /D[ÉE]CISION TACITE D['’]\s*OPPOSITION/i;
const ENNERY_UNOPPOSED_RE = /D[ÉE]CISION DE NON[- ]?OPP/i;
// i18n-ignore-end

/**
 * Ennery's orders (app 32, « 280 »: 544 the DP, 382 the PC), scans of the
 * commune's frame, « DP 057 193 2600032 », « Avis de dépôt affiché le
 * 17/08/2026 », « Arrêté affiché le 30/09/2026 », « Par : » the applicant and
 * « Demeurant à : » his own address (neither read), « Sur un terrain sis : »,
 * « Parcelle(s) », then « Vu la Déclaration Préalable susvisée déposée le
 * 15.08.2026 » — the filing day, in dots `readTownAct` does not take. The
 * title adds the change the frame's number drops (`PCMODIF01 …` is `M01`), and
 * the verdict the signature hides or the letter states: « décision de
 * non-opposition » under a stamp, « Décision Tacite d'Opposition » on an
 * incomplete file (a letter, with « Adresse des travaux » for the site).
 */
export function readEnneryOrder(document, context) {
  const lines = (document?.pages ?? []).flatMap((page) => ocrLines(page.runs ?? [], 4)).map((line) => line.text);
  const body = lines.join('\n');
  // The verdict is the act's own: a recital (« Vu la décision de non-opposition du … ») names an earlier one.
  const stated = lines.filter((line) => !FRAME_RECITALS_RE.test(line)).join('\n');
  const filed = ENNERY_FILED_RE.exec(body);
  const change = ENNERY_CHANGE_RE.exec(clean(context.file?.title).replace(/_/g, ' '));
  return readTownAct(document, context, ENNERY_TOWN_RE).map((row) => {
    const dossier = !change || /\s[MT]\d{2}$/.test(row.dossier) ? row.dossier : `${row.dossier} M${(change[1] ?? change[2]).padStart(2, '0')}`;
    const filedOn = row.filedOn ?? (filed ? municipalDate(`${filed[1].padStart(2, '0')}/${filed[2].padStart(2, '0')}/${filed[3]}`) : null);
    const plausible = filedOn && (!row.postedOn || filedOn <= row.postedOn) ? filedOn : row.filedOn;
    const verdict = row.verdict !== verdicts.signed.fr ? row.verdict
      : ENNERY_TACIT_OPPOSITION_RE.test(stated) ? verdicts.refused.fr
        : ENNERY_UNOPPOSED_RE.test(stated) ? verdicts.unopposed.fr : row.verdict;
    return { ...row, dossier, filedOn: plausible, verdict };
  });
}

// --- Jarville-la-Malgrange: scanned notices and orders ---------------------------

// i18n-ignore-start — the notices' own labels and kinds, matched on
const JARVILLE_NUMBER_RE = /N[°o]\s*Enregistrement\s*:?\s*(0?54\s*274\s*\d{2}\s*\d{5})/i;
const JARVILLE_KIND_RE = /Objet\s*:\s*Avis de d[ée]p[ôo]t\s*[-–]?\s*(D[ée]claration Pr[ée]alable|Permis de construire|Permis de d[ée]molir|Permis d[’']am[ée]nager)/i;
/** The kind « Objet » names, as the letters of a number: « Permis de Démolir » is `PD`. */
const jarvilleKind = (words) => (/^D[ée]claration/i.test(words) ? 'DP' : /construire/i.test(words) ? 'PC' : /d[ée]molir/i.test(words) ? 'PD' : 'PA');
const JARVILLE_SITE_RE = /Adresse\s+exacte\s+du\s+terrain\s*:?\s*(.*)$/i;
const JARVILLE_FILED_RE = /Date\s+d[’']enregistrement\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i;
const JARVILLE_PURPOSE_RE = /^Destination\s*:?\s*(.*)$/i;
const JARVILLE_SIGNED_RE = /\b(20\d{2})\.(\d{2})\.(\d{2})\s+\d{2}:\d{2}:\d{2}\b/;
// i18n-ignore-end

/**
 * Jarville-la-Malgrange's avis de dépôt (app 333, « URBANISME »: 4002 the DP,
 * 4000 the PC): one scanned letter per dossier, « Objet : Avis de dépôt -
 * Déclaration Préalable », « Nom du demandeur : … » (never read), « N°
 * Enregistrement : 054 274 26 00085 », « Date d'enregistrement : 14/09/2026 »,
 * « Adresse exacte du terrain : 17 RUE CARNOT », « Destination : … ». The
 * title gives the number with its kind (« Avis de dépôt DP 054 274 26 00085 -
 * <applicant> »: only the number is taken); a letter whose title lost it
 * takes the kind from « Objet ». The purpose runs on under its label until
 * the mayor's signature, which stands in the column to its right.
 */
function readJarvilleNotice(document, { city, file }) {
  const page = document?.pages?.[0];
  const lines = ocrLines(page?.runs ?? [], 3);
  const text = lines.map((line) => line.text);
  const body = text.join('\n');
  let dossier = municipalDossier(String(file?.title ?? '').replace(/-\s.*$/, ''), city);
  if (!dossier) {
    const kind = JARVILLE_KIND_RE.exec(body)?.[1];
    const number = JARVILLE_NUMBER_RE.exec(body)?.[1];
    dossier = kind && number ? municipalDossier(`${jarvilleKind(kind)} ${number.replace(/\s+/g, ' ')}`, city) : null;
  }
  const site = lines.map((line) => JARVILLE_SITE_RE.exec(line.text)?.[1]).find(Boolean);
  if (!dossier || !site || !/\p{L}{2,}/u.test(site)) return [];
  const purposeLines = [];
  for (let at = lines.findIndex((line) => JARVILLE_PURPOSE_RE.test(line.text)); at >= 0 && at < lines.length; at += 1) {
    // The signature stands apart on the right; the works' lines start in the letter's column.
    if (lines[at].runs[0].x > 300 || /^Cet avis\b/i.test(lines[at].text) || (purposeLines.length && lines[at - 1].y - lines[at].y > 22)) break;
    purposeLines.push(lines[at].text);
  }
  const purpose = clean(purposeLines.join(' ').replace(JARVILLE_PURPOSE_RE, '$1')) || null;
  return [{
    board: 'filings', dossier, applicant: null, ...municipalSite(site, city), purpose,
    filedOn: municipalDate(JARVILLE_FILED_RE.exec(body)?.[1]), postedOn: file?.published ?? null, verdict: null,
  }];
}

/**
 * Jarville-la-Malgrange's acts: the notices of filing (`readJarvilleNotice`)
 * and the orders — the State's frame under « DECISION DE NON-OPPOSITION À
 * UNE DECLARATION PREALABLE » or « PERMIS DE CONSTRUIRE ACCORDE » (« Demande
 * déposée le : 31/08/2026 », « Par : » the applicant, « Sur un terrain sis à
 * : 27 Avenue de la Malgrange », the parcels under it), read the
 * `digilor-amneville-notice` way with the number of the title, since the
 * frame prints none. The day the mayor signed is the one his electronic
 * signature stamps (« 2026.09.28 12:23:38 +0200 »), which an order signed on
 * paper lacks; a day outside the filing and posting days is a misreading. Other
 * letters of the shelf — « dossier rejeté pour incomplétude » — have no
 * frame and give no row. Live read on 3 October 2026: 40 filings and 35
 * orders posted since 1 July, every one with its site.
 */
export function readJarvilleAct(document, context) {
  if (context.file?.board !== 'decisions') return readJarvilleNotice(document, context);
  const stamped = JARVILLE_SIGNED_RE.exec(ocrLines(document?.pages?.[0]?.runs ?? [], 3).map((line) => line.text).join('\n'));
  const signedOn = stamped ? `${stamped[1]}-${stamped[2]}-${stamped[3]}` : null;
  return readScannedNotice(document, context).map((row) => ({ ...row, decidedOn: row.decidedOn
    ?? (signedOn && (!row.filedOn || signedOn >= row.filedOn) && (!row.postedOn || signedOn <= row.postedOn) ? signedOn : null) }));
}

// --- Alsace: the weekly lists of the instructing service V -------------------

// i18n-ignore-start — the lists' own header and numbers, matched on
const ALSACE_DOSSIER_RE = /^(?:PC|DP|PA|PD|CU)\s*\d/;
const ALSACE_SURFACE_HEADER = /^SURFACE DE$/;
const ALSACE_SURFACE_LABEL = 'SURFACE';
const ALSACE_NUMBER_HEADER = /^N° DOSSIER$/;
/** What a decision cell says that the ladder knows; anything else is the works' words spilled from the next column. */
const ALSACE_VERDICT_RE = /^(?:accord|favorable|d[ée]favorable|refus|retrait|non[- ]opposition|rejet|sursis|annul|opposition|d[ée]cision sign)/i;
// i18n-ignore-end

/**
 * The lists of filings and decisions that Souffelweyersheim, Oberhausbergen,
 * Reichstett and La Wantzenau post every week, « AFFICHAGE des DEPÔTS au
 * 02/10/2026 » and « AFFICHAGE des DECISIONS au 02/10/2026 », are
 * Illkirch-Graffenstaden's lists: one spreadsheet of the instructing service,
 * its numbers ending `26 V0090`. `readIllkirchList` reads them, with its
 * differences mended first: a header Excel prints `SURFACE DE` in one cell
 * (Reichstett, La Wantzenau) where Illkirch's is `SURFACE` over `DE`; a
 * « N° Dossier » header centred over numbers that start nearer the date
 * column than its own start (La Wantzenau), so that it moves to where the
 * numbers start; and an applicant cell whose first line was lost to the row
 * above, which then leaves the site's street as « applicant » (« 18 rue de la
 * Ville » reads as an organisation: `VILLE`) — an applicant that starts with a
 * number is no name: dropped; and a verdict cell that says something no verdict
 * is (« vente des lots », the works of the next row) or says its words twice
 * (« favorable avec prescriptions » ×2), mended.
 */
export function readAlsaceList(document, context) {
  const pages = (document?.pages ?? []).map((page) => {
    const runs = page.runs ?? [];
    const numberAt = Math.min(Infinity, ...runs.filter((run) => ALSACE_DOSSIER_RE.test(clean(run.text))).map((run) => run.x));
    return { ...page, runs: runs.map((run) => {
      const label = clean(run.text).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
      if (ALSACE_SURFACE_HEADER.test(label)) return { ...run, text: ALSACE_SURFACE_LABEL, x1: undefined };
      if (ALSACE_NUMBER_HEADER.test(label) && numberAt < run.x) return { ...run, x: numberAt, x1: undefined };
      return run;
    }) };
  });
  return readIllkirchList({ ...document, pages }, context).map((row) => ({ ...row,
    applicant: /^\d/.test(row.applicant ?? '') ? null : row.applicant,
    verdict: !row.verdict || ALSACE_VERDICT_RE.test(row.verdict) ? row.verdict?.replace(/^(.+?)\s+\1$/i, '$1') ?? null : verdicts.signed.fr }));
}

// --- Nilvange: one weekly table of filings and decisions ---------------------

// i18n-ignore-start — the table's own headers and titles, matched on
const NILVANGE_COLUMNS = [
  ['type', 'TYPE DE'], ['dossier', 'NUMERO'], ['applicant', 'DEMANDEUR'], ['site', 'ADRESSE TRAVAUX'], ['nature', 'NATURE DES TRAVAUX'],
  ['surface', 'SURFACE'], ['height', 'HAUTEUR'], ['filedOn', 'DEPOSE LE', { optional: true }], ['issuedOn', 'DELIVRE LE', { optional: true }],
  ['verdict', 'DECISION', { optional: true }],
];
const NILVANGE_EXTRA = ['DEMANDE', '(EN M2)', '(EN M)'];
const NILVANGE_NOISE = /^(?:Pour tout renseignement\b.*|en mairie de\b.*|Affich[ée] du\b.*|\( ?: ?[\d.]+|Document publi[ée] le\b.*|P[ée]riode\s*:.*)$/i;
const NILVANGE_SECTION_RE = /^(?:(DEMANDES) D.AUTORISATION|(DECISIONS) D.URBANISME)/i;
// i18n-ignore-end

/**
 * The organisation an applicant cell names, its words typed twice once
 * (« sci odb sci odb ») collapsed, or null — also when the name stops on a
 * preposition because the column wrapped it (« COMMUNE DE » / « NILVANGE »).
 */
function nilvangeApplicant(lines) {
  const name = reportApplicant((lines ?? []).map(clean))?.replace(/^(.+?)\s+\1$/i, '$1') ?? null;
  return name && !/\s(?:DE|DU|DES|LA|LE|D['’])$/i.test(name) ? name : null;
}

/**
 * Nilvange's weekly « Tableau » (app 259, « Urbanisme » 3503, `Tableau
 * 21092026 au 27092026`): two pages of one file, « DEMANDES D'AUTORISATION
 * D'URBANISME » (filings) then « DECISIONS D'URBANISME », each a table of Type
 * de demande | Numéro (`DP 57 508 2600086`) | Demandeur | Adresse travaux |
 * Nature des travaux | Surface | Hauteur | Déposé le — or Délivré le and
 * Décision (`Favorable`, `Rejet Tacite`, `Retrait`) —, every cell centred on
 * its row, a week with nothing to show filled with `-/-`. Each row carries
 * its board, the section deciding it. The applicant is an organisation's name
 * or nothing.
 */
export function readNilvangeList(document, { city, file }) {
  return readReportTable(document, {
    columns: NILVANGE_COLUMNS, extra: NILVANGE_EXTRA, noise: NILVANGE_NOISE,
    section: (text) => {
      const found = NILVANGE_SECTION_RE.exec(clean(text));
      return found ? { board: found[1] ? 'filings' : 'decisions' } : null;
    },
    rule: 'centre', place: 'centre', gap: 2,
    head: /^(?:PC|DP|PA|PD)\s*\d/, anchor: (text) => municipalDossier(text, city),
    build: (cells, section, dossier) => {
      const board = section?.board;
      const site = municipalSite(clean((cells.site ?? []).join(' ')), city);
      if (!board || !site.address) return null;
      return {
        board, dossier, applicant: nilvangeApplicant(cells.applicant),
        address: site.address, postcode: site.postcode ?? city.postcode,
        purpose: clean((cells.nature ?? []).join(' ')) || null,
        filedOn: board === 'filings' ? municipalDate(clean(cells.filedOn?.[0])) : null,
        postedOn: file?.published ?? null,
        verdict: board === 'decisions' ? listVerdict(verdictCell(cells.verdict)) ?? verdicts.signed.fr : null,
        decidedOn: board === 'decisions' ? municipalDate(clean(cells.issuedOn?.[0])) : null,
      };
    },
  });
}

// --- Créhange: the year's register of filings and decisions --------------------

const rightOf = (run) => (Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x + 0.5 * (run.size || 7) * clean(run.text).length);

// i18n-ignore-start — the register's own headers and words, matched on
const CREHANGE_HEADERS = ['NUMERO DOSSIER', 'ADRESSE DU TERRAIN', 'NATURE DU PROJET', 'DATE DE DEPOT', 'ACCORD'];
/** A number and the name the sheet prints against it, with no gap: `DP 0571592500022PRIVATE PERSON`. */
const CREHANGE_GLUED_RE = /^((?:PC|DP|PA|PD|CU[AB]?|AT)\s*0?57159\s*\d{2}\s*[A-Z]?\d{4,5})(?=[^\d\s])(.+)$/i;
/** Every kind the register numbers, so that a certificate or an ERP work holds its row's cells though it is no permit. */
const CREHANGE_HEAD_RE = /^(?:PC|DP|PA|PD|CU[AB]?|AT)\s*0?\d/i;
const CREHANGE_DAY_RE = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
const CREHANGE_UNADMITTED_RE = /irrecevable/i;
// i18n-ignore-end

/** `01-07-2026` or `1/7/2026` as an ISO day, the first in the text. */
function crehangeDay(value) {
  const found = CREHANGE_DAY_RE.exec(String(value ?? ''));
  return found ? municipalDate(`${found[1].padStart(2, '0')}/${found[2].padStart(2, '0')}/${found[3]}`) : null;
}

/**
 * The column of a cell. Créhange's spreadsheet centres the site and
 * right-aligns the works, so the cells' starts do not tell them apart: the
 * names and the applicants' own addresses start left of the site's header,
 * the site ends before the middle of the works' header, the works end where
 * the filing day starts, then the decision.
 */
function crehangeColumn(run, heads) {
  if (run.x < heads.site - 15) return 'private';
  if (run.x >= heads.decision - 12) return 'decision';
  if (run.x >= heads.filed - 5) return 'filed';
  return rightOf(run) < heads.natureMiddle ? 'site' : 'nature';
}

/** `X` for a cell the sheet printed twice in a row (`6 RUE EXEMPLE6 RUE EXEMPLE`: the applicant's address then the site's), else null. */
function doubled(value) {
  const text = clean(value);
  const half = Math.floor(text.length / 2);
  return text.length % 2 === 0 && text.slice(0, half).toUpperCase() === text.slice(half).toUpperCase() ? text.slice(0, half) : null;
}

/**
 * What the decision column says: `A` (accord) or `R` (refus), alone or after
 * the words it repeats (`Rejet tacite  R 26/05/2026`), `Retrait accordé`.
 */
function crehangeVerdict(said) {
  const words = said.replace(/^(rejet tacite)\s+R$/i, '$1');
  return listVerdict(/^A$/i.test(words) ? 'Accord' : /^R$/i.test(words) ? 'Refus' : words);
}

/**
 * Créhange's register (app 320, « URBANISME » 2843, `DEMANDES D'URBANISME`):
 * a spreadsheet printed on two pages, « Avis de dépôt et décisions » of the
 * year, posted again every few weeks with the new dossiers added. NUMERO
 * DOSSIER | NOM - Prénom | Adresse demandeur | ADRESSE DU TERRAIN | NATURE
 * DU PROJET | DATE DE DEPOT | ACCORD (`A 15/07/2026` for an accord, `Rejet
 * tacite`, `RETRAIT`, `IRRECEVABLE 20-05-2026`), one line a dossier, a works
 * wrapped over two lines centred on the number's. The applicant's name and
 * own address are never read: the columns are told apart by where their
 * cells start and end, and an address printed twice in one cell (the
 * applicant's then the site's) is read as the site alone. A dossier with a
 * decision is a decision, the others filings; certificates (`CUB`), ERP
 * works (`AT`) and the dossiers declared inadmissible give no row, nor does a
 * dossier older than six months before the edition.
 */
export function readCrehangeRegister(document, { city, file }) {
  const rows = [];
  const published = file?.published ?? null;
  const cutoff = published ? new Date(Date.parse(published) - 183 * 86400000).toISOString().slice(0, 10) : '0000-00-00';
  let heads = null;
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).flatMap((run) => {
      const glued = CREHANGE_GLUED_RE.exec(clean(run.text));
      if (!glued) return [run];
      const edge = run.x + 0.5 * (run.size || 7) * glued[1].length;
      return [{ ...run, text: glued[1], x1: edge }, { ...run, text: glued[2], x: edge + 2, x1: undefined }];
    }).filter((run) => clean(run.text));
    const labels = new Map(runs.map((run) => [clean(run.text).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(), run]));
    if (CREHANGE_HEADERS.every((label) => labels.has(label))) {
      const nature = labels.get('NATURE DU PROJET');
      heads = { top: Math.min(...CREHANGE_HEADERS.map((label) => labels.get(label).y)), dossier: labels.get('NUMERO DOSSIER').x,
        site: labels.get('ADRESSE DU TERRAIN').x, natureMiddle: (nature.x + rightOf(nature)) / 2,
        filed: labels.get('DATE DE DEPOT').x, decision: labels.get('ACCORD').x };
    }
    if (!heads) continue;
    const body = runs.filter((run) => run.y < heads.top - 2);
    const anchors = body.filter((run) => run.x < heads.dossier + 60 && CREHANGE_HEAD_RE.test(clean(run.text)))
      .map((run) => ({ run, dossier: municipalDossier(clean(run.text), city), cells: {} }));
    for (const run of body) {
      if (anchors.some((anchor) => anchor.run === run)) continue;
      // A cell belongs to the row whose number is nearest its line: a works wrapped over two lines straddles it.
      let near = null;
      for (const anchor of anchors) if (!near || Math.abs(anchor.run.y - run.y) < Math.abs(near.run.y - run.y)) near = anchor;
      if (!near || Math.abs(near.run.y - run.y) > 8) continue;
      let column = crehangeColumn(run, heads);
      let text = clean(run.text);
      if (column === 'private' && rightOf(run) > heads.site + 10) { column = 'site'; text = doubled(text) ?? ''; }
      if (text) (near.cells[column] ??= []).push({ ...run, text });
    }
    for (const anchor of anchors) {
      if (!anchor.dossier) continue;
      const text = (field) => clean((anchor.cells[field] ?? []).sort((a, b) => b.y - a.y || a.x - b.x).map((run) => run.text).join(' '));
      const site = municipalSite(text('site'), city);
      if (!site.address) continue;
      const filed = text('filed');
      const outcome = clean(`${filed.replace(CREHANGE_DAY_RE, ' ')} ${text('decision')}`);
      const said = clean(outcome.replace(/\d{1,2}[/-]\d{1,2}[/-]\d+/g, ' '));
      const filedOn = crehangeDay(filed);
      const day = crehangeDay(outcome);
      const decidedOn = day && (!filedOn || day >= filedOn) ? day : null;
      if (CREHANGE_UNADMITTED_RE.test(said) || (decidedOn ?? filedOn ?? '') < cutoff) continue;
      rows.push({
        board: said ? 'decisions' : 'filings', dossier: anchor.dossier, applicant: null, address: site.address, postcode: site.postcode ?? city.postcode,
        purpose: text('nature') || null, filedOn, postedOn: published,
        verdict: said ? crehangeVerdict(said) : null, decidedOn: said ? decidedOn : null,
      });
    }
  }
  return rows;
}

// --- Le Plessis-Bouchard: weekly scanned lists of filings and decisions --------

// i18n-ignore-start — the lists' own headers and section titles, matched on
/** Each board's header words: a field and a word of its label, OCR sometimes gluing a rule to it (`J'Adresse`). */
const PLESSISB_HEADS = {
  filings: [['filedOn', /DATE/], ['dossier', /NUMERO/], ['applicant', /PETITION/], ['site', /ADRESSE/], ['purpose', /DESCRIPTION/]],
  decisions: [['dossier', /NUMERO/], ['applicant', /PETITION/], ['verdict', /DECISION/], ['decidedOn', /DATE/], ['purpose', /NATURE/], ['site', /ADRESSE/], ['surface', /SURFACE/]],
};
/** A family's title in the list of decisions (« Déclaration préalable - Constructions et travaux non soumis … »). */
const PLESSISB_SECTION_RE = /^(?:Autorisation|D[ée]claration pr[ée]alable|Permis|Certificat|Demande)\b/i;
/** Every kind the lists number, so that a sign (`AP`) or an ERP work (`AT`) holds its row's cells though it is no permit. */
const PLESSISB_HEAD_RE = /^(?:PC|DP|PA|PD|CU|AT|AP)\b/;
const PLESSISB_NOISE_RE = /^(?:Page \d+ sur \d+|Document publi[ée] le\b.*)$/i;
// i18n-ignore-end

const foldWord = (value) => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/**
 * The columns' left edges, read off the header line (the topmost word of
 * `Numéro de dossier`): a label OCR lost keeps the edge the page before gave
 * it. Null when no page gave a header yet, or none is on this one.
 */
function plessisbHeader(words, specs, before) {
  const anchor = words.filter((run) => /NUMERO/.test(foldWord(run.text))).sort((a, b) => b.y - a.y)[0];
  if (!anchor) return null;
  const line = words.filter((run) => Math.abs(run.y - anchor.y) < 8);
  const columns = [];
  for (const [field, label] of specs) {
    const run = line.filter((item) => label.test(foldWord(item.text))).sort((a, b) => a.x - b.x)[0];
    const kept = before?.columns.find((column) => column.field === field);
    if (!run && !kept) return null;
    columns.push({ field, x: run ? run.x : kept.x });
  }
  return { y: anchor.y, columns: columns.sort((a, b) => a.x - b.x) };
}

/**
 * The first day a cell prints. The table's rule glues itself to the year's
 * last digit (`21/09/202€`): the year is then the posting's or the one
 * before, whichever puts the day within the six months up to the posting.
 */
function plessisbDay(text, published) {
  const found = /(\d{2}\/\d{2}\/)(20\d)([^\s\d]|\d)/.exec(text);
  if (!found) return null;
  if (/\d/.test(found[3])) return municipalDate(`${found[1]}${found[2]}${found[3]}`);
  const year = Number(String(published ?? '').slice(0, 4));
  const limit = Date.parse(published ?? '');
  for (const candidate of [year, year - 1]) {
    const day = municipalDate(`${found[1]}${candidate}`);
    if (day && Number.isFinite(limit) && Date.parse(day) <= limit && Date.parse(day) > limit - 183 * 86400000) return day;
  }
  return null;
}

/**
 * Le Plessis-Bouchard's weekly lists (app 366, « URBANISME » 3120: `dépôts ADS`
 * and `Autorisations ADS`), scans the sweep's OCR reads. « Dossiers déposés
 * avant le 2 octobre 2026 » (filings: Date de dépôt | Numéro de dossier |
 * Pétitionnaire | Adresse du projet | Description du projet) and « Dossiers
 * décidés jusqu'au 2 octobre 2026 » (decisions: Numéro de dossier |
 * Pétitionnaire | Décision | Date de signature | Nature des travaux | Adresse
 * des travaux | Surface, a title per family between its rows) hang each cell
 * from its row's first line, the number — `DP 095491 26` over `00065` — in
 * its own column. The header repeats on every page and its words give the
 * columns' edges; a row the page breaks takes the next page's lines before
 * its first. Signs (`AP`) and ERP works (`AT`) are no Sitadel permits: no
 * row. The date the signing column prints can be unreadable (`21/09/202€`):
 * the decision then has no day. The applicant is an organisation's name or
 * nothing.
 */
export function readPlessisBouchardList(document, { city, file }) {
  const board = file?.board === 'decisions' ? 'decisions' : 'filings';
  const specs = PLESSISB_HEADS[board];
  const rows = [];
  let header = null;
  let current = null;
  for (const page of document?.pages ?? []) {
    // The commune's stamp runs up the right margin: OCR reads it as stray letters.
    // The table's rules read as `|` and `_` words.
    const words = (page.runs ?? []).filter((run) => clean(run.text) && !/^[|¦_]+$/.test(clean(run.text)) && run.x < (page.width ?? Infinity) - 40);
    const found = plessisbHeader(words, specs, header);
    if (found) header = found;
    if (!header) continue;
    // The header's words sit within a few points of its first line, `signature` a line under it.
    const body = words.filter((run) => (found ? run.y < found.y - 12 : true)
      && !(found && run.y > found.y - 26 && /^SIGNATURE$/.test(foldWord(run.text))));
    const columnOf = (run) => header.columns.findLast((column) => column.x - 8 <= run.x)?.field ?? header.columns[0].field;
    for (const line of ocrLines(body, 2.5)) {
      if (PLESSISB_NOISE_RE.test(line.text)) continue;
      const cells = {};
      for (const run of line.runs) (cells[columnOf(run)] ??= []).push(run.text);
      const head = clean((cells.dossier ?? []).join(' '));
      if (PLESSISB_HEAD_RE.test(head)) {
        current = { top: line.y, cells: {} };
        rows.push(current);
      } else if (PLESSISB_SECTION_RE.test(line.text) && line.runs[0].x < header.columns.find((column) => column.field === 'dossier').x + 20) {
        current = null;
        continue;
      }
      if (!current) continue;
      for (const [field, texts] of Object.entries(cells)) {
        // A number's counter, wrapped under its family; nothing else lives in this column.
        if (field === 'dossier' && current.cells.dossier && current.top - line.y > 24) continue;
        (current.cells[field] ??= []).push(clean(texts.join(' ')));
      }
    }
  }
  return rows.flatMap((row) => {
    const dossier = municipalDossier(clean((row.cells.dossier ?? []).join(' ')), city);
    // A stray letter the stamp's margin leaves after the town.
    const site = municipalSite(clean((row.cells.site ?? []).join(' ')).replace(/^[^\p{L}\d]+/u, '').replace(/\s+[a-zà-ÿ]$/, ''), city);
    if (!dossier || !site.address || /^CU\b/.test(dossier)) return [];
    const day = (field) => plessisbDay((row.cells[field] ?? []).join(' '), file?.published);
    return [{
      board, dossier, applicant: reportApplicant(row.cells.applicant), address: site.address, postcode: site.postcode, parcels: site.parcels,
      purpose: clean((row.cells.purpose ?? []).join(' ')) || null,
      filedOn: board === 'filings' ? day('filedOn') : null, postedOn: file?.published ?? null,
      // OCR reads `Favorable` as `Favorabie`.
      verdict: board === 'decisions' ? listVerdict((verdictCell(row.cells.verdict) ?? '').replace(/^fav\w{3,}/i, 'Favorable')) ?? verdicts.signed.fr : null,
      decidedOn: board === 'decisions' ? day('decidedOn') : null,
    }];
  });
}

// --- Small towns posting the State's frames: dematdoc's reading, mended -------

// i18n-ignore-start — the acts' own words, matched on
/** A short number a title types: `DP2600033`, `DP 2600019`, `DP26000028`, `DP260027` — kind, year, counter. */
const FRAME_SHORT_RE = /\b(PC|DP|PA|PD)\s*(\d{2})(\d{3,6})(?!\d)/i;
/** Bussang's: `DP 39 2026 …` — kind, counter, year. */
const FRAME_LOCAL_RE = /\b(PC|DP|PA|PD)\s+(\d{1,3})\s+20(\d{2})\b/i;
const FRAME_OPENING_RE = /(?:^|\n)\s*ARTICLE\s*(?:1(?:ER)?|I|L|PREMIER|UNIQUE)\b\s*[:.\-–]?/i;
const FRAME_SECOND_RE = /\n\s*ARTICLE\s*(?:2|II|DEUX)\b/i;
const FRAME_REFUSED_RE = /\b(?:NE\s+SONT\s+PAS|N.EST\s+PAS|NE\s+PEUT\s+PAS|NE\s+PEUVENT\s+PAS)\s+(?:ETRE\s+)?(?:AUTORISE|ACCORDE)|\b(?:EST|SONT)\s+REFUSEE?S?\b/;
/** « Avis de dépôt affiché le 25/08/2026 », stamped on an order that carries the commune's frame. */
const FRAME_POSTED_FILING_RE = /^Avis\s+de\s+d[ée]p[ôo]t\s+affich/i;
/** « ARGANCY, le 03/09/2026 »: the town and the day an order is signed. */
const FRAME_SIGNED_RE = /(?:^|\n)\s*\p{Lu}[\p{Lu}'’ -]{2,},?\s+le\s+(\d{1,2})[./](\d{1,2})[./](\d{4})\b/u;
/** « Date du dépôt : 10/09/2026 », the State's labelled notice. */
const FRAME_FILED_LABEL_RE = /Date\s+(?:du|de)\s+d[ée]p[ôo]t(?:\s+de\s+la\s+demande)?\s*:?\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/i;
/** « Nature du projet : Réfection complète de toiture », which dematdoc's reader does not label. */
const FRAME_NATURE_RE = /(?:^|\n)\s*[\W_]{0,6}\s*Nature\s+(?:du\s+projet|des\s+travaux)\s*:\s*([^\n]{3,200})/i;
/** The value a frame's cadastre label carries: « Références cadastrales : AD 0288 », « Parcelle(s) : B 929 ». */
const FRAME_CADASTRE_RE = /(?:Cadastr[ée]e?|R[ée]f[ée]rences?\s+cadastrales?|Parcelles?(?:\(s\))?)\s*(?:section)?\s*[:|]\s*([^\n]{2,80})/i;
/** Parcels as the cadastre writes them: a section of one or two letters and a number, any spacing. */
const FRAME_PARCELS_ONLY_RE = /^[A-Z]{1,2}\s*0*\d{1,4}(?:\s*(?:,|;|et|\/)?\s*[A-Z]{1,2}\s*0*\d{1,4})*$/;
/** A site that names a number or a way: « 71 Grand Rue », « Impasse du Moulin », not a lieu-dit alone. */
const FRAME_SITE_WORDS_RE = /\d|\b(?:rue|chemin|avenue|all[ée]e|route|impasse|place|boulevard|quai|lotissement|lot|lieu[- ]?dit|cours|square|voie|hameau|r[ée]sidence|domaine|clos|sentier|passage|faubourg|esplanade|zac)\b/i;
const FRAME_RECITALS_RE = /^(?:Vu|VU)\b/;
const FRAME_PURPOSE_TAIL_RE = /\s+(?:(?:Nb de logements?|Nombre de logements?|Surface(?: de plancher)?|Superficie|Destinations?|Hauteur)\b|Logement\(s\)).*$/i;
const FRAME_ADDRESS_LABEL_RE = /^(?:du projet|des travaux|du terrain)\s*:\s*/i;
const FRAME_ADDRESS_TAIL_RE = /\s+(?:R[ée]f[ée]rences?\s+cadastrales?|Cadastr[ée]e?|Parcelles?)\b.*$/i;
/** A site cut off on a preposition: the town it lost was part of its name. */
const FRAME_DANGLING_RE = /\s(?:de|du|des|de la|d[’']|la|le|les|l[’'])$/i;
const FRAME_STREET_RE = /^(?:rue|impasse|chemin|route|all[ée]e|avenue|place|lotissement|lieu-dit)\b/i;
// i18n-ignore-end

/**
 * The number a title types, as Sitadel keys it, or null: a full number
 * (`DP 057 554 26 00022`) as it stands; a short one — kind, year and counter
 * (`DP2600033`, `DP 2600019`), or kind, counter and year (`DP 39 2026`) —
 * with the town's code put in; the change the title adds (`M01`) kept.
 */
export function frameTitleNumber(title, city) {
  const text = clean(title).replace(/_/g, ' ');
  // A number carrying the town's code: `municipalDossier` alone would read `DP 39 2026` as year 39.
  const found = text.replace(/\s+/g, '').includes(city.insee) ? municipalDossier(text, city) : null;
  if (found) return withTitleChange(found, text);
  const short = FRAME_SHORT_RE.exec(text);
  const local = short ? null : FRAME_LOCAL_RE.exec(text);
  if (!short && !local) return null;
  const [kind, year, counter] = short ? [short[1], short[2], short[3]] : [local[1], local[3], local[2]];
  const dossier = municipalDossier(`${kind.toUpperCase()} ${city.insee.padStart(6, '0')} ${year} ${String(Number(counter)).padStart(5, '0')}`, city);
  return dossier ? withTitleChange(dossier, text) : null;
}

/** The heading's lines, the operative article's first sentence and the recitals' start, as an act prints them. */
function frameParts(document) {
  const lines = (document?.pages ?? []).flatMap((page) => ocrLines(page.runs ?? [], 4)).map((line) => line.text);
  const body = lines.join('\n');
  const opening = FRAME_OPENING_RE.exec(body);
  const article = opening ? body.slice(opening.index + opening[0].length, opening.index + opening[0].length + 400).split(FRAME_SECOND_RE)[0] : '';
  const said = article.replace(/retrait[-\s]+gonflement/gi, '').split(/(?<=[.;])\s/)[0];
  const recitals = lines.findIndex((line) => FRAME_RECITALS_RE.test(line));
  const heading = lines.slice(0, recitals < 0 ? 14 : Math.min(recitals, 24)).map((line) => line.replace(/retrait[-\s]+gonflement/gi, ''));
  return { said, article, heading };
}

/**
 * The verdict an act states in its own words, which dematdoc's reader misses
 * when OCR reads `Article 1` as `Article I`, when the verdict is only in the
 * heading (« ARRÊTÉ n°145/2026 de non-opposition … » over a bare « Article
 * unique »), or when it is an « OPPOSITION » (« décision d'OPPOSITION ») —
 * never from the recitals, whose « retrait-gonflement » is no withdrawal.
 */
function frameVerdict(document) {
  const { said, heading } = frameParts(document);
  const stated = (text) => municipalVerdict(text) ?? (/\bD.OPPOSITION\b/.test(foldWord(text)) ? verdicts.refused.fr : null);
  return stated(said) ?? stated(heading.join(' '));
}

/**
 * A refusal the article words as a negation (« Les travaux ne sont pas
 * autorisés ») or the heading names (« REFUS DE DÉCLARATION PRÉALABLE »),
 * which dematdoc's reader takes for a grant on the word « autorisés ».
 */
function frameRefused(document) {
  const { said, heading } = frameParts(document);
  return FRAME_REFUSED_RE.test(foldWord(said)) || heading.some((line) => /^REFUS\b/.test(foldWord(line)));
}

/** The town's name as its label gives it: `Commune de Saulcy-sur-Meurthe — …` → `Saulcy-sur-Meurthe`. */
const frameTown = (city) => clean(String(city?.label ?? '').split(/\s+[—–]\s+/)[0].replace(/^(?:Ville|Commune)\s+(?:de la |de l[’']|de |d[’']|du |des )/i, ''));

/** A site without the label's remains, the town after it, the cadastre beside it, or the stray mark OCR leaves before its number. */
function frameAddress(address, city) {
  let text = clean(String(address ?? '').split(/\s[|¦]\s/)[0]).replace(FRAME_ADDRESS_LABEL_RE, '').replace(FRAME_ADDRESS_TAIL_RE, '');
  const lonely = clean(withoutTown(text, { label: frameTown(city) }));
  // A town that ends the name of a street or a lotissement stays: « Lotissement les Hauts de Vigy » is no « … Hauts de ».
  // The bracket that opens an aside the site's line cut short (« A31 - [sortie Maizières-… ») goes with it.
  text = (FRAME_DANGLING_RE.test(lonely) ? text : lonely).replace(/\s*[-–]?\s*\[.*$/, '').replace(/^[^\p{L}\d]+/u, '');
  // « S rue de la Chapelle » is a 5, « Ÿ Impasse … » a number OCR lost.
  if (/^S\s+/.test(text) && FRAME_STREET_RE.test(text.slice(2))) text = `5 ${text.slice(2)}`;
  else if (/^\p{Lu}\s+/u.test(text) && FRAME_STREET_RE.test(text.slice(2))) text = text.slice(2);
  return text;
}

/** The act without the table borders OCR reads as words and the lines that date its filing's posting (see {@link readFrameAct}). */
function withoutFilingMarks(document) {
  return {
    ...document,
    pages: (document?.pages ?? []).map((page) => ({
      ...page,
      runs: ocrLines((page.runs ?? []).filter((run) => !/^[|¦]+$/.test(clean(run.text))), 4)
        .filter((line) => !FRAME_POSTED_FILING_RE.test(line.text)).flatMap((line) => line.runs),
    })),
  };
}

/**
 * The State's frame of a permit act — « Dossier n° DP 088 011 2600026 », « Sur
 * un terrain sis : », « Nature des travaux » — or a notice of filing, read by
 * `dematdoc-notice` (the number, the site, the parcels, the filing day, the
 * board and the verdict from the act itself) and mended where small towns'
 * scans trip it: a number OCR lost is the title's (`frameTitleNumber`), with
 * the change the title adds; a verdict dematdoc leaves as signed is looked for
 * again (`frameVerdict`); the works stop before the frame's next label
 * (« Logement(s) démoli(s) », « Superficie du terrain »), the site before the
 * town and the cadastre. Certificates (`CU`) and the other kinds are no
 * permit: no row. Nothing of the title is read but its number.
 */
export function readFrameAct(document, context) {
  const { city, file } = context;
  const title = clean(file?.title).replace(/_/g, ' ');
  const typed = frameTitleNumber(title, city);
  const read = (scanned) => readDematdocNotice(scanned, { city, file: { ...file, title: `${typed ?? ''} ${title}` } });
  let found = read(document);
  // On an order's shelf, an act read as a filing is read again without what hides its heading: the table border OCR
  // reads as a word (« PERMIS DE DÉMOLIR | DELIVRE PAR LE MAIRE », with the parcel « AD » read as an avis d'affichage),
  // and the line where the commune stamps the day it posted the filing (« Avis de dépôt affiché le 25/08/2026 »).
  if (file?.board === 'decisions' && found.some((row) => row.board === 'filings')) found = read(withoutFilingMarks(document));
  // dematdoc's reader takes a site that ends on « rue » for a street cut at the end of its line (« 71 Grand Rue »,
  // « 28 Grand'rue »): the Amnéville scan reading, which knows the label's value, gives the row.
  // A lieu-dit alone (« Sur un terrain sis à : ANOZEL ») is no site there either, as in dematdoc's reader.
  if (!found.length) found = readScannedNotice(document, { city, file: { ...file, title: `${typed ?? ''} ${title}` } }).filter((row) => FRAME_SITE_WORDS_RE.test(row.address ?? ''));
  return found.flatMap((row) => {
    if (!/^(?:PC|DP|PA|PD) /.test(row.dossier)) return [];
    const address = frameAddress(row.address, city);
    if (!/\p{L}{2,}/u.test(address)) return [];
    // The instructing software's code in front of the works (`9990001150 : Pose …`) is no words of theirs.
    const works = row.purpose ?? FRAME_NATURE_RE.exec(frameBody(document))?.[1];
    const purpose = clean(String(works ?? '').replace(/\s*[|¦]\s*/g, ' ').replace(/\s*\[[\d,\s]+\]/g, '').replace(FRAME_PURPOSE_TAIL_RE, '').replace(/^\d{8,}\s*:?\s*/, '')).replace(/[\s:;,-]+$/, '') || null;
    const verdict = row.board === 'decisions' && frameRefused(document) ? verdicts.refused.fr
      : row.board === 'decisions' && row.verdict === verdicts.signed.fr ? frameVerdict(document) ?? row.verdict : row.verdict;
    const { filedOn, decidedOn } = frameDays(row, document);
    return [{ ...row, dossier: withTitleChange(row.dossier, title), address, parcels: frameParcels(row, document), purpose, verdict, filedOn, ...(row.board === 'decisions' ? { decidedOn } : {}) }];
  });
}

/**
 * The parcels dematdoc's reader took, unless the label that names them carries
 * something else: Pournoy's « Références cadastrales : 57554 05 344 » (the
 * commune's code, a numbered section, a number) read as « OU 1 » is no parcel
 * of the cadastre's lettered sections. A frame whose label stands apart keeps
 * what was read.
 */
function frameParcels(row, document) {
  if (!row.parcels) return row.parcels ?? null;
  const value = FRAME_CADASTRE_RE.exec(frameBody(document))?.[1];
  const said = value ? clean(value.replace(/[|¦]/g, ' ')).replace(/[\s.]+$/, '') : null;
  return !said || FRAME_PARCELS_ONLY_RE.test(said.toUpperCase()) ? row.parcels : null;
}

/** The act's lines, one per baseline, joined. */
const frameBody = (document) => (document?.pages ?? []).flatMap((page) => ocrLines(page.runs ?? [], 4)).map((line) => line.text).join('\n');

/**
 * The days dematdoc's reader leaves out: the filing day a frame dots (« Vu la
 * Déclaration Préalable susvisée déposée le 24.08.2026 ») and the day an
 * order is signed, the line « ARGANCY, le 03/09/2026 » under its article —
 * when it falls between the filing and the posting.
 */
function frameDays(row, document) {
  const body = frameBody(document);
  const dotted = ENNERY_FILED_RE.exec(body) ?? FRAME_FILED_LABEL_RE.exec(body);
  const filedOn = row.filedOn ?? (dotted ? municipalDate(`${dotted[1].padStart(2, '0')}/${dotted[2].padStart(2, '0')}/${dotted[3]}`) : null);
  const signed = FRAME_SIGNED_RE.exec(body);
  const day = signed ? municipalDate(`${signed[1].padStart(2, '0')}/${signed[2].padStart(2, '0')}/${signed[3]}`) : null;
  const plausible = day && (!filedOn || day >= filedOn) && (!row.postedOn || day <= row.postedOn);
  // A day dematdoc read off a stamp or a signature (« 2046-04-27 ») counts only between the filing and the posting.
  const kept = row.decidedOn && (!filedOn || row.decidedOn >= filedOn) && (!row.postedOn || row.decidedOn <= row.postedOn) ? row.decidedOn : null;
  return { filedOn, decidedOn: kept ?? (plausible ? day : null) };
}


// --- Saulcy-sur-Meurthe: receipts that print the site in their project line ---

// i18n-ignore-start — the receipt's own words, matched on
const SAULCY_NUMBER_RE = /fait l.objet d.une?\s+(?:d[ée]claration|demande)[^,]{0,40}?n°\s*((?:PC|DP|PA|PD)\s*[\d\s]{6,12}\s*[A-Z]?\s*\d{4,5})/i;
const SAULCY_FILED_RE = /d[ée]pos[ée]e?\s+[àa]\s+la\s+mairie\s+le\s*:?\s*(\d{1,2}(?:er)?\s+\p{L}+\s+20\d{2}|\d{1,2}\/\d{1,2}\/20\d{2})/iu;
const SAULCY_PROJECT_RE = /\bProjet\s*:\s*(.+?)\s+(?:est autoris|fera l.objet)/is;
/** The site closes the project line, in quotes: `… au « 17 rue de l'Ancien Séminaire »`, `… lot à bâtir « 5 rue … »`. */
const SAULCY_SITE_RE = /^(.*?)(?:\s+au\b)?\s*[“"«]\s*([^“"«»”]+?)\s*[”"»]?\s*$/isu;
/** …or, its quotes lost, after the last `au` that precedes a house number. */
const SAULCY_BARE_SITE_RE = /^(.*)\s+au\s+(\d.*?)[\s.]*$/isu;
// i18n-ignore-end

/**
 * Saulcy-sur-Meurthe's receipts (app 400, « URBANISME »: 6082 the DP, 6087 the
 * PC), scans of the State's form whose « cadre réservé à la mairie » is typed:
 * « Le projet ayant fait l'objet d'une déclaration n° DP 088 445 26 H 0047,
 * déposée à la mairie le : 25 septembre 2026, / Par Monsieur … / Projet:
 * création d'une pergola de 24 m² au "1 rue de Bémont" est autorisé … ».
 * The number is the one the orders print (the instructing service's letter H
 * before the counter), the site the end of the project line, the works what
 * precedes it; « Par … » is the applicant's and never read.
 */
export function readSaulcyReceipt(document, { city, file }) {
  const body = (document?.pages ?? []).slice(0, 2).flatMap((page) => ocrLines(page.runs ?? [], 4)).map((line) => line.text).join(' ');
  const number = SAULCY_NUMBER_RE.exec(body)?.[1];
  const dossier = number ? municipalDossier(clean(number).replace(/\b([A-Z])\s+(\d{4})\b/g, '$1$2'), city) : null;
  const project = SAULCY_PROJECT_RE.exec(body)?.[1];
  const split = project ? SAULCY_SITE_RE.exec(clean(project)) ?? SAULCY_BARE_SITE_RE.exec(clean(project)) : null;
  const site = split ? frameAddress(split[2], city) : null;
  if (!dossier || !site || !/\p{L}{2,}/u.test(site) || !/^(?:PC|DP|PA|PD) /.test(dossier)) return [];
  return [{
    board: 'filings', dossier, applicant: null, ...municipalSite(site, city), purpose: clean(split[1]) || null,
    filedOn: municipalDate(SAULCY_FILED_RE.exec(body)?.[1]), postedOn: file?.published ?? null, verdict: null,
  }];
}

// --- Argancy: receipts typed in their cadre, the site in the file's title ------

// i18n-ignore-start — the receipt's own words and the commune's villages, matched on
const ARGANCY_NUMBER_RE = /fait l.objet d.une?\s+(?:d[ée]claration|demande)[^,]{0,40}?n°\s*((?:PC|DP|PA|PD)\s*[\d\s]{6,20}?)\s*[,.]/i;
const ARGANCY_CADRE_RE = /Le\s+projet\s+ayant\s+fait\s+l.objet/ig;
const ARGANCY_PROJECT_RE = /\bpour\s*:?\s*(.+?)\s+(?:est autoris|fera l.objet)/is;
const ARGANCY_VILLAGE_RE = /\s+[àa]\s+(?:Argancy|Olgy|Rugy)\b[\s+àa|.-]*$/i;
/** The title is the site: `36 rue de Bussière à Argancy`, `rue des Grandes Chenevières à Rugy` — a street and nothing else. */
const ARGANCY_TITLE_RE = /^((?:\d{1,3}\s*(?:bis|ter|[a-d])?\s+)?(?:rue|impasse|chemin|route|all[ée]e|avenue|place|lotissement|lieu-dit)\b[\p{L}\d\s'’.-]*?)(?:\s+[àa]\s+(?:Argancy|Olgy|Rugy))?$/iu;
// i18n-ignore-end

/**
 * Argancy's receipts (app 438, « URBANISME » 6514), the State's form whose «
 * cadre réservé à la mairie » is typed under the stamp: « Le projet ayant fait
 * l'objet d'une demande de permis n°DP 57 028 2600058, déposée à la mairie le :
 * 22/09/2026, pour : ravalement de façade … à Argancy est autorisé … ». The
 * form names no site: the commune titles each file by it (« 36 rue de Bussière
 * à Argancy »), the village after it taken off. The applicant, never in the
 * cadre, is never read; a title that is not a street gives no row.
 */
export function readArgancyReceipt(document, { city, file }) {
  const text = (document?.pages ?? []).slice(0, 2).flatMap((page) => ocrLines(page.runs ?? [], 4)).map((line) => line.text).join(' ');
  // The form's own text says « pour attester … »: only what follows « Le projet ayant fait l'objet » is the commune's.
  const cadre = [...text.matchAll(ARGANCY_CADRE_RE)].at(-1);
  const body = cadre ? text.slice(cadre.index).replace(/Cachet de la mairie/gi, ' ') : '';
  const number = ARGANCY_NUMBER_RE.exec(body)?.[1];
  const dossier = number ? municipalDossier(clean(number), city) : null;
  const street = ARGANCY_TITLE_RE.exec(clean(file?.title).replace(/_/g, ' '))?.[1];
  if (!dossier || !street || !/^(?:PC|DP|PA|PD) /.test(dossier)) return [];
  const works = ARGANCY_PROJECT_RE.exec(body)?.[1];
  return [{
    board: 'filings', dossier, applicant: null, ...municipalSite(clean(street), city),
    purpose: clean(String(works ?? '').replace(/[|¦]/g, ' ').replace(ARGANCY_VILLAGE_RE, '')) || null,
    filedOn: municipalDate(SAULCY_FILED_RE.exec(body)?.[1]), postedOn: file?.published ?? null, verdict: null,
  }];
}

// --- Bussang: one-sentence notices of filing ------------------------------------

// i18n-ignore-start — the notice's own words, matched on
const BUSSANG_FILED_RE = /\bLe\s+(\d{1,2})\s*(?:er|%)?\s+(\p{L}+)\s+(20\d{2})\s+a\s+[ée]t[ée]\s+d[ée]pos[ée]/iu;
const BUSSANG_CONCERNING_RE = /\bconcernant\s+(.+?)\s*(?:Affich[ée]e?\s+le\b.*)?$/is;
/** The site closes the sentence after its last « au », a house number first: `… pour la cuisine au 33 Rue du 19ème BCP.` */
const BUSSANG_SITE_RE = /^(.*)\s+au\s+(\d+\s*(?:bis|ter|[a-d])?\s+\p{L}.*?)[\s.]*$/isu;
// i18n-ignore-end

/**
 * Bussang's notices of filing (app 267, « Urbanisme » 2797: « DP 30 2026
 * <name> … depot »), a page of one sentence under its number: « Le 7 août
 * 2026 a été déposé en Mairie par Mme … un dossier de Déclaration Préalable
 * concernant la construction d'une extension pour la cuisine au 33 Rue du
 * 19ème BCP. Affiché le 11 août 2026 ». The applicant, named between « par »
 * and « un dossier », is never read; the works and the site follow
 * « concernant », the site after the last « au » when a house number leads it.
 * Certificates (`CUb …`) share the shelf and give no row.
 */
export function readBussangNotice(document, { city, file }) {
  const lines = (document?.pages ?? []).slice(0, 1).flatMap((page) => ocrLines(page.runs ?? [], 4)).map((line) => line.text);
  const dossier = municipalDossier(lines.join(' '), city);
  if (!dossier || !/^(?:PC|DP|PA|PD) /.test(dossier)) return [];
  const body = lines.join(' ');
  const concerning = BUSSANG_CONCERNING_RE.exec(body.slice(Math.max(0, body.search(/\bconcernant\b/i))))?.[1];
  const split = concerning ? BUSSANG_SITE_RE.exec(clean(concerning)) : null;
  if (!split) return [];
  const site = frameAddress(split[2], city);
  if (!/\p{L}{2,}/u.test(site)) return [];
  const filed = BUSSANG_FILED_RE.exec(body);
  return [{
    board: 'filings', dossier, applicant: null, ...municipalSite(site, city), purpose: clean(split[1]) || null,
    filedOn: filed ? municipalDate(`${filed[1]} ${filed[2]} ${filed[3]}`) : null, postedOn: file?.published ?? null, verdict: null,
  }];
}

export const DIGILOR_D_BOARD_READERS = Object.freeze({
  'digilor-plessisb-list': readPlessisBouchardList,
  'digilor-frame-act': readFrameAct,
  'digilor-saulcy-receipt': readSaulcyReceipt,
  'digilor-argancy-receipt': readArgancyReceipt,
  'digilor-bussang-notice': readBussangNotice,
  'digilor-grandquevilly-order': readGrandQuevillyOrder,
  'digilor-plessis-receipt': readPlessisReceipt,
  'digilor-plessis-order': readPlessisOrder,
  'digilor-lattes-order': readLattesOrder,
  'digilor-chatel-act': readChatelAct,
  'digilor-jarville-act': readJarvilleAct,
  'digilor-alsace-list': readAlsaceList,
  'digilor-nilvange-list': readNilvangeList,
  'digilor-crehange-register': readCrehangeRegister,
  'digilor-longeville-act': readLongevilleAct,
  'digilor-morhange-order': readMorhangeOrder,
  'digilor-ennery-order': readEnneryOrder,
});
/** Text PDFs of the frames are read as dematdoc's are: the notices print their labels with narrow gaps. */
export const DIGILOR_D_BOARD_TEXT = Object.freeze({
  'digilor-frame-act': Object.freeze({ wordGapEm: 0.15 }),
});
