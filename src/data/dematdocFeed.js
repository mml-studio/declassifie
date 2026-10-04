/**
 * DematDOC acts portals (`<tenant>.dematdoc.eu`): the communes that post one
 * PDF per urbanism act — avis de dépôt, récépissé, arrêté — on the legal
 * board the platform hosts for them. Discovery and reading are pure; the
 * requests belong to `scripts/lib/permitLists.mjs`.
 *
 * The board is a JSON API without a key: `POST /api/public/get-documents/<doctype>`
 * returns the newest 100 documents of a shelf on display and the ids of the
 * rest, which `POST /api/public/get-documents-lazy` returns 100 at a time.
 * A document carries its title, its PDF and the shelf's index fields
 * (`OBJET`, `DATEACTE`, the first day of display). Measured on 2026-10-02
 * over 56 tenants (Viviers since left out): 1 071 urbanism acts posted since 1 September.
 * Reading the newest eight of each gave 281 dossiers, every one with its
 * site: 86 filings and 195 decisions (131 granted, 19 refused, 16 withdrawn
 * or cancelled, 29 signed with no verdict read). About a dozen tenants post
 * scans with no text layer, which the daily sweep reads by OCR; on 130 text
 * acts sampled, 92 gave a row.
 *
 * Every tenant's `robots.txt` is the platform's `Disallow: /`; these are
 * the postings the Code de l'urbanisme makes public (art. R.423-6,
 * R.424-15), read by the project's decision as Saint-Priest's board on the
 * same platform is (`municipalPermitsFeed.js`).
 *
 * The applicant is never read: not from the title, which often names them,
 * nor from the PDF, of which only labelled site, parcel, date and verdict
 * fields are taken.
 */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

// i18n-ignore-start — publishers' names, the platform's hosts and shelves
/**
 * [host, INSEE, postcode, name, shelves] — the shelves that carry urbanism
 * acts. Bizanos and Mazères-Lezons post here too, and are read from the Pau
 * agglomeration's e-permis board (`epermisFeed.js`), which has their parcels;
 * Le Crès too, and stays with Montpellier Méditerranée Métropole's open data
 * (`mmmPermitsFeed.js`), and Viviers with Du Rhône aux Gorges de l'Ardèche's
 * Cart@DS board (`cartdsFeed.js`, since #399), which prints its parcels: one
 * register per commune, or every dossier twice.
 */
const TENANTS = [
  ['montelimar', '26198', '26200', 'Montélimar', [14]],
  ['ville-plaisir', '78490', '78370', 'Plaisir', [22]],
  ['mairie-le-pontet', '84092', '84130', 'Le Pontet', [14]],
  ['fontenay-le-comte', '85092', '85200', 'Fontenay-le-Comte', [22]],
  ['stgo', '31483', '31800', 'Saint-Gaudens', [14]],
  ['lancon-provence', '13051', '13680', 'Lançon-Provence', [22]],
  ['mairie-darnetal', '76212', '76160', 'Darnétal', [14]],
  ['ville-meulan', '78401', '78250', 'Meulan-en-Yvelines', [22]],
  ['ville-entraigues84', '84043', '84320', 'Entraigues-sur-la-Sorgue', [14]],
  ['beauzelle', '31056', '31700', 'Beauzelle', [22]],
  ['mairie-crest', '26108', '26400', 'Crest', [14]],
  ['ville-marseillan', '34150', '34340', 'Marseillan', [14]],
  ['ville-rochefortdugard', '30217', '30650', 'Rochefort-du-Gard', [22]],
  ['castelnau-estretefonds', '31118', '31620', 'Castelnau-d’Estrétefonds', [22]],
  ['mairie-chabeuil', '26064', '26120', 'Chabeuil', [21]],
  ['saint-alban31', '31467', '31140', 'Saint-Alban', [14]],
  ['mairie-donzere', '26116', '26290', 'Donzère', [3]],
  ['ville-fontenilles', '31188', '31470', 'Fontenilles', [14]],
  ['saintjustenchaussee', '60581', '60130', 'Saint-Just-en-Chaussée', [14]],
  ['bedarieux', '34028', '34600', 'Bédarieux', [22]],
  ['pollestres', '66144', '66450', 'Pollestres', [19]],
  ['coublevie', '38133', '38500', 'Coublevie', [14]],
  ['ville-chavanoz', '38097', '38230', 'Chavanoz', [14]],
  ['ville-haillicourt', '62400', '62940', 'Haillicourt', [14]],
  ['graveson', '13045', '13690', 'Graveson', [22]],
  ['saintgeorgesdereneins', '69206', '69830', 'Saint-Georges-de-Reneins', [19]],
  ['serres-castet', '64519', '64121', 'Serres-Castet', [14]],
  ['pons-ville', '17283', '17800', 'Pons', [22]],
  ['agneaux', '50002', '50180', 'Agneaux', [14]],
  ['saintjustmalmont', '43205', '43240', 'Saint-Just-Malmont', [22]],
  ['mairievlm', '01450', '01800', 'Villieu-Loyes-Mollon', [14]],
  ['sauvagnon', '64511', '64230', 'Sauvagnon', [14]],
  ['plandorgon', '13076', '13750', 'Plan-d’Orgon', [22]],
  ['chateaugay', '63099', '63119', 'Châteaugay', [19]],
  ['besse-sur-issole', '83018', '83890', 'Besse-sur-Issole', [22]],
  ['mairie-albignysursaone', '69003', '69250', 'Albigny-sur-Saône', [14]],
  ['aubais', '30019', '30250', 'Aubais', [22]],
  ['montbazin', '34165', '34560', 'Montbazin', [14]],
  ['bordes64', '64138', '64510', 'Bordes', [14]],
  ['couzonaumontdor', '69068', '69270', 'Couzon-au-Mont-d’Or', [22]],
  ['montboucher-sur-jabron', '26191', '26740', 'Montboucher-sur-Jabron', [14]],
  ['taupont', '56249', '56800', 'Taupont', [22]],
  ['mairie-llupia', '66101', '66300', 'Llupia', [14]],
  ['mairie-suze-la-rousse', '26345', '26790', 'Suze-la-Rousse', [17, 22]],
  ['lesrochesdecondrieu', '38340', '38370', 'Les Roches-de-Condrieu', [22]],
  ['bourbonne', '52060', '52400', 'Bourbonne-les-Bains', [22]],
  ['nostang', '56148', '56690', 'Nostang', [19]],
  ['ville-nievroz', '01276', '01120', 'Niévroz', [22]],
  ['blyes', '01047', '01150', 'Blyes', [14]],
  ['lecrest', '63126', '63450', 'Le Crest', [14]],
  ['mairie-mont-dore', '63236', '63240', 'Mont-Dore', [22]],
  ['mairie-saintpaullesfonts', '30355', '30330', 'Saint-Paul-les-Fonts', [12, 14]],
  ['tupinetsemons', '69253', '69420', 'Tupin-et-Semons', [14]],
  ['vagnas-ardeche', '07328', '07150', 'Vagnas', [14]],
  ['labastidedevirac', '07113', '07150', 'Labastide-de-Virac', [14]],
  // Missed by the 2026-10-02 sweep, which lost the network for a while.
  ['ville-aubiere', '63014', '63170', 'Aubière', [22]],
];
// i18n-ignore-end

export const DEMATDOC_PERMIT_SOURCES = Object.freeze(TENANTS.map(([host, insee, postcode, name, doctypes]) => Object.freeze({
  key: `dematdoc-${host}`,
  insee,
  postcode,
  name,
  label: `${name} — actes d’urbanisme (DematDOC)`, // i18n-ignore-line — the publisher's name
  page: `https://${host}.dematdoc.eu/public/${doctypes[0]}`,
  robots: 'overridden',
  source: Object.freeze({ kind: 'dematdoc', base: `https://${host}.dematdoc.eu`, doctypes: Object.freeze(doctypes), ocr: true }),
  lists: Object.freeze([]),
})));

/** Pages of 100 read after the first, per shelf: the display window is two months. */
export const DEMATDOC_MAX_PAGES = 6;

/** The first page of a shelf's documents on display, newest first. */
export function dematdocShelfRequest(city, doctype) {
  return {
    url: `${city.source.base}/api/public/get-documents/${doctype}`,
    body: JSON.stringify({ filters: { params: { archive: false }, indexfields: [], document: [] }, filtersURL: String(doctype) }),
  };
}

/** The next documents of a shelf, by the ids the previous page left. */
export function dematdocLazyRequest(city, ids) {
  return { url: `${city.source.base}/api/public/get-documents-lazy`, body: JSON.stringify(ids) };
}

// i18n-ignore-start — words of the publishers' titles and acts, matched on
const PERMIT_WORDS = /permis de constru|permis d.am[ée]nag|permis de d[ée]mol|d[ée]claration pr[ée]alable|certificat d.urbanisme|avis de d[ée]p[ôo]t|r[ée]c[ée]piss[ée]|non[- ]?opposition|autorisation d.urbanisme|\b(?:PC|DP|PA|PD|CU)\s*\d/i;
// Aggregate registers and acts that are not a dossier's: road, pre-emption, plan.
const NOT_A_DOSSIER = /pr[ée]emption|stationnement|voirie|circulation|\bPLUi?\b|plan local|enqu[êe]te publique|alignement|num[ée]rotage|conservation cadastrale|d[ée]l[ée]gation|registre des dossiers|liste des|d[ée]pos[ée]e?s au \d|d[ée]cisions urbanisme \d/i;
// « Avis de dépôt affiché en mairie le … » is how Garchizy's orders recall their filing's posting.
const FILING_WORDS = /avis de d[ée]p[ôo]t(?! affich[ée]e? en mairie)|avis d.affichage|r[ée]c[ée]piss[ée]|d[ée]p[ôo]t de (?:la )?demande|accus[ée] de r[ée]ception|\bAD\b/i;
const DECISION_WORDS = /arr[êe]t[ée]|d[ée]cision|accord|refus|opposition|certificat de|retrait|transfert|prorogation|classement sans suite/i;
// i18n-ignore-end

const field = (doc, key) => clean(doc?.values?.[key]?.displayValue);

// i18n-ignore-start — the headings acts open with
const FILING_HEADING = /^(?:avis\s*de\s*d[ée]p[ôo]t(?!\s*affich[ée]e?\s*en\s*mairie)|r[ée]c[ée]piss[ée]|avis\s*d.affichage|accus[ée]\s*de\s*r[ée]ception)/i;
// « … DÉLIVRÉE PAR LE MAIRE AU NOM DE LA COMMUNE » under a bare « DÉCLARATION PRÉALABLE » (Hagondange, Clouange).
const DECISION_HEADING = /^(?:arr[êe]t[ée]|d[ée]cision|accord|refus|opposition|non[- ]?opposition|certificat|retrait|transfert|prorogation|d[ée]claration\s*pr[ée]alable\s*ne\s*faisant|permis\s*de\s*(?:construire|d[ée]molir|d.am[ée]nager)\s*(?:modificatif\s*)?(?:d[ée]livr|accord)|(?:d[ée]livr[ée]|prononc[ée])e?s?\s+par\s+le\s+maire)/i;
// i18n-ignore-end

/**
 * The board the first heading line names: Agneaux's order prints « date
 * d'affichage en mairie de l'avis de dépôt » above its « ARRÊTÉ ».
 */
function boardOfHeading(lines) {
  for (const line of lines) {
    if (DECISION_HEADING.test(line)) return 'decisions';
    if (FILING_HEADING.test(line)) return 'filings';
  }
  return null;
}

/**
 * Which board a title or a heading names first, or null when it names
 * neither: Plaisir's refusal prints « Avis de dépôt affiché le » under
 * « REFUS DE PERMIS », and Beauzelle's receipt nothing but « Récépissé ».
 */
function boardOf(text) {
  const filing = FILING_WORDS.exec(text)?.index ?? Infinity;
  const decision = DECISION_WORDS.exec(text)?.index ?? Infinity;
  if (filing === Infinity && decision === Infinity) return null;
  return filing < decision ? 'filings' : 'decisions';
}

/**
 * The urbanism acts of a shelf posted since `since`, one file each. A title
 * that names a dossier of the commune, or a permit's words, is enough; the
 * PDF settles the number when the title only carries an internal one
 * (Fontenay's `A2026-1487`, Couzon's `DP 2026 0065`). The redacted copy the
 * board itself shows (`bifferPath`) is read when there is one.
 *
 * @param {object} city One of {@link DEMATDOC_PERMIT_SOURCES}.
 * @param {Array<object>} documents The API's `documents`.
 * @param {string} since `YYYY-MM-DD`.
 * @returns {Array<{url: string, title: string, board: string, published: ?string,
 *   decidedOn: ?string, layout: string}>}
 */
export function dematdocDocuments(city, documents, since) {
  const files = [];
  for (const doc of Array.isArray(documents) ? documents : []) {
    const title = clean([doc?.name, field(doc, 'OBJET')].filter(Boolean).join(' — '));
    const words = clean([doc?.name, ...Object.values(doc?.values ?? {}).map((value) => value?.displayValue)].join(' '));
    const dossier = municipalDossier(words, city);
    if (!dossier && (!PERMIT_WORDS.test(words) || NOT_A_DOSSIER.test(words))) continue;
    const published = municipalDate(field(doc, 'CI_DATE_DEBUT_AFFICHAGE_PUBLIC'))
      ?? municipalDate(field(doc, 'DATEACTE')) ?? municipalDate(String(doc?.createdAt ?? '').slice(0, 10));
    if (published && published < since) continue;
    let url;
    try { url = new URL(doc.bifferPath || doc.path, city.source.base); } catch { continue; }
    if (url.origin !== new URL(city.source.base).origin || !/\.pdf$/i.test(url.pathname)) continue;
    files.push({ url: url.href, title, board: boardOf(words) ?? 'decisions', published,
      decidedOn: municipalDate(field(doc, 'DATEACTE')), layout: 'dematdoc-notice' });
  }
  return [...new Map(files.map((file) => [file.url, file])).values()];
}

/** The oldest day a page of documents reaches, to know when to stop paging. */
export function dematdocOldest(documents) {
  const days = (Array.isArray(documents) ? documents : [])
    .map((doc) => municipalDate(String(doc?.createdAt ?? '').slice(0, 10))).filter(Boolean).sort();
  return days[0] ?? null;
}

// --- Reading one act ---------------------------------------------------------

/** Runs grouped by baseline, left to right, each line keeping its runs. */
function pageLines(page) {
  const lines = [];
  for (const run of [...(page?.runs ?? [])].filter((r) => clean(r.text)).sort((a, b) => b.y - a.y)) {
    const previous = lines.at(-1);
    if (previous && Math.abs(previous.y - run.y) < 2.5) previous.runs.push(run);
    else lines.push({ y: run.y, runs: [run] });
  }
  for (const line of lines) {
    line.runs.sort((a, b) => a.x - b.x);
    line.text = clean(line.runs.map((run) => run.text).join(' '));
  }
  return lines;
}

/** A spaced-out number (`C U 0 3 0 0 1 9 2 6 0 0 0 8 1`) closed up. */
const closeSpacedLetters = (text) => text.replace(/\b(?:[A-Z0-9] ){6,}[A-Z0-9]\b/g, (whole) => whole.replace(/ /g, ''));

// i18n-ignore-start — the labels the communes' ADS software prints
const SITE_LABELS = [
  /(?:sur\s*un\s*)?terrain\s*(?:sis|situ[ée]e?|si[a-z]?)(?:\s*(?:[àa]|au)(?![\p{L}]))?\s*[:|]?\s*/iu,
  /adresse\s*(?:du\s*|des\s*|de\s+la\s*)?(?:terrain|travaux|projet|construction)\s*[:|]?\s*/i,
  /sis\s*[àa]\s*l.adresse\s+suivante\s*:?\s*/i,
  /^(?:lieu|localisation(?:\s+du\s+terrain)?|situation\s+du\s+terrain|terrain)\s*(?::\s*|$)/i,
  // Aumetz's decisions on declarations, « Sur un terrain : 19 rue d'Ottange à AUMETZ »; Maing's, « Sur un terrain | 9 RUE … » over « SIS : | 59233 MAING ».
  /^sur\s+un\s+terrain\s*[:|]\s*/i,
  // « Terrain sis » read by OCR as « en sis » (Graveson).
  /^(?:\S{1,8}\s+)?sis\s*(?:[àa]\s*)?:?\s+(?=\d)/i,
];
const PARCEL_LABEL = /(?:r[ée]f[ée]rences?(?:\s*\(s\))?\s*cadastrales?(?:\s*\(s\))?|cadastr[ée]e?s?|cadastre|parcelles?(?:\s+cadastrales?)?(?:\s+n°)?)\s*[:|]?\s*(\S.*)$/i;
const FILED = /(?:date\s*d[eu]\s*d[ée]p[ôo]t|date\s*de\s*r[ée]ception|d[ée]pos[ée]e?\s*(?:complet\s*)?(?:[àa]\s+la\s+mairie\s+)?le|(?:demande|dossier)\s*d[ée]pos[ée]e?\s*(?:complet\s*)?le)\s*:?\s*\|?\s*(\d{1,2}\/\d{2}\/\d{4}|\d{1,2}\s+\S+\s+20\d{2})/i;
const SIGNED = /\bFait\s+[àa][\s\S]{0,60}?\ble\s*:?\s*(\d{1,2}\/\d{2}\/\d{4}|\d{1,2}(?:er)?\s+\S+\s+20\d{2})/i;
// Failing « Fait à », a line opening with the commune's name in capitals: « ETUPES, le 30 septembre 2026 ».
const SIGNED_AT = /(?:^|\n)\s*[A-ZÀ-Ý][A-ZÀ-Ý'’ -]{2,40},\s*le\s+(\d{1,2}\/\d{2}\/\d{4}|\d{1,2}(?:er)?\s+\S+\s+20\d{2})/;
// « BIESHEIM, le 22 septembre 2026 » alone on its line: the signing day of the orders that print no « Fait à ».
const SIGNED_LINE = /^[\p{Lu}][\p{L}'’ .-]{2,40},\s*le\s+(\d{1,2}\/\d{2}\/\d{4}|\d{1,2}(?:er)?\s+\S+\s+20\d{2})\s*$/mu;
// The identifier the préfecture's télétransmission stamps on each page of an act
// (« ID : 062-216202762-20260928-PC2026_00020-AU »): its third field is the act's
// own day, read when the signature is a stamp the OCR sets apart from « Fait à … le » (Douvrin).
const ACTES_ID = /\bID\s*:\s*\d{3}-\d{9}-(20\d{2})(\d{2})(\d{2})-/;
// « Le 24 septembre 2026 » over « Le Maire » at the head of the last block of the order (Rurange).
const SIGNED_BLOCK = /^Le\s+(\d{1,2}(?:er)?\s+\S+\s+20\d{2}|\d{2}\/\d{2}\/\d{4})\s*\n\s*Le\s+Maire\b/imu;
// A rubber stamp alone on its line (« 2 9 SEP. 2026 », OCR spaces the digits): the day a mayor signs with
// one over « CLOUANGE, le » (Clouange).
const SIGNED_STAMP = /^\W{0,3}(\d)\s?(\d)\s+([A-ZÉÛ]{3,9})[.,]?\s+(20\d{2})\s*$/mu;
const PURPOSE = /^(?:nature\s*des\s*travaux|pour|objet\s*de\s*la\s*demande|concernant)\s*:\s*[|]?\s*/i;
// A value with one of these is an applicant's or an office's, never a site.
const PERSON = /\b(?:M\.|MM\.|Mme|Mlle|Monsieur|Madame|Messieurs|SCI|SAS|SASU|SARL|EURL|SNC|SCCV|repr[ée]sent[ée]|demeurant|@)/i;
const NOT_A_SITE = /^(?:\d{1,2}\/\d{2}\/\d{4}|superficie|surface|zone|destination|nature|travaux|le maire|vu\b|demandeur|par\s*:)/i;
// A parcel reference where the site should be is no address, but the act's parcels place it when no label gives one
// (Wasquehal prints « terrain sis : Cadastré : BD40, BD74 » under the address, which sits a line above its label;
// Rouvroy, « 62320 ROUVROY » alone, the parcels on the next line).
const PARCELS_FOR_SITE = /^(?:r[ée]f[ée]rences?\s+cadastrales?|cadastr|parcelles?\b|section\b)/i;
// A site names a number or a kind of way; « Travaux sur construction existante » does not.
const SITE_WORDS = /\d|\b(?:rue|chemin|che|avenue|av|all[ée]e|route|rte|impasse|imp|place|pl|boulevard|bd|quai|lotissement|lot|lieu[- ]?dit|cours|mont[ée]e|square|voie|cami|camin|hameau|zac|za|zi|parc|r[ée]sidence|domaine|clos|sentier|passage|faubourg|esplanade|traverse|rond[- ]point|chemin|mas|quartier|cité|cite|côte|cote|sente|venelle|ruelle|promenade|grande rue|grand rue|boucle|parvis|villa)\b/i;
// A line that is a street and nothing else: a house number at most, then the kind of way.
const WAY_FIRST = /^(?:\d{1,4}\s*(?:bis|ter|[a-d])?\s*,?\s+)?(?:rue|chemin|che|avenue|av|all[ée]e|route|rte|impasse|imp|place|boulevard|bd|quai|lotissement|lieu[- ]?dit|cours|mont[ée]e|square|voie|hameau|r[ée]sidence|domaine|clos|sentier|passage|faubourg|ruelle|grande?\s+(?:rue|place)|grand['’]\s*rue)\b/i;
// A street cut at the end of its line: « 26 allée de », « Chemin de ».
const CUT_END = /(?:\b(?:de|du|des|la|le|les|d'|l'|d’|l’|rue|chemin|impasse|all[ée]e|avenue|route|place|boulevard|lotissement|lieu[- ]dit)|[,-])\s*$/i;
// … but « Grande Rue », « Grand'rue », « Haute Rue » end with their way's word: the name is whole.
const WHOLE_WAY = /\b(?:grande?|petite|haute|basse|vieille|nouvelle|ancienne|belle|longue)\s*['’‘-]?\s*(?:rue|route|place|all[ée]e|avenue|impasse|chemin|ruelle)\s*$/i;
const CUT = { test: (value) => CUT_END.test(value) && !WHOLE_WAY.test(value) };
// i18n-ignore-end

/**
 * The text right of a label on its line, cut at a wide gap (a second column).
 * `works`: the value is the works, whose words OCR may space evenly across a
 * justified line — gaps all wide and alike are no column there (Bauvin's
 * « Travaux   sur   construction », 45 points apart).
 */
function valueAfter(line, label, maxGap = 30, limitX = Infinity, works = false) {
  const at = label.exec(line.text);
  if (!at) return null;
  // Locate the run where the label ends, then read runs rightwards.
  let consumed = 0;
  let index = 0;
  const end = at.index + at[0].length;
  for (; index < line.runs.length; index += 1) {
    const length = clean(line.runs[index].text).length + 1;
    if (consumed + length > end) break;
    consumed += length;
  }
  // Where the label starts: a value standing under it is in that column.
  let start = 0;
  for (let i = 0, seen = 0; i < line.runs.length; i += 1) {
    seen += clean(line.runs[i].text).length + 1;
    if (seen > at.index) { start = line.runs[i].x; break; }
  }
  // The applicant's column bounds a label that stands left of it, not one in a form drawn in that column.
  const cap = start < limitX - 20 ? limitX : Infinity;
  const runs = line.runs.slice(index);
  if (!runs.length) return { text: '', x: start };
  const first = runs[0];
  const offset = Math.max(0, end - consumed);
  const pieces = [clean(first.text).slice(offset)];
  let right = first.x1 ?? first.x;
  const gaps = runs.slice(1).map((run, i) => run.x - (runs[i].x1 ?? runs[i].x));
  const even = works && gaps.length >= 2 && Math.min(...gaps) > maxGap && Math.max(...gaps) < 1.5 * Math.min(...gaps);
  // OCR reads a cell's border as « | »: it ends the works (Anor's « … 1340 m2 | Destination : Habitation »),
  // and a site in a table that has an applicant's column. In any other site it is a letter OCR
  // misread (Lillers' « résidence fontaine | évêque », for « l'Évêque »).
  const bordered = works || Number.isFinite(limitX);
  // A gap of 30 pt is a second column: Montélimar prints the works right of
  // the site, on its own baseline.
  for (const run of runs.slice(1)) {
    // The applicant's cell starts at `limitX`.
    if ((!even && run.x - right > maxGap) || run.x >= cap
      || (bordered && /^\|/.test(run.text) && clean(pieces.join(' ')).replace(/\|/g, '').trim())) break;
    pieces.push(run.text);
    right = run.x1 ?? run.x;
  }
  return { text: clean(pieces.join(' ')), x: Math.min(start, first.x) };
}

const foldName = (value) => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

/**
 * The street of a site, without the commune and postcode most acts print
 * after it (« 1152 Chemin de Poulmas à BESSE-SUR-ISSOLE (83890) ») — but a
 * street that holds « à » keeps it (« Impasse du Moulin à Vent »).
 */
function trimSite(value, city) {
  let site = clean(value).replace(/^[\s:|;,[-]+/, '');
  // « 57185 CLOUANGE » alone is a commune, not a site: the postcode goes, and so does what is left.
  site = site.replace(/^\d{5}\s+(?=\p{L})/u, '');
  // Garchizy prints the parcels after the street: « 409 Avenue de la République - Cadastré: AK 385 ».
  site = site.replace(/\s*\(\s*\d{5}\s*\)/g, ' ').replace(/\s+\d{5}\b.*$/, '').replace(/\s+[-–]\s*cadastr[ée].*$/i, '');
  site = site.replace(/\s*[;.]\s*$/, '').replace(/,\s*zone\b.*$/i, '');
  const name = foldName(city.name ?? '');
  const at = /^(.*\S)\s+[àa]\s+(.+)$/i.exec(site);
  if (at && name) {
    const tail = foldName(at[2]);
    if (tail && (name.startsWith(tail) || tail.startsWith(name.split(' ')[0]))) site = at[1];
  }
  if (name && foldName(site).endsWith(` ${name}`)) site = site.slice(0, site.length - (city.name ?? '').length).trim();
  site = site.replace(/,\s*(?:au|aux|[àa]|en|le|la|les|du|de)\s*$/i, '').replace(/\s+[àa]$/i, '').replace(/[\s|,;–"«»-]+$/, '');
  return municipalSite(site, city);
}

/**
 * Cadastral references as `listParcels` reads them: `AB 12, C 138`. A
 * leading number equal to the commune's own three digits (Marseillan's
 * `150 CX 585`) is how Cart@DS prints the commune, not a prefix.
 */
export function dematdocParcels(value, city) {
  const out = [];
  const own = Number(String(city?.insee ?? '').slice(2));
  for (const match of String(value ?? '').toUpperCase().matchAll(/(?:\b(\d{1,3})\s+|\b0{0,3})0?([A-Z]{1,2})\s*[-\s]?\s*0*(\d{1,4})\b/g)) {
    if (/^(?:M|ME|N|NO|M2)$/.test(match[2])) continue;
    // « Parcelles 0168 et 0169 » (Clouange): the conjunction between two numbers is no section « ET ».
    if (match[2] === 'ET' && (match[1] || /\d\s*$/.test(String(value).slice(0, match.index)))) continue;
    const prefix = match[1] && Number(match[1]) && Number(match[1]) !== own ? `${match[1]} ` : '';
    out.push(`${prefix}${match[2]} ${match[3]}`);
  }
  return out.length ? [...new Set(out)].join(', ') : null;
}

/**
 * The value under a label standing alone, in its column, across a cut line —
 * or on the line a skewed scan prints a few points above it (Biesheim's
 * `Sur un terrain sis :` 3.6 points below its value).
 */
function valueBelow(lines, i, x) {
  const above = lines[i - 1];
  if (above && above.y - lines[i].y > 0 && above.y - lines[i].y < 6) {
    const level = clean(above.runs.filter((run) => run.x >= x - 40 && run.x < x + 260).map((run) => run.text).join(' '));
    // The label's own « à : » may sit on the value's line (Lançon-Provence's « Sur un terrain sis » under « à : 1150 Avenue … »).
    if (/\d/.test(level) && above.runs[0].x > lines[i].runs.at(-1).x1 - 5) return level.replace(/^(?:[àa]|au)\s*[:|]\s*/i, '');
  }
  const below = lines.slice(i + 1, i + 4).map((line) => clean(line.runs
    .filter((run) => run.x >= x - 40 && run.x < x + 260).map((run) => run.text).join(' '))).filter(Boolean);
  let text = below[0] ?? '';
  if (text && !/\d/.test(text) && /^\d+\s*(?:bis|ter)?\s*,?\s+\S/i.test(below[1] ?? '')) text = below[1];
  return text;
}

/**
 * One DematDOC act: avis de dépôt, récépissé or decision, as the commune's
 * ADS software printed it. The site is the value of the first site label
 * (on its line, or the line below when the label stands alone), read in the
 * label's column only; the parcels, filing day, purpose and the verdict of
 * the operative article are labelled too. A file whose number or site
 * cannot be read gives no row — a scan then waits for the sweep's OCR.
 *
 * @param {{pages: Array<{runs: Array<object>, width?: number}>}} document
 * @param {{city: object, file: object}} context
 * @returns {Array<object>}
 */
export function readDematdocNotice(document, { city, file }) {
  const pages = (document?.pages ?? []).slice(0, 4).map(pageLines);
  const front = pages.slice(0, 2).flat();
  const lines = pages.flat();
  if (front.length < 3) return [];
  const head = closeSpacedLetters(front.slice(0, 45).map((line) => line.text).join(' '));
  let dossier = municipalDossier(head, city) ?? municipalDossier(file.title ?? '', city);
  if (!dossier) return [];
  // The amendment suffix a link types (`N0036M01`) wins over one OCR garbles (`T4`) or drops.
  const linked = file.row?.dossier;
  const suffixOf = (value) => /\s([MT]\d{1,2})$/.exec(value ?? '')?.[1];
  if (linked && linked !== dossier && suffixOf(linked) && linked.replace(/\s[MT]\d{1,2}$/, '') === dossier.replace(/\s[MT]\d{1,2}$/, '')
    && !/^[MT]\d{2}$/.test(suffixOf(dossier) ?? '')) dossier = linked;
  // A table that prints « Demandeur : » at its right edge keeps the applicant's
  // name and address there, level with the works (Val de Briey, 14 points right
  // of them): nothing from that column is a site or a purpose. The word opens
  // that column, a wide gap left of it; inside a label (Marseillan's « Adresse
  // du demandeur : », its works on the next line) it bounds nothing.
  const pageWidth = document?.pages?.[0]?.width ?? 595;
  const applicantX = Math.min(Infinity, ...front.flatMap((line) => line.runs
    .filter((run, i) => /^demandeurs?$/i.test(clean(run.text)) && run.x > pageWidth * 0.4
      && (i === 0 || run.x - (line.runs[i - 1].x1 ?? line.runs[i - 1].x) > 30))
    .map((run) => run.x - 4)));
  let site = null;
  let unplaced = false;
  for (let i = 0; i < front.length && !site; i += 1) {
    for (const label of SITE_LABELS) {
      const value = valueAfter(front[i], label, 30, applicantX);
      if (!value) continue;
      let text = value.text;
      if (!text || text.length < 3) text = valueBelow(front, i, value.x);
      else if (CUT.test(text)) {
        const next = valueBelow(front, i, value.x);
        // Not a postcode line, nor the next label (« Parcelles : ZI313 »).
        if (next && !/^\d{5}\b/.test(next) && !/^[\p{L}'’() .]{2,40}:/u.test(next) && !PERSON.test(next)) text = `${text} ${next}`;
      }
      // « 51110 POMACLE » over « Route de Bazancourt » (Pomacle's notices): the commune, then the site under it.
      if (/^\d{5}\s+\p{L}[\p{L}'’ .-]*$/u.test(clean(text))) {
        const below = valueBelow(front, i, value.x);
        if (WAY_FIRST.test(below) && !PERSON.test(below)) text = below;
      }
      if (text && !PERSON.test(text) && PARCELS_FOR_SITE.test(text)) { unplaced = true; continue; }
      if (!text || PERSON.test(text) || NOT_A_SITE.test(text) || !/\p{L}{3}/u.test(text)) continue;
      const trimmed = trimSite(text, city);
      // « 62320 ROUVROY »: the commune, not the site.
      if (!trimmed.address || /^\d{5}\s+\p{L}[\p{L}'’ .-]*$/u.test(clean(text))) unplaced = true;
      if (!trimmed.address || !SITE_WORDS.test(trimmed.address) || !/\p{L}{3}/u.test(trimmed.address) || CUT.test(trimmed.address)) continue;
      site = trimmed;
      break;
    }
  }
  // The first labelled line only: a later sentence that says « parcelles » is the order's own note (Hagondange's
  // « sur les parcelles voisines … norme NF P 94-500 révisée le 30 novembre » is no parcel « P 94 » and « LE 30 »).
  const parcelLine = front.map((line) => PARCEL_LABEL.exec(line.text)?.[1]).find(Boolean);
  if (!site) {
    const parcels = unplaced && !file.noParcels ? dematdocParcels(parcelLine, city) : null;
    if (!parcels) return [];
    site = { address: null, postcode: city.postcode ?? null, parcels };
  }
  // « 21 / 9 /2026 » (Rurange's « Date de dépôt ») as the numeric days the readers below expect.
  const body = lines.map((line) => line.text).join('\n')
    .replace(/\b(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(20\d{2})\b/g, (whole, day, month, year) => `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`);
  // The works stop at the table's next cell: Val de Briey prints the applicant's
  // address right of them, on the same baseline, 14 points on (`applicantX`).
  const purpose = front.map((line) => valueAfter(line, PURPOSE, 30, applicantX, true)?.text).find((value) => value && !PERSON.test(value));
  const top = front.slice(0, 15).map((line) => line.text);
  const board = boardOfHeading(top) ?? boardOf(top.join(' ')) ?? boardOf(file.title ?? '') ?? file.board ?? 'decisions';
  const filedOn = municipalDate(FILED.exec(body)?.[1]);
  const row = {
    board,
    dossier,
    applicant: null,
    address: site.address,
    postcode: site.postcode,
    parcels: file.noParcels ? null : dematdocParcels(parcelLine, city) ?? site.parcels ?? null,
    purpose: purpose ? clean(purpose).replace(/^[|:\s]+/, '').slice(0, 200) : null,
    filedOn,
    postedOn: file.published ?? null,
  };
  if (board === 'decisions') {
    // The operative article opens a line; « Vu … l'article 1 de la loi » does not.
    // OCR reads « 1er » as « ler » (Garchizy).
    const opening = /(?:^|\n)\s*ARTICLE\s*(?:1(?:er)?|[lI]er|UNIQUE|PREMIER)\b\s*[:.\-–]?/i.exec(body);
    const article = opening ? body.slice(opening.index + opening[0].length, opening.index + opening[0].length + 500)
      .split(/\n\s*ARTICLE\s*\d/i)[0] : null;
    // The heading's verdict line by line, so that « OPPOSITION À DÉCLARATION » starts one.
    const titled = top.slice(0, 8).map((line) => municipalVerdict(line)).find(Boolean);
    // The article's first sentence says the verdict; a later one may name the
    // withdrawal the law allows (Coulogne: « … pas fait opposition … » then « retrait »).
    const said = article?.split(/(?<=[.;])\s/)[0];
    row.verdict = municipalVerdict(said) ?? municipalVerdict(article) ?? titled ?? municipalVerdict(file.title) ?? verdicts.signed.fr;
    const stamped = ACTES_ID.exec(body);
    const stamp = SIGNED_STAMP.exec(body);
    // A lone stamp of the filing day is the reception's, not the signature's (Wasquehal's « 15 SEP, 2026 »).
    const stampDay = stamp ? municipalDate(`${stamp[1]}${stamp[2]} ${stamp[3]} ${stamp[4]}`) : null;
    const signed = municipalDate(SIGNED.exec(body)?.[1] ?? SIGNED_AT.exec(body)?.[1] ?? SIGNED_LINE.exec(body)?.[1] ?? SIGNED_BLOCK.exec(body)?.[1])
      ?? (stampDay && (!filedOn || stampDay > filedOn) ? stampDay : null)
      ?? (stamped ? municipalDate(`${stamped[1]}-${stamped[2]}-${stamped[3]}`) : null);
    // `file.signedBy`: the day the board posted the act, exact — an order cannot be signed after it
    // (a handwritten « 2025 » OCR reads as « 2028 », Maing).
    row.decidedOn = file.decidedOn ?? (signed && (!filedOn || signed >= filedOn) && (!file.signedBy || signed <= file.signedBy) ? signed : null);
  }
  return [row];
}

/**
 * Title-derived fields while a scan awaits the sweep's OCR: the number and,
 * when the title ends with one, a street address — never the free text,
 * which often names the applicant. No address, no row.
 */
export function dematdocTitleRow(city, file) {
  const title = clean(file?.title);
  const dossier = municipalDossier(title, city);
  if (!dossier) return null;
  // i18n-ignore-next-line — French street words
  const street = /^\d{1,4}\s*(?:bis|ter|[a-d])?\s*,?\s+(?:rue|chemin|avenue|all[ée]e|route|impasse|place|boulevard|quai|lotissement|cours|mont[ée]e|square|voie|lieu-dit)\b/i;
  // A piece of the title that starts with a number and a way, and nothing else.
  const piece = title.split(/\s+[-–—|]\s+/).find((part) => street.test(part) && !PERSON.test(part));
  if (!piece) return null;
  const site = trimSite(piece.replace(/\s+du\s+20\d{2}-\d{2}-\d{2}.*$/, ''), city);
  if (!site.address) return null;
  const board = boardOf(title) ?? file.board;
  return { board, dossier, applicant: null, ...site, postedOn: file.published ?? null,
    verdict: board === 'decisions' ? municipalVerdict(title) ?? verdicts.signed.fr : null };
}
