#!/usr/bin/env node
/**
 * Sweep every Cart@DS board into the archive, from a shell.
 *
 *   npm run cartds:archive                      # every instance, into .gev-cache/archive/cartds
 *   npm run cartds:archive -- --only mamp,ccbr  # some instances
 *   npm run cartds:archive -- --dir <path>      # another archive
 *   npm run cartds:archive -- --join <path>     # fold another copy into --dir, no request
 *
 * The hosted server sweeps once a day by itself (`CARTDS_ARCHIVE`, see
 * vite.config.js); this is the same sweep for a machine that is not serving,
 * or for a day the server missed. `--join` merges an archive swept elsewhere,
 * so two hosts that swept on different days end with every row either saw.
 * Same requests, same user agent and same pause as the server's sweep.
 */

import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CARTDS_INSTANCES } from '../src/data/cartdsFeed.js';
import { readCartdsArchive } from '../src/data/cartdsArchive.js';
import { readResponseTextCapped } from '../src/data/httpCapped.js';
import {
  CARTDS_ARCHIVE_DIR,
  CARTDS_USER_AGENT,
  createCartdsArchiveStore,
  sweepCartdsArchive,
  writeCartdsSweepStamp,
} from './lib/cartdsArchive.mjs';

const TIMEOUT_MS = 20_000;
const TEXT_MAX_BYTES = 24 * 1024 * 1024;

const { values } = parseArgs({
  options: {
    dir: { type: 'string', default: CARTDS_ARCHIVE_DIR },
    only: { type: 'string' },
    join: { type: 'string' },
    pause: { type: 'string', default: '1000' },
  },
});

const dir = path.resolve(values.dir);
const store = createCartdsArchiveStore(dir);

if (values.join) {
  const from = path.resolve(values.join);
  let joined = 0;
  for (const instance of CARTDS_INSTANCES) {
    for (const insee of instance.communes) {
      let document;
      try {
        document = JSON.parse(await fsp.readFile(path.join(from, `${insee}.json`), 'utf8'));
      } catch {
        continue;
      }
      const { archive, usable } = readCartdsArchive(document, instance, insee);
      if (!usable) { console.warn(`[cartds-archive] ${insee}: ${from} holds no usable archive, skipped`); continue; }
      const answer = await store.join(instance, insee, archive);
      if (answer.saved) joined += 1;
    }
  }
  console.log(`[cartds-archive] joined ${joined} communes from ${from} into ${dir}`);
  process.exit(0);
}

const keys = values.only ? new Set(values.only.split(',').map((key) => key.trim())) : null;
const instances = keys ? CARTDS_INSTANCES.filter((instance) => keys.has(instance.key)) : CARTDS_INSTANCES;
if (keys && instances.length !== keys.size) {
  const known = new Set(CARTDS_INSTANCES.map((instance) => instance.key));
  console.error(`Unknown instance: ${[...keys].filter((key) => !known.has(key)).join(', ')}`);
  process.exit(2);
}

const http = {
  async fetch(url, init = {}) {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': CARTDS_USER_AGENT, ...(init.headers || {}) },
      });
    } catch (error) {
      console.warn(`[cartds-archive] ${new URL(url).host}: ${error?.cause?.code || error?.message || error}`);
      return null;
    }
  },
  async text(response, maxBytes = TEXT_MAX_BYTES) {
    try { return await readResponseTextCapped(response, maxBytes); } catch { return null; }
  },
};

const summary = await sweepCartdsArchive({
  instances, store, http, pauseMs: Number(values.pause) || 0,
});
// A partial sweep (`--only`) does not stand for the day's sweep: the server
// would otherwise skip every instance it left out.
if (!keys) await writeCartdsSweepStamp(dir, summary);
process.exit(summary.failed.length && !summary.read ? 1 : 0);
