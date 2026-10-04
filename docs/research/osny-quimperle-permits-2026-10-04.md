# Osny and Quimperlé municipal permits — 4 October 2026

Two additional current municipal registers join the Urbanism layer:
[Osny's official permit page](https://osny.fr/les-services/urbanisme/autorisations-durbanisme)
and [Quimperlé's official planning page](https://www.quimperle.bzh/vivre-a-quimperle/habitat-urbanisme/demarches-durbanisme-rdv/).
Both publish pending filings and dated decisions in public PDF tables.
They require no account and their robots rules allow the page and file paths.

## Collection and placement

The live collector uses `readPermitCity`, the production PDF extractor and
the existing edition cache. The newest whole-register snapshot of each board
is retained. Reading older snapshots on the same sweep would revive pending
filings that have disappeared from the latest list. The daily archive retains
dossiers after they leave a subsequent edition; those filings lose their
current-under-review state.

| Municipality | INSEE | Residents | Latest index edition | Filings | Decisions | Distinct dossiers | Extracted addresses | Geocoded dossiers |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Osny | 95476 | 17,954 | 2026-09-28 | 50 | 51 | 101 | 99 | 95 |
| Quimperlé | 29233 | 12,469 | 2026-09-24 | 54 | 79 | 133 | 132 | 128 |
| Total | | 30,423 | | 104 | 130 | 234 | 231 | 223 |

The four selected PDFs yielded no failed download, skipped file or pending
OCR. An initial September–October backfill read 16 editions and produced 876
posting rows, many repeated; it is not the final dossier count. The final
collection keeps only each board's latest snapshot. Eleven dossiers remain
unplaced after ordinary BAN geocoding, including the three without a safely
extracted project address. They are never put at the municipality's center.
Collection success does not establish exhaustive extraction of every printed
row. Only PC, DP, PA, PD and CU identities are retained; sign and
establishment-work authorizations are outside this reader's scope. Private
applicant names and residential addresses are excluded.

Osny replaces some dated file URLs in place: the decision PDF linked as the
28 September edition currently prints a title ending on 2 October. The reader
retains the index's publication day and the explicit signing days, without
treating that title as proof of a new publication date. `rolling` revalidates
these dated URLs using the existing HTTP validator machinery.

Quimperlé's PDF24 exports are A3 pages with `/Rotate 90`. A narrowly selected
reader checks the printed table headers' orientation, then transforms every
page's text coordinates before the existing table readers. Changed
orientations are withheld. The official INSEE code is 29233, also printed in
the dossier numbers; the postcode is 29300. The filename
`.../2026/09/09-24-Affichage-des-Depots.pdf` must not become 9 September by
combining the upload directory with the first filename number. The link
caption supplies 24 September; an upload month alone stays a monthly fallback.
Applicant columns and multiline continuation rows remain separate.

## Comparable population gain

The baseline is the preceding Levallois integration at `3eea7899`, after
rebasing on main at `22e42803` and preserving its nineteen new towns.
The same official [Geo API municipality snapshot](https://geo.api.gouv.fr/communes?fields=nom,code,population,codeEpci)
is used on both sides. The coverage measure excludes overseas collectivities
beginning 975, 977, 978 and 98, annual Montpellier exports and national Sitadel.

| Current municipal-source coverage | Before | After |
| --- | ---: | ---: |
| Municipalities | 4,290 | 4,292 |
| Residents | 22,714,247 | 22,744,670 |
| Share of 68,350,798 residents | 33.2319% | 33.2764% |

The gain is **30,423 residents, 0.0445 percentage points**. It describes
registered current-source availability, not exhaustive permit publication or
extraction. No intermunicipality is counted from these two municipal pages.
The earlier ten-percentage-point ambition remains unfinished.

[Strasbourg's official open-data board](https://data.strasbourg.eu/explore/dataset/publiactes/)
reserves individual permits to the administrative center's physical kiosks.
The research history records that limit and defers this lead until January
2027. Search-only leads without a checked register are not promoted to
verified sources.

## Validation

- `npm test` and `TZ=UTC npm test` after rebasing: 10,862 passed, zero failures,
  one existing skip in each run. The runner separately skips two Node-24-calibrated
  allocation probes under local Node 26.
- Production build and 60-layer manifest check passed.
- Twenty-six focused table/protocol checks passed, including rotated
  continuation pages, private-field exclusion, refusals, municipal identity,
  edition dates, latest-snapshot selection and under-review lifecycle.
- Live `/api/ads-fr` responses geocoded 128 Quimperlé and 95 Osny dossiers.
  A 400 m central scan displays 49 municipal/Sitadel dossiers at Quimperlé
  (28 municipal, 12 under review) and six at Osny (three municipal, one under
  review). Scan counts depend on framing and differ from citywide extraction.
- Playwright inspected both municipalities at desktop 1440 × 900, tablet
  834 × 1112 and touch/phone 390 × 844. No layer error or horizontal document
  overflow occurred. The clicked Quimperlé decision names the municipal
  source and its signing date. Six screenshots are saved under `.context/`.
