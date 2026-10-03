# Six additional municipal planning sources, 3 October 2026

Caluire-et-Cuire, Saint-Jean-de-Monts, Vernaison, La Tour-de-Salvagny,
Millery and Châteauneuf-sur-Isère now join the current municipal readers.
They add **70,904 residents**, taking registered source coverage from
21,898,931 to 21,969,835 residents: **32.0390% to 32.1428%, +0.1037
percentage points**. Municipalities rise from 4,173 to 4,179. The top
100/300/1,000 counts become 51/128/329, from 51/127/328.

The delivery baseline includes the [preceding four-register batch](municipal-registers-2026-10-03.md)
and the parallel integrations merged through [PR #411](https://github.com/mml-studio/surplomb/pull/411).
All six municipalities still have no other current source after rebasing.
Population uses the official Geo API snapshot of 2 October 2026, the same
68,350,798-resident denominator and exclusions for codes beginning with
975, 977, 978 and 98. This measures the union of current municipal sources,
excluding the annual Montpellier dataset. It does not establish that every
permit is published or extracted. The broader ten-percentage-point target
remains unfinished.

## Strategy and observed gain

Reuse of a shared reader yields several sources for one parser change.
DematDOC's aggregate lists were previously rejected by its individual-act
reader. The existing Cart@DS report reader can read Châteauneuf-sur-Isère,
La Tour-de-Salvagny and Saint-Jean-de-Monts directly. Millery adds one BIRT
layout; Vernaison adds a narrowly scoped project-address label adaptation.
Caluire is the largest new municipality in this batch and needs cell OCR.

Three other live DematDOC boards were tested and excluded from the new
registry: Moussac (30184) already uses Pays de Sommières' Cart@DS reader,
Chambœuf (42043) Saint-Étienne Métropole's Cart@DS reader, and Crozet (01135)
SIEA's SIRAP reader. Their existing readers remain authoritative, avoiding
duplicate dossiers and overstated population gains. Homonymous communes
were resolved against the official municipality snapshot and PDF codes.

## Live collection

The production `readPermitCity` collector read the September–October window,
with the daily-sweep OCR implementation, one request per second per host,
and an honest Surplomb User-Agent.

| Municipality | INSEE | Population | Documents | Posting rows | Distinct dossiers | Latest date | Source |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Caluire-et-Cuire | 69034 | 43,597 | 10 | 32 | 32 | 2026-09-29 | [Legal display](https://www.ville-caluire.fr/vie-municipale-citoyennete/affichage-legal) |
| Saint-Jean-de-Monts | 85234 | 8,868 | 2 | 129 | 129 | 2026-10-02 | [DematDOC](https://saintjeandemonts.dematdoc.eu/public/14) |
| Vernaison | 69260 | 5,210 | 16 | 12 | 12 | 2026-10-02 | [DematDOC](https://mairie-vernaison.dematdoc.eu/public/14) |
| La Tour-de-Salvagny | 69250 | 4,649 | 2 | 46 | 46 | 2026-09-25 | [DematDOC](https://salvagny.dematdoc.eu/public/14) |
| Millery | 69133 | 4,299 | 5 | 63 | 44 | 2026-09-28 | [DematDOC](https://mairie-millery.dematdoc.eu/public/19) |
| Châteauneuf-sur-Isère | 26084 | 4,281 | 8 | 249 | 75 | 2026-10-02 | [DematDOC](https://chateauneufsurisere.dematdoc.eu/public/14) |
| **Total** | | **70,904** | **43** | **531** | **338** | | |

All 531 posting rows have a project address; 503 also have cadastral
references. Consecutive editions repeat postings, and a filing and decision
can refer to the same dossier. Existing archive folding handles these
repetitions. There are 290 filing rows and 241 decision rows: 150 grants,
43 refusals, 12 cancellations and 36 signed decisions with no verdict.
No download failed, no file was skipped and none remained pending OCR.
Successful collection does not mean complete extraction of each document.
The [machine-readable report](municipal-register-extensions-2026-10-03.json)
retains source URLs and per-source counters, without private fields.

## Reader boundaries

`dematdocRegisterBoards.js` adapts the public shelf requests to the shared
board collector's JSON POST contract and follows the platform's lazy
document IDs within the collection window. Redacted PDFs are preferred.
Only same-origin PDF links and publication dates within the window are
accepted. Raw document titles, which can name applicants, are replaced
with the local dossier identity before being passed to the reader.

Millery's register mixes PC, DP and CU rows. An explicit decision date
classifies a row as a decision; otherwise it is a filing. The report has
no verdict column, so a signature date never implies a grant. Long project
descriptions and continuation pages use the existing top-aligned table
reader. Applicant cells are excluded. Vernaison's exact first-page filing
heading allows its project label `Adresse :` to be read as a terrain
address; other forms and applicant labels are left to the existing reader.

Caluire prints family, year and counter in separate cells. Whole-page
200-dpi OCR often omits the family on its colored background. The background
collector rereads only that cell at 400 dpi alongside the printed year,
at most 100 cells per page. Only an exact PC, DP, PA, PD or CU is accepted;
an unread family or counter is withheld. Whole-page results already carrying
a readable type are retained without a duplicate. Measured columns and
header checks exclude applicants and reject changed exports. The 32 rows
are a partial extraction: several earlier weekly layouts and some tiny
family cells remain unread. Unknown dates stay null and future dates are
withheld. An explicit `Sans suite` retains its cancellation state.

Caluire honours robots.txt. DematDOC uses the existing platform-wide
override for public planning postings, as the repository's other DematDOC
readers do. Visitors never start OCR or download Caluire scans that have
not yet been read by the daily sweep. Edition caches and the daily archive
contain scrubbed project fields, never raw PDFs, OCR text or applicant names.

## Validation

`npm test` and `TZ=UTC npm test` pass: 10,815 passing tests and one existing
skip in each run. The runner also skips its two Node-24-calibrated allocation
microbenchmarks on local Node 26. Focused regressions cover JSON POST and
pagination, date and origin bounds, redacted copies, mixed filing/decision
tables, private-field exclusion, exact OCR identities and background-only
scan downloads. The production build and layer-manifest check pass.

The real Caluire API response places all 32 municipal dossiers, 22 by parcel
and 10 by address. The browser's 400 m viewport merges current municipal
data with Sitadel and shows twelve dossiers, ten with footprints, without
a layer error. Desktop (1440 × 1000), tablet (834 × 1112) and mobile
(390 × 844) screenshots are saved under `.context/high-gain/`. No checked
viewport has horizontal document overflow. The console has no errors;
the existing Apple mobile-web-app metadata deprecation warning remains.
