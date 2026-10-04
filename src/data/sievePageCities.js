/**
 * Communes found by the sieve of communes' own sites on 2026-10-03, whose
 * page links their permit postings: one PDF per act, Cart@DS lists, or tables
 * of their own. Read by the `posted-acts` and `posted-lists` protocols
 * (`permitBoardsPostedLists.js`) and by `sieve-acts` and the list readers of
 * `permitBoardsSievePages.js`. Data only, appended to `permitBoardCities.js`'s
 * list. Each posted within two months of the survey and gave a number and a
 * site for most rows, read live (by OCR for the scans, as the sweep does).
 */
// i18n-ignore-start — publishers' names and the titles of their legal boards
const MONTHS = 'JANVIER|FEVRIER|MARS|AVRIL|MAI|JUIN|JUILLET|AOUT|SEPTEMBRE|OCTOBRE|NOVEMBRE|DECEMBRE';

export const SIEVE_PAGE_CITIES = [
  // An Excel table of the dossiers under review, renamed by its day (`29-SEPTEMBRE-2026.pdf`).
  { key: 'chambray-les-tours', insee: '37050', postcode: '37170', label: 'Ville de Chambray-lès-Tours — dossiers d’urbanisme déposés',
    page: 'https://www.ville-chambray-les-tours.fr/mes-demarches/urbanisme/demarches-et-rendez-vous/',
    source: { protocol: 'posted-lists', lists: { filings: `/\\d{1,2} (?:${MONTHS}) 20\\d\\d\\.PDF\\b` }, layouts: { filings: 'chambray-filings' } } },
  // Scanned orders, the number dotted in the link (`ARRETE-2026.498-DP-076.057.26.00090-…`).
  { key: 'barentin', insee: '76057', postcode: '76360', label: 'Ville de Barentin — décisions d’urbanisme',
    page: 'https://ville-barentin.fr/ma-ville/vie-municipale/decisions-durbanisme', source: { protocol: 'sieve-acts' } },
  // Scanned receipts and orders, a folder each (`…/declarations-prealables/recepisses/DP 87 114 2600137.pdf`);
  // the certificates' folder, the longest, is left out.
  { key: 'panazol', insee: '87114', postcode: '87350', label: 'Ville de Panazol — récépissés et décisions d’urbanisme',
    page: 'https://www.mairie-panazol.fr/panazol-pratique/services-a-la-population/les-demarches-durbanisme/',
    source: { protocol: 'sieve-acts', skip: '/certificats-urbanisme/|/Autorisation de Construire', filings: '/recepisses/' } },
  // The year's registers of declarations and permits, renamed at each update (`2026 DP 21 09 2026.pdf`).
  { key: 'villeneuve-tolosane', insee: '31588', postcode: '31270', label: 'Ville de Villeneuve-Tolosane — registres des autorisations d’urbanisme',
    page: 'https://www.villeneuve-tolosane.fr/votre-mairie/mes-demarches/urbanisme/joomlannuaire/fiche/167:autorisation-d-urbanisme/52:urbanisme',
    source: { protocol: 'posted-lists', lists: { filings: '\\b(?:DECLARATIONS PREALABLES|PERMIS DE CONSTRUIRE) 20\\d\\d\\b' },
      layouts: { filings: 'villeneuve-tolosane-register' } } },
  { key: 'courcelles-les-lens', insee: '62249', postcode: '62970', label: 'Ville de Courcelles-lès-Lens — avis de dépôt et arrêtés d’urbanisme',
    page: 'https://www.courcelles-les-lens.fr/plan-local-d-urbanisme', source: { protocol: 'posted-acts' } },
  // Cart@DS lists of filings, one for declarations and one for permits.
  { key: 'neuville-sur-saone', insee: '69143', postcode: '69250', label: 'Ville de Neuville-sur-Saône — avis de dépôt d’urbanisme',
    page: 'https://www.mairie-neuvillesursaone.fr/mes-demarches-et-services/urbanisme/urbanisme/', source: { protocol: 'posted-lists' } },
  // Two Word tables renamed each edition (`Depots_2026_09_25.pdf`, `Decisions_2026_09_25.pdf`).
  { key: 'noisy-le-roi', insee: '78455', postcode: '78590', label: 'Ville de Noisy-le-Roi — dépôts et décisions d’urbanisme',
    page: 'https://www.noisyleroi.fr/817/mairie/urbanisme/autorisations-d-urbanisme.htm',
    source: { protocol: 'posted-lists', lists: { filings: '/DEPOTS 20\\d\\d', decisions: '/DECISIONS 20\\d\\d' },
      layouts: { filings: 'word-list-filings', decisions: 'word-list-decisions' } } },
  // The same two Word tables (`depot28.09.2026.pdf`, `decision28092026.pdf`).
  { key: 'auchel', insee: '62048', postcode: '62260', label: 'Ville d’Auchel — dossiers d’urbanisme déposés et décidés',
    page: 'https://www.auchel.fr/les-arretes-durbanisme/',
    source: { protocol: 'posted-lists', lists: { filings: '/DEPOT ?\\d', decisions: '/DECISION ?\\d' },
      layouts: { filings: 'word-list-filings', decisions: 'word-list-decisions' } } },
  // Every act of the town on one page, a link each: « AV DP 071 105 26 00124 - [name] N° … Mise en
  // ligne le jeudi 01 octobre 2026 »; some file names swap the day and the month.
  { key: 'charnay-les-macon', insee: '71105', postcode: '71850', label: 'Ville de Charnay-lès-Mâcon — avis de dépôt et arrêtés d’urbanisme',
    page: 'https://www.charnay-les-macon.fr/74/ma-mairie/publication-des-actes-administratifs.htm', source: { protocol: 'sieve-acts', dayFromWords: true, filings: '/AV_', filingLayout: 'labelled-notice' } },
  // Notices printed by the online filing service, one per dossier; Drupal links each file twice, once under `/index.php/`.
  { key: 'rives', insee: '38337', postcode: '38140', label: 'Ville de Rives — avis de dépôt et décisions tacites d’urbanisme',
    page: 'https://www.mairie-rives.fr/arretes-durbanisme',
    source: { protocol: 'sieve-acts', skip: '/index\\.php/', filings: '_avis_depot', layout: 'labelled-notice' } },
  // Every order of the town, named by its number, the dossier's, the applicant and the site, undated.
  { key: 'forges-les-eaux', insee: '76276', postcode: '76440', label: 'Ville de Forges-les-Eaux — arrêtés d’urbanisme',
    page: 'https://www.forgesleseaux.fr/941-arretes.htm', source: { protocol: 'sieve-acts' } },
  // Scanned orders, the counter split (`PC 095 257 26 0 0009`); its weekly list of filings has no text layer.
  { key: 'la-frette-sur-seine', insee: '95257', postcode: '95530', label: 'Ville de La Frette-sur-Seine — arrêtés d’urbanisme',
    page: 'https://lafrettesurseine.fr/ma-ville/vie-municipale/actes-administratifs', source: { protocol: 'sieve-acts', skip: '\\bSemaine\\b' } },
  { key: 'puilboreau', insee: '17291', postcode: '17138', label: 'Ville de Puilboreau — affichage légal d’urbanisme',
    page: 'https://www.ville-puilboreau.fr/mes-demarches/affichage-legal/',
    source: { protocol: 'posted-acts', pages: ['https://www.ville-puilboreau.fr/mes-demarches/affichage-legal/page/2/', 'https://www.ville-puilboreau.fr/mes-demarches/affichage-legal/page/3/'] } },
  // Each act has a « Consulter » link to the PDF and a « Télécharger » one through a plugin robots.txt refuses.
  { key: 'saint-hilaire-du-harcouet', insee: '50484', postcode: '50600', label: 'Ville de Saint-Hilaire-du-Harcouët — avis de dépôt et arrêtés d’urbanisme',
    page: 'https://www.st-hilaire-du-harcouet.fr/categorie-documents/urbanisme/', source: { protocol: 'sieve-acts', skip: '/telechargement\\.php' } },
  // Orders named by their signing day and number (`ARR_20261002_DP0222092600171.pdf`), every year's on one page.
  { key: 'beaussais-sur-mer', insee: '22209', postcode: '22650', label: 'Commune de Beaussais-sur-Mer — arrêtés d’urbanisme',
    page: 'https://www.beaussais-sur-mer.bzh/Urbanisme.asp', source: { protocol: 'sieve-acts', skip: '_(?:CU|AP|AT)\\d' } },
  // Two Excel tables refreshed in place, renamed by their day (`Declaration-prealables-au-2-octobre-2026.pdf`).
  { key: 'lhuisserie', insee: '53119', postcode: '53970', label: 'Commune de L’Huisserie — autorisations d’urbanisme déposées et décidées',
    page: 'https://www.lhuisserie.fr/rlpi/',
    source: { protocol: 'posted-lists', lists: { filings: '\\b(?:DECLARATIONS? PREALABLES|PERMIS DE CONSTRUIRE)\\b' }, layouts: { filings: 'lhuisserie-list' } } },
  { key: 'montigny-en-ostrevent', insee: '59414', postcode: '59182', label: 'Ville de Montigny-en-Ostrevent — arrêtés d’urbanisme',
    page: 'https://montigny-en-ostrevent.fr/arretes-municipaux-3', source: { protocol: 'posted-acts' } },
  { key: 'la-chaussee-saint-victor', insee: '41047', postcode: '41260', label: 'Ville de La Chaussée-Saint-Victor — actes d’urbanisme',
    page: 'https://www.lachausseesaintvictor.fr/ma-commune/vie-municipale/actes-administratifs/', source: { protocol: 'posted-acts' } },
  { key: 'les-martres-de-veyre', insee: '63214', postcode: '63730', label: 'Commune des Martres-de-Veyre — avis de dépôt et décisions d’urbanisme',
    page: 'https://www.mairie-lesmartresdeveyre.fr/avis_de_depot_et_decisions.html', source: { protocol: 'posted-acts' } },
];
// i18n-ignore-end
