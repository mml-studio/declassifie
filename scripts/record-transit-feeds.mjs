#!/usr/bin/env node
/**
 * record-transit-feeds — records what `/api/transit-fr/vehicles` answers for a
 * few fixed boxes, one JSON line per answer, so the transit motion can be
 * replayed offline (`scripts/replay-transit-motion.mjs`).
 *
 * Each line: `{ receivedAt, box, vehicles }`, each vehicle trimmed to what the
 * motion and the schedule projection read: id, lat, lon, timestampMs,
 * speedMps, bearing, tripId, stopSequence and the `nextStops` the projection
 * builds its run from.
 *
 * The default boxes are Bordeaux (TBM: fixes ~25 s old, and the next stops
 * the schedule projection runs on) and Le Havre and Évreux (Lia and the
 * Normandy aggregate: fixes over a minute old, no next stops) — the two
 * regimes the layer has to draw. The next stops need the server's static
 * stop index warm: a cold copy (a fresh checkout) records none.
 *
 * Usage: node scripts/record-transit-feeds.mjs --url http://127.0.0.1:4173
 *          [--minutes 25] [--every-sec 15] [--out .context/transit-recording.jsonl]
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv;
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const base = arg('--url', 'http://localhost:4173').replace(/\/$/, '');
const minutes = Number(arg('--minutes', '25')) || 25;
const everyMs = (Number(arg('--every-sec', '15')) || 15) * 1000;
const outFile = arg('--out', '.context/transit-recording.jsonl');
const BOXES = [
  { name: 'bordeaux', south: 44.80, west: -0.64, north: 44.88, east: -0.52 },
  { name: 'lehavre', south: 49.45, west: 0.05, north: 49.55, east: 0.20 },
  { name: 'evreux', south: 49.00, west: 1.10, north: 49.08, east: 1.22 },
];
const KEEP = ['id', 'feed', 'lat', 'lon', 'timestampMs', 'speedMps', 'bearing', 'tripId', 'stopSequence', 'nextStops'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, '');
const deadline = Date.now() + minutes * 60_000;
let lines = 0;
while (Date.now() < deadline) {
  const tickAt = Date.now();
  for (const box of BOXES) {
    const query = `south=${box.south}&west=${box.west}&north=${box.north}&east=${box.east}`;
    try {
      const response = await fetch(`${base}/api/transit-fr/vehicles?${query}`, { cache: 'no-store' });
      const body = await response.json();
      const vehicles = (body.vehicles || []).map((vehicle) => {
        const kept = {};
        for (const key of KEEP) if (vehicle[key] !== undefined) kept[key] = vehicle[key];
        return kept;
      });
      appendFileSync(outFile, `${JSON.stringify({ receivedAt: Date.now(), box: box.name, vehicles })}\n`);
      lines += 1;
    } catch (error) {
      console.log(`[record] ${box.name}: ${error?.message || error}`);
    }
  }
  if (lines % 30 === 0) console.log(`[record] ${lines} answers, ${Math.round((deadline - Date.now()) / 1000)} s left`);
  await sleep(Math.max(0, everyMs - (Date.now() - tickAt)));
}
console.log(`[record] done: ${lines} answers in ${outFile}`);
