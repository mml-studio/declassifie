# Vétraz-Monthoux and Ver-sur-Mer municipal permits — 4 October 2026

Two official publishers expose current permit registers without an account:
[Vétraz-Monthoux's PC/PA board](https://www.vetraz-monthoux.fr/espace-documentaire/affichage_legal/urbanisme-permis-de-construire/),
its [prior-declaration board](https://www.vetraz-monthoux.fr/espace-documentaire/affichage_legal/urbanisme-declarations-prealables/),
and Ver-sur-Mer's [filings](https://www.versurmer.fr/infos-pratiques/urbanisme-etat-civil/avis-de-depot-d-autorisations-d-urbanisme/liste-des-avis-de-depot-13017)
and [decisions](https://www.versurmer.fr/infos-pratiques/urbanisme-etat-civil/avis-de-depot-d-autorisations-d-urbanisme/liste-des-decisions-13018).
Their robots rules allow the required page and PDF paths. No OCR, login or
robots override is needed.

## Collection and placement

| Production collection | Vétraz-Monthoux | Ver-sur-Mer |
| --- | ---: | ---: |
| Municipality code | 74298 | 14739 |
| Edition day | 2026-09-29 | 2026-09-11 |
| Filing rows | 57 | 69 |
| Decision rows | 34 | 11 |
| Distinct dossiers | 91 | 80 |
| Extracted project addresses | 91 | 80 |
| Placed on cadastral parcels | 77 | 73 |
| BAN-geocoded dossiers | 14 | 7 |
| Unplaced dossiers | 0 | 0 |

Vétraz publishes four PDFs under `/app/uploads/2026/09/`, named
`29-09-2026-affichage-depot-PCPA.pdf`,
`29-09-2026-affichage-decision-PCPA.pdf`,
`29-09-2026-affichage-depot-DP.pdf` and
`29-09-2026-affichage-decision-DP.pdf`. The PC/PA boards contain 15 filings
and ten decisions; DP boards contain 42 filings and 24 decisions.
`permitBoardsVetraz.js` verifies each table's exact headers, measured column
geometry and municipality identity before retaining dossier number, site,
parcels, project description, dates and verdict. The beneficiary column and
both architect columns are excluded entirely, including corporate applicants.
Long private cells remain in their own column when their glyphs extend into
the next one. Only scrubbed project rows are cached and archived.

Service letters printed separately from their counters and modification
suffixes after a comma or period are normalized without dropping their
identity. Invalid dates, dates after the edition and partial parcel references
are withheld. An address can still be geocoded when its parcel is incomplete
or cannot be resolved. A published repeal closes the dossier instead of
leaving it filed. Unknown outcomes keep their published wording.
The source opts into `requiredRows`: if a table cannot be read, collection
is incomplete and no empty edition is cached. A truly empty future snapshot
also requires verification, preserving the archive rather than silently
clearing it.

Ver-sur-Mer publishes `liste-des-avis-de-depot-11_09_2026.pdf` and
`liste-des-decisions-11_09_2026.pdf` under `/ver-sur-mer/fichiers/`.
The existing Cart@DS report readers retain project fields and scrub private
applicants; public corporate applicants may remain. Older whole-register
snapshots linked on the same pages are excluded. Some retained filings date
from earlier years: an avis de dépôt proves filing, not that the application
is still under review. Neither municipality opts into an under-review claim.
The archive grows from collection day and is not a complete historical series.
The route's date and distance filters may show fewer dossiers than the full
municipal collection above; national Sitadel remains a separate source.

## Comparable population gain

The baseline is main at `20e0b9e8`, including the preceding 20-town batch.
Both sides use the same
[official municipality snapshot](https://geo.api.gouv.fr/communes?fields=nom,code,population,codeEpci),
excluding overseas collectivities beginning 975, 977, 978 and 98, annual
Montpellier exports and national Sitadel from current-source coverage.

| Current municipal-source coverage | Before | After |
| --- | ---: | ---: |
| Municipalities | 4,372 | 4,374 |
| Residents | 23,426,405 | 23,438,935 |
| Residents in the denominator | 68,350,798 | 68,350,798 |
| Population coverage | 34.2738% | 34.2921% |

Vétraz-Monthoux adds 10,949 previously uncovered residents and Ver-sur-Mer
1,581, **12,530 in total**. Fontaine-lès-Dijon's
[municipal lists](https://www.fontainelesdijon.fr/formulaires-et-autorisations-durbanisme/)
were also verified: the 17 September PDFs retain 31 filings and 30 decisions.
They are not registered because the existing Dijon Cart@DS portal already
serves municipality `21278`; adding them would collect the municipality twice.

Chartres's [official acts page](https://www.chartres.fr/actes-reglementaires)
links to [public category 14](https://webactes.chartres.fr/public/14?filters=14).
The returned category held 61 general acts with no verified permit document.
This bounded category check does not establish that no other category contains
permits. Orange's [official board](https://www.ville-orange.fr/article1374.html)
was found, but live page and document requests returned HTTP 503; its current
register could not be verified. Both leads are recorded for a later revisit.
Toulouse, Saint-Denis (La Réunion) and Vénissieux were not reopened.

## Validation

The production collector reads four files at Vétraz and two at Ver-sur-Mer
with no failed or skipped file, pending OCR or incomplete result.
The `/api/ads-fr` route reports all 171 municipal dossiers placed, 150 on
parcels and 21 geocoded. Synthetic fixtures cover the four tables, private
columns, complete identities, excluded works authorizations, invalid dates,
partial parcels, repealed decisions and changed-table collection failures.
The registry ownership check rejects duplicate municipalities.

Full tests run in Europe/Paris and UTC, with the production build and layer
manifest check. Browser QA uses `newQaPage` and checks selected municipal
cards at 1440×900 desktop, 834×1112 tablet and 390×844 touch-mobile viewports,
plus English desktop. There are no page errors or horizontal overflows.
The Playwright MCP additionally verifies the live desktop card. Screenshots
and local collection evidence are kept in `.context/`, outside tracked files.
