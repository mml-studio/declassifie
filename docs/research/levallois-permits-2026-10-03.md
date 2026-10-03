# Levallois permits and research history — 2026-10-03

Levallois-Perret (`92044`) adds a verified current municipal permit source
for 68,092 residents. Previously checked towns now leave the active research
queue until their revisit date or an explicit override.

## Verified public source

The city's [public Webdelib urbanism tab](https://www.ville-levallois.fr/webdelibplus/jsp/legal.jsp?role=usager)
publishes three rolling filing lists, PC, DP and PD, and individual planning
orders. The October lists were published on 2 October 2026. The September and
October monthly indexes were checked anonymously, without a filing account.
The index's public PDF tokens resolve through its `jsp/showFile.jsp` endpoint;
the stored URL omits the document title, which can name an applicant.

| Collection, 2026-09-01 to 2026-10-03 | Retained rows | Project addresses read |
| --- | ---: | ---: |
| Pending PC filings, newest list | 9 | 9 |
| Pending DP filings, newest list | 53 | 53 |
| Pending PD filings, newest list | 0 | 0 |
| Individual PC/DP/PA/PD decisions | 27 | 6 |
| Total | 89 | 68 |

All 30 selected PDFs were downloaded: 21 fetched and nine reused from the
edition cache, zero failed or skipped and no pending OCR. Transport completion
does **not** mean complete extraction: 21 decision scans retain only safely
read index fields (dossier, verdict and publication day) without an extracted
project address. They can be placed only when the ordinary dossier fold finds
a safely known site in a matching filing.
First-page background OCR supplies project addresses where the existing notice
reader can identify them safely. Further scan-template work may improve this
partial coverage. No signing date is inferred from a publication date.

The filing lists are spreadsheet exports with bottom-aligned cells. Their
reader preserves multiline project descriptions while keeping neighboring
rows separate, reads the project's address column rather than the applicant's
residential address, and separates height from created floor area. Private
applicant names and residential addresses never enter retained rows or
fixtures. The latest lists may contain older filings still under review;
publication freshness and the filing date describe different events.

Only the newest list of each filing family is retained across the requested
months. Decisions must carry this municipality's dossier number; certificates,
changes of use, other municipalities and publications outside the window are
excluded. The ordinary daily archive and geocoding rules apply.

The public site starts an anonymous session using a literal same-origin
redirect. A bounded helper follows one such initialization and at most four
HTTP hops per request, without executing JavaScript, processing challenges,
logging in or following another origin. Its cookies live only in the
collection's memory. This exception is enabled only for Levallois. Its
`robots.txt` allowed both index and PDF requests; no robots override was added.

## Population gain

The baseline is `origin/main` at `35e1735a`, including the concurrent WordPress
and town-list integrations. With the same Geo API snapshot:

| Current municipal-source coverage | Main | This change |
| --- | ---: | ---: |
| Municipalities | 4,270 | 4,271 |
| Residents | 22,508,136 | 22,576,228 |
| Share of 68,350,798 residents | 32.9303% | 33.0299% |

The gain is 68,092 residents, **0.0996 percentage points**. It counts only
Levallois, not its intermunicipality, and describes source availability rather
than exhaustive dossier or address extraction. The population source is the
[Geo API municipality register](https://geo.api.gouv.fr/communes?fields=nom,code,population,codeEpci).

## Stop repeating previous research

`permit-research-history.json` records 212 municipality checks, importing the
previous outer-Paris report and preserving this pass's findings. Each entry
has an INSEE code, check day, status, source where known, scope limitation and
revisit day. An initial website screening is unconfirmed, never proof that
no public source exists. Routine unconfirmed checks are deferred for one month;
stale or physical-only boards can wait longer.

The user explicitly confirmed that Saint-Denis (`97411`, La Réunion) and
Vénissieux (`69259`) had already been checked. Their previous finding is
unknown, so the history records that fact without inventing an outcome and
holds them until an explicit revisit. Toulouse retains the previous research
exclusion. Saint-Denis in Seine-Saint-Denis is a separate INSEE code.

`npm run permits:priorities` reads this history automatically. `towns` contains
active priorities and `deferredTowns` contains held ones; deferred population
does not inflate intermunicipal research priorities or become counted as
covered. Current registries still determine coverage. A verified new source
can contribute a gain even when its town was previously deferred.

Use `--revisit <INSEE>` when new evidence justifies another check, or
`--research <JSON-array-file>` to replace the history. `--exclude` still wins.
Against the recorded snapshot, at a 50,000-resident threshold, 27 active town
priorities remain and 39 previously checked towns are deferred. The queue is
a population ranking, not a list of sources already known to publish permits.

## Validation

- Both full unit runs (`npm test`, `TZ=UTC npm test`): 10,849 passed,
  zero failures and one existing skip; the runner separately skipped two
  Node-24-calibrated allocation microbenchmarks under Node 26.
- Production build and the 60-layer manifest check passed.
- Regression tests cover research holds and expiry, explicit revisit/exclude,
  unchanged coverage accounting, anonymous-cookie isolation and redirect
  bounds, large streamed indexes without a clone-cancellation deadlock,
  monthly selection, bottom-aligned rows, applicant-address exclusion
  and height/floor-area separation.
- Live collection: 62 filing rows with addresses, 27 decisions with six
  extracted addresses, all 30 PDFs read successfully.
- Live proxy and browser: the 89 posting rows fold to 88 distinct dossiers;
  68 were geocoded and 20 remain unplaced. A 400 m scan at
  `48.8947, 2.2889` rendered 40 municipal and Sitadel dossiers, including 14
  pending filings, and the selected municipal filing's card cites Levallois.
  Desktop (1440 × 900), tablet (834 × 1112) and phone (390 × 844) screenshots
  are saved locally under `.context/`. The phone uses touch/mobile emulation.
