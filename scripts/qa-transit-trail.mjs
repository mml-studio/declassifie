#!/usr/bin/env node
/**
 * qa-transit-trail — the trail behind a selected bus, first on a warm page,
 * then after a reload.
 *
 * Opens Bordeaux, turns `transit-fr` on and lets the proxy decode a few feed
 * bodies, then picks the vehicle in view whose server trail has the most
 * fixes, selects it, frames it and screenshots. Then reloads the page, selects
 * the same vehicle as soon as it is drawn, and reports how long the trail
 * took to show more than one fix — the server's rings are what make that
 * immediate rather than one poll per point.
 *
 * Writes to gitignored qa-shots/: `transit-trail-<tag>.png`,
 * `transit-trail-<tag>-reload.png` and `transit-trail-<tag>.json`.
 *
 * Usage: node scripts/qa-transit-trail.mjs --url http://127.0.0.1:4173 --tag after [--warm-sec 60]
 */
import puppeteer from 'puppeteer';
import { newQaPage } from './lib/qa-first-run.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv;
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const base = arg('--url', 'http://localhost:4173').replace(/\/$/, '');
const tag = arg('--tag', 'shot');
const warmSec = Number(arg('--warm-sec', '60')) || 60;
const outDir = new URL('../qa-shots/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const out = (name) => new URL(`transit-trail-${tag}${name}`, outDir).pathname;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const APP = `${base}/globe?welcome=0&photoreal=0#lat=44.8400&lon=-0.5750&alt=3500&heading=0&pitch=-70`;

async function openWithTransit(page) {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__godsEyeView?.dataManager, { timeout: 120_000 });
  await sleep(5_000);
  await page.evaluate(async () => {
    const dm = window.__godsEyeView.dataManager;
    if (!dm.layers.get('transit-fr').enabled) await dm.toggle('transit-fr');
  });
  await page.waitForFunction(
    () => (window.__godsEyeView.dataManager.layers.get('transit-fr').module.getStats().count || 0) >= 10,
    { timeout: 120_000 },
  );
}

/** The trail as drawn: body points and whether the head segment is live. */
function readTrail(page) {
  return page.evaluate(() => {
    const { viewer } = window.__godsEyeView;
    const now = viewer.clock.currentTime;
    let body = 0;
    let head = 0;
    for (const entity of viewer.entities.values) {
      if (!String(entity.id).startsWith('gev-trail:')) continue;
      const positions = entity.polyline?.positions?.getValue(now) || [];
      if (String(entity.id).includes('transit-fr-head')) head = positions.length;
      else if (entity.show !== false) body = Math.max(body, positions.length);
    }
    return { body, head };
  });
}

async function frame(page, id) {
  await page.evaluate((vehicleId) => {
    const { viewer } = window.__godsEyeView;
    const info = window.__godsEyeView.dataManager.layers.get('transit-fr').module.getSelectedInfo?.();
    const lat = info?.lat ?? info?.position?.lat;
    const lon = info?.lon ?? info?.position?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const Cartesian3 = viewer.camera.position.constructor;
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(lon, lat - 0.009, 1100),
      orientation: { heading: 0, pitch: -Math.PI / 3.2, roll: 0 },
    });
  }, id);
  await sleep(4_000);
}

const browser = await puppeteer.launch({
  headless: 'new',
  protocolTimeout: 300_000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
});
const report = { tag };
try {
  const page = await newQaPage(browser);
  await page.setViewport({ width: 1440, height: 900 });
  await openWithTransit(page);
  console.log(`warming the proxy for ${warmSec} s…`);
  await sleep(warmSec * 1000);

  const pick = await page.evaluate(async () => {
    const layer = window.__godsEyeView.dataManager.layers.get('transit-fr').module;
    const response = await fetch('/api/transit-fr/vehicles?south=44.80&west=-0.63&north=44.88&east=-0.52');
    const body = await response.json();
    const moving = (body.vehicles || []).filter((vehicle) => (vehicle.speedMps || 0) > 3).slice(0, 40);
    let best = null;
    for (const vehicle of moving) {
      const trail = await (await fetch(`/api/transit-fr/trail?id=${encodeURIComponent(vehicle.id)}`)).json();
      const fixes = trail.fixes?.length || 0;
      if (fixes > (best?.fixes || 0) && layer.selectCard(vehicle.id)) best = { id: vehicle.id, fixes };
    }
    if (best) layer.selectCard(best.id);
    return best;
  });
  if (!pick) throw new Error('no moving vehicle with a server trail');
  report.vehicle = pick;
  console.log(`selected ${pick.id}: ${pick.fixes} fixes kept by the server`);
  await frame(page, pick.id);
  report.warm = await readTrail(page);
  console.log(`warm page: trail body ${report.warm.body} points, head ${report.warm.head}`);
  await page.screenshot({ path: out('.png') });

  const started = Date.now();
  await openWithTransit(page);
  await page.waitForFunction(
    (id) => window.__godsEyeView.dataManager.layers.get('transit-fr').module.selectCard(id),
    { timeout: 60_000, polling: 250 },
    pick.id,
  ).catch(() => {});
  const selectedAt = Date.now();
  let shownAt = null;
  for (let i = 0; i < 40; i += 1) {
    const trail = await readTrail(page);
    if (trail.body >= 2) {
      shownAt = Date.now();
      report.reload = { ...trail, msAfterSelect: shownAt - selectedAt, msAfterReload: shownAt - started };
      break;
    }
    await sleep(250);
  }
  if (!shownAt) report.reload = { ...(await readTrail(page)), msAfterSelect: null };
  console.log(`after reload: ${JSON.stringify(report.reload)}`);
  await frame(page, pick.id);
  await page.screenshot({ path: out('-reload.png') });
  writeFileSync(out('.json'), JSON.stringify(report, null, 2));
  console.log(`saved ${out('.json')}`);
} finally {
  await browser.close();
}
