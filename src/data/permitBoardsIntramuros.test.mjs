import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTRAMUROS_BOARD_PROTOCOLS, intramurosDocuments, intramurosFiles, intramurosStreet } from './permitBoardsIntramuros.js';
import { BOARD_PERMIT_SOURCES, BOARD_PROTOCOLS } from './permitBoards.js';
import { INTRAMUROS_CITIES } from './intramurosCities.js';
import { permitListFor, scrubPermitListRow } from './permitListsFeed.js';

const wormhout = BOARD_PERMIT_SOURCES.find((source) => source.key === 'intramuros-59663');
const page = (documents) => `<html><body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">${
  JSON.stringify({ props: { pageProps: { currentCity: { id: 1 }, legalDisplayDocuments: documents } } })}</script></body></html>`;
const doc = (name, published, category = 'Urbanisme', files = [{ file: 'https://files.appli-intramuros.com/legal_documents/486/a.pdf', name }]) => ({
  category_name: category, name, published_at: `${published}T10:00:00+02:00`, files,
});

test('the IntraMuros communes are in the permit registry, read by one protocol', () => {
  assert.ok(INTRAMUROS_CITIES.length >= 1);
  for (const city of BOARD_PERMIT_SOURCES.filter((source) => source.key.startsWith('intramuros-'))) {
    assert.equal(permitListFor(city.insee), city, city.key);
    assert.equal(city.source.protocol, 'intramuros');
    assert.equal(city.source.ocr, true);
    assert.match(city.page, /^https:\/\/[^/]+\/documents_administratifs$/);
    assert.doesNotMatch(city.page, /intramuros\.org/, 'IntraMuros’s own host refuses robots');
  }
  assert.equal(BOARD_PROTOCOLS.intramuros, INTRAMUROS_BOARD_PROTOCOLS.intramuros);
});

test('a title gives a numbered street from its house number on, never the name before it nor the words after', () => {
  assert.equal(intramurosStreet('DP0596632600093 PRIVATE Person 23 rue de la Taillanderie 01-10-2026'), '23 rue de la Taillanderie');
  assert.equal(intramurosStreet('DP0596632600077 Commune de Wormhout 1 avenue Leclerc arrêté favorable avec prescriptions'), '1 avenue Leclerc');
  assert.equal(intramurosStreet('DP0596632600040 PRIVATE Person 4 ruelle du Fort Rosé arrêté défavorable 03-07-2026'), '4 ruelle du Fort Rosé');
  assert.equal(intramurosStreet('PC 2 bis chemin des Prés du 12/09/2026'), '2 bis chemin des Prés');
  assert.equal(intramurosStreet('Récépissé N°DP07838226M0040 du 26/06/2026'), null);
  assert.equal(intramurosStreet('DP0596632600056 PRIVATE Person 2 Candaele Straete'), null, 'no street word, no street');
});

test('urbanism documents give one file per PDF, with the row their title gives, filing or decision', () => {
  const documents = intramurosDocuments(page([
    doc('DP0596632600093 PRIVATE Person 23 rue de la Taillanderie 01-10-2026', '2026-10-01'),
    doc('DP0596632600074 PRIVATE Person 73 allée des Fleurs arrêté favorable 29-09-2026', '2026-09-30',
      'Urbanisme', [{ file: 'https://files.appli-intramuros.com/legal_documents/486/b.pdf', name: 'DP0596632600074 PRIVATE Person 73 allée' }]),
    doc('Récépissé N°DP05966326M0040 du 26/06/2026', '2026-09-02', 'Urbanisme',
      [{ file: 'https://files.appli-intramuros.com/legal_documents/486/c.pdf', name: 'Récépissé N°DP05966326M0040 du 26/06/2026' }]),
    doc('DP0596632600011 PRIVATE Person 9 rue Vieille arrêté', '2026-06-30', 'Urbanisme',
      [{ file: 'https://files.appli-intramuros.com/legal_documents/486/d.pdf', name: 'x' }]),
    doc('Arrêté de circulation 2026-118 rue de la Gare', '2026-09-30', 'Arrêté municipal'),
    doc('DP0624002600011 PRIVATE Person 9 rue Autre', '2026-09-30', 'Urbanisme',
      [{ file: 'https://files.appli-intramuros.com/legal_documents/486/e.pdf', name: 'DP0624002600011' }]),
  ]));
  const files = intramurosFiles(wormhout, documents, '2026-08-01');
  assert.deepEqual(files.map((file) => [file.url.replace(/^.*\//, ''), file.board, file.layout, file.ocr, file.published]), [
    ['a.pdf', 'filings', 'extended-notice', true, '2026-10-01'],
    ['b.pdf', 'decisions', 'extended-notice', true, '2026-09-30'],
    ['c.pdf', 'filings', 'extended-notice', true, '2026-09-02'],
  ]);
  assert.deepEqual(files.map((file) => [file.row.dossier, file.row.address, file.row.verdict ?? null]), [
    ['DP 059663 26 00093', '23 rue de la Taillanderie', null],
    ['DP 059663 26 00074', '73 allée des Fleurs', 'Accord'],
    ['DP 059663 26 M0040', null, null],
  ]);
  assert.doesNotMatch(JSON.stringify(files.map((file) => scrubPermitListRow(file.row))), /PRIVATE|Person/);
});

test('a page with no legal board is not the board', () => {
  const protocol = INTRAMUROS_BOARD_PROTOCOLS.intramuros;
  assert.equal(protocol.index(wormhout, '<html>Accueil</html>', { url: wormhout.page }, { since: '2026-08-01' }), null);
  assert.equal(intramurosDocuments('<script id="__NEXT_DATA__">{not json</script>'), null);
  assert.deepEqual(protocol.index(wormhout, page([]), { url: wormhout.page }, { since: '2026-08-01' }), { files: [] });
  assert.deepEqual(protocol.start(wormhout), [{ url: 'https://www.ville-wormhout.fr/documents_administratifs', as: 'html' }]);
});
