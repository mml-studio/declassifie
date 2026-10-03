/**
 * Digilor Datahall towns, batch B: data only (see `digilorTowns.js`).
 * Each entry is a `PERMIT_LISTS` city whose `source.kind` is `digilor`.
 */
// i18n-ignore-start — publishers' names and the titles of their legal boards
export const DIGILOR_TOWNS_B = [
  // Manosque (app 327) posts scanned individual filing notices on the public
  // AVIS DE DEPOT category. The PDF's labelled project address and dossier
  // are read by the existing notice reader; unread identities stay withheld.
  // Read on 2026-10-03: 32 September notices, 13 safely placeable after OCR.
  { key: 'digilor-manosque', insee: '04112', postcode: '04100', label: 'Ville de Manosque — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/327',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 327, ocr: true, checkDossier: true, shelves: [
      { category: 3608, sub: 0, board: 'filings', layout: 'outer-notice' },
    ] }, lists: [] },
  // Montluçon (app 216) instructs on Cart@DS and posts its two reports every
  // Monday on « Aménagement - Urbanisme - Foncier » / sub-category 3015, named
  // by day: `2026_09_28_dépôts` (« Liste des avis de dépôt », every dossier
  // still under instruction) and `2026_09_28_décisions` (« Liste des
  // décisions »), the same template as Valence's. The rest of the category
  // (sub-category 0) holds antenna and public-inquiry notices. Read live on
  // 2026-10-03: the eight reports of September give 200 filings and 242
  // decisions, every row with its site and parcels.
  { key: 'digilor-montlucon', insee: '03185', postcode: '03100', label: 'Ville de Montluçon — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/216',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 216, shelves: [
      { category: 2442, sub: 3015, title: '\\bDEPOTS?\\b', board: 'filings', layout: 'cartds-report-filings' },
      { category: 2442, sub: 3015, title: '\\bDECISIONS?\\b', board: 'decisions', layout: 'cartds-report-decisions' },
    ] }, lists: [] },
  // Saint-Laurent-du-Var (app 151) posts on « URBANISME » every Thursday one
  // list per family of the dossiers under instruction, one sub-category each
  // (1844 PC, 1845 DP, 1852 PA, 1853 PD): « Permis de construire déposés
  // avant le 01.10.2026 ». No decision is posted; the odd certificate of a
  // tacit decision (« DP00612326C0062 TACITE LE 04.06.2026 ») is left out.
  // Read live on 2026-10-03: the eight newest lists give 109 filings, every
  // row with its site (each list repeats the dossiers still under instruction).
  { key: 'digilor-saint-laurent-du-var', insee: '06123', postcode: '06700',
    label: 'Ville de Saint-Laurent-du-Var — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/151',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 151, shelves: [
      { category: 1672, title: '\\bDEPOSEE?S?\\b', board: 'filings', layout: 'digilor-saint-laurent-list' },
    ] }, lists: [] },
  // Illkirch-Graffenstaden (app 291) posts every Monday on « Autorisations
  // d'urbanisme » its list of filings (sub-category 3605, `2026-09-28
  // AFFICHAGE DEPOTS AUTORISATION URBANISME`) and of decisions (3606, `…
  // AFFICHAGE DECISIONS …`), titles typed by hand (`DEPOTSAUTORISATION
  // URBANSIME`): the sub-category decides the board.
  { key: 'digilor-illkirch-graffenstaden', insee: '67218', postcode: '67400',
    label: 'Ville d’Illkirch-Graffenstaden — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/291',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 291, shelves: [
      { category: 2755, sub: 3605, board: 'filings', layout: 'digilor-illkirch-list' },
      { category: 2755, sub: 3606, board: 'decisions', layout: 'digilor-illkirch-list' },
    ] }, lists: [] },
  // Concarneau (app 208) posts every Friday on « URBANISME ET AMÉNAGEMENT »
  // its register of filings (sub-category 7088, `2026-10-02-AFF-Autorisations
  // Urba-déposées`) and of decisions (7089, `…-décidées`). Sub-categories
  // 7092 and 7093 hold public inquiries and antenna notices.
  { key: 'digilor-concarneau', insee: '29039', postcode: '29900', label: 'Ville de Concarneau — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/208',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 208, shelves: [
      { category: 4464, sub: 7088, board: 'filings', layout: 'digilor-concarneau-register' },
      { category: 4464, sub: 7089, board: 'decisions', layout: 'digilor-concarneau-register' },
    ] }, lists: [] },
  // Yutz (app 402) posts one PDF per act on « Autorisations d'urbanisme »,
  // one sub-category per family and board: the avis de dépôt (5897 DP, 5824
  // PC, 5896 PD, 5898 PA), printed, which `extended-notice` reads; the orders
  // (5900 DP, 5899 PC, 5901 PD), scans titled by number and applicant, which
  // wait for the sweep's OCR. 5938 holds certificates (CU), 6166 ERP works.
  { key: 'digilor-yutz', insee: '57757', postcode: '57970', label: 'Ville de Yutz — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/402',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 402, ocr: true, shelves: [
      ...[5897, 5824, 5896, 5898].map((sub) => ({ category: 3801, sub, board: 'filings', layout: 'extended-notice' })),
      ...[5900, 5899, 5901].map((sub) => ({ category: 3801, sub, board: 'decisions', layout: 'digilor-yutz-order' })),
    ] }, lists: [] },
  // Verrières-le-Buisson (app 193) posts one PDF per act on « Urbanisme », a
  // sub-category per family and board: the avis de dépôt (1977 PC, 1979 DP,
  // 1983 PD), printed (`AVIS DE DEPOT DP2610151`), and the orders (1978 PC,
  // 1980 DP, 1984 PD), scans with the town's own OCR layer (`ARRETE
  // DP2610132`, `RETRAIT PC2410033`, `REJET DP2610084`). Certificates (CUb),
  // signs (AP) and ERP works (AT) have shelves of their own, left out.
  { key: 'digilor-verrieres-le-buisson', insee: '91645', postcode: '91370',
    label: 'Ville de Verrières-le-Buisson — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/193',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 193, ocr: true, shelves: [
      ...[1977, 1979, 1983].map((sub) => ({ category: 1771, sub, board: 'filings', layout: 'digilor-verrieres-filing' })),
      ...[1978, 1980, 1984].map((sub) => ({ category: 1771, sub, board: 'decisions', layout: 'digilor-verrieres-order' })),
    ] }, lists: [] },
  // Harnes (app 202) posts one PDF per act on « URBANISME », titled by the
  // site (`73 avenue des Saules`): the avis de dépôt on sub-category 5279,
  // the orders on 2078. The other sub-categories hold road orders (1919),
  // planning documents, inquiries and antenna notices.
  { key: 'digilor-harnes', insee: '62413', postcode: '62440', label: 'Ville de Harnes — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/202',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 202, shelves: [
      { category: 1683, sub: 5279, board: 'filings', layout: 'digilor-harnes-filing' },
      { category: 1683, sub: 2078, board: 'decisions', layout: 'digilor-harnes-order' },
    ] }, lists: [] },
  // Hénin-Beaumont (app 337) posts on « Urbanisme-Foncier » / sub-category
  // 3961 a weekly table of the dossiers filed (`TABLEAU AFFICHAGE DU 02 10 26
  // AU 09 10 2026`), printed, and one scan per order, titled by a short
  // number (`ARRETE DP 26 174`, `DP 2026-335`, `AM_DP_2026_286`, `PC
  // 2025-12M1`), beside road-alignment orders (`ARRETE ALIGNEMENT …`).
  // Sub-category 3962 holds hunting and pest-control notices.
  { key: 'digilor-henin-beaumont', insee: '62427', postcode: '62110', label: 'Ville d’Hénin-Beaumont — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/337',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 337, ocr: true, shelves: [
      { category: 2929, sub: 3961, title: '^TABLEAU AFFICHAGE\\b', board: 'filings', layout: 'digilor-henin-beaumont-table' },
      { category: 2929, sub: 3961, title: '\\b(?:PC|DP|PA|PD)[ -]?\\d', board: 'decisions', layout: 'digilor-henin-beaumont-order' },
    ] }, lists: [] },
];
// i18n-ignore-end
