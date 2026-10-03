/**
 * Communes whose IntraMuros website posts their urbanism acts, read by the
 * `intramuros` protocol (`permitBoardsIntramuros.js`): [INSEE, postcode,
 * name, website host]. Data only, appended to `permitBoardCities.js`'s list.
 * Found on 2026-10-03 by asking `/documents_administratifs` of every
 * uncovered commune's website above 500 inhabitants: 159 are IntraMuros
 * sites, 27 posted urbanism acts since July, and these five give placeable
 * rows — a site in the title, or orders with a text layer. The others post
 * scans OCR does not read (Hurigny, Maurecourt), lists (Benfeld, read as a
 * posted list), or nothing that names a dossier.
 */
// i18n-ignore-start — publishers' names
const COMMUNES = [
  ['31091', '31150', 'Bruguières', 'www.mairie-bruguieres.fr'],
  ['59663', '59470', 'Wormhout', 'www.ville-wormhout.fr'],
  ['60450', '60530', 'Neuilly-en-Thelle', 'neuillyenthelle.fr'],
  ['44164', '44680', 'Saint-Hilaire-de-Chaléons', 'www.saint-hilaire-de-chaleons.fr'],
  ['78010', '78580', 'Les Alluets-le-Roi', 'www.les-alluets-le-roi.fr'],
];
// i18n-ignore-end

export const INTRAMUROS_CITIES = COMMUNES.map(([insee, postcode, name, host]) => ({
  key: `intramuros-${insee}`, insee, postcode,
  label: `${name} — actes d’urbanisme`, // i18n-ignore-line — the commune's name and its board's title
  page: `https://${host}/documents_administratifs`,
  source: { protocol: 'intramuros', ocr: true },
}));
