#!/usr/bin/env node
/**
 * Find every Cart@DS and Sirap board that posts permits, and write the ones
 * the layer does not read yet into `src/data/cartdsScanned.js` and
 * `src/data/sirapScanned.js`.
 *
 *   npm run permits:scan                         # ask, then write the module
 *   npm run permits:scan -- --dry-run            # ask and report, write nothing
 *   npm run permits:scan -- --probes <file>      # reuse a saved Cart@DS reading
 *   npm run permits:scan -- --sirap-probes <file> # reuse a saved Sirap reading
 *   npm run permits:scan -- --save <prefix>      # keep both readings, <prefix>.cartds.json and .sirap.json
 *   npm run permits:scan -- --respect-robots     # leave out the boards robots.txt refuses
 *   npm run permits:scan -- --probes <file> --sirap-probes <file> --ask <host>
 *                                                # ask only <host> (a seed) again, keep the rest of both readings
 *   npm run permits:scan -- --probes <file> --sirap-probes <file> --day 2026-10-01
 *                                                # judge saved readings on the day they were read
 *
 * Cart@DS first. The Wayback Machine lists the `geosphere.fr` hosts it has
 * seen (the hosting family most instances run on); the DNS is asked about
 * tenant names guessed from the 6 000 most populous communes and every
 * intercommunality (`tenantGuesses`, about 20 minutes; `--skip-guess` skips
 * it); and {@link CARTDS_SCAN_SEEDS} adds the instances found on other hosts. Each host is asked for its board:
 * the page, its commune menu, and five rows of each of the two boards of every
 * commune — enough to know whether it posts and when it last did, nothing
 * more. Then `keepScannedInstances` keeps the communes that posted within three
 * months and that no other register reads, and the module is written.
 *
 * Then Sirap: each host of {@link SIRAP_SCAN_HOSTS} lists the communes it
 * posts for (`/api/v1/communes`), every one of them is asked for its board
 * once, and `keepScannedSirap` keeps the same way — leaving out a commune the
 * Cart@DS step just kept.
 *
 * A seed added between two scans costs that seed, not a whole scan: `--ask`
 * names it (once per host), and its fresh reading takes the place of its old
 * one — or joins — in the saved readings `--probes` and `--sirap-probes` give.
 *
 * Same identified user agent as the proxy and the sweep, one host at a time per
 * worker, two workers and half a second between requests by default: most
 * hosts are tenants of one hosting family, and reading what the Code de
 * l'urbanisme makes public is no reason to weigh on its servers. Meant to run every quarter: run it, read
 * the diff of `cartdsScanned.js`, run `npm test`, open a pull request.
 */

import { Resolver } from 'node:dns/promises';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  buildCartdsForm,
  parseCartdsCommunes,
  parseCartdsToken,
  robotsAllows,
  CARTDS_DATA_PATH,
  CARTDS_INSTANCES,
  CARTDS_PAGE_PATH,
} from '../src/data/cartdsFeed.js';
import { CARTDS_SCANNED_INSTANCES } from '../src/data/cartdsScanned.js';
import { LOCAL_ADS_PORTALS } from '../src/data/adsFeed.js';
import { SIRAP_INSTANCES } from '../src/data/sirapFeed.js';
import { SIRAP_SCANNED_INSTANCES } from '../src/data/sirapScanned.js';
import { PUBLICATION_ACTES_COMMUNES } from '../src/data/publicationActesFeed.js';
import { EPERMIS_INSTANCES } from '../src/data/epermisFeed.js';
import { PERMIT_LISTS } from '../src/data/permitListsFeed.js';
import { CARTDS_USER_AGENT, trustCartdsIntermediates } from './lib/cartdsArchive.mjs';
import {
  candidatesFromCdx,
  indexCommunes,
  isVendorTenant,
  keepScannedInstances,
  keepScannedSirap,
  renderScannedModule,
  renderSirapModule,
  resolveMenuCommune,
  tenantGuesses,
} from './lib/permitBoardScan.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(REPO_ROOT, 'src', 'data', 'cartdsScanned.js');
const SIRAP_OUTPUT_PATH = path.join(REPO_ROOT, 'src', 'data', 'sirapScanned.js');
const CDX_URL = 'https://web.archive.org/cdx/search/cdx?url=*.geosphere.fr&fl=original&collapse=urlkey&limit=200000';
const COMMUNES_URL = 'https://geo.api.gouv.fr/communes?fields=nom,code,codeDepartement,codeEpci,population&format=json';
const EPCIS_URL = 'https://geo.api.gouv.fr/epcis?fields=nom,code&format=json';
const TIMEOUT_MS = 25_000;

/**
 * Cart@DS instances on hosts outside `geosphere.fr`, which neither the archive
 * nor the DNS can name. Found by reading the sites of the 1 000 most populous
 * communes on 2026-10-01 (`.context`-only crawler, not kept): every board they
 * linked that answered with a commune that had posted. An empty prefix is a
 * board at the root of its host. Add one here when a commune's site links a
 * board elsewhere.
 */
export const CARTDS_SCAN_SEEDS = Object.freeze([
  Object.freeze({ host: 'ads-sig.douarnenez.bzh', prefixes: Object.freeze(['/guichet-unique']) }),
  // Two boards on one host, one per instruction service: the archive saw
  // Doué's, with one commune; Saumur's, with 17, is under this path (2026-10-03).
  Object.freeze({ host: 'saumurvaldeloire.geosphere.fr', prefixes: Object.freeze(['/guichet-saumur', '/guichet-doue']) }),
  // Voiron's own board, linked from its site (2026-10-03).
  Object.freeze({ host: 'portail-urbanisme.ville-voiron.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'demarche-urbanisme.la-seyne.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'demarches-urbanisme.ville-massy.fr', prefixes: Object.freeze(['']) }),
  Object.freeze({ host: 'demat-urb.vlpm.com', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'gfi.roquebrune.com', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'guichet-unique-bobigny.siib.fr', prefixes: Object.freeze(['']) }),
  Object.freeze({ host: 'guichet.clichysousbois.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'intrageo.dax.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'sig.grand-dole.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urba.marneetgondoire.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urba.plainecommune.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.cap-atlantique.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.chateauneuf-les-martigues.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.istres.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.mairie-hyeres.com', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.mairie-miramas.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.mairie-toulon.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.saint-andre.re', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.ville-douai.fr', prefixes: Object.freeze(['/droit-du-sol']) }),
  Object.freeze({ host: 'urbanisme.ville-gardanne.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  // Found on 2026-10-01 by checking the communes ranked 61 to 200 by hand, and
  // by searching the web for the board's path, `Login/AffichageReglementaire`.
  Object.freeze({ host: 'ads.bourgesplus.fr', prefixes: Object.freeze(['/guichet']) }),
  Object.freeze({ host: 'clicurba.ivry94.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'demarche-urbanisme.ccpro.fr', prefixes: Object.freeze(['']) }),
  Object.freeze({ host: 'demarches-urbanisme.ville-clichy.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'demarches-urbanisme.vincennes.fr', prefixes: Object.freeze(['']) }),
  Object.freeze({ host: 'dia.neuillysurseine.fr', prefixes: Object.freeze(['/portail']) }),
  Object.freeze({ host: 'portail-urbanisme.cc-vallee-herault.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'portail-urbanisme.sanarysurmer.com', prefixes: Object.freeze(['']) }),
  Object.freeze({ host: 'urbanisme.choisyleroi.fr', prefixes: Object.freeze(['']) }),
  Object.freeze({ host: 'urbanisme.gmvagglo.bzh', prefixes: Object.freeze(['/guichetunique']) }),
  Object.freeze({ host: 'urbanisme.mairie-foix.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.portededromardeche.fr', prefixes: Object.freeze(['']) }),
  Object.freeze({ host: 'urbanisme.saintnazaireagglo.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  // Draguignan's former geosphere tenant moved to the agglomeration's host;
  // its own website links /portailccs, which redirects to /guichet-unique.
  Object.freeze({ host: 'ads.dracenie.com', prefixes: Object.freeze(['/guichet-unique']) }),
  // Public intercommunal boards found while checking municipalities below
  // the 400 most populous on 2026-10-02; their sites link these hosts.
  Object.freeze({ host: 'urbanisme.lannion-tregor.com', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'sig.clissonsevremaine.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'gu-capca.numerian.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'gu-diois.numerian.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'gu-ccdraga.numerian.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.cc-sms.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'sig.lsoagglo.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'gu.entre-bievreetrhone.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'portail.grandverdun.fr', prefixes: Object.freeze(['']) }),
  // Found on 2026-10-02 by searching the web and certificate logs for boards
  // on hosts of their own, and by checking the communes of the Paris inner
  // ring by hand: Bayonne, Colomiers, Kourou, Valenton, and three communes of
  // Les Sables d'Olonne Agglomération.
  Object.freeze({ host: 'portailurbanisme.bayonne.fr', prefixes: Object.freeze(['']) }),
  Object.freeze({ host: 'urbanisme.ville-kourou.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.ville-valenton.fr', prefixes: Object.freeze(['']) }),
  Object.freeze({ host: 'urbausagers.mairie-colomiers.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  // Found on 2026-10-02 in certificate logs, the Wayback Machine and the
  // service-public directory of filing portals: Lannion-Trégor Communauté's,
  // the Landes's ADACL, five Numérian hosts and five more.
  Object.freeze({ host: 'ads.adacl40.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'cartads.communaute-coutances.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'gu-ara.numerian.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'gu-valeyrieux.numerian.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'paysdelor.geosphere.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.payssaintgilles.fr', prefixes: Object.freeze(['']) }),
  Object.freeze({ host: 'ads.paysvoironnais.com', prefixes: Object.freeze(['/guichet-unique']) }),
  // Found on 2026-10-03 by asking the usual ADS sub-domains of every
  // intercommunality's and uncovered commune's website. Installed, menu or
  // rows empty that day — Metz Métropole's new host until its migration ends
  // on 8 October, the others since R.423-6 leaves posting online optional:
  // each scan asks them again. Those that posted are written by hand in
  // `cartdsFeed.js`.
  Object.freeze({ host: 'urbanisme-eurometropolemetz.geosphere.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'sig.saint-lo-agglo.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'sig.rlv.eu', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.cc-paysdesachards.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'sig.creusot-montceau.org', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'ads.larochesuryon.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'cartads.cc-sevreloire.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'portailurbanisme.pevelecarembault.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.saintgervais.com', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'portail-urbanisme.ville-chaville.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.ville-yzeure.com', prefixes: Object.freeze(['']) }),
  Object.freeze({ host: 'urba.boucbelair.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.livry-gargan.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.colombes.fr', prefixes: Object.freeze(['/guichet-unique']) }),
  Object.freeze({ host: 'urbanisme.ville-bonneuil.fr', prefixes: Object.freeze(['']) }),
  Object.freeze({ host: 'urbanisme.ville-chamalieres.fr', prefixes: Object.freeze(['']) }),
]);

/**
 * Sirap PU hosts. Sirap's shared portal posts for communes all over France;
 * the others were linked from the sites of the 1 000 most populous communes on
 * 2026-10-01. `*.pu.sirap.com` is a wildcard certificate and DNS name, so no
 * list of tenants exists outside the communes' own sites.
 */
export const SIRAP_SCAN_HOSTS = Object.freeze([
  'portail-usager.sirap.com',
  'cholet.pu.sirap.com',
  'smica.pu.sirap.com',
  'rosselle.pu.sirap.com',
  'rgd.pu.sirap.com',
  // Villejuif's own host, found on 2026-10-01; its list names Villejuif alone.
  'urbanisme.villejuif.fr',
  // Lapalud's own municipal website links this tenant. Its board posts even
  // though the shared portal's commune list did not name it on 2026-10-01.
  'lapalud.pu.sirap.com',
  // Found on 2026-10-02 in the Wayback Machine's list of `*.pu.sirap.com`
  // names: intercommunal instruction services, each naming its own tenant
  // (an unknown name answers the shared portal's whole list).
  '4b.pu.sirap.com',
  'apgl.pu.sirap.com',
  'ccbg.pu.sirap.com',
  'ccgvm.pu.sirap.com',
  'ccpv.pu.sirap.com',
  'charente-limousine.pu.sirap.com',
  'coeurdecharente.pu.sirap.com',
  'matheysine.pu.sirap.com',
  'ossau.pu.sirap.com',
  'pays-ancenis.pu.sirap.com',
  'payssudtoulousain.pu.sirap.com',
  'reolais-sud-gironde.pu.sirap.com',
  'rochefoucauld-perigord.pu.sirap.com',
  'sieeen.pu.sirap.com',
  'supv.pu.sirap.com',
  'valdamboise.pu.sirap.com',
  'valdecharente.pu.sirap.com',
  // The Ain's SIEA moved its public portal to this host in December 2025.
  // Bugey-Sud and municipal websites link it; it uses the same PU API.
  'puu.siea-sig.fr',
  // Tenants of the `*.pu.sirap.com` wildcard named by guessing, on 2026-10-01
  // (the Wayback Machine's `sve-<tenant>.sirap.fr`) and 2026-10-03 (names
  // drawn from intercommunalities, syndicates and communes; an unknown name
  // answers the default catalogue). The first five post and are written by
  // hand in `sirapFeed.js`; the others list their communes but posted
  // nothing in three months, and each scan asks them again.
  'ccbjc.pu.sirap.com', 'ccpt.pu.sirap.com', 'ltd.pu.sirap.com', 'valreas.pu.sirap.com', 'duras.pu.sirap.com',
  'catlp.pu.sirap.com', 'ccvg.pu.sirap.com', 'paysdumans.pu.sirap.com', 'portesdemeuse.pu.sirap.com',
  'ccpl.pu.sirap.com', 'cceppg.pu.sirap.com', 'bvc.pu.sirap.com', 'ccyn.pu.sirap.com', 'celavu.pu.sirap.com',
  'paysdephalsbourg.pu.sirap.com', 'cc-genevois.pu.sirap.com', 'ccbpam.pu.sirap.com', 'ccdoreallier.pu.sirap.com',
  'cdcba.pu.sirap.com', 'cdcmedullienne.pu.sirap.com', 'cinl.pu.sirap.com', 'ads.pu.sirap.com',
  'monautorisationdurbanisme-ccbbo.pu.sirap.com', 'pln.pu.sirap.com', 'urbanisme-vic-bigorre.pu.sirap.com',
  'urbabressebourguignonne.pu.sirap.com', 'noirmoutier.pu.sirap.com', 'sdeeg33.pu.sirap.com',
  'courtomer.pu.sirap.com', 'saintleulaforet.pu.sirap.com', 'montbonnot-saint-martin.pu.sirap.com',
]);

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    probes: { type: 'string' },
    'sirap-probes': { type: 'string' },
    'skip-guess': { type: 'boolean', default: false },
    'respect-robots': { type: 'boolean', default: false },
    save: { type: 'string' },
    ask: { type: 'string', multiple: true, default: [] },
    concurrency: { type: 'string', default: '2' },
    pause: { type: 'string', default: '500' },
    day: { type: 'string' },
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url, init = {}) {
  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': CARTDS_USER_AGENT, ...(init.headers ?? {}) },
    });
    return { response, text: await response.text() };
  } catch (error) {
    return { error: String(error.cause?.code ?? error.message) };
  }
}

async function getJson(url) {
  const { response, text, error } = await request(url);
  if (error || !response.ok) throw new Error(`${url}: ${error ?? response.status}`);
  return JSON.parse(text);
}

/** Five rows of one board: how many it holds and the latest posting day. */
async function peekBoard(base, session, commune, board) {
  const { response, text, error } = await request(`${base}${CARTDS_DATA_PATH}`, {
    method: 'POST',
    body: buildCartdsForm({ commune, board, token: session.token, length: 5 }),
    headers: {
      Cookie: session.cookie,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  if (error || !response.ok) return { error: error ?? `http ${response.status}` };
  try {
    const answer = JSON.parse(text);
    if (!Array.isArray(answer.data)) return { error: 'no data' };
    return { total: Number(answer.recordsTotal) || 0, latest: answer.data[0]?.[0] ?? null };
  } catch {
    return { error: 'not json' };
  }
}

/** One host: robots.txt, the board page on each candidate path, every commune's two boards. */
async function probeHost(candidate, pauseMs) {
  const probe = { host: candidate.host, base: null, tried: [] };
  const origin = `https://${candidate.host}`;
  const robots = await request(`${origin}/robots.txt`);
  const robotsText = robots.response?.ok ? robots.text : null;
  probe.robots5xx = Boolean(robots.response && robots.response.status >= 500);
  for (const prefix of candidate.prefixes) {
    const base = `${origin}${prefix}`;
    const page = await request(`${base}${CARTDS_PAGE_PATH}`);
    probe.tried.push(`${prefix} ${page.error ?? page.response.status}`);
    if (page.error || !page.response.ok) continue;
    const token = parseCartdsToken(page.text);
    const cookie = (page.response.headers.getSetCookie?.() ?? [])
      .map((line) => line.split(';')[0].trim()).filter(Boolean).join('; ');
    if (!token || !cookie) continue;
    probe.base = page.response.url.replace(/\/Login\/AffichageReglementaire.*$/i, '');
    const basePath = new URL(probe.base).pathname.replace(/\/$/, '');
    probe.robotsAllows = robotsText === null
      ? null
      : robotsAllows(robotsText, `${basePath}${CARTDS_PAGE_PATH}`) && robotsAllows(robotsText, `${basePath}${CARTDS_DATA_PATH}`);
    probe.communes = [];
    for (const entry of parseCartdsCommunes(page.text)) {
      if (!entry.value || /^-?0?$/.test(entry.value)) continue;
      await sleep(pauseMs);
      const filings = await peekBoard(probe.base, { token, cookie }, entry.value, '1');
      await sleep(pauseMs);
      const decisions = await peekBoard(probe.base, { token, cookie }, entry.value, '2');
      probe.communes.push({
        value: entry.value,
        name: entry.name,
        filings: filings.total ?? filings.error,
        decisions: decisions.total ?? decisions.error,
        latestFiling: filings.latest ?? null,
        latestDecision: decisions.latest ?? null,
      });
    }
    break;
  }
  return probe;
}

/** The guessed `geosphere.fr` tenants the DNS knows. */
async function guessedTenants(communes, epcis) {
  const resolver = new Resolver({ timeout: 4000, tries: 2 });
  const names = tenantGuesses(communes, epcis).map((name) => `${name}.geosphere.fr`);
  const found = [];
  let next = 0;
  const worker = async () => {
    while (next < names.length) {
      const host = names[next++];
      try { await resolver.resolve4(host); found.push(host); } catch { /* no such tenant */ }
    }
  };
  await Promise.all(Array.from({ length: 48 }, worker));
  console.log(`[permits-scan] DNS: ${found.length} of ${names.length} guessed tenants exist`);
  return found.map((host) => ({ host, prefixes: ['/guichet-unique'] }));
}

/**
 * The tenants the Wayback Machine has seen, or none when it does not answer.
 * It was down twice on 2026-10-01 (HTTP 503); the scan then goes on with the
 * previous scan's hosts, the DNS and the seeds, and says so.
 */
async function archivedTenants() {
  for (const wait of [0, 15_000, 60_000]) {
    await sleep(wait);
    const { response, text, error } = await request(CDX_URL);
    if (!error && response.ok) return candidatesFromCdx(text.split('\n'), 'geosphere.fr');
    console.warn(`[permits-scan] Wayback CDX: ${error ?? response.status}`);
  }
  console.warn('[permits-scan] Wayback CDX unavailable: going on without the archive\'s list');
  return [];
}

async function readProbes(communes, epcis) {
  if (values.probes) {
    const saved = JSON.parse(await fsp.readFile(path.resolve(values.probes), 'utf8'));
    const asked = CARTDS_SCAN_SEEDS.filter((seed) => values.ask.includes(seed.host));
    if (!asked.length) return saved;
    trustCartdsIntermediates(CARTDS_INSTANCES);
    const fresh = [];
    for (const candidate of asked) {
      const probe = await probeHost(candidate, Number(values.pause));
      console.log(`[permits-scan] asked ${candidate.host}: ${probe.base ? `${probe.communes.length} communes` : `no board (${probe.tried.join(', ')})`}`);
      fresh.push(probe);
    }
    return [...saved.filter((probe) => !asked.some((seed) => seed.host === probe.host)), ...fresh]
      .sort((a, b) => a.host.localeCompare(b.host));
  }
  const known = new Set(CARTDS_INSTANCES.filter((i) => !CARTDS_SCANNED_INSTANCES.includes(i)).map((i) => new URL(i.base).host));
  // What the last scan kept is always asked again, whatever the archive forgets.
  const previous = CARTDS_SCANNED_INSTANCES.map((instance) => {
    const url = new URL(instance.base);
    return { host: url.host, prefixes: [url.pathname.replace(/\/$/, '')] };
  });
  const archived = await archivedTenants();
  const guessed = values['skip-guess'] ? [] : await guessedTenants(communes, epcis);
  const seen = new Set();
  // A seed is chosen by hand, path included: it comes first, so that a host whose
  // archive or last scan names another board is asked for the seed's.
  const candidates = [...CARTDS_SCAN_SEEDS, ...previous, ...archived, ...guessed]
    .filter((candidate) => !known.has(candidate.host) && !isVendorTenant(candidate.host)
      && !seen.has(candidate.host) && seen.add(candidate.host));
  console.log(`[permits-scan] ${candidates.length} hosts to ask`);
  trustCartdsIntermediates(CARTDS_INSTANCES);
  const probes = [];
  let next = 0;
  const worker = async () => {
    while (next < candidates.length) {
      const candidate = candidates[next++];
      const probe = await probeHost(candidate, Number(values.pause));
      probes.push(probe);
      const posting = (probe.communes ?? []).filter((c) => (Number(c.filings) || 0) + (Number(c.decisions) || 0) > 0).length;
      console.log(`[permits-scan] ${probes.length}/${candidates.length} ${candidate.host}: `
        + (probe.base ? `${probe.communes.length} communes, ${posting} posting` : `no board (${probe.tried.join(', ')})`));
    }
  };
  await Promise.all(Array.from({ length: Number(values.concurrency) }, worker));
  return probes.sort((a, b) => a.host.localeCompare(b.host));
}

/** One Sirap host: its commune list, then each board once — how many rows, the latest day. */
async function probeSirapHost(host, day, pauseMs) {
  const listed = [];
  for (let page = 0; page < 500; page += 1) {
    const { response, text, error } = await request(`https://${host}/api/v1/communes?page=${page}`);
    if (error || !response.ok) break;
    let answer;
    try { answer = JSON.parse(text); } catch { break; }
    if (!Array.isArray(answer.list) || !answer.list.length) break;
    listed.push(...answer.list);
    if (listed.length >= Number(answer.count)) break;
    await sleep(pauseMs);
  }
  const probe = { host, communes: [] };
  let next = 0;
  const worker = async () => {
    while (next < listed.length) {
      const commune = listed[next++];
      await sleep(pauseMs);
      const { response, text, error } = await request(`https://${host}/api/v1/communes/${commune.insee}/affichage-reglementaire`);
      let rows = null;
      try { rows = !error && response.ok ? JSON.parse(text) : null; } catch { rows = null; }
      if (!Array.isArray(rows)) { probe.communes.push({ insee: commune.insee, name: commune.name, error: error ?? response.status }); continue; }
      const days = rows.flatMap((row) => [row.dateDepot, row.dateDecision])
        .filter(Boolean).map((value) => String(value).slice(0, 10)).filter((value) => value <= day).sort();
      probe.communes.push({ insee: commune.insee, name: commune.name, rows: rows.length, latest: days.at(-1) ?? null });
    }
  };
  await Promise.all(Array.from({ length: Number(values.concurrency) }, worker));
  console.log(`[permits-scan] ${host}: ${listed.length} communes listed, `
    + `${probe.communes.filter((c) => c.rows).length} with a board`);
  return probe;
}

// A saved reading is judged on the day it was read: judged a day later, a
// commune whose last row is 92 days old falls out of the window and off the
// layer, for no reason the boards gave.
const day = values.day ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`--day ${day}: expected yyyy-mm-dd`);
const unknownAsks = values.ask.filter((host) => !CARTDS_SCAN_SEEDS.some((seed) => seed.host === host) && !SIRAP_SCAN_HOSTS.includes(host));
if (unknownAsks.length) console.warn(`[permits-scan] --ask names no seed: ${unknownAsks.join(' ')} (add it to CARTDS_SCAN_SEEDS or SIRAP_SCAN_HOSTS first)`);
const [communes, epcis] = await Promise.all([getJson(COMMUNES_URL), getJson(EPCIS_URL)]);
const probes = await readProbes(communes, epcis);
const sirapProbes = values['sirap-probes']
  ? await (async () => {
    const saved = JSON.parse(await fsp.readFile(path.resolve(values['sirap-probes']), 'utf8'));
    const asked = SIRAP_SCAN_HOSTS.filter((host) => values.ask.includes(host));
    const fresh = [];
    for (const host of asked) fresh.push(await probeSirapHost(host, day, Number(values.pause)));
    // In SIRAP_SCAN_HOSTS order, as a whole scan writes them.
    const all = [...saved.filter((probe) => !asked.includes(probe.host)), ...fresh];
    return all.sort((a, b) => SIRAP_SCAN_HOSTS.indexOf(a.host) - SIRAP_SCAN_HOSTS.indexOf(b.host));
  })()
  : await (async () => {
    const out = [];
    for (const host of SIRAP_SCAN_HOSTS) out.push(await probeSirapHost(host, day, Number(values.pause)));
    return out;
  })();
if (values.save) {
  await fsp.writeFile(path.resolve(`${values.save}.cartds.json`), JSON.stringify(probes, null, 1));
  await fsp.writeFile(path.resolve(`${values.save}.sirap.json`), JSON.stringify(sirapProbes, null, 1));
}

const index = indexCommunes(communes);
for (const probe of probes) {
  const entries = probe.communes ?? [];
  const departments = new Set();
  for (const entry of entries) {
    entry.insee = resolveMenuCommune(entry, index);
    if (entry.insee) departments.add(index.byCode.get(entry.insee).codeDepartement);
  }
  for (const entry of entries) if (!entry.insee) entry.insee = resolveMenuCommune(entry, index, departments);
}

const claimed = new Map();
const claim = (codes, register) => codes.forEach((code) => claimed.has(code) || claimed.set(code, register));
for (const instance of CARTDS_INSTANCES) if (!CARTDS_SCANNED_INSTANCES.includes(instance)) claim(instance.communes, `cartds:${instance.key}`);
for (const portal of LOCAL_ADS_PORTALS) claim(portal.communes, `portal:${portal.key}`);
for (const instance of SIRAP_INSTANCES) if (!SIRAP_SCANNED_INSTANCES.includes(instance)) claim(instance.communes, `sirap:${instance.key}`);
claim(PUBLICATION_ACTES_COMMUNES.map((commune) => commune.insee), 'publication-actes');
for (const instance of EPERMIS_INSTANCES) claim(instance.communes, `epermis:${instance.key}`);
// A commune a municipal list or a board protocol already reads (Clermont-Ferrand's PDF lists,
// though Clermont Auvergne Métropole's board names it too) is read from one register only.
for (const city of PERMIT_LISTS) claim([city.insee, ...(city.communes ?? [])], `list:${city.key}`);

const epciNames = new Map(epcis.map((epci) => [epci.code, epci.nom]));
const { instances, skipped } = keepScannedInstances({
  probes, index, claimed, epciNames, day, respectRobots: values['respect-robots'],
});
claim(instances.flatMap((instance) => instance.communes), 'cartds:scanned');
const sirapInstances = keepScannedSirap({ probes: sirapProbes, index, claimed, day });

const population = new Map(communes.map((commune) => [commune.code, commune.population ?? 0]));
const kept = [...instances, ...sirapInstances].flatMap((instance) => instance.communes);
const inhabitants = kept.reduce((sum, code) => sum + (population.get(code) ?? 0), 0);
const total = communes.reduce((sum, commune) => sum + (commune.population ?? 0), 0);
const unresolved = probes.flatMap((probe) => (probe.communes ?? []).filter((c) => !c.insee).map((c) => `${probe.host}:${c.name}`));
const sirapKept = sirapInstances.reduce((sum, instance) => sum + instance.communes.length, 0);
console.log(`[permits-scan] ${day}: Cart@DS ${probes.length} hosts, ${probes.filter((p) => p.base).length} boards, `
  + `${instances.length} instances kept; Sirap ${sirapKept} communes kept; `
  + `${kept.length} communes in all, ${inhabitants} inhabitants `
  + `(${((100 * inhabitants) / total).toFixed(2)} % of the population)`);
const reasons = Map.groupBy(skipped, (skip) => skip.why);
for (const [why, hosts] of reasons) {
  console.log(`[permits-scan] ${hosts.length} boards skipped, ${why}: ${hosts.slice(0, 12).map((skip) => skip.host).join(' ')}${hosts.length > 12 ? ' …' : ''}`);
}
if (unresolved.length) console.log(`[permits-scan] menu entries matching no commune: ${unresolved.join(', ')}`);

if (!values['dry-run']) {
  const source = renderScannedModule(instances, {
    day, hosts: probes.length, boards: probes.filter((probe) => probe.base).length,
  });
  await fsp.writeFile(OUTPUT_PATH, source);
  const listed = sirapProbes.reduce((sum, probe) => sum + (probe.communes?.length ?? 0), 0);
  await fsp.writeFile(SIRAP_OUTPUT_PATH, renderSirapModule(sirapInstances, { day, hosts: sirapProbes.length, listed }));
  console.log(`[permits-scan] wrote ${path.relative(REPO_ROOT, OUTPUT_PATH)} and ${path.relative(REPO_ROOT, SIRAP_OUTPUT_PATH)}`);
}
