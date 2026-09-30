// src/data/contactPlayback.test.mjs — one engine for moving live contacts
// between their reported fixes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTrack,
  displayTime,
  pushFix,
  sampleTrack,
  setOffsetMs,
} from './contactPlayback.js';

const T0 = 1_780_000_000_000;
const fixAt = (seconds, lat, lon = -1.5) => ({ t: T0 + seconds * 1000, lat, lon });

test('between two fixes the contact moves at the speed they imply, one second per second', () => {
  const track = createTrack();
  pushFix(track, fixAt(0, 47.0), T0 + 5_000);
  pushFix(track, fixAt(60, 47.006), T0 + 65_000);
  const quarter = sampleTrack(track, T0 + 15_000);
  const half = sampleTrack(track, T0 + 30_000);
  assert.equal(half.state, 'between');
  assert.ok(Math.abs(quarter.lat - 47.0015) < 1e-9);
  assert.ok(Math.abs(half.lat - 47.003) < 1e-9);
  assert.ok(Math.abs(half.speedMps - (0.006 * 111_320) / 60) < 0.01, `speed ${half.speedMps}`);
});

test('the contact holds at its newest fix and never goes past it', () => {
  const track = createTrack();
  pushFix(track, fixAt(0, 47.0), T0);
  pushFix(track, fixAt(60, 47.006), T0 + 60_000);
  const past = sampleTrack(track, T0 + 90_000);
  assert.equal(past.state, 'holding');
  assert.equal(past.lat, 47.006);
  assert.equal(past.holdMs, 30_000);
  const early = sampleTrack(track, T0 - 10_000);
  assert.equal(early.state, 'before');
  assert.equal(early.lat, 47.0);
  assert.equal(sampleTrack(createTrack(), T0).state, 'empty');
});

test('the delay learns the gap from one report to the next arrival, 95th percentile plus the margin', () => {
  const track = createTrack({ marginMs: 5_000, minLagMs: 5_000, maxLagMs: 180_000 });
  pushFix(track, fixAt(0, 47.0), T0 + 2_000);
  // A new fix lands every 60 s, 2 s after it was taken: the next arrival is
  // 62 s after the previous report.
  for (let i = 1; i <= 10; i += 1) pushFix(track, fixAt(60 * i, 47 + i * 0.001), T0 + 60_000 * i + 2_000);
  assert.equal(track.targetLagMs, 67_000);
  // And at that delay the clock is always between two fixes while the next is on its way.
  const now = T0 + 60_000 * 10 + 2_000 + 59_000;
  track.lagMs = track.targetLagMs;
  track.clockAtMs = now;
  assert.equal(sampleTrack(track, displayTime(track, now)).state, 'between');
});

test('a first fix that is already old sets a delay long enough to reach it', () => {
  const track = createTrack({ marginMs: 5_000, maxLagMs: 400_000 });
  pushFix(track, fixAt(0, 47.0), T0 + 190_000);
  assert.equal(track.lagMs, 195_000);
});

test('the delay slews towards its target instead of jumping', () => {
  const track = createTrack({ initialLagMs: 30_000, slewPerSec: 0.1 });
  displayTime(track, T0);
  track.targetLagMs = 90_000;
  const d1 = displayTime(track, T0 + 1_000);
  assert.equal(track.lagMs, 30_100, 'at most 0.1 s per second');
  const d2 = displayTime(track, T0 + 2_000);
  assert.ok(d2 - d1 >= 900 && d2 - d1 <= 1_100, 'the display clock runs between 0.9 and 1.1 s/s');
});

test('a jump no vehicle could make is believed only once a second fix agrees, and never slid across', () => {
  const track = createTrack({ breakAboveMps: 60 });
  pushFix(track, fixAt(0, 47.0), T0);
  assert.equal(pushFix(track, fixAt(10, 48.0), T0 + 10_000), 'implausible', '111 km in 10 s, alone');
  assert.equal(track.fixes.length, 1);
  assert.equal(pushFix(track, fixAt(20, 48.001), T0 + 20_000), 'moved', 'a second fix agrees');
  assert.equal(track.fixes.length, 3);
  const mid = sampleTrack(track, T0 + 5_000);
  assert.equal(mid.state, 'between');
  assert.equal(mid.lat, 47.0, 'waits at the old place rather than sliding 111 km');
});

test('a feed alternating with a placeholder never draws the placeholder', () => {
  // Bordeaux tram 1398, 2026-09-30: every other fix is one fixed point 3 km away.
  const track = createTrack({ breakAboveMps: 60 });
  const real = (s, dLat) => ({ t: T0 + s * 1000, lat: 44.8615 - dLat, lon: -0.51975 });
  const placeholder = (s) => ({ t: T0 + s * 1000, lat: 44.85082, lon: -0.55762 });
  const results = [
    pushFix(track, real(0, 0), T0),
    pushFix(track, placeholder(20), T0 + 20_000),
    pushFix(track, real(40, 0.002), T0 + 40_000),
    pushFix(track, placeholder(60), T0 + 60_000),
    pushFix(track, real(80, 0.004), T0 + 80_000),
  ];
  assert.deepEqual(results, ['first', 'implausible', 'moved', 'implausible', 'moved']);
  assert.ok(track.fixes.every((fix) => fix.lon === -0.51975));
});

test('stale and repeated fixes are refused, the ring and the window are bounded', () => {
  const track = createTrack({ capacity: 4, retentionMs: 120_000 });
  assert.equal(pushFix(track, fixAt(0, 47.0), T0), 'first');
  assert.equal(pushFix(track, fixAt(0, 47.1), T0 + 1_000), 'old');
  assert.equal(pushFix(track, fixAt(-5, 47.1), T0 + 1_000), 'old');
  assert.equal(pushFix(track, { t: T0, lat: 95, lon: 0 }, T0), 'invalid');
  for (let i = 1; i <= 6; i += 1) pushFix(track, fixAt(20 * i, 47 + i * 0.001), T0 + 20_000 * i);
  assert.equal(track.fixes.length, 4);
  assert.equal(track.fixes[3].t, T0 + 120_000);
  assert.equal(pushFix(track, fixAt(500, 47.2), T0 + 1_000_000), 'old', 'a fix older than the window');
});

test('across the antimeridian the contact takes the short way', () => {
  const track = createTrack();
  pushFix(track, { t: T0, lat: -13.3, lon: 179.9 }, T0);
  pushFix(track, { t: T0 + 60_000, lat: -13.3, lon: -179.9 }, T0 + 60_000);
  const mid = sampleTrack(track, T0 + 30_000);
  assert.ok(Math.abs(Math.abs(mid.lon) - 180) < 1e-9, `lon ${mid.lon}`);
});

test('an offset moves the clock into the past, never further than what the track holds', () => {
  const track = createTrack({ initialLagMs: 30_000 });
  pushFix(track, fixAt(0, 47.0), T0);
  pushFix(track, fixAt(60, 47.006), T0 + 60_000);
  const now = T0 + 90_000;
  assert.equal(setOffsetMs(track, 10_000, now), 10_000);
  track.clockAtMs = now;
  assert.equal(displayTime(track, now), T0 + 50_000);
  assert.equal(setOffsetMs(track, 10 * 60_000, now), 60_000, 'bounded by the oldest fix');
  assert.equal(setOffsetMs(track, -5, now), 0);
});

test('a contact held at its newest fix takes on its missing delay at once, without moving', () => {
  const track = createTrack({ initialLagMs: 30_000, slewPerSec: 0.1 });
  pushFix(track, fixAt(0, 47.0), T0);
  pushFix(track, fixAt(120, 47.012), T0 + 125_000);
  track.targetLagMs = 130_000;
  track.lagMs = 30_000;
  track.clockAtMs = T0 + 200_000;
  // At T0 + 200 s the clock (30 s behind) is 50 s past the newest fix: held.
  const at = displayTime(track, T0 + 200_000);
  assert.equal(at, T0 + 120_000, 'the clock goes back exactly to the newest fix');
  assert.equal(sampleTrack(track, at).lat, 47.012, 'the drawn position does not move');
  // A new fix arriving now is glided to from there.
  pushFix(track, fixAt(240, 47.024), T0 + 245_000);
  const next = sampleTrack(track, displayTime(track, T0 + 201_000));
  assert.equal(next.state, 'between');
  assert.ok(next.lat > 47.012 && next.lat < 47.013, `just past the last fix: ${next.lat}`);
});

