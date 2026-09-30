#!/usr/bin/env node
/**
 * qa-vessel-glide — how moving vessels travel on screen between two polls.
 *
 * Opens the Strait of Dover, turns the live AIS layer on, lets it poll a few
 * times, then reads every moving vessel's DRAWN position (its billboard) once
 * a second for `--sample-sec` seconds. Per vessel, the per-second step in
 * metres: a vessel that jumps once a minute shows ~59 zero steps and one long
 * one; a vessel that glides shows steady steps near its speed. Vessels that
 * received no new report during the window never move on any build and are
 * counted apart.
 *
 * Needs AISSTREAM_API_KEY in the server's environment.
 *
 * Writes to gitignored qa-shots/: `vessel-glide-<tag>.json`.
 *
 * Usage: node scripts/qa-vessel-glide.mjs --url http://127.0.0.1:4173 --tag after
 *          [--warm-sec 180] [--sample-sec 90]
 */
import puppeteer from 'puppeteer';
import { newQaPage } from './lib/qa-first-run.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv;
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const base = arg('--url', 'http://localhost:4173').replace(/\/$/, '');
const tag = arg('--tag', 'shot');
const warmSec = Number(arg('--warm-sec', '180')) || 180;
const sampleSec = Number(arg('--sample-sec', '90')) || 90;
const outDir = new URL('../qa-shots/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quantile = (values, q) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : null;
};

const browser = await puppeteer.launch({
  headless: 'new',
  protocolTimeout: 600_000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
});
try {
  const page = await newQaPage(browser);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${base}/globe?welcome=0&photoreal=0#lat=50.95&lon=1.45&alt=90000&heading=0&pitch=-89`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => !!window.__godsEyeView?.dataManager, { timeout: 120_000 });
  await sleep(5_000);
  await page.evaluate(async () => {
    const dm = window.__godsEyeView.dataManager;
    if (!dm.layers.get('ais-live-vessels').enabled) await dm.toggle('ais-live-vessels');
  });
  console.log(`warming for ${warmSec} s…`);
  await sleep(warmSec * 1000);

  const tracks = new Map();
  for (let i = 0; i <= sampleSec; i += 1) {
    const rows = await page.evaluate(() => {
      const { viewer } = window.__godsEyeView;
      const Cartographic = viewer.camera.positionCartographic.constructor;
      const out = [];
      const primitives = viewer.scene.primitives;
      for (let p = 0; p < primitives.length; p += 1) {
        const collection = primitives.get(p);
        if (typeof collection?.get !== 'function' || typeof collection.length !== 'number') continue;
        for (let j = 0; j < collection.length; j += 1) {
          const billboard = collection.get(j);
          const record = billboard?.id;
          if (!record?.mmsi || !(record.speed > 3)) continue;
          const c = Cartographic.fromCartesian(billboard.position);
          out.push({ mmsi: record.mmsi, lat: (c.latitude * 180) / Math.PI, lon: (c.longitude * 180) / Math.PI, speedKn: record.speed });
        }
      }
      return out;
    });
    for (const row of rows) {
      if (!tracks.has(row.mmsi)) tracks.set(row.mmsi, { speedKn: row.speedKn, points: [] });
      tracks.get(row.mmsi).points.push(row);
    }
    await sleep(1000);
  }

  // A vessel whose drawn position never changed got no new report in the
  // window: frozen on any build, so it is counted apart.
  const steps = [];
  let frozen = 0;
  let vessels = 0;
  let idle = 0;
  const perVessel = [];
  for (const [mmsi, { speedKn, points }] of tracks) {
    if (points.length < sampleSec / 2) continue;
    const first = points[0];
    if (points.every((point) => point.lat === first.lat && point.lon === first.lon)) {
      idle += 1;
      continue;
    }
    vessels += 1;
    const own = [];
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const dLat = (b.lat - a.lat) * 111_320;
      const dLon = (b.lon - a.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
      const step = Math.hypot(dLat, dLon);
      own.push(step);
      steps.push(step);
      if (step < 0.5) frozen += 1;
    }
    perVessel.push({ mmsi, speedKn, medianStepM: quantile(own, 0.5), maxStepM: Math.max(...own) });
  }
  const report = {
    tag,
    vessels,
    idleVessels: idle,
    steps: steps.length,
    frozenShare: steps.length ? frozen / steps.length : null,
    medianStepM: quantile(steps, 0.5),
    p99StepM: quantile(steps, 0.99),
    maxStepM: steps.length ? Math.max(...steps) : null,
    perVessel: perVessel.slice(0, 40),
  };
  writeFileSync(new URL(`vessel-glide-${tag}.json`, outDir).pathname, JSON.stringify(report, null, 2));
  console.log(`${idle} vessels got no new report in the window; ${vessels} did, ${steps.length} one-second steps: ${(100 * report.frozenShare).toFixed(0)}% frozen, median ${report.medianStepM?.toFixed(1)} m, p99 ${report.p99StepM?.toFixed(0)} m, max ${report.maxStepM?.toFixed(0)} m`);
} finally {
  await browser.close();
}
