/**
 * PDF readers for the Digilor Datahall towns of batch C (`digilorTownsC.js`),
 * by `layout`. See `permitBoards.js` for the contract.
 *
 * Applicants: never a person. Every town here prints the applicant's name,
 * and most their address, beside the site; the readers take the site from its
 * own label only and never return an applicant.
 */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';
import { readExtendedNotice } from './municipalPermitExtensions.js';
import { listVerdict } from './permitBoardsLists.js';
import { paddedDay, readReportTable, reportApplicant, reportDossier } from './permitBoardsReports.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const joined = (lines) => clean((lines ?? []).join(' ')) || null;
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

/** Runs on one height, joined left to right, as lines top to bottom. */
function textLines(runs, tolerance = 2) {
  const lines = [];
  for (const run of [...runs].sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - run.y) < tolerance) line.runs.push(run);
    else lines.push({ y: run.y, runs: [run] });
  }
  return lines.map((line) => ({ y: line.y, x: Math.min(...line.runs.map((run) => run.x)),
    text: clean(line.runs.sort((a, b) => a.x - b.x).map((run) => run.text).join(' ')) }));
}

/** `DP 054 159 26 D 0162`: the letter of the instructing service glued back to its counter. */
const dossierText = (value) => clean(value).replace(/\b([A-Z])\s+(\d{4})\b/g, '$1$2');

/**
 * The words of the first article, up to the next one or the signature — `Fait
 * à`, `AMNEVILLE, le 16/09/2026`, `Le Maire` — or the notes printed after it,
 * whose « retrait » and « recours » are no verdict: Amnéville warns of the
 * clay's « retrait-gonflement » right under its first article. 600
 * characters at most.
 */
function operative(body) {
  const at = /\bArticle\s+(?:1(?:er)?|premier|unique)\b\s*[:.\-–]?/i.exec(body);
  if (!at) return '';
  const from = at.index + at[0].length;
  return body.slice(from, from + 600)
    .split(/\bArticle\s+(?:2|deux)\b|\bFait\s+[àa]\s|^[^\n]{0,60},\s*le\s+\d|^Le Maire\b|\bINFORMATIONS\b|^Document publi|\b(?:est|sont) informée?s? que\b/im)[0]
    .replace(/retrait[-\s]+gonflement/gi, '');
}

/**
 * The verdict a first article states, in its own words only (« est ACCORDÉ
 * », « Il n'est pas fait opposition », « est retiré »): a scan's pages can come
 * out of order, and the notes that then follow « Article 1 » say the authority
 * « peut le retirer » — no withdrawal.
 */
function orderVerdict(text) {
  const words = fold(text).replace(/[’']/g, "'");
  if (/NON[- ]?OPPOSITION|PAS FAIT OPPOSITION/.test(words)) return verdicts.unopposed.fr;
  if (/\b(?:EST|SONT) (?:FAIT )?OPPOSITION\b|\bREFUS/.test(words)) return verdicts.refused.fr;
  if (/\b(?:EST|SONT) (?:RETIRE|ANNULE)E?S?\b|\bRETRAIT D/.test(words)) return verdicts.withdrawn.fr;
  if (/\bACCORDEE?S?\b|\bAUTORISEE?S?\b|\bFAVORABLE/.test(words)) return /TACITE/.test(words) ? verdicts.tacit.fr : verdicts.granted.fr;
  return null;
}

// --- Dombasle-sur-Meurthe: one notice or order per PDF ----------------------

// i18n-ignore-start — the orders' own labels, matched on
const DOMBASLE_LABEL_RE = /^(Dossier n°|Date de d[ée]p[ôo]t|Compl[ée]t[ée]e? le|Demandeur|Pour|Adresse (?:du )?terrain|R[ée]f[ée]rences?(?:\(s\))? cadastrales?(?:\(s\))?)\s*:?\s*(.*)$/i;
// i18n-ignore-end

/**
 * Dombasle-sur-Meurthe's acts, one PDF per dossier on « URBANISME »: the
 * avis de dépôt (« N° de dossier », « Adresse du terrain », the layout
 * `extended-notice` reads) and the orders its instruction software prints —
 * a frame of labelled lines on the right (« Dossier n° DP 054 159 26 D 0162 »,
 * « Date de dépôt », « Demandeur », « Pour », « Adresse terrain : 24 rue … à
 * » / « DOMBASLE-SUR-MEURTHE 54110 », « Référence(s) cadastrale(s) »), the
 * recitals, then « Article 1 » and its verdict. The order is signed
 * electronically and prints no day: the day is the act's, in the reference
 * of its transmission to the prefecture (« 054-215401597-20261001-DP26D0162-AI »).
 * Measured on 2026-10-03: three orders of September 2026, each with its site
 * and verdict.
 */
export function readDombasleAct(document, { city, file }) {
  if (file?.board !== 'decisions') {
    // The notices write their number unspaced (`D0192`) but the odd one.
    const pages = (document?.pages ?? []).map((page) => ({ ...page, runs: (page.runs ?? []).map((run) => ({ ...run, text: dossierText(run.text) })) }));
    return readExtendedNotice({ ...document, pages }, { city, file: { ...file, title: dossierText(file?.title) } });
  }
  const page = document?.pages?.[0];
  if (!page) return [];
  const lines = textLines((page.runs ?? []).filter((run) => clean(run.text)));
  const order = lines.findIndex((line) => /^ARR[ÊE]T[ÉE]$/i.test(line.text));
  // The frame is the right half above the title: « REPUBLIQUE FRANCAISE » shares its first line.
  const top = order < 0 ? -Infinity : lines[order].y;
  const frame = textLines((page.runs ?? []).filter((run) => clean(run.text) && run.x > 250 && run.y > top));
  const fields = new Map();
  let last = null;
  for (const line of frame) {
    const match = DOMBASLE_LABEL_RE.exec(line.text);
    if (match) { last = fold(match[1]).slice(0, 7); fields.set(last, [match[2]]); } else if (last) fields.get(last).push(line.text);
  }
  const field = (key) => clean((fields.get(key) ?? []).join(' '));
  const dossier = municipalDossier(dossierText(field('DOSSIER')), city) ?? municipalDossier(dossierText(file?.title), city);
  if (!dossier) return [];
  // `24 rue des Mésanges à DOMBASLE-SUR-MEURTHE 54110`.
  const site = municipalSite(field('ADRESSE').replace(/\s+[àa]\s+DOMBASLE\b.*$/i, '').replace(/\s+DOMBASLE-SUR-MEURTHE\b.*$/i, ''), city);
  const parcels = [...field('REFEREN').matchAll(/\b([A-Z]{1,2})\s*(\d{1,4})\b/g)].map((m) => `${m[1]} ${m[2]}`);
  if (!site.address && !parcels.length) return [];
  const body = (document.pages ?? []).flatMap((item) => textLines(item.runs ?? [])).map((line) => line.text).join('\n');
  const heading = lines.slice(order + 1, order + 3).map((line) => line.text).join(' ');
  const act = /\b\d{3}-\d{9}-(\d{4})(\d{2})(\d{2})-/.exec(body);
  return [{
    board: 'decisions', dossier, applicant: null, address: site.address, postcode: site.postcode,
    parcels: parcels.length ? parcels.join(', ') : null, purpose: field('POUR') || null, // i18n-ignore-line — the notice's own label, matched on
    filedOn: municipalDate(field('DATE DE')),
    verdict: municipalVerdict(operative(body)) ?? municipalVerdict(heading) ?? verdicts.signed.fr,
    decidedOn: act ? `${act[1]}-${act[2]}-${act[3]}` : null,
    postedOn: file?.published ?? null,
  }];
}

// --- Weekly tables of dossiers -----------------------------------------------

// i18n-ignore-start — the tables' own headers and family titles
/** A number's first line, family and commune: `DP 029051 26`, `AT 029051`. */
const HEAD_RE = /^(?:PC|DP|PA|PD|CU|AT|AP)\s*\d/;
const FAMILY_RE = /^(?:D[ÉE]CLARATION PR[ÉE]ALABLE|PERMIS (?:DE|D'|D’)|AUTORISATION (?:PR[ÉE]ALABLE|DE TRAVAUX)|CERTIFICAT D|SUPPORTANT DE LA PUBLICIT)/i;
const ERGUE_COLUMNS = [
  ['filedOn', 'DATE DEPOT'], ['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'PETITIONNAIRE'],
  ['site', 'ADRESSE DU PROJET'], ['purpose', 'DESCRIPTION DU PROJET'],
];
const PONT_DE_CLAIX_COLUMNS = [
  ['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'PETITIONNAIRE'], ['verdict', 'DECISION'], ['decidedOn', 'DATE DE'],
  ['purpose', 'NATURE DES TRAVAUX'], ['site', 'ADRESSE DES TRAVAUX'], ['floor', 'SURFACE'],
];
const TABLE_NOISE = /^(?:Page \d+ sur \d+|Document publi[ée] le .*)$/i;
// i18n-ignore-end

/** A table row with every field of the archive, those the town does not print null. */
function tableRow(city, board, fields) {
  const site = municipalSite(fields.site, city);
  return {
    board, dossier: fields.dossier, applicant: fields.applicant ?? null, address: site.address, postcode: site.postcode,
    parcels: site.parcels, purpose: fields.purpose ?? null, filedOn: fields.filedOn ?? null,
    verdict: fields.verdict ?? null, decidedOn: fields.decidedOn ?? null, postedOn: fields.postedOn ?? null,
  };
}

/**
 * Ergué-Gabéric's weekly list (« Affichage des AOS 280926_051026 », « ADS
 * 14-09-26 »): « Dossiers déposés au 28 septembre 2026 », every dossier still
 * under instruction, a family to a section (« DECLARATION PREALABLE … ») and a
 * row per dossier under Date dépôt | Numéro de dossier | Pétitionnaire |
 * Adresse du projet | Description du projet, every cell left-aligned under its
 * header and hanging from the row's top: the street, then the postcode and
 * town.
 */
export function readErgueList(document, { city, file }) {
  return readReportTable(document, {
    columns: ERGUE_COLUMNS, rule: 'nearest', place: 'top', head: HEAD_RE, noise: TABLE_NOISE,
    anchor: (text) => reportDossier(text, city),
    section: (text) => (FAMILY_RE.test(text) ? { title: text } : null),
    build: (cells, section, dossier) => tableRow(city, 'filings', {
      dossier, site: joined(cells.site), applicant: reportApplicant(cells.applicant),
      purpose: joined(cells.purpose), filedOn: paddedDay(joined(cells.filedOn)), postedOn: file?.published ?? null,
    }),
  });
}

/**
 * Le Pont-de-Claix's « Décisions des dossiers d'autorisations d'urbanisme »
 * (« Dossiers décidés jusqu'au 30 septembre 2026 »): a family to a section
 * and a row per dossier under Numéro de dossier | Pétitionnaire | Décision |
 * Date de signature | Nature des travaux | Adresse des travaux | Surface,
 * every cell centred on its row. Its filings print Arles's columns, which
 * `arles-filings` reads.
 */
export function readPontDeClaixDecisions(document, { city, file }) {
  return readReportTable(document, {
    columns: PONT_DE_CLAIX_COLUMNS, extra: ['SIGNATURE'], rule: 'centre', place: 'centre', gap: 1.6,
    head: HEAD_RE, noise: TABLE_NOISE, anchor: (text) => reportDossier(text, city),
    section: (text) => (FAMILY_RE.test(text) ? { title: text } : null),
    build: (cells, section, dossier) => tableRow(city, 'decisions', {
      dossier, site: joined(cells.site), applicant: reportApplicant(cells.applicant), purpose: joined(cells.purpose),
      verdict: listVerdict(joined(cells.verdict)) ?? municipalVerdict(joined(cells.verdict)) ?? verdicts.signed.fr,
      decidedOn: paddedDay(joined(cells.decidedOn)), postedOn: file?.published ?? null,
    }),
  });
}

// --- Scanned notices and orders, read by OCR -----------------------------------

/** The town's name, as its label gives it: `Ville d’Amnéville — …` → `Amnéville`. */
const townName = (city) => clean(String(city?.label ?? '').split(/\s+[—–]\s+/)[0]
  .replace(/^Ville (?:de la |de l[’']|de |d[’']|du |des )/i, ''));
const letters = (value) => fold(value).replace(/[^A-Z]/g, '');

/** A site without the town's name OCR read after it: `12 Chemin … à Champagne-au-Mont-d'Or` → `12 Chemin …`. */
function withoutTown(address, city) {
  const name = letters(townName(city));
  const words = clean(address).split(' ');
  for (let k = 1; name && k <= Math.min(5, words.length); k += 1) {
    if (letters(words.slice(-k).join(' ')) === name) return clean(words.slice(0, -k).join(' ').replace(/(?:(?:^|[,\s]+)[àa])?[,\s-]*$/i, ''));
  }
  return clean(address);
}

// i18n-ignore-start — the notices' own labels
const SCAN_SITE_RE = /^(?:Sur un terrain (?:sis|situ[ée]e?)|Sur un(?=\s*$|\s+\d)|Adresse (?:du |des )?(?:terrain|travaux|projet)|Adresse du(?=\s*$)|Adresse(?=\s*:)|Terrain situ[ée]e?|Terrain sis|Terrain(?=\s*:?\s*$|\s+\d)|Lieu des travaux|Situ[ée]e?(?=\s+[àa]\s))\s*(?:[àa](?=[\s:]|$))?\s*:?\s*(?:[àa]\s+)?/i;
/** Where an order's heading ends and its recitals begin. */
const RECITALS_RE = /^(?:Vu\b|Le Maire\b|Suite [àa]\s|Consid[ée]rant\b)/i;
/** What a frame prints after the street on its line: the land's area, its parcels. */
const SITE_TAIL_RE = /\s+(?:Superficie|Surface|R[ée]f(?:[ée]rences?)?\.?\s+cadastrales?|Cadastr[ée]e?)\b.*$/i;
/** The works' label, capitalised: a lower-case « travaux » is the second line of « Nature des / travaux ». */
const NOTICE_LABEL_RE = /^(?:Projet|Travaux|Nature des travaux|Description du projet|Objet)\s*:?\s*/;
const NOTICE_FILED_RE = /(?:Date de d[ée]p[ôo]t|d[ée]pos[ée]e?(?: (?:in)?complet)? le)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}(?:er)?\s+\p{L}+\s+\d{4})/iu;
const NOTICE_PARCELS_RE = /R[ée]f(?:[ée]rences?)?\.?\s+cadastrales?(?:\(s\))?\s*:?\s*((?:[A-Z]{1,2}\s*\d{1,4}\b[\s,;]*(?:et\s+)?)+)/;
// i18n-ignore-end

/**
 * A page's text in segments: the words of one line that follow each other,
 * cut where a gap wider than `gap` points opens — so that a frame's two
 * columns (« Sur un terrain sis à … » beside « Nature des travaux : … ») are
 * never one line.
 */
function segments(page, gap = 18) {
  const out = [];
  const used = new Set();
  for (const line of textLines(page?.runs ?? [], 6).map((item) => item.y)) {
    let current = null;
    for (const run of (page.runs ?? []).filter((item) => Math.abs(item.y - line) < 6).sort((a, b) => a.x - b.x)) {
      if (used.has(run)) continue;
      used.add(run);
      const right = Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x + 0.5 * (run.size || 8) * run.text.length;
      if (current && run.x - current.x1 <= gap) { current.runs.push(run); current.x1 = right; } else {
        current = { x: run.x, x1: right, y: line, runs: [run] };
        out.push(current);
      }
    }
  }
  return out.map((segment) => ({ ...segment, text: clean(segment.runs.map((run) => run.text).join(' ')) }));
}

/**
 * The value a label holds, in its own column: on the label's segment, or the
 * next segment of its line when the label stands alone (a text PDF's label
 * and value are two runs), with the segment itself.
 */
function labelled(parts, at) {
  const label = parts[at];
  const value = label.text.replace(SCAN_SITE_RE, '').replace(NOTICE_LABEL_RE, '');
  if (value) return { value, column: label };
  // Another column's label (« Destination : ») is no value.
  const right = parts.find((part) => Math.abs(part.y - label.y) < 3 && part.x > label.x1 - 1 && part.x - label.x1 < 120 && !/:\s*$/.test(part.text));
  return { value: right?.text ?? '', column: right ?? label };
}

/** A street, never the parcels printed under it (`194 AY 443`). */
const STREET_LINE_RE = /^\d{1,4}(?:\s*(?:bis|ter|[a-d]))?\s+(?![A-Z]{1,2}\s+\d)\p{L}{2,}/iu;

/**
 * The site under its label: on the label's line, or the next one down when
 * that holds only the town. A label split over two lines (« Sur un » / «
 * terrain sis à … ») is tried on each; the first value with a number wins.
 */
function scannedSite(page, city) {
  const parts = segments(page);
  let fallback = null;
  for (const [at, part] of parts.entries()) {
    if (!SCAN_SITE_RE.test(part.text)) continue;
    const { value: raw, column } = labelled(parts, at);
    const value = withoutTown(raw.replace(SITE_TAIL_RE, '').replace(/_/g, ' '), city);
    if (/\d/.test(value)) return value;
    const below = parts.find((item) => item.y < part.y - 1 && item.x >= column.x - 10 && item.x < column.x1);
    if (below && part.y - below.y < 40 && STREET_LINE_RE.test(below.text)) return withoutTown(below.text.replace(SITE_TAIL_RE, ''), city);
    fallback ??= value || null;
  }
  return fallback;
}

/** A notice no label of `extended-notice` names: its number, filing day, works and parcels, by their own labels. */
function labelledNotice(pages, { city, file }) {
  const lines = pages.flatMap((page) => textLines(page.runs, 4)).map((line) => line.text);
  const dossier = municipalDossier(dossierText(lines.slice(0, 40).join(' ')), city) ?? municipalDossier(dossierText(file?.title), city);
  if (!dossier) return null;
  const parts = segments(pages[0]);
  const at = parts.findIndex((part) => NOTICE_LABEL_RE.test(part.text));
  const body = lines.join('\n');
  const parcels = NOTICE_PARCELS_RE.exec(body)?.[1]?.match(/[A-Z]{1,2}\s*\d{1,4}/g)?.map((parcel) => parcel.replace(/^([A-Z]+)\s*0*(\d)/, '$1 $2'));
  return { board: file?.board, dossier, applicant: null, parcels: parcels?.length ? parcels.join(', ') : null,
    purpose: at >= 0 ? clean(labelled(parts, at).value) || null : null,
    filedOn: municipalDate(NOTICE_FILED_RE.exec(body)?.[1]), postedOn: file?.published ?? null,
    verdict: file?.board === 'decisions' ? verdicts.signed.fr : null };
}

/**
 * A scanned notice or order, as the daily sweep's OCR reads it, by the labels
 * `extended-notice` knows (« Numéro du dossier », « Date de dépôt ») — with
 * what OCR adds taken off first: the frame's rules read as `|`, a dash alone
 * before the street, the town's name after it (« 12 Chemin … à
 * Champagne-au-Mont-d'Or »), the column beside it; and the verdict read from
 * the first article, which `extended-notice` misses when no second article
 * follows it.
 */
export function readScannedNotice(document, { city, file }) {
  const pages = (document?.pages ?? []).map((page) => ({ ...page, runs: (page.runs ?? [])
    .map((run) => ({ ...run, text: clean(String(run.text ?? '').replace(/^[|[\]{}]+|[|[\]{}]+$/g, '').replace(/^[-–—]$/, '')) }))
    .filter((run) => run.text) }));
  const row = readExtendedNotice({ ...document, pages }, { city, file })[0] ?? labelledNotice(pages, { city, file });
  if (!row) return [];
  const address = scannedSite(pages[0], city) ?? withoutTown(row.address, city);
  if (!/\p{L}/u.test(address ?? '')) return [];
  const out = { ...row, ...municipalSite(address, city), parcels: row.parcels ?? null };
  if (file?.board === 'decisions') {
    const lines = pages.flatMap((page) => textLines(page.runs, 6)).map((line) => line.text);
    const body = lines.join('\n');
    // A certificate of non-opposition says so in its heading and has no article.
    const recitals = lines.findIndex((line) => RECITALS_RE.test(line));
    const heading = lines.slice(0, recitals < 0 ? 12 : recitals).join(' ');
    out.verdict = orderVerdict(operative(body)) ?? municipalVerdict(heading) ?? row.verdict;
    const signed = body.slice(Math.max(0, body.search(/\bArticle\s+1/i)));
    out.decidedOn = row.decidedOn
      ?? municipalDate(/,\s*le\s+(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}(?:er)?\s+\p{L}+\s+\d{4})/iu.exec(signed)?.[1]);
  }
  return [out];
}

// --- Scans whose title says it all ------------------------------------------

// i18n-ignore-start — the words of the towns' own titles, matched on
const STREET = '(?:rue|avenue|av\\.?|boulevard|bd|route|rte|chemin|impasse|all[ée]e|place|quai|cours|square|r[ée]sidence|lotissement|lieu-dit|hameau|zac?|parc|cit[ée]|clos|sentier|venelle|rocade|voie|mail|esplanade|promenade|passage|faubourg|villa|parvis)';
const NUMBERED_RE = new RegExp(`(?:^|\\s)(\\d{1,4}(?:\\s*(?:bis|ter|[a-d]))?\\s+${STREET}\\b.*)$`, 'iu');
const STREET_RE = new RegExp(`(?:^|\\s)(${STREET}\\b.*)$`, 'iu');
/** Where the works begin after the street in a title: a capitalised noun no street word or article leads to. */
const WORKS_RE = /[\s-](?:Pose|R[ée]fection|Installation|Division|Construction|Extension|Ravalement|Remplacement|Modification|Cr[ée]ation|Isolation|Am[ée]nagement|D[ée]molition|Changement|Transformation|R[ée]novation|Sur[ée]l[ée]vation|Cl[ôo]ture|Abri|V[ée]randa|Carport|Piscine|Panneaux|Mise|Agrandissement|R[ée]habilitation|Hangar|Travaux|Projet|Suppression|Arrachage|Remise|Fermeture|Ouverture|D[ée]placement|R[ée]alisation|Implantation|[ÉE]dification|R[ée]gularisation|Restauration|Pergola|Terrasse|Portail|Toiture|Garage|Fen[êe]tres?)\b/g;
const LEADS_RE = new RegExp(`(?:^|\\s)(?:${STREET}|de|du|des|la|le|les|d'|l')$`, 'iu');
// i18n-ignore-end

/**
 * A title's number, its parts spaced any way (`DP 059 011 26 0 0069`,
 * `DP0590112600077`, `Arrêté DP 500252600135` — Avranches drops the leading
 * zero —, `PC05901123B0004M04`), checked against the town's code. A fifth
 * counter digit counts only when it follows the fourth unspaced, so that the
 * house number after a four-digit counter (`DP 050 025 26 0140 3 Bis Place …`)
 * stays the street's.
 */
function titleDossier(title, city) {
  const code = city.insee.split('').join('\\s*');
  const match = new RegExp(`\\b(PC|DP|PA|PD|CU)[ab]?\\s*0?\\s*${code}\\s*(\\d\\s*\\d)\\s*([A-Z]\\s*\\d(?:\\s?\\d){3}|\\d(?:\\s?\\d){3}(?:\\d(?!\\d))?)(?:\\s*-?\\s*([MT])\\s*0?(\\d{1,2})(?!\\d))?`, 'i').exec(clean(title));
  if (!match) return null;
  const counter = match[3].replace(/\s/g, '');
  const dossier = municipalDossier(`${match[1].toUpperCase()} ${city.insee.padStart(6, '0')} ${match[2].replace(/\s/g, '')} ${/^\d+$/.test(counter) ? counter.padStart(5, '0') : counter.toUpperCase()}${match[4] ? ` ${match[4].toUpperCase()}${match[5].padStart(2, '0')}` : ''}`, city);
  return dossier ? { dossier, rest: clean(title).slice(match.index + match[0].length) } : null;
}

/** The works cut off a street: at the first capitalised works noun no street word or article leads to. */
function withoutWorks(street) {
  for (const match of street.matchAll(WORKS_RE)) {
    if (!LEADS_RE.test(street.slice(0, match.index))) return clean(street.slice(0, match.index));
  }
  return clean(street);
}

/**
 * The site a title names after its number and the applicant: a part between
 * dashes that starts with a house number (Avranches: `… - 7 résidence les
 * Grives- Aménagement grenier 26.09.121`), else the first numbered street,
 * else the first street word — never the words before it, the applicant's.
 */
function titleSite(rest) {
  const text = clean(String(rest ?? '').replace(/\s*-?\s*\d{2}\.\d{2}\.\d{1,3}\s*$/, ''));
  const parts = text.split(/\s*-\s+|\s+-\s*/).map(clean).filter(Boolean);
  const part = parts.length > 1 ? parts.slice(1).find((item) => /^\d{1,4}(?:\s*(?:bis|ter|[a-d]))?\s+\p{L}{2,}/iu.test(item)) : null;
  if (part) return withoutWorks(part);
  const street = (NUMBERED_RE.exec(text) ?? STREET_RE.exec(text))?.[1];
  return street ? withoutWorks(street.split(/\s*-\s+|\s+-\s*/)[0]) : null;
}

/**
 * A town whose acts are scans named by number and site — Annœullin («
 * recepissé DP 0590112600076 [applicant] 17 rue … », « arrêté refus PC
 * 0590112600009 [applicant] 165 rue … »), Avranches (« Avis de dépot
 * DP050025260154 [applicant] 5 Rue … Pose de panneaux solaires », « Arrêté DP
 * 500252600135 [applicant]- 7 résidence …- Aménagement grenier 26.09.121 »):
 * the row is the title's, the scan unread. Annœullin's receipts are the
 * State's form filled in by hand, which OCR cannot read. The verdict is the
 * title's when it says one (« refus »), else a signed decision.
 */
export function readTitleAct(document, { city, file }) {
  const found = titleDossier(String(file?.title ?? '').replace(/_/g, ' '), city);
  const site = found && titleSite(found.rest);
  if (!site || !/\p{L}{2,}/u.test(site)) return [];
  const board = file?.board === 'decisions' ? 'decisions' : 'filings';
  return [{
    board, dossier: found.dossier, applicant: null, ...municipalSite(site, city), postedOn: file?.published ?? null,
    verdict: board === 'decisions' ? municipalVerdict(/\b(?:refus|retrait|annulation|non[- ]opposition)\b/i.exec(file.title)?.[0]) ?? verdicts.signed.fr : null,
  }];
}

export const DIGILOR_C_BOARD_READERS = Object.freeze({
  'digilor-dombasle-act': readDombasleAct,
  'digilor-ergue-list': readErgueList,
  'digilor-pontdeclaix-decisions': readPontDeClaixDecisions,
  'digilor-amneville-notice': readScannedNotice,
  'digilor-annoeullin-title': readTitleAct,
});
export const DIGILOR_C_BOARD_TEXT = Object.freeze({});
