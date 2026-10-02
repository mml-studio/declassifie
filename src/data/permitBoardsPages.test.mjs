import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE_BOARD_PROTOCOLS, PAGE_BOARD_READERS, PAGE_BOARD_TEXT,
  angletDescription, chalonsDossier, communeDossier, sglTitle,
} from './permitBoardsPages.js';
import { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';
import { normalisePermitListRow, scrubPermitListRow } from './permitListsFeed.js';

const city = (key) => BOARD_PERMIT_SOURCES.find((source) => source.key === key);
const run = (x, y, text) => ({ x, y, text });
const page = (...runs) => ({ pages: [{ runs }] });
const options = { since: '2026-08-01', day: '2026-10-02' };
const PRIVATE = /PRIVATE|PERSON/;

test('the family exports one frozen protocol per city and the readers its files name', () => {
  assert.deepEqual(Object.keys(PAGE_BOARD_PROTOCOLS).sort(),
    ['anglet', 'boulogne-sur-mer', 'chalons', 'pantin', 'saint-germain-en-laye']);
  for (const object of [PAGE_BOARD_PROTOCOLS, PAGE_BOARD_READERS, PAGE_BOARD_TEXT]) assert.ok(Object.isFrozen(object));
  for (const key of Object.keys(PAGE_BOARD_PROTOCOLS)) assert.ok(city(key), key);
});

test('Châlons numbers join Sitadel, with or without the commune code', () => {
  assert.equal(chalonsDossier('DPC 2600093'), 'DP 051108 26 00093');
  assert.equal(chalonsDossier('DPA 26 00035'), 'DP 051108 26 00035');
  assert.equal(chalonsDossier('PC 22A0040M01'), 'PC 051108 22 A0040 M01');
  assert.equal(chalonsDossier('PCMI 2600010'), 'PC 051108 26 00010');
  assert.equal(chalonsDossier('PC ERP 2600034'), 'PC 051108 26 00034');
  assert.equal(chalonsDossier('DP 0511082600160 PRIVATE PERSON'), 'DP 051108 26 00160');
  assert.equal(chalonsDossier('DP 051108 02600246'), 'DP 051108 26 00246');
  assert.equal(chalonsDossier('DP 051108 25A0357 M01'), 'DP 051108 25 A0357 M01');
  assert.equal(chalonsDossier('DPC 26000175'), 'DP 051108 26 00175');
  assert.equal(chalonsDossier('AP 2600001'), null, 'signs are no family the layer draws');
  assert.equal(chalonsDossier('DP 05510082600280'), null, 'a clerk’s slip is no number');
});

const chalonsNotices = `<form name="avis-index-form" id="avis-index-form"></form><table><tbody>
<tr><td>DPC 2600093</td><td>PRIVATE PERSON - Travaux sur construction existante - 8 rue des Jardins</td><td>Avis de dépôt</td><td>25/09/2026</td>
<td><a class='bouton icone pdf' href='/avis/avis/RFBD/NDIw'>x</a></td></tr>
<tr><td>PC 2600008</td><td>PRIVATE - PERSON - Surélévation - Clôture - 3ter rue Kellermann</td><td>Avis de dépôt</td><td>02/09/2026</td><td></td></tr>
<tr><td>DPA 2600004</td><td>VILLE DE CHÂLONS - Travaux sur construction existante - Cimetière de l&#039;Ouest, 4 bld Léon Blum</td><td>Avis de dépôt</td><td>10/08/2026</td><td></td></tr>
<tr><td>DPC 2600001</td><td>PRIVATE PERSON - Clôture - 1 rue Ancienne</td><td>Avis de dépôt</td><td>05/01/2026</td><td></td></tr>
<tr><td>AP 2600003</td><td>SHOP - Enseignes - 175 avenue des Alliés</td><td>Avis de dépôt</td><td>16/09/2026</td><td></td></tr>
</tbody></table>`;

test('Châlons notices of filing: the site and works of the title, never a name, and the PDF named', () => {
  const c = city('chalons');
  const requests = PAGE_BOARD_PROTOCOLS.chalons.start(c, options);
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /\/avis\/1\/-1\/0\/NDIwMSAgIC0yJjIwMjYmJg==\/MA==$/);
  assert.match(requests[1].url, /\/arretes\/1\/-1\/0\/NDIwMSAgIC0zNzcmMjAyNiYyJiY=\//);
  assert.equal(PAGE_BOARD_PROTOCOLS.chalons.start(c, { since: '2025-11-01', day: '2026-10-02' }).length, 4);
  const found = PAGE_BOARD_PROTOCOLS.chalons.index(c, chalonsNotices, requests[0], options);
  assert.equal(found.files.length, 1);
  assert.equal(found.files[0].url, 'https://citoyen.chalonsenchampagne.fr/avis/avis/RFBD/NDIw');
  assert.equal(found.files[0].layout, 'chalons-filings');
  const rows = [found.files[0].row, ...found.rows];
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.purpose, row.postedOn]), [
    ['DP 051108 26 00093', '8 rue des Jardins', 'Travaux sur construction existante', '2026-09-25'],
    ['PC 051108 26 00008', '3ter rue Kellermann', 'Surélévation — Clôture', '2026-09-02'],
    ['DP 051108 26 00004', '4 bld Léon Blum', 'Travaux sur construction existante', '2026-08-10'],
  ]);
  for (const row of rows) assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), PRIVATE);
  assert.equal(PAGE_BOARD_PROTOCOLS.chalons.index(c, '<html>maintenance</html>', requests[0], options), null);
});

test('Châlons orders: the number, the site after the name, a withdrawal from the title', () => {
  const c = city('chalons');
  const request = PAGE_BOARD_PROTOCOLS.chalons.start(c, options)[1];
  const html = `<form id="arretes-index-form"></form><table><tbody>
<tr><td>ARR2026VIL2110</td><td>DP 2600260 PRIVATE Person - 5 ROUTE DE TROYES</td><td>Arrêté</td><td>27/09/2026</td><td><a href='/arretes/arrete/QVJS/NDIw/Tg==/Tg=='>x</a></td></tr>
<tr><td>ARR2026VIL1803</td><td>PC 0511082600030 Monsieur et Madame PRIVATE 13 rue des Pinsons</td><td>Arrêté</td><td>17/08/2026</td><td><a href='/arretes/arrete/QVJT/NDIw/Tg==/Tg=='>x</a></td></tr>
<tr><td>ARR2026VIL2383</td><td>Arrêté de retrait DP 051108 2600038 CAC - PRIVATE PERSON Rue Yvette Lundy</td><td>Arrêté</td><td>03/09/2026</td><td></td></tr>
</tbody></table>`;
  const found = PAGE_BOARD_PROTOCOLS.chalons.index(c, html, request, options);
  const rows = [...found.files.map((file) => file.row), ...found.rows];
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.verdict, row.decidedOn]), [
    ['DP 051108 26 00260', '5 ROUTE DE TROYES', 'Décision signée', '2026-09-27'],
    ['PC 051108 26 00030', '13 rue des Pinsons', 'Décision signée', '2026-08-17'],
    ['DP 051108 26 00038', 'Rue Yvette Lundy', 'Retrait', '2026-09-03'],
  ]);
  assert.ok(found.files.every((file) => file.ocr && file.ocrPages === 2 && file.layout === 'chalons-decisions'));
  for (const row of rows) assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), PRIVATE);
  assert.equal(normalisePermitListRow(c, 'decisions', rows[2]).state, 'annule');
});

test('Châlons notices read both layouts, and only the dossier the index named', () => {
  const read = PAGE_BOARD_READERS['chalons-filings'];
  const file = { board: 'filings', row: { board: 'filings', dossier: 'DP 051108 26 00364', applicant: null, address: '31 rue Clément Marot', purpose: 'Travaux sur construction existante' } };
  const summer = page(run(26, 536, 'DP 051108 26 00364'), run(26, 511, 'Déposé le'), run(253, 511.4, '24/09/2026'),
    run(26, 485, 'Par'), run(253, 485, 'PRIVATE PERSON'), run(26, 460, 'Pour un projet de'), run(253, 460, 'Panneaux photovoltaïques'),
    run(26, 409, 'Parcelle cadastrale'), run(253, 409, 'CS 0064, CS 0065'), run(26, 383, 'Superficie du terrain'), run(253, 383, '505.00 m²'));
  const [row] = read(summer, { file });
  assert.deepEqual([row.filedOn, row.purpose, row.landArea, row.parcels], ['2026-09-24', 'Panneaux photovoltaïques', '505', 'CS 64, CS 65']);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  const spring = page(run(153, 715, "NUMERO D'ENREGISTREMENT : DP 051108 26 0364"), run(71, 690, 'Demandeur :'), run(223, 690, 'PRIVATE'),
    run(71, 654, 'Date de dépôt :'), run(213, 654, '02/01/2026'), run(71, 545, 'Surface de l’unité foncière: 1 250 m²'));
  assert.deepEqual(read(spring, { file }).map((r) => [r.filedOn, r.landArea]), [['2026-01-02', '1250']]);
  assert.deepEqual(read(page(run(26, 536, 'DP 051108 26 00365')), { file }), []);
});

test('Châlons orders: the heading’s verdict, else the first article’s, never a recital’s', () => {
  const read = PAGE_BOARD_READERS['chalons-decisions'];
  const file = (dossier) => ({ board: 'decisions', row: { board: 'decisions', dossier, applicant: null, address: '7 rue du Gantelet', verdict: 'Décision signée' } });
  const unopposed = page(run(697, 373, 'ARRÊTÉ DU MAIRE AU NOM DE LA COMMUNE PORTANT'), run(687, 354, 'NON-OPPOSITION À DÉCLARATION PRÉALABLE'),
    run(644, 223, 'DP 051108 2600260'), run(643, 436, 'déposée le 10/07/2026,'), run(571, 223, 'References cadastrales : BW17'),
    run(500, 500, 'VU l’arrêté portant refus du 3 mars 2024'));
  assert.deepEqual(read(unopposed, { file: file('DP 051108 26 00260') }).map((r) => [r.verdict, r.filedOn, r.parcels]),
    [['Non-opposition', '2026-07-10', 'BW 17']]);
  const granted = page(run(288, 711, 'PORTANT PERMIS DE CONSTRUIRE'), run(353, 666, 'PC 051108 26 00040'),
    run(71, 204, 'ARTICLE 1 : Sous réserve du droit des tiers, le permis de construire es'), run(461, 204.3, 't ACCORDÉ'));
  assert.equal(read(granted, { file: file('PC 051108 26 00040') })[0].verdict, 'Accord');
  const refused = page(run(353, 666, 'PC 051108 26 00041'), run(71, 300, 'VU l’avis favorable d’Enedis'),
    run(71, 204, 'ARTICLE 1 : Le permis de construire est'), run(71, 192, 'REFUSÉ pour les motifs suivants'));
  assert.equal(read(refused, { file: file('PC 051108 26 00041') })[0].verdict, 'Refus');
  assert.deepEqual(read({ pages: [{ runs: [] }] }, { file: file('PC 051108 26 00041') }), [], 'a scan awaits OCR');
});

test('Saint-Germain-en-Laye: a title’s outcome, site and works, never a segment before the site', () => {
  assert.deepEqual(sglTitle('Autorisation avec prescriptions - 19 rue du Parc de Noailles - Installation d&#039;une pompe à chaleur'),
    { verdict: 'Accord avec prescriptions', address: '19 rue du Parc de Noailles', purpose: 'Installation d\'une pompe à chaleur' });
  assert.deepEqual(sglTitle('Refus - 70 rue de Paris - St Germain en Laye - changement d\'enseigne'),
    { verdict: 'Refus', address: '70 rue de Paris', purpose: 'changement d\'enseigne' });
  assert.equal(sglTitle('REJET TACITE - 8 RUE DES SABLES à ST GERMAIN EN LAYE - couverture').address, '8 RUE DES SABLES');
  assert.equal(sglTitle('Annulation au 5 rue de la Paroisse - ST Germain en Laye - Enseigne').address, '5 rue de la Paroisse');
  const transfer = sglTitle('Transfert - de M. PRIVATE à Mme PERSON - 3 rue Exemple - Maison');
  assert.equal(transfer.address, '3 rue Exemple');
  assert.doesNotMatch(JSON.stringify(transfer), PRIVATE);
  const c = city('saint-germain-en-laye');
  for (const [words, state] of [['Accord avec prescriptions', 'accorde'], ['Refus', 'refuse'], ['Rejet tacite', 'refuse'],
    ['Certificat de non opposition', 'accorde'], ['Opposition', 'refuse'], ['Annulation', 'annule']]) {
    assert.equal(normalisePermitListRow(c, 'decisions', { dossier: 'DP 078551 26 00321', verdict: words }).state, state, words);
  }
});

test('Saint-Germain-en-Laye pages: rows of the window, later pages by their signed links', () => {
  const c = city('saint-germain-en-laye');
  const item = (title, number, day, href) => `<article class="files-item"><a class="link" href="${href}" target="_blank"><span class="text">
<span class="title">${title}</span> <span class="infos">Arrêtés - Urbanisme n° ${number} | Arrêtés permanents</span>
<span class="infos">Mise en ligne le ${day} à 17:21 | PDF 552.07 Ko</span></span></a></article>`;
  const html = `<div id="listingRecordResults" class="files-list">
${item('Autorisation - 21 rue Grande Fontaine - Réfection', 'DP 078 551 26 344', 'lundi 28 septembre 2026', '/fileadmin/A/DP_26-344.pdf')}
${item('Accord - 26 T rue d&#039;Hennemont - Porte', 'PC 078 551 22 Z0031M01', 'mardi 08 septembre 2026', '/fileadmin/A/PC_22.pdf')}
${item('Autorisation - 2 rue Ampère - Enseigne', 'AP 078 551 26 0027', 'lundi 28 septembre 2026', '/fileadmin/A/AP.pdf')}
</div><a href="/1507/actes.htm?page=6911-1&amp;type_acte=282&amp;cHash=aa">1</a><a href="/1507/actes.htm?page=6911-2&amp;type_acte=282&amp;cHash=bb">2</a>`;
  const found = PAGE_BOARD_PROTOCOLS['saint-germain-en-laye'].index(c, html, { url: c.page }, options);
  assert.deepEqual(found.files.map((file) => [file.row.dossier, file.row.verdict, file.row.postedOn]), [
    ['DP 078551 26 00344', 'Accord', '2026-09-28'], ['PC 078551 22 Z0031 M01', 'Accord', '2026-09-08']]);
  assert.equal(found.files[0].url, 'https://www.saintgermainenlaye.fr/fileadmin/A/DP_26-344.pdf');
  assert.deepEqual(found.next.map((request) => request.url), ['https://www.saintgermainenlaye.fr/1507/actes.htm?page=6911-2&type_acte=282&cHash=bb']);
  const old = html.replace('mardi 08 septembre 2026', 'mardi 08 juillet 2026');
  assert.deepEqual(PAGE_BOARD_PROTOCOLS['saint-germain-en-laye'].index(c, old, { url: c.page }, options).next, [], 'no page past the window');
  assert.equal(PAGE_BOARD_PROTOCOLS['saint-germain-en-laye'].index(c, '<html>login</html>', { url: c.page }, options), null);
  const read = PAGE_BOARD_READERS['sgl-decision'];
  const doc = page(run(71, 640, 'Déclaration préalable déposée le 30/07/2026'), run(443, 640, 'N° DP 078 551 26 00344'),
    run(71, 628, 'Par :'), run(186, 628, 'PRIVATE PERSON'), run(413, 606, 'Surface de plancher créée : 12,5 m²'),
    run(71, 520, 'Référence cadastrale :'), run(186, 520, 'AD016'));
  const [row] = read(doc, { file: found.files[0] });
  assert.deepEqual([row.filedOn, row.parcels, row.floorArea, row.verdict], ['2026-07-30', 'AD 16', '13', 'Accord']);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
});

test('communeDossier reads full numbers with short counters', () => {
  assert.equal(communeDossier('n° DP 078 551 26 344', city('saint-germain-en-laye')), 'DP 078551 26 00344');
  assert.equal(communeDossier('dp-062-160-26-00368-19-rue', city('boulogne-sur-mer')), 'DP 062160 26 00368');
  assert.equal(communeDossier('DP 062 106 26 00316', city('boulogne-sur-mer')), null, 'another commune’s code');
});

test('Boulogne-sur-Mer: six folders asked without the word the firewall refuses, the title’s site kept', () => {
  const c = city('boulogne-sur-mer');
  const requests = PAGE_BOARD_PROTOCOLS['boulogne-sur-mer'].start(c, options);
  assert.equal(requests.length, 6);
  assert.doesNotMatch(c.userAgent, /scan/i, 'every request to the host carries the registry\'s name');
  const html = `<table><tr class="docman_item" data-document="a"><td><a href="${c.page}avis-de-depot/declaration-prealable-1/dp-062-160-26-00368-19-rue-du-chemin-vert/?layout=file" title="x.pdf" data-title="DP 062 160 26 00368 - 19 Rue du Chemin Vert">x</a></td></tr>
<tr class="docman_item" data-document="b"><td><a href="${c.page}avis-de-depot/declaration-prealable-1/x/?layout=file" data-title="DP 062 160 26 00369 - PRIVATE PERSON">x</a></td></tr></table><div class="k-pagination"></div>`;
  const found = PAGE_BOARD_PROTOCOLS['boulogne-sur-mer'].index(c, html, requests[0], options);
  assert.deepEqual(found.files.map((file) => [file.board, file.row.dossier, file.row.address]),
    [['filings', 'DP 062160 26 00368', '19 Rue du Chemin Vert'], ['filings', 'DP 062160 26 00369', null]]);
  const orders = PAGE_BOARD_PROTOCOLS['boulogne-sur-mer'].index(c, html, requests[3], options);
  assert.equal(orders.files.length, 0, 'a folder answering another folder’s items is not that board');
  const decisions = html.replaceAll('avis-de-depot/declaration-prealable-1', 'affichage-des-arretes/declaration-prealable');
  const decided = PAGE_BOARD_PROTOCOLS['boulogne-sur-mer'].index(c, decisions, requests[3], options);
  assert.ok(decided.files.every((file) => file.scan && file.board === 'decisions' && file.row.verdict === 'Décision signée'));
  assert.equal(PAGE_BOARD_PROTOCOLS['boulogne-sur-mer'].index(c, '<h1>403 Forbidden</h1>', requests[0], options), null);
  const [row] = PAGE_BOARD_READERS['boulogne-filings'](page(run(28, 387, 'POUR AFFICHAGE LE 30/09/2026'),
    run(116, 276, 'Référence à rappeler'), run(241, 276, 'DP 062 160 26 00368'), run(119, 197, 'Déposée ou reçue le'), run(242, 197.4, '29/09/2026'),
    run(203, 161, 'Par'), run(242, 161, 'PRIVATE PERSON'), run(102, 130, 'Concernant un projet de'), run(242, 130, 'Réfection de la toiture')),
  { file: found.files[0] });
  assert.deepEqual([row.filedOn, row.postedOn, row.purpose, row.address], ['2026-09-29', '2026-09-30', 'Réfection de la toiture', '19 Rue du Chemin Vert']);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
});

test('scanned orders keep the index site and read the verdict of the first article', () => {
  const c = city('boulogne-sur-mer');
  const file = { board: 'decisions', row: { board: 'decisions', dossier: 'DP 062160 26 00306', applicant: null, address: '97 rue Exemple', postcode: '62200', verdict: 'Décision signée' } };
  const words = (y, text) => text.split(' ').map((word, i) => run(50 + i * 30, y, word));
  const doc = { pages: [{ width: 595, runs: [...words(800, 'DÉCLARATION PRÉALABLE'), ...words(780, 'N° DP 62160 26 0306 Demande déposée le 27/07/2026'),
    ...words(760, 'Par : PRIVATE PERSON'), ...words(740, 'Sur un terrain sis à 52200 BOULOGNE SUR MER'),
    ...words(500, 'ARTICLE 1 : Il n’est pas fait opposition à la déclaration préalable.'), ...words(300, 'Fait à Boulogne-sur-Mer, le 18/09/2026')] }] };
  const [row] = PAGE_BOARD_READERS['boulogne-decisions'](doc, { city: c, file });
  assert.deepEqual([row.verdict, row.filedOn, row.decidedOn, row.address, row.postcode], ['Non-opposition', '2026-07-27', '2026-09-18', '97 rue Exemple', '62200']);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  assert.deepEqual(PAGE_BOARD_READERS['boulogne-decisions'](doc, { city: c, file: { ...file, row: { ...file.row, dossier: 'DP 062160 26 00307' } } }), []);
});

test('Pantin: the Docs2Web tree its page loads, filings and orders of the window', () => {
  const c = city('pantin');
  const [request] = PAGE_BOARD_PROTOCOLS.pantin.start(c, options);
  assert.equal(request.url, 'https://www.screensoft.eu/Docs2Web/1525%20-%20VILLE%20DE%20PANTIN/params.js');
  const paper = (name, day, path) => `<paper name=\\"${name}\\" date=\\"19/11/2026\\" real_date_debut=\\"${day}\\" date_debut=\\"27/09/2026\\" path=\\"${path}\\"></paper>`;
  const script = `var xml = "<themes><theme name=\\"x\\"><subtheme name=\\"Urbanisme\\"><subtheme name=\\"Autorisations d&apos;Urbanisme\\">
<subtheme name=\\"Décision\\"><subtheme name=\\"Déclaration préalable\\">${paper('DP 093 055 26B0110_19 rue Pasteur_DECISION', '14/09/2026', '/dp-093-055-26b0110-19-rue-pasteur-decision.pdf')}</subtheme></subtheme>
<subtheme name=\\"Dépôt de demande\\"><subtheme name=\\"Permis de construire\\">${paper('PC 24B0014 T03_6-8 rue Méhul_depot', '29/09/2026', '/pc-24b0014-t03-6-8-rue-m--hul-depot.pdf')}
${paper('DP 26B0121_PRIVATE PERSON_depot', '19/09/2026', '/dp-26b0121-private-person-depot.pdf')}${paper('DP 26B0001_1 rue Ancienne', '19/01/2026', '/dp-26b0001.pdf')}</subtheme></subtheme>
</subtheme><subtheme name=\\"Arrêtés Changement Usage\\">${paper('DP 26B0130_3 rue Autre', '19/09/2026', '/x.pdf')}</subtheme></subtheme></theme></themes>";`;
  const found = PAGE_BOARD_PROTOCOLS.pantin.index(c, script, request, options);
  assert.deepEqual(found.files.map((file) => [file.board, file.row.dossier, file.row.address, file.published]), [
    ['decisions', 'DP 093055 26 B0110', '19 rue Pasteur', '2026-09-14'],
    ['filings', 'PC 093055 24 B0014 T03', '6-8 rue Méhul', '2026-09-29'],
    ['filings', 'DP 093055 26 B0121', null, '2026-09-19'],
  ]);
  assert.equal(found.files[0].url, 'https://www.screensoft.eu/Docs2Web/1525%20-%20VILLE%20DE%20PANTIN/content/dp-093-055-26b0110-19-rue-pasteur-decision.pdf');
  assert.ok(found.files[0].scan && !found.files[1].scan);
  for (const file of found.files) assert.doesNotMatch(JSON.stringify(file.row), PRIVATE);
  assert.equal(PAGE_BOARD_PROTOCOLS.pantin.index(c, 'var viewer = "yes";', request, options), null);
  const doc = page(run(275, 418, 'DATE AFFICHAGE DÉPÔT : 03/09/2026'), run(90, 375, 'Date de dépôt'), run(221, 375, 'Numéro de dossier'),
    run(385, 375, 'Pétitionnaire'), run(516, 375, 'Adresse du projet'), run(652, 375, 'Description du projet'),
    run(102, 361, '01/09/2026'), run(223, 361, 'DP 093 055 26B0121'), run(356, 361, 'PRIVATE PERSON'), run(499, 361, '69 Avenue Exemple'),
    run(643, 361, 'Travaux de ravalement de la'), run(687, 349, 'façade rue'), run(534, 336, '93500 Pantin'), run(734, 38, 'Page 1 sur 1'));
  const [row] = PAGE_BOARD_READERS['pantin-filings'](doc, { file: found.files[2] });
  assert.deepEqual([row.filedOn, row.postedOn, row.purpose], ['2026-09-01', '2026-09-03', 'Travaux de ravalement de la façade rue']);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
});

test('Anglet: a free-text description gives its number, numbered site and works, never a name', () => {
  const c = city('anglet');
  assert.deepEqual(angletDescription('Dp2600477 Private\n2bis, Rue Du Clos De L\'Ermitage\nConstruction D\'Un Mur De Clôture', c),
    { dossier: 'DP 064024 26 00477', address: '2bis Rue Du Clos De L\'Ermitage', purpose: 'Construction D\'Un Mur De Clôture', verdict: 'Décision signée' });
  assert.deepEqual(angletDescription('Dp 2600451 - Private Person - 8, Avenue De La Forêt', c),
    { dossier: 'DP 064024 26 00451', address: '8 Avenue De La Forêt', purpose: null, verdict: 'Décision signée' });
  assert.equal(angletDescription('Refus Dp 2600508 - Private Person - 16, Route Des Vignes', c).verdict, 'Refus');
  assert.equal(angletDescription('Accord Dp22b0254m01 Private\nClôture Sur Rue\n1 Rue De Girouette', c).dossier, 'DP 064024 22 B0254 M01');
  assert.equal(angletDescription('Sursis A Statuer Dp2600537 - Détachement D\'Un Lot - 51, Allée De L\'Impératrice', c).verdict, 'Sursis à statuer');
  assert.equal(angletDescription('Dp0640242600189 - Private Person - Arrete Rectificatif', c).address, null);
  assert.equal(angletDescription('Arrêté de circulation', c), null);
  for (const value of ['Dp2600477 Private\n2bis, Rue Du Clos\nConstruction', 'Dp 2600451 - Private Person - 8, Avenue De La Forêt']) {
    assert.doesNotMatch(JSON.stringify(angletDescription(value, c)), /Private|Person/);
  }
});

test('Anglet: four plain GETs, the board’s own rows, null for another page', () => {
  const c = city('anglet');
  const requests = PAGE_BOARD_PROTOCOLS.anglet.start(c, options);
  assert.deepEqual(requests.map((request) => new URL(request.url).searchParams.get('P1')), ['19', '20', '21', '28']);
  const html = `<input type=hidden name="_A13_OCC" value="2"><td id="tzzrl_1_A12">2026 / 2087</td>
<td id="zrl_1_A18" class="l-26 padding webdevclass-riche">Dp 2600451 - Private Person - 8, Avenue De La For&ecirc;t</td>
<td id="zrl_2_A18" class="l-26">Dp2600477 Private<br>2bis, Rue Du Clos<br>Construction D'Un Mur</td>`;
  const found = PAGE_BOARD_PROTOCOLS.anglet.index(c, html, requests[2], options);
  assert.deepEqual(found.rows.map((row) => [row.board, row.dossier, row.address]),
    [['decisions', 'DP 064024 26 00451', '8 Avenue De La Forêt'], ['decisions', 'DP 064024 26 00477', '2bis Rue Du Clos']]);
  for (const row of found.rows) assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /Private|Person/);
  assert.equal(PAGE_BOARD_PROTOCOLS.anglet.index(c, '<html>session expirée</html>', requests[0], options), null);
});
