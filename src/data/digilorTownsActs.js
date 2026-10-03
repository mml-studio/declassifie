/**
 * Small Digilor Datahall towns that post one PDF per act — an avis de dépôt,
 * a récépissé or an order — on their urbanism shelves: [INSEE, postcode,
 * name, app, categories]. Data only (see `digilorTowns.js`). Each is read by
 * `dematdoc-notice`, which takes the number, the site and the board from the
 * act itself; a scan waits for the sweep's OCR. Found on 2026-10-03: of the
 * 113 towns whose urbanism shelves held permit titles since July, these 15
 * gave placeable rows through the reader (eight files each, no OCR); the
 * others post scans, which the sweep may read later, or acts the reader does
 * not parse.
 */
// i18n-ignore-start — publishers' names
const TOWNS = [
  ['13110', '13530', 'Trets', 294, [2535]],
  ['49050', '49250', 'Brissac Loire Aubance', 470, [4829]],
  ['54580', '54190', 'Villerupt', 431, [4215]],
  ['82125', '82700', 'Montech', 308, [2679]],
  ['14271', '14123', 'Fleury-sur-Orne', 518, [5153]],
  ['57209', '57380', 'Faulquemont', 289, [2459]],
  ['59550', '59496', 'Salomé', 511, [5047]],
  ['33478', '33660', 'Saint-Seurin-sur-l’Isle', 203, [1801]],
  ['22147', '22230', 'Merdrignac', 102, [1066]],
  ['53003', '53300', 'Ambrières-les-Vallées', 107, [1019]],
  ['62235', '62360', 'Condette', 429, [4041]],
  ['25390', '25650', 'Pays-de-Montbenoît', 574, [6215]],
  ['57575', '57645', 'Retonfey', 545, [5736]],
  ['57152', '57480', 'Contz-les-Bains', 581, [6423]],
  ['51439', '51110', 'Pomacle', 199, [1907, 1787]],
];
// i18n-ignore-end

export const DIGILOR_TOWNS_ACTS = TOWNS.map(([insee, postcode, name, app, categories]) => ({
  key: `digilor-${insee}`, insee, postcode,
  label: `${name} — actes d’urbanisme`, // i18n-ignore-line — the town's name and its board's title
  page: `https://datahall.mydigilor.fr/web/#/documents/${app}`,
  source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app, ocr: true,
    shelves: categories.map((category) => ({ category, board: 'auto', fallback: 'decisions', layout: 'dematdoc-notice' })) },
  lists: [],
}));
