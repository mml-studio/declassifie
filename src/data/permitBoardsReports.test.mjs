import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_BOARD_PROTOCOLS, REPORT_BOARD_READERS, paddedDay, reportApplicant, reportDossier,
} from './permitBoardsReports.js';
import { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';
import { normalisePermitListRow, permitListFor, scrubPermitListRow } from './permitListsFeed.js';

const city = (key) => BOARD_PERMIT_SOURCES.find((source) => source.key === key);
const KEYS = ['valence', 'arles', 'decines-charpieu', 'saint-cloud', 'tassin-la-demi-lune', 'saint-genis-laval', 'sceaux', 'pertuis'];
/** A run as `extractPdfText` gives it; `x1` an estimate unless given. */
const run = (text, x, y, { x1 = x + text.length * 4, size = 8, clip = null } = {}) => ({ text, x, x1, y, size, clip });
/** A run of a font with no widths (BIRT's): its right edge is its left. */
const bare = (text, x, y) => run(text, x, y, { x1: x, size: 7.5 });
const read = (key, layout, pages, board = 'filings') => REPORT_BOARD_READERS[layout](
  { pages: pages.map((runs) => ({ runs })) }, { city: city(key), file: { board } });
const scrubbed = (rows) => JSON.stringify(rows.map((row) => scrubPermitListRow(row)));
const stored = (key, row) => normalisePermitListRow(city(key), row.board, scrubPermitListRow(row));

test('the eight report cities are in the permit registry, each with its protocol', () => {
  for (const key of KEYS) {
    assert.equal(permitListFor(city(key).insee), city(key));
    assert.equal(city(key).source.kind, 'board');
    assert.equal(typeof REPORT_BOARD_PROTOCOLS[key].start, 'function');
    assert.equal(typeof REPORT_BOARD_PROTOCOLS[key].index, 'function');
  }
  assert.equal(city('arles').robots, 'overridden', 'Arles disallows /app/, where its sheets are');
  for (const key of ['valence', 'sceaux']) assert.doesNotMatch(city(key).userAgent, /scan/i, 'their firewall refuses « scan »');
});

test('Cart@DS\'s report gives each centred cell to its row, and keeps no private applicant', () => {
  const header = [
    run('Liste des avis de dépôt', 357, 569), run('26362 - VALENCE', 32, 554), run('Déclaration préalable', 32, 535),
    run('28/09/2026', 32, 516), run('N° de dossier', 34, 499), run('Date dépôt', 135, 495), run('Demandeur', 195, 495),
    run('Lieux des travaux', 306, 495), run('Superficie', 416, 495), run('Nature des travaux', 476, 495),
    run('Projet', 697, 495), run('Date d\'affichage', 34, 491),
  ];
  const rows = read('valence', 'cartds-report-filings', [[
    ...header,
    // A three-line site beside a one-line date, both centred on 470.
    run('DP 026 362 26 00746', 34, 474), run('31/08/2026', 34, 466), run('25/08/2026', 135, 470),
    run('MME PRIVATE', 195, 474), run('PERSON', 195, 466), run('5 Avenue Exemple de', 306, 478),
    run('Exemple 26000', 306, 470), run('(AS 103)', 306, 462), run('557 m²', 416, 470), run('ABRI DE JARDIN', 476, 470),
    run('- Surface plancher créée : 12,5 m²', 697, 470),
    run('DP 026 362 26 00747', 34, 444), run('01/09/2026', 34, 436), run('01/09/2026', 135, 440),
    run('SYNDIC DE', 195, 448), run('COPROPRIETE EXEMPLE', 195, 440), run('M. PRIVATE PERSON', 195, 432),
    run('9 rue Exemple 26000', 306, 444), run('(BI 12, BI 13)', 306, 436), run('CLOTURE', 476, 440),
    run('1 / 18', 727, 17),
  ]]);
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.postcode, row.parcels, row.filedOn, row.postedOn,
    row.landArea, row.floorArea, row.purpose, row.applicant]), [
    ['DP 026362 26 00746', '5 Avenue Exemple de Exemple', '26000', 'AS 103', '2026-08-25', '2026-08-31', '557', '12,5', 'ABRI DE JARDIN', null],
    ['DP 026362 26 00747', '9 rue Exemple', '26000', 'BI 12, BI 13', '2026-09-01', '2026-09-01', null, null, 'CLOTURE', 'SYNDIC DE COPROPRIETE EXEMPLE'],
  ]);
  assert.doesNotMatch(scrubbed(rows), /PRIVATE|PERSON|VALENCE|Liste/);
  const [decided] = read('valence', 'cartds-report-decisions', [[
    run('N° de dossier', 34, 499), run('Lieux des', 286, 499), run('Date dépôt', 125, 495), run('Demandeur', 185, 495),
    run('Superficie', 366, 495), run('Nature des travaux', 416, 495), run('Projet', 597, 495), run('Décision', 757, 495),
    run('Date d\'affichage', 34, 491), run('travaux', 286, 491),
    // The number wraps in the narrower column of decisions.
    run('DP 026 362 24', 34, 474), run('00060 M01', 34, 466), run('21/09/2026', 34, 457), run('19/05/2026', 125, 466),
    run('MME PRIVATE', 185, 469), run('63 ALLÉE EXEMPLE', 286, 474), run('26000', 286, 466), run('(ZO 170)', 286, 457),
    run('Favorable', 757, 474), run('tacite le', 757, 466), run('10/09/2026', 757, 457),
  ]], 'decisions');
  assert.deepEqual([decided.dossier, decided.address, decided.verdict, decided.decidedOn, decided.postedOn, decided.filedOn],
    ['DP 026362 24 00060 M01', '63 ALLÉE EXEMPLE', 'Accord tacite', '2026-09-10', '2026-09-21', '2026-05-19']);
  assert.equal(stored('valence', decided).state, 'accorde');
});

test('Arles reads a section a week, centred cells, and a sign\'s number keeps its own cells', () => {
  const centred = (text, centre, y, size = 5) => run(text, centre - text.length * 1.3, y, { x1: centre + text.length * 1.3, size });
  const rows = read('arles', 'arles-filings', [[
    run('Feuille1', 91.5, 537), centred('Dossiers déposés du 14 au 20 septembre 2026', 171, 482),
    centred('Date de Dépôt', 139.6, 472), centred('Numéro de dossier', 230.6, 472), centred('Pétitionnaire', 329.6, 472),
    centred('Adresse du projet', 428, 472), centred('Description du projet', 568.8, 472),
    centred('DECLARATION PREALABLE', 379.4, 461),
    centred('28/06/26', 139.5, 433), centred('DP 013004 26 R0479', 230.7, 433), centred('Madame PRIVATE PERSON', 329.7, 433),
    centred('48 Rue Exemple', 428, 436), centred('13200 ARLES', 428, 430.4),
    centred('Reprise des désordres', 569, 444), centred('du ravalement et', 569, 438.5), centred('des huisseries', 569, 433),
    centred('de la façade', 569, 427.5), centred('sur rue', 569, 422),
    centred('DP 013004 26 R002', 230.7, 401), centred('Enseigne', 569, 401), centred('2 Rue du Commerce', 428, 401),
    centred('29/06/26', 139.5, 370), centred('DP 013004 26 R0480', 230.7, 370), centred('PRIVATE Person', 329.7, 373),
    centred('EXEMPLE SARL', 329.7, 367.5), centred('12 Rue Exemple', 428, 373), centred('13200 ARLES', 428, 367.5),
    centred('Réfection des enduits', 569, 370),
    // The first quarter of 2026 spreads a two-line cell over a taller row:
    // neither line spans the row's centre.
    centred('05/01/26', 139.5, 340), centred('DP 013004 26 R0481', 230.7, 340), centred('13 Rue Exemple', 428, 346),
    centred('13200 ARLES', 428, 335), centred('Clôture', 569, 340), run('Page 1', 92, 57),
  ]]);
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.postcode, row.filedOn, row.purpose, row.applicant]), [
    ['DP 013004 26 R0479', '48 Rue Exemple', '13200', '2026-06-28',
      'Reprise des désordres du ravalement et des huisseries de la façade sur rue', null],
    ['DP 013004 26 R0480', '12 Rue Exemple', '13200', '2026-06-29', 'Réfection des enduits', 'EXEMPLE SARL'],
    ['DP 013004 26 R0481', '13 Rue Exemple', '13200', '2026-01-05', 'Clôture', null],
  ]);
  assert.doesNotMatch(scrubbed(rows), /PRIVATE|PERSON|Enseigne|Commerce|Dossiers|DECLARATION/);
});

test('BIRT\'s report centres a row on its tallest cell, even when it starts nearer the row above', () => {
  const header = [
    bare('Liste des avis de dépôt pour la commune de Saint-Genis-Laval', 340, 569), bare('Déclaration préalable', 32.4, 549),
    bare('Date', 130.1, 533), bare('Réf.', 418, 533), bare('Superficie', 660.5, 533), bare('Surface', 710.9, 533),
    bare('N° de dossier', 31.6, 529), bare('Demandeur', 175.5, 529), bare('Lieu des travaux', 296.8, 529),
    bare('Objet des travaux', 478.6, 529), bare('Date dépôt', 761.3, 529), bare('d\'affichage', 130.1, 524),
    bare('cadastrales', 418, 524), bare('du', 660.5, 524), bare('terrain', 671.7, 524), bare('plancher', 710.9, 524),
  ];
  const purpose = Array.from({ length: 12 }, (unused, i) => bare(`ligne ${i + 1}`, 478.6, 483 - 8.5 * i));
  const rows = read('saint-genis-laval', 'birt-filings', [[
    ...header,
    bare('DP 069 204 23 00020 T01', 31.6, 510.4), bare('12/03/2026', 130.1, 510.4), bare('Indéfini', 175.5, 510.4),
    bare('57 ROUTE EXEMPLE', 296.8, 510.4), bare('BK 119', 418, 510.4), bare('Pose de panneaux', 478.6, 510.4),
    bare('56610', 660.5, 510.4), bare('2 juin 2025', 761.3, 510.4),
    // Its first line is 27 points under the row above, 47 over its own number.
    ...purpose, bare('DP 069 204 24 00241 M02', 31.6, 436.25), bare('Monsieur PRIVATE PERSON', 175.5, 436.25),
    bare('9008 CHE EXEMPLE', 296.8, 436.25), bare('CN 25', 418, 436.25), bare('1205', 660.5, 436.25),
    bare('19 mars 2026', 761.3, 436.25),
  ]]);
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.parcels, row.filedOn, row.postedOn, row.landArea, row.purpose]), [
    ['DP 069204 23 00020 T01', '57 ROUTE EXEMPLE', 'BK 119', '2025-06-02', '2026-03-12', '56610', 'Pose de panneaux'],
    ['DP 069204 24 00241 M02', '9008 CHE EXEMPLE', 'CN 25', '2026-03-19', null, '1205', purpose.map((item) => item.text).join(' ')],
  ]);
  assert.doesNotMatch(scrubbed(rows), /PRIVATE|PERSON|Indéfini/);
});

test('a row the page breaks keeps what the next page prints of it above its first row', () => {
  const header = (y) => [bare('Nom de dossier', 47, y), bare('Date d\'affichage', 139, y), bare('Demandeur', 258, y),
    bare('Adresse des travaux', 378, y), bare('Description des travaux', 497, y), bare('Surface du', 601, y),
    bare('Surface de', 658, y), bare('Nb de', 713, y), bare('Décision', 762, y)];
  const rows = read('saint-genis-laval', 'birt-decisions', [
    [...header(534), bare('DP 069 204 26 00208', 32, 194), bare('Madame PRIVATE PERSON', 217, 198),
      bare('Favorable avec', 751, 203), bare('réserve', 766, 194), bare('16 juil. 2026', 758, 185)],
    [...header(534), bare('DP', 30, 510), bare('12 rue Exemple', 346, 496), bare('Abri de jardin', 488, 496),
      bare('Clôture', 488, 487), bare('DP 069 204 26 00209', 32, 440), bare('3 rue Exemple', 346, 440),
      bare('Piscine', 488, 440), bare('Refus', 766, 444), bare('17 juil. 2026', 758, 436)],
  ], 'decisions');
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.purpose, row.verdict, row.decidedOn]), [
    ['DP 069204 26 00208', '12 rue Exemple', 'Abri de jardin Clôture', 'Favorable avec réserve', '2026-07-16'],
    ['DP 069204 26 00209', '3 rue Exemple', 'Piscine', 'Refus', '2026-07-17'],
  ]);
  assert.doesNotMatch(scrubbed(rows), /PRIVATE|PERSON/);
});

test('Pertuis hangs cells from the row\'s top, keeps a company named under a person, never the person', () => {
  const header = (shift, top) => [
    run('Date de', 42 - shift, top), run('Numéro', 94 - shift, top), run('Référence', 459 - shift, top),
    run('Pétitionnaire', 190 - shift, top - 6), run('Adresse du projet', 335 - shift, top - 6),
    run('Description du projet', 631 - shift, top - 6), run('dépôt', 45 - shift, top - 11), run('de dossier', 90 - shift, top - 11),
    run('cadastrale', 459 - shift, top - 11),
  ];
  const rows = read('pertuis', 'pertuis-filings', [[
    run('Dossiers déposés avant le 29 septembre 2026', 289, 1072), ...header(0, 1047),
    run('DECLARATION PREALABLE - CONSTRUCTIONS ET TRAVAUX NON SOUMIS A PERMIS DE CONSTRUIRE', 28, 867),
    run('29/07/2026', 34, 754), run('DP 84089', 89, 754), run('26 H0230', 89, 743), run('Monsieur PRIVATE PERSON', 139, 754),
    run('447 Rue Exemple', 300, 754), run('84120 PERTUIS', 300, 743), run('AV13', 446, 754),
    run('Construction d\'une extension', 520, 754),
    run('30/07/2026', 34, 731), run('DP 84089', 89, 731), run('26 H0234', 89, 721), run('PRIVATE PERSON', 141, 731),
    run('EDF solutions solaires', 139, 721), run('QUARTIER EXEMPLE', 300, 731), run('84120 PERTUIS', 300, 721),
    run('BI138, BI142,', 446, 731), run('BI146', 446, 721), run('Panneaux', 520, 731),
  ], [
    // The second page sets its headers six points left of the first's.
    ...header(6, 1153), run('22/09/2026', 34, 1119), run('DP 84089', 89, 1119), run('26 H0281', 89, 1108),
    run('524 Rue Exemple', 300, 1119), run('84120 Pertuis', 300, 1108), run('AY615', 446, 1119), run('Solaire', 520, 1119),
  ]]);
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.postcode, row.parcels, row.filedOn, row.purpose, row.applicant]), [
    ['DP 084089 26 H0230', '447 Rue Exemple', '84120', 'AV 13', '2026-07-29', 'Construction d\'une extension', null],
    ['DP 084089 26 H0234', 'QUARTIER EXEMPLE', '84120', 'BI 138, BI 142, BI 146', '2026-07-30', 'Panneaux', 'EDF solutions solaires'],
    ['DP 084089 26 H0281', '524 Rue Exemple', '84120', 'AY 615', '2026-09-22', 'Solaire', null],
  ]);
  assert.doesNotMatch(scrubbed(rows), /PRIVATE|PERSON|DECLARATION/);
});

test('Tassin knows a verdict by its words, and a dossier with none is still under review', () => {
  const span = (text, x, x1, y, size = 7.2) => run(text, x, y, { x1, size });
  const rows = read('tassin-la-demi-lune', 'tassin', [[
    span('DECLARATIONS PREALABLES DEPOSEES / DELIVREES / AFFICHEES', 16.6, 355.7, 568.7),
    span('Mise à jour le 28/09/2026', 501.4, 584.9, 569.8),
    span('N°Dossier', 16.2, 50.6, 544.8), span('Date Dépôt', 127.2, 165.1, 544.8), span('Demandeur', 173.3, 212.8, 544.8),
    span('Nat. Projet', 280.3, 314.1, 544.9), span('Adress. Projet', 389.9, 438.3, 544.8), span('Date déliv.', 616.1, 650.1, 544.9),
    span('date d\'affichage', 668.4, 720.6, 549.4), span('de la demande', 669.9, 717.1, 540.4),
    span('dates d\'affichage de la', 735.6, 809, 549.8), span('décision', 758.3, 784.5, 540.8), span('2026', 328.3, 350.8, 521.3),
    span('DP 069 244 26 00084', 16.2, 85.8, 506.3), span('26/03/2026', 127.2, 163, 506.3), span('PRIVATE PERSON', 173.3, 227, 506),
    span('Modifications des menuiseries,', 280.3, 379.9, 510.7), span('des façades', 280.3, 318.9, 501.8),
    span('76 Avenue Exemple', 389.9, 490.3, 506), span('NON-OPPOSITION', 501.4, 564.6, 506.3),
    span('18/08/2026', 615.5, 651.3, 506.3), span('30/03/2026', 676.5, 712.3, 506.3),
    span('18/08/2026', 730.3, 766.1, 506.4), span('18/10/2026', 778.3, 814.1, 506.4),
    span('PC 069 244 26 000016', 16.2, 89, 482), span('07/07/2026', 127.2, 163, 482), span('SCI EXEMPLE', 173.3, 220, 482),
    span('Abattage de deux arbres', 280.3, 360, 482), span('8 Avenue Exemple', 389.9, 470, 482),
    span('en cours d\'instruction', 501.4, 570, 482), span('20/07/2026', 676.5, 712.3, 482),
  ]]);
  assert.deepEqual(rows.map((row) => [row.board, row.dossier, row.address, row.filedOn, row.verdict, row.decidedOn, row.postedOn, row.applicant]), [
    ['decisions', 'DP 069244 26 00084', '76 Avenue Exemple', '2026-03-26', 'Non-opposition', '2026-08-18', '2026-08-18', null],
    ['filings', 'PC 069244 26 00016', '8 Avenue Exemple', '2026-07-07', null, null, null, 'SCI EXEMPLE'],
  ]);
  assert.equal(rows[0].purpose, 'Modifications des menuiseries, des façades');
  assert.doesNotMatch(scrubbed(rows), /PRIVATE|PERSON/);
});

test('Saint-Cloud\'s clipped cells: a six-digit counter, a bare M1 and unpadded days', () => {
  const cell = (text, x0, x1, y, y0, y1) => run(text, x0 + 5, y, { size: 10, clip: { x0, y0, x1, y1 } });
  const decided = read('saint-cloud', 'saint-cloud-decisions', [[
    run('Permis de construire – Permis d’aménager – Permis de démolir', 180, 471, { clip: { x0: 0, y0: 0, x1: 842, y1: 595 } }),
    cell('Numéro de dossier', 29, 139, 420, 407, 429), cell('Décision', 139, 214, 420, 407, 429),
    cell('Date de', 214, 294, 420, 407, 429), cell('signature', 214, 294, 409, 407, 429),
    cell('Nature des travaux', 294, 617, 420, 407, 429), cell('Adresse des travaux', 617, 822, 420, 407, 429),
    cell('PC 92064 24 00014', 29, 139, 361, 347, 370), cell('M1', 29, 139, 349, 347, 370),
    cell('Accord avec', 139, 214, 361, 347, 370), cell('prescriptions', 139, 214, 349, 347, 370),
    cell('16/9/2026', 214, 294, 361, 347, 370), cell('Construction d’un immeuble', 294, 617, 361, 347, 370),
    cell('35-37, avenue Exemple', 617, 822, 361, 347, 370),
  ]], 'decisions');
  assert.deepEqual(decided.map((row) => [row.dossier, row.verdict, row.decidedOn, row.address, row.purpose]), [
    ['PC 092064 24 00014 M01', 'Accord avec prescriptions', '2026-09-16', '35-37, avenue Exemple', 'Construction d’un immeuble'],
  ]);
  const filed = read('saint-cloud', 'saint-cloud-filings', [[
    cell('Date de dépôt', 29, 154, 400, 390, 410), cell('Numéro de dossier', 154, 279, 400, 390, 410),
    cell('Adresse du projet', 279, 444, 400, 390, 410), cell('Description du projet', 444, 822, 400, 390, 410),
    cell('23/9/2026', 29, 154, 371, 362, 380), cell('DP 92064 26 000199', 154, 279, 371, 362, 380),
    cell('7, rue Exemple', 279, 444, 371, 362, 380), cell('Devanture', 444, 822, 371, 362, 380),
  ]]);
  assert.deepEqual(filed.map((row) => [row.dossier, row.filedOn, row.address]), [['DP 092064 26 00199', '2026-09-23', '7, rue Exemple']]);
});

test('Sceaux\'s columns are read off its rows, and each line goes to the row it is centred on', () => {
  const at = (y) => (text, x) => run(text, x, y, { size: 10.9 });
  const rows = read('sceaux', 'sceaux', [[
    // July 2026's header: typed anew, glued, over four lines.
    run('Dossiers décidés en juillet 2026', 52.8, 529.7, { size: 10.9 }), run('Dernière', 623, 501), run('Dernière', 706, 493),
    run('décision - Avis de', 603, 486), run('Dossier', 100, 479), run('DOSSIERADRESSE', 230, 479),
    run('Description du projet', 432, 479), run('décision - Date', 692, 479), run('l\'autorité', 622, 471),
    run('de signature', 698, 464), run('compétente', 615, 457),
    ...[['DP 092071 26 00071', 52.8], ['16 avenue Exemple', 176.5], ['Store banne', 340], ['Rejet tacite', 584.1], ['22/09/2026', 709.4]].map(([t, x]) => at(414.6)(t, x)),
    at(400)('Réhabilitation thermique d\'un immeuble', 340),
    ...[['DP 092071 26 00074', 52.8], ['26 avenue Exemple', 176.5], ['Favorable avec prescriptions', 546], ['25/09/2026', 709.4]].map(([t, x]) => at(393)(t, x)),
    at(386)('collectif', 340),
    ...[['DP 092071 26 00084', 52.8], ['21 bis rue Exemple', 176.5], ['Pompe a chaleur', 340], ['Favorable', 587.4], ['24/09/2026', 709.4]].map(([t, x]) => at(371)(t, x)),
  ]], 'decisions');
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.purpose, row.verdict, row.decidedOn]), [
    ['DP 092071 26 00071', '16 avenue Exemple', 'Store banne', 'Rejet tacite', '2026-09-22'],
    ['DP 092071 26 00074', '26 avenue Exemple', 'Réhabilitation thermique d\'un immeuble collectif', 'Favorable avec prescriptions', '2026-09-25'],
    ['DP 092071 26 00084', '21 bis rue Exemple', 'Pompe a chaleur', 'Accord', '2026-09-24'],
  ]);
  assert.equal(stored('sceaux', rows[0]).state, 'refuse', 'a tacit rejection is a refusal');
});

test('applicants, numbers and days are read as the lists print them', () => {
  assert.equal(reportApplicant(['Office notarial de', 'Ville-Exemple- Mme PRIVATE', 'PERSON'], { wrapped: true }), 'Office notarial de Ville-Exemple');
  assert.equal(reportApplicant(['PRIVATE PERSON', 'EDF solutions solaires']), 'EDF solutions solaires');
  assert.equal(reportApplicant(['PRIVATE PERSON', 'EDF solutions solaires'], { wrapped: true }), null,
    'two names joined are never kept: the person would come with the company');
  assert.equal(reportApplicant(['M PRIVATE PERSON', 'OTHER PERSON'], { wrapped: true }), null);
  assert.equal(reportApplicant(['SYNDIC DE', 'COPROPRIETE EXEMPLE'], { wrapped: true }), 'SYNDIC DE COPROPRIETE EXEMPLE');
  assert.equal(reportApplicant(['GROUPE EXEMPLE (M. PRIVATE PERSON)']), 'GROUPE EXEMPLE');
  assert.equal(reportApplicant(['Indéfini']), null);
  assert.equal(reportDossier('DP 92064 26 000199', city('saint-cloud')), 'DP 092064 26 00199');
  assert.equal(reportDossier('PC 92064 23 00031 M1', city('saint-cloud')), 'PC 092064 23 00031 M01');
  assert.equal(reportDossier('DP 026 362 24 00060 M01 21/09/2026', city('valence')), 'DP 026362 24 00060 M01');
  assert.equal(reportDossier('DP 013004 26 R002', city('arles')), null, 'a sign\'s three-digit counter is no permit');
  assert.equal(paddedDay('23/9/2026'), '2026-09-23');
  assert.equal(paddedDay('28/06/26'), '2026-06-28');
  assert.equal(paddedDay('8 nov. 2024'), '2024-11-08');
});

test('Valence, Décines, Saint-Genis-Laval and Pertuis read both files or none', () => {
  const index = (key, html, url = city(key).page) => REPORT_BOARD_PROTOCOLS[key].index(city(key), html, { url }, { day: '2026-10-02' });
  const valence = index('valence', `<a href="https://www.valence.fr/app/uploads/1/2026/09/Liste-des-avis-de-depot-28_09_2026.pdf">Dépôts</a>
    <a href="https://www.valence.fr/app/uploads/1/2026/09/Liste-des-decisions-28_09_2026.pdf">Décisions</a>`);
  assert.deepEqual(valence.files.map((file) => [file.board, file.layout, file.published]), [
    ['filings', 'cartds-report-filings', '2026-09-28'], ['decisions', 'cartds-report-decisions', '2026-09-28'],
  ]);
  assert.equal(index('valence', '<a href="/app/uploads/1/2026/09/Liste-des-decisions-28_09_2026.pdf">x</a>'), null);
  const decines = index('decines-charpieu', `<a href="/cms_viewFile.php?idtf=16837&amp;path=Liste-des-avis-de-depots.pdf" class="document">Liste des avis de dépôts</a>
    <a href="/cms_viewFile.php?idtf=16838&amp;path=Liste-des-decisions.pdf" class="document">Liste des décisions</a>`);
  assert.deepEqual(decines.files.map((file) => [file.board, file.rolling, file.url]), [
    ['filings', true, 'https://www.decines-charpieu.fr/cms_viewFile.php?idtf=16837&path=Liste-des-avis-de-depots.pdf'],
    ['decisions', true, 'https://www.decines-charpieu.fr/cms_viewFile.php?idtf=16838&path=Liste-des-decisions.pdf'],
  ]);
  const sgl = index('saint-genis-laval', `<a href="https://www.saintgenislaval.fr/sites/default/files/services-urbains-et-voirie/liste_des_avis_de_depot_24_09_26.pdf">a</a>
    <a href="https://www.saintgenislaval.fr/sites/default/files/services-urbains-et-voirie/liste_des_decisions_24_09_26.pdf">b</a>`);
  assert.deepEqual(sgl.files.map((file) => [file.layout, file.published]), [['birt-filings', '2026-09-24'], ['birt-decisions', '2026-09-24']]);
  const pertuis = index('pertuis', `<a href="/ad_attachment/2026/Dépot et Décisions/DECISION 29-09-26.pdf">x</a>
    <a href="/ad_attachment/2026/Dépot et Décisions/DEPOT 29-09-26.pdf">y</a>`);
  assert.deepEqual(pertuis.files.map((file) => [file.board, file.published]), [['filings', '2026-09-29'], ['decisions', '2026-09-29']]);
  assert.match(pertuis.files[0].url, /^https:\/\/www\.ville-pertuis\.fr\/ad_attachment\/2026\/D%C3%A9pot%20et%20D%C3%A9cisions\/DEPOT%2029-09-26\.pdf$/);
});

test('Arles, Saint-Cloud, Tassin and Sceaux list their editions, other files left out', () => {
  const arles = REPORT_BOARD_PROTOCOLS.arles;
  const pages = arles.start(city('arles'));
  assert.deepEqual(pages.map((request) => request.url.split('/').at(-2)), ['laffichage-des-depots-durbanisme', 'laffichage-des-decisions-durbanisme']);
  const decided = arles.index(city('arles'), `<a href="/app/uploads/1/2026/09/DECISION-2026-3eme-trimestre-4.pdf">T3</a>
    <a href="/app/uploads/1/2026/07/DECISION-2026-2eme-trimestre.pdf">T2</a><a href="/app/uploads/1/2026/05/plan.pdf">plan</a>`, pages[1], {});
  assert.deepEqual(decided.files.map((file) => [file.board, file.layout, file.published]),
    [['decisions', 'arles-decisions', '2026-09-01'], ['decisions', 'arles-decisions', '2026-07-01']]);
  assert.equal(arles.index(city('arles'), '<p>maintenance</p>', pages[0], {}), null);
  const cloud = REPORT_BOARD_PROTOCOLS['saint-cloud'].index(city('saint-cloud'), ['PC%20Decisions_131', 'DP%20Decisions_128',
    'PC%20Instruction_123', 'DP%20Instruction_129', 'logigramme%20usagers%20SAINT-CLOUD']
    .map((name) => `<a href="/sites/st-cloud/files/inline-files/${name}.pdf">x</a>`).join(''), { url: city('saint-cloud').page });
  assert.deepEqual(cloud.files.map((file) => file.layout),
    ['saint-cloud-decisions', 'saint-cloud-decisions', 'saint-cloud-filings', 'saint-cloud-filings']);
  const tassin = REPORT_BOARD_PROTOCOLS['tassin-la-demi-lune'].index(city('tassin-la-demi-lune'), ['DP', 'PC', 'PA-PD-CU']
    .map((family) => `<a href="/images/cadre/Autorisations urbanisme/2026/${family} SUIVI DEPOT - AFFICHAGE AU 28-09-2026.pdf">x</a>`)
    .join('') + '<a href="/images/cadre/ZONAGE.pdf">zonage</a>', { url: city('tassin-la-demi-lune').page });
  assert.deepEqual(tassin.files.map((file) => [file.layout, file.published]), Array(3).fill(['tassin', '2026-09-28']));
  const sceaux = REPORT_BOARD_PROTOCOLS.sceaux.index(city('sceaux'), ['2026-10/9-septembre-2026', '2026-01/12.-decembre-2025',
    '2025-08/liste-des-decisions-juillet', 'urbasnime/2026/1.-janvier-2026', 'RLPi - Sceaux', 'zppaup_reglement_10-2011']
    .map((name) => `<a href="/sites/default/files/${name}.pdf">x</a>`).join(''), { url: city('sceaux').page });
  assert.deepEqual(sceaux.files.map((file) => file.published), ['2026-10-01', '2026-01-01', '2025-08-01', '2026-01-01']);
});
