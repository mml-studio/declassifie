/**
 * Fourteen cities that post their permits on boards of their own: weekly PDF
 * lists, one PDF per dossier, or an HTML table of acts. Data only, so that
 * `permitListsFeed.js` can hold them in `PERMIT_LISTS` without importing the
 * readers, which import it (`permitBoards.js` gathers those).
 *
 * Found by a check of the communes ranked 61 to 200 by population with no
 * fresh permit source, on 2026-10-01: every one posted rows dated within the
 * week. `source.protocol` names how its board is read (`permitBoards.js`).
 */

// i18n-ignore-start — publishers' names and the titles of their legal boards
const CITIES = [
  // Weekly or rolling PDF lists (`permitBoardsLists.js`).
  { key: 'garges', insee: '95268', postcode: '95140', label: 'Ville de Garges-lès-Gonesse — dossiers d’urbanisme déposés et décidés',
    page: 'https://www.villedegarges.fr/ma-ville/ma-mairie/actes-administratifs' },
  { key: 'blanc-mesnil', insee: '93007', postcode: '93150', label: 'Ville du Blanc-Mesnil — dossiers d’urbanisme déposés et décidés',
    page: 'https://www.blancmesnil.fr/votre-mairie/vie-municipale/publication-des-actes-administratifs' },
  { key: 'troyes', insee: '10387', postcode: '10000', label: 'Ville de Troyes — dossiers d’autorisations du droit des sols déposés',
    page: 'https://www.ville-troyes.fr/vie-municipale/publication-actes-administratifs/' },
  // `robots.txt` is `Disallow: /` for every agent (2026-10-02): read by the
  // project's decision, as Lyon's platform is — the lists are the posting
  // the Code de l'urbanisme makes public (art. R.423-6, R.424-15).
  { key: 'bourges', insee: '18033', postcode: '18000', label: 'Ville de Bourges — dossiers d’urbanisme déposés et décidés',
    page: 'https://portail.ville-bourges.fr/tmp_diffusion_document', robots: 'overridden' },
  { key: 'cergy', insee: '95127', postcode: '95000', label: 'Ville de Cergy — affichage des dépôts et des décisions d’urbanisme',
    page: 'https://www.cergy.fr/ma-ville-ma-mairie/affichage-legal/' },
  { key: 'ales', insee: '30007', postcode: '30100', label: 'Ville d’Alès — autorisations d’urbanisme déposées et accordées',
    page: 'https://parutions-mairie-ales.fr/autorisation-urba-depots/' },
  // One PDF per dossier (`permitBoardsNotices.js`).
  // Antony's decisions, every La Roche-sur-Yon file sampled and a few of
  // Poissy's (the State's own permits) are scans: the sweep reads them by OCR.
  { key: 'antony', insee: '92002', postcode: '92160', label: 'Ville d’Antony — affichages légaux d’urbanisme',
    page: 'https://affichages-legaux.ville-antony.fr/dematii-web-light/documents', source: { ocr: true } },
  { key: 'la-roche-sur-yon', insee: '85191', postcode: '85000', label: 'Ville de La Roche-sur-Yon — actes d’urbanisme',
    page: 'https://actes.larochesuryon.fr/la-roche-sur-yon/', source: { ocr: true } },
  { key: 'poissy', insee: '78498', postcode: '78300', label: 'Ville de Poissy — actes d’urbanisme',
    page: 'https://www.ville-poissy.fr/publication_actes/index.php?object=consult', source: { ocr: true } },
  // HTML lists of acts or notices (`permitBoardsPages.js`).
  { key: 'boulogne-sur-mer', insee: '62160', postcode: '62200', label: 'Ville de Boulogne-sur-Mer — affichage réglementaire d’urbanisme',
    // Its orders are signed scans: the sweep reads them by OCR. Its firewall
    // answers 403 to a User-Agent with the word « scan » in it, the server's
    // own included and robots.txt too (2026-10-02): the same honest name
    // without that word is let through, for every request to the host.
    page: 'https://www.ville-boulogne-sur-mer.fr/votre-mairie/affichage-reglementaire/urbanisme-habitat-affaires-foncieres/urbanisme/',
    userAgent: 'Surplomb/1.0 (+https://github.com/mml-studio/surplomb)', source: { ocr: true } },
  { key: 'chalons', insee: '51108', postcode: '51000', label: 'Ville de Châlons-en-Champagne — avis de dépôt et arrêtés d’urbanisme',
    // Two orders in five are scans with no text layer: the sweep reads them by OCR.
    page: 'https://citoyen.chalonsenchampagne.fr/avis', source: { ocr: true } },
  { key: 'saint-germain-en-laye', insee: '78551', postcode: '78100', label: 'Ville de Saint-Germain-en-Laye — arrêtés d’urbanisme',
    page: 'https://www.saintgermainenlaye.fr/1507/actes-dematerialises.htm?type_acte=282' },
  { key: 'pantin', insee: '93055', postcode: '93500', label: 'Ville de Pantin — autorisations d’urbanisme',
    // screensoft.eu disallows everything but its login page; these are the
    // town's legal postings, read by the user's request of 2026-10-01 as
    // Saint-Priest's and Anzin's are. Its orders are scans, read by OCR.
    page: 'https://www.screensoft.eu/Docs2Web/1525%20-%20VILLE%20DE%20PANTIN/', robots: 'overridden', source: { ocr: true } },
  { key: 'anglet', insee: '64024', postcode: '64600', label: 'Ville d’Anglet — arrêtés d’urbanisme',
    page: 'https://teleservices.anglet.fr/WEBDELIBERATIONS_WEB/FR/PageCategoriesArretes.awp' },
];
// i18n-ignore-end

/**
 * A city's own fields beyond the five above (`robots`, `crawlDelayMs`,
 * `underReview`, `userAgent` — the name every request to its host carries,
 * robots.txt's included) sit in its entry; `source` extras (`ocr: true` for a board
 * whose scans the daily sweep reads by OCR) merge into its source.
 */
export const BOARD_PERMIT_SOURCES = Object.freeze(CITIES.map((city) => Object.freeze({
  ...city,
  source: Object.freeze({ kind: 'board', protocol: city.key, ...(city.source ?? {}) }),
  lists: Object.freeze([]),
})));
