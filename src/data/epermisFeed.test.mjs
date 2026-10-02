// src/data/epermisFeed.test.mjs
// Pins the SHAPE of Métropole Nice Côte d'Azur's e-permis lists as they
// answered on 2026-10-01. Every applicant, architect, address and secret below
// is invented: a person's name never reaches this file, nor the client the
// page's script carries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EPERMIS_BOARDS,
  EPERMIS_INSTANCES,
  EPERMIS_ROWS,
  buildEpermisTokenForm,
  epermisBoardsByCommune,
  epermisCommuneOf,
  epermisConfigUrl,
  epermisDay,
  epermisHistoryFloor,
  epermisHistoryWindows,
  epermisInstanceFor,
  epermisListUrl,
  epermisPageUrl,
  epermisParcels,
  epermisRecentWindow,
  epermisScriptUrl,
  epermisToken,
  epermisVerdict,
  epermisVerdictState,
  normaliseEpermisRow,
  parseEpermisClient,
  parseEpermisConfig,
  parseEpermisPage,
  scrubEpermisRow,
} from './epermisFeed.js';
import { foldCartdsDossiers } from './cartdsFeed.js';
import { SITADEL_FILES, mergeRegisters, normaliseSitadelRow } from './adsFeed.js';
import { emptyCartdsArchive, readCartdsArchive, recordCartdsBoards } from './cartdsArchive.js';
import { COMMUNE_CODE_PATTERN } from './communeCode.js';

const NICE = EPERMIS_INSTANCES[0];

/** A filing row as `exports/depots` answers it, names invented. */
const FILING = Object.freeze({
  origine: null, BIE_ADRESSE: '12 Avenue des Exemples', BIE_CAD_T: 'LV9261',
  REFERENCE: 'DP0060882609343', dt_reception: '2026-09-30', dt_completude: null,
  event_id: 900001, dt_decision: null, decision: null, dos_dnm_t: 'DUPONT Jean',
  nature: 'Modification des façades<br/>et création d&#039;une piscine', surf_cc: '0',
  date_demande: '30/09/2026', date_affichage: '30/09/2026', srt_3: '2026-09-30',
  type_dossier: 'Déclaration préalable de travaux', nom_commune: 'NICE',
  architecte: 'MARTIN Paul', surface_terrain: '750',
});

/** A decision row as `exports/decisions` answers it, by a firm. */
const DECIDED = Object.freeze({
  BIE_ADRESSE: '414 Route des Exemples', BIE_CAD_T: '0A9752, OA9753, OA9665',
  REFERENCE: 'PC0061472690021', dos_dnm_t: 'SCI LES EXEMPLES',
  nature: '- SURELEVATION D’UN GARAGE<br/>- REALISATION D’UNE PISCINE',
  date_decision: '30/09/2026', date_notification: null, date_affichage: null,
  dt_completude: '2026-08-07', decision: 'Accord', srt_3: '2026-09-30',
  url_arrete: 'https://www.example.org/arrete.pdf', url_doct_prescription: null,
  event_id: 900002, date_depot: '24/06/2026', type_dossier: 'Permis de construire',
  nom_commune: 'Tourrette-Levens ', surface_terrain: '2100', surf_cc: '60',
  architecte: 'BERNARD Lucie', type_evt: 'decision', origine: null,
});

/** The token request as the page's minified script writes it, values invented. */
const SCRIPT = 'const x=1;mC=async()=>{const e="https://auth.clicmap.fr/oauth2/token",'
  + 't="rp-example-public",n="0123456789abcdef-invented",r=new URLSearchParams;'
  + 'r.append("grant_type","client_credentials"),r.append("client_id",t),'
  + 'r.append("client_secret",n),r.append("scope","openid");try{}catch(i){}}';

test('the registry is Nice’s 38 communes, Pau’s agglomeration and eighteen one-commune publishers, none read twice', () => {
  assert.equal(EPERMIS_INSTANCES.length, 20);
  const read = EPERMIS_INSTANCES.flatMap((instance) => [...instance.communes, ...(instance.silent ?? [])]);
  assert.equal(new Set(read).size, read.length, 'a commune belongs to one publisher');
  assert.equal(new Set(EPERMIS_INSTANCES.map((instance) => instance.client)).size, 20);
  assert.equal(new Set(EPERMIS_INSTANCES.map((instance) => instance.key)).size, 20);
  for (const instance of EPERMIS_INSTANCES.slice(1)) assert.match(instance.label, / — affichage réglementaire$/);
  const pau = epermisInstanceFor('64445');
  assert.equal(pau.client, 97, 'Pau is read through its agglomeration');
  assert.equal(pau.communes.length + pau.silent.length, 31);
  assert.equal(epermisInstanceFor('64348'), null, 'Lons is listed and posted nothing in a year');
  assert.equal(EPERMIS_INSTANCES.filter((instance) => instance.communes.length === 1).length, 18);
  assert.equal(NICE.communes.length, 38);
  assert.equal(NICE.silent.length, 13);
  // The 51 the publisher lists, each once: read, or named as silent.
  assert.equal(new Set([...NICE.communes, ...NICE.silent]).size, 51);
  for (const code of [...NICE.communes, ...NICE.silent]) assert.match(code, COMMUNE_CODE_PATTERN);
  assert.equal(epermisInstanceFor('06027'), null, 'Cagnes-sur-Mer is listed and posts nothing there');
  assert.match(NICE.label, / — affichage réglementaire$/);
  assert.equal(epermisInstanceFor('06088'), NICE);
  assert.equal(epermisInstanceFor('06004'), null, 'Antibes posts on Sirap');
  assert.equal(epermisInstanceFor(''), null);
  assert.equal(epermisInstanceFor(null), null);
  assert.equal(epermisPageUrl(NICE), 'https://affichage.e-permis.fr/depot?id=123');
  assert.equal(epermisConfigUrl(NICE), 'https://api-v2.clicmap.fr/ads/exports/config?id=123');
});

test('the client is read off the page’s script, never guessed', () => {
  assert.equal(
    epermisScriptUrl('<script type="module" crossorigin src="/assets/index-Cb1kgI_c.js"></script>'),
    'https://affichage.e-permis.fr/assets/index-Cb1kgI_c.js',
  );
  assert.equal(epermisScriptUrl('<div id="app"></div>'), null);
  assert.deepEqual(parseEpermisClient(SCRIPT), {
    clientId: 'rp-example-public', clientSecret: '0123456789abcdef-invented',
  });
  // A later declaration of the same one-letter name elsewhere is not the one in force.
  assert.deepEqual(parseEpermisClient(`n="wrong";${SCRIPT}`).clientSecret, '0123456789abcdef-invented');
  // Literals in the append, or an object, are read too.
  assert.deepEqual(
    parseEpermisClient('fetch("https://auth.clicmap.fr/oauth2/token",{client_id:"a-id",client_secret:"a-secret"})'),
    { clientId: 'a-id', clientSecret: 'a-secret' },
  );
  assert.deepEqual(
    parseEpermisClient('u="https://auth.clicmap.fr/oauth2/token";p.append("client_id","b-id");p.append("client_secret","b-secret")'),
    { clientId: 'b-id', clientSecret: 'b-secret' },
  );
  // No token address, or only half the client: the source is closed.
  assert.equal(parseEpermisClient('r.append("client_id",t)'), null);
  assert.equal(parseEpermisClient('const e="https://auth.clicmap.fr/oauth2/token",t="only-id";r.append("client_id",t)'), null);
  assert.equal(parseEpermisClient(null), null);
  const form = new URLSearchParams(buildEpermisTokenForm({ clientId: 'rp-example-public', clientSecret: 's' }));
  assert.deepEqual(Object.fromEntries(form), {
    grant_type: 'client_credentials', client_id: 'rp-example-public', client_secret: 's', scope: 'openid',
  });
});

test('a token says how long it lasts, by `expires_in` or by its own `exp`', () => {
  const now = Date.UTC(2026, 9, 1, 12);
  assert.deepEqual(epermisToken({ token_type: 'Bearer', access_token: 'abc', expires_in: 3600 }, now), {
    authorization: 'Bearer abc', expiresAt: now + 3_600_000,
  });
  const payload = Buffer.from(JSON.stringify({ exp: now / 1000 + 600 })).toString('base64url');
  assert.equal(epermisToken({ access_token: `h.${payload}.s` }, now).expiresAt, now + 600_000);
  assert.equal(epermisToken({ access_token: 'opaque' }, now).expiresAt, now + 600_000);
  assert.equal(epermisToken({ error: 'invalid_client' }, now), null);
  assert.equal(epermisToken(null, now), null);
});

test('the configuration gives the environment and the communes on five characters', () => {
  assert.deepEqual(parseEpermisConfig({
    success: true,
    data: { id_client: 123, name_client: 'Nice métropole', codes_insee: [6088, 6156], env_id: 4142, show_name: true },
  }), { envId: '4142', communes: ['06088', '06156'], name: 'Nice métropole' });
  assert.equal(parseEpermisConfig({ success: false }), null);
  assert.equal(parseEpermisConfig({ success: true, data: { env_id: null } }), null);
});

test('a list is read a window at a time, in the API’s own day format', () => {
  assert.equal(epermisDay('2026-10-01'), '01-10-2026');
  assert.throws(() => epermisDay('01/10/2026'));
  assert.equal(
    epermisListUrl(EPERMIS_BOARDS.decisions, 2, { from: '2026-07-31', to: '2026-10-01' }),
    'https://api-v2.clicmap.fr/ads/exports/decisions?page=2&json=true&date_min=31-07-2026&date_max=01-10-2026',
  );
  assert.deepEqual(epermisRecentWindow('2026-10-01'), { from: '2026-07-31', to: '2026-10-01' });
  // The page says how many rows IT holds, not how many there are.
  assert.deepEqual(parseEpermisPage({ success: true, data: [FILING], pagination: { current_page: '1', items_per_page: 1 } }), {
    rows: [FILING], full: false,
  });
  assert.equal(parseEpermisPage({ success: true, data: Array(100).fill(FILING) }).full, true);
  assert.deepEqual(parseEpermisPage({ success: true, data: [] }), { rows: [], full: false });
  assert.equal(parseEpermisPage({ type: 'about:blank', status: 500 }), null);
  assert.equal(parseEpermisPage(null), null);
});

test('history is walked a calendar month at a time, down to the default window', () => {
  assert.equal(epermisHistoryFloor('2026-10-01'), '2023-10-01');
  const windows = epermisHistoryWindows('2026-07-31', '2023-10-01');
  assert.equal(windows.length, 12);
  assert.deepEqual(windows[0], { from: '2026-07-01', to: '2026-07-30' });
  assert.deepEqual(windows[1], { from: '2026-06-01', to: '2026-06-30' });
  assert.deepEqual(windows.at(-1), { from: '2025-08-01', to: '2025-08-31' });
  assert.deepEqual(epermisHistoryWindows('2023-11-15', '2023-10-01', 12), [
    { from: '2023-11-01', to: '2023-11-14' },
    { from: '2023-10-01', to: '2023-10-31' },
  ]);
  assert.deepEqual(epermisHistoryWindows('2023-10-01', '2023-10-01'), []);
  assert.deepEqual(epermisHistoryWindows('2024-03-01', '2023-10-01', 2).map((w) => w.from), ['2024-02-01', '2024-01-01']);
});

test('the commune is the one the dossier number names', () => {
  assert.equal(epermisCommuneOf('PC0061202600010'), '06120');
  assert.equal(epermisCommuneOf('DP00611024P0018M01'), '06110');
  assert.equal(epermisCommuneOf('PC00605917S0007T02'), '06059');
  assert.equal(epermisCommuneOf('DP02A2472600001'), '2A247');
  assert.equal(epermisCommuneOf('PC9744112600001'), '97411');
  assert.equal(epermisCommuneOf('IA0060882600001'), null);
  assert.equal(epermisCommuneOf(null), null);
  const { communes, unlisted, notPermits } = epermisBoardsByCommune(NICE, {
    depots: [
      FILING,
      { ...FILING, REFERENCE: 'DP0130552600001' },
      { ...FILING, REFERENCE: 'PC0060212600001' },
      { ...FILING, REFERENCE: 'PC6412225B0012' },
      { ...FILING, REFERENCE: 'EN0060882600001' },
    ],
    decisions: [DECIDED, { ...DECIDED, REFERENCE: 'AT0060882600002' }, { ...DECIDED, REFERENCE: 'AP006088260003' }],
  });
  assert.equal(communes.size, 38, 'every commune read is recorded, posted or not');
  assert.equal(communes.get('06088').depots.length, 1);
  assert.equal(communes.get('06147').decisions.length, 1);
  assert.deepEqual(communes.get('06006'), { depots: [], decisions: [] });
  assert.deepEqual(unlisted, ['13055', '06021', null],
    'a permit for a commune not listed, silent ones included, and one whose number names none');
  assert.equal(notPermits, 3, 'a sign, works on a public building and an AP are not permits, wherever they are');
});

test('the parcels resolve to the cadastre’s key in every spelling seen', () => {
  const idus = (cell) => epermisParcels(cell, '06120').idus.map((ref) => ref.idu);
  assert.deepEqual(idus('LV9261'), ['06120000LV9261']);
  assert.deepEqual(idus('0L0568, 0L1859'), ['061200000L0568', '061200000L1859']);
  // The letter O for the zero: both, and the cadastre keeps the one it has.
  assert.deepEqual(idus('OA0753'), ['06120000OA0753', '061200000A0753']);
  // The zero left out, the two swapped, a short number, a stray dot.
  assert.deepEqual(idus('B585'), ['061200000B0585']);
  assert.deepEqual(idus('D1149'), ['061200000D1149']);
  assert.deepEqual(idus('C00203'), ['061200000C0203']);
  assert.deepEqual(idus('AB216'), ['06120000AB0216']);
  assert.deepEqual(idus('.B1257'), ['061200000B1257']);
  // Nothing to look up.
  assert.deepEqual(idus(', ,'), []);
  assert.deepEqual(idus('B42436'), []);
  assert.deepEqual(idus('AB0000'), []);
  assert.deepEqual(idus(null), []);
  assert.deepEqual(epermisParcels('OR0017, 0L0568, C00203', '06088').labels, ['OR 17', 'L 568', 'C 203']);
  assert.deepEqual(epermisParcels('LV9261', 'nope'), { labels: [], idus: [] });
});

test('both vocabularies read onto the ladder, and a withdrawal ends the permit', () => {
  const states = Object.fromEntries([
    'Accord', 'Refus', 'Rejet', 'FAVORABLE', 'DEFAVORABLE', 'FAVORABLE AVEC PRESCRIPTIONS', 'rejet implicite',
    'tacite', 'REFUS TACITE', 'ANNULE', 'SANS SUITE', 'sans objet', 'rapporté',
    'Prorogation d’’autorisation (FAVORABLE)', 'Retrait de décision (bénéficiaire) (Accord)',
    'Retrait de décision (bénéficiaire) ("Accord" du 10/10/2025)', 'Retrait de décision (administration) (retrait autorisation tacite)',
    'Sursis à statuer', 'x_ recours gracieux du demandeur', '',
  ].map((word) => [word, epermisVerdictState(word)]));
  assert.deepEqual(states, {
    Accord: 'accorde', Refus: 'refuse', Rejet: 'refuse', FAVORABLE: 'accorde', DEFAVORABLE: 'refuse',
    'FAVORABLE AVEC PRESCRIPTIONS': 'accorde', 'rejet implicite': 'refuse', tacite: 'accorde',
    'REFUS TACITE': 'refuse', ANNULE: 'annule', 'SANS SUITE': 'annule', 'sans objet': 'annule', 'rapporté': 'annule',
    'Prorogation d’’autorisation (FAVORABLE)': 'accorde',
    'Retrait de décision (bénéficiaire) (Accord)': 'annule',
    'Retrait de décision (bénéficiaire) ("Accord" du 10/10/2025)': 'annule',
    'Retrait de décision (administration) (retrait autorisation tacite)': 'annule',
    'Sursis à statuer': null, 'x_ recours gracieux du demandeur': null, '': null,
  });
  // The withdrawal comes after the grant and the dossier says so.
  const granted = normaliseEpermisRow(NICE, 'decisions', DECIDED);
  const withdrawn = normaliseEpermisRow(NICE, 'decisions', {
    ...DECIDED, decision: 'Retrait de décision (bénéficiaire) (Accord)', type_evt: 'evolution', date_decision: '15/11/2026',
  });
  const extended = normaliseEpermisRow(NICE, 'decisions', {
    ...DECIDED, decision: 'Prorogation d’’autorisation (FAVORABLE)', type_evt: 'evolution', date_decision: '15/11/2027',
  });
  assert.equal(foldCartdsDossiers([granted, withdrawn]).permits[0].state, 'annule');
  assert.equal(foldCartdsDossiers([granted, withdrawn]).permits[0].decidedOn, '2026-11-15');
  const kept = foldCartdsDossiers([extended, granted]).permits[0];
  assert.equal(kept.state, 'accorde');
  assert.equal(kept.decidedOn, '2026-09-30', 'a prorogation keeps the grant’s day');
  // An appeal the software logs as a decision is no verdict, and no day.
  const appeal = normaliseEpermisRow(NICE, 'decisions', { ...DECIDED, decision: 'x_ recours gracieux du demandeur' });
  assert.equal(appeal.state, 'depose');
  assert.equal(appeal.stateLabel, 'Déposé');
  assert.equal(appeal.decidedOn, null);
  assert.equal(foldCartdsDossiers([appeal, granted]).permits[0].state, 'accorde');
});

test('a verdict and its day, from either list', () => {
  assert.deepEqual(epermisVerdict(DECIDED, 'decisions'), { verdict: 'Accord', decidedOn: '2026-09-30' });
  assert.deepEqual(epermisVerdict({ ...DECIDED, decision: 'Prorogation d’’autorisation (FAVORABLE)', type_evt: 'evolution' }, 'decisions'), {
    verdict: 'Prorogation d’’autorisation (FAVORABLE)', decidedOn: null,
  });
  assert.deepEqual(epermisVerdict({ ...DECIDED, decision: 'Retrait de décision (bénéficiaire) (Accord)', type_evt: 'evolution' }, 'decisions'), {
    verdict: 'Retrait de décision (bénéficiaire) (Accord)', decidedOn: '2026-09-30',
  });
  assert.deepEqual(epermisVerdict({ ...DECIDED, decision: 'x_demande de prorogation' }, 'decisions'), { verdict: null, decidedOn: null });
  assert.deepEqual(epermisVerdict({ decision: '"Refus" du 27/08/2026' }, 'depots'), { verdict: 'Refus', decidedOn: '2026-08-27' });
  assert.deepEqual(epermisVerdict({ decision: '3' }, 'depots'), { verdict: null, decidedOn: null });
  assert.deepEqual(epermisVerdict(FILING, 'depots'), { verdict: null, decidedOn: null });
});

test('a filing reads Déposé, a decision its verdict, and a person never gets through', () => {
  const filed = normaliseEpermisRow(NICE, 'depots', FILING);
  assert.equal(filed.id, 'epermis:nicecotedazur:DP0060882609343');
  assert.equal(filed.dossier, 'DP 006 088 26 09343');
  assert.equal(filed.key, 'DAU|0060882609343');
  assert.equal(filed.state, 'depose');
  assert.equal(filed.stateLabel, 'Déposé');
  assert.equal(filed.depositedOn, '2026-09-30');
  assert.equal(filed.postedOn, '2026-09-30');
  assert.equal(filed.decidedOn, null);
  assert.equal(filed.applicant, null);
  assert.equal(filed.purpose, 'Modification des façades et création d\'une piscine');
  assert.equal(filed.communeCode, '06088');
  assert.equal(filed.cadastreCommune, '06088');
  assert.equal(filed.postcode, null);
  assert.equal(filed.surfaceCreatedM2, null, '0 is the field’s blank');
  assert.equal(filed.landAreaM2, 750);
  assert.equal(filed.source, 'epermis');
  assert.ok(!JSON.stringify(filed).includes('DUPONT'));
  assert.ok(!JSON.stringify(filed).includes('MARTIN'));

  const decided = normaliseEpermisRow(NICE, 'decisions', DECIDED);
  assert.equal(decided.state, 'accorde');
  assert.equal(decided.stateLabel, 'Accordé');
  assert.equal(decided.decidedOn, '2026-09-30');
  assert.equal(decided.depositedOn, '2026-06-24');
  assert.equal(decided.applicant, 'SCI LES EXEMPLES');
  assert.equal(decided.surfaceCreatedM2, 60);
  assert.equal(decided.communeCode, '06147');
  assert.deepEqual(decided.parcels, ['A 9752', 'OA 9753', 'OA 9665']);
  assert.ok(!JSON.stringify(decided).includes('BERNARD'));

  // Rejet is the tacit rejection of an incomplete file: refused on the ladder.
  assert.equal(normaliseEpermisRow(NICE, 'decisions', { ...DECIDED, decision: 'Rejet' }).state, 'refuse');
  assert.equal(normaliseEpermisRow(NICE, 'decisions', { ...DECIDED, decision: 'DEFAVORABLE' }).state, 'refuse');
  assert.equal(normaliseEpermisRow(NICE, 'decisions', { ...DECIDED, decision: 'Refus' }).state, 'refuse');
  // A verdict off the ladder keeps its words.
  const odd = normaliseEpermisRow(NICE, 'decisions', { ...DECIDED, decision: 'Sursis à statuer' });
  assert.equal(odd.state, 'depose');
  assert.equal(odd.stateLabel, 'Sursis à statuer');
  // A filing that carries its verdict says it.
  const refused = normaliseEpermisRow(NICE, 'depots', { ...FILING, decision: '"Refus" du 27/08/2026' });
  assert.equal(refused.state, 'refuse');
  assert.equal(refused.decidedOn, '2026-08-27');
  // Not a building authorisation, or no commune in the number: not kept.
  assert.equal(normaliseEpermisRow(NICE, 'depots', { ...FILING, REFERENCE: 'IA0060882600001' }), null);
  assert.equal(normaliseEpermisRow(NICE, 'depots', { ...FILING, REFERENCE: 'DP12' }), null);
});

test('the archive stores a scrubbed row and rebuilds the same dossier from it', () => {
  const cells = scrubEpermisRow(FILING);
  assert.ok(Array.isArray(cells));
  assert.ok(!JSON.stringify(cells).includes('DUPONT'), 'a person never reaches the disk');
  assert.ok(!JSON.stringify(cells).includes('MARTIN'), 'nor an architect');
  assert.ok(!JSON.stringify(cells).includes('900001'), 'nor the platform’s ids');
  assert.ok(JSON.stringify(scrubEpermisRow(DECIDED)).includes('SCI LES EXEMPLES'));
  assert.equal(scrubEpermisRow({ ...FILING, REFERENCE: 'IA0060882600001' }), null);
  assert.deepEqual(normaliseEpermisRow(NICE, 'depots', cells), normaliseEpermisRow(NICE, 'depots', FILING));

  const { archive } = recordCartdsBoards(emptyCartdsArchive(NICE, '06088'), {
    depots: [FILING], decisions: [], other: [FILING],
  }, '2026-10-01', EPERMIS_ROWS);
  assert.equal(archive.rows.length, 1, 'a board the API does not have is not stored');
  assert.equal(archive.rows[0].board, 'depots');
  assert.equal(readCartdsArchive(JSON.parse(JSON.stringify(archive)), NICE, '06088', EPERMIS_ROWS).archive.rows.length, 1);
});

test('the filing and the decision of one dossier fold into one, and meet their Sitadel twin', () => {
  const filed = normaliseEpermisRow(NICE, 'depots', { ...FILING, REFERENCE: 'PC0061472690021', date_demande: '24/06/2026' });
  const decided = normaliseEpermisRow(NICE, 'decisions', { ...DECIDED, nature: '' });
  // A DP with the same digits is another dossier.
  const sameDigits = normaliseEpermisRow(NICE, 'depots', { ...FILING, REFERENCE: 'DP0061472690021' });
  const { permits, folded } = foldCartdsDossiers([filed, decided, sameDigits]);
  assert.equal(folded, 1);
  assert.equal(permits.length, 2);
  const one = permits.find((permit) => permit.kind === 'PC');
  assert.equal(one.state, 'accorde');
  assert.equal(one.decidedOn, '2026-09-30');
  assert.equal(one.purpose, 'Modification des façades et création d\'une piscine', 'the filing fills a blank nature');

  const housing = SITADEL_FILES.find((file) => file.key === 'logements');
  const twin = normaliseSitadelRow(housing, {
    NUM_DAU: '0061472690021', TYPE_DAU: 'PC', ETAT_DAU: '2', COMM: '06147', NB_LGT_TOT_CREES: '1',
  });
  const { permits: merged, merged: count } = mergeRegisters([twin], [one]);
  assert.equal(count, 1);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].sources, ['epermis', 'sitadel']);
  assert.equal(merged[0].housing, 1);
});
