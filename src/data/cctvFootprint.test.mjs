// src/data/cctvFootprint.test.mjs — the monitor plane's support grid, its
// rigid lift and the pose hash (same cases as upstream's 12790b36).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_KEYS,
  planeDimensions,
  planeSupportPoints,
  poseHash,
  projectPoint,
  requiredPlaneLift,
} from './cctvFootprint.js';

const pose = {
  lat: 45.7597,
  lon: 4.8422,
  headingDeg: 90,
  pitchDeg: -24,
  fovDeg: 56,
  rangeM: 210,
  mountHeightM: 10,
};

test('support points form a 3×3 grid across the pitched far cap', () => {
  const { mount, capCenter, supports } = planeSupportPoints(pose);
  assert.deepEqual(mount, { lat: pose.lat, lon: pose.lon });
  assert.deepEqual(Object.keys(supports).sort(), [...SUPPORT_KEYS].sort());
  const dims = planeDimensions(pose);
  // Heading 90: the cap center sits R·cos(pitch) east of the mount.
  const east = projectPoint(pose.lat, pose.lon, 90, dims.horiz);
  assert.ok(Math.abs(capCenter.lat - east.lat) < 1e-9 && Math.abs(capCenter.lon - east.lon) < 1e-9);
  assert.ok(Math.abs(supports.mc.lat - capCenter.lat) < 1e-9, 'middle-center is the cap center');
  assert.ok(supports.ml.lat > capCenter.lat && supports.mr.lat < capCenter.lat, 'left is north when looking east');
  // A downward pitch tilts the top row forward, further along the heading.
  assert.ok(supports.tm.lon > supports.mc.lon && supports.bm.lon < supports.mc.lon);
});

test('the plane spans the frame: halfW from hFov, halfH from a 16:9 vFov', () => {
  const dims = planeDimensions(pose);
  const hFov = (56 * Math.PI) / 180;
  const vFov = 2 * Math.atan(Math.tan(hFov / 2) / (16 / 9));
  assert.ok(Math.abs(dims.halfW - 210 * Math.tan(hFov / 2)) < 1e-9);
  assert.ok(Math.abs(dims.halfH - 210 * Math.tan(vFov / 2)) < 1e-9);
  assert.ok(Math.abs(dims.vert - 210 * Math.sin((-24 * Math.PI) / 180)) < 1e-9);
});

test('the rigid lift is the largest clearance deficit over the supports', () => {
  const dims = planeDimensions(pose);
  const ground = 170;
  const capAlt = ground + pose.mountHeightM + dims.vert; // far underground at -24°
  const flat = requiredPlaneLift(capAlt, dims, null, ground, 2);
  assert.ok(Math.abs(flat.liftM - (ground + 2 - (capAlt - dims.upVert))) < 1e-9);
  assert.equal(flat.limitingKey[0], 'b');
  const hill = requiredPlaneLift(capAlt, dims, { tr: ground + 200 }, ground, 2);
  assert.equal(hill.limitingKey, 'tr');
  assert.ok(hill.liftM > flat.liftM);
  assert.deepEqual(requiredPlaneLift(ground + 500, dims, null, ground, 2), { liftM: 0, limitingKey: null });
  // Unusable measurements fall back to the mount ground, never to 0 m.
  assert.equal(requiredPlaneLift(capAlt, dims, { bl: null, br: 'x' }, ground, 2).liftM, flat.liftM);
});

test('poseHash is stable for the same pose and changes with any pose field', () => {
  const hash = poseHash(pose);
  assert.equal(poseHash({ ...pose }), hash);
  assert.match(hash, /^p1-[0-9a-z]+$/);
  for (const [key, delta] of [
    ['lat', 0.00001],
    ['lon', 0.00001],
    ['headingDeg', 0.1],
    ['pitchDeg', 0.1],
    ['fovDeg', 0.1],
    ['rangeM', 1],
    ['mountHeightM', 0.1],
  ]) {
    assert.notEqual(poseHash({ ...pose, [key]: pose[key] + delta }), hash, key);
  }
});
