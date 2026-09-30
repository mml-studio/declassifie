/**
 * @module transitTrail
 *
 * Where a live transit vehicle has been: the last fifteen minutes of its
 * reported positions, kept by the server so the trail behind a selected bus
 * exists at the first click and survives a page reload.
 *
 * The transit proxy decodes each operator feed once per cache period and
 * records every vehicle in it here; `/api/transit-fr/trail?id=` reads one
 * vehicle back and never asks an operator anything. Same shape as the AIS
 * track rings in `vite.config.js`, sized for buses: a bus at a stop sends the
 * same point every few seconds, so samples are thinned by time AND distance
 * and a parked vehicle collapses to one point.
 *
 * Bounded three ways: samples per vehicle (a ring), age (fifteen minutes,
 * swept once a minute) and vehicles (least recently heard dropped first).
 * At the defaults — 64 samples as Float32 lat/lon + Uint32 seconds, 8,000
 * vehicles — the rings hold 6.1 MB.
 *
 * Pure: no timers, no I/O. Times are epoch seconds in, milliseconds out.
 */

/** @typedef {{ lats: Float32Array, lons: Float32Array, times: Uint32Array, head: number, len: number }} Ring */

const EARTH_M_PER_DEG = 111_320;

function metersBetween(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * EARTH_M_PER_DEG;
  const dLon = (lon2 - lon1) * EARTH_M_PER_DEG * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLon);
}

/**
 * Creates a trail store.
 * @param {{ samples?: number, minGapSec?: number, minMoveM?: number,
 *   retentionSec?: number, maxVehicles?: number, sweepEverySec?: number }} [options]
 * @returns {{ record: (id: string, lat: number, lon: number, epochSec: number) => boolean,
 *   read: (id: string, nowSec: number) => Array<[number, number, number]>,
 *   sweep: (nowSec: number) => number, size: () => number, retentionSec: number }}
 */
export function createTransitTrailStore({
  samples = 64,
  minGapSec = 10,
  minMoveM = 15,
  retentionSec = 900,
  maxVehicles = 8000,
  sweepEverySec = 60,
} = {}) {
  /** @type {Map<string, Ring>} insertion order = least recently heard first */
  const rings = new Map();
  let lastSweepSec = 0;

  const newestIndex = (ring) => (ring.head - 1 + samples) % samples;

  function write(ring, lat, lon, epochSec) {
    ring.lats[ring.head] = lat;
    ring.lons[ring.head] = lon;
    ring.times[ring.head] = epochSec;
    ring.head = (ring.head + 1) % samples;
    ring.len = Math.min(ring.len + 1, samples);
  }

  /**
   * Drops every vehicle not heard from within the retention window.
   * @param {number} nowSec
   * @returns {number} Vehicles dropped.
   */
  function sweep(nowSec) {
    lastSweepSec = nowSec;
    let dropped = 0;
    for (const [id, ring] of rings) {
      if (ring.times[newestIndex(ring)] < nowSec - retentionSec) {
        rings.delete(id);
        dropped += 1;
      }
    }
    return dropped;
  }

  /**
   * Records one reported position. Ignored when it is not newer than the
   * last kept sample, or closer to it than `minGapSec` and `minMoveM`.
   * @param {string} id - Vehicle id as served to the browser.
   * @param {number} lat
   * @param {number} lon
   * @param {number} epochSec - When the operator says the vehicle was there.
   * @returns {boolean} Whether a sample was kept.
   */
  function record(id, lat, lon, epochSec) {
    if (typeof id !== 'string' || !id) return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
    const t = Math.floor(Number(epochSec));
    if (!Number.isFinite(t) || t <= 0) return false;
    if (t - lastSweepSec >= sweepEverySec) sweep(t);
    let ring = rings.get(id);
    if (ring) {
      const last = newestIndex(ring);
      if (t <= ring.times[last]) return false;
      const moved = metersBetween(ring.lats[last], ring.lons[last], lat, lon);
      if (t - ring.times[last] < minGapSec || moved < minMoveM) {
        // A parked or crawling vehicle is still being HEARD: keep it at the
        // young end of the eviction order without storing the repeat.
        rings.delete(id);
        rings.set(id, ring);
        return false;
      }
      rings.delete(id);
    } else {
      ring = {
        lats: new Float32Array(samples),
        lons: new Float32Array(samples),
        times: new Uint32Array(samples),
        head: 0,
        len: 0,
      };
      while (rings.size >= maxVehicles) rings.delete(rings.keys().next().value);
    }
    write(ring, lat, lon, t);
    rings.set(id, ring);
    return true;
  }

  /**
   * One vehicle's kept samples within the retention window, oldest first.
   * @param {string} id
   * @param {number} nowSec
   * @returns {Array<[number, number, number]>} `[epochMs, lat, lon]` rows.
   */
  function read(id, nowSec) {
    const ring = rings.get(id);
    if (!ring) return [];
    const rows = [];
    const oldest = (ring.head - ring.len + samples) % samples;
    for (let i = 0; i < ring.len; i += 1) {
      const index = (oldest + i) % samples;
      if (ring.times[index] < nowSec - retentionSec) continue;
      rows.push([ring.times[index] * 1000, Number(ring.lats[index].toFixed(5)), Number(ring.lons[index].toFixed(5))]);
    }
    return rows;
  }

  return { record, read, sweep, size: () => rings.size, retentionSec };
}
