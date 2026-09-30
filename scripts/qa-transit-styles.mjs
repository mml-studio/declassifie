#!/usr/bin/env node
/**
 * qa-transit-styles — how bright the live transit glyphs are, and how far
 * they stand out from the ground around them, under each post-FX style.
 *
 * Opens Bordeaux (the densest vehicle-position feed in France), turns
 * `transit-fr` on, then for each style: applies it, screenshots the page and
 * reads, around every drawn vehicle, the brightest pixel of the glyph (a 9×9
 * box on its screen position) and the median of a ring 18-24 px out. Prints
 * the median glyph luma and the median contrast per style.
 *
 * Writes to gitignored qa-shots/: `transit-styles-<tag>-<style>.png` and
 * `transit-styles-<tag>.json`.
 *
 * Usage: node scripts/qa-transit-styles.mjs --url http://127.0.0.1:4173 --tag after [--map ign-ortho]
 *
 * The light OSM basemap saturates under NVG and FLIR as much as any glyph
 * does; `--map ign-ortho` measures on aerial imagery instead.
 */
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { newQaPage } from './lib/qa-first-run.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv;
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const base = arg('--url', 'http://localhost:4173').replace(/\/$/, '');
const tag = arg('--tag', 'shot');
const mapId = arg('--map', null);
const STYLES = ['normal', 'surveillance', 'thermal', 'retro'];
const outDir = new URL('../qa-shots/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const out = (name) => new URL(`transit-styles-${tag}${name}`, outDir).pathname;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};

const browser = await puppeteer.launch({
  headless: 'new',
  protocolTimeout: 300_000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
});
try {
  const page = await newQaPage(browser);
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${base}/globe?welcome=0&photoreal=0${mapId ? `&map=${encodeURIComponent(mapId)}` : ''}#lat=44.8400&lon=-0.5750&alt=4200&heading=0&pitch=-89`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => !!window.__godsEyeView?.dataManager && !!window.__godsEyeView?.styleManager, { timeout: 120_000 });
  await sleep(6_000);
  await page.evaluate(async () => {
    const dm = window.__godsEyeView.dataManager;
    if (!dm.layers.get('transit-fr').enabled) await dm.toggle('transit-fr');
  });
  await page.waitForFunction(
    () => (window.__godsEyeView.dataManager.layers.get('transit-fr').module.getStats().count || 0) >= 20,
    { timeout: 120_000 },
  );
  await sleep(4_000);

  const report = { tag, styles: {} };
  for (const style of STYLES) {
    await page.evaluate((name) => window.__godsEyeView.styleManager.setStyle(name), style);
    await sleep(2_500);
    const points = await page.evaluate(() => {
      const { viewer } = window.__godsEyeView;
      const found = [];
      const primitives = viewer.scene.primitives;
      for (let i = 0; i < primitives.length; i += 1) {
        const collection = primitives.get(i);
        if (typeof collection?.get !== 'function' || typeof collection.length !== 'number' || !collection.show) continue;
        for (let j = 0; j < collection.length; j += 1) {
          const billboard = collection.get(j);
          if (!billboard?.show || typeof billboard.id !== 'string' || !billboard.id.startsWith('pan-')) continue;
          const screen = billboard.computeScreenSpacePosition(viewer.scene);
          if (screen && screen.x > 30 && screen.y > 30 && screen.x < innerWidth - 30 && screen.y < innerHeight - 30) {
            found.push({ x: Math.round(screen.x), y: Math.round(screen.y) });
          }
        }
      }
      return found;
    });
    const png = await page.screenshot({ path: out(`-${style}.png`) });
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const lumaAt = (x, y) => {
      if (x < 0 || y < 0 || x >= info.width || y >= info.height) return NaN;
      const i = (y * info.width + x) * info.channels;
      return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    };
    const peaks = [];
    const contrasts = [];
    for (const { x, y } of points) {
      let peak = 0;
      for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) peak = Math.max(peak, lumaAt(x + dx, y + dy) || 0);
      const ring = [];
      for (let angle = 0; angle < 360; angle += 15) {
        for (const radius of [18, 21, 24]) {
          ring.push(lumaAt(Math.round(x + radius * Math.cos((angle * Math.PI) / 180)), Math.round(y + radius * Math.sin((angle * Math.PI) / 180))));
        }
      }
      peaks.push(peak);
      contrasts.push(peak - median(ring));
    }
    report.styles[style] = {
      vehicles: points.length,
      medianGlyphLuma: median(peaks),
      medianContrast: median(contrasts),
    };
    const row = report.styles[style];
    console.log(`${style.padEnd(12)} ${String(row.vehicles).padStart(4)} vehicles · glyph luma ${row.medianGlyphLuma?.toFixed(2)} · contrast ${row.medianContrast?.toFixed(2)}`);
  }
  writeFileSync(out('.json'), JSON.stringify(report, null, 2));
  console.log(`saved ${out('.json')}`);
} finally {
  await browser.close();
}
