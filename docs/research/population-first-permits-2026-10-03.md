# Population-first municipal permit integration, 3 October 2026

The new integration is Manosque (04112), 22,718 residents. Four other
Datahall findings — Reims, Montluçon, Saint-Laurent-du-Var and Concarneau —
were already integrated on `origin/main` when this worktree was updated.
They are excluded from this batch's gain. This is a modest increment; it
does not meet the earlier ten-percentage-point ambition.

## New source

[Manosque's public Datahall board](https://datahall.mydigilor.fr/web/#/documents/327)
has no authentication requirement. Its active web category 3608, sub-category
0, holds individual filing notices. The existing Digilor collector reads
the PDFs; its daily background OCR and the existing `outer-notice` reader
extract dossier identity, project address, works and known dates. Visitors
do not run OCR. `Date du dépôt` is an explicit filing-date label, now handled
alongside `Date de dépôt`. Other categories are excluded from this source.
Unread dossier identities remain withheld; no private applicant fields, raw
titles or OCR text are retained in the archive.

The final September–October collection examined 32 files and retained
13 distinct filings, each with a project address. Nineteen files yielded a
PDF dossier identity conflicting with the index and were excluded. Matching
is also enforced when an edition comes from cache; the PDF cannot override
an explicit, different index number. No download failed and no OCR remained
pending, but extraction is **partial** because of these conflicts. This does
not establish whether the mismatch comes from publication or delivery.

Local and UTC unit suites passed 10,819 tests with zero failures (one
existing skip; two allocation probes require Node 24). The production build,
layer manifest and public-diff checks passed. Browser checks on desktop
(1440×900), tablet (834×1112) and mobile (390×844) showed the Manosque source
on the map, no layer error and no horizontal overflow. The centre's 400 m
scan displayed 28 dossiers from municipal notices and Sitadel together;
that rendered count is not the new-source extraction count.

## Coverage accounting

The delivery baseline is `origin/main` at `5b1335a9`, including the intervening
Saumur/Voiron/posted-acts and Rochefort/Chemillé batches. The same Geo API
municipality population snapshot is used on both sides.
Scope excludes overseas collectivities beginning 975, 977, 978 and 98.
Coverage is the union of registered current municipal sources, not a claim
that every permit is published or extracted. Annual Montpellier exports and
national Sitadel are separate from this measure.

| Measure | Before | After |
| --- | ---: | ---: |
| Municipalities | 4,199 | 4,200 |
| Residents | 22,143,065 | 22,165,783 |
| Percentage of 68,350,798 residents | 32.3962% | 32.4294% |

The increment is 22,718 residents, **0.0332 percentage points**. Top 100
and 300 municipality coverage remains 51 and 128; top 1,000 coverage rises
from 336 to 337 (Manosque ranks 403rd in this population snapshot).

## Repeatable discovery priorities

`npm run permits:priorities -- --exclude 31555 --out .context/priorities.json`
loads all current municipal registries and Geo API population/EPCI codes.
It ranks uncovered towns of at least 50,000 residents and whole services by
their uncovered member population. Smaller towns remain in service totals.
`--communes` accepts a saved snapshot; `--minimum` changes the town/service
threshold. `--candidates` accepts an array of `{key, url, communes, verified,
latestPublication}`. A verified candidate must have an individually checked
public planning item with a usable site and a real publication date in the
last three calendar months. The command is read-only and cannot register a
source. Candidate unions prevent double counting cities or shared services.

The 3 October snapshot yields 66 uncovered town priorities above 50,000
residents and 226 service priorities. Examples of remaining population:
Lille Métropole 831,447, Métropole de Lyon 682,663, Montpellier Métropole
522,542, Rouen Métropole 479,032, Strasbourg Eurométropole 460,016 and
Grenoble Métropole 439,652. These figures rank research, not verified gains:
an EPCI's membership does not establish that one board covers all members.
Grand Paris's 3,093,033 uncovered residents require research by competent
territorial or municipal publication service.

Prefer a shared current register and extend its reader across verified
member municipalities. Require a dated, placeable planning item before
registering a town; stop a protected or stale lead and record why. Refresh
the priority report after every batch or update from main. Toulouse (31555)
is excluded at the user's request; its protected platform was not revisited.

## Screened leads and limits

A paced scan of Datahall app ids 1–1,000 selected uncovered municipalities
of at least 20,000 residents before fetching their document indexes. The
longest complete municipality name was matched before population filtering,
avoiding Saint-Paul-en-Chablais being mistaken for Saint-Paul (La Réunion).
Manosque was the only newly usable source after reconciliation with main.
Ajaccio had general acts, Metz's planning documents were historical,
Schiltigheim's Datahall planning category was hidden from the web (its
separate municipal PDF lists are already integrated), and Wasquehal had
no verified current permit stream. Raw indexes remain local research only.

[Issy's municipal page](https://www.issy.com/mes-demarches/vos-demarches-d-urbanisme)
describes a legal-display map consultable at the municipal administrative
centre, without a public board link. Saint-Paul's new IDE'AU platform is
described by its [municipal announcement](https://www.mairie-saintpaul.re/indisponibilite-temporaire-du-service-urbanisme-application-du-droit-des-sols/)
as a filing and private dossier-tracking service; no public permit register
was verified. Neuilly-sur-Marne's public ArcGIS `PC_en_cours` service's
latest update was 25 July 2022; it is not counted as a current source.
These checks do not prove that no other publication exists.
