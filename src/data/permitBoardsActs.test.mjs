import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACT_BOARD_PROTOCOLS, ACT_BOARD_READERS, lhayTitle, oullinsFileBoard, prefixedParcels, romainvilleFileDossier, vsgFileDossier,
} from './permitBoardsActs.js';
import { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';
import { TOWN_LIST_READERS } from './permitBoardsTownLists.js';
import { normalisePermitListRow, permitListFor, scrubPermitListRow } from './permitListsFeed.js';

const city = (key) => BOARD_PERMIT_SOURCES.find((source) => source.key === key);
const KEYS = ['oullins-pierre-benite', 'romainville', 'villeneuve-saint-georges', 'lhay-les-roses', 'limeil-brevannes'];
/** A run as a text layer gives it: a phrase, or an OCR word. */
const run = (text, x, y) => ({ text, x, x1: x + text.length * 4, y, size: 8, clip: null });
/** A run under a cell's clipping rectangle, as Word draws it. */
const cellRun = (text, x, y, clip) => ({ text, x, x1: x + text.length * 4, y, size: 9, clip });
const read = (key, layout, runs, file = {}) => ACT_BOARD_READERS[layout]({ pages: [{ runs }] }, { city: city(key), file });
const stored = (key, row) => normalisePermitListRow(city(key), row.board, scrubPermitListRow(row));
const pick = (rows, ...fields) => rows.map((row) => fields.map((field) => row[field] ?? null));

test('the act cities are in the permit registry, each with its protocol', () => {
  for (const key of KEYS) {
    assert.equal(permitListFor(city(key).insee), city(key));
    assert.equal(city(key).source.kind, 'board');
    assert.equal(typeof ACT_BOARD_PROTOCOLS[key].start, 'function');
    assert.equal(typeof ACT_BOARD_PROTOCOLS[key].index, 'function');
  }
  assert.doesNotMatch(city('oullins-pierre-benite').userAgent, /scan/, 'its firewall refuses the word « scan »');
});

// --- Oullins-Pierre-Bénite ------------------------------------------------------

/** The report's header, as the copier's OCR text gives it. */
const OULLINS_HEADER = [run('N', 35, 497), run('de dossier', 49, 497), run('Date dépôt', 136, 493), run('Demandeur', 196, 493),
  run('Lieux des travaux', 307, 493), run('Superficie', 417, 493), run('Nature des travaux', 478, 493), run('Projet', 700, 493),
  run("Date d'affichage", 35, 489)];

test('Oullins reads each row between blank bands, never its applicant, and keeps Pierre-Bénite numbers and parcels', () => {
  const runs = [
    ...OULLINS_HEADER,
    // A row of three lines, the site over its postcode and parcels.
    run('DP 069 149 26 00056', 35, 425), run('6 Impasse du Exemple', 308, 425), run('2', 444, 425),
    run('08/03/2026', 136, 421), run('MME PRIVATE PERSON', 196, 421), run('237 m', 417, 421), run('Ouvertures/terrasse', 478, 421),
    run('12/03/2026', 36, 417), run('69600', 307, 417), run('(AK 12)', 338, 417),
    // The applicant's cell ends a few points before the site's: runs, never lines.
    run('DP 069 152 24 00120', 35, 400), run('MME LONG PRIVATE NAME', 196, 396), run('Exemple 69310 (152 AL', 306, 396),
    run('M0l', 35, 396), run('Réhabilitation', 478, 396), run('08/07/2026', 35, 392), run('98, 152 AL 99)', 306, 392),
    run('-Surface plancher créée : 60 m', 700, 400),
    run('1 / 13', 731, 16),
  ];
  const rows = read('oullins-pierre-benite', 'oullins-report', runs, { board: 'filings' });
  assert.deepEqual(pick(rows, 'dossier', 'address', 'postcode', 'parcels', 'filedOn', 'postedOn', 'landArea'), [
    ['DP 069149 26 00056', '6 Impasse du Exemple', '69600', 'AK 12', '2026-03-08', '2026-03-12', '237'],
    ['DP 069152 24 00120 M01', 'Exemple', '69310', '152 AL 98, 152 AL 99', null, '2026-07-08', null],
  ]);
  assert.equal(rows[1].floorArea, '60');
  assert.doesNotMatch(JSON.stringify(rows.map((row) => scrubPermitListRow(row))), /PRIVATE|PERSON|NAME/);
  assert.deepEqual(stored('oullins-pierre-benite', rows[1]).parcelIdus.map((parcel) => parcel.idu), ['69149152AL0098', '69149152AL0099']);
});

test('Oullins takes a decision in its own words, and a stamp OCR read as noise for a signed decision', () => {
  const header = [...OULLINS_HEADER.filter((item) => !['Projet', 'Lieux des travaux', 'Superficie', 'Nature des travaux', 'Date dépôt', 'Demandeur'].includes(item.text)),
    run('Date dépôt', 126, 496), run('Demandeur', 186, 496), run('Lieux des', 287, 502), run('travaux', 286, 492), run('Superficie', 366, 496), run('Nature des travaux', 417, 496),
    run('Projet', 599, 496), run('Décision', 759, 496)];
  const runs = [
    ...header,
    run('DP 069 149 26', 35, 435), run('31 Rue Exemple', 286, 432), run('Favorable le', 760, 432),
    run('00195', 34, 427), run('28/05/2026', 126, 427), run('Ravalement', 418, 427), run('23/06/2026', 759, 424),
    run('69600', 286, 424), run('(AK 614)', 318, 424), run('30/07/2026', 35, 419),
    run('DP 069 149 26', 35, 395), run('2 Rue Exemple', 286, 392), run('Fa v ra b e e l ° 1 1', 760, 392),
    run('00197', 34, 387), run('69600', 286, 384), run('13/08/2026', 35, 379),
  ];
  const rows = read('oullins-pierre-benite', 'oullins-report', runs, { board: 'decisions' });
  assert.deepEqual(pick(rows, 'dossier', 'address', 'verdict', 'decidedOn', 'postedOn'), [
    ['DP 069149 26 00195', '31 Rue Exemple', 'Accord', '2026-06-23', '2026-07-30'],
    ['DP 069149 26 00197', '2 Rue Exemple', 'Décision signée', null, '2026-08-13'],
  ]);
  assert.equal(stored('oullins-pierre-benite', rows[0]).state, 'accorde');
});

test('Oullins finds its lists in the media library whatever the clerk named them', () => {
  assert.equal(oullinsFileBoard('https://x/app/uploads/2026/09/depots_urbanisme_2026_09_24.pdf'), 'filings');
  assert.equal(oullinsFileBoard('https://x/app/uploads/2026/07/Urba_avis_2026-07-15.pdf'), 'filings');
  assert.equal(oullinsFileBoard('https://x/app/uploads/2026/01/Liste_decisions_urbanisme_PB_07_01_2026pb.pdf'), 'decisions');
  assert.equal(oullinsFileBoard('https://x/app/uploads/2026/07/20260707_liste_deliberations_approuvees.pdf'), null);
  assert.equal(oullinsFileBoard('https://x/app/uploads/2026/05/avis_enquete_publique.pdf'), null);
  const oullins = city('oullins-pierre-benite');
  const requests = ACT_BOARD_PROTOCOLS['oullins-pierre-benite'].start(oullins, { since: '2026-08-01' });
  assert.equal(requests.length, 4);
  assert.match(requests[0].url, /\/wp-json\/wp\/v2\/media\?search=urbanisme&after=2026-08-01T00%3A00%3A00/);
  const media = [
    { date: '2026-09-24T10:00:00', source_url: 'https://www.oullinspierrebenite.fr/app/uploads/2026/09/decisions_urbanisme_2026_09_24.pdf' },
    { date: '2026-07-09T10:00:00', source_url: 'https://www.oullinspierrebenite.fr/app/uploads/2026/07/urbanisme_avis_2026-07-08.pdf' },
    { date: '2026-09-24T10:00:00', source_url: 'https://www.oullinspierrebenite.fr/app/uploads/2026/09/plan.jpg' },
  ];
  const found = ACT_BOARD_PROTOCOLS['oullins-pierre-benite'].index(oullins, media, requests[0], { since: '2026-08-01', day: '2026-10-02' });
  assert.deepEqual(found.files.map((file) => [file.board, file.published, file.ocr]), [['decisions', '2026-09-24', true]]);
  assert.deepEqual(found.next, []);
  assert.equal(ACT_BOARD_PROTOCOLS['oullins-pierre-benite'].index(oullins, { code: 'rest_forbidden' }, requests[0], { since: '2026-08-01' }), null);
  assert.equal(prefixedParcels('(AP 38, 37, 36)'), 'AP 38, AP 37, AP 36');
});

// --- L'Haÿ-les-Roses ----------------------------------------------------------------

test('L’Haÿ-les-Roses reads a decision’s number, site and verdict from its title, and names no one', () => {
  const lhay = city('lhay-les-roses');
  assert.deepEqual(lhayTitle('DP26W4061-48 rue de Fresnes-Accord', lhay), { dossier: 'DP 094038 26 W4061', address: '48 rue de Fresnes', verdict: 'Accord' });
  assert.deepEqual(lhayTitle('PC25W1047-138-140 av Henri Exemple...-Accord rectifié', lhay).address, '138-140 av Henri Exemple');
  assert.equal(lhayTitle('DP26W4063-15 ruelle de la Cosarde-Décision rectificative', lhay).verdict, 'Décision signée');
  assert.equal(lhayTitle('DP26W4070-M. PRIVATE PERSON-Refus', lhay).address, null);
  assert.equal(lhayTitle('AP26W9007 - 4 av. Exemple -refus', lhay), null, 'a sign is not a permit');
  const xml = `var doclist = "<theme name=\\"theme1\\"><subtheme name=\\"02-Urbanisme\\">`
    + `<subtheme name=\\"01-Dossiers d&apos;urbanisme en cours d&apos;instruction\\"><paper name=\\"Dossiers\\" real_date_debut=\\"25/09/2026\\" path=\\"/dossiers-en-cours.pdf\\"/></subtheme>`
    + `<subtheme name=\\"02-Actes d&apos;urbanisme délivrés\\"><subtheme name=\\"05-Déclaration préalable\\">`
    + `<paper name=\\"DP26W4061-48 rue de Fresnes-Accord\\" real_date_debut=\\"18/09/2026\\" date_debut=\\"26/09/2026\\" path=\\"/dp26w4061.pdf\\"/>`
    + `<paper name=\\"DP26W4061-48 rue de Fresnes-Accord\\" real_date_debut=\\"18/09/2026\\" date_debut=\\"18/09/2026\\" path=\\"/dp26w4061.pdf\\"/>`
    + `</subtheme><subtheme name=\\"07-Enseignes\\"><paper name=\\"AP26W9007 - 4 av. Exemple - refus\\" real_date_debut=\\"05/08/2026\\" path=\\"/ap.pdf\\"/></subtheme>`
    + `</subtheme></subtheme></theme>";`;
  const found = ACT_BOARD_PROTOCOLS['lhay-les-roses'].index(lhay, xml, {}, { since: '2026-08-01', day: '2026-10-02' });
  assert.deepEqual(found.files.map((file) => [file.board, file.layout, file.url, file.row?.dossier ?? null]), [
    ['filings', 'lhay-filings', 'https://affichage-reglemenaire.lhaylesroses.fr/content/dossiers-en-cours.pdf', null],
    ['decisions', 'lhay-decision', 'https://affichage-reglemenaire.lhaylesroses.fr/content/dp26w4061.pdf', 'DP 094038 26 W4061'],
  ]);
  assert.equal(found.files[0].rolling, true);
  assert.equal(ACT_BOARD_PROTOCOLS['lhay-les-roses'].index(lhay, '<html>login</html>', {}, { since: '2026-08-01' }), null);
});

test('L’Haÿ-les-Roses reads an arrêté’s dates and works, never its applicant’s block', () => {
  const file = { board: 'decisions', row: { board: 'decisions', dossier: 'DP 094038 26 W4061', applicant: null,
    address: '48 rue de Fresnes', postcode: '94240', verdict: 'Accord', postedOn: '2026-09-18' } };
  const runs = [
    run('NON OPPOSITION', 230, 800), run('A DECLARATION PREALABLE', 220, 790),
    run('Déposé le :', 40, 740), run('18/05/2026', 150, 740), run('DP09403826W4061', 420, 740),
    run('Par:', 40, 720), run('Monsieur PRIVATE PERSON', 150, 720),
    run('Demeurant à :', 40, 710), run('48 rue de Fresnes', 150, 710),
    run('Pour :', 40, 690), run('Clôture', 150, 690), run('Surface de plancher : 0 m2', 420, 690),
    run('Sur un terrain sis :', 40, 680), run('48 rue de Fresnes - 94240 L’HAY-LES-ROSES', 150, 680),
    run('ARTICLE 1 : ce projet n’appelle aucune opposition.', 40, 500),
    run('L’Haÿ-les-Roses, le', 300, 400), run('18 SEP. 2026', 400, 400),
  ];
  const [row] = read('lhay-les-roses', 'lhay-decision', runs, file);
  assert.deepEqual([row.dossier, row.address, row.filedOn, row.decidedOn, row.purpose, row.verdict],
    ['DP 094038 26 W4061', '48 rue de Fresnes', '2026-05-18', '2026-09-18', 'Clôture', 'Non-opposition']);
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /PRIVATE|PERSON/);
  assert.deepEqual(read('lhay-les-roses', 'lhay-decision', runs, { ...file, row: { ...file.row, dossier: 'DP 094038 26 W4062' } }), []);
});

test('L’Haÿ-les-Roses’s filings list puts each run with its nearest number, the house number before its street', () => {
  const header = [run('N° de dossier', 51, 770), run('Date de dépôt', 148, 770), run('Nom du demandeur', 245, 770),
    run('Adresse du terrain', 431, 770), run('Terrain', 606, 770), run('Caractéristiques', 770, 770),
    run('Objet de la demande', 948, 770), run('date affichage', 1096, 776)];
  const runs = [
    ...header,
    run('rue du docteur', 423, 376), run('AN 97 et AN', 564, 376), run('Remplacement de persiennes', 904, 376),
    run('DP09403826W4073', 22, 370), run('16/06/2026', 156, 370), run('PRIVATE AGENCY', 219, 370), run('22', 389, 370),
    run('Réf :', 532, 370), run('Surf :', 625, 370), run('4 265 m²', 666, 370), run('19/06/2026', 1105, 370),
    run('Exemple', 423, 365), run('98', 586, 365),
    run('DP09403826W4069', 22, 320), run('11/06/2026', 156, 320), run('Mme PRIVATE PERSON', 219, 320), run('Réf :', 532, 320),
  ];
  const rows = read('lhay-les-roses', 'lhay-filings', runs, { board: 'filings' });
  assert.deepEqual(pick(rows, 'dossier', 'address', 'parcels', 'filedOn', 'postedOn', 'landArea', 'purpose'), [
    ['DP 094038 26 W4073', '22 rue du docteur Exemple', 'AN 97, AN 98', '2026-06-16', '2026-06-19', '4265', 'Remplacement de persiennes'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|PERSON|AGENCY/);
});

// --- Limeil-Brévannes and Villeneuve-Saint-Georges: Word tables -----------------------

test('Limeil-Brévannes’s two Word tables are read by the town-list readers, never the applicant’s column', () => {
  const readList = (layout, runs, file) => TOWN_LIST_READERS[layout]({ pages: [{ runs }] }, { city: city('limeil-brevannes'), file });
  const clip = (x0, x1, y0, y1) => ({ x0, y0, x1, y1 });
  const row = (y, cells) => cells.map(([text, x0, x1, dy = 0]) => cellRun(text, x0 + 5, y + dy, clip(x0, x1, y - 30, y + 10)));
  const filings = [
    ...row(391, [['Date de dépôt', 23, 148], ['Numéro de dossier', 149, 273], ['Pétitionnaire', 274, 403],
      ['Adresse du projet', 404, 568], ['Description du projet', 569, 818]]),
    ...row(353, [['23/09/2026', 23, 148], ['DP 94044 26 C0137', 149, 273], ['Monsieur PRIVATE', 274, 403], ['PERSON', 274, 403, -13],
      ['44 Rue Exemple', 404, 568], ['94450 LIMEIL-BREVANNES', 404, 568, -13], ['Isolation', 569, 818]]),
    ...row(300, [['16/09/2026', 23, 148], ['AP 94044 26 0017', 149, 273], ['SAS EXEMPLE', 274, 403], ['10 allée Exemple', 404, 568]]),
  ];
  const rows = readList('town-filed-before', filings, { board: 'filings' });
  assert.deepEqual(pick(rows, 'dossier', 'address', 'postcode', 'filedOn', 'applicant'), [
    ['DP 094044 26 C0137', '44 Rue Exemple', '94450', '2026-09-23', null],
  ]);
  const decisions = [
    ...row(500, [['Numéro de dossier', 23, 120], ['Pétitionnaire', 121, 220], ['Décision', 221, 290], ['Date de', 291, 360],
      ['signature', 291, 360, -12], ['Nature des travaux', 361, 520], ['Adresse des travaux', 521, 700], ['Surface', 701, 760]]),
    ...row(450, [['DP 94044 26', 23, 120], ['C0124', 23, 120, -12], ['Madame PRIVATE', 121, 220], ['Favorable', 221, 290],
      ['avec', 221, 290, -12], ['prescriptions', 221, 290, -24], ['10/09/2026', 291, 360], ['Fenêtres', 361, 520],
      ['7 Rue Exemple', 521, 700], ['94450 LIMEIL-BREVANNES', 521, 700, -12], ['m²', 701, 760]]),
    ...row(380, [['DP 94044 26', 23, 120], ['C0127', 23, 120, -12], ['PRIVATE NAME', 121, 220], ['Annulation', 221, 290],
      ['11/09/2026', 291, 360], ['Portail', 361, 520], ['Limeil-Brevannes', 521, 700]]),
  ];
  const decided = readList('town-decided-until', decisions, { board: 'decisions' });
  assert.deepEqual(pick(decided, 'dossier', 'address', 'verdict', 'decidedOn', 'floorArea'), [
    ['DP 094044 26 C0124', '7 Rue Exemple', 'Favorable avec prescriptions', '2026-09-10', null],
    ['DP 094044 26 C0127', null, 'Retrait', '2026-09-11', null],
  ], 'a site that is only the town is no site, and the decision stays');
  assert.doesNotMatch(JSON.stringify([...rows, ...decided]), /PRIVATE|PERSON|NAME/);
  const html = '<a href="https://www.limeil-brevannes.fr/wp-content/uploads/2026/09/Affichage-depot-28.09.pdf">T</a>'
    + '<a href="https://www.limeil-brevannes.fr/wp-content/uploads/2026/09/Affichage-decision-28.09.pdf">T</a>';
  const limeil = city('limeil-brevannes');
  const found = ACT_BOARD_PROTOCOLS['limeil-brevannes'].index(limeil, html, { url: limeil.page }, { since: '2026-08-01', day: '2026-10-02' });
  assert.deepEqual(found.files.map((file) => [file.board, file.layout, file.published]),
    [['filings', 'town-filed-before', '2026-09-28'], ['decisions', 'town-decided-until', '2026-09-28']]);
  assert.equal(ACT_BOARD_PROTOCOLS['limeil-brevannes'].index(limeil, '<p>maintenance</p>', { url: limeil.page }, { day: '2026-10-02' }), null);
});

test('Villeneuve-Saint-Georges tells its weekly notices from its scanned extracts, and reads a number from any spelling', () => {
  const vsg = city('villeneuve-saint-georges');
  assert.equal(vsgFileDossier('DP-94078-26-00116', vsg), 'DP 094078 26 00116');
  assert.equal(vsgFileDossier('affichage-dp-2600155', vsg), 'DP 094078 26 00155');
  assert.equal(vsgFileDossier('extrait-darrete-DP26-139', vsg), 'DP 094078 26 00139');
  assert.equal(vsgFileDossier('EXTRAIT-DAFFICHAGE-DP940782600059', vsg), 'DP 094078 26 00059');
  assert.equal(vsgFileDossier('pc-25-0007-M1', vsg), 'PC 094078 25 00007 M01');
  assert.equal(vsgFileDossier('affichage-dp-147', vsg), null, 'no year, no number');
  const base = '/images/agenda/13112017/pdf/ACTES/URBANISME';
  const html = [`${base}/2026/09_SEPTEMBRE/DP-29092026.pdf`, `${base}/2026/08_AOUT/PC_11AOUT2026.pdf`,
    `${base}/2026/08_AOUT/PC-affichage-25-08-2026.pdf`, `${base}/2026/09_SEPTEMBRE/DP-94078-26-00116.pdf`,
    `${base}/2026/09_SEPTEMBRE/affichage-dp-147.pdf`, `${base}/2025/06_JUIN/DP-12062025.pdf`]
    .map((href) => `<a href="${href}">x</a>`).join('');
  const found = ACT_BOARD_PROTOCOLS['villeneuve-saint-georges'].index(vsg, html, { url: vsg.page }, { since: '2026-08-01', day: '2026-10-02' });
  assert.deepEqual(found.files.map((file) => [file.board, file.published, file.scan ?? false, file.row?.dossier ?? null]), [
    ['filings', '2026-09-29', false, null], ['filings', '2026-08-11', false, null], ['filings', '2026-08-25', false, null],
    ['decisions', '2026-09-01', true, 'DP 094078 26 00116'], ['decisions', '2026-09-01', true, null],
  ]);
});

test('Villeneuve-Saint-Georges’s extract gives its site, parcel and verdict, never the applicant or their home', () => {
  const runs = [
    run('Date de mise en ligne : 17 septembre 2026', 30, 820),
    run("EXTRAIT D'ARRETE PORTANT REFUS", 150, 760), run('DE TRAVAUX SOUMIS A DECLARATION PREALABLE', 120, 748),
    run('Par décision municipale n° DP 94078 26 00116 du M 0 SEP. 2926', 40, 700),
    run('Une autorisation de déclaration préalable a été REFUSEE à', 40, 680), run('PRIVATE PERSON', 40, 668),
    run('Domicilié (e) 11 Rue Privée', 40, 656), run('94190 Villeneuve-Saint-Georges', 40, 644),
    run('En vue de la réalisation : REMPLACEMENT DES FENETRES. CREATION D’UN PORTAIL.', 40, 620),
    run('Sur un terrain sis 40 Rue Exemple', 40, 600), run('Cadastré AO353', 40, 588),
    run('Villeneuve-Saint-Georges, le 10 SEP. 2026', 40, 560),
  ];
  const [row] = read('villeneuve-saint-georges', 'vsg-decision', runs, { board: 'decisions' });
  assert.deepEqual([row.dossier, row.address, row.parcels, row.verdict, row.decidedOn, row.postedOn, row.purpose],
    ['DP 094078 26 00116', '40 Rue Exemple', 'AO 353', 'Refus', '2026-09-10', '2026-09-17', 'REMPLACEMENT DES FENETRES.']);
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /PRIVATE|PERSON|Privée/);
  const late = runs.map((item) => (item.text.startsWith('Villeneuve-Saint-Georges, le') ? run('Villeneuve-Saint-Georges, le 10 SEP. 2076', 40, 560) : item));
  assert.equal(read('villeneuve-saint-georges', 'vsg-decision', late, { board: 'decisions' })[0].decidedOn, null, 'a stamp read as 2076 is no date');
});

test('Villeneuve-Saint-Georges reads its weekly notice cell by cell', () => {
  const clip = (x0, x1, y0, y1) => ({ x0, y0, x1, y1 });
  const head = (text, x0, x1, dy = 0) => cellRun(text, x0 + 4, 530 + dy, clip(x0, x1, 515, 552));
  const cell = (text, x0, x1, dy = 0) => cellRun(text, x0 + 4, 489 + dy, clip(x0, x1, 471, 515));
  const runs = [
    head('N° DE DOSSIER', 23, 138), head('DEMANDEUR', 138, 282), head('ADRESSE DE LA', 282, 403, 6), head('DEMANDE', 282, 403, -6),
    head('PARCELLE', 404, 481), head('DATE', 482, 559, 6), head('DEPOT', 482, 559, -6), head('NATURE DU PROJET', 560, 819),
    cell('DP 0940782600056', 23, 138), cell('SCI PRIVATE', 138, 282, 6), cell('Person', 138, 282, -6), cell('38 Rue Exemple', 282, 403),
    cell('AO354', 404, 481), cell('15/04/2026', 482, 559), cell('Changement de destination', 560, 819),
  ];
  const rows = read('villeneuve-saint-georges', 'vsg-filings', runs, { board: 'filings' });
  assert.deepEqual(pick(rows, 'dossier', 'address', 'parcels', 'filedOn', 'applicant'),
    [['DP 094078 26 00056', '38 Rue Exemple', 'AO 354', '2026-04-15', null]]);
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|Person/);
});

// --- Romainville ------------------------------------------------------------------

test('Romainville dates each arrêté by its month’s heading and reads its number from the file name', () => {
  const romainville = city('romainville');
  assert.equal(romainvilleFileDossier('Arre-te-_PC_24B0037M1_', romainville), 'PC 093063 24 B0037 M01');
  assert.equal(romainvilleFileDossier('PC-25B0039-T01_Arre-te', romainville), 'PC 093063 25 B0039 T01');
  assert.equal(romainvilleFileDossier('PC-26-41-Arre-te-refus', romainville), null, 'no letter: left to the arrêté itself');
  const doc = (name) => `<option value="https://www.ville-romainville.fr/uploads/Document/86/${name}.pdf">x</option>`;
  const html = `<p>SEPTEMBRE 2026</p><select><option value="">Sélectionnez</option>${doc('245385_058_A_2026_0519-URBA-Arre-te-_PC_26B0034_')}`
    + `${doc('247576_445_A_2026_0560-URBA-Arre-te-_AT26B0021')}${doc('248250_672_D_2026_0076')}</select>`
    + `<p>AOÛT 2026</p><select><option value="hhttps://www.ville-romainville.fr/uploads/Document/32/245963_220_A_2026_0523-URBA-Arre-te-_DP26B0096.pdf">x</option></select>`
    + `<p>JUIN 2025</p><select>${doc('206422_A_2025_0326-URBA-DP-25B0037-Arrete')}</select>`;
  const found = ACT_BOARD_PROTOCOLS.romainville.index(romainville, html, { url: romainville.page }, { since: '2026-08-01', day: '2026-10-02' });
  assert.deepEqual(found.files.map((file) => [file.published, file.row.dossier, file.scan]), [
    ['2026-09-01', 'PC 093063 26 B0034', true], ['2026-08-01', 'DP 093063 26 B0096', true],
  ]);
});

test('Romainville’s arrêté, read by OCR, gives the site on the left of its frame and the first article’s verdict', () => {
  const runs = [
    run('DECLARATION PREALABLE', 200, 800), run('Décision de non-opposition', 200, 788),
    run('Demande déposée le 22/07/2026, complétée le 21/08/2026', 40, 740), run('N° DP 093 063 26 B0092', 400, 740),
    run('Par :', 40, 720), run('|', 90, 720), run('Monsieur PRIVATE PERSON', 100, 720),
    run('Demeurant à :', 40, 708), run('| 102 rue Privée', 100, 708),
    run('Pour : | Installation d’une tonnelle', 40, 690),
    run('Sur un terrain sis | *” 102 rue Exemple', 40, 678), run('Destination : HABITATION', 400, 678),
    run('ARTICLE 1 : La déclaration préalable est ACCORDEE.', 40, 500),
  ];
  const file = { board: 'decisions', row: { dossier: 'DP 093063 26 B0092' } };
  const [row] = read('romainville', 'romainville-decision', runs, file);
  assert.deepEqual([row.dossier, row.address, row.purpose, row.filedOn, row.verdict],
    ['DP 093063 26 B0092', '102 rue Exemple', 'Installation d’une tonnelle', '2026-07-22', 'Accord']);
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /PRIVATE|PERSON|Privée/);
  assert.deepEqual(read('romainville', 'romainville-decision', runs, { board: 'decisions', row: { dossier: 'DP 093063 26 B0093' } }), []);
});
