/**
 * @module contactPlayback
 *
 * One way to move a live contact between the positions its feed reports: keep
 * the last few reported fixes, and draw the contact where it WAS a short,
 * steady delay ago — so it always sits between two things the feed actually
 * said, moving at the speed those two fixes imply, one second per second.
 *
 * WHY A DELAY. A fix arrives some time after it was taken, and the next one
 * later still. Drawing the newest fix makes a contact jump on every poll (the
 * vessel layer did, once a minute); gliding from wherever it is drawn to the
 * newest fix over "the gap between two reports" makes it speed up and slow
 * down with the poll phase (the transit layer's glide ran up to 1.5× when the
 * poll and the report cadence disagreed, the fault upstream God's Eye View
 * found in its own). A clock that runs a fixed delay behind real time avoids
 * both: while the next fix is on its way, the contact is still travelling
 * towards the last one.
 *
 * HOW LONG A DELAY. Long enough that the clock is never past the newest fix
 * when the next one lands: the delay a track needs is the time from its
 * previous fix's report to its next fix's arrival. Each track keeps those
 * gaps, and its target delay is their 95th percentile plus a margin, clamped
 * — upstream's rule (`src/data/contactPlayback.js`, 76c20be2). The delay the
 * clock actually runs at moves towards that target by at most `slewPerSec`
 * seconds per second, so the drawn contact never jumps when the target does.
 *
 * WHAT IT NEVER DOES. It never draws past the newest fix: a clock that
 * overtakes it HOLDS there and says so (`state: 'holding'`, `holdMs`), and
 * whatever a layer wants to do beyond a fix — the transit layer's schedule
 * projection — is that layer's own correction, applied on top. Nor does it
 * interpolate across a jump no vehicle could make (`breakAboveMps`): the
 * contact waits at the earlier fix and then appears at the later one.
 *
 * A TIME OFFSET, FOR LATER. `setOffsetMs` moves a track's clock further into
 * its own past, within what it has kept — the hook a rewind needs. Nothing
 * uses it yet.
 *
 * Pure: no Cesium, no DOM, no timers. Positions are degrees; heights belong to
 * the layer, which knows its floor or its sea surface.
 */

/** Milliseconds; the delay a track starts with before it has seen two fixes. */
export const PLAYBACK_DEFAULT_LAG_MS = 30_000;

const EARTH_M_PER_DEG = 111_320;

function metersBetween(a, b) {
  const dLon = ((b.lon - a.lon + 540) % 360) - 180;
  const dLat = b.lat - a.lat;
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  return Math.hypot(dLat * EARTH_M_PER_DEG, dLon * EARTH_M_PER_DEG * Math.cos(midLat));
}

/** Whether a vehicle could have gone from `a` to `b` in the time between them. */
function plausible(a, b, maxMps) {
  const seconds = (b.t - a.t) / 1000;
  return seconds > 0 && metersBetween(a, b) / seconds <= maxMps;
}

function percentile(values, rank) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1)];
}

/**
 * Creates a track: one contact's recent fixes and its display clock.
 * @param {{ capacity?: number, retentionMs?: number, minLagMs?: number,
 *   maxLagMs?: number, marginMs?: number, lagRank?: number, slewPerSec?: number,
 *   initialLagMs?: number, breakAboveMps?: number }} [options]
 *   `lagRank` is the percentile of the observed gaps the delay covers (0.95).
 * @returns {Object} Track state; read it through the functions below.
 */
export function createTrack({
  capacity = 32,
  retentionMs = 15 * 60_000,
  minLagMs = 5_000,
  maxLagMs = 180_000,
  marginMs = 5_000,
  lagRank = 0.95,
  slewPerSec = 0.1,
  initialLagMs = PLAYBACK_DEFAULT_LAG_MS,
  breakAboveMps = Infinity,
} = {}) {
  return {
    capacity: Math.max(2, Math.floor(capacity)),
    retentionMs,
    minLagMs,
    maxLagMs,
    marginMs,
    lagRank,
    slewPerSec,
    breakAboveMps,
    /** @type {Array<{t: number, lat: number, lon: number}>} oldest first */
    fixes: [],
    /** Recent gaps: next fix's arrival minus the previous fix's report, ms. */
    gaps: [],
    targetLagMs: Math.min(maxLagMs, Math.max(minLagMs, initialLagMs)),
    lagMs: Math.min(maxLagMs, Math.max(minLagMs, initialLagMs)),
    offsetMs: 0,
    /** Wall time of the last `displayTime` call, for the slew. */
    clockAtMs: NaN,
    /** A fix too far from the newest to be believed alone, awaiting a second. */
    pending: null,
  };
}

/**
 * Adds a reported fix. A fix no newer than the newest held is not a new
 * observation and is refused; one older than the retention window is too.
 * @param {Object} track
 * @param {{ t: number, lat: number, lon: number }} fix - `t` is when the feed
 *   says the contact was there (ms). Extra fields ride along untouched.
 * @param {number} receivedAtMs - When this fix reached us.
 * A fix no vehicle could reach from the newest one (faster than
 * `breakAboveMps`) is held back until a second fix agrees with it: a feed that
 * alternates between a vehicle's position and a placeholder — measured on one
 * Bordeaux tram, a fixed point 3 km away every other report — never draws the
 * placeholder, while a vehicle that really reappears elsewhere is taken on the
 * second fix, and waits at its old place rather than sliding across.
 * @returns {'first'|'moved'|'old'|'invalid'|'implausible'} What happened.
 */
export function pushFix(track, fix, receivedAtMs) {
  if (!Number.isFinite(fix?.t) || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)
    || Math.abs(fix.lat) > 90 || Math.abs(fix.lon) > 180) {
    return 'invalid';
  }
  const newest = track.fixes[track.fixes.length - 1];
  if (newest && fix.t <= newest.t) return 'old';
  if (Number.isFinite(receivedAtMs) && fix.t < receivedAtMs - track.retentionMs) return 'old';
  if (newest && Number.isFinite(track.breakAboveMps) && !plausible(newest, fix, track.breakAboveMps)) {
    const pending = track.pending;
    if (!pending || fix.t <= pending.t || !plausible(pending, fix, track.breakAboveMps)) {
      track.pending = fix;
      return 'implausible';
    }
    // Two fixes agree on the new place: the first joins the track as the
    // start of a break the sampler will not slide across.
    track.pending = null;
    track.fixes.push(pending);
  } else {
    track.pending = null;
  }
  if (newest && Number.isFinite(receivedAtMs)) {
    track.gaps.push(Math.max(0, receivedAtMs - newest.t));
    if (track.gaps.length > 32) track.gaps.shift();
    const covered = percentile(track.gaps, track.lagRank) + track.marginMs;
    track.targetLagMs = Math.min(track.maxLagMs, Math.max(track.minLagMs, covered));
  } else if (!newest && Number.isFinite(receivedAtMs)) {
    // A first fix already this old needs at least that much delay to be drawn
    // between it and whatever comes next.
    const covered = Math.max(track.targetLagMs, receivedAtMs - fix.t + track.marginMs);
    track.targetLagMs = Math.min(track.maxLagMs, Math.max(track.minLagMs, covered));
    track.lagMs = track.targetLagMs;
  }
  track.fixes.push(fix);
  const horizon = fix.t - track.retentionMs;
  while (track.fixes.length > track.capacity || (track.fixes.length > 2 && track.fixes[1].t < horizon)) {
    track.fixes.shift();
  }
  return newest ? 'moved' : 'first';
}

/**
 * The track's display time now: wall time minus its current delay and any
 * offset. The delay moves towards its target at most `slewPerSec` seconds
 * per wall second, so the display clock runs between 0.9 and 1.1 s/s and
 * never jumps.
 * @param {Object} track
 * @param {number} nowMs - Wall clock.
 * @returns {number} Display time (ms).
 */
export function displayTime(track, nowMs) {
  if (Number.isFinite(track.clockAtMs) && nowMs > track.clockAtMs) {
    const step = (nowMs - track.clockAtMs) * track.slewPerSec;
    const delta = track.targetLagMs - track.lagMs;
    track.lagMs += Math.max(-step, Math.min(step, delta));
  }
  // A contact already held at its newest fix does not move while its clock
  // goes back to that fix, so the delay it still lacks can be taken at once,
  // up to how long it has been held. The next fix then finds the clock at the
  // last one and the contact glides the whole way instead of jumping. Measured
  // on the AIS fleet: vessels whose next fix comes two minutes later sat
  // frozen for most of each gap while the delay climbed at the slew rate.
  const newest = track.fixes[track.fixes.length - 1];
  if (newest && track.targetLagMs > track.lagMs) {
    const held = nowMs - track.lagMs - track.offsetMs - newest.t;
    if (held > 0) track.lagMs = Math.min(track.targetLagMs, track.lagMs + held);
  }
  track.clockAtMs = nowMs;
  return nowMs - track.lagMs - track.offsetMs;
}

/**
 * Moves the track's clock this far into its own past, bounded by what it
 * still holds — the hook a rewind needs.
 * @param {Object} track
 * @param {number} offsetMs - 0 is live.
 * @param {number} nowMs
 * @returns {number} The offset actually applied.
 */
export function setOffsetMs(track, offsetMs, nowMs) {
  const oldest = track.fixes[0];
  const deepest = oldest ? Math.max(0, nowMs - track.lagMs - oldest.t) : 0;
  track.offsetMs = Math.min(deepest, Math.max(0, Number(offsetMs) || 0));
  return track.offsetMs;
}

/**
 * Where the track is at a display time.
 * @param {Object} track
 * @param {number} atMs - Display time, usually from {@link displayTime}.
 * @param {Object} [out] - Reused result object.
 * @returns {{ state: 'empty'|'before'|'between'|'holding', lat: number,
 *   lon: number, t: number, holdMs: number, speedMps: number,
 *   from: ?Object, to: ?Object }}
 *   `before`: the clock has not reached the first fix yet — drawn there.
 *   `holding`: the clock is past the newest fix — drawn there, `holdMs` past it.
 *   `speedMps` is the speed the bracketing fixes imply (NaN when holding);
 *   `u` how far between them, 0..1 — for a layer interpolating its own height.
 */
export function sampleTrack(track, atMs, out = {}) {
  const fixes = track.fixes;
  out.from = null;
  out.to = null;
  out.holdMs = 0;
  out.speedMps = Number.NaN;
  out.t = atMs;
  out.u = 0;
  if (!fixes.length) {
    out.state = 'empty';
    out.lat = Number.NaN;
    out.lon = Number.NaN;
    return out;
  }
  const newest = fixes[fixes.length - 1];
  if (atMs >= newest.t) {
    out.state = 'holding';
    out.lat = newest.lat;
    out.lon = newest.lon;
    out.holdMs = atMs - newest.t;
    out.from = newest;
    return out;
  }
  if (atMs <= fixes[0].t) {
    out.state = 'before';
    out.lat = fixes[0].lat;
    out.lon = fixes[0].lon;
    out.to = fixes[0];
    return out;
  }
  let i = fixes.length - 2;
  while (i > 0 && fixes[i].t > atMs) i -= 1;
  const a = fixes[i];
  const b = fixes[i + 1];
  const spanMs = b.t - a.t;
  const meters = metersBetween(a, b);
  out.state = 'between';
  out.from = a;
  out.to = b;
  out.speedMps = spanMs > 0 ? meters / (spanMs / 1000) : Number.NaN;
  if (!(out.speedMps <= track.breakAboveMps)) {
    // No vehicle made that trip at that speed: wait at the earlier fix.
    out.u = 0;
    out.lat = a.lat;
    out.lon = a.lon;
    return out;
  }
  const u = (atMs - a.t) / spanMs;
  out.u = u;
  const dLon = ((b.lon - a.lon + 540) % 360) - 180;
  out.lat = a.lat + (b.lat - a.lat) * u;
  out.lon = ((a.lon + dLon * u + 540) % 360) - 180;
  return out;
}
