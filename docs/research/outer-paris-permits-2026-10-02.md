# Outer Paris suburbs: planning permit coverage, 2 October 2026

The handoff's pool contained 154 municipalities in departments 77, 78, 91
and 95. Plaisir and Meulan-en-Yvelines were already covered by the DematDOC
integration on main. The remaining 152 municipalities, representing
3,137,703 residents, received an initial website screening: 587 pages,
followed by targeted platform indexes and permit PDF checks. This is a
screening, not an exhaustive determination of what each municipality
publishes. Unconfirmed websites need another pass.

Eight additional municipalities are integrated. The national population
covered by a registered current municipal permit source rises from
20,216,933 to 20,372,193 residents: **29.5782% to 29.8053%, +0.2272 percentage
points**. Covered municipalities rise from 3,950 to 3,958; the top 300 moves
from 115 to 116, and the top 1,000 from 279 to 286. The top 100 stays at 49.
This advances the handoff's overall ten-point objective; it does not
complete it.

These final comparisons use main after [PR #402](https://github.com/mml-studio/surplomb/pull/402),
which added 258 other municipalities and 435,491 residents while this
survey was running. Against the starting handoff baseline, this batch alone
would have moved coverage from 28.94% to 29.17%; its own gain remains
155,260 residents, without attributing the other batch to this work.

## Integrated sources

The live collector read the two-month September–October window, with the
same daily archive and OCR rules used by existing municipal sources.

| Municipality | INSEE | Population | Filings in lists | Decisions in lists | Distinct files with a project address | Public board for this municipality |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Pontault-Combault | 77373 | 39,096 | 29 | 23 | 40 | [Weekly WordPress lists](https://actes.pontault-combault.fr/docs/) |
| Rambouillet | 78517 | 27,724 | 47 | 40 | 75 | [Digilor app 306](https://datahall.mydigilor.fr/web/#/documents/306) |
| La Celle-Saint-Cloud | 78126 | 20,460 | 0 | 13 | 12 | [Municipal planning orders](https://lacellesaintcloud.fr/arretes-municipaux/?t=urbanisme) |
| Le Mée-sur-Seine | 77285 | 19,527 | 7 | 1 | 8 | [Filing and decision pages](https://www.lemeesurseine.fr/vos-demarches/urbanisme-amenagement-du-territoire/avis-de-depot/) |
| Vauréal | 95637 | 16,079 | 54 | 197 | 110 | [Weekly planning tables](https://vaureal.fr/au-quotidien/urbanisme-travaux/affichage-des-autorisations-durbanisme) |
| Villepreux | 78674 | 11,931 | 0 | 12 | 12 | [Digilor app 319](https://datahall.mydigilor.fr/web/#/documents/319) |
| Igny | 91312 | 10,833 | 0 | 12 | 12 | [Digilor app 22](https://datahall.mydigilor.fr/web/#/documents/22) |
| Crosne | 91191 | 9,610 | 4 | 1 | 5 | [Planning notice page](https://www.crosne.fr/ma-ville/mon-cadre-de-vie/plan-local-durbanisme/) |
| **Total** | | **155,260** | **141** | **299** | **274** | |

The 440 rows include repeated weekly lists and different milestones of the
same application. Deduplication by municipality and dossier number gives
274 distinct permit files, all with a project address in at least one
published row. One Vauréal filing row has no address; another posting of
that file supplies it. These are addresses extracted from the publisher,
not an assertion that all have already been geocoded. The existing
cadastral/BAN placement pipeline remains responsible for map placement.
All 120 selected PDF editions were processed, with no failed downloads,
no skipped files and no pending OCR at the end of the check.

Population uses the handoff's 2026-10-02 snapshot of the official
[Geo API](https://geo.api.gouv.fr/communes?fields=nom,code,population,codeEpci).
The denominator is 68,350,798 residents, excluding codes beginning with
975, 977, 978 and 98, as in the preceding handoff. Coverage is the union of
Cart@DS, Sirap, local ADS portals, e-permis, Publication Actes and permit
lists; the annual Montpellier dataset is excluded from current-source
coverage. A municipal source does not guarantee that every permit is
published, nor that all permit families are available.

## Reader behavior and remaining limits

`src/data/outerParisPermits.js` supplies pure protocols and PDF readers;
`permitBoards.js` connects them to the existing collector. Pontault's
compact application numbers, repeated family headers and separate house
number column are handled explicitly. Rambouillet's GDS filing table and
Vauréal's tables reuse the existing positioned-table reader. Individual
orders and filing notices reuse the project-field readers and the daily
sweep's OCR; private applicants and their residential addresses are not
retained.

An operative first article identifies a decision even when its recitals
mention an earlier filing notice. Dates printed with dots are accepted;
standalone signature dates are read only after that article. An upload
folder naming a month is used for collection filtering, never presented
as an exact posting date. Unread signature dates remain null. Future OCR
dates are withheld: a sampled Rambouillet scan read 2029 where the source
was posted in September 2026. The original date is not guessed.

Digilor display titles shorten Villepreux's `E0118` to `E118`; comparison
uses their numeric identity while preserving the PDF's printed number.
Explicit amendment suffixes are retained. A different application number
in the PDF is rejected. Raw document titles, which may contain a person's
name, are not copied into file metadata or collected rows. Unknown verdicts
stay signed decisions, without inferring a grant.

Igny's individual orders are integrated, including refusals. Its scanned
weekly filing registers need another reader: their application numbers
omit the PC/DP prefix, which is supplied by the section heading. They are
not counted as imported filings in this batch. One Villepreux PDF yields
no readable planning record; it is not replaced with an invented address.

## Next research pass

The [machine-readable survey](outer-paris-permits-2026-10-02.json) records all
152 screened municipalities, official population ranks, public page URLs,
HTTP outcomes and explicit assessment states. The 144 not added represent
2,982,443 residents. Entries marked `screened-unconfirmed` are open leads,
not findings that the municipality does not publish.

Prioritize these leads before repeating the full website sweep:

1. **Igny weekly registers:** Digilor app 22, category 138. The latest scanned
   DP register covers 21–27 September. Add the section-prefix table reader
   alongside the individual orders already integrated.
2. **Eaubonne:** its [administrative acts](https://www.eaubonne.fr/vie-municipale-et-citoyennete/actes-administratifs/)
   are numbered PDFs. Search results point to planning orders; establish a
   reliable current selector and sample actual project fields.
3. **Mitry-Mory and Saint-Leu-la-Forêt:** their municipal sites link
   [delibs.com/MITRY](https://delibs.com/MITRY/) and
   [delibs.com/saint-leu-la-foret](https://delibs.com/saint-leu-la-foret/).
   Verify permit counters and current orders. This may expose a reusable
   platform reader for other municipalities.
4. **Bezons:** inspect categories of its embedded
   [administrative-acts service](https://services.ville-bezons.fr/actes-administratifs/).
   **Le Vésinet:** verify anonymous access to the SharePoint planning
   folders linked by its municipal page.
5. **Chilly-Mazarin:** the [planning gallery](https://www.ville-chilly-mazarin.fr/demandes-durbanisme/)
   exposes public notices, including a sampled PC filed on 29 December
   2025. Its newest sampled 2026 titles concern APE permits, outside the
   planning-permit families. Check newer PC/DP documents before counting
   it as current coverage.
6. **Thorigny-sur-Marne:** its municipal page exposes PC and DP decision
   PDF links, but the sampled downloads returned 403. **Meaux:** HTTP
   returned 418 and Playwright returned 403. Neither is integrated on the
   strength of search snippets or inaccessible files.

Watch the following sources without counting them as new coverage:

- **Grand Paris Sud:** its Cart@DS regulatory board answers, but exposes an
  empty municipality selector. Do not infer coverage of the entire
  intermunicipal authority from a working login page.
- **Élancourt:** the Docs2Web mirror exposes many acts, but its urbanism
  folder ends in 2025. Sampled planning-related acts did not establish a
  current permit board.
- **Guyancourt (Digilor app 309) and Le Plessis-Bouchard (app 366):** public
  indexes exist; sampled categories did not supply current planning permits.
- **Dammartin-en-Goële and Boussy-Saint-Antoine:** their DematDOC public
  category 14 returned 86 and three acts respectively, with no planning
  permit title identified during this check. This does not rule out
  publication elsewhere.

The other two handoff tracks remain useful: platform-wide customer
discovery and municipalities above 20,000 residents outside Île-de-France.
The preceding workspace's files remain in
`beijing-v1/.context/cov/`; this workspace's HTTP/PDF evidence, OCR runs,
live collector summaries and scripts are in `.context/cov/`. The project
memory file named by the transcript was not found, so this checked-in
report and survey are the portable continuation record.
