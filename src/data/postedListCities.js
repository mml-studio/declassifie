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
  // Each family has its own pair of snapshots; applicant and architect columns are excluded.
  { key: 'vetraz-monthoux', insee: '74298', postcode: '74100', label: 'Ville de Vétraz-Monthoux — dépôts et décisions d’urbanisme',
    page: 'https://www.vetraz-monthoux.fr/espace-documentaire/affichage_legal/urbanisme-permis-de-construire/',
    source: { protocol: 'posted-lists', latestOnly: true, requiredRows: true,
      pages: ['https://www.vetraz-monthoux.fr/espace-documentaire/affichage_legal/urbanisme-declarations-prealables/'],
      lists: { filings: '\\bAFFICHAGE DEPOT\\b', decisions: '\\bAFFICHAGE DECISION\\b' },
      layouts: { filings: 'vetraz-filings', decisions: 'vetraz-decisions' } } },
  { key: 'ver-sur-mer', insee: '14739', postcode: '14114', label: 'Commune de Ver-sur-Mer — dépôts et décisions d’urbanisme',
    page: 'https://www.versurmer.fr/infos-pratiques/urbanisme-etat-civil/avis-de-depot-d-autorisations-d-urbanisme/liste-des-avis-de-depot-13017',
    source: { protocol: 'posted-lists', latestOnly: true,
      pages: ['https://www.versurmer.fr/infos-pratiques/urbanisme-etat-civil/avis-de-depot-d-autorisations-d-urbanisme/liste-des-decisions-13018'] } },
  // The filing export is XLSX; the decision export is the same table as a PDF.
  { key: 'fleury-les-aubrais', insee: '45147', postcode: '45400', label: 'Ville de Fleury-les-Aubrais — dépôts et décisions d’urbanisme',
    page: 'https://www.fleurylesaubrais.fr/ma-mairie/vie-municipale/publications-des-actes-administratifs/?category=urbanisme',
    source: { protocol: 'posted-lists', latestOnly: true,
      lists: { filings: '\\bLISTE AFFICHAGE DEPOT\\b|\\bLISTE DES AVIS DE DEPOT\\b', decisions: '\\bLISTE AFFICHAGE \\d|\\bLISTE DES DECISIONS\\b' },
      workbookSheets: { filings: 'Liste affichage dépôt' },
      layouts: { filings: 'fleury-filings', decisions: 'fleury-decisions' } } },
  // Scanned tables: applicants and their residential addresses are never read.
  { key: 'selestat', insee: '67462', postcode: '67600', label: 'Ville de Sélestat — dépôts et décisions d’urbanisme',
    page: 'https://www.selestat.fr/mon-quotidien/logement-et-urbanisme/recepisses-et-autorisations',
    source: { protocol: 'posted-lists', latestOnly: true, listOcr: 'scan', ocrPsm: 6,
      layouts: { filings: 'selestat-register', decisions: 'selestat-register' } } },
  // Osny replaces some dated URLs in place; validators keep those lists current.
  { key: 'osny', insee: '95476', postcode: '95520', underReview: true, label: 'Ville d’Osny — dépôts et décisions d’urbanisme',
    page: 'https://osny.fr/les-services/urbanisme/autorisations-durbanisme',
    source: { protocol: 'posted-lists', rolling: true, latestOnly: true,
      lists: { filings: '\\bAFFICHAGE DEPOTS?\\b', decisions: '\\bAFFICHAGE DECISIONS?\\b' },
      layouts: { filings: 'town-filed-before', decisions: 'town-decided-until' } } },
  // Its A3 exports turn the text coordinates by 90 degrees, including continuations.
  { key: 'quimperle', insee: '29233', postcode: '29300', underReview: true, label: 'Ville de Quimperlé — dépôts et décisions d’urbanisme',
    page: 'https://www.quimperle.bzh/vivre-a-quimperle/habitat-urbanisme/demarches-durbanisme-rdv/',
    source: { protocol: 'posted-lists', latestOnly: true,
      lists: { filings: '\\bDOSSIERS DEPOSES AVANT\\b', decisions: '\\bAUTORISATIONS DELIVREES JUSQU\\b|\\bDOSSIERS DECIDES JUSQU\\b' },
      layouts: { filings: 'town-quarter-turn-filings', decisions: 'town-quarter-turn-decisions' } } },
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
  // The document library lists every paper, newest first; the avis de dépôt are among the first three pages.
  { key: 'mauges-sur-loire', insee: '49244', postcode: '49290', label: 'Mauges-sur-Loire — avis de dépôt et décisions d’urbanisme',
    page: 'https://www.mauges-sur-loire.fr/systeme/documentheque/', source: { protocol: 'posted-acts', pages: [
      'https://www.mauges-sur-loire.fr/systeme/documentheque/page/2/', 'https://www.mauges-sur-loire.fr/systeme/documentheque/page/3/',
    ] } },
  // One page a family; the files name the number glued and short (`Avis_de_depot_pc2600023_….pdf`).
  { key: 'coursan', insee: '11106', postcode: '11110', label: 'Ville de Coursan — affichage légal des autorisations d’urbanisme',
    page: 'https://www.coursan.fr/demarches/urbanisme/affichage-legal-des-autorisations-doccupation-du-sol/permis-de-construire-1/avis-de-depot',
    source: { protocol: 'posted-acts', pages: ['permis-de-construire-1/decisions', 'declarations-prealables-dp', 'permis-damenager-pa', 'permis-de-demolir-pd']
      .map((path) => `https://www.coursan.fr/demarches/urbanisme/affichage-legal-des-autorisations-doccupation-du-sol/${path}`) } },
  { key: 'cordemais', insee: '44045', postcode: '44360', label: 'Commune de Cordemais — décisions d’urbanisme',
    page: 'https://www.cordemais.fr/urbanisme/', source: { protocol: 'posted-acts' } },
  // A month's granted permits, « Permis de construire accordés septembre 2026 », exported from its software.
  { key: 'cesson-sevigne', insee: '35051', postcode: '35510', label: 'Ville de Cesson-Sévigné — permis de construire accordés',
    page: 'https://www.ville-cesson-sevigne.fr/consulter-les-documents-durbanisme/',
    source: { protocol: 'posted-lists', lists: { decisions: '\\bPERMIS DE CONSTRUIRE ACCORDES\\b' }, layouts: { decisions: 'town-cim-decisions' } } },
  // Names its acts by their site (`Avis-depot-DP-rue-Lachevalle-au-n°-64.pdf`) and prints each avis de dépôt as a one-row list.
  { key: 'saint-jean-d-angely', insee: '17347', postcode: '17400', label: 'Ville de Saint-Jean-d’Angély — affichage légal d’urbanisme',
    page: 'https://www.angely.net/ma-mairie/affichage-legal/urbanisme/',
    source: { protocol: 'posted-acts', unnumbered: true, actLayouts: { filings: 'town-filed-before' } } },
  // Two Word tables a week or a month, Limeil-Brévannes's template: « Dossiers
  // déposés avant le … » and « Dossiers décidés jusqu'au … ».
  { key: 'saint-cyr-l-ecole', insee: '78545', postcode: '78210', label: 'Ville de Saint-Cyr-l’École — autorisations d’urbanisme',
    page: 'https://www.saintcyr78.fr/mon-quotidien/habitat-et-urbanisme/mes-demarches/autorisations-durbanisme/',
    source: { protocol: 'posted-lists', lists: { filings: '\\bAFFICHAGE DEPOTS?\\b', decisions: '\\bAFFICHAGE DECISIONS?\\b' },
      layouts: { filings: 'town-filed-before', decisions: 'town-decided-until' } } },
  { key: 'mantes-la-ville', insee: '78362', postcode: '78711', label: 'Ville de Mantes-la-Ville — actes réglementaires d’urbanisme',
    page: 'https://www.manteslaville.fr/ma-mairie/vie-municipale/actes-reglementaires/',
    source: { protocol: 'posted-acts', pages: [2, 3, 4, 5].map((n) => `https://www.manteslaville.fr/ma-mairie/vie-municipale/actes-reglementaires/page/${n}/`) } },
  // Their robots.txt refuses every PDF (`Disallow: /*.pdf`, `Disallow: *.pdf`): the legal
  // display is read anyway, one file a second, the exception marked by `robots`.
  // Dompierre-sur-Mer links each act with its number and posting day
  // (« PC 17142 26 00006 - … - Affiché le 06/05/2026 »), every act a scan.
  { key: 'dompierre-sur-mer', insee: '17142', postcode: '17139', label: 'Ville de Dompierre-sur-Mer — affichage légal numérique d’urbanisme',
    page: 'https://www.dompierresurmer.fr/vie-municipale/affichage-legal-numerique/urbanisme', robots: 'overridden',
    source: { protocol: 'posted-acts' } },
  // Sarralbe gives each dossier a page of its own, titled with its number, linking the scanned act.
  { key: 'sarralbe', insee: '57628', postcode: '57430', label: 'Ville de Sarralbe — autorisations d’urbanisme',
    page: 'https://www.sarralbe.fr/pc-permis-de-construire', robots: 'overridden',
    source: { protocol: 'posted-acts', follow: true, pages: ['https://www.sarralbe.fr/dp-declaration-prealable-de-travaux'] } },
  // Boards that post one PDF per act on a page of their own (backlog survey of 2026-10-03).
  // Val de Briey (WordPress): « DP 054 099 26 00117 M01 Télécharger », the
  // upload month in the path; the arrêtés are scans, read by OCR in the sweep
  // (2026-10-04: 37 decisions, 34 with a site, signed 28 July to 2 October).
  { key: 'val-de-briey', insee: '54099', postcode: '54150', label: 'Ville de Val de Briey — arrêtés d’urbanisme',
    page: 'https://www.valdebriey.fr/mes-demarches/urbanisme/arretes-durbanisme/', source: { protocol: 'posted-acts' } },
  // Kaysersberg Vignoble names each file by its site, number and day:
  // `ka_6_rue_du_chateau_PC0681622600011_23_09_2026_arrete.pdf`, `…_avis_depot.pdf`
  // (2026-10-04: 4 decisions and 2 filings on the page, all with a site, the newest of 1 October).
  { key: 'kaysersberg-vignoble', insee: '68162', postcode: '68240', label: 'Commune de Kaysersberg Vignoble — publications par voie d’affichage',
    page: 'https://www.kaysersberg-vignoble.fr/services/urbanisme/publications-par-voie-daffichage/', source: { protocol: 'posted-acts' } },
  // Biesheim (WordPress): `DP-06803626R0032.pdf`, one arrêté each, the upload month in the path
  // (2026-10-04: 9 decisions, 8 with a site, the newest signed 23 September; the page also holds a
  // monthly Excel list of the dossiers under review, not read). OCR reads its scans' « R0028 » as
  // « RO028 » (`oForZero`).
  { key: 'biesheim', insee: '68036', postcode: '68600', label: 'Commune de Biesheim — arrêtés d’urbanisme',
    page: 'https://www.biesheim.fr/municipalite/urbanisme/', source: { protocol: 'posted-acts', oForZero: true } },
  // Rurange-lès-Thionville links each arrêté by its number, from a file named
  // after its applicant: only the number is read from the link, its counter's zero
  // typed as the letter O (`DP05760226NO060`, `oForZero`). Its acts print
  // the parcels as « S37 P0113 » (section 37, parcel 113): left unread
  // (2026-10-04: 40 decisions, 39 with a site, 38 with a signing day, 21 since 3 July, the newest of 24 September).
  { key: 'rurange-les-thionville', insee: '57602', postcode: '57310', label: 'Commune de Rurange-lès-Thionville — arrêtés d’urbanisme',
    page: 'https://rurange-les-thionville.fr/urbanisme/arrêtés-urbanisme', source: { protocol: 'posted-acts', noParcels: true, oForZero: true } },
  // Hagondange lists its acts in two tabs, « Affichage des dépôts » and « Affichage des décisions »,
  // `view_document.php?id=N` (a scan each) under the number's words, oldest first.
  // Only a site the act labels « Terrain sis » is read: a filing for a declaration whose notice prints just
  // the applicant's address gives no row, and the link names no site (`bare: false`). The newest acts
  // are the last of the page; its scans take three sweeps to read (40 by OCR each). 2026-10-04: 51
  // decisions (40 signed since 3 July, 49 with a site) and 6 filings, the newest of 24 September.
  { key: 'hagondange', insee: '57283', postcode: '57300', label: 'Ville de Hagondange — affichage légal des autorisations d’urbanisme',
    page: 'https://www.hagondange.fr/Ma-mairie-ses-services/Urbanisme/Affichage-legal-autorisations-urbanisme.html',
    source: { protocol: 'posted-acts', oldestFirst: true, limit: 110, sections: [
      { words: '\\bAFFICHAGE DES DEPOTS\\b', board: 'filings', bare: false },
      { words: '\\bAFFICHAGE DES DECISIONS\\b', board: 'decisions' },
    ] } },
  // Émerainville's document library, « Arrêtés d'urbanisme » (the six newest on its first page;
  // the rest load by script): `Avis-de-depot-DP-n°-077-169-26-00024.pdf` (typed, the
  // site in the notice) and `DP-26-00009.pdf` (a scanned certificate), the title in
  // each link's `title`. 2026-10-04: 2 filings and 4 decisions on the page, all with a site; nothing
  // posted since 12 August. (The rest of the library, 42 documents, is behind
  // `/wp-json/creasit/postsQuery?cpt=documents&category=284`, not read.)
  { key: 'emerainville', insee: '77169', postcode: '77184', label: 'Ville d’Émerainville — arrêtés d’urbanisme',
    page: 'https://www.mairie-emerainville.fr/systeme/documentheque/?documents_category=284', source: { protocol: 'posted-acts' } },
];
// i18n-ignore-end
