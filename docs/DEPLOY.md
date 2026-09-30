# Deploying Surplomb

Surplomb is **not a static site**. `vite.config.js` carries ~35 middleware
proxies that broker API keys, cache upstream answers on disk and hold the AIS
websocket open, so a deployment has to run a Node process — `vite preview`,
which serves the built bundle *and* those proxies. Anything that only uploads
`dist/` gives you a globe with no live layers.

Two consequences shape everything below:

1. **A reachable origin is a spendable wallet.** `/api/realtime/token` and
   `/api/google/nearby-places` cost real money per call. Set
   `GEV_ACCESS_PASSWORD` before the URL exists, not after.
2. **`GOOGLE_MAPS_API_KEY`, `CESIUM_ION_TOKEN` and `ARCGIS_API_KEY` are
   inlined at build time** (the `define` block in `vite.config.js`), so they
   must be present when the image is built, not only when it runs.

## Deploy your own

`deploy/vps/` holds everything a single Linux box with Docker needs: the
compose file, a pull-based deploy agent, a health probe, a road-cell warmer, a
weekly rebuild of the doctors' names and their systemd units. The commands below call that box `box` (an `ssh` alias)
and install into `/opt/gev`, the default `GEV_ROOT` of the scripts.

```bash
ssh box 'mkdir -p /opt/gev'
scp deploy/vps/docker-compose.yml deploy/vps/gev-deploy.sh deploy/vps/gev-health-probe.sh box:/opt/gev/
scp deploy/vps/gev-deploy.{service,timer} deploy/vps/gev-health-probe.{service,timer} deploy/vps/gev-warm-view.{service,timer} deploy/vps/gev-medecins-refresh.{service,timer} box:/etc/systemd/system/
ssh box 'chmod +x /opt/gev/gev-deploy.sh /opt/gev/gev-health-probe.sh && chmod 600 /opt/gev/.env'
ssh box 'systemctl daemon-reload && systemctl enable --now gev-deploy.timer gev-health-probe.timer gev-warm-view.timer gev-medecins-refresh.timer'
```

`/opt/gev/.env` needs at least:

```
GEV_ACCESS_USER=gev
GEV_ACCESS_PASSWORD=<a long random string>
GEV_PUBLIC_HOST=<every hostname the deployment answers on, comma-separated>
GOOGLE_MAPS_API_KEY=...
```

plus whatever optional keys you want the layers to have (see `.env.example`).
`GEV_PUBLIC_HOST` is not decoration: `vite preview` answers `Blocked request`
to a `Host` header it was not told about.

### How the deploy agent works

One box, one URL, showing the branch you most recently opened a pull request
for — as long as that branch still contains main. The box polls GitHub every
three minutes; nothing on GitHub needs a route back into the box, and the box
holds no CI credentials.

```
GitHub (public repo)
   ↑ poll every 3 min: newest open PR if it contains main, else main
/opt/gev/gev-deploy.sh  ──build──▶  docker compose  ──▶  gev container :4173
                                                            ↑              ↑
                                              tunnel or reverse proxy   private network
                                              (your public hostname)    GEV_TAILSCALE_IP:4173
```

### What the URL is allowed to show

**Whatever is served contains main.** A preview is main plus the pull request,
never main minus a merge. That qualifier is the whole rule, and it exists
because the URL lied on 2026-09-10: PR #155 had been cut at #152, so #153 and
#154 were merged and stayed invisible for the rest of the afternoon while the
box reported a healthy, freshly built container. Nothing was broken — the agent
had faithfully deployed exactly what it was asked to deploy.

So `auto` now measures the candidate before showing it. It asks GitHub how many
commits of main the branch is missing (`/compare/<main>...<head>`, `behind_by`)
and, if the answer is anything but zero, shows **main** instead and says why.
The same applies when the answer cannot be obtained at all — a rate limit, an
outage, a pull request opened from a fork whose branch does not exist here:
main is the ref that cannot be missing merged work, so main is the fallback.
**To get a branch on the URL, rebase it onto main.** That is the only new
obligation this rule creates, and CI asks for it anyway.

The verdict is cached against the exact pair of shas it was computed for, so a
three-minute timer spends **one** API call per push rather than twenty per hour
against the 60/h anonymous quota the box's IP shares with its neighbors.

An explicit pin (`echo my-branch > /opt/gev/target`) still outranks all of
this — it is a decision, not an accident — but a stale pin now announces itself
in the journal and in `state/selection` instead of being discovered hours later.

`cat /opt/gev/state/selection` answers "why am I looking at this?" in one line:

```
2026-09-10T14:32:11Z auto -> main@2a4163b (PR #155 arrets-idfm-icones-et-fiche is 2 commit(s) behind main)
```

`scripts/gev-deploy-target.test.mjs` runs the real script against a fake GitHub
and holds every branch of that decision, including the refusal to publish a ref
that predates the access gate.

### Layout on the box

| Path | What it is |
| --- | --- |
| `/opt/gev/gev-deploy.sh` | the deploy agent (copy of `deploy/vps/gev-deploy.sh`) |
| `/opt/gev/docker-compose.yml` | the stack (copy of `deploy/vps/docker-compose.yml`) |
| `/opt/gev/.env` | keys + `GEV_ACCESS_PASSWORD`, `chmod 600`. **Do not `source` it from bash**. A `.env` is not shell: an unquoted value with an apostrophe or a space kills `. /opt/gev/.env`, which is how `OPENROUTER_APP_NAME` did it under the project's previous name at line 152. Docker's `env_file` parser is not a shell and reads it correctly. |
| `/opt/gev/src` | the source tree the agent swaps out, unpacked from a tarball |
| `/opt/gev/target` | `auto` (default), `main`, or a branch name to pin |
| `/opt/gev/state/deployed` | `branch@sha` currently live |
| `/opt/gev/state/selection` | one line: which ref was chosen this tick, and why it was not the other one |
| `/opt/gev/state/freshness` | `<head> <base> <behind_by>`, the cached verdict for one pair of shas |
| `/opt/gev/gev-health-probe.sh` | availability probe (copy of `deploy/vps/gev-health-probe.sh`) |
| `/opt/gev/src/scripts/warm-road-cells.mjs` | weekly Overpass pre-warm for the ten cities, run by `gev-warm-view.timer` — ships with the source, nothing to copy |
| volume `gev_gev-cache`, `medecins-fr/pack/` | the doctors' pack with its names, rebuilt every Monday by `gev-medecins-refresh.timer` |
| volume `gev_gev-cache`, `medecins-fr/suppress.txt` | the doctors who asked not to appear, one per line; never in git |
| volume `gev_gev-cache`, `archive/cartds/` | every permit row the communes' Cart@DS boards have posted since 2026-09-30, swept daily by the server itself (`sweep.json` = the last sweep). **Irreplaceable**: a board forgets after two months. Back it up before touching the volume; `npm run cartds:archive -- --join <copy>` folds a copy back in |
| `/opt/gev/state/health.log` | one line per probe, ~7 days |

### Day to day

```bash
ssh box 'cat /opt/gev/state/deployed'          # what is live right now
ssh box 'cat /opt/gev/state/selection'         # ...and why it, rather than main
ssh box 'echo my-branch > /opt/gev/target'     # pin the URL to one branch
ssh box 'echo auto      > /opt/gev/target'     # back to newest-open-PR
ssh box 'systemctl start gev-deploy.service'   # deploy now, do not wait
ssh box 'journalctl -u gev-deploy -n 50'       # why a deploy did not happen
ssh box 'docker logs -n 50 gev'                # why the app misbehaves
```

A failed build leaves the previous container running: the URL never goes dark
because a PR does not compile. A ref cut before the access gate existed is
refused outright rather than deployed open. A branch that is behind main is not
refused — it is simply not shown, and main takes the URL until the branch is
rebased.

To check the deployment the way a browser meets it — bundle boots, canvas
draws, layer proxies answer from that origin — rather than by trusting a
`200` from `/healthz`:

```bash
node scripts/qa-deployment.mjs --url https://<your-host>/
```

### Why the source arrives as a tarball and not a clone

On 2026-09-02 every deploy on the staging box started failing with `could not
read Username for 'https://github.com'`, three minutes apart, while the
repository stayed public and cloned fine from a laptop. Tracing it with
`GIT_CURL_VERBOSE=1` narrowed it to one request: GitHub answered that box's
anonymous ref advertisement — a GET on `/info/refs` — with **200**, then
returned **401** to `POST /git-upload-pack`. Every pack transfer goes through
that POST, so `clone` and `fetch` were both unavailable there whatever the
protocol version. Listing a ref still worked, but only in **protocol v0**,
which does not POST; the v2 default could not resolve a branch head from that
IP at all.

So the agent resolves the head with `git -c protocol.version=0 ls-remote` and
downloads the tree from `codeload.github.com`, a plain GET. Both are anonymous,
which is the point: the alternative was a token, and the box deliberately
holds no credential that GitHub would honor. The costs are real and accepted —
the full tree every time instead of an incremental fetch, and `/opt/gev/src` is
not a git repository, so `git -C /opt/gev/src log` does not answer. Read
`/opt/gev/state/deployed` instead; it carries the sha.

### The compose file does not update itself

The deploy agent swaps `/opt/gev/src` on every run, but it calls
`docker compose up -d --build` with **the box's own
`/opt/gev/docker-compose.yml`**, which it never rewrites. So a PR that adds an
environment variable to the repository's compose file is **inert on the box**
until that file is copied over by hand.

Not hypothetical: the chronicle merged on 2026-09-07 carrying
`CHRONICLE_IRVE_DYNAMIC: 1` in `deploy/vps/docker-compose.yml`, the staging
copy dated from 2026-09-01, and the QualiCharge poller — the **only** source
that records without anyone looking — stayed disarmed for a day with no error
and no log line, `/api/chronicle-fr/status` simply answering
`irveDynamic.armed: false`.

```bash
scp deploy/vps/docker-compose.yml box:/opt/gev/
ssh box 'cd /opt/gev && docker compose up -d'    # recreates the container; `restart` will not
ssh box 'set -a; . /opt/gev/.env; set +a; curl -s -u "gev:$GEV_ACCESS_PASSWORD" \
  http://localhost:4173/api/chronicle-fr/status | head -c 200'
```

After any merge meant to change the environment, read `armed` — not GitHub.

### Bounds, for a box you share

The compose file is written for a small box that also runs a production
database: 2 vCPU, 8 GB and **no swap at all**. Until 2026-09-09 the container
had no memory limit, no CPU limit and no heap ceiling, so an Overpass or AIS
cache that ran away, or a burst of cold boots gzipping 8 MB of JavaScript on
the fly, could take the memory out from under the database. Measured that day,
idle: **197 MiB and ~2% CPU**, against 427 MB free and 4.6 GB available on the
host.

`deploy/vps/docker-compose.yml` now carries four numbers:

| Setting | Value | What it is for |
| --- | --- | --- |
| `mem_limit` / `memswap_limit` | `1g` / `1g` | 5× the idle footprint. Equal values because the host has no swap, and that is how Docker is told not to start using any. |
| `cpus` | `1.5` | a ceiling on a runaway, not a reservation. |
| `cpu_shares` | `512` | the weight **under contention** — half the default, so the container yields the core to the database when both want it, and still burns 1.5 vCPU when the box is idle. |
| `NODE_OPTIONS` | `--max-old-space-size=768` | Node sizes its heap from the **host's** memory, not the cgroup's. Without this the heap happily grows past `mem_limit` and the kernel OOM-kills the process instead of V8 collecting. |

Applying them is the `scp` from the section above — the deploy agent never
rewrites that file — and then:

```bash
scp deploy/vps/docker-compose.yml box:/opt/gev/
ssh box 'cd /opt/gev && docker compose config >/dev/null && docker compose up -d'
ssh box 'docker inspect gev --format "mem={{.HostConfig.Memory}} cpus={{.HostConfig.NanoCpus}} shares={{.HostConfig.CpuShares}}"'
ssh box 'docker stats --no-stream gev'
```

`docker inspect` reporting `mem=0` means the compose file was copied but the
container was only restarted, not recreated: `docker compose up -d` is the
verb, `restart` is not.

### Is it still up?

`gev-deploy.timer` knows the container was built and started. It learns
nothing about the tunnel, DNS, an edge rule, or a process that came up and
then wedged — so every outage on staging was found by somebody looking at a
screen until this existed. `deploy/vps/gev-health-probe.sh` checks both ends
every five minutes and writes one line per run:

```
2026-09-09T20:14:03Z origin=200 0.004 {"ok":true,...} public=200 0.081 {"ok":true,...}
```

`origin` up with `public` down is the tunnel or DNS; both down is the app. It
runs **from the box**, never from a laptop: an edge rule in front of the
origin is per source address, and the laptop shares its address with the
owner's browser.

```bash
scp deploy/vps/gev-health-probe.sh box:/opt/gev/
scp deploy/vps/gev-health-probe.{service,timer} box:/etc/systemd/system/
ssh box 'chmod +x /opt/gev/gev-health-probe.sh'
ssh box 'systemctl daemon-reload && systemctl enable --now gev-health-probe.timer'
ssh box 'tail -5 /opt/gev/state/health.log'
```

## Data packs

Four layers draw from a pack in the container's cache volume rather than from
an upstream at request time. Three are built on the box; the mobile-coverage
pyramid is built on a workstation and copied there.

### The 2021 carroyage pack

The INSEE carroyage the Géoplateforme relays is **millésime 2019**; INSEE
published 2021 on 2026-02-12 and the relay has not moved. A deployment draws
2021 only if the pack is built into the container's cache volume:

```bash
ssh box 'docker exec gev npm run filosofi:pack-2021'   # ~2 min, 91 MB in, 59 MB out
ssh box 'docker exec gev node scripts/build-filosofi-2021-pack.mjs --check'
```

It writes to `/app/.gev-cache/filosofi-2021`, which is the `gev-cache` named
volume, so it **survives redeploys** and only has to be rebuilt when INSEE ships
a new millésime. Without it the proxy serves the relay and reports
`vintage: 2019` — the year travels with every answer, so the deployment is
never wrong about which one it is showing, only older.

**Nothing else to do after the build.** The proxy re-checks for a pack once a
minute, and the millésime is part of the viewport cache key, so boxes already
cached under the relay are simply never read again. Neither of those was true
the first time this ran: staging kept answering 2019 until the cache was wiped
*and* the container restarted, in that order, and nothing on the wire said why.

The build streams the three CSVs straight out of the archive: no `unzip` (the
image has none) and no 473 MB of expanded intermediates on the volume.

### The everyday-amenity pack

`amenities-fr` draws 445 380 points folded from the INSEE BPE and FINESS. The
fold peaks around **1.3 GB of RSS**, which does not fit in this container, and
until 2026-09-14 the proxy did it in-process on the first request: measured that
day, memory went 327 → 941 MiB in fourteen seconds and the container died of
`Ineffective mark-compacts near heap limit`, exit 134, and restarted. Switching
the layer on took staging down, for everyone, every time.

So `GEV_AMENITIES_INPROCESS_BUILD=0` is set in the compose file, and the pack is
built in a **throwaway container off the same image**, with its own cgroup and
the cache volume mounted:

```bash
ssh box '
  docker run --rm -m 3800m --memory-swap 3800m \
    -e NODE_OPTIONS=--max-old-space-size=3072 \
    -v gev_gev-cache:/app/.gev-cache \
    gev:staging npm run amenities:pack &&
  docker restart gev &&
  docker exec gev npm run amenities:pack -- --check
'
```

**3072 is a floor, not a round number.** Measured 2026-09-14 on the real
archive: 2048 and 2560 both die of `Ineffective mark-compacts near heap limit`
partway through the BPE read, 3072 finishes in 40 s at 1 751 MB of peak RSS. The
first try on staging used 2048 and aborted at two million rows. Check `free -m`
before running it: the throwaway container may take up to 3.8 GB, next to
whatever else the box runs.

**Not on the host and not with `docker exec`.** The host needs neither Node
nor `node_modules` — everything builds inside Docker — and `docker exec gev`
shares the running container's 1 GiB cgroup, which is the ceiling this whole
section exists to get out from under. A throwaway `docker run` is the only one
of the three that has the image, the volume and a budget of its own.

The `docker restart` is not optional. The proxy reads the pack once per process
and remembers that it found nothing, so a container that started before the pack
existed keeps answering 503 until it is restarted.

It writes `pack.json` (mesh, rollup, provenance, shard index — ~10 MB) plus 356
gzipped `sites/<cell>.json.gz` shards (~14 MB). The server holds the first and
reads at most four shards per `/sites` request: **405 MB RSS** with the layer
live, against 644 MB of heap for the single-document pack it replaced.

**Rebuild it whenever `AMENITIES_CACHE_VERSION` changes.** That is the other half
of the 2026-09-14 outage: version 2 shipped on 2026-09-08, nobody rebuilt, and
the version-1 file sat in the volume being refused for six days. `--check` reports
the version and the age; `/api/amenities-fr/status` reports `pack: null` when
there is nothing usable, and the proxy now logs *why* it refused a file.

BPE is published once a year and FINESS once a month, so a pack is fresh for 30
days and served stale for 120.

### The mobile-coverage pyramid

The coverage chips on the Antennes mobiles row (dead zones, and each
operator's 4G) draw from a tile pyramid of the ARCEP's quarterly coverage maps.
It needs **GDAL and 7-Zip**, which the image does not have, 1.35 GB of
download and about 20 GB of scratch disk, so it is built on a workstation and
copied to the box:

```bash
brew install gdal sevenzip                      # once
node scripts/build-mobile-coverage.mjs          # last edition; --edition 2026_T1 to pin one
node scripts/build-mobile-coverage.mjs --check  # edition, tile count, size, land area
tar -C .gev-cache -czf /tmp/mobile-coverage.tgz mobile-coverage
scp /tmp/mobile-coverage.tgz box:/tmp/
ssh box 'docker cp /tmp/mobile-coverage.tgz gev:/tmp/ &&
  docker exec gev tar -C /app/.gev-cache -xzf /tmp/mobile-coverage.tgz'
```

Measured on the 2026 T1 edition (2026-09-22, a 16 GB Mac): rasterising took
505, 207, 294 and 279 s for the four operators, tiling 81 s, and the result is
17 316 PNG tiles, **196 MB**. `gdal_rasterize` must be given a cache that holds
the whole 1.86 GB grid — the script sets `GDAL_CACHEMAX=2200` — or it thrashes
the disk: four in parallel on the default cache ran at 4–8 % CPU each.

No restart is needed: the proxy re-reads `current` and the meta when their
modification time changes. The tiles are served from `/tiles/mobile-coverage/`,
**outside `/api`**, with an immutable cache header — a coverage view asks for
30 to 90 tiles at once, which neither the proxy's limiter nor an edge rule on
`/api` would let through. A box without the pyramid answers 404 on
`/api/anfr-fr/coverage` and the chips simply do not appear.

The ARCEP publishes a new edition each quarter; rebuild when it does. The
work directory (`~/gev-couverture` by default) can be deleted afterwards.

### The doctors' names (weekly)

`medecins-fr` draws every practice address from the name-free
`medecins.json.gz` in git. The **names** on its cards are not in git: the box
builds them from the CNAM's *Annuaire santé Ameli* into the cache volume, with a
fresh `medecins.json.gz` beside them, and rebuilds both every Monday, so a
correction made at Ameli reaches the map within a week. Why, and the file
formats: `src/data/local_data/medecins_fr/README.md`.

```bash
scp deploy/vps/gev-medecins-refresh.{service,timer} box:/etc/systemd/system/
ssh box 'systemctl daemon-reload && systemctl enable --now gev-medecins-refresh.timer'
ssh box 'systemctl start --no-block gev-medecins-refresh.service'   # build now
ssh box 'journalctl -u gev-medecins-refresh -n 30'                   # how it went
curl -s https://<your-host>/api/medecins-fr/status | jq '{origin, edition, names, suppressionEntries}'
```

`origin: "runtime"` and `names.available: true` is the healthy answer; `edition`
is the Ameli publication the names come from. `origin: "repository"` means no
build has landed yet: the layer draws, and its cards say the names are not
available on this server. Nothing else to do after a build — the proxy re-checks
the pair once a minute, and sits a rebuild out on the pair it already has until
both files are in place.

The build runs like the amenity pack's: a **throwaway container off the running
image**, with the volume mounted and a memory budget of its own, never
`docker exec gev`. Measured on 2026-09-22 against the 2026-09-21 edition: a full
`--refresh` build takes **6 min 21 s**, nearly all of it waiting on the BAN;
its heap dies at 1280 MB and finishes at 1536 MB (1.76 GB peak footprint), so
the unit gives it `--max-old-space-size=2048` inside a **2560m** container,
where a full run peaked at 1.95 GB — check `free -m` if the box is short. It downloads 214 MB (the register alone is
159 MB) and sends 64,691 addresses to the BAN in 8,000-row batches. A failed
run writes nothing and the previous pair keeps serving. The build keeps only
the current edition of each downloaded register file.

**An objection is one line.** When a doctor asks not to appear, append the name
as the directory spells it (optionally `; <postal-code prefix>`) to the
suppression list in the volume:

```bash
ssh box 'docker exec gev sh -c "echo \"SURNAME FIRSTNAME ; 75011\" >> /app/.gev-cache/medecins-fr/suppress.txt"'
```

The proxy reads the file again on the next card anyone opens, and the next
weekly build leaves the entry out of the names file too. The list never goes
into git — it names exactly the people who asked not to be named. A list that
exists but cannot be read hides every name until it is fixed.
`GEV_MEDECINS_SUPPRESS` and `GEV_MEDECINS_PACK_DIR` move the list and the pair
elsewhere, for a self-hosted instance that keeps its data outside the volume.

## Road data: Overpass

### Somebody pays for the first road fetch — and on a bad day, nobody gets it

A cold Overpass box costs **0.6 to 46 s**; the same query repeated costs
**52 to 78 ms**, and the proxy holds it on disk for **30 days**. So somebody
pays the cold price once a month per cell, and until 2026-09-16 that was
whoever arrived first — with nothing on screen while they waited.

It is worse than a wait when the upstream is refusing. That day, Paris looked
perfect (default view, permanently warm) while Marseille and Biarritz drew a
colored TomTom ribbon with **no vehicles on it**. A warm cache is not a
speed-up here, it is the difference between degraded and working.

`gev-warm-view.timer` runs `scripts/warm-road-cells.mjs` weekly over **ten
cities** — Paris, Marseille, Lyon, Toulouse, Nice, Nantes, Montpellier,
Bordeaux, Lille, Biarritz — firing the layer's own passes at each, byte for
byte. **Thirty requests, ten seconds apart, and the run gives up after three
consecutive failures.** That pacing is the design, not a detail: a warmer is
the most burst-shaped traffic this site produces, and overpass-api.de escalates
to refusal under a burst (see the next section). A warmer that gets the host to
stop answering has made things worse.

**One cell per city per band, and one of the two bands is a guess.** The metro
cell (0.30°, ~33 km) is a certainty — it is wider than any of these cities, so
any arrival lands in it. The street cell (0.05°, ~5.5 km on a ~555 m lattice)
depends on where the camera LOOKS, not where it is, so the script warms the
cell the app's own house framing produces and no more. `src/data/warmCities.js`
states which is which, and why there is no 3×3 block of neighbors.

Things about it that are not obvious:

- **It runs against `localhost:4173`, not the public URL.** The cache being
  warmed is the proxy's own, inside the container; and an edge rule in front
  of the origin is per source address.
- **It uses the HOST's node, not the container's.** The script imports only
  local modules — no `node_modules` — so it needs nothing the container has.
  (The container's bundled Chrome does not run anyway: `libglib-2.0.so.0`
  is missing from the slim image.)
- **It computes the cells instead of observing them**, which would rot silently
  the day `DEFAULT_CITY_VIEW` or a `snapDeg` moves. `src/defaultView.test.mjs`
  pins the derivation against the box captured off the wire by
  `scripts/qa-span-par-viewport.mjs`, so that day fails CI by name instead.
- **`--only` and `--dry-run` exist so you never have to warm all ten to check
  one.** `node scripts/warm-road-cells.mjs --dry-run` asks nothing and prints
  every cell it would fetch; `--only Lyon,Lille` narrows a real run.

```bash
scp deploy/vps/gev-warm-view.{service,timer} box:/etc/systemd/system/
ssh box 'systemctl daemon-reload && systemctl enable --now gev-warm-view.timer'
ssh box 'systemctl start gev-warm-view.service'    # warm it now, do not wait
ssh box 'journalctl -u gev-warm-view -n 20'        # what it asked for, and how long it took
```

A run that reports `cache=HIT` on its own first request is not a failure —
somebody warmed the cell before it. A run that reports **0 elements** is: a
cell that answers fast and draws nothing is worse than a cold one, and the
script exits non-zero for it.

### When Overpass stops answering the box altogether

**It is almost never a ban. It is an escalating per-IP throttle, and it
decays.** That distinction cost an afternoon on 2026-09-16, so it is the first
thing written here.

At 17:20 UTC, from inside the `gev` container, both FOSSGIS facades refused the
TCP connection in under 200 ms on every address, v4 and v6, five tries out of
five, while the same query answered 200 in 0.20 s from another network. That
reads exactly like a permanent IP ban, and it was diagnosed as one. It was not:
by 19:57 the same host was answering again from the same container, with nothing
done to it.

What it actually is, measured at 20:05 UTC — 8 back-to-back requests from the
container, same Marseille box, nothing else changed:

```
504/9458ms  504/7985ms  200/263ms  200/346ms  429/10947ms  429/10205ms  ERR/64ms  ERR/62ms
```

Slow, then fine, then rate-limited, then **connection refused** — in forty
seconds. The refusal is the TOP of a ladder you climb by pushing, not a door
that was locked. Which means:

- **Do not diagnose this by hammering it.** Three separate egress addresses
  were pushed into refusal in one afternoon, by the probes that were measuring
  the problem. A probe is load.
- **A control from another machine is what tells you the difference.** Ours ran
  `curl` from a laptop, interleaved, at the same second. When the laptop is
  *also* at 429, the host is not singling you out.
- Sample sizes of one or two say nothing here — the verdict changes between
  consecutive requests.

Why Paris keeps working while Marseille does not: Paris is the default view and
is in the disk cache; anywhere else has no graph, and the TomTom ribbon carries
its own geometry, so the roads still color in with nobody driving on them. A
colored road with no cars is an Overpass symptom, not a TomTom one.

Three levers, in the order they were used that day:

1. **Stop earning it.** `main@dcb881bb` took the client from ~4 300 POST/hour to
   26 — a loop where the browser and the proxy re-triggered each other. This is
   the one that matters, and it is what makes the rest optional.
2. **Leave by another address.** `deploy/cloudflare/overpass-relay/` forwards to
   FOSSGIS from Cloudflare's network; set `GEV_OVERPASS_RELAY_URL` and
   `GEV_OVERPASS_RELAY_TOKEN` in `/opt/gev/.env` and restart the container. Both
   are **runtime** variables, so no rebuild — unlike `GOOGLE_MAPS_API_KEY` and
   `CESIUM_ION_TOKEN`. It works: measured 20:23 UTC, the Marseille box came back
   200 in 3.8 s and `X-Overpass-Upstream` named the relay.
3. **Widen the rotation.** `maps.mail.ru` served the Biarritz box the same
   minute — 200, 1 406 ways, 20 s — after the relay and FOSSGIS had both failed.

There is a **fourth lever that was written and then dropped: asking FOSSGIS to
unblock us.** Do not send that mail without re-measuring first. There was no
standing block to lift, and asking for one would have described a problem that
had already decayed on its own.

**Reading the relay's failures.** A Worker that cannot reach its upstream does
not throw — Cloudflare hands it a synthetic **521** response, which this proxy
passes through and scores as `server-error`, parking the relay for 20 s. So a
521 from the relay means "FOSSGIS refused Cloudflare", not "the relay is
broken". Cloudflare's egress addresses are shared and get throttled like any
other; a 521 costs 0.2 s, which is why the relay is cheap to leave in front.

**The VK cost is real, not theoretical.** `maps.mail.ru` is last in the rotation
and is only reached when everything above it has failed — and on 2026-09-16 that
happened, so a genuine visitor viewport went to VK. Removing it is one line in
`OVERPASS_UPSTREAMS`; leaving it is a choice to re-make, not a default.

**Never add a regional instance**, however fast it probes. `overpass.osm.ch`
answered 200 in 0.1 s with `ways=0` at the exact moment every honest host was
failing, and the proxy cannot tell that from "there is genuinely nothing here" —
it would cache the void for the 7-to-30-day disk TTL.

One probe, from the right place, with the right agent string:

```bash
ssh box 'docker exec gev node -e "fetch(\"https://overpass-api.de/api/interpreter\",{method:\"POST\",headers:{\"User-Agent\":\"surplomb/1.0\"},body:\"data=[out:json];out count;\"}).then(r=>console.log(r.status)).catch(e=>console.log(\"REFUSED\",e.message))"'
```

A `curl` **from the host** answers 200 and lies — the host has its own route and
its own reputation. Test from inside the container, or not at all.

## Why not GitHub Actions / Vercel / Render

- **GitHub Actions cannot host this.** A runner is an ephemeral VM that dies
  with the job (6 h ceiling), so it can *build and ship* the app but never
  *serve* it. It is a fine trigger — the pull-based timer here simply avoids
  handing GitHub an SSH key and opening a path into the box.
- **Vercel / Netlify** are static + serverless. The proxies keep in-process
  caches, a disk cache and a long-lived websocket; none of that survives a
  function boundary.
- **Render** hosts the Node process happily on its free tier, but per-PR
  preview environments there are a paid feature, and the free instance cold
  starts for ~a minute after 15 idle minutes.

## Privacy

`GEV_ACCESS_PASSWORD` fronts the whole origin with HTTP Basic, including
`/api/*`, so a stray fetch cannot spend your quota. `/healthz` stays open for
health checks and reports whether the gate is armed.

The compose file wires two access paths:

- **Private network** — the port is bound on loopback and on
  `GEV_TAILSCALE_IP` (a Tailscale address, for instance). Nothing public.
- **Tunnel or reverse proxy** — the public origin, reaching the container on
  loopback (a Cloudflare tunnel, on staging). Add a Cloudflare Access policy on
  a hostname if you want SSO in front of it.

The site answers on two addresses of that one origin: `/` is the showcase and
`/globe` is the globe (`src/vitrine/gate.js`). **Neither needs any edge, tunnel
or reverse-proxy rule** — both are `index.html`, served by the SPA fallback
`vite preview` already has, with the same headers and the same pre-compressed
body. A deployment that fronts this container with a proxy of its own only has
to keep passing unknown paths through, as it already does for
`/mentions-legales`. Adding a *hostname* for the globe instead would break the
hand-off (an origin change forces a real navigation and a second boot) and pull
in DNS, tunnel ingress, `GEV_PUBLIC_HOST` and the browser Google key's referrer
list; the path split needs none of it.

### Retiring a hostname

A hostname appears in six places. Deleting its DNS record is what makes it
unreachable. The other five steps stop the configuration from naming a host
that no longer resolves:

1. **DNS** — delete the record in its Cloudflare zone. The name stops resolving
   at once.
2. **Tunnel ingress** — remove its `hostname:`/`service:` pair from
   `/etc/cloudflared/config.yml`, validate with
   `cloudflared tunnel --config <file> ingress validate`, then
   `systemctl restart cloudflared`. **If the tunnel also carries other
   hostnames**, the restart cuts them for a few seconds, and deleting the
   tunnel would take them down. An SSH session over the private network, not
   the tunnel, survives the restart.
3. **`GEV_PUBLIC_HOST`** and **`OPENROUTER_SITE_URL`** in `/opt/gev/.env`, then
   `rm -f /opt/gev/state/deployed && systemctl start gev-deploy.service`. Check
   it with `curl -H 'Host: <old-name>' http://127.0.0.1:4173/`, which must now
   answer `403`.
4. **Key restrictions** — the browser Google key's HTTP referrers and the
   Cesium ion token's allowed URLs.
5. **Script defaults** — `grep -rn '<old-name>' deploy scripts docs`.
6. **Edge rules** — read the expression before deleting one. A rule with no
   host filter covers every hostname of its zone, including other
   applications, and then it stays after this one is gone.

### Where a visitor's bounding boxes go

Every Overpass-backed layer sends the box the camera is looking at to whichever
mirror answers first. Three of the four are run by OSM community
infrastructure; the fourth, `maps.mail.ru`, is operated by VK and is in the
rotation as a **last resort** — reached only after FOSSGIS and private.coffee
have both failed, which in normal operation is never. It is listed last in
`OVERPASS_UPSTREAMS` and removing it is one line. This is written down rather
than assumed because the queries that rotation carries include "where are the
military installations near here".

The Cloudflare relay (above) changes the source address those queries appear to
come from, and nothing else: it forwards our real `User-Agent` and contact URL,
adds no identity, and caches nothing.

### Provider Settings is not on the deployment

The in-app POWER UP panel writes API keys to disk. Its endpoints install
through `configureServer` only and are deliberately left out of the
preview-parity map that mirrors every other proxy onto `vite preview` — so on
a deployment, which runs `vite preview`, they do not exist. `POST
/api/setup/keys` returns 404 there, and the client removes the chip and the
dialog from the DOM rather than showing a surface that cannot work.

Two more layers hold even if that ever changed. The admission gate refuses any
request carrying a proxy header, which is every request that arrives through
a Cloudflare tunnel (`cf-connecting-ip`) or an nginx front — the very header
`GEV_TRUSTED_CLIENT_IP_HEADER` exists to read. And it refuses a `Host` that is
not a local name, which a public hostname is not.

Prove it after a deploy, from the box:

```bash
npm run qa:provider-settings -- --url http://localhost:4173 --expect-absent
```

## Rate limits: the app's, and anything in front of it

The app throttles its **key-spending** routes, opt-in, on two axes that answer
different questions (`.env.example` documents all six variables):

| | Variable | What it is for |
| --- | --- | --- |
| per address | `GEV_RATELIMIT_{OPENAI,GOOGLE,VOICE_BRAIN}_PER_MIN` | fairness — one visitor, or one runaway harness, cannot spend the account |
| all callers | `GEV_RATELIMIT_{OPENAI,GOOGLE,VOICE_BRAIN}_GLOBAL_PER_MIN` | **the bill** |

Everything else under `/api/*` is keyless open data with its own upstream
courtesy limits handled in-process.

**The per-address cap is not a spend limit, and reads like one.** A caller
with a hundred addresses has a hundred buckets, and until the global variable
existed the only ceiling was an implied backstop of 20× the per-IP cap — so
the `GEV_RATELIMIT_OPENAI_PER_MIN=20` on staging silently authorized
400 billable calls a minute. Behind a password that is theoretical. It stops
being theoretical the moment the password comes off, which is why the opening
checklist below sets the global one first. When the global cap trips everybody
gets a 429 and the page degrades — no HUD summary, no nearby places — instead
of the account draining. That is the intended failure.

Two more things follow for a hosted deployment.

**Behind a proxy, tell the app which header carries the real address.**
Through a Cloudflare tunnel (or any reverse proxy) every request reaches the
container from the proxy, so the socket peer is the same for all visitors and
"per IP" quietly becomes "one bucket for everyone". Set
`GEV_TRUSTED_CLIENT_IP_HEADER=cf-connecting-ip` (Cloudflare; `x-real-ip` for
nginx/Caddy) and the throttles key on that header instead. It is opt-in
because a caller who reaches the origin directly can forge it — set it only
when nothing but the proxy can reach the port. Verify with the open health
route, which echoes the address the throttles will use for *you*:

```sh
curl -s https://gev.example.com/healthz   # → {"ok":true,"gated":true,"client":"<your public IP>"}
```

If `client` is a Docker or loopback address, the header is not being trusted.

**Do not put a rate-limiting rule on all of `/api/*` at the edge.** Measured
on staging on 2026-09-09: a Cloudflare rule of 30 requests per 10 s per
address on `/api`, blocking for 10 s. A Surplomb page makes about six `/api`
requests to boot and a handful a minute afterwards, so the page itself never
trips it — but a script, a test harness or a couple of tabs reloading from the
same address does, and for those ten seconds *every* `/api` call answers 429:
the mic reads "Could not reach voice configuration (HTTP 429)", live layers
stall, tiles proxied through `/api` go gray. The app obeys the `Retry-After` it
is sent (the mic waits it out and retries, twice, before showing the
diagnosis), but the rule is still the wrong shape. If you want an edge rule at
all, scope it to the routes that spend a key:

```
(http.request.uri.path in {"/api/voice/brain" "/api/realtime/token" "/api/openai/hud-summary" "/api/google/nearby-places" "/api/google/text-search"})
```

A human cannot produce 30 spoken commands in ten seconds, so the same
threshold is harmless there. With `GEV_ACCESS_PASSWORD` set and the trusted
header above, the in-app throttles already do this job per real address, and
the edge rule can simply be deleted.

`deploy/vps/edge-ratelimit-probe.sh` tells you which shape is live without
guessing. It bursts a **keyless** `/api` route no correct rule would ever
throttle, plus `/` as a control; it spends no key and reads no secret, since a
401 from the Basic gate proves the origin answered just as well as a 200 does.

```
$ ssh box /opt/gev/edge-ratelimit-probe.sh --host <your-host>   # staging, 2026-09-09
  GET /                    40 requests, no 429
  GET /api/voice/config    FIRST 429 at request 31 (~2s)  retry-after=10  error code: 1015
VERDICT: the edge rule still covers ALL of /api — a keyless route was
         throttled at request 31.
```

Run it from the box, never from a laptop: the limit is per source address, and
the laptop shares its address with the owner's browser.

**And "per address" is not one number on a phone.** Two things change when the
reader is on a mobile network, and they pull in opposite directions:

- **IPv4 / CGNAT.** A mobile subscriber does not have their own public IPv4
  address; the carrier shares one among thousands. A per-address rule on
  `/api/*` therefore throttles a whole city block of subscribers because of one
  of them — and no single reader can tell that from the app being broken.
- **IPv6.** Cloudflare keys its per-address rules on the `/64` prefix, which on
  a mobile network is one device. There the rule behaves as written.

Neither is a reason to raise the threshold; both are reasons to keep the rule
off `/api/*` as a whole and on the five routes that spend a key, where no human
can reach it. Measured after the phone work of 2026-09-16: a phone boot that
touches nothing makes **two** same-origin `/api` calls, both `/api/geoid`
(`npm run qa:phone-boot` prints the list). The "about six" figure above is a
desktop boot and predates the traffic layer being on by default.

## The hosted trial and the waitlist

Off unless `GEV_TRIAL_LIMIT` is set; all four `GEV_TRIAL_*` /
`GEV_WAITLIST_*` variables are documented in
`.env.example` and read at startup (`docker compose up -d`, no rebuild).

- **What is counted.** One HUD summary (`/api/openai/hud-summary`) is one try.
  `/api/google/nearby-places` and `/api/google/text-search` are refused once
  the trial is spent but do not count themselves — except while a voice trial
  has opened, because the voice asks them too. The globe and every keyless
  layer are never gated.
- **The HUD cannot take the voice's try.** It summarizes on its own, about
  once per 15 s of exploring, which emptied all five tries before a visitor
  ever touched the mic. Until the voice trial has opened, a summary may not
  take the last try: it is refused with `quota: "reserved"`, the HUD goes back
  to its local line, and no card opens.
- **Voice is one of the tries, and happens once.** Opening the voice trial
  costs one try and gives `GEV_TRIAL_VOICE` spoken requests (default 3), kept
  in a second count of the same cookie so they never come back. A realtime
  session (`/api/realtime/token`) spends all of them when it is minted — the
  browser talks to OpenAI directly after that — and answers with
  `X-GEV-Trial-Voice-Turns`; the page mutes the mic after that many answers,
  lets the last one play, closes the session and opens the premium card. The
  text brain (`/api/voice/brain`) counts them one spoken request at a time.
  The page asks for the microphone BEFORE minting, so a refused permission
  spends nothing. The session limit is enforced by the page: an edited client
  can keep talking, like a cleared cookie can start over — the bill is still
  bounded by the caps below and the OpenAI account.
- **The crown.** Where the trial is on, the mic wears a gold crown and its
  help tray says what the trial holds (`/api/trial`, read once after boot).
- **Where the count lives.** A signed cookie, `gev_trial`, HttpOnly, 400 days.
  Not the IP: an office or a mobile carrier puts hundreds of visitors behind
  one. A cleared cookie starts over, which is accepted — the bill is bounded by
  the `*_GLOBAL_PER_MIN` caps and the provider limits, not by this.
- **The owner's browser.** With `GEV_OWNER_PASS_SECRET` set (32 characters
  or more), one browser can step out of the trial for good:

  ```sh
  ssh box 'docker exec gev node scripts/owner-pass.mjs https://<your-host>'   # else GEV_PUBLIC_ORIGIN, else https://surplomb.app
  ```

  prints a link that works once and for ten minutes. Opening it shows one
  button (a chat preview that fetches the link spends nothing); the button
  writes `gev_owner`, signed, HttpOnly, 400 days, for the site and its `www.`
  name, and goes to the globe. That browser is never counted or refused, gets
  no crown, and its realtime sessions have no turn limit; the
  `*_GLOBAL_PER_MIN` and per-IP caps still apply. **Not the address:** a
  private-network path and a tunnel both reach the container from the Docker
  bridge gateway (`172.22.0.1` on staging — Tailscale masquerades forwarded
  traffic), so an address rule would exempt every visitor. The secret stays on
  the box; SSH is the only way to a link. **Revoke** every pass by replacing
  the secret and redeploying. The cookie's `Domain` is the site without its
  `www.`, so it also reaches any future subdomain: do not point one at a third
  party without narrowing it. The privacy page does not list the cookie: no
  visitor ever receives it. The redemption is logged as
  `[trial] owner pass issued`.
- **What the page sees.** A 429 whose body carries `quota: "exhausted"`,
  `quota: "reserved"` or `quota: "voice"`, without `Retry-After`. The HUD stops
  asking; on `exhausted` the waitlist card opens in place (once per tab, and
  not at all once a mic click has shown it), on every mic click for `voice`.
  `?waitlist=1` opens the card directly — that is the link to post.
- **Checking it** (from the box, so an edge `/api` rule stays out of it):

  ```sh
  curl -s localhost:4173/api/trial                    # enabled, limit, waitlist target
  curl -s localhost:4173/api/voice/config | grep -o '"waitlist":[^,}]*'
  ```

  In a browser: switch to a NVG/FLIR/CRT style (the HUD only shows there),
  then move the view five times, 15 s apart; the fifth summary is refused
  silently and `/api/trial` still says `remaining: 1` — the mic can open its
  trial. `node scripts/qa-waitlist-card.mjs` checks both sides. A private
  window starts at zero.
- **Buttondown side.** A newsletter named by `GEV_WAITLIST_BUTTONDOWN`, with
  double opt-in on (the free plan's default), the welcome email off (the form
  promises one message at opening and nothing else), and "After confirming"
  redirecting to your origin. The subscriber record carries `usage` and
  `declencheur` as metadata, and the form sets the `liste-attente` tag
  (Buttondown's new-subscriber notification lists it; only creating tags from
  the dashboard is a paid feature). Check it end to end with a `+test`
  address — created, confirmed, redirected — then delete that subscriber so
  the count starts at zero.

### The welcome-card A/B test

Off unless `GEV_FIRST_RUN_AB` names at least two of the first-run variants
(`.env.example` documents it and `GEV_FIRST_RUN_AB_DIR`). The variable is read
per request and is the only switch: it turns on the draw in the browser, the
`experiments` field of `/api/trial`, the report route, `"abtest": true` on
`/healthz`, and the paragraphs of `/confidentialite` that describe the test and
its « Ne pas être mesuré » button. What a report may carry, and what it never
carries, is in `docs/CURRENT-STATE.md` (2026-09-17 — first-run A/B test).

- **At most two report requests per visit.** They are `/api` calls, and an edge
  rule of 30 requests per 10 s per address on `/api` (measured on staging,
  [above](#rate-limits-the-apps-and-anything-in-front-of-it)) blocks
  every `/api` call for ten seconds once tripped. So nothing is sent per event:
  one beacon at the first gesture or close, one cumulative beacon when the page
  is hidden or left. The card reads the same `/api/trial` response as the mic
  crown, so the test adds no other request. The origin also caps the route at
  12 reports a minute per address (1 200 overall), 16 KiB a body, and 5 MiB of
  file a day.
- **Edge limit.** The edge probe bursts `/api/voice/config`, not the report
  route: on staging it answered 40 of 40 without a 429 on 2026-09-17, and
  nothing has been measured against `POST /api/first-run/events` itself.
  Re-check from the box, never from a laptop:
  `ssh box /opt/gev/edge-ratelimit-probe.sh --host <your-host>`.
- **Switching it on** (no rebuild; effective with the first deploy that
  carries `src/firstRunAb.js`):

  ```sh
  ssh -t box 'cd /opt/gev && cp .env .env.bak-$(date +%F)-abtest && $EDITOR .env && docker compose up -d'
  # in .env: GEV_FIRST_RUN_AB=A,B,C
  ```

- **Checking it:**

  ```sh
  curl -s https://<your-host>/api/trial | jq .experiments      # {"firstRun":{"variants":["A","B","C"]}}
  curl -s https://<your-host>/healthz | jq .abtest             # true
  curl -s https://<your-host>/confidentialite | grep -c 'test A/B'                   # ≥ 1
  curl -s https://<your-host>/confidentialite | grep -c 'pas de mesure d’audience'   # 0
  ```

  Then one report, marked `forced` so the analysis leaves it out, and the line
  it wrote (the file is named after the UTC day):

  ```sh
  curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' \
    --data '{"v":1,"exp":"first-run","variant":"A","forced":true,"visitorId":"deploycheck00000","sessionId":"deploycheck00001","seq":1,"newVisitor":false,"returnVisit":false,"shell":"desktop","input":"fine","viewport":"l","reducedMotion":false,"bootMs":0,"dwellMs":null,"events":[{"t":0,"type":"impression"}]}' \
    https://<your-host>/api/first-run/events                  # 204
  ssh box 'docker exec gev tail -n 1 /app/.gev-cache/first-run-ab/events-$(date -u +%F).jsonl'
  ```

  `404` means the variable did not reach the container (or the live deploy
  predates the route); `400` means the body did not validate (the answer never
  says which field, on purpose).
- **Where the data lives.** `/app/.gev-cache/first-run-ab/events-YYYY-MM-DD.jsonl`,
  on the `gev-cache` volume a redeploy keeps: one line per report,
  `{receivedAt, ...record}`, no address, no header. Files older than 90 days
  are deleted by the server itself, when it starts and every hour after,
  whether or not the test is on.
- **Reading it:**

  ```sh
  ssh box 'docker exec gev node scripts/first-run-ab-report.mjs /app/.gev-cache/first-run-ab'
  ```

  Totals per variant, Wilson intervals, a z-test of B and of C against A
  (Bonferroni, α/2), and the sample still missing (356 impressions per variant
  to see 10 points from a 30% baseline at α 0.05, 432 at α 0.025).
  `--include-forced`, `--since`/`--until YYYY-MM-DD`, `--alpha`, `--delta` and
  `--json` change the reading. **Read it once**, when every variant has
  200 unforced impressions or 21 days after the first one, whichever comes
  first. Adopt B or C only if it beats A on activation with p < 0.025 and is not
  worse on the closures the visitor did not choose; otherwise A stays. One
  extension of three weeks at most, then decide.
- **Rolling back:** remove `GEV_FIRST_RUN_AB` from `/opt/gev/.env`, then
  `docker compose up -d`. Every browser shows A on its next visit, sends
  nothing, and deletes its draw; the route answers 404 and the privacy page
  goes back to « pas de mesure d’audience ». The server keeps sweeping files
  older than 90 days (at start and hourly, switch or not), so the privacy
  page's promise holds on its own; once the analysis is written up, delete the
  rest without waiting:
  `ssh box 'docker exec gev rm -rf /app/.gev-cache/first-run-ab'`.

## Sources a commercial deployment may not use

Some free sources are free for non-commercial use only, and one — Street
View — may not be shown beside a non-Google map in the EEA. A clone run for
yourself keeps them; a hosted site run by a company may not use them. One
variable turns all of them off at once:

```sh
# in /opt/gev/.env
GEV_NONCOMMERCIAL_SOURCES=off
```

Unset (or `on`) keeps them, which is the open-source default; any other value
turns them off, so a typo errs on the licence's side. The list lives in
`src/nonCommercialSources.js`, one line per source, each with the clause that
keeps it off (`reason`: `non-commercial`, or `display-terms` for Street View):

| Source | Why | What the switch removes |
| --- | --- | --- |
| Open-Meteo (free API) | [Terms](https://open-meteo.com/en/terms): “You may only use the free API services for non-commercial purposes.” | The weather of the cockpit's Local Info page, the `WX` toggle and its cloud pass, and the Open-Meteo line of the Data attribution popover. `/api/regional-brief` answers `weatherStatus: "off"` and never calls Open-Meteo; `/api/weather-effects` answers `{"status":"off"}` without a fetch. |
| Esri World Imagery, anonymous endpoint (`services.arcgisonline.com`) | Esri staff, for this URL: “as is stated in the terms of use, this service is not available for commercial use” ([Esri Community](https://community.esri.com/t5/arcgis-location-platform-developers-ques/inquiry-about-world-imagery/td-p/1569266)). | The satellite beyond France under the Satellite stack becomes Sentinel-2 cloudless 2016 (10 m), unless the build has an ArcGIS key — [below](#the-satellite-beyond-france-an-arcgis-location-platform-key). The browser fetches these tiles itself, so the page is the check: it never asks the endpoint unless `/api/trial` positively allows it, even before that answer has arrived. |
| OpenSky Network (REST API) | [Terms](https://opensky-network.org/about/terms-of-use): “Any use by a for-profit or commercial entity … requires a written license from OpenSky Network, regardless of purpose.” | OpenSky itself: `/api/opensky` never calls it, not even for an OAuth token, and serves adsb.lol instead — the four 250 NM circles over metropolitan France merged when the view is over France, one circle around the view elsewhere; `/api/opensky-track` answers 404 `{"status":"off"}` (the followed aircraft's trail starts from what the tab has seen); `/api/pulse` counts « avions » from the four French circles. The OpenSky line leaves the Data attribution popover, and the Flights row names adsb.lol. `OPENSKY_*` credentials can stay in `.env`; nothing reads them. |
| Google News RSS | [Terms](https://www.google.com/intl/en_us/terms_google_news.html): “You may only display the content of the Service for your own personal use (i.e., non-commercial use).” | The RSS request itself: `/api/regional-brief` asks GDELT alone (paced at one request every 6.25 s), names it `GDELT` and adds `googleNewsStatus: "off"`. The Regional News source line reads « GDELT · REQUÊTE PAR LIEU · RÉCENT »; the Google News line leaves the popover. |
| Google Street View Static (CCTV fallback) | [EEA terms](https://developers.google.com/maps/comms/eea/street-view-static): “Customer may not use any Google Maps Content from the Street View Static API With any Map.” | Every Street View call. A camera whose frame fails answers `404` with `X-CCTV-Source: unavailable`; the CCTV panel reads « IMAGE · INDISPONIBLE ». The Street View credit leaves the popover. |
| TeleGeography cable map (bundled) | CC BY-NC-SA 3.0 | The files: `/api/submarine-cables/*.json` answers `404` with `X-Source-Off: telegeography` without reading them. The page withholds the layer (no chip, voice and share links refused with a one-line reason) and drops its credit. |

Every request to api.adsb.lol — the French circles, a regional circle, the
military list — leaves through one paced queue, at least 20 s apart
(`src/adsbLolFeed.js`): adsb.lol refused the fourth request of a burst from one
address on 2026-09-22 and passed every request spaced 20 s apart. The queue
only runs while somebody wants an answer. Its answers are shared by every
visitor, so the cost is set by how many different circles are watched, not by
how many people watch: France alone is four circles, each refreshed every 80 s
(100 s while the military list is wanted too).

The cable files are not in the build output at all — since 2026-09-22 the
server serves them from the checkout — so on a deployment that predates that,
`/assets/cable-geo-*.json` still answers 200 whatever the variable says. After
the deploy the old hashed name falls through to the SPA's `index.html`.

- **Switching it on** (no rebuild — the variable is read per request; `up -d`
  recreates the container so it reads the edited `.env`):

  ```sh
  ssh -t box 'cd /opt/gev && cp .env .env.bak-$(date +%F)-noncommercial && $EDITOR .env && docker compose up -d'
  ```

- **Checking it:**

  ```sh
  curl -s https://<your-host>/healthz | jq -c .sourcesOff     # ["open-meteo","esri-world-imagery","opensky","google-news","google-street-view","telegeography"]
  curl -s https://<your-host>/api/trial | jq -c .sourcesOff   # the same list
  curl -s 'https://<your-host>/api/weather-effects?latitude=48.86&longitude=2.35' | jq .status   # "off"
  curl -s 'https://<your-host>/api/regional-brief?latitude=44.84&longitude=-0.58' | jq -c '[.newsSource, .googleNewsStatus]'   # ["GDELT","off"] (null source if GDELT had nothing)
  curl -s -o /dev/null -w '%{http_code}\n' https://<your-host>/api/submarine-cables/cable-geo.json   # 404
  curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://<your-host>/assets/cable-geo-i2PzBJi6.json   # 200 text/html (the SPA page, not the data)
  curl -sD- -o /dev/null 'https://<your-host>/api/opensky?lat=48.86&lon=2.35' | grep -i x-flight   # source adsb.lol, area fr-metro
  ```

  The first flights request after a restart waits for one adsb.lol answer
  (the circle nearest the view) and serves one quarter of France; the other
  three circles follow one per 20 s, so a full France is on screen within a
  minute of the first visitor switching flights on.

  `[]` means the variable did not reach the container, or the live deploy
  predates the switch; `null` means the deploy predates it.
- **Rolling back:** remove the line and `docker compose up -d`.

### The satellite beyond France: an ArcGIS Location Platform key

Without a key, a deployment with `GEV_NONCOMMERCIAL_SOURCES=off` draws
Sentinel-2 cloudless beyond France: 10 m, cities and coastlines but no
buildings. `ARCGIS_API_KEY` puts back the same Esri World Imagery a clone
shows, through ArcGIS Location Platform, which licenses it for commercial use
and bills it per tile: **2 million basemap tiles free a month, then $0.15 per
1,000, no subscription** ([pricing](https://location.arcgis.com/pricing/)).
The page sends the key with each tile, from the visitor's browser, so it is
public like the Google browser key: what protects it is the referrer list and
the one privilege it carries. A visit costs roughly 100-800 tiles (measured
2026-09-22; the base sleeps wherever IGN covers the view), so 1,000 visits a
month stay inside the free tier.

1. **Account.** Sign up at <https://location.arcgis.com> (free). Leave
   **pay-as-you-go off**, which is the default: “when you disable
   pay-as-you-go, your account will no longer have privileges to […] services
   in which you have exceeded the free tier” ([billing
   help](https://location.arcgis.com/help/billing/)). That makes the free tier
   a hard ceiling: past it Esri stops the service instead of billing it, and
   the globe treats refused tiles like an Esri outage and swaps in Sentinel-2
   (not yet observed — no account has reached the ceiling). Esri documents no
   budget alert, so this switch is the spending limit.
2. **New key.** Dashboard → **My portal** → **Content** → **My content** →
   **New item** → **Developer credentials** → **API key credentials** →
   **Next**.
3. **Public application**, then **No item access**.
4. **Privileges: Location services → Basemaps** (`premium:user:basemaps`)
   and nothing else.
5. **Expiration** up to one year from today — write the date down, the globe
   loses the layer the day it passes. **Referrers:** one line per public
   hostname, each with its scheme — `https://surplomb.app` and every other
   name in `GEV_PUBLIC_HOST`. Esri: “The expiration date and referrers of an
   access token cannot be changed without invalidating the token.”
6. **Save**, choose **Generate the API key**, and copy it: Esri shows it once.
7. **Build it in.** It is a build argument, and the box's compose file does
   not update itself ([above](#the-compose-file-does-not-update-itself)):

   ```sh
   scp deploy/vps/docker-compose.yml box:/opt/gev/
   ssh -t box 'cd /opt/gev && cp .env .env.bak-$(date +%F)-arcgis && $EDITOR .env'   # add ARCGIS_API_KEY=<key>
   ssh box 'cd /opt/gev && docker compose up -d --build --force-recreate'
   ```

8. **Check.** The bundle carries the key (one file name back; nothing means
   the build did not see it), and the globe says so:

   ```sh
   ssh box 'docker exec gev sh -c "grep -rl \"\$ARCGIS_API_KEY\" /app/dist/assets | head -1"'
   ```

   Open the globe on the Satellite map over the Atlantic: the bottom-left
   credit reads “Powered by Esri · Source: Esri, Vantor, Earthstar
   Geographics, and the GIS User Community”, and the Data attribution popover
   names ArcGIS Location Platform. A wrong key does **not** show on the globe
   — on 2026-09-22 Esri's CDN answered tiles to a made-up token — so the proof
   is the Location Platform dashboard, which counts basemap tiles the next day.

Rotating the key is steps 2 to 8 again; removing it is removing the line and
the same rebuild. `npm run qa:world-imagery-licence -- --url <host> --expect
licensed` checks a build in a browser.

## Opening the origin to the public

`GEV_ACCESS_PASSWORD` is the only thing between the open internet and a set of
keys somebody pays for. Removing it is a one-line change with a bill attached,
so it is the LAST step, not the first. In order:

1. **Bound the spend, globally.** Set the three
   `GEV_RATELIMIT_*_GLOBAL_PER_MIN` in `/opt/gev/.env`. Per-address caps alone
   do not bound anything a distributed caller does.
2. **Bound it again at the provider**, because a process-local counter resets
   on restart and knows nothing about a second deployment: OpenAI platform →
   Settings → Limits (usage limits); Google Cloud Console → Billing → Budgets
   & alerts, plus per-API quotas under APIs & Services → Quotas; OpenRouter →
   Keys → edit → credit limit. This is the only hard stop in the list.
3. **Split the Google key in two, because one key cannot be both.** The build
   arg is inlined into a file anyone can read (`Dockerfile:24`, `define` in
   `vite.config.js`); the same variable is also the runtime key the proxies in
   `vite.config.js` spend on Places, Street View and the 2D tile session. An
   HTTP-referrer restriction is the standard guard for the first and is fatal
   to the second — a server sends no `Referer`, so restricting the one shared
   key answers 403 to every `/api/google/*` call. Create a second key,
   referrer-restricted to your hostnames and scoped to **Map Tiles +
   Geocoding**, and pass it as `GOOGLE_MAPS_BROWSER_KEY`; leave
   `GOOGLE_MAPS_API_KEY` as runtime env only and restrict it by **IP** to the
   origin's egress addresses (both v4 and v6 — a box can reach some upstreams
   over v6 only) and to **Places + Street View + Map Tiles**. Verify by reading
   the built bundle, not the console:

   ```sh
   ssh box 'docker exec gev sh -c "grep -rhoE \"AIza[A-Za-z0-9_-]{35}\" /app/dist | sort -u"'
   ```

   Exactly one key must come back, and it must be the browser one. Changing a
   build arg needs `docker compose up -d --build --force-recreate`: a plain
   `up -d` reuses the image and the old key stays in the bundle.
4. **Check "per IP" is per IP.** `curl -s https://<host>/healthz` must report
   `client` as your own public address, not a Docker or loopback one.
5. **Know what a visitor costs.** A cold boot spends **nothing**: since the
   engagement gate in `src/hud.js`, every metered call waits for a real gesture
   — pointer, wheel or key — because the intro fly-to settles on its own and
   used to fire five billable calls at t≈6.3 s before a single click. So the
   unit of cost on a public page is the *engaged* visitor, not the arrival,
   and a page loaded in a loop bills nothing. Size the global caps above
   against engaged visitors per minute, not against traffic.
6. **Fix the edge rule** (above), or the first person who shares the link and
   the second person behind the same NAT will both see 429s.
7. **List every public hostname in `GEV_PUBLIC_HOST` — the password is hiding
   whether they work.** `vite preview` refuses a `Host` it was not told about,
   and the access gate's middleware is installed *first*, so a gated origin
   answers **401 before Vite ever checks the host**. A name missing from
   `GEV_PUBLIC_HOST` is therefore indistinguishable from a name that works,
   right up to the moment you open — and then it answers:

   ```
   HTTP 403  Blocked request. This host ("surplomb.app") is not allowed.
   ```

   Measured on 2026-09-16: `surplomb.app` had been live on the tunnel for a day
   and had never once been served. `/healthz` answered `200` the whole time,
   because it is a middleware and never reaches the host check — so the health
   route **cannot** tell you about this. Check it while still gated, with the
   password, against each name:

   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' -u gev:"$PW" https://<each-host>/
   ```

   `401` is a bad answer here, not a good one — it means the gate replied and
   the host question is still open. Send the credentials and require `200`.
   `GEV_PUBLIC_HOST` is comma-separated, read at startup, and needs only
   `docker compose up -d` — no rebuild.
8. **Then, and only then**, remove `GEV_ACCESS_PASSWORD` from `/opt/gev/.env`
   and `docker compose up -d`. `/healthz` reports `"gated": false`, and the
   server logs `[access-gate] GEV_ACCESS_PASSWORD is unset — this origin is
   OPEN` **on the first request through the gate, not at boot** — the warning
   lives in the middleware behind a once-only flag. An empty log right after a
   restart means nobody has asked yet, not that the gate is still up; trust
   `/healthz` for that.

Reversing it is the same two commands with the variable put back, so the risk
is not the switch — it is how long an unbounded key stays reachable before
anyone notices. Steps 1 to 3 are what make that duration not matter.

### The legal pages

A site published in France must name its publisher, their address and phone
number, the publication director and every provider that hosts or stores what
it processes (LCEN, art. 1-1), and must tell visitors what it does with their
data (GDPR, art. 13). `/mentions-legales` and `/confidentialite` do both. The
text is in the repository; **the identity is not**, because the repository is
public and forkable (`src/legalNotice.js` says why). It comes from `.env`:

```sh
GEV_LEGAL_PUBLISHER=<legal name, form and share capital, or a person's name>
GEV_LEGAL_REGISTRATION=<RCS / SIREN line — optional for an unregistered individual>
GEV_LEGAL_ADDRESS=<registered office, or home address for an individual>
GEV_LEGAL_PHONE=<phone — optional here, required by the law>
GEV_LEGAL_EMAIL=<contact address — also the one for GDPR requests>
GEV_LEGAL_DIRECTOR=<publication director>
GEV_LEGAL_HOSTING=<host, address, phone> | <each other storage provider>
```

`GEV_LEGAL_HOSTING` lists every provider: the company that hosts the box, the
tunnel or edge in front of it, and, once the waitlist is on, Buttondown. A host
that publishes no phone number in its terms still owes you one for this page;
ask its support.

**No ` #` in a value.** Compose reads an unquoted ` #` as the start of a
comment, so « 406 W Franklin St. #201 » reaches the page as « 406 W Franklin
St. » — which is how the first preview of this page looked. Write « Suite
201 », or quote the whole value.

The values are read **per request**, never built into the bundle, so the
maneuver is an edit and a recreate — no rebuild:

```sh
ssh -t box 'cd /opt/gev && cp .env .env.bak-$(date +%F)-legal && $EDITOR .env && docker compose up -d'
curl -s https://<your-host>/healthz          # "legal": true
curl -s https://<your-host>/mentions-legales | grep -c 'class="missing'   # 0
```

`GEV_LEGAL_PHONE` is the one field the page renders without although the
law asks for it (art. 1-1 I): leaving it out is the operator's decision, and
the row simply does not appear.

`"legal": false` means at least one required variable is empty; the page
itself lists which, and a public origin (`GEV_PUBLIC_HOST` set) logs
`[legal-pages] … incomplete` at boot. Unset, the pages still answer — with a
visible « non renseigné » where the publisher goes, never a blank.

`/cgv`, the terms of sale of the paid offer (professionals only), names the
**seller** from the same variables — publisher, registration, address and
email; no phone, no director — so there is nothing more to set. A company's
documents meant for third parties also state its legal form and share capital
(Code de commerce, R123-238): put both in `GEV_LEGAL_PUBLISHER` (« Exemple SAS,
au capital de 1 000 € »), which feeds every legal page. The page carries a notice that the paid offer is not open yet;
the pull request that opens payment removes it. Check it with:

```sh
curl -s https://<your-host>/cgv | grep -c 'class="missing'   # 0
```

The privacy page shows the trial-cookie row only when `GEV_TRIAL_LIMIT` is at
least 1, and the waitlist rows only when `GEV_WAITLIST_BUTTONDOWN` is set: an
instance never lists a processor it does not use. Every other sentence on it is
a statement about the code, so **a PR that adds a cookie, a log, a stored
field or a provider the browser calls changes `confidentialite.html` too**.

Two server behaviors exist so that page can be true, and a hosted server
keeps them on by default:

- **No voice transcript on disk.** `/api/realtime/debug-log` answers 404 under
  `vite preview` unless `GEV_REALTIME_DEBUG_LOG=1`. Set it for a debugging
  session, then remove it; the file is `.gev-logs/realtime-conversations.jsonl`
  inside the container.
- **No search-engine indexing of `/api/*`** (`X-Robots-Tag: noindex`), and
  `fiche.html` keeps its `noindex` for good: DVF sales are published on the
  condition that they are not indexed (Livre des procédures fiscales,
  art. R*112 A-3). The launch-day removal of `noindex` concerns `index.html`
  only.
