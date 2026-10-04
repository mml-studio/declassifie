# Sélestat municipal permits — 4 October 2026

[Sélestat's official permit page](https://www.selestat.fr/mon-quotidien/logement-et-urbanisme/recepisses-et-autorisations)
publishes separate filing and decision registers. The current links point to
two lists dated 22 September 2026: twelve scanned pages of filings and six
of decisions. No account is required, and the page and PDF paths are allowed
by the publisher's robots rules.

## Collection and placement

The source joins the existing `posted-lists` protocol for municipality
`67462`, postcode `67600`. Only the newest edition of each board is read.
Both PDFs are image-only landscape Cart@DS tables; the daily sweep reads them
with positioned French OCR. Tesseract segmentation mode 6 retains more
table words than the default column-detection mode 4 on these scans. The
option is restricted to modes 4 and 6 and changes no other source's default.
Visitors use scrubbed cached rows without downloading scans or running OCR.

| Retained data | Count |
| --- | ---: |
| Filings | 100 |
| Decisions | 21 |
| Distinct dossiers | 121 |
| Extracted project addresses | 121 |
| BAN-geocoded dossiers | 118 |
| Unplaced dossiers | 3 |

The production collector fetched two files with no failed or skipped file
and no pending OCR. This describes collection success, **not complete
extraction**. Some printed dossier numbers and cells remain unreadable.
The reader withholds invalid or foreign identities and detected merged rows,
without repairing missing digits. The OCR can omit words or misread project
addresses and descriptions. BAN's ordinary placement rules still apply;
unplaced dossiers are never assigned to the municipality's center.

The two fixed templates put the applicant's name and residential address
beside the project address. The reader verifies the publisher, page shape
and identifying headers, then reads only the project columns. Applicant
fields remain null; raw PDF and OCR content never enter edition caches or
the daily archive. Continuation pages retain the verified column geometry.
Only PC, DP, PA, PD and CU identities are accepted.

The left cell's first date is the posting start; a second date exactly two
months later is its end. The last column supplies the filing or signing day.
Expiry is never a decision date. Future OCR dates are withheld, and an unread
verdict remains a signed decision. Posting notices alone do not establish
that a filing is still under review, so this source has no `underReview`
assertion.

## Comparable population gain

The baseline is main at `eaf60b5d`, including the earlier municipal integrations.
Both sides use the same official
[Geo API municipality snapshot](https://geo.api.gouv.fr/communes?fields=nom,code,population,codeEpci).
The current-source measure excludes overseas collectivities beginning 975,
977, 978 and 98, annual Montpellier exports and national Sitadel.

| Current municipal-source coverage | Before | After |
| --- | ---: | ---: |
| Municipalities | 4,304 | 4,305 |
| Residents | 22,880,982 | 22,900,571 |
| Share of 68,350,798 residents | 33.4758% | 33.5045% |

The gain is **19,589 residents, 0.0287 percentage points**. It measures source
availability, not exhaustive permit publication or extraction.

Twelve additional population-priority municipalities were screened on their
official sites: Metz, Boulogne-Billancourt, Caen, Colombes,
Saint-Maur-des-Fossés, Cannes, Drancy, Quimper, Montauban, Niort, Clamart and
Villeneuve-d'Ascq. The bounded screening checked at most five pages per site
and respected robots rules. It found no additional verified current permit
register; filing portals and general acts pages remain unconfirmed leads.
Colombes, Drancy, Montauban and Clamart failed HTTP fetching. These results
do not establish absence of publication. The persistent research history
records them for a later revisit. Existing exclusions were preserved.

## Validation

- `npm test` and `TZ=UTC npm test`: 10,876 passed, zero failures and one
  existing skip in each run. The runner separately skips two allocation
  probes calibrated for Node 24 under the local Node 26.
- Forty-five focused reader, OCR and collector checks passed, including
  project/applicant separation, continuation pages, invalid identities,
  merged rows, date separation and visitor cache reuse without OCR.
- Production build and 60-layer manifest check passed.
- Live `/api/ads-fr` geocoded 118 dossiers. A 400 m central scan over
  48.2577, 7.4534 returned 45 municipal/Sitadel dossiers, including 20 from
  the municipal lists, with no assertion of current-under-review status.
  Scan totals depend on framing and differ from citywide extraction.
- Isolated Playwright inspected desktop 1440 × 900, tablet 834 × 1112
  and mobile 390 × 844 viewports. The municipal decision's selected card
  cites Sélestat and its signing day; no page error, layer error or horizontal
  document overflow occurred. The shared MCP browser was occupied, so the
  run used a separate browser with `newQaPage` first-run and photoreal
  suppression. Three screenshots are saved under `.context/`.
