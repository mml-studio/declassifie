# Fleury-les-Aubrais and Guipavas municipal permits — 4 October 2026

Two official publishers expose current, anonymously accessible permit registers:
[Fleury-les-Aubrais's urbanism postings](https://www.fleurylesaubrais.fr/ma-mairie/vie-municipale/publications-des-actes-administratifs/?category=urbanisme)
and [Guipavas's public municipal media index](https://guipavas.bzh/wp-json/wp/v2/media?mime_type=application/pdf&after=2026-09-01T00:00:00&per_page=100&_fields=date,source_url,title).
Their newest filing and decision lists are dated 2 October 2026. Both
publishers' robots rules allow the required page, API and file paths; no
account, OCR or robots override is needed.

## Collection and placement

| Production collection | Fleury-les-Aubrais | Guipavas |
| --- | ---: | ---: |
| Municipality code | 45147 | 29075 |
| Filing rows | 39 | 130 |
| Decision rows | 38 | 78 |
| Distinct dossiers after folding | 64 | 208 |
| Extracted project addresses | 63 | 208 |
| Placed on cadastral parcels | 0 | 202 |
| BAN-geocoded dossiers | 62 | 4 |
| Unplaced dossiers | 2 | 2 |

Fleury's 77 rows include 13 dossiers appearing on both boards. Its filing
register is `Liste-affichage-depot-02_10_2026-11_36_22.xlsx`, with the exact
sheet `Liste affichage dépôt`; decisions use
`liste-affichage-02-10-2026.pdf`. The six spreadsheet headers and eight PDF
headers identify project columns separately from applicants. The reader
requires the complete municipal dossier identity and printed town, excludes
the applicant column entirely, and withholds a project address carrying a
conflicting postcode. A second dossier fails ordinary BAN placement; neither
is assigned to the municipality's center.

XLSX support is opt-in per board and exact sheet. The existing dependency-free
ZIP/XML reader limits expanded archives to 8 MiB, 5,000 rows and 64 columns
for these registers. Windows Excel serial dates are converted in UTC; the
1904 date system is rejected, formula cells are withheld, and invalid or
future dates stay absent. Only scrubbed project rows enter the edition cache
and daily archive. Corrupt, unsupported or unread workbooks mark collection
incomplete without caching a false empty edition. Workbook downloads use the
same capped-body and extended timeout path as PDF registers.

Guipavas's public WordPress media API discovers
`20261002_Liste-des-avis-de-depot.pdf` and
`20261002_Liste-des-decisions.pdf`. Their positioned Cart@DS tables use the
existing report readers, including explicit project parcel references. Only
the newest list of each board is retained; unrelated acts and older snapshots
are excluded. Compact filename dates now retain the exact publication day,
and a time appended to a day-first filename never becomes a second date.
Neither municipality asserts current-under-review status: a filing notice
alone does not prove that its instruction remains open. The shared teal
project class now says “Application filed” / “Demande déposée” in the map
key and card, so a filed state never implies current review. Explicit
under-review states and counts retain their existing data semantics.

Guipavas replaces its membership in the Brest granted-permit portal, which
publishes building permits and certificates but no prior declarations or
refusals. The municipal lists provide those missing families and outcomes.
Brest's portal still serves its other seven municipalities. This avoids
collecting the same municipality through two sources. The municipal snapshot
and daily archive replace the wider granted-only portal's historical series
for Guipavas; national Sitadel remains available and the new archive grows
from this collection date. Source availability is not proof of exhaustive
extraction or complete historical coverage.

## Comparable population gain

The baseline is main at `9a31d83f`, including Sélestat and the preceding
integrations. Both sides use the same
[official municipality snapshot](https://geo.api.gouv.fr/communes?fields=nom,code,population,codeEpci),
excluding overseas collectivities beginning 975, 977, 978 and 98, annual
Montpellier exports and national Sitadel from current-source coverage.

| Current municipal-source coverage | Before | After |
| --- | ---: | ---: |
| Municipalities | 4,315 | 4,316 |
| Residents | 22,939,530 | 22,961,334 |
| Residents in the denominator | 68,350,798 | 68,350,798 |
| Population coverage | 33.5615% | 33.5934% |

Fleury-les-Aubrais adds **21,804 previously uncovered residents**. Guipavas's
15,538 residents were already counted through Brest and are not counted
again. The two municipal registers serve 37,342 residents in total.

Thirty additional bounded municipal-site screenings are retained in
[fleury-guipavas-screenings-2026-10-04.json](fleury-guipavas-screenings-2026-10-04.json)
and the research history. None yielded a further verified current source.
Dax's public urbanism category returned HTTP 200 with zero documents; other
checks include generic information, filing portals, mixed legal boards and
HTTP failures. These results do not establish absence of publication. The
checks are deferred to 4 November, with explicit revisits still possible.
Toulouse, Saint-Denis (La Réunion) and Vénissieux are not reopened.

## Validation

The production collector reads two files per municipality with no failed or
skipped file, pending OCR or incomplete result. The `/api/ads-fr` route reports
64 and 208 distinct dossiers, with 62 and 206 placed respectively. Fixtures
exercise exact headers, applicant exclusion, unsupported date systems,
formula cells, ZIP expansion/allocation bounds, invalid workbooks and
source ownership. Full tests run in Europe/Paris and UTC; the production
build and layer manifest check pass. Browser QA checks municipal cards on
1440×900 desktop, 834×1112 tablet and 390×844 touch-mobile viewports. Screenshots
are kept in `.context/` and are not repository assets.
