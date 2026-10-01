#!/usr/bin/env node
/**
 * qa-cctv-plane-lift — how far each Lyon camera's monitor plane stands above
 * (or sinks below) the ground under it, and a picture of one plane.
 *
 * For every Lyon camera in the catalog: activate it, give the footprint
 * lookup time to land, then read the plane's four corners off the rendered
 * wireframe and ask `/api/terrain/heights` (the same Re:Earth DEM the layer
 * uses) for the ground under the bottom-left, bottom-middle and bottom-right
 * of the plane. A negative clearance is frame drawn underground: the terrain
 * hides it.
 *
 * Writes to gitignored qa-shots/: `cctv-plane-<tag>.json` and, for the camera
 * named by --shot (default: the camera whose bottom edge sinks deepest), a
 * view from behind the camera `cctv-plane-<tag>.png`.
 *
 * Usage: node scripts/qa-cctv-plane-lift.mjs --url http://127.0.0.1:4173 --tag after [--shot lyon-cwl9018]
 *        [--only lyon-cwml005] [--photoreal]
 *
 * `--photoreal` boots on Google's 3D tiles, where the tiles hide whatever the
 * plane draws underground (on the OSM globe Cesium draws it through the
 * terrain). It costs one billed ion session per run — see qa-first-run.mjs.
 */
import puppeteer from 'puppeteer';
import { newQaPage } from './lib/qa-first-run.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv;
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const base = arg('--url', 'http://localhost:4173').replace(/\/$/, '');
const tag = arg('--tag', 'shot');
const shotId = arg('--shot', null);
const settleMs = Number(arg('--settle-ms', '4000')) || 4000;
const only = arg('--only', null);
const photoreal = argv.includes('--photoreal');
const outDir = new URL('../qa-shots/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const out = (ext) => new URL(`cctv-plane-${tag}.${ext}`, outDir).pathname;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  headless: 'new',
  protocolTimeout: 300_000,
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
  ],
});
try {
  const page = await newQaPage(browser, { photoreal });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${base}/globe?welcome=0${photoreal ? '' : '&photoreal=0'}#lat=45.7578&lon=4.8320&alt=3000&heading=0&pitch=-60`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => !!window.__godsEyeView?.dataManager, { timeout: 120_000 });
  await sleep(6_000);
  await page.evaluate(async () => {
    const dm = window.__godsEyeView.dataManager;
    if (!dm.layers.get('cctv').enabled) await dm.toggle('cctv');
  });
  await page.waitForFunction(
    () => (window.__godsEyeView.dataManager.layers.get('cctv').module.getUIState().cameras || []).length > 0,
    { timeout: 90_000 },
  );
  const ids = await page.evaluate((onlyId) => window.__godsEyeView.dataManager.layers.get('cctv').module
    .getUIState().cameras.map((c) => c.id)
    .filter((id) => (onlyId ? id === onlyId : id.startsWith('lyon-'))), only);
  if (!ids.length) throw new Error('no Lyon camera in the catalog');

  const rows = [];
  for (const id of ids) {
    await page.evaluate((cameraId) => {
      window.__godsEyeView.dataManager.layers.get('cctv').module.setParams({ selectedCameraId: cameraId });
    }, id);
    await page.waitForFunction(
      (cameraId) => window.__godsEyeView.dataManager.layers.get('cctv').module.getUIState().activeCameraId === cameraId,
      { timeout: 30_000 },
      id,
    );
    await sleep(settleMs);
    const row = await page.evaluate(async (cameraId) => {
      const { viewer } = window.__godsEyeView;
      const Cartographic = viewer.camera.positionCartographic.constructor;
      const toDeg = (rad) => (rad * 180) / Math.PI;
      const cap = viewer.entities.getById(`cctv-${cameraId}-cap`);
      const ray = viewer.entities.getById(`cctv-${cameraId}-ray-bl`);
      if (!cap || !ray) return { id: cameraId, error: 'no wireframe entities' };
      const now = viewer.clock.currentTime;
      const [tl, tr, br, bl] = cap.polyline.positions.getValue(now);
      const [mount] = ray.polyline.positions.getValue(now);
      const Cartesian3 = tl.constructor;
      const bm = Cartesian3.midpoint(bl, br, new Cartesian3());
      const carto = (point) => {
        const c = Cartographic.fromCartesian(point);
        return { lat: toDeg(c.latitude), lon: toDeg(c.longitude), alt: c.height };
      };
      const corners = { tl: carto(tl), tr: carto(tr), br: carto(br), bl: carto(bl), bm: carto(bm), mount: carto(mount) };
      const bottom = ['bl', 'bm', 'br'];
      const query = bottom.map((key) => `${corners[key].lon.toFixed(6)},${corners[key].lat.toFixed(6)}`).join(';');
      const resp = await fetch(`/api/terrain/heights?points=${encodeURIComponent(query)}`);
      const body = await resp.json().catch(() => ({}));
      const ground = {};
      bottom.forEach((key, index) => { ground[key] = body.results?.[index]?.ellipsoid ?? null; });
      const clearance = {};
      for (const key of bottom) {
        clearance[key] = Number.isFinite(ground[key]) ? corners[key].alt - ground[key] : null;
      }
      const frameHeight = corners.tl.alt - corners.bl.alt;
      const worst = Math.min(...bottom.map((key) => clearance[key]).filter(Number.isFinite));
      return {
        id: cameraId,
        mountAltM: corners.mount.alt,
        bottomAltM: { bl: corners.bl.alt, bm: corners.bm.alt, br: corners.br.alt },
        topAltM: corners.tl.alt,
        groundM: ground,
        clearanceM: clearance,
        worstClearanceM: worst,
        frameHeightM: frameHeight,
        underground: Number.isFinite(worst) && worst < 0 ? Math.min(1, -worst / frameHeight) : 0,
      };
    }, id);
    rows.push(row);
    console.log(`${id}: worst bottom clearance ${Number(row.worstClearanceM).toFixed(1)} m, `
      + `${(100 * (row.underground || 0)).toFixed(0)}% of the frame height underground`);
  }

  const sunk = rows.filter((row) => Number.isFinite(row.worstClearanceM) && row.worstClearanceM < 0);
  const summary = {
    tag,
    cameras: rows.length,
    sunk: sunk.length,
    medianUnderground: (() => {
      const values = rows.map((row) => row.underground || 0).sort((a, b) => a - b);
      return values.length ? values[Math.floor(values.length / 2)] : null;
    })(),
    rows,
  };
  writeFileSync(out('json'), JSON.stringify(summary, null, 2));
  console.log(`${sunk.length}/${rows.length} planes sink below the ground; median ${(100 * summary.medianUnderground).toFixed(0)}% of the frame underground`);

  const target = shotId && ids.includes(shotId)
    ? shotId
    : [...rows].sort((a, b) => (a.worstClearanceM ?? 0) - (b.worstClearanceM ?? 0))[0]?.id;
  if (target) {
    await page.evaluate((cameraId) => {
      const layer = window.__godsEyeView.dataManager.layers.get('cctv').module;
      layer.setParams({ selectedCameraId: cameraId });
    }, target);
    await sleep(settleMs);
    await page.evaluate((cameraId) => {
      window.__godsEyeView.dataManager.layers.get('cctv').module.focusCamera(cameraId, 0.2);
    }, target);
    await sleep(8_000);
    await page.screenshot({ path: out('png') });
    console.log(`saved ${out('png')} (${target})`);
  }
  console.log(`saved ${out('json')}`);
} finally {
  await browser.close();
}
