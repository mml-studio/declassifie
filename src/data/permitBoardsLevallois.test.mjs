import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';
import { BOARD_PROTOCOLS, BOARD_READERS } from './permitBoards.js';
import { levalloisActs, levalloisFileUrl } from './permitBoardsLevallois.js';
import { permitListFor, scrubPermitListRow } from './permitListsFeed.js';

const city = BOARD_PERMIT_SOURCES.find((item) => item.key === 'levallois');
const url = (token) => `${city.source.base}/jsp/openfile.jsp?datePub=02/10/2026&name=Acte&pdf=${token}`;
const act = (title, token, published = '2026-10-02') => ({ title, url: url(token), published });

test('Levallois registers the public urbanism board, without a robots override', () => {
  assert.equal(permitListFor('92044'), city);
  assert.equal(city.robots, undefined);
  assert.equal(city.source.publicCookieRedirect, true);
  assert.equal(city.source.ocr, true);
  const requests = BOARD_PROTOCOLS.levallois.start(city, { since: '2026-09-01', day: '2026-10-03' });
  assert.match(requests[0].url, /legal.jsp\?role=usager&date=10-2026$/);
  assert.deepEqual(requests[0].remaining, [{ year: 2026, month: 9 }]);
  assert.equal(BOARD_PROTOCOLS.levallois.index(city, '<html>Login</html>', requests[0], {}), null);
});

test('filing lists retain the newest edition of each family, and only real permit decisions', () => {
  const files = levalloisActs(city, [
    act('Liste avis de dépôt permis de construire 2026_10_02', 'pc'),
    act('LISTE_AVIS_DEPOT_PC_2026_09_15', 'old-pc', '2026-09-15'),
    act('Liste avis de dépôt déclaration préalable 2026_10_02', 'dp'),
    act('Liste avis de dépôt permis de démolir 2026_10_02', 'pd'),
    act('Non opposition à déclaration préalable n°DP92044 26 D0160', 'decision', '2026-10-01'),
    act('Non opposition à déclaration préalable n°DP92044 26 D0160', 'decision', '2026-10-01'),
    act('Autorisation de changement d’usage US 92044 26 0006', 'usage'),
    act('Certificat CU 92044 26 0012', 'certificate'),
    act('PC 92044 26 D0011', 'future', '2026-10-04'),
    act('PC 92044 26 D0010', 'old', '2026-08-01'),
    act('PC 92073 26 D0010', 'other-city'),
  ], '2026-09-01', '2026-10-03');
  assert.equal(files.length, 4);
  assert.equal(files.filter((file) => file.board === 'filings').length, 3);
  assert.equal(files[3].row.dossier, 'DP 092044 26 D0160');
  assert.equal(files[3].row.postedOn, '2026-10-01');
  assert.equal(files[3].row.decidedOn, undefined, 'publication is not a signing date');
  assert.equal(files[3].ocr, true);
  assert.doesNotMatch(JSON.stringify(files), /Acte|LISTE|usage|certificate|old-pc/);
});

test('document URLs carry the public file token, without applicant titles or arbitrary hosts', () => {
  assert.equal(levalloisFileUrl(url('abc%2Bdef%2F%3D'), city), `${city.source.base}/jsp/showFile.jsp?pdf=abc%2Bdef%2F%3D`);
  assert.equal(levalloisFileUrl('https://other.example/openfile.jsp?pdf=abc', city), null);
  assert.equal(levalloisFileUrl(`${city.source.base}/jsp/login.jsp?pdf=abc`, city), null);
});

const run = (text, x, y, x1 = x + text.length * 3) => ({ text, x, x1, y, size: 7 });
const header = [
  run('Reçu en', 60, 500), run('Mairie', 60, 490), run('Numéro de dossier', 105, 500),
  run('Demandeur', 210, 500), run('Adresse du demandeur', 340, 500),
  run('Adresse principale des', 530, 500), run('travaux', 550, 490),
  run('Nature des travaux', 640, 500), run('SdP', 750, 510), run('créée', 750, 500), run('(en m²)', 750, 490),
];

test('bottom-aligned cells keep tall works descriptions and tightly packed rows separate', () => {
  const rows = BOARD_READERS['levallois-filings']({ pages: [{ runs: [
    ...header,
    run('DP 92044 26 D0179', 105, 470), run('28/09/2026', 60, 470),
    run('PRIVATE PERSON', 210, 470), run('99 private street', 340, 470),
    run('87 Rue Example', 530, 470), run('Facade', 640, 470), run('0', 750, 470),
    run('DP 92044 26 D0178', 105, 461), run('28/09/2026', 60, 461),
    run('OTHER PRIVATE', 210, 461), run('12 applicant avenue', 340, 461),
    run('54 Rue Example', 530, 461), run('Insulation', 640, 461), run('0', 750, 461),
    run('DP 92044 26 D0177', 105, 410), run('26/09/2026', 60, 410),
    run('SCI EXAMPLE', 210, 410), run('33 applicant road', 340, 410),
    run('58 Rue Example', 530, 410), run('A long project', 640, 450),
    run('with several lines', 640, 442), run('far above its', 640, 434),
    run('bottom-aligned', 640, 426), run('dossier number', 640, 410), run('32', 750, 410),
  ] }] }, { city });
  assert.deepEqual(rows.map((row) => [row.address, row.filedOn, row.floorArea, row.purpose]), [
    ['87 Rue Example', '2026-09-28', '0', 'Facade'],
    ['54 Rue Example', '2026-09-28', '0', 'Insulation'],
    ['58 Rue Example', '2026-09-26', '32', 'A long project with several lines far above its bottom-aligned dossier number'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), /PRIVATE|applicant|private street/);
});

test('PC height never becomes floor area and an empty PD table yields no invented dossier', () => {
  const runs = [...header, run('Hauteur', 790, 500),
    run('PC 92044 24 D0024 M02', 105, 470), run('29/09/2026', 60, 470),
    run('63 Rue Example', 530, 470), run('Extension', 640, 470), run('2 278', 750, 470, 770), run('22,30', 790, 470, 805)];
  const [row] = BOARD_READERS['levallois-filings']({ pages: [{ runs }] }, { city });
  assert.equal(row.floorArea, '2278');
  assert.equal(row.dossier, 'PC 092044 24 D0024 M02');
  assert.deepEqual(BOARD_READERS['levallois-filings']({ pages: [{ runs: [...header, run('Nb de dossier', 60, 460), run('0', 100, 460)] }] }, { city }), []);
});
