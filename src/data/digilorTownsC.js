/**
 * Digilor Datahall towns, batch C: data only (see `digilorTowns.js`).
 * Each entry is a `PERMIT_LISTS` city whose `source.kind` is `digilor`.
 */
// i18n-ignore-start — publishers' names and the titles of their legal boards
export const DIGILOR_TOWNS_C = [
  // Saint-Estève (app 14) posts its instruction software's two registers in
  // one file every Friday on « Urbanisme » / sub-category 8459 (« AFFICHAGE
  // REGISTRE URBA SEMAINE 40 »): « Registre des dossiers en cours » (LIMITE)
  // then « Registre des décisions » (DÉCISION), the layout `register` reads,
  // each record with its site. The edition of 30 September 2026 gives 15
  // filings and 37 decisions; the five editions of September 72 and 181
  // rows, repeats included. The scans of August (« REGISTRE AFFICHAGE 21 08
  // 2026 », sub-category 0) repeat the same registers with no text: left out.
  { key: 'digilor-saint-esteve', insee: '66172', postcode: '66240', label: 'Ville de Saint-Estève — registre des autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/14',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 14, shelves: [
      { category: 104, sub: 8459, board: 'filings', layout: 'register' },
    ] }, lists: [] },
  // Dombasle-sur-Meurthe (app 12) posts one PDF per act on « URBANISME »,
  // named by its number: « DP 054 159 26 D 0192 - Avis de dépôt », « … D0177
  // arrete_signed », « … - Arrêté de décision ». Sub-category 53 holds the
  // avis de dépôt, 51 the DP orders and 52 the PC orders — each with the odd
  // avis filed beside them, so the title decides. 55 holds certificates of
  // urbanism, 0 work-site and survey notices. Read on 3 October 2026: the
  // files posted since 1 September give 20 filings and 19 decisions, every one
  // with its site; 3 scans wait for the sweep's OCR.
  { key: 'digilor-dombasle-sur-meurthe', insee: '54159', postcode: '54110', label: 'Ville de Dombasle-sur-Meurthe — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/12',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 12, ocr: true, shelves: [
      { category: 19, sub: 53, board: 'auto', layout: 'digilor-dombasle-act' },
      { category: 19, sub: 51, board: 'auto', layout: 'digilor-dombasle-act' },
      { category: 19, sub: 52, board: 'auto', layout: 'digilor-dombasle-act' },
    ] }, lists: [] },
  // Amnéville (app 148) posts one scanned PDF per act on « URBANISME »,
  // named by family and applicant, never by number (« AVIS DE DEPOT DP … »,
  // « ARRETE DE DP … »): sub-category 2029 the avis de dépôt, 2030 the PC
  // orders, 2031 the DP orders. No text layer: the sweep's OCR reads them
  // (`digilor-amneville-notice`), which no visitor's reading does. OCR on 3
  // October 2026 of the 16 files posted since 1 September: 7 filings and 7
  // decisions, each with its site, the orders with their verdict.
  { key: 'digilor-amneville', insee: '57019', postcode: '57360', label: 'Ville d’Amnéville — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/148',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 148, ocr: true, shelves: [
      { category: 1688, sub: 2029, board: 'filings', layout: 'digilor-amneville-notice' },
      { category: 1688, sub: 2030, board: 'decisions', layout: 'digilor-amneville-notice' },
      { category: 1688, sub: 2031, board: 'decisions', layout: 'digilor-amneville-notice' },
    ] }, lists: [] },
  // Ergué-Gabéric (app 68) posts its weekly list on « Urbanisme » with no
  // sub-category (« Affichage des AOS 280926_051026 », « ADS 14-09-26 »):
  // every dossier still under instruction (`digilor-ergue-list`). Its orders
  // are scans named by short number (« PC 26_49 DECISION », « DP 26-75 … »),
  // one sub-category per family — 1128 PC, 1130 PA, 1131 DP — read by OCR.
  // Read on 3 October 2026, files since 1 September: 75 filing rows over five
  // lists (repeats included) and 9 orders, every one with its site.
  { key: 'digilor-ergue-gaberic', insee: '29051', postcode: '29500', label: 'Ville d’Ergué-Gabéric — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/68',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 68, ocr: true, shelves: [
      { category: 764, sub: 0, title: '\\bA[OD]S\\b', board: 'filings', layout: 'digilor-ergue-list' },
      { category: 764, sub: 1128, board: 'decisions', layout: 'digilor-amneville-notice' },
      { category: 764, sub: 1130, board: 'decisions', layout: 'digilor-amneville-notice' },
      { category: 764, sub: 1131, board: 'decisions', layout: 'digilor-amneville-notice' },
    ] }, lists: [] },
  // Le Pont-de-Claix (app 25 — listed as Claix in the platform scan, but its
  // lists are headed « COMMUNE DE LE PONT DE CLAIX » and number every dossier
  // 38317) posts two lists every week or two on « HABITAT - URBANISME -
  // PLANIFICATION » / 269: « Dépôt des dossiers d'autorisations d'urbanisme »,
  // every dossier filed and still under instruction, in Arles's columns, and
  // « Décisions des dossiers … », one or two rows each. Read on 3 October
  // 2026, lists since 1 September: 48 filing rows (repeats included), all
  // with their site, and 7 decision rows, 4 with one — the list leaves the
  // others' site blank. Claix itself (38111) has no app found.
  { key: 'digilor-le-pont-de-claix', insee: '38317', postcode: '38800', label: 'Ville du Pont-de-Claix — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/25',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 25, shelves: [
      { category: 191, sub: 269, title: '^DEPOTS? ', board: 'filings', layout: 'arles-filings' },
      { category: 191, sub: 269, title: '^DECISIONS ', board: 'decisions', layout: 'digilor-pontdeclaix-decisions' },
    ] }, lists: [] },
  // Champagne-au-Mont-d'Or (app 217) posts Cart@DS's weekly « Liste des avis
  // de dépôt » on « URBANISME » with no sub-category (« Depot de dossier »),
  // every dossier under instruction, which `cartds-report-filings` reads; and
  // its orders scanned, one per dossier, on 2293 (PC) and 2294 (DP), named by
  // short number and applicant (« DP 26-62 (…) »), read by OCR. Read on 3
  // October 2026, files since 1 September: 63 filing rows over four lists
  // (repeats included, back to a PC of 2006 still open) and 5 orders of 9,
  // every row with its site.
  { key: 'digilor-champagne-au-mont-d-or', insee: '69040', postcode: '69410', label: 'Ville de Champagne-au-Mont-d’Or — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/217',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 217, ocr: true, shelves: [
      { category: 1975, sub: 0, title: 'DEPOT', board: 'filings', layout: 'cartds-report-filings' },
      { category: 1975, sub: 2293, board: 'decisions', layout: 'digilor-amneville-notice' },
      { category: 1975, sub: 2294, board: 'decisions', layout: 'digilor-amneville-notice' },
    ] }, lists: [] },
  // Saint-Didier-au-Mont-d'Or (app 103) posts one PDF per act on « URBANISME
  // », a sub-category per family (1403 PC, 1404 DP, 1405 PA), named by short
  // number and applicant: « AvisDeDepot-PC 26-36 … », « DP_26_132_…
  // _Avis_De_Dépôt », « PC 26-18 … decision » (and once « decicion »). The
  // avis carry text (« Dossier n° DP 069 194 26 00132 déposé le … », «
  // Adresse : 12 Rocade … à Saint-Didier-au-Mont-d'Or »); the orders and
  // certificates of non-opposition are scans, read by OCR. Read on 3 October
  // 2026, files since 1 September: 22 filings and 20 decisions, every one with
  // its site.
  { key: 'digilor-saint-didier-au-mont-d-or', insee: '69194', postcode: '69370', label: 'Ville de Saint-Didier-au-Mont-d’Or — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/103',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 103, ocr: true, shelves: [1403, 1404, 1405].flatMap((sub) => [
      { category: 989, sub, title: 'AVIS ?DE ?DEPOT', board: 'filings', layout: 'digilor-amneville-notice' },
      { category: 989, sub, title: 'DECI[SC]ION', board: 'decisions', layout: 'digilor-amneville-notice' },
    ]) }, lists: [] },
  // Verdun-sur-Garonne (app 83) posts on « URBANISME » a « Certificat
  // d'affichage » per dossier filed (2116, text: « Numéro d'enregistrement »,
  // « Adresse du projet : 777 Avenue … Superficie : 491 m² ») and its orders
  // scanned (2117, « Arrêté PC0821902600003 »), read by OCR; sub-category 0
  // holds the prefect's water restrictions. Read on 3 October 2026, files
  // since 1 September: 13 filings and 3 orders, every one with its site.
  { key: 'digilor-verdun-sur-garonne', insee: '82190', postcode: '82600', label: 'Ville de Verdun-sur-Garonne — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/83',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 83, ocr: true, shelves: [
      { category: 1731, sub: 2116, board: 'filings', layout: 'digilor-amneville-notice' },
      { category: 1731, sub: 2117, board: 'decisions', layout: 'digilor-amneville-notice' },
    ] }, lists: [] },
  // Locminé (app 53) posts on « Urbanisme » an avis de dépôt per dossier,
  // text (983 DP, 982 PC, 1496 PA: « Numéro Dossier DP 56117 26 00076 », «
  // Terrain 7 RUE … »), and its orders scanned (1040 DP, 1039 PC: «
  // DP2026-063_ACCORD », « … ARRETE DECISION »), read by OCR. Nothing has
  // been posted there since 31 August 2026; the files of August give 12
  // filings and 9 orders, every one with its site.
  { key: 'digilor-locmine', insee: '56117', postcode: '56500', label: 'Ville de Locminé — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/53',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 53, ocr: true, shelves: [
      ...[983, 982, 1496].map((sub) => ({ category: 704, sub, board: 'filings', layout: 'digilor-amneville-notice' })),
      ...[1040, 1039].map((sub) => ({ category: 704, sub, board: 'decisions', layout: 'digilor-amneville-notice' })),
    ] }, lists: [] },
  // Annœullin (app 166) scans every act and names it by kind, full number,
  // applicant and street (« recepissé DP 0590112600076 [applicant] 17 rue … »,
  // « arrêté DP 059 011 26 0 0069 [applicant] 710 RUE … », « arrêté refus PC
  // … »), on « URBANISME », 8179 the DP and 8178 the PC — read from the
  // title (`digilor-annoeullin-title`). 8180 holds certificates of urbanism,
  // 8185 ERP works. Read on 3 October 2026, files since 1 September: 11
  // filings and 15 decisions (3 refusals by their title), each with its
  // street.
  { key: 'digilor-annoeullin', insee: '59011', postcode: '59112', label: 'Ville d’Annœullin — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/166',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 166, shelves: [
      { category: 4988, sub: 8179, board: 'auto', layout: 'digilor-annoeullin-title' },
      { category: 4988, sub: 8178, board: 'auto', layout: 'digilor-annoeullin-title' },
    ] }, lists: [] },
  // Avranches (app 75) posts every act scanned on « Urbanisme » with no
  // sub-category, named by kind, number, applicant, street and works
  // (« Avis de dépot DP050025260154 [applicant] 5 Rue … Pose de panneaux
  // solaires », « Arrêté DP 500252600135 [applicant]- 7 résidence …-
  // Aménagement grenier 26.09.121 ») beside the ERP operating permits: read
  // from the title. Read on 3 October 2026, files since 1 September: 18
  // filings and 19 decisions, each with its street; the files left are the
  // ERP permits.
  { key: 'digilor-avranches', insee: '50025', postcode: '50300', label: 'Ville d’Avranches — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/75',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 75, shelves: [
      { category: 773, sub: 0, board: 'auto', layout: 'digilor-annoeullin-title' },
    ] }, lists: [] },
  // Urrugne (app 210) posts every act scanned on « Urbanisme », named by kind,
  // family and applicant (« avis de dépôt PC … », « arrêté DP … », « arrêté
  // opposition DP … »), one sub-category per family: 1999 PC, 2999 PC
  // modifications, 2994 DP, 2998 PA, 3000 PA modifications, 4738 transfers.
  // Read by OCR: the avis print « Numéro de dossier » and « Adresse du terrain
  // », the orders « Sur un terrain sis » and the first article.
  { key: 'digilor-urrugne', insee: '64545', postcode: '64122', label: 'Ville d’Urrugne — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/210',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 210, ocr: true,
      shelves: [1999, 2999, 2994, 2998, 3000, 4738].map((sub) => ({ category: 1778, sub, board: 'auto', layout: 'digilor-amneville-notice' })) }, lists: [] },
  // Vieux-Condé (app 215) posts every act scanned on « Service Urbanisme »,
  // named by works and street (« Construction d'une piscine - 129 rue … »):
  // 8508 the avis de dépôt, 8509 the decisions. Read by OCR.
  { key: 'digilor-vieux-conde', insee: '59616', postcode: '59690', label: 'Ville de Vieux-Condé — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/215',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 215, ocr: true, shelves: [
      { category: 1914, sub: 8508, board: 'filings', layout: 'digilor-amneville-notice' },
      { category: 1914, sub: 8509, board: 'decisions', layout: 'digilor-amneville-notice' },
    ] }, lists: [] },
  // Feurs (app 88) posts its orders scanned on « URBANISME », named by the
  // applicant alone, a sub-category per family: 1421 DP, 1420 PC, 2275 PD
  // (8031 signs, 1423 ERP works). The text the platform extracted from the
  // orders of late 2025 shows the same frame on every one (« Dossier numéro :
  // DP04209425A0088 », « Adresse des travaux ») and no notice of filing.
  { key: 'digilor-feurs', insee: '42094', postcode: '42110', label: 'Ville de Feurs — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/88',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 88, ocr: true,
      shelves: [1421, 1420, 2275].map((sub) => ({ category: 1009, sub, board: 'decisions', layout: 'digilor-amneville-notice' })) }, lists: [] },
  // Châteaulin (app 20) posts every act scanned on « Urbanisme », named by
  // its street alone (« rue de Clonakilty »): 143 the avis de dépôt, 122 the
  // DP orders, 125 the PC orders, 1411 the demolition orders (469 ERP works,
  // 2130 certificates of urbanism), as the text the platform extracted from
  // those of late 2025 shows. Read by OCR.
  { key: 'digilor-chateaulin', insee: '29026', postcode: '29150', label: 'Ville de Châteaulin — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/20',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 20, ocr: true, shelves: [
      { category: 97, sub: 143, board: 'filings', layout: 'digilor-amneville-notice' },
      ...[122, 125, 1411].map((sub) => ({ category: 97, sub, board: 'decisions', layout: 'digilor-amneville-notice' })),
    ] }, lists: [] },
  // Canohès (app 101) posts its orders scanned on « URBANISME », named by
  // number (« DP 660382600068 », « PC6603825000046Mo1 »): 2405 PC, 2406 DP,
  // 4343 PA. The frame splits its site label over two lines (« Sur un » / «
  // terrain sis à 2 Impasse … »). Read by OCR. Its lists of filings (9177)
  // stopped in January 2026.
  { key: 'digilor-canohes', insee: '66038', postcode: '66680', label: 'Ville de Canohès — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/101',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 101, ocr: true,
      shelves: [2405, 2406, 4343].map((sub) => ({ category: 2028, sub, board: 'decisions', layout: 'digilor-amneville-notice' })) }, lists: [] },
  // Boé (app 109) posts every act scanned on « URBANISME », named by applicant
  // and number (« … DP 0470312600042 »): 1964 the avis de dépôt, 1965 the DP
  // orders, 1936 the PC orders and letters (1966 certificates of urbanism).
  // Read by OCR.
  { key: 'digilor-boe', insee: '47031', postcode: '47550', label: 'Ville de Boé — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/109',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 109, ocr: true, shelves: [
      { category: 1722, sub: 1964, board: 'filings', layout: 'digilor-amneville-notice' },
      { category: 1722, sub: 1965, board: 'decisions', layout: 'digilor-amneville-notice' },
      { category: 1722, sub: 1936, board: 'decisions', layout: 'digilor-amneville-notice' },
    ] }, lists: [] },
];
// i18n-ignore-end
