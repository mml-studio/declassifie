/**
 * @module cctvFootprint
 *
 * Where a CCTV monitor plane stands on the ground, and how far it must rise to
 * stay out of it. Pure math: no Cesium, no DOM, so `cctv.js` renders with it
 * and the tests run it in Node.
 *
 * The plane is the pitched far cap of the camera frustum: its center sits at
 * range R along the heading (R·cos(pitch) horizontally), it is R·tan(hFov/2)
 * wide either side and R·tan(vFov/2) tall either side, with vFov from a 16:9
 * frame, and it tilts with the pitch. Nine support points cover it in a 3×3
 * grid — rows bottom / middle / top, columns left / center / right, named
 * `bl bm br ml mc mr tl tm tr`. Their positions on the map depend on the pose
 * alone, never on the ground, so the ground under them can be looked up once
 * per pose.
 *
 * The same support grid, lift rule and pose hash as upstream God's Eye View's
 * `src/data/cctvFootprint.js` (upstream commit 12790b36, 2026-09-13).
 */

const EARTH_RADIUS_M = 6371000;

/** Width/height ratio of the projected frame: the plane is a 16:9 rectangle. */
export const PLANE_VERT_ASPECT = 16 / 9;

/** Support point keys: row letter (b, m, t) then column letter (l, m/c, r). */
export const SUPPORT_KEYS = Object.freeze(['bl', 'bm', 'br', 'ml', 'mc', 'mr', 'tl', 'tm', 'tr']);

const ROW_OF = Object.freeze({ b: -1, m: 0, t: 1 });
// The center column is spelled `m` in the bottom and top rows (bm, tm) and
// `c` in the middle row (mc).
const COLUMN_OF = Object.freeze({ l: -1, m: 0, c: 0, r: 1 });

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/**
 * Offsets a lat/lon by a distance along a compass heading on a spherical
 * earth (sub-centimetre at the ≤ 2.2 km ranges cameras use).
 * @param {number} latDeg - Origin latitude (degrees).
 * @param {number} lonDeg - Origin longitude (degrees).
 * @param {number} bearingDeg - Azimuth from north (degrees).
 * @param {number} distanceM - Distance in metres.
 * @returns {{ lat: number, lon: number }} Destination in degrees.
 */
export function projectPoint(latDeg, lonDeg, bearingDeg, distanceM) {
  const angular = distanceM / EARTH_RADIUS_M;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(latDeg);
  const lon1 = toRad(lonDeg);

  const sinLat2 = Math.sin(lat1) * Math.cos(angular)
    + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing);
  const lat2 = Math.asin(sinLat2);

  const y = Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1);
  const x = Math.cos(angular) - Math.sin(lat1) * sinLat2;
  const lon2 = lon1 + Math.atan2(y, x);

  return { lat: toDeg(lat2), lon: toDeg(lon2) };
}

/**
 * Plane size and offsets for a pose, before any ground is known. Inputs are
 * clamped to the same ranges as the pose model (pitch ±89°, hFov 8-160°).
 * @param {{ pitchDeg: number, fovDeg: number, rangeM: number }} pose
 * @returns {{ R: number, pitch: number, halfW: number, halfH: number,
 *   horiz: number, vert: number, upVert: number, upHoriz: number,
 *   vFovDeg: number }}
 *   `upVert`/`upHoriz`: the plane's in-plane "up" split into a vertical part
 *   and a part along the heading (a downward pitch tilts the top forward).
 */
export function planeDimensions(pose) {
  const R = Math.max(1, Number(pose.rangeM) || 1);
  const pitch = toRad(Math.max(-89, Math.min(89, Number(pose.pitchDeg) || 0)));
  const hFov = toRad(Math.max(8, Math.min(160, Number(pose.fovDeg) || 74)));
  const halfW = R * Math.tan(hFov / 2);
  const vFovRad = 2 * Math.atan(Math.tan(hFov / 2) / PLANE_VERT_ASPECT);
  const halfH = R * Math.tan(vFovRad / 2);
  return {
    R,
    pitch,
    halfW,
    halfH,
    horiz: R * Math.cos(pitch),
    vert: R * Math.sin(pitch),
    upVert: Math.cos(pitch) * halfH,
    upHoriz: -Math.sin(pitch) * halfH,
    vFovDeg: toDeg(vFovRad),
  };
}

/**
 * Map positions of the mount, the plane center and the nine support points.
 * Altitudes are not part of this: the caller adds the ground it measured.
 * @param {{ lat: number, lon: number, headingDeg: number, pitchDeg: number,
 *   fovDeg: number, rangeM: number }} pose
 * @returns {{ mount: { lat: number, lon: number },
 *   capCenter: { lat: number, lon: number },
 *   supports: Record<string, { lat: number, lon: number, row: number, col: number }> }}
 */
export function planeSupportPoints(pose) {
  const dims = planeDimensions(pose);
  const heading = Number(pose.headingDeg) || 0;
  const capCenter = projectPoint(pose.lat, pose.lon, heading, dims.horiz);
  const supports = {};
  for (const key of SUPPORT_KEYS) {
    const row = ROW_OF[key[0]];
    const col = COLUMN_OF[key[1]];
    const across = projectPoint(capCenter.lat, capCenter.lon, heading + 90, col * dims.halfW);
    const along = projectPoint(across.lat, across.lon, heading, row * dims.upHoriz);
    supports[key] = { lat: along.lat, lon: along.lon, row, col };
  }
  return { mount: { lat: pose.lat, lon: pose.lon }, capCenter, supports };
}

/**
 * The smallest rigid lift (metres, ≥ 0) that puts every support point at
 * least `clearanceM` above the ground measured under it. A support point with
 * no measurement uses `fallbackGroundM` (the ground at the mount), so with no
 * measurement at all the plane's bottom edge still clears the mount's ground.
 * @param {number} capAltM - Plane center altitude before the lift.
 * @param {{ upVert: number }} dims - From {@link planeDimensions}.
 * @param {Record<string, number>|null|undefined} groundUnder - Support key → ground altitude.
 * @param {number} fallbackGroundM - Ground used where a support has no value.
 * @param {number} clearanceM - Clearance every support must keep.
 * @returns {{ liftM: number, limitingKey: string|null }}
 */
export function requiredPlaneLift(capAltM, dims, groundUnder, fallbackGroundM, clearanceM) {
  let liftM = 0;
  let limitingKey = null;
  for (const key of SUPPORT_KEYS) {
    const raw = groundUnder ? groundUnder[key] : undefined;
    // A null or absent support falls back; it must never read as 0 m.
    const ground = typeof raw === 'number' && Number.isFinite(raw) ? raw : fallbackGroundM;
    if (!Number.isFinite(ground)) continue;
    const alt = capAltM + ROW_OF[key[0]] * dims.upVert;
    const deficit = ground + clearanceM - alt;
    if (deficit > liftM) {
      liftM = deficit;
      limitingKey = key;
    }
  }
  return { liftM, limitingKey };
}

/**
 * Stable hash of the pose a footprint was measured for, so a measurement is
 * reused only while the rendered pose is the same.
 * @param {{ lat: number, lon: number, headingDeg: number, pitchDeg: number,
 *   fovDeg: number, rangeM: number, mountHeightM: number }} pose
 * @returns {string} `p1-` followed by a base-36 FNV-1a hash.
 */
export function poseHash(pose) {
  const text = [
    Number(pose.lat).toFixed(6),
    Number(pose.lon).toFixed(6),
    Number(pose.headingDeg).toFixed(1),
    Number(pose.pitchDeg).toFixed(1),
    Number(pose.fovDeg).toFixed(1),
    Number(pose.rangeM).toFixed(1),
    Number(pose.mountHeightM).toFixed(1),
  ].join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `p1-${hash.toString(36)}`;
}
