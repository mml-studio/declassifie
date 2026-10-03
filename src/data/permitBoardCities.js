/**
 * Municipalities that post their permits on boards of their own: weekly PDF
 * lists, one PDF per dossier, or an HTML table of acts. Data only, so that
 * `permitListsFeed.js` can hold them in `PERMIT_LISTS` without importing the
 * readers, which import it (`permitBoards.js` gathers those).
 *
 * Found through population-ranked surveys of municipalities without a
 * fresh permit source, on 2026-10-01 and 2026-10-02. `source.protocol` names
 * how its board is read (`permitBoards.js`).
 */

import { POSTED_LIST_CITIES } from './postedListCities.js';
import { INTRAMUROS_CITIES } from './intramurosCities.js';
import { DOCS2WEB_CITIES } from './docs2webCities.js';

// i18n-ignore-start — publishers' names and the titles of their legal boards
const CITIES = [
  { key: 'bry-sur-marne', insee: '94015', postcode: '94360', label: 'Ville de Bry-sur-Marne — dépôts et décisions d’urbanisme',
    page: 'https://www.brysurmarne.fr/mon-cadre-de-vie/urbanisme/information-de-la-population/les-avis-daffichage/',
    userAgent: 'Surplomb/1.0 (+https://github.com/mml-studio/surplomb)', source: { ocr: true } },
  { key: 'saint-raphael', insee: '83118', postcode: '83700', label: 'Ville de Saint-Raphaël — dépôts et autorisations d’urbanisme',
    page: 'https://www.ville-saintraphael.fr/utile/urbanisme/depots-et-decisions',
    // As on Boulogne's board, the word "scan" in an agent name gets 403.
    userAgent: 'Surplomb/1.0 (+https://github.com/mml-studio/surplomb)' },
  { key: 'scionzier', insee: '74264', postcode: '74950', label: 'Ville de Scionzier — dépôts et autorisations d’urbanisme',
    page: 'https://www.scionzier.fr/habiter/urbanisme/' },
  { key: 'aiffres', insee: '79003', postcode: '79230', label: 'Ville d’Aiffres — dépôts et décisions d’urbanisme',
    page: 'https://www.ville-aiffres.fr/autorisations-du-droit-des-sols' },
  { key: 'eaubonne', insee: '95203', postcode: '95600', label: 'Ville d’Eaubonne — décisions d’urbanisme',
    page: 'https://www.eaubonne.fr/vie-municipale-et-citoyennete/actes-administratifs/' },
  // Delibs permits its public pages but disallows /api/ in robots.txt.
  // Read these legal postings under the same project policy as DematDOC;
  // only the order is collected, never its CERFA or applicant annexes.
  { key: 'les-pavillons-sous-bois', insee: '93057', postcode: '93320', label: 'Ville des Pavillons-sous-Bois — décisions d’urbanisme',
    page: 'https://delibs.com/pavillonssousbois/', robots: 'overridden', source: { protocol: 'delibs', tenant: 'pavillonssousbois' } },
  { key: 'sainte-luce', insee: '97227', postcode: '97228', label: 'Ville de Sainte-Luce — décisions d’urbanisme',
    page: 'https://delibs.com/sainteluce/', robots: 'overridden', source: { protocol: 'delibs', tenant: 'sainteluce', dossierCode: '972227' } },
  // Public boards confirmed during the outer Paris suburbs survey on 2026-10-02.
  { key: 'pontault-combault', insee: '77373', postcode: '77340', label: 'Ville de Pontault-Combault — dépôts et autorisations d’urbanisme',
    page: 'https://actes.pontault-combault.fr/docs/', source: { protocol: 'outer-pontault' } },
  { key: 'rambouillet', insee: '78517', postcode: '78120', label: 'Ville de Rambouillet — dépôts et décisions d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/306',
    source: { protocol: 'outer-digilor', app: 306, category: 3592 } },
  { key: 'villepreux', insee: '78674', postcode: '78450', label: 'Ville de Villepreux — décisions d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/319',
    source: { protocol: 'outer-digilor', app: 319, category: 3032 } },
  { key: 'igny', insee: '91312', postcode: '91430', label: 'Ville d’Igny — décisions d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/22',
    source: { protocol: 'outer-digilor', app: 22, category: 138 } },
  { key: 'vaureal', insee: '95637', postcode: '95490', label: 'Ville de Vauréal — dépôts et décisions d’urbanisme',
    page: 'https://vaureal.fr/au-quotidien/urbanisme-travaux/affichage-des-autorisations-durbanisme',
    source: { protocol: 'outer-vaureal', filings: '/node/9661', decisions: '/node/9662' } },
  { key: 'la-celle-saint-cloud', insee: '78126', postcode: '78170', label: 'Ville de La Celle-Saint-Cloud — décisions d’urbanisme',
    page: 'https://lacellesaintcloud.fr/arretes-municipaux/?t=urbanisme', source: { protocol: 'outer-notices' } },
  { key: 'le-mee-sur-seine', insee: '77285', postcode: '77350', label: 'Ville du Mée-sur-Seine — dépôts et décisions d’urbanisme',
    page: 'https://www.lemeesurseine.fr/vos-demarches/urbanisme-amenagement-du-territoire/avis-de-depot/',
    source: { protocol: 'outer-notices', pages: [
      'https://www.lemeesurseine.fr/vos-demarches/urbanisme-amenagement-du-territoire/avis-de-depot/affichage-legal-reglementaire/',
      'https://www.lemeesurseine.fr/vos-demarches/urbanisme-amenagement-du-territoire/avis-de-depot/arretes/',
    ] } },
  { key: 'crosne', insee: '91191', postcode: '91560', label: 'Ville de Crosne — dépôts et décisions d’urbanisme',
    page: 'https://www.crosne.fr/ma-ville/mon-cadre-de-vie/plan-local-durbanisme/', source: { protocol: 'outer-notices' } },
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
  // One act at a time, or weekly scanned registers (`permitBoardsActs.js`).
  { key: 'oullins-pierre-benite', insee: '69149', postcode: '69600', label: 'Ville d’Oullins-Pierre-Bénite — avis de dépôt et décisions d’urbanisme',
    // Its firewall answers 403 to a User-Agent with the word « scan » in it
    // (2026-10-02), as Boulogne's does. The lists before 22 July 2026 are
    // bare scans: the sweep reads them by OCR.
    page: 'https://www.oullinspierrebenite.fr/ma-mairie/conseil-municipal/arretes-muncipaux/batiments-et-erp/',
    userAgent: 'Surplomb/1.0 (+https://github.com/mml-studio/surplomb)', source: { ocr: true } },
  { key: 'lhay-les-roses', insee: '94038', postcode: '94240', label: 'Ville de L’Haÿ-les-Roses — affichage réglementaire d’urbanisme',
    // The host is spelt « reglemenaire » by the town itself. A few orders are
    // scans: the sweep reads them by OCR.
    page: 'https://affichage-reglemenaire.lhaylesroses.fr/', source: { ocr: true } },
  { key: 'limeil-brevannes', insee: '94044', postcode: '94450', label: 'Ville de Limeil-Brévannes — affichage numérique réglementaire d’urbanisme',
    page: 'https://www.limeil-brevannes.fr/mon-cadre-de-vie/urbanisme/affichage-numerique-reglementaire/' },
  { key: 'villeneuve-saint-georges', insee: '94078', postcode: '94190', label: 'Ville de Villeneuve-Saint-Georges — actes réglementaires de l’urbanisme',
    // Its decisions are one-page scanned extracts: the sweep reads them by OCR.
    page: 'https://www.villeneuve-saint-georges.fr/l-actu-a-villeneuve/1956-actes-reglementaires-de-l-urbanisme.html', source: { ocr: true } },
  { key: 'romainville', insee: '93063', postcode: '93230', label: 'Ville de Romainville — arrêtés d’urbanisme',
    // Every arrêté sampled is a scan: the sweep reads them by OCR.
    page: 'https://www.ville-romainville.fr/5881-actes-administratifs.htm', source: { ocr: true } },
  // Lists printed by the instruction software (`permitBoardsReports.js`).
  { key: 'valence', insee: '26362', postcode: '26000', label: 'Ville de Valence — avis de dépôt et décisions d’urbanisme',
    // Its firewall answers 403 to a User-Agent with the word « scan » in it,
    // robots.txt's included (2026-10-02), as Boulogne's does.
    page: 'https://www.valence.fr/valence-demain/urbanisme/',
    userAgent: 'Surplomb/1.0 (+https://github.com/mml-studio/surplomb)' },
  { key: 'arles', insee: '13004', postcode: '13200', label: 'Ville d’Arles — affichage des dépôts et des décisions d’urbanisme',
    // `robots.txt` disallows /app/, where WordPress keeps every upload, the
    // sheets included (2026-10-02): read by the project's decision, as
    // Bourges's are — the posting the Code de l'urbanisme makes public
    // (art. R.423-6, R.424-15).
    page: 'https://arles.fr/vivre-a-arles/urbanisme/permis-de-construire/laffichage-de-lautorisation-durbanisme/laffichage-des-depots-durbanisme/',
    robots: 'overridden' },
  { key: 'decines-charpieu', insee: '69275', postcode: '69150', label: 'Ville de Décines-Charpieu — dépôts et décisions des autorisations d’urbanisme',
    page: 'https://www.decines-charpieu.fr/975-depots-et-decisions-des-autorisations-d-urbanisme.htm' },
  { key: 'saint-cloud', insee: '92064', postcode: '92210', label: 'Ville de Saint-Cloud — autorisations d’urbanisme en cours et décidées',
    page: 'https://www.saintcloud.fr/autorisations-durbanisme' },
  { key: 'tassin-la-demi-lune', insee: '69244', postcode: '69160', label: 'Ville de Tassin-la-Demi-Lune — autorisations d’urbanisme déposées, délivrées, affichées',
    page: 'https://www.tassinlademilune.fr/cadre-de-ville/urbanisme' },
  { key: 'saint-genis-laval', insee: '69204', postcode: '69230', label: 'Ville de Saint-Genis-Laval — avis de dépôt et décisions d’urbanisme',
    page: 'https://www.saintgenislaval.fr/mes-services/cadre-de-vie-et-urbanisme/decisions-durbanisme' },
  { key: 'sceaux', insee: '92071', postcode: '92330', label: 'Ville de Sceaux — décisions d’urbanisme du mois',
    // Its firewall answers 403 to a User-Agent with the word « scan » in it
    // (2026-10-02), as Valence's does.
    page: 'https://www.sceaux.fr/mon-quotidien/urbanisme',
    userAgent: 'Surplomb/1.0 (+https://github.com/mml-studio/surplomb)' },
  { key: 'pertuis', insee: '84089', postcode: '84120', label: 'Ville de Pertuis — dépôts et décisions d’autorisation de travaux',
    // `Crawl-delay: 2` in its robots.txt.
    page: 'https://www.ville-pertuis.fr/ma-mairie/urbanisme/depots-et-decisions-dautorisation-de-travaux', crawlDelayMs: 2_000 },
];

/**
 * Communes that post on SPL-Xdemat's shared board (`permitBoardsXdemat.js`):
 * [INSEE, postcode, name]. Found on 2026-10-02 by asking the frame of the 479
 * most populous communes of its eight departments with no other source: 31
 * had posted since July. Asking the urbanism tab of the 4 192 others the
 * next night found 23 more, none above a thousand inhabitants (Macey, 975).
 */
const XDEMAT_COMMUNES = [
  ['88160', '88000', 'Épinal'], ['51230', '51200', 'Épernay'], ['52121', '52000', 'Chaumont'],
  ['54329', '54300', 'Lunéville'], ['08409', '08200', 'Sedan'], ['10323', '10100', 'Romilly-sur-Seine'],
  ['10081', '10600', 'La Chapelle-Saint-Luc'], ['02810', '02600', 'Villers-Cotterêts'],
  ['10362', '10300', 'Sainte-Savine'], ['88196', '88400', 'Gérardmer'], ['88321', '88300', 'Neufchâteau'],
  ['10268', '10400', 'Nogent-sur-Seine'], ['88304', '88500', 'Mirecourt'], ['88075', '88250', 'La Bresse'],
  ['10265', '10420', 'Les Noës-près-Troyes'], ['10003', '10160', 'Aix-Villemaur-Pâlis'],
  ['10060', '10450', 'Bréviandes'], ['10349', '10180', 'Saint-Lyé'], ['51193', '51460', 'Courtisols'],
  ['10401', '10140', 'Vendeuvre-sur-Barse'], ['10067', '10800', 'Buchères'],
  ['10115', '10150', 'Creney-près-Troyes'], ['54167', '54200', 'Dommartin-lès-Toul'],
  ['52332', '52140', 'Val-de-Meuse'], ['51237', '51310', 'Esternay'], ['54286', '54800', 'Labry'],
  ['55117', '55120', 'Clermont-en-Argonne'], ['10282', '10600', 'Payns'], ['10368', '10600', 'Savières'],
  ['88484', '88220', 'Uzemain'], ['10080', '10210', 'Chaource'],
  ['10211', '10300', 'Macey'], ['88098', '88390', 'Chaumousey'], ['10426', '10310', 'Ville-sous-la-Ferté'],
  ['10344', '10800', 'Saint-Léger-près-Troyes'], ['88500', '88310', 'Ventron'], ['10223', '10290', 'Marcilly-le-Hayer'],
  ['10260', '10800', 'Moussey'], ['51482', '51240', 'Saint-Germain-la-Ville'], ['55258', '55200', 'Geville'],
  ['54373', '54300', 'Moncel-lès-Lunéville'], ['10409', '10600', 'Villacerf'], ['51643', '51530', 'Vinay'],
  ['88430', '88140', 'Saint-Ouen-lès-Parey'], ['10336', '10180', 'Saint-Benoît-sur-Seine'], ['10314', '10240', 'Ramerupt'],
  ['55014', '55120', 'Aubréville'], ['51378', '51530', 'Monthelon'], ['51630', '51130', 'Villers-aux-Bois'],
  ['10133', '10130', 'Eaux-Puiseaux'], ['51235', '51120', 'Les Essarts-lès-Sézanne'], ['02761', '02190', 'Variscourt'],
  ['88005', '88110', 'Allarmont'], ['02102', '02860', 'Bouconville-Vauclair'],
];
for (const [insee, postcode, name] of XDEMAT_COMMUNES) {
  CITIES.push({ key: `xdemat-${insee}`, insee, postcode, label: `${name} — décisions d’urbanisme (SPL-Xdemat)`,
    page: `https://opendata.spl-xdemat.fr/frame/MA${insee}/affichage-administratif`,
    // `robots.txt` is `Disallow: /` (2026-10-02): read by the project's
    // decision, as DematDOC's boards are (`permitBoardsXdemat.js`).
    robots: 'overridden', source: { protocol: 'spl-xdemat' } });
}
const DEMATDOC_REGISTER_COMMUNES = [
  ['chateauneufsurisere', '26084', '26300', 'Châteauneuf-sur-Isère', 14],
  ['salvagny', '69250', '69890', 'La Tour-de-Salvagny', 14],
  ['saintjeandemonts', '85234', '85160', 'Saint-Jean-de-Monts', 14],
  ['mairie-millery', '69133', '69390', 'Millery', 19, 'millery'],
  ['mairie-vernaison', '69260', '69390', 'Vernaison', 14],
];
for (const [host, insee, postcode, name, doctype, registerLayout] of DEMATDOC_REGISTER_COMMUNES) {
  CITIES.push({ key: `dematdoc-register-${host}`, insee, postcode,
    label: `${name} — registres et actes d’urbanisme (DematDOC)`,
    page: `https://${host}.dematdoc.eu/public/${doctype}`, robots: 'overridden',
    source: { protocol: 'dematdoc-registers', base: `https://${host}.dematdoc.eu`,
      doctypes: [doctype], registerLayout, ocr: true } });
}
CITIES.push({ key: 'caluire-et-cuire', insee: '69034', postcode: '69300',
  label: 'Caluire-et-Cuire — registres d’urbanisme',
  page: 'https://www.ville-caluire.fr/vie-municipale-citoyennete/affichage-legal',
  source: { protocol: 'caluire-register', ocr: true } });
// i18n-ignore-end

/**
 * A city's own fields beyond the five above (`robots`, `crawlDelayMs`,
 * `underReview`, `userAgent` — the name every request to its host carries,
 * robots.txt's included) sit in its entry; `source` extras (`ocr: true` for a board
 * whose scans the daily sweep reads by OCR) merge into its source.
 */
CITIES.push(...POSTED_LIST_CITIES);
CITIES.push(...INTRAMUROS_CITIES);
CITIES.push(...DOCS2WEB_CITIES);

export const BOARD_PERMIT_SOURCES = Object.freeze(CITIES.map((city) => Object.freeze({
  ...city,
  source: Object.freeze({ kind: 'board', protocol: city.key, ...(city.source ?? {}) }),
  lists: Object.freeze([]),
})));
