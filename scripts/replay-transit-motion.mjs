#!/usr/bin/env node
/**
 * replay-transit-motion — replays a recording of `/api/transit-fr/vehicles`
 * (`scripts/record-transit-feeds.mjs`) through several ways of drawing a bus,
 * and scores each on the two things a viewer sees: how far the drawn bus is
 * from where it really is, and whether it moves smoothly.
 *
 * Strategies, each simulated at 100 ms over the whole recording, per vehicle,
 * from the answers the client would have received at the time:
 *
 *   glide      — the layer before the playback engine: each new fix is glided
 *                to from wherever the glyph is drawn, over the gap between its
 *                last two fixes (3-90 s), and the schedule projection takes
 *                over, towards NOW, once the fix is 30 s old.
 *   engine     — `contactPlayback.js`: drawn between two fixes a steady delay
 *                behind real time; once its clock passes the newest fix, the
 *                schedule projection continues it along its run ON THE SAME
 *                CLOCK.
 *   engine-now — the same engine, but the projection past the newest fix
 *                aims at NOW, like `glide`.
 *
 * Accuracy is measured the way the projection's own commit factor was chosen
 * (`transitProjection.js`, PROJECTION_COMMIT): at an instant T, against a real
 * fix of that vehicle taken within 45 s of T that the client did NOT have at
 * T — so the answer was never in the input. Smoothness: per vehicle, the drawn
 * step over each second while the vehicle's own fixes say it is moving
 * (> 1 m/s): the share of those seconds it stood still, and the fastest step.
 *
 * Usage: node scripts/replay-transit-motion.mjs [--in .context/transit-recording.jsonl]
 */
import { readFileSync } from 'node:fs';
import { createTrack, displayTime, pushFix, sampleTrack } from '../src/data/contactPlayback.js';
import { advanceAlongRun, runFromWireVehicle } from '../src/data/transitProjection.js';

/**
 * The engine settings replayed for buses: one 15 s poll plus ten seconds to
 * start, then each vehicle's own gaps; `--grid` scans the percentile and the
 * margin around them.
 */
const TRANSIT_PLAYBACK = Object.freeze({
  capacity: 16,
  retentionMs: 15 * 60_000,
  minLagMs: 5_000,
  maxLagMs: 120_000,
  marginMs: 5_000,
  initialLagMs: 25_000,
  breakAboveMps: 60,
});

/** The glide the layer drew before the playback engine, kept here to replay it. */
function glideDurationMs(previousFixMs, nextFixMs) {
  const delta = Number.isFinite(previousFixMs) && Number.isFinite(nextFixMs) ? nextFixMs - previousFixMs : null;
  const span = delta !== null && delta > 0 ? delta : 15_000;
  return Math.min(90_000, Math.max(3_000, span));
}

const argv = process.argv;
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const inFile = arg('--in', '.context/transit-recording.jsonl');
const STEP_MS = 100;
const EVAL_EVERY_MS = 5_000;
const TRUTH_WINDOW_MS = 45_000;
const SMOOTH_MS = 800;
const PROJECTION_TICK_MS = 500;

const metres = (a, b) => {
  const dLat = (b.lat - a.lat) * 111_320;
  const dLon = (b.lon - a.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
};
const quantile = (values, q) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : null;
};

// --- Recording → per-vehicle observations -----------------------------------
const lines = readFileSync(inFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
const byVehicle = new Map();
for (const line of lines) {
  for (const vehicle of line.vehicles) {
    if (!Number.isFinite(vehicle.timestampMs)) continue;
    const key = `${line.box}|${vehicle.id}`;
    if (!byVehicle.has(key)) byVehicle.set(key, { box: line.box, observations: [] });
    byVehicle.get(key).observations.push({ at: line.receivedAt, vehicle });
  }
}

// --- Strategies ---------------------------------------------------------------
function simulateGlide(observations, startMs, endMs, sampleAt) {
  let next = 0;
  let known = null;
  let draw = null;
  let from = null;
  let to = null;
  let tweenStart = 0;
  let tweenMs = 0;
  let run = null;
  let target = null;
  let lastTick = -Infinity;
  for (let now = startMs; now <= endMs; now += STEP_MS) {
    while (next < observations.length && observations[next].at <= now) {
      const { vehicle } = observations[next];
      const fix = { lat: vehicle.lat, lon: vehicle.lon };
      if (!known) {
        draw = { ...fix };
      } else if (metres(draw, fix) > 0.5) {
        from = { ...draw };
        to = fix;
        tweenStart = now;
        tweenMs = glideDurationMs(known.timestampMs, vehicle.timestampMs);
      }
      known = vehicle;
      run = runFromWireVehicle(vehicle);
      next += 1;
    }
    if (!known) continue;
    if (now - lastTick >= PROJECTION_TICK_MS) {
      lastTick = now;
      const out = run ? advanceAlongRun(run, now, undefined, {}) : null;
      target = out ? { lat: out.lat, lon: out.lon } : null;
    }
    if (target) {
      const k = 1 - Math.exp(-STEP_MS / SMOOTH_MS);
      draw.lat += (target.lat - draw.lat) * k;
      draw.lon += (target.lon - draw.lon) * k;
    } else if (tweenMs > 0 && from && to) {
      const u = Math.min(1, (now - tweenStart) / tweenMs);
      draw.lat = from.lat + (to.lat - from.lat) * u;
      draw.lon = from.lon + (to.lon - from.lon) * u;
    }
    sampleAt(now, draw, known);
  }
}

function simulateEngine(observations, startMs, endMs, sampleAt, projectToNow, playback = TRANSIT_PLAYBACK) {
  let next = 0;
  let known = null;
  let run = null;
  let draw = null;
  let target = null;
  let lastTick = -Infinity;
  const track = createTrack(playback);
  const sample = {};
  for (let now = startMs; now <= endMs; now += STEP_MS) {
    while (next < observations.length && observations[next].at <= now) {
      const { vehicle, at } = observations[next];
      pushFix(track, { t: vehicle.timestampMs, lat: vehicle.lat, lon: vehicle.lon }, at);
      known = vehicle;
      run = runFromWireVehicle(vehicle);
      next += 1;
    }
    if (!known) continue;
    const displayAt = displayTime(track, now);
    sampleTrack(track, displayAt, sample);
    if (sample.state === 'empty') continue;
    if (now - lastTick >= PROJECTION_TICK_MS) {
      lastTick = now;
      const clock = projectToNow ? now : displayAt;
      const out = sample.state === 'holding' && run ? advanceAlongRun(run, clock, undefined, {}) : null;
      target = out ? { lat: out.lat, lon: out.lon } : null;
    }
    const wanted = sample.state === 'holding' && target ? target : { lat: sample.lat, lon: sample.lon };
    if (!draw) draw = { ...wanted };
    const k = 1 - Math.exp(-STEP_MS / SMOOTH_MS);
    draw.lat += (wanted.lat - draw.lat) * k;
    draw.lon += (wanted.lon - draw.lon) * k;
    sampleAt(now, draw, known);
  }
}

// --- Scoring ------------------------------------------------------------------
function score(name, simulate, { quiet = false } = {}) {
  const errors = { all: [], bordeaux: [], other: [] };
  const steps = [];
  let still = 0;
  let movingSeconds = 0;
  for (const { box, observations } of byVehicle.values()) {
    if (observations.length < 3) continue;
    const fixes = [];
    for (const { vehicle } of observations) {
      if (!fixes.length || fixes[fixes.length - 1].t !== vehicle.timestampMs) {
        fixes.push({ t: vehicle.timestampMs, lat: vehicle.lat, lon: vehicle.lon });
      }
    }
    const startMs = observations[0].at;
    const endMs = observations[observations.length - 1].at;
    let nextEval = startMs + 60_000;
    let lastSecond = null;
    simulate(observations, startMs, endMs, (now, draw, known) => {
      if (now >= nextEval) {
        nextEval += EVAL_EVERY_MS;
        let best = null;
        for (const fix of fixes) {
          if (fix.t <= known.timestampMs || Math.abs(fix.t - now) > TRUTH_WINDOW_MS) continue;
          if (!best || Math.abs(fix.t - now) < Math.abs(best.t - now)) best = fix;
        }
        if (best) {
          const error = metres(draw, best);
          errors.all.push(error);
          (box === 'bordeaux' ? errors.bordeaux : errors.other).push(error);
        }
      }
      if (!lastSecond || now - lastSecond.at >= 1_000) {
        if (lastSecond) {
          // Is the vehicle really moving now? Its fixes either side of this second say.
          const after = fixes.find((fix) => fix.t >= now);
          const before = [...fixes].reverse().find((fix) => fix.t < now);
          const realSpeed = after && before ? metres(before, after) / ((after.t - before.t) / 1000) : 0;
          if (realSpeed > 1) {
            const step = metres(lastSecond, draw);
            movingSeconds += 1;
            steps.push(step);
            if (step < 0.5) still += 1;
          }
        }
        lastSecond = { at: now, lat: draw.lat, lon: draw.lon };
      }
    });
  }
  const row = (values) => `p50 ${quantile(values, 0.5)?.toFixed(0)} m · p90 ${quantile(values, 0.9)?.toFixed(0)} m · mean ${(values.reduce((a, b) => a + b, 0) / (values.length || 1)).toFixed(0)} m (n=${values.length})`;
  if (quiet) {
    const p = (values, q) => quantile(values, q)?.toFixed(0);
    console.log(`${name.padEnd(34)} Bdx p50 ${p(errors.bordeaux, 0.5)} p90 ${p(errors.bordeaux, 0.9)} · Nmd p50 ${p(errors.other, 0.5)} p90 ${p(errors.other, 0.9)} · still ${(100 * still / (movingSeconds || 1)).toFixed(0)}% · step p99 ${p(steps, 0.99)} max ${steps.reduce((a, b) => (b > a ? b : a), 0).toFixed(0)}`);
    return;
  }
  console.log(`\n${name}`);
  console.log(`  error, all       ${row(errors.all)}`);
  console.log(`  error, Bordeaux  ${row(errors.bordeaux)}`);
  console.log(`  error, Normandy  ${row(errors.other)}`);
  console.log(`  smoothness       still ${(100 * still / (movingSeconds || 1)).toFixed(0)}% of moving seconds · step p99 ${quantile(steps, 0.99)?.toFixed(0)} m/s · max ${steps.reduce((a, b) => (b > a ? b : a), 0).toFixed(0)} m/s`);
}

console.log(`${lines.length} answers, ${byVehicle.size} vehicles, from ${inFile}`);
if (argv.includes('--grid')) {
  // The delay trades smoothness for accuracy: scan it, like PROJECTION_COMMIT was.
  score('glide (before)', simulateGlide, { quiet: true });
  for (const lagRank of [0.5, 0.75, 0.95]) {
    for (const marginMs of [0, 5_000]) {
      for (const projectToNow of [false, true]) {
        const playback = { ...TRANSIT_PLAYBACK, lagRank, marginMs };
        const name = `engine rank ${lagRank} +${marginMs / 1000}s ${projectToNow ? 'now' : 'clock'}`;
        score(name, (o, s, e, f) => simulateEngine(o, s, e, f, projectToNow, playback), { quiet: true });
      }
    }
  }
} else {
  score('glide (before)', simulateGlide);
  score('engine, projection on its own clock', (o, s, e, f) => simulateEngine(o, s, e, f, false));
  score('engine, projection towards now', (o, s, e, f) => simulateEngine(o, s, e, f, true));
}
