/**
 * @module cctvPacks
 *
 * Camera packs: one JSON file in `config/cctv-packs/` adds one city's public
 * cameras to the CCTV catalog. A pack is added BESIDE the live open-data packs
 * (Austin, Caltrans, TfL, Grand Lyon); `CCTV_SOURCES_FILE`, the older file
 * route, replaces them instead. Adding a city therefore takes one file and
 * its line in DATA_SOURCES.md — no code.
 *
 * Pure: `vite.config.js` reads the files and hands their JSON here; the
 * browser uses {@link cctvPackCreditHtml} to credit a pack whose cameras are
 * in the catalog. The format is in `config/cctv-packs/README.md`. A bare array
 * of cameras — upstream God's Eye View's `config/cctv_sources.<city>.json`
 * format — is read too, with the file name as the pack id.
 */
import messages from './cctvPacks.i18n.js';

/** A pack id: lowercase letters, digits and dashes, 2-40 characters. */
export const CCTV_PACK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;
/** Cameras a pack keeps when it declares no `maxCameras`. */
export const CCTV_PACK_DEFAULT_MAX = 200;
/** Cameras a pack keeps at most, whatever it declares. */
export const CCTV_PACK_HARD_MAX = 600;

const CAMERA_ID_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;
const FEED_TYPES = new Set(['image', 'jpeg', 'jpg', 'png', 'mjpeg', 'mjpg', 'mp4', 'video', 'hls', 'stream']);
const POSE_FIELDS = ['headingDeg', 'pitchDeg', 'fovDeg', 'rangeM', 'mountHeightM', 'groundElevationM', 'upstreamCadenceMs'];
const TEXT_FIELDS = ['name', 'city', 'cityId', 'provider', 'license', 'headingConfidence'];

/**
 * Whether a frame URL may be registered: http(s) only, and never a host that
 * names this machine or a private network — a pack is committed data, but the
 * server fetches its URLs, so a typo must not turn into a request inward.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicFrameUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
  if (host.includes(':')) {
    // An IPv6 literal: loopback, unspecified, unique-local (fc00::/7),
    // link-local (fe80::/10), or an IPv4-mapped address hiding any of those.
    if (host === '::1' || host === '::' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host)) return false;
    if (host.startsWith('::ffff:')) return false;
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  return true;
}

/**
 * Reads a pack's credit block; every field is optional text except that a
 * link must be http(s).
 * @param {unknown} raw
 * @returns {{ text: string, url: string, license: string, licenseUrl: string }}
 */
function readCredit(raw) {
  const credit = raw && typeof raw === 'object' ? raw : {};
  const text = (value) => (typeof value === 'string' ? value.trim().slice(0, 200) : '');
  const link = (value) => {
    const candidate = text(value);
    return /^https?:\/\//i.test(candidate) ? candidate : '';
  };
  return {
    text: text(credit.text),
    url: link(credit.url),
    license: text(credit.license),
    licenseUrl: link(credit.licenseUrl),
  };
}

/**
 * Parses one pack file.
 * @param {unknown} json - The file's parsed JSON: a pack object, or a bare
 *   array of cameras.
 * @param {{ fileName?: string }} [options] - The file name gives a bare array
 *   its pack id (`cctv_sources.` and `.json` stripped).
 * @returns {{ error: string } | {
 *   pack: { id: string, name: string, enabled: boolean, maxCameras: number,
 *     credit: { text: string, url: string, license: string, licenseUrl: string } },
 *   cameras: Array<object>, rejected: Array<{ index: number, reason: string }> }}
 *   Cameras are raw source items for the server's `normalizeSourceItem`, ids
 *   prefixed with the pack id unless they already carry it, with
 *   `sourceKind: 'pack'`, `packId` and the pack's `credit`.
 */
export function parseCctvPack(json, options = {}) {
  const fileId = String(options.fileName || '')
    .replace(/\.json$/i, '')
    .replace(/^cctv_sources\./, '')
    .toLowerCase();
  const object = Array.isArray(json) ? { id: fileId, cameras: json } : json;
  if (!object || typeof object !== 'object') return { error: 'not a pack object or a camera array' };
  const id = String(object.id || '').trim();
  if (!CCTV_PACK_ID_PATTERN.test(id)) return { error: `pack id "${id}" is not 2-40 lowercase letters, digits or dashes` };
  if (!Array.isArray(object.cameras)) return { error: `pack ${id} has no cameras array` };
  const declaredMax = Number(object.maxCameras);
  const maxCameras = Number.isFinite(declaredMax) && declaredMax > 0
    ? Math.min(CCTV_PACK_HARD_MAX, Math.floor(declaredMax))
    : CCTV_PACK_DEFAULT_MAX;
  const credit = readCredit(object.credit);
  // A pack without a credit block (upstream's bare arrays) is credited with
  // its first camera's own provider and licence.
  const first = object.cameras.find((camera) => camera && typeof camera === 'object') || {};
  if (!credit.text && typeof first.provider === 'string') credit.text = first.provider.trim().slice(0, 200);
  if (!credit.license && typeof first.license === 'string') credit.license = first.license.trim().slice(0, 200);
  const defaults = object.defaults && typeof object.defaults === 'object' ? object.defaults : {};
  const pack = {
    id,
    name: typeof object.name === 'string' && object.name.trim() ? object.name.trim() : id,
    enabled: object.enabled !== false,
    maxCameras,
    credit,
  };

  const cameras = [];
  const rejected = [];
  const seen = new Set();
  object.cameras.forEach((raw, index) => {
    const reject = (reason) => rejected.push({ index, reason });
    if (!raw || typeof raw !== 'object') return reject('not an object');
    const camera = { ...defaults, ...raw };
    const rawId = String(camera.id || '').trim();
    if (!CAMERA_ID_PATTERN.test(rawId)) return reject(`camera id "${rawId}" is empty or has characters outside A-Z a-z 0-9 . _ -`);
    const cameraId = rawId === id || rawId.startsWith(`${id}-`) ? rawId : `${id}-${rawId}`;
    if (seen.has(cameraId)) return reject(`camera id ${cameraId} repeats`);
    const lat = Number(camera.lat);
    const lon = Number(camera.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return reject(`camera ${cameraId} has no valid lat/lon`);
    }
    const url = isPublicFrameUrl(camera.url) ? camera.url : '';
    const snapshotUrl = isPublicFrameUrl(camera.snapshotUrl) ? camera.snapshotUrl : '';
    if (!url && !snapshotUrl) return reject(`camera ${cameraId} has no public http(s) url or snapshotUrl`);
    const feedType = String(camera.feedType || 'image').toLowerCase();
    if (!FEED_TYPES.has(feedType)) return reject(`camera ${cameraId} has an unknown feedType "${feedType}"`);
    if (cameras.length >= maxCameras) return reject(`pack ${id} keeps its first ${maxCameras} cameras`);
    seen.add(cameraId);

    const item = { id: cameraId, lat, lon, feedType, url: url || snapshotUrl, snapshotUrl };
    for (const field of TEXT_FIELDS) {
      if (typeof camera[field] === 'string' && camera[field].trim()) item[field] = camera[field].trim().slice(0, 200);
    }
    for (const field of POSE_FIELDS) {
      const value = Number(camera[field]);
      if (camera[field] != null && Number.isFinite(value)) item[field] = value;
    }
    if (!item.provider) item.provider = credit.text || pack.name;
    if (!item.license) item.license = credit.license;
    if (camera.poseSource === 'curated') item.poseSource = 'curated';
    item.sourceKind = 'pack';
    item.packId = id;
    item.credit = credit;
    cameras.push(item);
  });
  return { pack, cameras, rejected };
}

/**
 * Whether a parsed pack loads: `enabled: false` in its file, the id listed in
 * `CCTV_PACKS_DISABLED`, or `CCTV_PACKS_ENABLED=0` turn it off.
 * @param {{ id: string, enabled: boolean }} pack
 * @param {{ CCTV_PACKS_ENABLED?: string, CCTV_PACKS_DISABLED?: string }} [env]
 * @returns {boolean}
 */
export function cctvPackEnabled(pack, env = {}) {
  if (!pack?.enabled) return false;
  if (String(env.CCTV_PACKS_ENABLED ?? '1').trim() === '0') return false;
  const disabled = String(env.CCTV_PACKS_DISABLED || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return !disabled.includes(pack.id);
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

/**
 * The Data attribution entry for a pack, in the reader's language: « Public
 * cameras and frames (City): Publisher (Licence) », publisher and licence
 * linked when the pack gives their URLs. Everything from the file is escaped.
 * @param {{ text?: string, url?: string, license?: string, licenseUrl?: string }} credit
 * @param {string} [city] - The pack's city, when its cameras share one.
 * @returns {string} HTML, or '' when the pack names no publisher.
 */
export function cctvPackCreditHtml(credit, city = '') {
  if (!credit?.text) return '';
  const link = (label, href) => (href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
    : escapeHtml(label));
  const license = credit.license ? ` (${link(credit.license, credit.licenseUrl)})` : '';
  return `${escapeHtml(messages().creditLead(city))}: ${link(credit.text, credit.url)}${license}`;
}
