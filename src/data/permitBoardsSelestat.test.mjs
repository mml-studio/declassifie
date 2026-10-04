import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSelestatRegister } from './permitBoardsSelestat.js';
import { BOARD_READERS } from './permitBoards.js';
import { PERMIT_LISTS, scrubPermitListRow } from './permitListsFeed.js';
import { postedListFiles } from './permitBoardsPostedLists.js';

const city = PERMIT_LISTS.find((item) => item.key === 'selestat');
const run = (text, x, y, width = text.length * 2.5) => ({ text, x, x1: x + width, y, size: 6 });
const page = (runs) => ({ width: 842, height: 595, runs });
const head = (board) => [run('67462 - SELESTAT', 58, 548), run('N° de dossier', 58, 502),
  run('Objet des travaux', board === 'filings' ? 477 : 455, 502),
  ...(board === 'filings' ? [run('Références cadastrales', 324, 488)] : [])];
const read = (board, pages) => readSelestatRegister({ pages }, { city, file: { board, published: '2026-09-22' } });

test('Sélestat discovers its latest two scans for background OCR, without declaring filings under review', () => {
  assert.equal(BOARD_READERS['selestat-register'], readSelestatRegister);
  assert.equal(city.underReview, undefined);
  const files = postedListFiles(city, '<a href="/old.pdf">Liste des décisions au 7 septembre 2026</a>'
    + '<a href="/filings.pdf">Liste des avis de dépôt au 22 septembre 2026</a>'
    + '<a href="/decisions.pdf">Liste des décisions au 22 septembre 2026</a>', city.page);
  assert.equal(files.length, 2);
  for (const file of files) assert.deepEqual([file.published, file.layout, file.scan, file.ocr, file.ocrPsm],
    ['2026-09-22', 'selestat-register', true, true, 6]);
});

test('a decision keeps the project, signing day and posting start, excluding the applicant and expiry', () => {
  const [row] = read('decisions', [page([...head('decisions'),
    run('DP 067 462 26M0084', 58, 470), run('28/07/2026', 58, 453), run('28/09/2026', 58, 435),
    run('PRIVATE PERSON', 158, 470), run('99 rue Private', 158, 453),
    run('1A rue du Projet', 305, 470), run('Section 14 n° 85', 305, 435),
    run('Pergola', 455, 460), run('482', 590, 452), run('12,5', 630, 452), run('9', 675, 452),
    run('Favorable avec réserve', 714, 470), run('22/07/2026', 730, 444),
  ])]);
  assert.deepEqual([row.dossier, row.address, row.decidedOn, row.postedOn, row.verdict, row.landArea, row.floorArea, row.housing],
    ['DP 067462 26 M0084', '1A rue du Projet', '2026-07-22', '2026-07-28', 'Favorable avec réserve', '482', '12.5', null]);
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /PRIVATE|Private|Section|2026-09-28/);
});

test('filings join OCR words and continue on a page without headers', () => {
  const rows = read('filings', [page([...head('filings'),
    run('DP', 58, 470), run('067', 70, 470), run('462', 84, 470), run('26', 99, 470), run('M0123', 111, 470),
    run('01/09/2026', 58, 451), run('20 rue du Projet', 324, 470), run('Réfection', 477, 465), run('26/08/2026', 728, 451),
  ]), page([run('PC 067 462 26 M0042', 58, 550), run('07/09/2026', 58, 533),
    run('3 rue du Projet', 324, 550), run('Maison', 477, 545), run('03/09/2026', 728, 533)])]);
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn]), [
    ['DP 067462 26 M0123', '20 rue du Projet', '2026-08-26'],
    ['PC 067462 26 M0042', '3 rue du Projet', '2026-09-03'],
  ]);
});

test('an unread or foreign number holds its own row, and merged posting starts withhold the preceding row', () => {
  const rows = read('decisions', [page([...head('decisions'),
    run('DP 067 462 26 M0001', 58, 470), run('28/07/2026', 58, 453), run('Projet one', 305, 470),
    // OCR missed the next number: its own posting start exposes the merged cells.
    run('28/07/2026', 58, 401), run('Must stay out', 305, 418),
    run('DP 067 462 26 MO003', 58, 367), run('28/07/2026', 58, 350), run('Unread project', 305, 367),
    run('DP 067 028 26 M0004', 58, 315), run('28/07/2026', 58, 298), run('Foreign project', 305, 315),
    run('DP 067 462 26 M0005', 58, 264), run('04/08/2026', 58, 247),
    run('8 rue du Projet', 305, 264), run('Défavorable', 730, 264), run('28/07/2026', 730, 238),
  ])]);
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.verdict]), [['DP 067462 26 M0005', '8 rue du Projet', 'Refus']]);
});

test('changed headers, orientation or municipality are withheld; future OCR dates are never repaired', () => {
  const body = [...head('decisions'), run('DP 067 462 26 M0005', 58, 470), run('04/08/2026', 58, 453),
    run('8 rue du Projet', 305, 470), run('28/07/2028', 730, 444)];
  assert.deepEqual(read('decisions', [page(body.filter((r) => !r.text.includes('Objet')))]), []);
  assert.deepEqual(read('decisions', [{ ...page(body), width: 595, height: 842 }]), []);
  assert.deepEqual(readSelestatRegister({ pages: [page(body)] }, { city: { insee: '67028' }, file: { board: 'decisions' } }), []);
  assert.equal(read('decisions', [page(body)])[0].decidedOn, null);
});
