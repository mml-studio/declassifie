import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIGILOR_A_BOARD_READERS, readLeMansList, readReimsOrder } from './permitBoardsDigilorA.js';
import { DIGILOR_TOWNS } from './digilorTowns.js';
import { BOARD_READERS } from './permitBoards.js';
import { digilorDocuments, normalisePermitListRow, permitListFor, scrubPermitListRow } from './permitListsFeed.js';

const town = (key) => DIGILOR_TOWNS.find((item) => item.key === key);
const run = (text, x, y, size = 8) => ({ text, x, x1: x + text.length * 4, y, size });
const page = (...runs) => ({ pages: [{ runs }] });
const PRIVATE = /PRIVATE|PERSON|Privée/;

test('Reims and Le Mans are Digilor towns of the permit registry, their layouts on the board readers', () => {
  for (const key of ['digilor-reims', 'digilor-le-mans']) {
    assert.equal(permitListFor(town(key).insee), town(key), key);
    assert.equal(town(key).source.kind, 'digilor');
    assert.ok(Object.isFrozen(town(key).source.shelves));
    for (const shelf of town(key).source.shelves) assert.ok(BOARD_READERS[shelf.layout] ?? shelf.layout === 'cartds-report-filings', shelf.layout);
  }
  assert.equal(BOARD_READERS['digilor-lemans-list'], DIGILOR_A_BOARD_READERS['digilor-lemans-list']);
});

test('Le Mans’s shelf gives the weekly lists by title, the road orders beside them left out', () => {
  const doc = (id, sub, title) => ({ id, id_cat: 217, id_sscat: sub, nom_affichage: title, aff_deb: '2026-09-25', url_uiid: `./upload/23/${id}.pdf` });
  const files = digilorDocuments(town('digilor-le-mans'), [
    doc(1, 328, 'Affichage_Mairie_Depot_-2026-09-25'), doc(2, 328, 'Affichage Marie Decision - DP-2026-09-25'),
    doc(3, 895, 'Arrêté 2026-VCEP-055 - Section cadastrée AY n° 53'), doc(4, 349, 'Délibération'),
  ], '2026-08-01');
  assert.deepEqual(files.map((file) => [file.url.replace(/^.*%2F/, ''), file.board, file.layout]).sort(), [
    ['1.pdf', 'filings', 'digilor-lemans-list'], ['2.pdf', 'decisions', 'digilor-lemans-list'],
  ]);
});

const LE_MANS_HEADER = [run('DOSSIER (*)', 30, 500), run('ADRESSE DU PROJET', 150, 500), run('NOM', 330, 500),
  run('DESCRIPTION DU PROJET', 520, 500), run('DIMENSIONS', 760, 500)];

test('Le Mans’s filings: a row per dossier cut on the site column, the filing day under the number, no person', () => {
  const rows = readLeMansList(page(
    run('Permis de construire, Déclarations préalables, Permis de démolir et Permis d’aménager', 200, 560),
    ...LE_MANS_HEADER,
    run('DP 72181 26 01161', 40, 480), run('24 Rue Exemple', 135, 480), run('Monsieur PRIVATE PERSON', 300, 480),
    run('Nettoyage de la façade', 470, 480), run('Surface terrain: 132 m²', 740, 480),
    run('Déposé le : 18/09/2026', 20, 470), run('Surface de plancher : 5 m²', 740, 470),
    run('PC 72181 26 00117', 40, 440), run('49 Avenue Exemple', 135, 440), run('SNCF RESEAU', 300, 440),
    run('Construction d’un bâtiment logistique', 470, 440), run('Déposé le : 31/07/2026', 20, 430),
    run('(*) PC : Permis de Construire', 30, 20),
  ), { city: town('digilor-le-mans'), file: { board: 'filings', published: '2026-09-25' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.landArea, row.floorArea, row.applicant ?? null]), [
    ['DP 072181 26 01161', '24 Rue Exemple', '2026-09-18', '132', '5', null],
    ['PC 072181 26 00117', '49 Avenue Exemple', '2026-07-31', null, null, 'SNCF RESEAU'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map((row) => scrubPermitListRow(row))), PRIVATE);
});

test('Le Mans’s decisions read the verdict and its day under the works, a pushed-off verdict a signed decision', () => {
  const rows = readLeMansList(page(
    run('Décisions concernant les Déclarations préalables', 200, 560), ...LE_MANS_HEADER,
    run('DP 72181 26 01001', 40, 470), run('3 Rue Exemple', 135, 480), run('Madame PRIVATE PERSON', 300, 480),
    run('Pose de panneaux', 470, 480), run('Décision : Favorable le 22/09/2026', 470, 470),
    run('DP 72181 26 01002', 40, 430), run('5 Rue Exemple', 135, 440), run('Ravalement', 470, 440),
  ), { city: town('digilor-le-mans'), file: { board: 'decisions', published: '2026-09-25' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.decidedOn ?? null, row.postedOn]), [
    ['DP 072181 26 01001', '2026-09-22', '2026-09-25'], ['DP 072181 26 01002', null, '2026-09-25'],
  ]);
  assert.notEqual(rows[0].verdict, 'Décision signée');
  assert.equal(rows[1].verdict, 'Décision signée');
  assert.equal(rows[0].purpose, 'Pose de panneaux');
});

test('a Reims order gives its number, the street of its site, the works and the operative verdict, never the applicant’s address', () => {
  const rows = readReimsOrder(page(
    run('N° DP 051 454 26 00812', 400, 780),
    run('Déposé le : 23/09/2026', 400, 770),
    run('Par : Monsieur PRIVATE PERSON', 50, 700),
    run('Demeurant à : 1 rue Privée 51100 REIMS', 50, 690),
    run('Pour : Ravalement de façade', 50, 680),
    run('Sur un terrain sis à : 51100 REIMS - 21 Rue Exemple - CLAIRMARAIS -', 50, 670),
    run('LE MAIRE DE REIMS', 50, 640),
    run('ARTICLE 1 : Il n’est pas fait opposition à la déclaration préalable.', 50, 600),
    run('ARTICLE 2 : La présente décision est transmise au représentant de l’État.', 50, 580),
  ), { city: town('digilor-reims'), file: { board: 'decisions', title: 'DP 051 454 26 00812', published: '2026-10-02' } });
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.deepEqual([row.dossier, row.address, row.postcode, row.purpose, row.filedOn, row.postedOn],
    ['DP 051454 26 00812', '21 Rue Exemple', '51100', 'Ravalement de façade', '2026-09-23', '2026-10-02']);
  assert.notEqual(row.verdict, 'Décision signée');
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), PRIVATE);
  assert.equal(normalisePermitListRow(town('digilor-reims'), 'decisions', scrubPermitListRow(row)).address, '21 Rue Exemple');
});

test('a Reims order with no site or no number of the town gives nothing', () => {
  const city = town('digilor-reims');
  assert.deepEqual(readReimsOrder(page(run('N° DP 051 454 26 00812', 400, 780), run('Pour : Ravalement', 50, 680)),
    { city, file: { board: 'decisions' } }), []);
  assert.deepEqual(readReimsOrder(page(run('N° DP 072 181 26 00812', 400, 780),
    run('Sur un terrain sis à : 51100 REIMS - 21 Rue Exemple', 50, 670)), { city, file: { board: 'decisions' } }), []);
  assert.deepEqual(readReimsOrder({ pages: [] }, { city, file: {} }), []);
});
