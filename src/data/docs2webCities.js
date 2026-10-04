/**
 * Communes whose Screensoft Docs2Web kiosk posts their urbanism acts, read by
 * the `docs2web` protocol (`permitBoardsDocs2web.js`): [INSEE, postcode,
 * name, the kiosk's page, what its `source` says beyond the protocol]. Data
 * only, appended to `permitBoardCities.js`'s list. Found on 2026-10-03 among
 * the tenants the Wayback Machine lists under `screensoft.eu/Docs2Web/` and
 * the kiosks communes host on their own site: these name a dossier in their
 * papers' names and serve their PDFs. Teloché
 * names them too, but its kiosk's `content/` redirects to Screensoft's login;
 * Bassens is read by Bordeaux Métropole's portal; Quesnoy-sur-Deûle's kiosk is
 * served over plain HTTP only; Varennes-Jarcy and Font-Romeu posted no
 * urbanism since August.
 *
 * La Valette-du-Var (SaaS tenant 7500) names each paper after its applicant:
 * its decisions — 44 under « Déclarations préalables » and 32 under « Permis
 * de construire » from 1 July to 2 October 2026 — are scans of the Cart@DS
 * letter (`DOSSIER : N° DP 083 144 26 00132`, `ADRESSE DES TRAVAUX`,
 * `Références cadastrales`), read by OCR: 14 of 14 sampled gave the number
 * and the site, 11 with a house number. Its 88 receipts under « Dépôt des
 * demandes » are the national form, which never prints the site: not read.
 *
 * Saint-Amand-les-Eaux posts the day's Cart@DS tables instead, as text:
 * « Dossiers déposés avant le 18 août 2026 » (Date de dépôt | Numéro de
 * dossier | Pétitionnaire | Adresse du projet | Description du projet) under
 * « DEPOT DE DOSSIERS », « Dossiers décidés jusqu'au … » under « ARRETES »:
 * the `grid` reader's columns. 43 lists of filings and 25 of decisions from
 * 1 July to 18 August 2026, 100 dossiers filed or decided since 3 July, every
 * one with its site; the whole kiosk has posted nothing since 20 August (read
 * 2026-10-04), though the town's « Affichage légal » page still links it.
 *
 * Saint-Ismier (SaaS tenant 8198) names each decision after its own act
 * (`DP2026-106DECI`, `DP2026-117TAC`) for DP 038 397 26 10106 and 10117: the
 * name cannot give the counter, the scan can. 31 papers posted from 5 August
 * to 2 October 2026 under « Déclaration Préalable (DP) » and « Permis de
 * Construire (PC) », 29 decisions read by OCR with their site (26 with a
 * house number, 23 with parcels); the two others are sign authorisations
 * (`AP`). Its year's list of filings is a 10-page scanned table: not read.
 */
// i18n-ignore-start — publishers' names
const COMMUNES = [
  ['37122', '37300', 'Joué-lès-Tours', 'https://www.jouelestours.fr/wp-content/uploads/adtm/'],
  ['59098', '59166', 'Bousbecque', 'https://www.screensoft.eu/Docs2Web/2070%20-%20COMMUNE%20DE%20BOUSBECQUE/'],
  ['83144', '83160', 'La Valette-du-Var', 'https://www.screensoft.eu/Docs2Web/SAAS%20-%207500%20-%20MAIRIE%20DE%20LA%20VALETTE%20DU%20VAR/',
    { media: true, unnamed: true, scans: true, folders: ['Déclarations préalables', 'Permis de construire'] }],
  ['59526', '59230', 'Saint-Amand-les-Eaux', 'https://www.screensoft.eu/Docs2Web/1680%20-%20MAIRIE%20DE%20SAINT%20AMAND%20LES%20EAUX/',
    { unnamed: true, layout: 'grid', folders: ['DEPOT DE DOSSIERS', 'ARRETES'] }],
  ['38397', '38330', 'Saint-Ismier', 'https://www.screensoft.eu/Docs2Web/SAAS%20-%208198%20-%20MAIRIE%20DE%20SAINT%20ISMIER/',
    { media: true, unnamed: true, scans: true, folders: ['Déclaration Préalable (DP)', 'Permis de Construire (PC)'] }],
];
// i18n-ignore-end

export const DOCS2WEB_CITIES = COMMUNES.map(([insee, postcode, name, page, options = {}]) => ({
  key: `docs2web-${insee}`, insee, postcode,
  // The DematDOC reader cuts the commune's name off a site (`888 Chemin du Fuméou à LA VALETTE DU VAR`).
  name,
  label: `${name} — affichage légal d’urbanisme`, // i18n-ignore-line — the commune's name and its board's title
  page,
  // Screensoft's robots.txt refuses every path but its login; the boards are the public display the Code requires.
  ...(page.includes('screensoft.eu') ? { robots: 'overridden' } : {}),
  source: { protocol: 'docs2web', ocr: true, ...options },
}));
