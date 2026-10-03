/**
 * Communes that post their instruction service's printed lists on a page of
 * their own site, read by the `posted-lists` protocol
 * (`permitBoardsPostedLists.js`). Data only, appended to
 * `permitBoardCities.js`'s list. Found on 2026-10-03 by asking the
 * intercommunal ADS services of the Bas-Rhin and crawling the communes' sites
 * for « Liste des avis de dépôt »; each posted a list within the month.
 */
// i18n-ignore-start — publishers' names and the titles of their legal boards
export const POSTED_LIST_CITIES = [
  // Haguenau renames both files every week: `28 09 2026 VILLE DE HAGUENAU
  // DEPOTS.pdf` and `… AUTORISATIONS.pdf`, Cart@DS exports.
  { key: 'haguenau', insee: '67180', postcode: '67500', label: 'Ville de Haguenau — dépôts et autorisations d’urbanisme',
    page: 'https://www.haguenau.fr/fr/page/depots-et-autorisations-d-urbanisme',
    source: { protocol: 'posted-lists', lists: { filings: '\\bDEPOTS\\.PDF\\b', decisions: '\\bAUTORISATIONS\\.PDF\\b' } } },
  // Communes the ATIP 67 instructs for, posting its export of their lists.
  { key: 'saverne', insee: '67437', postcode: '67700', label: 'Ville de Saverne — avis de dépôt et décisions d’urbanisme',
    page: 'https://www.saverne.fr/avis-de-depot-et-decisions-durbanisme/', source: { protocol: 'posted-lists' } },
  { key: 'barr', insee: '67021', postcode: '67140', label: 'Ville de Barr — avis de dépôt et décisions d’urbanisme',
    page: 'https://barr.fr/actes-et-publications-legales/actes-des-domaines/', source: { protocol: 'posted-lists' } },
  // Benfeld's two links open a page each, which links the current PDF.
  { key: 'benfeld', insee: '67028', postcode: '67230', label: 'Ville de Benfeld — avis de dépôt et décisions d’urbanisme',
    page: 'https://www.benfeld.fr/documents_administratifs', source: { protocol: 'posted-lists', follow: true } },
  { key: 'offendorf', insee: '67356', postcode: '67850', label: 'Commune d’Offendorf — avis de dépôt et décisions d’urbanisme',
    page: 'https://www.offendorf.fr/FR/Mairie/Urbanisme.html', source: { protocol: 'posted-lists' } },
  // Lauterbourg titles its links by week: « Dépôts du 24 septembre 2026 ».
  { key: 'lauterbourg', insee: '67261', postcode: '67630', label: 'Ville de Lauterbourg — dépôts et décisions d’urbanisme',
    page: 'https://www.mairie-lauterbourg.fr/FR/Mes-demarches/Urbanisme/Liste-autorisations-urbanisme.html',
    source: { protocol: 'posted-lists', lists: { filings: '^DEPOTS DU\\b|\\bDEPOTS DU \\d', decisions: '^DECISIONS DU\\b|\\bDECISIONS DU \\d' } } },
  // Schiltigheim posts its own Cart@DS exports, renamed with each edition's day.
  { key: 'schiltigheim', insee: '67447', postcode: '67300', label: 'Ville de Schiltigheim — dépôts et décisions d’urbanisme',
    page: 'https://www.ville-schiltigheim.fr/demarches/urbanisme-habitat/depots-decisions/',
    source: { protocol: 'posted-lists', lists: { filings: '\\bAFFICHAGE DEPOTS\\b', decisions: '\\bAFFICHAGE DECISIONS\\b' } } },
  // One PDF per act (`posted-acts`), the number in the link or the file name.
  { key: 'saint-martin-boulogne', insee: '62758', postcode: '62280', label: 'Ville de Saint-Martin-Boulogne — affichage légal d’urbanisme',
    page: 'https://saintmartinboulogne.fr/affichage-legal/', source: { protocol: 'posted-acts', pages: ['https://saintmartinboulogne.fr/affichage-legal/page/2/'] } },
  { key: 'marquette-lez-lille', insee: '59386', postcode: '59520', label: 'Ville de Marquette-lez-Lille — arrêtés d’urbanisme',
    page: 'https://www.marquettelezlille.fr/ma-ville/annonces-legales/', source: { protocol: 'posted-acts' } },
  { key: 'bauvin', insee: '59052', postcode: '59221', label: 'Ville de Bauvin — affichage des autorisations d’urbanisme',
    page: 'https://villedebauvin.fr/vie-pratique/urbanisme/affichage/', source: { protocol: 'posted-acts' } },
  { key: 'rouvroy', insee: '62724', postcode: '62320', label: 'Ville de Rouvroy — affichage légal',
    page: 'https://ville-rouvroy62.fr/affichage-legal', source: { protocol: 'posted-acts' } },
  { key: 'coulogne', insee: '62244', postcode: '62137', label: 'Ville de Coulogne — affichage légal',
    page: 'https://ville-coulogne.fr/ma-mairie/democratie-locale/affichage-legal/', source: { protocol: 'posted-acts' } },
  { key: 'crespin', insee: '59160', postcode: '59154', label: 'Ville de Crespin — décisions d’urbanisme',
    page: 'https://www.crespin.fr/mairie/affichage-legal-numerique', source: { protocol: 'posted-acts' } },
  { key: 'dourges', insee: '62274', postcode: '62119', label: 'Ville de Dourges — arrêtés municipaux',
    page: 'https://www.dourges.fr/arretes-municipaux', source: { protocol: 'posted-acts' } },
  { key: 'roost-warendin', insee: '59509', postcode: '59286', label: 'Ville de Roost-Warendin — arrêtés et décisions du maire',
    page: 'https://www.ville-roostwarendin.fr/categorie-documents/arretes-et-decisions-du-maire/', source: { protocol: 'posted-acts' } },
  { key: 'anor', insee: '59012', postcode: '59186', label: 'Ville d’Anor — affichage urbanisme',
    page: 'https://www.anor.fr/affichage-urbanisme-Anor-7.html', source: { protocol: 'posted-acts' } },
  { key: 'montbeliard', insee: '25388', postcode: '25200', label: 'Ville de Montbéliard — arrêtés d’urbanisme',
    page: 'https://www.montbeliard.fr/ma-mairie/affichage-legal-ville/arretes-d-urbanisme/', source: { protocol: 'posted-acts', bareCounter: true } },
  { key: 'villeneuve-sur-lot', insee: '47323', postcode: '47300', label: 'Ville de Villeneuve-sur-Lot — affichage légal d’urbanisme',
    page: 'https://www.ville-villeneuve-sur-lot.fr/pagelb/affichage_doc.php?categorie=urbanisme',
    source: { protocol: 'posted-acts', linkBase: 'https://www.ville-villeneuve-sur-lot.fr/' } },
  { key: 'wasquehal', insee: '59646', postcode: '59290', label: 'Ville de Wasquehal — annonces légales d’urbanisme',
    page: 'https://www.ville-wasquehal.fr/vie-pratique/vos-demarches/annonces-legales/',
    source: { protocol: 'posted-acts', pages: ['https://www.ville-wasquehal.fr/vie-pratique/vos-demarches/annonces-legales/page/2/', 'https://www.ville-wasquehal.fr/vie-pratique/vos-demarches/annonces-legales/page/3/'] } },
  // Sites whose WordPress media API asks for a login (2026-10-03): their pages are read instead.
  { key: 'bouillargues', insee: '30047', postcode: '30230', label: 'Ville de Bouillargues — avis de dépôt et décisions d’urbanisme',
    page: 'https://bouillargues.fr/avis-de-depots/', source: { protocol: 'posted-lists' } },
  { key: 'courseulles-sur-mer', insee: '14191', postcode: '14470', label: 'Ville de Courseulles-sur-Mer — actes d’urbanisme',
    page: 'https://www.courseulles-sur-mer.com/mon-quotidien/urbanisme/actes-durbanisme/', source: { protocol: 'posted-acts' } },
  { key: 'vif', insee: '38545', postcode: '38450', label: 'Ville de Vif — actes administratifs',
    page: 'https://ville-vif.fr/vivre-a-vif/la-mairie/actes-administratifs/', source: { protocol: 'posted-acts' } },
  { key: 'trebes', insee: '11397', postcode: '11800', label: 'Ville de Trèbes — avis de dépôt des demandes d’urbanisme',
    page: 'https://ville-trebes.com/urbanisme/avis-de-depot-des-demandes-durbanisme/', source: { protocol: 'posted-acts' } },
  // Names its acts by their site (`Avis-depot-DP-rue-Lachevalle-au-n°-64.pdf`) and prints each avis de dépôt as a one-row list.
  { key: 'saint-jean-d-angely', insee: '17347', postcode: '17400', label: 'Ville de Saint-Jean-d’Angély — affichage légal d’urbanisme',
    page: 'https://www.angely.net/ma-mairie/affichage-legal/urbanisme/',
    source: { protocol: 'posted-acts', unnumbered: true, actLayouts: { filings: 'town-filed-before' } } },
  // Two Word tables a week or a month, Limeil-Brévannes's template: « Dossiers
  // déposés avant le … » and « Dossiers décidés jusqu'au … ».
  { key: 'saint-cyr-l-ecole', insee: '78545', postcode: '78210', label: 'Ville de Saint-Cyr-l’École — autorisations d’urbanisme',
    page: 'https://www.saintcyr78.fr/mon-quotidien/habitat-et-urbanisme/mes-demarches/autorisations-durbanisme/',
    source: { protocol: 'posted-lists', lists: { filings: '\\bAFFICHAGE DEPOTS?\\b', decisions: '\\bAFFICHAGE DECISIONS?\\b' },
      layouts: { filings: 'limeil-filings', decisions: 'limeil-decisions' } } },
  { key: 'mantes-la-ville', insee: '78362', postcode: '78711', label: 'Ville de Mantes-la-Ville — actes réglementaires d’urbanisme',
    page: 'https://www.manteslaville.fr/ma-mairie/vie-municipale/actes-reglementaires/',
    source: { protocol: 'posted-acts', pages: [2, 3, 4, 5].map((n) => `https://www.manteslaville.fr/ma-mairie/vie-municipale/actes-reglementaires/page/${n}/`) } },
];
// i18n-ignore-end
