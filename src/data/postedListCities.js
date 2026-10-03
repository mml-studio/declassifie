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
];
// i18n-ignore-end
