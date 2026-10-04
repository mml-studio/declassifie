import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGALVIEW_BOARD_PROTOCOLS, LEGALVIEW_MAX_PAGES, legalviewOrderRow, legalviewSite } from './permitBoardsLegalview.js';
import { BOARD_PERMIT_SOURCES, BOARD_PROTOCOLS } from './permitBoards.js';
import { permitListFor } from './permitListsFeed.js';

const vienne = BOARD_PERMIT_SOURCES.find((source) => source.key === 'vienne');
const protocol = LEGALVIEW_BOARD_PROTOCOLS.legalview;
// Titles and texts shaped as Vienne posted them on 2026-10-01, names replaced.
const order = (title, ocrText = '', publishDate = '2026-10-01T08:33:36.637Z') => ({ title, ocrText, publishDate });
const PC = order(
  'A26_2132-PC 0385442610034 M. PRIVATE et Mme PRIVATE pour construction d\'une maison avec garage et piscine 52 Chemin de Charavel',
  'A26-2132 ACCORD D\'UN PERMIS DE CONSTRUIRE COMMUNE DE VIENNE DOSSIER No PC 038544 26 10034 Déposé le 24/06/2026 '
    + 'Affiché en mairie le 06/07/2026 Par Private PERSON Demeurant 68A RUE PRIVEE 38200 VIENNE Sur un 52 CHEMIN DE CHARAVEL '
    + 'terrain sis 38200 VIENNE Cadastré AH1217, AH1218 Le Maire,',
);

test('Vienne is in the permit registry, read by the LEGALView protocol', () => {
  assert.equal(permitListFor('38544'), vienne);
  assert.equal(BOARD_PROTOCOLS.legalview, protocol);
  assert.equal(protocol.start(vienne)[0].url,
    'https://www.saas-legalview.fr/api/public/legalview/org/mairie-de-vienne/theme/62cd32431fe54a22bc7c2235?page=1&limit=100');
});

test('an order gives its number, works, site, filing day and parcels, never the applicant', () => {
  const row = legalviewOrderRow(vienne, PC);
  assert.deepEqual(row, {
    board: 'decisions', dossier: 'PC 038544 26 10034', applicant: null,
    address: '52 Chemin de Charavel', postcode: '38200', parcels: 'AH 1217, AH 1218',
    purpose: 'construction d\'une maison avec garage et piscine',
    filedOn: '2026-06-24', postedOn: '2026-10-01', verdict: 'Accord',
  });
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|PRIVEE|PERSON/);
});

test('the title\'s kind says the verdict; a lapse or an extension is no order', () => {
  const verdict = (title) => legalviewOrderRow(vienne, order(title))?.verdict;
  assert.equal(verdict('A26_2137-REFUS DE DP 0385442610342 SCI EXEMPLE pour remplacement de portes de garage 2 avenue Beauséjour'), 'Refus');
  assert.equal(verdict('A26_2133-DP 0385442610282 EXEMPLE pour modification de façade 28 rue Boson'), 'Non-opposition');
  assert.equal(verdict('26_1377-ANNULATION DP 038 544 26 10206 EXEMPLE pour panneaux 3 rue Boson'), 'Retrait');
  assert.equal(verdict('A26_818\tTRANSFERT DE PC 0385442210044 T01 M. PRIVATE pour construction Chemin des Lilas'), 'Décision signée');
  assert.equal(verdict('A26_840\tREFUS DE DP 0385442610035 EXEMPLE pour ravalement 4 rue Boson'), 'Refus', 'a tab parts the act\'s number');
  assert.equal(verdict('A26_965-CADUCITE DE PA 0385442010012 Mme PRIVATE pour Lotissement de 4 lots Chemin des Vignes'), undefined);
  assert.equal(verdict('A26_821\tPROROGATION DE PC 0385442410027 EXEMPLE pour rénovation 1 rue Boson'), undefined);
  assert.equal(verdict('CR CA CCAS 22-04-2026'), undefined);
});

test('a modification keeps its step, and the original dossier\'s filing day is not its own', () => {
  const row = legalviewOrderRow(vienne, order(
    'A26_2062-PA MODIFICATIF 0385442410008 M01 EXEMPLE AMENAGEMENT pour Création d\'un lotissement de 4 lots avenue Marcellin Berthelot',
    'DOSSIER No PA 038544 24 10008 M01 Objet de la modification : Déposé le 10/07/2026 et complété le 24/07/2026',
  ));
  assert.deepEqual([row.dossier, row.verdict, row.filedOn, row.address, row.purpose],
    ['PA 038544 24 10008 M01', 'Accord', '2026-07-10', 'avenue Marcellin Berthelot', 'Création d\'un lotissement de 4 lots']);
  const original = legalviewOrderRow(vienne, order(
    'A26_1338-TRANSFERT DE PC 0385442510052 T01 EXEMPLE pour transfert total 50 Route de Grange Basse',
    'DESCRIPTION DU DOSSIER D\'ORIGINE : N° Dossier PC 038544 25 10052 ; Déposé le 14/10/2025',
  ));
  assert.equal(original.filedOn, null);
  const words = legalviewOrderRow(vienne, order('A26_2054-DP 0385442610248 EXEMPLE pour piscine 3 rue Boson',
    'DOSSIER N° DP 038544 26 10248 dossier déposé le 26, juin 2026 Pour'));
  assert.equal(words.filedOn, '2026-06-26');
});

test('the site is the title\'s last street, not the works\' words', () => {
  assert.equal(legalviewSite('Mise en place de volets roulants avec lambrequins 40 rue Vimaine').site, '40 rue Vimaine');
  assert.equal(legalviewSite('fermeture de l\'entrée du lotissement par portail et portillon 32 Boulevard des Alpes').site, '32 Boulevard des Alpes');
  assert.equal(legalviewSite('Création d\'un parc végétalisé clôture et portail et place de stationnement Route de Cancanne').site, 'Route de Cancanne');
  assert.equal(legalviewSite('réaménagement de la place Drapière').site, 'place Drapière');
  assert.equal(legalviewSite('installation 30 panneaux solaires 3 Petite Rue de la Cocarde').site, '3 Petite Rue de la Cocarde');
  assert.equal(legalviewSite('remplacement des menuiseries 33-35 rue de la Convention.').site, '33-35 rue de la Convention');
  assert.equal(legalviewSite('mise en place de volets'), null);
  assert.equal(legalviewSite('construction de 12 bâtiments avec 48 logements à Malissol'), null);
});

test('a reading pages back to the window\'s start, and a strange answer is no board', () => {
  const page = (documents, hasMore) => ({ documents, pagination: { page: 1, limit: 100, hasMore } });
  const older = order('A26_1500-DP 0385442610100 EXEMPLE pour piscine 3 rue Boson', '', '2026-07-20T09:00:00.000Z');
  const first = protocol.start(vienne)[0];
  const read = protocol.index(vienne, page([PC, older], true), first, { since: '2026-08-01', day: '2026-10-04' });
  assert.deepEqual(read.rows.map((row) => row.dossier), ['PC 038544 26 10034'], 'an order before the window is left');
  assert.deepEqual(read.next, [], 'the page reached past the window\'s start');
  const more = protocol.index(vienne, page([PC], true), first, { since: '2026-08-01', day: '2026-10-04' });
  assert.match(more.next[0].url, /\?page=2&limit=100$/);
  const last = protocol.index(vienne, page([PC], true), { ...first, page: LEGALVIEW_MAX_PAGES }, { since: '2026-08-01' });
  assert.deepEqual(last.next, []);
  assert.equal(protocol.index(vienne, { statusCode: 404 }, first, { since: '2026-08-01' }), null);
});
