import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XDEMAT_BOARD_PROTOCOLS, XDEMAT_MAX_PAGES, readXdematPage, xdematFrameUrl } from './permitBoardsXdemat.js';
import { BOARD_PROTOCOLS, BOARD_PERMIT_SOURCES } from './permitBoards.js';
import { normalisePermitListRow, permitListFor, scrubPermitListRow } from './permitListsFeed.js';

const city = (insee) => BOARD_PERMIT_SOURCES.find((source) => source.key === `xdemat-${insee}`);
const options = { since: '2026-08-01', day: '2026-10-02' };

/** One posting as the board's HTML prints it (the JSON decodes `é` before this). */
const posting = ({ kind = 'Déclaration préalable', number, applicant = 'PRIVATE PERSON', site, works, link, posted }) => `
            <div class="padding">
                <div class="row flex-row"><div class="col">
                  <p class="color-grey-darken text-bold margin-bottom-x05">${kind}</p>
                </div><div class="col-auto">
                  <span class="color-grey margin-left-x05">N° de dossier : ${number}</span>
                </div></div>
                <p class="margin-top"><span class="text-bold">Pétitionnaire</span> :
                    <span class="text-italic">${applicant}</span></p>
                ${site === undefined ? '' : `<p class="margin-top"><span class="text-bold">Adresse du terrain</span> :
                    <span class="text-italic">${site}</span></p>`}
                <p class="margin-top"><span class="text-bold">Description du projet</span> :
                    <span class="text-italic">${works}</span></p>
                <div class="margin-top d-flex"><a href="https://opendata.spl-xdemat.fr/fichiers/panneau-affichage/T0k./Recepissededepot.pdf" target="_blank"><i class="icon-material margin-right-x05">history_edu</i>${link}</a>
                  <p class="color-grey text-italic">Publié le ${posted}</p></div>
            </div>`;

const page = (total, ...postings) => ({ etat: 'conf', total, html: postings.map(posting).join('') });

test('the SPL-Xdemat communes are in the permit registry, read by one shared protocol', () => {
  assert.equal(BOARD_PERMIT_SOURCES.filter((source) => source.key.startsWith('xdemat-')).length, 54);
  for (const source of BOARD_PERMIT_SOURCES.filter((item) => item.key.startsWith('xdemat-'))) {
    assert.equal(permitListFor(source.insee), source, source.key);
    assert.equal(source.source.kind, 'board');
    assert.equal(source.source.protocol, 'spl-xdemat');
    assert.equal(BOARD_PROTOCOLS[source.source.protocol], XDEMAT_BOARD_PROTOCOLS['spl-xdemat']);
    assert.equal(source.page, xdematFrameUrl(source.insee));
    assert.match(source.postcode, /^\d{5}$/);
  }
  assert.ok(Object.isFrozen(XDEMAT_BOARD_PROTOCOLS));
});

test('a receipt is a filing and an order a signed decision, with the number Sitadel uses and never the applicant', () => {
  const epinal = city('88160');
  const read = readXdematPage(epinal, page(416,
    { number: 'DP 088 160 2600341', site: '1 place Lagarde', works: 'Pose d&#039;une vitrophanie', link: 'Récépissé de dépôt', posted: '01/10/2026' },
    { kind: 'Demande de Permis de construire pour une maison individuelle', number: 'PC 088 160 2600010', site: '31 RUE GENERAL HENRYS',
      works: 'EXTENSION / CONSTRUCTION D’UN GARAGE ACCOLE', link: 'Arrêté de décision', posted: '26/08/2026' }));
  assert.equal(read.total, 416);
  assert.equal(read.oldest, '2026-08-26');
  assert.deepEqual(read.rows.map((row) => [row.board, row.dossier, row.address, row.postcode, row.purpose, row.postedOn, row.verdict]), [
    ['filings', 'DP 088160 26 00341', '1 place Lagarde', '88000', 'Pose d\'une vitrophanie', '2026-10-01', null],
    ['decisions', 'PC 088160 26 00010', '31 RUE GENERAL HENRYS', '88000', 'EXTENSION / CONSTRUCTION D’UN GARAGE ACCOLE', '2026-08-26', 'Décision signée'],
  ]);
  const stored = read.rows.map((row) => normalisePermitListRow(epinal, row.board, scrubPermitListRow(row)));
  assert.doesNotMatch(JSON.stringify([read.rows, stored]), /PRIVATE|PERSON/);
  assert.equal(stored[1].dossier, 'PC 088 160 26 00010', 'stored as the layer prints it');
});

test('another commune’s number, a sign and a posting with no site are told apart', () => {
  const read = readXdematPage(city('88160'), page(3,
    { number: 'DP 054 329 26 L0213', site: '19 RUE LEBRUN', works: 'Rampe', link: 'Récépissé de dépôt', posted: '29/09/2026' },
    { number: 'AP 088 160 2600001', site: '2 rue X', works: 'Enseigne', link: 'Récépissé de dépôt', posted: '29/09/2026' },
    { number: 'CU 088 160 2600612', works: 'Deux maisons', link: 'Récépissé de dépôt', posted: '28/09/2026' }));
  assert.deepEqual(read.rows.map((row) => [row.dossier, row.address ?? null, row.postcode]), [['CU 088160 26 00612', null, '88000']]);
});

test('a non-member’s answer is no board', () => {
  assert.equal(readXdematPage(city('88160'), { etat: 'err', message: 'La structure n’existe pas' }), null);
  assert.equal(readXdematPage(city('88160'), null), null);
});

test('the protocol pages newest first until the window, the last page or its cap', () => {
  const protocol = XDEMAT_BOARD_PROTOCOLS['spl-xdemat'];
  const lun = city('54329');
  const [first] = protocol.start(lun, options);
  assert.equal(first.method, 'POST');
  assert.equal(first.as, 'json');
  const body = new URLSearchParams(first.body);
  assert.deepEqual([body.get('uid'), body.get('affichage'), body.get('page'), body.get('anneeCourante')], ['MA54329', 'urbanisme', '1', '2026']);
  const fresh = page(530, { number: 'DP 054 329 26 L0249', site: 'Rue Alfred Renaudin', works: 'x', link: 'Arrêté de décision', posted: '01/10/2026' });
  const next = protocol.index(lun, fresh, first, options);
  assert.equal(next.rows.length, 1);
  assert.equal(new URLSearchParams(next.next[0].body).get('page'), '2');
  const old = page(530,
    { number: 'DP 054 329 26 L0101', site: '1 rue A', works: 'x', link: 'Récépissé de dépôt', posted: '05/08/2026' },
    { number: 'DP 054 329 26 L0100', site: '2 rue B', works: 'x', link: 'Récépissé de dépôt', posted: '28/07/2026' });
  const last = protocol.index(lun, old, next.next[0], options);
  assert.deepEqual(last.rows.map((row) => row.dossier), ['DP 054329 26 L0101'], 'a posting before the window is dropped');
  assert.deepEqual(last.next, []);
  const shortBoard = protocol.index(lun, page(1, { number: 'DP 054 329 26 L0249', site: 'x', works: 'x', link: 'Arrêté de décision', posted: '01/10/2026' }), first, options);
  assert.deepEqual(shortBoard.next, [], 'one page holds the whole board');
  const capped = { ...first, body: new URLSearchParams({ ...Object.fromEntries(body), page: String(XDEMAT_MAX_PAGES) }).toString() };
  assert.deepEqual(protocol.index(lun, fresh, capped, options).next, []);
  assert.equal(protocol.index(lun, { etat: 'err' }, first, options), null);
});
