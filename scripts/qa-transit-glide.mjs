#!/usr/bin/env node
/**
 * qa-transit-glide — how buses and trams travel on screen between two polls.
 *
 * Opens Bordeaux, turns the transit layer on, lets it poll for `--warm-sec`,
 * then reads every transit glyph's DRAWN position (its billboard) once a
 * second for `--sample-sec` seconds. Over the glyphs that moved at all: the
 * share of one-second steps that stood still, and the step distribution in
 * metres — a glyph that jumps shows a long tail, one that glides steady steps
 * near its speed. The feed decides who reports during the window, so compare
 * two builds on the same server, A then B then A.
 *
 * Writes to gitignored qa-shots/: `transit-glide-<tag>.json`.
 *
 * Usage: node scripts/qa-transit-glide.mjs --url http://127.0.0.1:4173 --tag after
 *          [--warm-sec 90] [--sample-sec 60]
 */
import puppeteer from 'puppeteer';
import { newQaPage } from './lib/qa-first-run.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv;
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const base = arg('--url', 'http://localhost:4173').replace(/\/$/, '');
const tag = arg('--tag', 'shot');
const warmSec = Number(arg('--warm-sec', '90')) || 90;
const sampleSec = Number(arg('--sample-sec', '60')) || 60;
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
const errors = [];
try {
  const page = await newQaPage(browser);
  page.on('pageerror', (error) => errors.push(String(error.message || error)));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${base}/globe?welcome=0&photoreal=0#lat=44.8400&lon=-0.5750&alt=4200&heading=0&pitch=-89`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => !!window.__godsEyeView?.dataManager, { timeout: 120_000 });
  await sleep(5_000);
  await page.evaluate(async () => {
    const dm = window.__godsEyeView.dataManager;
    if (!dm.layers.get('transit-fr').enabled) await dm.toggle('transit-fr');
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
          // Transit glyph ids are the feed's vehicle ids, all `pan-<feed>:…`.
          if (typeof billboard?.id !== 'string' || !billboard.id.startsWith('pan-') || !billboard.show) continue;
          const carto = Cartographic.fromCartesian(billboard.position);
          out.push([billboard.id, (carto.latitude * 180) / Math.PI, (carto.longitude * 180) / Math.PI]);
        }
      }
      return out;
    });
    for (const [id, lat, lon] of rows) {
      if (!tracks.has(id)) tracks.set(id, []);
      tracks.get(id).push({ lat, lon });
    }
    await sleep(1_000);
  }

  const steps = [];
  let still = 0;
  let moved = 0;
  for (const points of tracks.values()) {
    if (points.length < sampleSec / 2) continue;
    if (points.every((point) => point.lat === points[0].lat && point.lon === points[0].lon)) continue;
    moved += 1;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const metres = Math.hypot((b.lat - a.lat) * 111_320, (b.lon - a.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180));
      steps.push(metres);
      if (metres < 0.5) still += 1;
    }
  }
  const result = {
    tag,
    glyphs: tracks.size,
    moved,
    stillShare: steps.length ? still / steps.length : null,
    stepP50M: quantile(steps, 0.5),
    stepP99M: quantile(steps, 0.99),
    stepMaxM: steps.reduce((a, b) => (b > a ? b : a), 0),
    errors,
  };
  writeFileSync(new URL(`transit-glide-${tag}.json`, outDir), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${tag}: ${result.glyphs} glyphs, ${moved} moved: still ${(100 * (result.stillShare ?? 0)).toFixed(0)}% of seconds, `
    + `step p50 ${result.stepP50M?.toFixed(1)} m, p99 ${result.stepP99M?.toFixed(0)} m, max ${result.stepMaxM.toFixed(0)} m; `
    + `page errors: ${errors.length ? errors.slice(0, 3).join(' | ') : 'none'}`);
} finally {
  await browser.close();
}
