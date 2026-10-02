/** Lorient's JSON boards and the municipal formats of Digilor and Rueil. */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const verdicts = messages.definition;
const LORIENT_PAGE = 'https://www.lorient-agglo.bzh/services/habitat-et-urbanisme/vos-demarches-durbanisme/';

// i18n-ignore-start — publishers' names and the words of their legal boards
const LORIENT_COMMUNES = [
  ['56021', 'Brandérion', '56700'], ['56026', 'Bubry', '56310'], ['56029', 'Calan', '56240'],
  ['56036', 'Caudan', '56850'], ['56040', 'Cléguer', '56620'], ['56062', 'Gâvres', '56680'],
  ['56063', 'Gestel', '56530'], ['56069', 'Groix', '56590'], ['56078', 'Guidel', '56520'],
  ['56083', 'Hennebont', '56700'], ['56089', 'Inguiniel', '56240'], ['56090', 'Inzinzac-Lochrist', '56650'],
  ['56098', 'Lanester', '56600'], ['56101', 'Languidic', '56440'], ['56104', 'Lanvaudan', '56240'],
  ['56107', 'Larmor-Plage', '56260'], ['56118', 'Locmiquélic', '56570'], ['56121', 'Lorient', '56100'],
  ['56162', 'Ploemeur', '56270'], ['56166', 'Plouay', '56240'], ['56179', 'Pont-Scorff', '56620'],
  ['56181', 'Port-Louis', '56290'], ['56185', 'Quéven', '56530'], ['56188', 'Quistinic', '56310'],
  ['56193', 'Riantec', '56670'],
];

export const EXTENDED_PERMIT_SOURCES = Object.freeze([
  ...LORIENT_COMMUNES.map(([insee, name, postcode]) => ({
    key: `lorient-${insee}`, insee, postcode, label: `Lorient Agglomération — ${name}`,
    page: LORIENT_PAGE, source: { kind: 'lorient' }, lists: [],
  })),
  { key: 'bondy', insee: '93010', postcode: '93140', label: 'Ville de Bondy — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/565',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 565, category: 6048,
      filings: 10495, decisions: 10496, formats: { filings: 'grid', decisions: 'extended-notice' }, ocr: true }, lists: [] },
  { key: 'blois', insee: '41018', postcode: '41000', label: 'Ville de Blois — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/228',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 228, category: 2018,
      mixedShelf: 2422, formats: { filings: 'blois-filings', decisions: 'extended-notice' }, ocr: true }, lists: [] },
  { key: 'aubagne', insee: '13005', postcode: '13400', label: 'Ville d’Aubagne — autorisations d’urbanisme',
    underReview: true, page: 'https://datahall.mydigilor.fr/web/#/documents/307',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 307, category: 3697,
      filings: 5605, decisions: 5606, formats: { filings: 'register', decisions: 'extended-notice' }, ocr: true }, lists: [] },
  { key: 'thionville', insee: '57672', postcode: '57100', label: 'Ville de Thionville — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/222',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 222, category: 2034,
      filings: 2543, decisions: 2544, formats: { filings: 'extended-notice', decisions: 'extended-notice' }, ocr: true }, lists: [] },
  { key: 'rueil', insee: '92063', postcode: '92500', label: 'Ville de Rueil-Malmaison — autorisations d’urbanisme',
    page: 'https://webdelib.mairie-rueilmalmaison.fr/webdelibplus/jsp/summary_orders.jsp?role=usager',
    source: { kind: 'rueil', base: 'https://webdelib.mairie-rueilmalmaison.fr/webdelibplus', tab: 'summary_orders', strictAddress: true }, lists: [] },
].map((city) => Object.freeze({ ...city, source: Object.freeze({ ...city.source,
  ...(city.source.formats ? { formats: Object.freeze(city.source.formats) } : {}) }), lists: Object.freeze(city.lists) })));
// i18n-ignore-end

/** The opaque public selector is read from the publisher's page, never guessed. */
export function lorientBoardUrl(city, html, board) {
  const selectors = [...String(html ?? '').matchAll(/local_secret\[(\d{5})\]\s*=\s*['"]([a-f\d]{24})['"]/g)];
  const id = selectors.find((match) => match[1] === city.insee)?.[2];
  if (!id || !['filings', 'decisions'].includes(board)) return null;
  const url = new URL('/apps/ads/api/dossiers.php', city.page);
  url.search = new URLSearchParams({ TYPE: board === 'filings' ? 'DEP' : 'DEC', ID_COMMUNE: id }).toString();
  return url.href;
}

/** Validate the entire board before taking its explicitly labelled site fields. */
export function readLorientBoard(city, board, json) {
  const data = json?.DATA;
  if (json?.MSG !== 'OK' || data?.INSEE !== city.insee
    || data.TYPE_RQ !== (board === 'filings' ? 'DEP' : 'DEC')
    || !['PC', 'DP', 'PA', 'PD', 'CU'].every((kind) => Array.isArray(data[kind]))) return null;
  const rows = [];
  for (const kind of ['PC', 'DP', 'PA', 'PD', 'CU']) {
    for (const raw of data[kind]) {
      const dossier = municipalDossier(raw.dossier, city);
      if (!dossier || !dossier.startsWith(`${kind} `)) continue;
      rows.push({ board, dossier, applicant: null, ...municipalSite(decode(raw.terrain), city),
        purpose: clean(decode(raw.nature_detail).replace(/_/g, ' ')) || null,
        filedOn: municipalDate(raw.depot),
        verdict: board === 'decisions' ? clean(decode(raw.decision_texte ?? raw.decision_nature)) || verdicts.signed.fr : null,
        decidedOn: board === 'decisions' ? municipalDate(raw.decision_date) : null });
    }
  }
  return rows;
}

function decode(value) {
  const names = { amp: '&', apos: "'", quot: '"', nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ocirc: 'ô', ucirc: 'û', ccedil: 'ç', rsquo: '’' }; // i18n-ignore-line — HTML entity decoding, not visible copy
  return String(value ?? '').replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (whole, name) => {
    if (name.startsWith('#')) return String.fromCodePoint(parseInt(name.slice(name[1].toLowerCase() === 'x' ? 2 : 1), name[1].toLowerCase() === 'x' ? 16 : 10));
    const lower = names[name.toLowerCase()];
    return lower ? (name[0] === name[0].toUpperCase() ? lower.toUpperCase() : lower) : whole;
  });
}

/** Extract a numbered street, never the preceding applicant's words. */
function numberedAddress(value, abbreviated = false) {
  const street = abbreviated ? '[\\p{L}]' : '(?:RUE|AVENUE|AV\\.?|BOULEVARD|BD|ROUTE|RTE|CHEMIN|CH|IMPASSE|ALLEE|PLACE|QUAI|COURS|SQUARE|VILLA|TRAVERSE|BOUCLE|LEVEE)\\b';
  const match = new RegExp(`(?:^|\\s)(\\d{1,4}(?:\\s*(?:BIS|TER|[BT](?=\\s)))?\\s+${street}.*)$`, 'iu').exec(clean(value));
  if (!match) return null;
  return clean(match[1].replace(/\s+(?:MME\b|MR\b|M\.(?=\s)|MONSIEUR\b|MADAME\b|SCI\b|SAS\b|SA\b|SARL\b|SCCV\b|SNC\b|STE\b|EURL\b|S\.(?=[A-Z]{3,})).*$/i, '')
    .replace(/\s+LOT\s*\d+\b.*$/i, '').replace(/\s+(?:\d{5}\s+)?BLOIS\b.*$/i, '')) || null;
}

/** A title can assert a refusal; "arrêté" alone asserts only a signed decision. */
export function digilorTitleRow(city, file) {
  const title = clean(file.title).replace(/_/g, ' ');
  const dossier = municipalDossier(title, city);
  if (!dossier) return null;
  let address = numberedAddress(title);
  if (!address && city.key === 'aubagne') {
    const lines = String(file.title ?? '').split(/\r?\n|\s+-\s+/).map(clean);
    address = lines.find((line) => /^(?:ZAC|CHEMIN|ROUTE|RUE|AVENUE|IMPASSE)\b/i.test(line)) ?? null;
  }
  // Thionville's suffix names the document, not the street.
  if (address && city.key === 'thionville') address = clean(address.replace(/\s+(?:ARRETE|DEPOT)\b.*$/i, ''));
  if (!address) return null;
  const explicit = /\b(?:REFUS|RETRAIT|NON[- ]?OPPOSITION|ACCORD|FAVORABLE)\b/i.exec(title)?.[0];
  return { board: file.board, dossier, applicant: null, ...municipalSite(address, city),
    postedOn: file.published ?? null,
    verdict: file.board === 'decisions' ? municipalVerdict(explicit) ?? verdicts.signed.fr : null };
}

/** Rueil's local seven-digit number, modifications included, and short site. */
export function rueilTitleRow(city, act) {
  const match = /^(ARRETE|REFUS)\s+(PC|DP|PA|PD|CU)\s*(\d{2})(\d{5})(?:-(M?\d{1,2}|T\d{1,2}))?\s+(.+?)_\d{3}$/i.exec(clean(act.title));
  if (!match) return null;
  const address = numberedAddress(match[6], true);
  if (!address) return null;
  const suffix = match[5] ? ` ${/^[MT]/i.test(match[5]) ? match[5].toUpperCase() : `M${match[5]}`}` : '';
  return { board: 'decisions', dossier: `${match[2].toUpperCase()} 092063 ${match[3]} ${match[4]}${suffix}`,
    applicant: null, ...municipalSite(address, city), postedOn: act.published ?? null,
    decidedOn: act.decidedOn ?? null, verdict: match[1].toUpperCase() === 'REFUS' ? verdicts.refused.fr : verdicts.signed.fr };
}

/** Group baselines, then sort their runs left to right (including OCR words). */
function pageLines(page) {
  const lines = [];
  for (const run of [...(page?.runs ?? [])].sort((a, b) => b.y - a.y)) {
    const previous = lines.at(-1);
    if (previous && Math.abs(previous.y - run.y) < 2) previous.runs.push(run);
    else lines.push({ y: run.y, runs: [run] });
  }
  return lines.map((line) => ({ ...line, text: clean(line.runs.sort((a, b) => a.x - b.x).map((run) => run.text).join(' ')) }));
}

/** Individual files: labelled project fields and the operative article only. */
export function readExtendedNotice(document, { city, file }) {
  const lines = (document?.pages ?? []).flatMap(pageLines).map((line) => line.text);
  if (lines.length < 2) return [];
  const fallback = file.row ?? digilorTitleRow(city, file);
  const dossier = municipalDossier(lines.slice(0, 28).join(' '), city) ?? fallback?.dossier;
  if (!dossier) return [];
  const body = lines.join('\n');
  // These notices are portrait A4. pdfText returns runs alone; OCR also
  // returns the page size. Bondy's second column starts at the half-page.
  const siteLines = (document?.pages ?? []).slice(0, 1).flatMap((page) => pageLines({
    runs: page.runs.filter((run) => run.x < (page.width ?? 595.28) * (city.key === 'bondy' ? 0.48 : 1)),
  })).map((line) => line.text);
  const sitePattern = /^(?:Sur un terrain (?:sis [àa]|situ[ée]e? [àa]?)|Adresse (?:du terrain|des travaux)|Terrain situ[ée]e?)\s*:?\s*/i;
  const at = siteLines.findIndex((line) => sitePattern.test(line));
  let address = at >= 0 ? clean(siteLines[at].replace(sitePattern, '').replace(/\bSurface\b.*$/i, '')) : null;
  if (at >= 0 && !address) {
    const next = siteLines[at + 1];
    if (/^(?:\d{1,4}\b|RUE\b|CHEMIN\b|ROUTE\b|AVENUE\b)/i.test(next ?? '')) address = next;
  }
  if (city.source.strictAddress && address) {
    address = clean(address.replace(/\s+[àa]\s+Rueil[- ][^,;.]+[.,;]?\s*$/i, ''));
    // An isolated number is a wrapped or unreadable field, not an address.
    if (!/[\p{L}]/u.test(address)) address = null;
  }
  address ||= fallback?.address;
  if (!address) return [];
  const row = { ...fallback, board: file.board, dossier, applicant: null, ...municipalSite(address, city),
    filedOn: municipalDate(/(?:Date de d[ée]p[ôo]t\s*:?|(?:Demande |Dossier )?d[ée]pos[ée]e? le)\s*([^\n]+)/i.exec(body)?.[1]) ?? fallback?.filedOn ?? null,
    postedOn: file.published ?? fallback?.postedOn ?? null };
  if (file.board === 'decisions') {
    const article = /\bARTICLE\s+(?:1(?:er)?|UNIQUE)\b\s*[:.\-–]?([\s\S]{0,600}?)(?=\bARTICLE\s+\d|$)/i.exec(body)?.[1];
    row.verdict = municipalVerdict(article) ?? municipalVerdict(lines.slice(0, 5).join(' ')) ?? fallback?.verdict ?? verdicts.signed.fr;
    row.decidedOn = fallback?.decidedOn ?? municipalDate(/Fait [\s\S]{0,80}?\ble\s+([^\n]+)/i.exec(body)?.[1]);
  }
  return [row];
}

/** Blois's DDC register: three columns, terrain owner deliberately excluded. */
export function readBloisFilings(document) {
  const rows = [];
  const city = EXTENDED_PERMIT_SOURCES.find((source) => source.key === 'blois');
  for (const page of document?.pages ?? []) {
    const runs = page.runs ?? [];
    const terrainX = runs.find((run) => clean(run.text) === 'Terrain')?.x;
    const descriptionX = runs.find((run) => clean(run.text) === 'Description')?.x;
    if (!Number.isFinite(terrainX) || !Number.isFinite(descriptionX)) continue;
    const anchors = runs.filter((run) => run.x < terrainX - 5 && /^(?:PC|DP|PA|PD|CU|AP)\s*41018\b/i.test(clean(run.text)))
      .sort((a, b) => b.y - a.y);
    for (let i = 0; i < anchors.length; i += 1) {
      const anchor = anchors[i];
      const dossier = municipalDossier(anchor.text, city);
      if (!dossier) continue;
      const bottom = anchors[i + 1]?.y ?? 20;
      const rowRuns = runs.filter((run) => run.y <= anchor.y + 7 && run.y > bottom + 7);
      const terrain = pageLines({ runs: rowRuns.filter((run) => run.x >= terrainX - 2 && run.x < descriptionX - 5) }).map((line) => line.text);
      const parcels = /^Terrain\s*:\s*(.+)$/i.exec(terrain.find((line) => /^Terrain\s*:/i.test(line)) ?? '')?.[1];
      const address = terrain.find((line) => /^sis\s+/i.test(line))?.replace(/^sis\s+/i, '');
      const left = pageLines({ runs: rowRuns.filter((run) => run.x < terrainX - 5) }).map((line) => line.text);
      const purpose = pageLines({ runs: rowRuns.filter((run) => run.x >= descriptionX - 5) }).map((line) => line.text).join(' ').replace(/^Projet\s*:\s*/i, '');
      const references = [...String(parcels ?? '').matchAll(/\b([A-Z]{1,2})\s*(\d{1,4})\b/g)].map((match) => `${match[1]} ${match[2]}`).join(', ');
      rows.push({ board: 'filings', dossier, applicant: null, ...municipalSite(address, city), parcels: references || null,
        filedOn: municipalDate(left.find((line) => /^D.p.t le/i.test(line))), purpose: purpose || null,
        landArea: /[\d.,]+/.exec(terrain.find((line) => /^Surface\s*:/i.test(line)) ?? '')?.[0] ?? null });
    }
  }
  return rows;
}

/** Reject an abbreviated Rueil address matched to another number or street. */
export function permitListGeocodeAccepted(city, permit, row) {
  if (!city.source?.strictAddress) return true;
  const score = Number(row?.result_score);
  if (row?.result_type !== 'housenumber' || row.result_citycode !== city.insee || !Number.isFinite(score) || score < 0.3) return false;
  const words = (value) => fold(value).replace(/[^A-Z\d]/g, ' ').split(/\s+/).filter(Boolean);
  const asked = words(permit.address);
  const found = words(row.result_name);
  const house = (value) => fold(value).replace(/[^A-Z\d]/g, '');
  const number = /^(\d+\s*(?:BIS|TER|[BT]\b)?)/i.exec(permit.address ?? '')?.[1];
  const resultNumber = row.result_housenumber ?? /^(\d+\s*(?:BIS|TER|[BT]\b)?)/i.exec(row.result_name ?? '')?.[1];
  return Boolean(number && resultNumber && house(number) === house(resultNumber) && found.includes(asked.at(-1)));
}
