import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTICE_BOARD_PROTOCOLS, NOTICE_BOARD_READERS, NOTICE_BOARD_TEXT,
  readAntonyDecision, readAntonyFiling, readLaRocheDecision, readPoissyDecision,
} from './permitBoardsNotices.js';
import { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';
import { scrubPermitListRow } from './permitListsFeed.js';

const city = (key) => BOARD_PERMIT_SOURCES.find((source) => source.key === key);
const antony = city('antony');
const laRoche = city('la-roche-sur-yon');
const poissy = city('poissy');
const PRIVATE = /PRIVATE|PRIVEE|Privée/i;

// Synthetic pages: [x, y, text] runs, about 5 points per character.
const run = ([x, y, text]) => ({ x, y, x1: x + text.length * 5, text, size: 10 });
const page = (runs, width = 595) => ({ width, runs: runs.map(run) });
const doc = (...pages) => ({ pages });

// i18n-ignore-start — French fixtures in the publishers' own words
test('every protocol and reader of the family is exported, frozen', () => {
  assert.deepEqual(Object.keys(NOTICE_BOARD_PROTOCOLS).sort(), ['antony', 'la-roche-sur-yon', 'poissy']);
  assert.ok(Object.isFrozen(NOTICE_BOARD_PROTOCOLS) && Object.isFrozen(NOTICE_BOARD_READERS) && Object.isFrozen(NOTICE_BOARD_TEXT));
  for (const key of ['antony', 'la-roche-sur-yon', 'poissy']) assert.equal(city(key).source.protocol, key);
});

test('Antony: one POST, the two urbanism categories since the window, never the file name', () => {
  const [request] = NOTICE_BOARD_PROTOCOLS.antony.start(antony, { since: '2026-09-01', day: '2026-10-02' });
  assert.equal(request.method, 'POST');
  assert.deepEqual(JSON.parse(request.body), { sortBy: 1 });
  const at = (day) => Date.parse(`${day}T08:00:00Z`);
  const body = [
    { id: 1, fileName: 'PRIVATE - 1 rue X.pdf', categoryLabel: "Urbanisme > Autorisations d'urbanisme dépôt", releaseDate: at('2026-09-30'), uuid: '5c5c0535-dd0a-4dce-8e9a-411d6d703df0' },
    { id: 2, fileName: 'PRIVATE - 2 rue Y.pdf', categoryLabel: "Urbanisme > Autorisations d'urbanisme décision", releaseDate: at('2026-09-25'), uuid: '042c7a79-4cd6-4dca-8075-28f37f00b27e' },
    { id: 3, fileName: 'old.pdf', categoryLabel: "Urbanisme > Autorisations d'urbanisme dépôt", releaseDate: at('2026-08-20'), uuid: 'cdc18179-124d-4069-8dd0-6661d0bab84b' },
    { id: 4, fileName: 'AR26090584.pdf', categoryLabel: 'Arrêtés du Maire', releaseDate: at('2026-09-30'), uuid: '608164c6-3ba1-4c53-971e-c754ce32bbc0' },
    { id: 5, fileName: 'bad.pdf', categoryLabel: "Urbanisme > Autorisations d'urbanisme dépôt", releaseDate: at('2026-09-30'), uuid: '../../etc' },
  ];
  const { files } = NOTICE_BOARD_PROTOCOLS.antony.index(antony, body, request, { since: '2026-09-01', day: '2026-10-02' });
  assert.deepEqual(files.map((file) => [file.board, file.layout, file.published, Boolean(file.scan)]), [
    ['filings', 'antony-filing', '2026-09-30', false],
    ['decisions', 'antony-decision', '2026-09-25', true],
  ]);
  assert.match(files[0].url, /\/download\/5c5c0535-dd0a-4dce-8e9a-411d6d703df0$/);
  assert.doesNotMatch(JSON.stringify(files), PRIVATE);
  assert.equal(NOTICE_BOARD_PROTOCOLS.antony.index(antony, '<html>login</html>', request, { since: '2026-09-01' }), null);
  assert.equal(NOTICE_BOARD_PROTOCOLS.antony.index(antony, [{ error: 'x' }], request, { since: '2026-09-01' }), null);
});

test('Antony filing: the site lies between the land area and the parcel, never the applicant’s address', () => {
  const document = doc(page([
    [158, 710, 'Dossier numéro : DP 92002 26 A0402'],
    [59, 611, "Date d'enregistrement de la demande"], [303, 611, '28/09/2026'],
    [303, 597, 'Monsieur PRIVATE Person'], [59, 593, 'Par'],
    [303, 581, '9 rue Privée'], [303, 566, 'rue Privée bis 61'],
    [303, 549, 'Installation d’une pompe à chaleur. Le voisin est d’accord.'], [59, 549, 'Nature du projet'],
    [303, 536, 'sur la façade arrière'],
    [303, 520, '907 m²'], [59, 520, 'Superficie du terrain'],
    [303, 505, '76 Avenue Division Leclerc'], [59, 502, 'Sis à l’adresse suivant'],
    [303, 490, '92160 ANTONY'],
    [303, 474, 'BZ0207'], [59, 474, 'Parcelle(s) cadastrale(s)'],
    [303, 456, '01/10/2026'], [59, 456, 'Affichage du'],
  ]));
  const rows = readAntonyFiling(document, { city: antony, file: { board: 'filings', published: '2026-10-01' } });
  assert.deepEqual(rows, [{ board: 'filings', dossier: 'DP 092002 26 A0402', applicant: null,
    address: '76 Avenue Division Leclerc', postcode: '92160', parcels: 'BZ 207',
    purpose: 'Installation d’une pompe à chaleur.', filedOn: '2026-09-28', landArea: '907', postedOn: '2026-10-01' }]);
  assert.doesNotMatch(JSON.stringify(rows), PRIVATE);
  assert.ok(scrubPermitListRow(rows[0]));
  assert.deepEqual(readAntonyFiling(doc(page([])), { city: antony, file: { board: 'filings' } }), []);
});

test('Antony decision: what follows « en vue de », never the applicant between « accordé à » and it', () => {
  const ocr = (number, heading) => doc(page([
    [206, 611, `EXTRAIT D'ARRETE ${heading}`], [217, 581, 'PERMIS DE CONSTRUIRE'],
    [63, 456, `Par arrêté municipal en date du J 8 SEP. 2026 le permis de construire n° ${number}`],
    [63, 442, 'A0019 MOL est accordé à PRIVATE PERSON demeurant 143 RUE PRIVEE, à'],
    [63, 427, '92160 ANTONY, en vue de l\'installation d\'une construction en préfabriqué sur un'],
    [63, 413, 'terrain situé 143 Avenue Armand Guillebaud, 92160 Antony.'],
    [62, 383, 'Toute personne intéressée pourra prendre connaissance des pièces du dossier'],
    [62, 311, 'Antony, le 18 SEP, 2026'],
  ]));
  const file = { board: 'decisions', published: '2026-10-01' };
  const [row] = readAntonyDecision(ocr('PC 92002 26', "D'ACCORD"), { city: antony, file });
  assert.deepEqual(row, { board: 'decisions', dossier: 'PC 092002 26 A0019 M01', applicant: null,
    address: '143 Avenue Armand Guillebaud', postcode: '92160', parcels: null,
    purpose: "l'installation d'une construction en préfabriqué", verdict: 'Accord', decidedOn: '2026-09-18', postedOn: '2026-10-01' });
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  assert.equal(readAntonyDecision(ocr('PC 92002 26', 'DE REFUS'), { city: antony, file })[0].verdict, 'Refus');
  // A sign's « autorisation préalable » is no building authorisation.
  assert.deepEqual(readAntonyDecision(ocr('AP 92002 26', "D'ACCORD"), { city: antony, file }), []);
});

test('La Roche-sur-Yon: permit files by their name, one per act, since the window', () => {
  const base = 'https://actes.larochesuryon.fr/wp-content/uploads/';
  const link = (stamp, name, label) => `<li><a href="${base}${stamp}_${name}.pdf" target="_blank">${name} - ${label}</a></li>`;
  const html = `<h2>Liste des actes</h2><ul>${[
    link('2026-10-01_09:13:35-am', '2026-Ville-4178-dp-26-00480', '1 octobre 2026'),
    link('2026-09-24_07:13:53-am', '2026-Ville-4154-pc-23-y0060-m02', '24 septembre 2026'),
    link('2026-09-08_08:43:36-am', '2026-Ville-4023-pc24y0146m01', '8 septembre 2026'),
    link('2026-09-08_08:43:37-am', '2026-Ville-4003-dp2500501', '8 septembre 2026'),
    link('2026-08-19_08:43:18-am', '2026-Ville-3945-dp-26-00466-arrete', '19 août 2026'),
    link('2026-08-19_08:43:19-am', '2026-Ville-3945-dp-26-00466-arrete', '19 août 2026'),
    link('2026-09-28_12:43:17-pm', '2026-Ville-4145-arrete-donnant-delegation-de-signature-a-n-gazo', '28 septembre 2026'),
    link('2026-07-01_08:00:00-am', '2026-Ville-3500-dp-26-00300', '1 juillet 2026'),
  ].join('')}</ul>`;
  const options = { since: '2026-08-01', day: '2026-10-02' };
  const [request] = NOTICE_BOARD_PROTOCOLS['la-roche-sur-yon'].start(laRoche, options);
  assert.equal(request.url, laRoche.page);
  const { files } = NOTICE_BOARD_PROTOCOLS['la-roche-sur-yon'].index(laRoche, html, request, options);
  assert.deepEqual(files.map((file) => [file.row.dossier, file.published]), [
    ['DP 085191 26 00480', '2026-10-01'],
    ['PC 085191 23 Y0060 M02', '2026-09-24'],
    ['PC 085191 24 Y0146 M01', '2026-09-08'],
    ['DP 085191 25 00501', '2026-09-08'],
    ['DP 085191 26 00466', '2026-08-19'],
  ]);
  assert.ok(files.every((file) => file.scan && file.ocrPages === 1 && file.board === 'decisions' && file.row.verdict === 'Décision signée'));
  assert.equal(NOTICE_BOARD_PROTOCOLS['la-roche-sur-yon'].index(laRoche, '<html>Maintenance</html>', request, options), null);
});

test('La Roche-sur-Yon decision: each line to its nearest label, the applicant’s home never the site', () => {
  const document = doc(page([
    [33, 814, 'DOSSIER N° DP 085 191 26 00480'], [510, 814, 'PAGE 1/2'],
    [298, 792, 'DECLARATION PREALABLE'], [404, 760, 'ARRETE N° 2026-VILLE-4178'],
    [39, 734, 'Demande déposée le 01/08/2026 et complétée les 02/09/2026,'],
    [123, 700, 'Par : | Madame PRIVATE Person'],
    [134, 677, '. [97 Rue Privée'], [81, 669, 'Demeurant à :'], [151, 662, '85000 LA ROCHE SUR YON'],
    [151, 642, 'Modification fenêtre en porte + terrasse'],
    [43, 636, 'Précisi one es travaux vau : |. isolation'],
    [54, 611, 'Surun terrain sie à : [25 Impasse Jean Giraudoux'],
    [61, 603, '“ 2 SS 4: | 85090 LA ROCHE SUR YON'],
    [98, 591, 'Cadastré : | 191 DO 204'],
    [41, 560, 'LE MAIRE'],
    [41, 433, 'Article 1 :'],
    [42, 422, "La présente déclaration préalable fait l'objet d'une décision de non-opposition"],
    [41, 383, 'Article 2 :'],
    [235, 285, 'Fait à LA ROCHE SUR YON, le 2 SEP, 2026'],
  ]));
  const file = { board: 'decisions', published: '2026-10-01', row: { dossier: 'DP 085191 26 00480' } };
  const [row] = readLaRocheDecision(document, { city: laRoche, file });
  assert.deepEqual(row, { board: 'decisions', dossier: 'DP 085191 26 00480', applicant: null,
    address: '25 Impasse Jean Giraudoux', postcode: '85000', parcels: 'DO 204',
    purpose: 'Modification fenêtre en porte + terrasse. isolation', filedOn: '2026-08-01',
    floorArea: null, landArea: null, verdict: 'Non-opposition', decidedOn: '2026-09-02', postedOn: '2026-10-01' });
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // A scan not read yet has no runs: no row, so the sweep's OCR is asked.
  assert.deepEqual(readLaRocheDecision(doc(page([])), { city: laRoche, file }), []);
});

test('Poissy: one POST per month, the published files only, the verdict without the name', () => {
  const options = { since: '2026-08-01', day: '2026-10-02' };
  const requests = NOTICE_BOARD_PROTOCOLS.poissy.start(poissy, options);
  assert.deepEqual(requests.map((request) => new URLSearchParams(request.body).get('numero_filter')), ['URBA_202608', 'URBA_202609', 'URBA_202610']);
  assert.ok(requests.every((request) => request.method === 'POST' && new URLSearchParams(request.body).get('typedoc_filter') === '7'));
  const row = (ref, signed, subject, link, published = '') => `<tr><td>Urbanisme</td><td>${ref}</td><td>${signed}</td><td>Urbanisme</td>
    <td>${subject}</td><td>${link ? `<a title="Ouvrir le fichier" href="./uploads/${link}${ref}.pdf">${ref}.pdf</a>` : ''}</td>
    <td></td><td>OUI</td><td>${published}</td><td></td><td class="suivi"></td></tr>`;
  const html = `<table id="dataTableDocuments"><tbody>${[
    row('URBA_20260916_620', '23/09/2026', 'DP07849826Y0143 PRIVATE REFUS', '/', '29/09/2026'),
    row('URBA_20260916_621', '23/09/2026', 'DP07849826Y0077/M01 PRIVATE ACCORD', '/', '29/09/2026'),
    row('URBA_20260921_632', '25/09/2026', 'DP26Y0167 PRIVATE arrêté favorable avec prescriptions', '/', '25/09/2026'),
    row('URBA_20260922_640', '25/09/2026', 'DP 78498 26 Y0164 PRIVATE', '/', '25/09/2026'),
    row('URBA_20260908_609', '14/09/2026', 'DP26Y136 PRIVATE Arrêté favorable', '/', '15/09/2026'),
    row('URBA_20260928_654', '', 'CU 078 498 26 Y 0362', 'originals/'),
    row('URBA_20261001_658', '', 'PC26Y0018 SCCV RDL J2 arrêté favorable', null),
    row('URBA_20260921_631', '25/09/2026', 'ATERP26Y0038 SARL G.S.V arrêté favorable', '/', '25/09/2026'),
    row('URBA_20260706_462', '06/07/2026', 'ARRETE PROROGEANT UN PERMIS DE CONSTRUIRE PC07849818Y0002', '/', '06/08/2026'),
  ].join('').replaceAll('href="./uploads//', 'href="./uploads/')}</tbody></table>`;
  const { files } = NOTICE_BOARD_PROTOCOLS.poissy.index(poissy, html, requests[1], options);
  assert.deepEqual(files.map((file) => [file.row.dossier, file.row.verdict, file.row.decidedOn, file.published]), [
    ['DP 078498 26 Y0143', 'Refus', '2026-09-23', '2026-09-29'],
    ['DP 078498 26 Y0077 M01', 'Accord', '2026-09-23', '2026-09-29'],
    ['DP 078498 26 Y0167', 'Accord', '2026-09-25', '2026-09-25'],
    ['DP 078498 26 Y0164', 'Décision signée', '2026-09-25', '2026-09-25'],
    ['DP 078498 26 Y0136', 'Accord', '2026-09-14', '2026-09-15'],
  ]);
  assert.match(files[0].url, /^https:\/\/www\.ville-poissy\.fr\/publication_actes\/uploads\/URBA_20260916_620\.pdf$/);
  assert.doesNotMatch(JSON.stringify(files), PRIVATE);
  assert.equal(NOTICE_BOARD_PROTOCOLS.poissy.index(poissy, '<html><script>cookie check</script></html>', requests[0], options), null);
});

test('Poissy decision: the site in its own column, the applicant beside it never read', () => {
  const file = { board: 'decisions', published: '2026-09-29', row: { dossier: 'DP 078498 26 Y0143', verdict: 'Refus', decidedOn: '2026-09-23' } };
  const document = doc(page([
    [271, 724, 'ARRÊTÉ'], [56, 709, 'D’OPPOSITION À UNE DECLARATION PREALABLE'],
    [28, 666, 'Dossier n° DP 78498 26 Y0143'],
    [28, 654, 'Déposé le : 22/07/2026'], [317, 654, 'Adresse du terrain : 76 Rue Saint Sébastien -'],
    [28, 641, 'Complété le : 14/09/2026'], [317, 641, '78300 Poissy'],
    [28, 617, 'Arrêté n° : URBA_20260916_620'], [317, 617, 'Références cadastrales : AZ405'],
    [28, 600, 'Par : Monsieur PRIVATE Person'], [28, 588, '1 Rue Privée'], [28, 576, '78300 Poissy'],
    [28, 559, "Pour : Le projet consiste en la création d'une"], [28, 547, 'clôture en façade sur rue.'],
    [21, 448, 'Le Maire de POISSY'],
    [21, 575, 'ARRÊTE'],
  ]), page([[21, 575, 'Article 1 : Il est fait OPPOSITION aux travaux faisant l’objet de la demande'], [21, 538, 'Article 2 : La présente décision est notifiée']]));
  const [row] = readPoissyDecision(document, { city: poissy, file });
  assert.deepEqual(row, { board: 'decisions', dossier: 'DP 078498 26 Y0143', applicant: null,
    address: '76 Rue Saint Sébastien', postcode: '78300', parcels: 'AZ 405',
    purpose: "Le projet consiste en la création d'une clôture en façade sur rue.", filedOn: '2026-07-22',
    floorArea: null, verdict: 'Refus', decidedOn: '2026-09-23', postedOn: '2026-09-29' });
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
});

test('Poissy covering letter alone: the line under « OBJET », the addressee block never', () => {
  const file = { board: 'decisions', published: '2026-09-29', row: { board: 'decisions', dossier: 'DP 078498 26 Y0077 M01', verdict: 'Accord', decidedOn: '2026-09-23' } };
  const letter = doc(page([
    [28, 688, 'Dossier suivi par : Agent'], [323, 688, 'MADAME PRIVATE PERSON'],
    [323, 676, '9 RUE PRIVEE'], [323, 665, '78300 POISSY'],
    [28, 607, 'OBJET : DP 78498 26 Y0077 M01'], [28, 597, '136 Rue Adrienne Bolland Poissy'],
    [28, 514, 'Votre déclaration préalable modificative a été acceptée.'],
  ]));
  const [row] = readPoissyDecision(letter, { city: poissy, file });
  assert.equal(row.address, '136 Rue Adrienne Bolland');
  assert.equal(row.verdict, 'Accord');
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // A letter about another dossier is not this file's.
  assert.deepEqual(readPoissyDecision(letter, { city: poissy, file: { ...file, row: { ...file.row, dossier: 'DP 078498 26 Y0078' } } }), []);
});
// i18n-ignore-end
