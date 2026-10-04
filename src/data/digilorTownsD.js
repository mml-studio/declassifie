/**
 * Digilor Datahall towns, batch D: data only (see `digilorTowns.js`).
 * Each entry is a `PERMIT_LISTS` city whose `source.kind` is `digilor`.
 */
// i18n-ignore-start — publishers' names and the titles of their legal boards
export const DIGILOR_TOWNS_D = [
  // Le Grand-Quevilly (app 134) posts its orders scanned on « Urbanisme », a
  // sub-category per family (1891 DP, 1946 PC, 1948 PD, 1950 PA), named by
  // short number only (« DP 26 G 0085 », « PC 23 G 0052 M01 »), in batches a
  // few times a year — 107 files in July 2026, 8 on 4 August, none since.
  // No avis de dépôt is posted; 1947 (works in public buildings) and 1949
  // (signs) are no permits. No text layer: the sweep's OCR reads them
  // (`digilor-grandquevilly-order`).
  { key: 'digilor-le-grand-quevilly', insee: '76322', postcode: '76120', label: 'Ville du Grand-Quevilly — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/134',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 134, ocr: true, shelves: [1891, 1946, 1948, 1950].map((sub) => (
      { category: 1700, sub, board: 'decisions', layout: 'digilor-grandquevilly-order' })) }, lists: [] },
  // Le Plessis-Trévise (app 315) posts on « Urbanisme » one file per act,
  // titled by its site only (« 12 allée des Tilleuls », invented here) with
  // the dossier's number in the record's `numero` (`DP0940592600012`,
  // invented too), which `numbered`
  // puts before the title: 6259 the State's receipts of a permit filed (text,
  // no site in the PDF), 6221 the DP orders and 6144 the PC orders, scans the
  // sweep's OCR reads (`digilor-plessis-order`). 6196 (changes of use) and
  // 6469 (road alignments) are no permits. Sweep on 3 October 2026: 31
  // decisions and 4 filings posted since 7 July, every one with its site.
  { key: 'digilor-le-plessis-trevise', insee: '94059', postcode: '94420', label: 'Ville du Plessis-Trévise — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/315',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 315, ocr: true, shelves: [
      { category: 3957, sub: 6259, board: 'filings', layout: 'digilor-plessis-receipt', numbered: true },
      { category: 3957, sub: 6221, board: 'decisions', layout: 'digilor-plessis-order', numbered: true },
      { category: 3957, sub: 6144, board: 'decisions', layout: 'digilor-plessis-order', numbered: true },
    ] }, lists: [] },
  // Lattes (app 317) posts its orders scanned on « Urbanisme » (2692), named by
  // number (« arr20261720_non_opposition_DP_341292600186 », « ARR PC3412926-0031
  // »), beside other orders (signs, ERP works « AT », shops' opening, fines),
  // most on no sub-category and some on 3478: the title's number picks them.
  // The weekly filing lists (« SEMAINE 38 DEPOTS DP - AT ») are tables scanned
  // sideways, which the sweep's OCR does not turn. No text layer: the sweep's
  // OCR reads the orders (`digilor-lattes-order`). Read here rather than from
  // Montpellier Méditerranée Métropole's yearly file, which `mmmPermitsFeed.js`
  // no longer lists for Lattes.
  { key: 'digilor-lattes', insee: '34129', postcode: '34970', label: 'Ville de Lattes — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/317',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 317, ocr: true, shelves: [
      { category: 2692, title: '\\b(?:PC|DP|PA|PD) ?0?34129', board: 'decisions', layout: 'digilor-lattes-order' },
    ] }, lists: [] },
  // Xertigny (app 530) posts its orders scanned on « URBANISME » (5465), one
  // per dossier named by number (« DP 0885302600039 »): 9117 the DP, 9115 the
  // PC, 9114 the certificates (CU, no permit) and the odd DP. The State's
  // frame (« Déposée le 28/09/2026 N° DP 088 530 2600039 », « Sur un terrain
  // sis : », « Article 1 ») is what `digilor-amneville-notice` reads, by the
  // sweep's OCR.
  { key: 'digilor-xertigny', insee: '88530', postcode: '88220', label: 'Commune de Xertigny — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/530',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 530, ocr: true, shelves: [
      { category: 5465, sub: 9117, board: 'decisions', layout: 'digilor-amneville-notice' },
      { category: 5465, sub: 9115, board: 'decisions', layout: 'digilor-amneville-notice' },
      { category: 5465, sub: 9114, title: '^(?:PC|DP|PA|PD)\\b', board: 'decisions', layout: 'digilor-amneville-notice' },
    ] }, lists: [] },
  // Basse-Ham (app 582) posts its avis de dépôt on « Urbanisme » (6472 /
  // 11555) since 29 September 2026: one text notice per dossier, titled by its
  // site (« 6 rue Ampère »), printing « Numéro de dossier : DP 57 287 2600073 »,
  // « Date de dépôt de la demande », « Adresse des travaux » — the labels
  // `extended-notice` reads. Certificates of urbanism (CU) share the shelf.
  { key: 'digilor-basse-ham', insee: '57287', postcode: '57970', label: 'Commune de Basse-Ham — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/582',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 582, shelves: [
      { category: 6472, sub: 11555, board: 'filings', layout: 'extended-notice' },
    ] }, lists: [] },
  // Châtel-Saint-Germain (app 295) posts its avis de dépôt and orders scanned
  // on « Urbanisme » (3289), a sub-category per family (4782 DP, 4776 PC,
  // 4783 PA, 4785 PD), named by number and kind (« DP 057 134 26 00037 AVIS DE
  // DEPOT », « … ARRETE », older « RECEPISSE … »): 22 filings and 26 orders
  // since 3 July 2026, read by the sweep's OCR (`digilor-chatel-act`). The
  // Eurométropole de Metz's Cart@DS board lists none of its dossiers.
  { key: 'digilor-chatel-saint-germain', insee: '57134', postcode: '57160', label: 'Commune de Châtel-Saint-Germain — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/295',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 295, ocr: true,
      shelves: [4782, 4776, 4783, 4785].map((sub) => ({ category: 3289, sub, board: 'auto', layout: 'digilor-chatel-act' })) }, lists: [] },
  // Jarville-la-Malgrange (app 333) posts on « URBANISME » (2956) a scanned
  // letter per act, titled by kind and number then the applicant, whose name
  // is never read (« Avis de dépôt DP 054 274 26 00085 - … », « Arrêté DP 054
  // 274 26 00075 - … »): 4002 the avis de dépôt (DP, PC, PD), 4004 the
  // orders and rejections of the DP, 4000 the PC orders, 4001 the PD. The
  // notices print « N° Enregistrement », « Adresse exacte du terrain » and
  // « Destination »; the orders are the State's frame. Titles of the same
  // shelf also hold rejections without a frame, a plan, an EN: they give no
  // row. No text layer: the sweep's OCR reads them (`digilor-jarville-act`).
  { key: 'digilor-jarville-la-malgrange', insee: '54274', postcode: '54140', label: 'Ville de Jarville-la-Malgrange — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/333',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 333, ocr: true, shelves: [
      { category: 2956, sub: 4002, board: 'auto', fallback: 'filings', layout: 'digilor-jarville-act' },
      { category: 2956, sub: 4004, board: 'auto', fallback: 'decisions', layout: 'digilor-jarville-act' },
      { category: 2956, sub: 4000, board: 'auto', fallback: 'decisions', layout: 'digilor-jarville-act' },
      { category: 2956, sub: 4001, board: 'auto', fallback: 'decisions', layout: 'digilor-jarville-act' },
    ] }, lists: [] },
  // Souffelweyersheim (app 316) posts every Friday on « Urbanisme /
  // Autorisations, avis etc. » (2676 / 3567) its lists of filings and of
  // decisions, « AFFICHAGE DEPOTS COM021026 » and « AFFICHAGE DECISIONS
  // COM021026 »: the spreadsheet of the instructing service V that
  // Illkirch-Graffenstaden posts (numbers ending `26 V0090`), each list
  // repeating the weeks before. Text PDFs (`digilor-alsace-list`). Sweep on 3
  // October 2026: 16 filings in the list of 2 October, 31 decisions in its
  // list of decisions, every one with its site.
  { key: 'digilor-souffelweyersheim', insee: '67471', postcode: '67460', label: 'Ville de Souffelweyersheim — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/316',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 316, shelves: [
      { category: 2676, sub: 3567, board: 'auto', layout: 'digilor-alsace-list' },
    ] }, lists: [] },
  // La Wantzenau (app 589) posts every week on « URBANISME » (6478) its list
  // of decisions (sub 11535, `DECISIONS 01-10-2026`) and of filings (11536,
  // `DEPOT  01-10-2026`): the Alsace spreadsheet of the instructing service V
  // (`digilor-alsace-list`), the board begun on 1 September 2026, its lists
  // carrying the weeks before. Sub-category decides the board, whatever the
  // title's typing.
  { key: 'digilor-la-wantzenau', insee: '67519', postcode: '67610', label: 'Commune de La Wantzenau — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/589',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 589, shelves: [
      { category: 6478, sub: 11536, board: 'filings', layout: 'digilor-alsace-list' },
      { category: 6478, sub: 11535, board: 'decisions', layout: 'digilor-alsace-list' },
    ] }, lists: [] },
  // Oberhausbergen (app 477) posts on « Urbanisme » (4622) every Thursday or
  // so its list of decisions (sub 7405, `2026-10-01_Affichage Décisions`) and
  // of filings (7431, `2026-10-01_Affichage Dépôts`): the Alsace spreadsheet
  // of the instructing service V (`digilor-alsace-list`), each list carrying
  // the weeks before.
  { key: 'digilor-oberhausbergen', insee: '67343', postcode: '67205', label: 'Ville d’Oberhausbergen — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/477',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 477, shelves: [
      { category: 4622, sub: 7431, board: 'filings', layout: 'digilor-alsace-list' },
      { category: 4622, sub: 7405, board: 'decisions', layout: 'digilor-alsace-list' },
    ] }, lists: [] },
  // Reichstett (app 455) posts every week on « Urbanisme » (4326, no
  // sub-category) `AFFICHAGE DES DEPOTS AU 28/09/2026` and `AFFICHAGE DES
  // DECISIONS AU 28/09/2026`: the Alsace spreadsheet of the instructing
  // service V (`digilor-alsace-list`), with a « Réf. Mairie » column after the
  // others, each list carrying the weeks before. The title decides the board.
  { key: 'digilor-reichstett', insee: '67389', postcode: '67116', label: 'Ville de Reichstett — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/455',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 455, shelves: [
      { category: 4326, sub: 0, title: '^AFFICHAGE DES (?:DEPOTS|DECISIONS)\\b', board: 'auto', layout: 'digilor-alsace-list' },
    ] }, lists: [] },
  // Nilvange (app 259) posts every Monday or Tuesday on « Urbanisme » (2701 /
  // 3503) one « Tableau 21092026 au 27092026 »: two pages of a table, the
  // week's demands then its decisions (`digilor-nilvange-list`), most weeks
  // filled with `-/-`. The file's rows carry their board, so the shelf's is
  // only the default.
  { key: 'digilor-nilvange', insee: '57508', postcode: '57240', label: 'Ville de Nilvange — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/259',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 259, shelves: [
      { category: 2701, sub: 3503, title: '^TABLEAU\\b', board: 'filings', layout: 'digilor-nilvange-list' },
    ] }, lists: [] },
  // Créhange (app 320) posts on « URBANISME » (2843) its year's register
  // « DEMANDES D'URBANISME », on a sub-category or none, again every few
  // weeks since the year began (10 editions since 1 July, the last on 3
  // September): a text spreadsheet of the dossiers with their site, works,
  // filing day and decision (`digilor-crehange-register`). Its orders are
  // scans named by number and applicant (`Arrêté favorable DP 0571592600048
  // …`), left to the register that lists them all. Rows carry their board.
  { key: 'digilor-crehange', insee: '57159', postcode: '57690', label: 'Commune de Créhange — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/320',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 320, shelves: [
      { category: 2843, title: '^DEMANDES D.URBANISME', board: 'filings', layout: 'digilor-crehange-register' },
    ] }, lists: [] },
  // Longeville-lès-Saint-Avold (app 399) posts on « URBANISME » (3601, subs 0
  // and 5466) a scanned act per dossier, titled by kind and number with the
  // applicant's name between, never read: `ADDP <name> 26 00038 du
  // 02.10.2026` the avis de dépôt (AD + DP, PC, PA), `DP <name> 26 00034 -
  // Arrêté n° 220/26 du 29.09.2026` the orders. The ERP works (`AT …`, `ERP
  // …`) beside them are no permits. No text layer: the sweep's OCR reads them
  // (`digilor-longeville-act`).
  { key: 'digilor-longeville-les-saint-avold', insee: '57413', postcode: '57740', label: 'Ville de Longeville-lès-Saint-Avold — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/399',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 399, ocr: true, shelves: [
      { category: 3601, title: '^AD(?:DP|PC|PA|PD)\\b', board: 'filings', layout: 'digilor-longeville-act' },
      { category: 3601, title: '^(?:DP|PC|PA|PD)\\b', board: 'decisions', layout: 'digilor-longeville-act' },
    ] }, lists: [] },
  // Richardménil (app 227) posts every week or two on « Urbanisme » (2344) the
  // Cart@DS reports of its instructing service, text PDFs by kind: « Liste des
  // avis de dépôt - 30_09_2026 » (sub 2868) and « Liste des décisions -
  // 30_09_2026 » (2869), each a table of the dossiers on display with their
  // site, parcels, works and days — the reports `cartds-report-filings` and
  // `cartds-report-decisions` read as they are. Configuration only.
  { key: 'digilor-richardmenil', insee: '54459', postcode: '54630', label: 'Commune de Richardménil — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/227',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 227, shelves: [
      { category: 2344, sub: 2868, board: 'filings', layout: 'cartds-report-filings' },
      { category: 2344, sub: 2869, board: 'decisions', layout: 'cartds-report-decisions' },
    ] }, lists: [] },
  // Morhange (app 123) posts on « Urbanisme / Documents relatifs à l'urbanisme »
  // (2233) a scan per act, titled by year, kind, short number and applicant:
  // `2026 - DP 029 - … - DECISION`, `… - Décision et avis` the orders (2716 the
  // DP, 2714 the PC, 9608 the certificates), `… - Récépissé de dépôt` and `… -
  // AVIS DE DEPOT` the State's blank receipt filled in by hand — no site in
  // print, left out — and `… - Maj délais` letters. The orders print their
  // number, site and works in a block (`digilor-morhange-order`, by the
  // sweep's OCR): 5 permits since 3 July 2026, the last on 16 September. No
  // avis de dépôt is readable.
  { key: 'digilor-morhange', insee: '57483', postcode: '57340', label: 'Ville de Morhange — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/123',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 123, ocr: true, shelves: [
      { category: 2233, title: '\\bDECISION\\b', board: 'decisions', layout: 'digilor-morhange-order' },
    ] }, lists: [] },
  // Puttelange-aux-Lacs (app 409) posts on « Urbanisme » (4281) a scan per
  // dossier titled by number alone: `décision DP0575562600043` the orders
  // (sub 6730, sub 6732 the certificates' left out), `Récépissé DP0575562600046`
  // the State's receipt (6804: the number and applicant, no site, not read).
  // An order prints « Commune de Puttelange-aux-Lacs / DECISION DE NON
  // OPPOSITION », the filing day, the number, the site and the parcels in a
  // frame: read the Amnéville scan way by the sweep's OCR.
  { key: 'digilor-puttelange-aux-lacs', insee: '57556', postcode: '57510', label: 'Commune de Puttelange-aux-Lacs — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/409',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 409, ocr: true, shelves: [
      { category: 4281, sub: 6730, board: 'decisions', layout: 'digilor-amneville-notice' },
    ] }, lists: [] },
  // Ennery (app 32) posts on its first shelf (280) one scan per act, titled
  // by kind, short number and applicant's surname: `DEPOT DP 42 <name>` (sub
  // 388 DP, 387 PC) the State's receipt — page 2 types the number, day and
  // applicant, no site —, `ARRETE DP 32 <name>` the orders (544 DP, 382 PC),
  // scans of the commune's frame: « DP 057 193 2600032 », « Avis de dépôt
  // affiché le 17/08/2026 », « Arrêté affiché le 30/09/2026 », « Sur un
  // terrain sis : », « Parcelle(s) » (read the Amnéville scan way by the
  // sweep's OCR). The certificates (5617) and the AT (1368) are no permits.
  { key: 'digilor-ennery', insee: '57193', postcode: '57365', label: 'Commune d’Ennery — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/32',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 32, ocr: true, shelves: [
      { category: 280, sub: 544, board: 'decisions', layout: 'digilor-ennery-order' },
      { category: 280, sub: 382, board: 'decisions', layout: 'digilor-ennery-order' },
    ] }, lists: [] },
  // Le Plessis-Bouchard (app 366) posts on « URBANISME » (3120) a scanned list
  // of filings, `dépôts ADS` (« Dossiers déposés avant le 2 octobre 2026 »),
  // and one of decisions, `Autorisations ADS` (« Dossiers décidés jusqu'au 2
  // octobre 2026 »), every week or so, each repeating every dossier still on
  // display; the sub-categories (4483, 4484) are not kept to, so the title
  // decides the board (`digilor-plessisb-list`, by the sweep's OCR). Signs
  // (`AP`) and ERP works (`AT`) share the lists and are no permits.
  { key: 'digilor-le-plessis-bouchard', insee: '95491', postcode: '95130', label: 'Ville du Plessis-Bouchard — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/366',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 366, ocr: true, shelves: [
      { category: 3120, title: '^DEPOTS? ADS$', board: 'filings', layout: 'digilor-plessisb-list' },
      { category: 3120, title: '^AUTORISATIONS? ADS$', board: 'decisions', layout: 'digilor-plessisb-list' },
    ] }, lists: [] },
  // Saulcy-sur-Meurthe (app 400) posts on « URBANISME » (3917) a scan per act,
  // titled by the applicant's name: the orders (6078 the DP, 6076 the PC, 6184
  // the PC modifications) are the State's frame (« DOSSIER N° DP 88445 26
  // H0035 », « Sur un terrain sis à », « Cadastré »), read by `digilor-frame-act`;
  // the receipts (6082 the DP, 6087 the PC) type the number, the filing day
  // and the site in their « cadre réservé à la mairie »
  // (`digilor-saulcy-receipt`). Every file by the sweep's OCR.
  { key: 'digilor-saulcy-sur-meurthe', insee: '88445', postcode: '88580', label: 'Commune de Saulcy-sur-Meurthe — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/400',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 400, ocr: true, shelves: [
      ...[6082, 6087].map((sub) => ({ category: 3917, sub, board: 'filings', layout: 'digilor-saulcy-receipt' })),
      ...[6078, 6076, 6184].map((sub) => ({ category: 3917, sub, board: 'decisions', layout: 'digilor-frame-act' })),
    ] }, lists: [] },
  // Arches (app 453) posts on « URBANISME » (4565) a scan per act, titled by
  // kind and number typed by hand (« Arrêté DP 088 011 2600026 », sometimes
  // wrong: the act prints the right one): the orders on 7287 (PC), 7288 (DP)
  // and, for the demolitions, on no sub-category, among the municipal orders
  // (« 2026-52 TRB rue de Hadol RD4 ») picked by their title; each is the
  // State's frame « Sur un terrain sis : » / « Parcelle(s) », read by
  // `digilor-frame-act` through the sweep's OCR. The receipts (7290) are the
  // State's blank form with the number and the applicant, no site, and the
  // certificates (7289) are no permits: both left out.
  { key: 'digilor-arches', insee: '88011', postcode: '88380', label: 'Commune d’Arches — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/453',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 453, ocr: true, shelves: [
      ...[7287, 7288].map((sub) => ({ category: 4565, sub, board: 'decisions', layout: 'digilor-frame-act' })),
      { category: 4565, sub: 0, title: '^ARRETE (?:PD|PC|DP|PA)\\b', board: 'decisions', layout: 'digilor-frame-act' },
    ] }, lists: [] },
  // Ammerschwihr (app 496) posts on « URBANISME » (4835) one scan per act,
  // titled by the number and the applicant's name (`DP0680052600036_<name>`;
  // the name is never read): the orders on 7900 (`arr_fav_85_2026_…`, the
  // DP, PD and PC), scans of the State's frame — « Sur un terrain sis », the
  // parcels left blank — that `digilor-frame-act` reads through the sweep's
  // OCR, the counter after the commune's code as the title types it. The
  // receipts on 7899 (`recepisse.pdf`) are Berger-Levrault carbon forms
  // filled in by hand, which OCR cannot read, and carry no site in their
  // title: left out. 7938 (festival orders) and 4864 hold no permits.
  { key: 'digilor-ammerschwihr', insee: '68005', postcode: '68770', label: 'Commune d’Ammerschwihr — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/496',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 496, ocr: true, shelves: [
      { category: 4835, sub: 7900, board: 'decisions', layout: 'digilor-frame-act' },
    ] }, lists: [] },
  // Vigy (app 557) posts on « URBANISME » (5790) one scan per act, titled by
  // the number and the applicant's name (`DP0577162600036_<name>`, never
  // read): the orders on 9929 (PC) and 9930 (DP), « _signe », « _opp » or
  // « _opposition », are the commune's frame — « Déclaration déposée le … N°
  // DP 057 716 26 00028 », « Sur un terrain sis à : », « Nature des Travaux
  // » — read by `digilor-frame-act` through the sweep's OCR. No avis de dépôt
  // or récépissé is posted.
  { key: 'digilor-vigy', insee: '57716', postcode: '57640', label: 'Commune de Vigy — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/557',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 557, ocr: true, shelves: [
      ...[9929, 9930].map((sub) => ({ category: 5790, sub, board: 'decisions', layout: 'digilor-frame-act' })),
    ] }, lists: [] },
  // Angevillers (app 332) posts on « Urbanisme » (3438) one scan per act, titled
  // by its kind and counter alone (« Décision Déclaration Préalable n°
  // 2600024 », the kind and number in the record's `numero`, `DP 2600024`,
  // which `numbered` puts before the title): the decisions on 5034, the
  // commune's frame (« REFUS DE DÉCLARATION PRÉALABLE … DÉLIVRÉ PAR LE MAIRE »,
  // « Sur un terrain sis à : », « Références cadastrales »), read by
  // `digilor-frame-act` through the sweep's OCR; the certificates beside them
  // (« Certificat d'Urbanisme ») are no permits and left out by title. The
  // receipts on 5033 (« Récépissé de Dépôt … ») are the State's form with the
  // number and the applicant, no site: left out.
  { key: 'digilor-angevillers', insee: '57022', postcode: '57440', label: 'Commune d’Angevillers — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/332',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 332, ocr: true, shelves: [
      { category: 3438, sub: 5034, title: '^(?!.*CERTIFICAT)', board: 'decisions', layout: 'digilor-frame-act', numbered: true },
    ] }, lists: [] },
  // Argancy (app 438, with its villages Olgy and Rugy) posts on « URBANISME »
  // (4159) a scan per act, titled by the site for the receipts (6514: « 36 rue
  // de Bussière à Argancy ») and by the applicant's name for the orders (6515,
  // never read). A receipt is the State's form whose cadre types the number,
  // the filing day and the works, the site being its title's
  // (`digilor-argancy-receipt`); an order is the commune's frame — « DP 057
  // 028 2600049 », « Avis de dépôt affiché le … », « Arrêté affiché le … »,
  // « Sur un terrain sis : », « Parcelle(s) » — read by `digilor-frame-act`.
  // 6530 (completion declarations) and 6531 (starts of works) are no permits.
  { key: 'digilor-argancy', insee: '57028', postcode: '57640', label: 'Commune d’Argancy — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/438',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 438, ocr: true, shelves: [
      { category: 4159, sub: 6514, board: 'filings', layout: 'digilor-argancy-receipt' },
      { category: 4159, sub: 6515, board: 'decisions', layout: 'digilor-frame-act' },
    ] }, lists: [] },
  // Kuntzig (app 525) posts on « Urbanisme » (5228) a scan per act, two for
  // each dossier: « DP2600033 <name> DEPOT » the avis de dépôt, « DP2600033
  // <name> DECISION » the order, the applicant's name between the number and
  // the word (never read), sometimes only the number and the name. The DP are
  // on 8618, the PC on 8616 (the certificates on 8649 are no permits); the
  // avis (« AVIS DE DÉPÔT DE LA DEMANDE DE … ») and the orders (« DÉLIVRÉE PAR
  // LE MAIRE AU NOM DE LA COMMUNE », « Sur un terrain sis à : », « Références
  // cadastrales ») are read by `digilor-frame-act` through the sweep's OCR,
  // which names the board itself when the title does not. A pylon's order
  // names no street, only a parcel numbered by section: no row.
  { key: 'digilor-kuntzig', insee: '57372', postcode: '57970', label: 'Commune de Kuntzig — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/525',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 525, ocr: true, shelves: [8618, 8616].map((sub) => (
      { category: 5228, sub, board: 'auto', fallback: 'decisions', layout: 'digilor-frame-act' })) }, lists: [] },
  // Bussang (app 267) posts on « Urbanisme » (2293) a scan per act, titled by
  // kind, short number and the applicant's name (« DP 39 2026 <name> … modif
  // ouvertures », the name never read, the number `DP 39 2026` meaning counter
  // 39 of 2026): the orders on 2794 (PC) and 2795 (DP), the commune's frame
  // read by `digilor-frame-act`, and on 2797 the notices of filing, one
  // sentence under the number — « Le 7 août 2026 a été déposé en Mairie par …
  // un dossier de Déclaration Préalable concernant … au 33 Rue du 19ème BCP »
  // (`digilor-bussang-notice`), among the certificates' (`CUb`), which give no
  // row. Every file by the sweep's OCR; 2302 and 2299 hold no permits.
  { key: 'digilor-bussang', insee: '88081', postcode: '88540', label: 'Commune de Bussang — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/267',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 267, ocr: true, shelves: [
      { category: 2293, sub: 2797, board: 'filings', layout: 'digilor-bussang-notice' },
      ...[2794, 2795].map((sub) => ({ category: 2293, sub, board: 'decisions', layout: 'digilor-frame-act' })),
    ] }, lists: [] },
  // Roncourt (app 541) posts on « URBANISME » (5555) a few notices and orders
  // a month, named by number (`Avis de dépôt DP57593260030` the notice on 9410,
  // `DP57593260025_DecisionNonOpposition` the order on 9411, older ones `DECISION
  // DP 57 593 26 0023`), the deliberations of the plan beside them. The notice
  // is the State's labelled page (« Numéro de dossier », « Adresse du projet »,
  // parcels), the order the commune's frame, both read by `digilor-frame-act`
  // through the sweep's OCR.
  { key: 'digilor-roncourt', insee: '57593', postcode: '57860', label: 'Commune de Roncourt — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/541',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 541, ocr: true, shelves: [
      { category: 5555, sub: 9410, board: 'filings', layout: 'digilor-frame-act' },
      { category: 5555, sub: 9411, title: '^(?:DECISION|ARRETE|(?:DP|PC|PA|PD)\\s*\\d)', board: 'decisions', layout: 'digilor-frame-act' },
    ] }, lists: [] },
  // Pournoy-la-Grasse (app 583) posts on « Urbanisme » (6444) one file per act,
  // titled by the number and the applicant's name (« <name> - DP 057 554 26
  // 00024 », the name never read): on 11419 the application itself, the CERFA
  // form with its « Dpt Commune Année N° de dossier », on 11422 the orders
  // and the certificates' (« CU … - Décision », no permits), and the one order
  // posted on no sub-category (« PC 057 554 25 00002 M01 - … »). The
  // commune's frame (« Sur un terrain sis », « Nature des travaux ») and the
  // form's address are read by `digilor-frame-act` through the sweep's OCR;
  // a scanned form whose number OCR cannot read gives no row.
  { key: 'digilor-pournoy-la-grasse', insee: '57554', postcode: '57420', label: 'Commune de Pournoy-la-Grasse — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/583',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 583, ocr: true, shelves: [
      { category: 6444, sub: 11419, board: 'filings', layout: 'digilor-frame-act' },
      { category: 6444, sub: 11422, title: '^(?!CU\\b)', board: 'decisions', layout: 'digilor-frame-act' },
      { category: 6444, sub: 0, title: '^(?:PC|DP|PA|PD)\\s*0?57', board: 'decisions', layout: 'digilor-frame-act' },
    ] }, lists: [] },
  // Flévy (app 538) posts on « URBANISME » (5508) one scan per act, titled by
  // the kind, the number and the applicant's name (« DECISION DP 0572192600016
  // <name> … », the name never read, the kind sometimes mistyped: the act
  // prints the right number): the orders on 9295 and the one order withdrawing
  // a permit on 11614, the commune's frame (« Sur un sis terrain : », « Nature
  // des Travaux », « Article unique »), read by `digilor-frame-act` through the
  // sweep's OCR. The receipts on 9294 are the State's form with the number, the
  // filing day and the applicant, and no site or works anywhere: left out.
  { key: 'digilor-flevy', insee: '57219', postcode: '57365', label: 'Commune de Flévy — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/538',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 538, ocr: true, shelves: [9295, 11614].map((sub) => (
      { category: 5508, sub, board: 'decisions', layout: 'digilor-frame-act' })) }, lists: [] },
  // Hauconcourt (app 34) posts on « Demande préalable de travaux » (243) and
  // « Permis de construire » (242) two files for each dossier, named by kind and
  // number with the applicant's surname (never read): a notice of filing (7024
  // the DP, 7023 the PC: « AVIS DE DEPOT DP 057 303 26 00014 ») the State's
  // labelled page, and a receipt (371, 369) that names no site, left out. The
  // orders (373 the DP, among them four withdrawals of 2025's, and 370 the
  // préfet's for a photovoltaic car park) are the commune's or the State's
  // frame. All read by `digilor-frame-act` through the sweep's OCR; the
  // ERP works on 244 are no permits.
  { key: 'digilor-hauconcourt', insee: '57303', postcode: '57280', label: 'Commune de Hauconcourt — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/34',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 34, ocr: true, shelves: [
      { category: 243, sub: 7024, board: 'filings', layout: 'digilor-frame-act' },
      { category: 242, sub: 7023, board: 'filings', layout: 'digilor-frame-act' },
      { category: 243, sub: 373, board: 'decisions', layout: 'digilor-frame-act' },
      { category: 242, sub: 370, board: 'decisions', layout: 'digilor-frame-act' },
    ] }, lists: [] },
];
// i18n-ignore-end
