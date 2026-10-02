// src/data/cartdsFeed.test.mjs
// Pins the SHAPE of the Cart@DS « Affichage réglementaire » boards as they
// answered on 2026-09-30 across fifteen instances, 5 618 rows. The rows below
// are copied from those answers with every applicant replaced: a person's name
// never reaches this file, as it never reaches the payload.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARTDS_BOARDS,
  CARTDS_INSTANCES,
  buildCartdsForm,
  cartdsCommuneValue,
  cartdsDate,
  cartdsDecision,
  cartdsInstanceFor,
  cartdsKind,
  cartdsParcelIdus,
  cartdsProject,
  cartdsRobotsUrl,
  cartdsVerdictState,
  foldCartdsDossiers,
  normaliseCartdsRow,
  parseCartdsCommunes,
  parseCartdsPlace,
  parseCartdsToken,
  robotsAllows,
} from './cartdsFeed.js';
import { CARTDS_SCANNED_INSTANCES } from './cartdsScanned.js';
import { COMMUNE_CODE_PATTERN } from './communeCode.js';
import {
  SITADEL_FILES, mergeRegisters, normaliseSitadelRow, projectAdsPermits,
} from './adsFeed.js';

const MAMP = CARTDS_INSTANCES.find((instance) => instance.key === 'mamp');
const FAYENCE = CARTDS_INSTANCES.find((instance) => instance.key === 'paysdefayence');
const PORTO = CARTDS_INSTANCES.find((instance) => instance.key === 'portovecchio');
const HOUSING_FILE = SITADEL_FILES.find((file) => file.key === 'logements');

/** A filing-board row of Ventabren (13114), applicant replaced. */
const FILING = Object.freeze([
  '29/09/2026', 'DP 013 114 26 00167', '28/09/2026', 'DUPONT Jean',
  '3 Chemin du Puits des Nourades 13122  (AT 852)', '2000 m²', '', '',
]);

/** A decision-board row of Ventabren, applicant replaced. */
const DECISION = Object.freeze([
  '28/09/2026', 'PC 013 114 22 F0036 M02', '13/08/2026', 'SCI LES OLIVIERS',
  ' LES NOURADONS 13122  (AT 1048)', '5719 m²', 'Modificatif ',
  '- Surface plancher créée : 194,07 m²\r\n<br>- Surface plancher démolie : 0 m²\r\n<br>',
  'Favorable avec réserve le 21/09/2026',
]);

test('the registry is a gate that cannot half-cover or double-cover a commune', () => {
  const seen = new Map();
  for (const instance of CARTDS_INSTANCES) {
    // A path segment, or none for a board at the root of its host (Massy).
    assert.match(instance.base, /^https:\/\/[^/]+(\/[^/]+)?$/, instance.key);
    assert.ok(['insee', 'number', 'unpadded'].includes(instance.codes), instance.key);
    // What an odd menu entry sends is kept for a commune the instance reads.
    for (const insee of Object.keys(instance.values ?? {})) assert.ok(instance.communes.includes(insee), `${instance.key} ${insee}`);
    // The card names the publisher by the head of the label.
    assert.match(instance.label, / — /, instance.key);
    for (const code of instance.communes) {
      assert.match(code, COMMUNE_CODE_PATTERN, `${instance.key} ${code}`);
      assert.ok(!seen.has(code), `${code} is in ${seen.get(code)} and ${instance.key}`);
      seen.set(code, instance.key);
    }
  }
  // Written by hand: 129 communes on 2026-09-30, 65 and Grand Reims's 5 more
  // on 2026-10-01, then Leucate and Narbonne, the two paths of the Grand
  // Narbonne host, then Rixheim's separate path on 2026-10-02. The scan's
  // are on top, and the loop above already refused
  // any it shares.
  const scanned = CARTDS_SCANNED_INSTANCES.reduce((sum, instance) => sum + instance.communes.length, 0);
  assert.equal(seen.size - scanned, 202);
  assert.equal(cartdsInstanceFor('11262').key, 'narbonne');
  assert.equal(cartdsInstanceFor('11202').key, 'grandnarbonne');
  assert.equal(cartdsInstanceFor('68278').base, 'https://ilenapoleon.geosphere.fr/guichet-rixheim');
  assert.equal(cartdsCommuneValue(cartdsInstanceFor('68278'), '68278'), '278');
  assert.equal(cartdsInstanceFor('83050').base, 'https://ads.dracenie.com/guichet-unique');
  assert.equal(cartdsCommuneValue(cartdsInstanceFor('83050'), '83050'), '50');
  assert.ok(CARTDS_SCANNED_INSTANCES.every((instance) => CARTDS_INSTANCES.includes(instance)));
  assert.equal(cartdsInstanceFor('13114'), MAMP);
  assert.equal(cartdsInstanceFor('2a247'), PORTO);
  assert.equal(cartdsInstanceFor('75056'), null);
  assert.equal(cartdsInstanceFor(''), null);
  assert.equal(cartdsInstanceFor(null), null);
});

test('documented hosts with a robots.txt exception are read only by an explicit override', () => {
  const refused = [
    'ads.lecotentin.fr', 'grandlibournais.geosphere.fr', 'conches-en-ouche.geosphere.fr',
    'stemarie.geosphere.fr', 'brie-nangissienne.geosphere.fr',
    // Rixheim's path joined the hosting-default exception on 2026-10-02.
    'ilenapoleon.geosphere.fr',
  ];
  const documented = CARTDS_INSTANCES.filter((instance) => !CARTDS_SCANNED_INSTANCES.includes(instance));
  const overridden = documented.filter((instance) => instance.robots !== undefined);
  // The exception is named where it applies, and nowhere else.
  assert.deepEqual(overridden.map((instance) => new URL(instance.base).host).sort(), [...refused].sort());
  for (const instance of overridden) assert.equal(instance.robots, 'overridden', instance.key);
  // The scan writes the same exception, per instance, and no other value.
  for (const instance of CARTDS_SCANNED_INSTANCES) {
    assert.ok(instance.robots === undefined || instance.robots === 'overridden', instance.key);
  }
  assert.equal(cartdsRobotsUrl(MAMP), 'https://mamp.geosphere.fr/robots.txt');
});

test('the commune menu sends an INSEE code on some instances and a bare number on others', () => {
  // Sending the INSEE code to a `number` instance answers an EMPTY table, not
  // an error — the failure this test exists to catch.
  assert.equal(cartdsCommuneValue(MAMP, '13114'), '13114');
  assert.equal(cartdsCommuneValue(FAYENCE, '83008'), '8');
  assert.equal(cartdsCommuneValue(FAYENCE, '83117'), '117');
  assert.equal(cartdsCommuneValue(PORTO, '2A247'), '247');
  // Overseas: the menu sends the last three digits of 97418 too.
  const saintemarie = cartdsInstanceFor('97418');
  assert.equal(saintemarie.key, 'stemarie');
  assert.equal(cartdsCommuneValue(saintemarie, '97418'), '418');
  // The Allier's agency sends the INSEE code without its leading zero.
  assert.equal(cartdsCommuneValue({ codes: 'unpadded' }, '03058'), '3058');
  assert.equal(cartdsCommuneValue({ codes: 'unpadded' }, '45234'), '45234');
  // One menu sends the INSEE code for all its communes but one.
  const lomagne = cartdsInstanceFor('82013');
  assert.equal(lomagne.key, 'bastidesdelomagne');
  assert.equal(cartdsCommuneValue(lomagne, '82013'), '13');
  assert.equal(cartdsCommuneValue(lomagne, '82006'), '82006');
});

test('the page gives up its token and its commune menu', () => {
  const html = `
    <form><input name="__RequestVerificationToken" type="hidden" value="CfDJ8abc-_123" /></form>
    <select id="Communes_OptionSelectionnee" name="Communes.OptionSelectionnee" TABINDEX="-1">
      <option value="">Commune</option>
      <option value="13046">GR&#xC9;ASQUE</option>
      <option value="13084">LA ROQUE D&#x27;ANTHERON</option>
    </select>
    <select id="TypeInformation"><option selected="selected" value="1">Avis de d&#xE9;p&#xF4;t</option></select>`;
  assert.equal(parseCartdsToken(html), 'CfDJ8abc-_123');
  assert.equal(parseCartdsToken('<html></html>'), null);
  assert.equal(parseCartdsToken(null), null);
  assert.deepEqual(parseCartdsCommunes(html), [
    { value: '13046', name: 'GRÉASQUE' },
    { value: '13084', name: 'LA ROQUE D\'ANTHERON' },
  ]);
  assert.deepEqual(parseCartdsCommunes('<select id="other"></select>'), []);
});

test('the table request carries the commune, the board, the token and the column descriptors', () => {
  const body = new URLSearchParams(buildCartdsForm({
    commune: '8', board: CARTDS_BOARDS.decisions, token: 'tok', start: 1000,
  }));
  assert.equal(body.get('NCommune'), '8');
  assert.equal(body.get('TypeInformation'), '2');
  assert.equal(body.get('__RequestVerificationToken'), 'tok');
  assert.equal(body.get('start'), '1000');
  assert.equal(body.get('length'), '1000');
  // Without the descriptors the instance answers an empty table.
  for (let i = 0; i < 9; i += 1) assert.equal(body.get(`columns[${i}][data]`), String(i));
});

test('robots.txt is read the way RFC 9309 reads it', () => {
  const page = '/guichet-unique/Login/AffichageReglementaire';
  assert.equal(robotsAllows('User-agent: *\nDisallow: /', page), false);
  assert.equal(robotsAllows('User-agent: *\nDisallow:', page), true);
  assert.equal(robotsAllows('', page), true);
  assert.equal(robotsAllows(null, page), true);
  // Comments, blank lines, case.
  assert.equal(robotsAllows('# nothing for robots\nUSER-AGENT: *\n\nDISALLOW: /guichet-unique/ # the app', page), false);
  // A group naming us wins over the star group, whichever way it goes.
  assert.equal(robotsAllows('User-agent: *\nDisallow: /\n\nUser-agent: Surplomb\nAllow: /', page), true);
  assert.equal(robotsAllows('User-agent: *\nAllow: /\n\nUser-agent: surplomb\nDisallow: /', page), false);
  // Consecutive agent lines share one group.
  assert.equal(robotsAllows('User-agent: googlebot\nUser-agent: *\nDisallow: /guichet', page), false);
  // Longest match wins; Allow wins a tie.
  assert.equal(robotsAllows('User-agent: *\nDisallow: /\nAllow: /guichet-unique/Login/', page), true);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /guichet-unique/Login/\nAllow: /guichet', page), false);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /a\nAllow: /a', '/a'), true);
  // Wildcards and the end anchor.
  assert.equal(robotsAllows('User-agent: *\nDisallow: /*/Login/', page), false);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /*.pdf$', page), true);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /*.pdf$', '/a/b.pdf'), false);
});

test('dates are day-first', () => {
  assert.equal(cartdsDate('28/09/2026'), '2026-09-28');
  assert.equal(cartdsDate('Favorable le 01/10/2026'), '2026-10-01');
  assert.equal(cartdsDate(''), null);
  assert.equal(cartdsDate(null), null);
});

test('the site cell splits into address, postcode, locality and parcels', () => {
  assert.deepEqual(parseCartdsPlace('313 Chemin de la Bertrane 13122  (AI 255)'), {
    address: '313 Chemin de la Bertrane',
    postcode: '13122',
    locality: null,
    parcels: [{ prefix: null, section: 'AI', numero: '255', label: 'AI 255' }],
  });
  const several = parseCartdsPlace(' CHEMIN DES NOURADONS 13122  (AT 1293, AT 1295, AT 1296)');
  assert.equal(several.address, 'CHEMIN DES NOURADONS');
  assert.deepEqual(several.parcels.map((parcel) => parcel.label), ['AT 1293', 'AT 1295', 'AT 1296']);
  // A hamlet after the postcode, and no parcel at all.
  assert.deepEqual(parseCartdsPlace('1 A Rue des Mouettes 13500 CARRO'), {
    address: '1 A Rue des Mouettes', postcode: '13500', locality: 'CARRO', parcels: [],
  });
  // Nothing but a postcode: nothing to geocode.
  assert.equal(parseCartdsPlace('  13121 ').address, null);
  // A merged commune's prefix, and Alsace's numbered sections.
  assert.deepEqual(parseCartdsPlace('x 35270  (147 AC 137)').parcels[0],
    { prefix: '147', section: 'AC', numero: '137', label: '147 AC 137' });
  assert.deepEqual(parseCartdsPlace('x 68360  (01 73)').parcels[0],
    { prefix: null, section: '01', numero: '73', label: '01 73' });
  // A malformed piece is skipped, not guessed at; its neighbours survive.
  assert.deepEqual(
    parseCartdsPlace('3,5,7 rue Renan 13600  (AD 192, AD , AD 193)').parcels.map((parcel) => parcel.label),
    ['AD 192', 'AD 193'],
  );
  assert.deepEqual(parseCartdsPlace('46 LA VILLE 35720  (ZO 175, ZO DP1)').parcels.map((p) => p.label), ['ZO 175']);
});

test('parcels are keyed the way the Etalab cadastre keys them', () => {
  const refs = (cell, insee) => cartdsParcelIdus(parseCartdsPlace(cell).parcels, insee).map((ref) => ref.idu);
  assert.deepEqual(refs('x 13122  (AI 255)', '13114'), ['13114000AI0255']);
  // The commune's OWN number in front is its own section: prefix 000.
  assert.deepEqual(refs('x 13610  (93 B 817)', '13093'), ['130930000B0817']);
  assert.deepEqual(refs('x 20137  (247 AP 207)', '2A247'), ['2A247000AP0207']);
  // Another number is the former commune of a merger, and is kept.
  assert.deepEqual(refs('x 35270  (147 AC 137)', '35308'), ['35308147AC0137']);
  assert.deepEqual(refs('x 68360  (01 73)', '68315'), ['68315000010073']);
  // The same parcel twice is one reference; a bad commune code is none.
  assert.deepEqual(refs('x 13122  (AI 255, AI 255)', '13114'), ['13114000AI0255']);
  assert.deepEqual(refs('x 13122  (AI 255)', 'nope'), []);
  const [partial] = cartdsParcelIdus([{ prefix: null, section: 'AN', numero: '255P' }], '64547');
  assert.deepEqual(partial, { idu: '64547000AN0255', provisional: true, label: 'AN255' });
});

test('every verdict posted on 2026-09-30 lands on the ladder', () => {
  const expected = {
    Favorable: 'accorde',
    'Favorable avec réserve': 'accorde',
    'Favorable tacite': 'accorde',
    'Accord tacite': 'accorde',
    'Non opposition': 'accorde',
    Défavorable: 'refuse',
    'Défavorable tacite': 'refuse',
    'Rejet implicite': 'refuse',
    'Rejet tacite': 'refuse',
    Rejet: 'refuse',
    Opposition: 'refuse',
    Annulation: 'annule',
    'Sans suite': 'annule',
    'Classement sans suite': 'annule',
    Caduc: 'annule',
    Irrecevable: 'annule',
    Renonciation: 'annule',
    // A certificat's answers: no state of their own.
    'Simple information': null,
    Réalisable: null,
    'Non réalisable': null,
  };
  for (const [verdict, state] of Object.entries(expected)) {
    assert.equal(cartdsVerdictState(verdict), state, verdict);
  }
  assert.equal(cartdsVerdictState(''), null);
});

test('the decision cell gives a state, a date, and keeps words it does not know', () => {
  assert.deepEqual(cartdsDecision('Favorable avec réserve le 24/09/2026'), {
    state: 'accorde', label: 'Accordé', decidedOn: '2026-09-24', verdict: 'Favorable avec réserve',
  });
  assert.deepEqual(cartdsDecision('Annulation le 22/09/2026'), {
    state: 'annule', label: 'Annulé', decidedOn: '2026-09-22', verdict: 'Annulation',
  });
  assert.deepEqual(cartdsDecision('Sursis à statuer le 02/09/2026'), {
    state: 'depose', label: 'Sursis à statuer', decidedOn: '2026-09-02', verdict: 'Sursis à statuer',
  });
});

test('the project cell gives floor areas and lots, and a blank is not a zero', () => {
  assert.deepEqual(cartdsProject(DECISION[7]), { createdM2: 194.07, demolishedM2: 0, lots: null });
  assert.deepEqual(cartdsProject('- Lotissement : 3 lot (s)\r\n<br>'), { createdM2: null, demolishedM2: null, lots: 3 });
  assert.deepEqual(cartdsProject('- Surface plancher créée :  m²\r\n<br>'), { createdM2: null, demolishedM2: null, lots: null });
  assert.deepEqual(cartdsProject(''), { createdM2: null, demolishedM2: null, lots: null });
});

test('only building authorisations get through: a sale notice never does', () => {
  for (const kind of ['PC', 'DP', 'PA', 'PD', 'CU']) assert.equal(cartdsKind(`${kind} 013 114 26 00001`), kind);
  // IA is a déclaration d'intention d'aliéner — a sale, with its price.
  for (const dossier of ['IA 013 114 26 00001', 'AT 013 114 26 00001', 'DC 013 114 26 00001', '', null]) {
    assert.equal(cartdsKind(dossier), null, String(dossier));
  }
  const sale = [...FILING];
  sale[1] = 'IA 013 114 26 00050';
  assert.equal(normaliseCartdsRow(MAMP, '13114', CARTDS_BOARDS.filings, sale), null);
  assert.equal(normaliseCartdsRow(MAMP, '13114', CARTDS_BOARDS.filings, null), null);
});

test('a filing notice is FILED, and a private applicant never reaches the payload', () => {
  const permit = normaliseCartdsRow(MAMP, '13114', CARTDS_BOARDS.filings, FILING);
  assert.equal(permit.id, 'cartds:mamp:DP 013 114 26 00167');
  assert.equal(permit.kind, 'DP');
  assert.equal(permit.key, 'DAU|0131142600167');
  // TRAP 4: not `instruction` — a tacit decision is posted by some communes
  // and not by others, so « under review » is a claim the board cannot make.
  assert.equal(permit.state, 'depose');
  assert.equal(permit.stateLabel, 'Déposé');
  assert.equal(permit.depositedOn, '2026-09-28');
  assert.equal(permit.postedOn, '2026-09-29');
  assert.equal(permit.decidedOn, null);
  assert.equal(permit.applicant, null);
  assert.ok(!JSON.stringify(permit).includes('DUPONT'));
  assert.equal(permit.purpose, 'Déclaration préalable');
  assert.equal(permit.address, '3 Chemin du Puits des Nourades');
  assert.equal(permit.postcode, '13122');
  assert.equal(permit.communeCode, '13114');
  assert.equal(permit.cadastreCommune, '13114');
  assert.deepEqual(permit.parcels, ['AT 852']);
  assert.deepEqual(permit.parcelIdus.map((ref) => ref.idu), ['13114000AT0852']);
  assert.equal(permit.landAreaM2, 2000);
  assert.equal(permit.lon, null);
  assert.equal(permit.source, 'cartds');
  assert.equal(permit.sourceLabel, MAMP.label);
});

test('a decision carries its state, its date and an organisation’s name', () => {
  const permit = normaliseCartdsRow(MAMP, '13114', CARTDS_BOARDS.decisions, DECISION);
  assert.equal(permit.kind, 'PC');
  // A modificatif keeps its suffix: it is a decision of its own.
  assert.equal(permit.key, 'DAU|01311422F0036M02');
  assert.equal(permit.state, 'accorde');
  assert.equal(permit.decidedOn, '2026-09-21');
  assert.equal(permit.depositedOn, '2026-08-13');
  assert.equal(permit.applicant, 'SCI LES OLIVIERS');
  assert.equal(permit.purpose, 'Modificatif');
  assert.equal(permit.surfaceCreatedM2, 194.07);
  assert.equal(permit.address, 'LES NOURADONS');
  assert.equal(permit.landAreaM2, 5719);
});

test('a posted dossier and its Sitadel row share a key, so the merge can find it', () => {
  const posted = [...DECISION];
  posted[1] = 'PC 013 114 26 00008';
  const permit = normaliseCartdsRow(MAMP, '13114', CARTDS_BOARDS.decisions, posted);
  const state = normaliseSitadelRow(HOUSING_FILE, {
    NUM_DAU: '0131142600008', TYPE_DAU: 'PC', ETAT_DAU: 5, COMM: '13114', NB_LGT_TOT_CREES: 1,
  });
  assert.equal(permit.key, state.key);
  const { permits, merged } = mergeRegisters([state], [permit]);
  assert.equal(merged, 1);
  assert.equal(permits.length, 1);
  assert.equal(permits[0].state, 'accorde');
  assert.equal(permits[0].siteState, 'commence');
  assert.equal(permits[0].housing, 1);
  assert.deepEqual(permits[0].sources, ['cartds', 'sitadel']);
  // The card's « Source » reads the head of this label.
  assert.equal(permits[0].sourceLabel, `${MAMP.label} + Sitadel`);
});

test('one dossier on both boards is one dossier, with the decision’s state', () => {
  const filed = [...FILING];
  filed[1] = 'PC 013 114 26 00040';
  filed[6] = 'extension de la maison';
  const decided = [...DECISION];
  decided[1] = 'PC 013 114 26 00040';
  decided[6] = '';
  const rows = [
    normaliseCartdsRow(MAMP, '13114', CARTDS_BOARDS.filings, filed),
    normaliseCartdsRow(MAMP, '13114', CARTDS_BOARDS.decisions, decided),
  ];
  const { permits, folded } = foldCartdsDossiers(rows);
  assert.equal(folded, 1);
  assert.equal(permits.length, 1);
  assert.equal(permits[0].state, 'accorde');
  assert.equal(permits[0].decidedOn, '2026-09-21');
  // The decision posted no nature; the filing's survives.
  assert.equal(permits[0].purpose, 'extension de la maison');
  // Either order.
  assert.equal(foldCartdsDossiers(rows.reverse()).permits[0].state, 'accorde');
});

test('two decisions kept for one dossier: the later one is its state', () => {
  // A grant in August, its withdrawal in October: both survive in the archive
  // after the first left the board.
  const granted = [...DECISION];
  granted[0] = '10/08/2026';
  granted[8] = 'Favorable le 05/08/2026';
  const withdrawn = [...DECISION];
  withdrawn[0] = '12/10/2026';
  withdrawn[8] = 'Annulation le 09/10/2026';
  const rows = [granted, withdrawn].map((row) => normaliseCartdsRow(MAMP, '13114', CARTDS_BOARDS.decisions, row));
  for (const order of [rows, [...rows].reverse()]) {
    const { permits } = foldCartdsDossiers(order);
    assert.equal(permits.length, 1);
    assert.equal(permits[0].state, 'annule');
    assert.equal(permits[0].decidedOn, '2026-10-09');
  }
});

test('a PC and a DP with the same digits stay two dossiers', () => {
  // 115 such numbers on the boards of 2026-09-30, 11 at La Ciotat.
  const pc = [...DECISION];
  pc[1] = 'PC 013 028 26 00089';
  const dp = [...DECISION];
  dp[1] = 'DP 013 028 26 00089';
  const rows = [pc, dp].map((row) => normaliseCartdsRow(MAMP, '13028', CARTDS_BOARDS.decisions, row));
  assert.equal(rows[0].key, rows[1].key);
  const { permits, folded } = foldCartdsDossiers(rows);
  assert.equal(folded, 0);
  assert.deepEqual(permits.map((permit) => permit.kind), ['PC', 'DP']);
  assert.equal(new Set(permits.map((permit) => permit.id)).size, 2);
});

test('a posted certificat is counted by the projection, never drawn', () => {
  const certificat = [...DECISION];
  certificat[1] = 'CU 013 114 26 00100';
  certificat[8] = 'Simple information le 20/09/2026';
  const permit = normaliseCartdsRow(MAMP, '13114', CARTDS_BOARDS.decisions, certificat);
  const origin = { lon: 5.29, lat: 43.54 };
  const { permits, summary } = projectAdsPermits({
    permits: [{ ...permit, lon: origin.lon, lat: origin.lat }],
    origin,
    radiusM: 400,
  });
  assert.equal(permits.length, 0);
  assert.equal(summary.certificates, 1);
});
