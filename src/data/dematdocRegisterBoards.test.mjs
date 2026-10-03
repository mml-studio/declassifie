import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMATDOC_REGISTER_PROTOCOLS, DEMATDOC_REGISTER_READERS, readMilleryRegister,
  readDematdocRegisterNotice } from './dematdocRegisterBoards.js';
import { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';
import { boardProtocol } from './permitBoards.js';

const city = (host) => BOARD_PERMIT_SOURCES.find((c) => c.key === `dematdoc-register-${host}`);
const options = { since: '2026-09-01', day: '2026-10-03' };
const protocol = DEMATDOC_REGISTER_PROTOCOLS['dematdoc-registers'];
const run = (text, x, y) => ({ text, x, x1: x + text.length * 3, y, size: 6 });
const doc = (runs) => ({ pages: [{ runs }] });
const file = { board: 'decisions', published: '2026-09-28', asOf: options.day, title: '' };

test('five uncovered DematDOC shelves use the shared board collector and JSON POST requests', () => {
  const cities = BOARD_PERMIT_SOURCES.filter((c) => c.source.protocol === 'dematdoc-registers');
  assert.equal(cities.length, 5);
  for (const c of cities) {
    assert.equal(boardProtocol(c), protocol);
    const [request] = protocol.start(c);
    assert.equal(request.method, 'POST');
    assert.equal(request.as, 'json');
    assert.equal(request.headers['Content-Type'], 'application/json');
    assert.equal(JSON.parse(request.body).filters.params.archive, false);
  }
});

test('register discovery keeps bounded dates, redacted same-origin PDFs and no private titles', () => {
  const c = city('chateauneufsurisere');
  const publication = (name, day = '2026-10-02', extras = {}) => ({ name, createdAt: `${day}T12:00:00Z`,
    path: '/repository/raw.pdf', values: {}, ...extras });
  const found = protocol.index(c, { documents: [
    publication('Liste des avis de dépôt', undefined, { bifferPath: '/repository/redacted.pdf' }),
    publication('Liste des décisions'), publication('Liste des décisions', '2026-08-31'),
    publication('Liste des décisions', '2026-10-04'),
    publication('Liste des décisions', undefined, { path: 'https://other.example/table.pdf' }),
    publication('Avis de dépôt DP 026084 26 00012 PRIVATE PERSON'),
    publication('Council meeting'),
  ], nextDocsIds: [7, 8] }, { page: 1 }, options);
  assert.deepEqual(found.files.map((f) => [f.board, f.layout]), [
    ['filings', 'dematdoc-report-filings'], ['decisions', 'dematdoc-report-decisions'],
    ['filings', 'dematdoc-register-notice'],
  ]);
  assert.match(found.files[0].url, /redacted\.pdf$/);
  assert.doesNotMatch(JSON.stringify(found.files), /PRIVATE|PERSON/);
  const next = protocol.index(c, { documents: [publication('Liste des décisions')], nextDocsIds: [7, 8] }, { page: 1 }, options).next;
  assert.equal(next[0].method, 'POST');
  assert.deepEqual(JSON.parse(next[0].body), [7, 8]);
  assert.equal(found.next.length, 0, 'the index already reaches beyond the collection window');
  assert.equal(protocol.index(c, { documents: [], nextDocsIds: [1] }, { page: 1 }, options).next.length, 0);
  assert.equal(protocol.index(c, { documents: [publication('Liste des décisions')], nextDocsIds: [1] }, { page: 6 }, options).next.length, 0);
  assert.equal(protocol.index(c, {}, {}, options), null);
});

function milleryTable() {
  const headers = ['REFERENCE DOSSIER', 'DEMANDE', 'DEPOT', 'DECISION', 'DEMANDEUR', 'TERRAIN',
    'PARCELLES', 'NATURE DES TRAVAUX', 'SURF.', 'SURF.', 'NB.', 'NIV.'];
  return doc([...headers.map((h, i) => run(h, 20 + 65 * i, 700)),
    run('DP 069133 26 00012', 20, 670), run('14/09/2026', 150, 670), run('PRIVATE PERSON', 280, 670),
    run('12 Rue Exemple', 345, 670), run('AB 0012', 410, 670), run('New roof', 475, 670),
    run('PC 069133 26 00013', 20, 630), run('15/09/2026', 150, 630), run('28/09/2026', 215, 630),
    run('PRIVATE ORGANIZATION', 280, 630), run('14 Rue Exemple', 345, 630), run('AB 0014', 410, 630)]);
}
test('Millery distinguishes a filing from a dated signed decision in a mixed register', () => {
  const rows = readMilleryRegister(milleryTable(), { city: city('mairie-millery'), file });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => [r.board, r.filedOn, r.decidedOn ?? null, r.verdict ?? null]), [
    ['filings', '2026-09-14', null, null], ['decisions', '2026-09-15', '2026-09-28', 'Décision signée'],
  ]);
  assert.equal(rows[0].parcels, 'AB 12');
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|PERSON|ORGANIZATION/);
  const future = milleryTable();
  future.pages[0].runs.find((r) => r.text === '28/09/2026').text = '28/10/2026';
  assert.equal(readMilleryRegister(future, { city: city('mairie-millery'), file })[1].decidedOn, null);
});

test('Vernaison adapts the project label only on its filing form and excludes the applicant address', () => {
  const document = doc([run('AVIS DE DEPOT', 40, 790), run('DP 069260 26 00012', 40, 770),
    run('Déposé le : 28/09/2026', 40, 750), run('Adresse du demandeur : 99 Rue PRIVATE', 40, 730),
    run('Adresse :', 40, 700), run('12 Rue Exemple', 40, 685)]);
  const [row] = readDematdocRegisterNotice(document, { city: city('mairie-vernaison'), file });
  assert.equal(row.board, 'filings');
  assert.equal(row.address, '12 Rue Exemple');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|demandeur/);
  assert.equal(document.pages[0].runs.find((r) => r.y === 700).text, 'Adresse :');
  document.pages[0].runs[0].text = 'ARRÊTÉ';
  assert.equal(readDematdocRegisterNotice(document, { city: city('mairie-vernaison'), file }).length, 0);
  assert.equal(typeof DEMATDOC_REGISTER_READERS['dematdoc-report-filings'], 'function');
});
