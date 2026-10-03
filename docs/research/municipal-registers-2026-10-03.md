# Four additional municipal planning registers, 3 October 2026

Bry-sur-Marne, Saint-Raphaël, Scionzier and Aiffres are integrated through
their own municipal PDF registers, representing **70,197 additional
residents**. Current municipal-source coverage rises from 20,806,381 to
20,876,578 residents: **30.4406% to 30.5433%, +0.1027 percentage points**.
Registered municipalities rise from 4,100 to 4,104; the top 300 rises from
117 to 118 and the top 1,000 from 300 to 302. The top 100 remains at 49.

The delivery baseline includes the [preceding three-municipality batch](published-permits-2026-10-02.md)
and the SPL-Xdemat and discovered-host additions merged in parallel in
[PR #405](https://github.com/mml-studio/surplomb/pull/405). The four new
municipalities have no other current source, so their population gain
is attributed only to this batch.
Population uses the official Geo API snapshot of 2 October 2026, with the
same denominator of 68,350,798 residents and exclusions for codes beginning
with 975, 977, 978 and 98. Coverage is the union of current municipal
readers, excluding the annual Montpellier dataset. A registered source
does not establish complete publication of every permit or permit family.

## Sources and collection

The production `readPermitCity` collector and daily-sweep OCR read the
September–October window with normal robots and collection policies.

| Municipality | INSEE | Population | PDF editions | Posting rows | Distinct dossiers | Latest publication | Source |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Bry-sur-Marne | 94015 | 18,503 | 1 | 24 | 23 | 2026-09-28 | [Weekly display register](https://www.brysurmarne.fr/mon-cadre-de-vie/urbanisme/information-de-la-population/les-avis-daffichage/) |
| Saint-Raphaël | 83118 | 37,113 | 8 | 231 | 231 | 2026-10-01 | [Filings and decisions](https://www.ville-saintraphael.fr/utile/urbanisme/depots-et-decisions) |
| Scionzier | 74264 | 9,162 | 2 | 52 | 52 | 2026-09-29 | [Municipal planning page](https://www.scionzier.fr/habiter/urbanisme/) |
| Aiffres | 79003 | 5,419 | 4 | 35 | 23 | 2026-10-02 | [Planning authorizations](https://www.ville-aiffres.fr/autorisations-du-droit-des-sols) |
| **Total** | | **70,197** | **15** | **342** | **329** | | |

Of the 342 posting rows, 337 have a published project address. The remaining
five Scionzier rows have cadastral references. These are extracted sites,
not a claim that all rows already have confirmed geocodes; existing
cadastral/BAN placement remains responsible for map placement. Both a
filing and a later decision may name the same dossier, and consecutive
register editions repeat postings. No download failed and no file remained
skipped or pending OCR.

## Reader behavior and limits

`src/data/municipalRegisterBoards.js` supplies pure protocols and PDF readers,
registered in `permitBoards.js` and `permitBoardCities.js`. All four use the
existing six-hour cache, daily archive, dossier folding and geographic
placement. Only project fields are retained. Applicant, owner and architect
columns, their own addresses and raw OCR text are excluded.

Bry-sur-Marne publishes a weekly thirteen-page scan, rotated sideways. The
background OCR receives `rotate: 90`; visitors never start OCR. Filing and
decision pages are classified individually, with ERP/IGH notices excluded.
The reader requires the full local dossier number, including its counter,
and a project street. It does not repair an unread counter into a guessed
identity. The accepted rows comprise sixteen filings and eight decisions:
two refusals, one withdrawal, two grants and three signed decisions whose
verdict remains unread. This is a partial extraction of the scan.

Saint-Raphaël replaces eight Word-table PDFs in place: filings and grants
for PC, DP, PA and PD. They use HTTP ETag/Last-Modified validators rather
than immutable-edition caching. Their live reading retained 101 filings
and 130 grants. The explicit decision cell remains authoritative; tests
also cover a refusal and an amendment suffix.

Scionzier exports spreadsheets whose neighboring cells are painted with
no intervening gap. `extractPdfText` accepts measured `columnEdges` for
these two layouts, splitting glyph runs before the applicant or architect
could join the site. Centered rows and continuation pages retain 39 filings
and thirteen grants. The decision register explicitly names authorizations
granted. Full cadastral references are converted to the local section and
number, preserving a nonzero cadastral prefix.

Aiffres repeats a DDC table header for each permit family, including CU.
The project site comes from the terrain's `sis` line, excluding the terrain
owner. Signature dates, notification dates and verdicts are separate fields.
Negative certificates, grants with prescriptions and withdrawals retain
their explicit states. Four editions retained seventeen filing rows and
eighteen decisions: fifteen grants, two refusals and one withdrawal.
The publisher's download links have temporary public CDN signatures and
stable `runtime_url` attributes. The signed URL is used only to download;
the cache and returned metadata keep the stable URL. Neither signature nor
raw PDF is persisted in the permit archive.

All four sources honour robots.txt without a new override. Bry-sur-Marne
and Saint-Raphaël refuse a User-Agent containing `scan`; the requests use
the existing honest Surplomb name without that word. No login, challenge
or browser emulation is used. Local verification spaces requests by at
least one second per host. Missing verdicts stay signed decisions, and
future parsed dates are withheld.

## Validation

Both full test suites passed in local time and UTC. Focused regressions
cover the final parser changes, rotated background OCR, mixed scan boards,
unread identities and verdicts, negative decisions, project/private field
separation, gapless PDF columns and transient download signatures excluded
from cache metadata. The production build and layer-manifest check pass.

The rendered Scionzier map uses the real `/api/ads-fr` response, with 25
dossiers in the 400 m viewport and 23 having a footprint. Desktop
(1440 × 1000), tablet (834 × 1112) and mobile (390 × 844) screenshots are
saved under `.context/next-cities/`. None has horizontal document overflow;
the permit layer reports no error, and the checked API responses are HTTP
200. The browser has no console errors on the final navigation; its existing
Apple mobile-web-app metadata deprecation warning remains.
