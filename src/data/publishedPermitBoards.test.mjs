import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUBLISHED_PERMIT_PROTOCOLS as protocols, readPublishedPermitNotice } from './publishedPermitBoards.js';
import { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';
import { boardProtocol } from './permitBoards.js';
import { municipalDossier } from './municipalPermitsFeed.js';
import { normalisePermitListRow, permitListFor, scrubPermitListRow } from './permitListsFeed.js';
import { readPermitCity } from '../../scripts/lib/permitLists.mjs';

const city = (key) => BOARD_PERMIT_SOURCES.find((source) => source.key === key);
const options = { since: '2026-09-01', day: '2026-10-02' };
const notice = (lines) => ({ pages: [{ runs: lines.map((text, i) => ({ text, x: 30, x1: 300, y: 750 - i * 18, size: 8 })) }] });
const act = (title, overrides = {}) => ({ id: 123, objet: [title], type: 'arrete', datePublication: '2026-09-29',
  urlPdf: '/api/organismes/pavillonssousbois/documents/acte-123.pdf', annexes: [{ urlPdf: '/private-applicant.pdf' }], ...overrides });
const page = (actes, overrides = {}) => ({ actes, page: 1, total: actes.length, nombrePages: 1, ...overrides });

test('three additional municipalities resolve to their own registered public board', () => {
  for (const key of ['eaubonne', 'les-pavillons-sous-bois', 'sainte-luce']) {
    const c = city(key);
    assert.equal(permitListFor(c.insee), c);
    assert.equal(boardProtocol(c), protocols[c.source.protocol]);
    assert.ok(boardProtocol(c).start(c, options).length);
  }
});

test('Delibs pages past unrelated acts and selects only local planning order PDFs', () => {
  const c = city('les-pavillons-sous-bois');
  const request = protocols.delibs.start(c)[0];
  const found = protocols.delibs.index(c, page([
    act('DECLARATION PREALABLE - 12 RUE EXEMPLE - REFUS'),
    act('PERMIS DE LOUER - 12 RUE EXEMPLE - ACCORD'),
    act('Autorisation de déposer un permis de construire'),
    act("Dépôt d'un permis modificatif pour les courts de tennis"),
    act('PC 093057 26 B0001', { datePublication: '2026-08-31' }),
    act('PC 093057 26 B0001', { datePublication: '2026-10-03' }),
    act('PC 093057 26 B0001', { urlPdf: 'https://other.example/acte-123.pdf' }),
    act('PC 093057 26 B0001', { urlPdf: '/api/organismes/other/documents/acte-123.pdf' }),
  ], { total: 100, nombrePages: 5 }), request, options);
  assert.equal(found.files.length, 1);
  assert.equal(found.files[0].layout, 'published-permit-notice');
  assert.ok(found.files[0].scan);
  assert.match(found.next[0].url, /page=2&parPage=20/);
  assert.doesNotMatch(JSON.stringify(found), /PRIVATE|annexe|applicant|RUE EXEMPLE|REFUS/);
  const empty = protocols.delibs.index(c, page([act('Budget')], { total: 21, nombrePages: 2 }), request, options);
  assert.equal(empty.files.length, 0);
  assert.equal(empty.next.length, 1);
  for (const malformed of [[], {}, page([], { total: 20 }), page([], { page: 2 })]) {
    assert.equal(protocols.delibs.index(c, malformed, request, options), null);
  }
  assert.deepEqual(protocols.delibs.index(c, page([]), request, options).files, []);
});

test('Eaubonne uses its planning theme, preserves filters when paging and ignores road and ERP orders', () => {
  const c = city('eaubonne');
  const request = protocols.eaubonne.start(c, options)[0];
  const url = new URL(request.url);
  assert.equal(url.searchParams.get('theme[]'), 'urbanisme');
  assert.equal(url.searchParams.get('date_debut'), '09/2026');
  const article = (title, date = '2026-09-21') => `<article><h3>${title}</h3><time datetime="${date}"></time>
    <a href="/wp-content/uploads/2026/09/order.pdf">Order</a></article>`;
  const html = `<h2>Liste des annonces légales</h2><p class="page-posts-count">5 résultats</p>
    ${article('Non opposition à une déclaration préalable, 12 rue Exemple')}
    ${article('Réglementation de stationnement')}${article('Autorisation ERP AT 952032600013')}
    ${article('PC 952032600001', '2026-10-03')}
    <a class="next page-numbers" href="${c.page}page/2/">Next</a>
    <a class="next" href="https://other.example/page/2/">Other</a>`;
  const found = protocols.eaubonne.index(c, html, request, options);
  assert.equal(found.files.length, 1);
  assert.equal(found.files[0].published, '2026-09-21');
  assert.equal(found.next.length, 1);
  assert.equal(new URL(found.next[0].url).search, url.search);
  assert.doesNotMatch(JSON.stringify(found), /rue Exemple|Non opposition/);
  assert.equal(protocols.eaubonne.index(c, '<html>Login</html>', request, options), null);
});

test('Sainte-Luce preserves its published six-digit dossier code and INSEE coverage code separately', () => {
  const c = city('sainte-luce');
  for (const value of ['DP 972 227 26 00079', 'DP9722272600079']) {
    assert.equal(municipalDossier(value, c), 'DP 972227 26 00079');
  }
  assert.equal(municipalDossier('DP 972 228 26 00079', c), null);
  const doc = notice(['Dossier N° DP 972 227 26 00079', 'Date de dépôt : 25/08/2026',
    'Demandeur : PRIVATE PERSON', 'Demeurant à : 99 Rue Private',
    'Adresse du terrain : Petit Fond, 97228 Sainte-Luce',
    'ARTICLE 1', "Il n'est pas fait opposition à la déclaration préalable."]);
  const [row] = readPublishedPermitNotice(doc, { city: c, file: { board: 'decisions', published: '2026-09-29', asOf: options.day } });
  assert.equal(row.address, 'Petit Fond');
  assert.equal(row.dossier, 'DP 972227 26 00079');
  assert.equal(normalisePermitListRow(c, 'decisions', row).state, 'accorde');
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /PRIVATE|Private|PERSON/);
});

test('orders separate the site, parcels and works from applicants, neighbouring fields and earlier verdicts', () => {
  const c = city('les-pavillons-sous-bois');
  const doc = notice(['N° DP 093057 26 B0128', 'Demande déposée le 15/09/2026',
    'Demeurant à : 99 Rue Private', 'Pour : Installation de panneaux photovoltaïques ARRETE N° 2026-12',
    'Sur un terrain sis à : 12 Allée Exemple - D85 ZONE UC',
    'Vu un précédent avis favorable', 'ARTICLE 1 : La demande est REFUSEE.']);
  const file = { board: 'decisions', published: '2026-09-29', asOf: options.day };
  const [row] = readPublishedPermitNotice(doc, { city: c, file });
  assert.deepEqual([row.address, row.parcels, row.purpose, row.verdict],
    ['12 Allée Exemple', 'D 85', 'Installation de panneaux photovoltaïques', 'Refus']);
  assert.equal(row.applicant, null);
  assert.equal(normalisePermitListRow(c, 'decisions', row).state, 'refuse');
  for (const [site, parcels] of [['12 Rue Exemple - E11 - ZONE UC', 'E 11'],
    ['12 Rue Exemple - Zone UC', null], ['12 Rue Exemple - Ki9 — ZONE UA', null]]) {
    const document = notice(['N° DP 093057 26 B0128', `Sur un terrain sis à : ${site}`, 'ARTICLE 1 : Accord.']);
    const [item] = readPublishedPermitNotice(document, { city: c, file });
    assert.equal(item.address, '12 Rue Exemple');
    assert.equal(item.parcels, parcels);
  }
  assert.deepEqual(readPublishedPermitNotice(doc, { city: c, file: { ...file, dossier: 'DP 093057 26 B0129' } }), []);
  assert.deepEqual(readPublishedPermitNotice(notice(['Demeurant à : 99 Rue Private']),
    { city: c, file: { ...file, dossier: 'DP 093057 26 B0128' } }), []);
});

test('visitors leave scans to the daily sweep, which reads only the order and stores scrubbed rows', async () => {
  const c = city('les-pavillons-sous-bois');
  const doc = notice(['N° DP 093057 26 B0128', 'Demeurant à : 99 Rue Private',
    'Sur un terrain sis à : 12 Rue Exemple', 'ARTICLE 1 : Les travaux sont accordés.']);
  const calls = [];
  const http = { fetch: async (url) => {
    calls.push(url);
    return { ok: true, headers: { get: () => null }, json: async () => page([act('DECLARATION PREALABLE - ACCORD')]) };
  }, text: async () => JSON.stringify(page([act('DECLARATION PREALABLE - ACCORD')])),
  bytes: async () => new TextEncoder().encode('%PDF-1.4') };
  const visitor = await readPermitCity(c, http, { day: options.day });
  assert.equal(visitor.pendingOcr, 1);
  assert.equal(calls.length, 1);
  let reads = 0;
  const sweep = await readPermitCity(c, http, { day: options.day, background: true, ocr: async () => { reads++; return { document: doc }; } });
  assert.equal(reads, 1);
  assert.equal(sweep.pendingOcr, 0);
  assert.equal(sweep.incomplete, false);
  assert.equal(sweep.boards.decisions.length, 1);
  assert.doesNotMatch(JSON.stringify(sweep), /Private|PRIVATE|annexe/);
});

test('explicit certificate headings identify tacit and unopposed decisions without promoting unread orders', () => {
  const c = city('sainte-luce');
  const file = { board: 'decisions', published: '2026-09-15', asOf: options.day };
  for (const [heading, verdict] of [
    ["CERTIFICAT D'UNE DÉCLARATION PRÉALABLE TACITE", 'Accord tacite'],
    ['CERTIFICAT DE DÉCISION DE NON OPPOSITION À UNE DÉCLARATION PRÉALABLE', 'Non-opposition'],
    ['ARRÊTÉ', 'Décision signée'],
  ]) {
    const [row] = readPublishedPermitNotice(notice(['N° DP 972 227 26 00072',
      'Adresse du terrain : 12 Rue Exemple', heading, 'Vu un avis favorable.']), { city: c, file });
    assert.equal(row.verdict, verdict);
  }
});
