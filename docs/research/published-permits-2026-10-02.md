# Three additional municipal planning boards, 2 October 2026

This continues the [outer Paris survey](outer-paris-permits-2026-10-02.md)
and the earlier inner Paris platform survey. Three additional municipalities
are integrated, representing **61,425 residents**. Current municipal-source
coverage rises from 20,372,193 to 20,433,618 residents: **29.8053% to
29.8952%, +0.0899 percentage points**. Registered municipalities rise from
3,958 to 3,961; the top 1,000 rises from 286 to 288. The top 100 and top 300
remain at 49 and 116. These gains are measured against the registry including
the preceding eight-municipality batch, not attributed to other work.

Population uses the preceding survey's official Geo API snapshot, with the
same denominator of 68,350,798 residents and exclusions for codes beginning
with 975, 977, 978 and 98. Coverage is the union of current municipal
readers, excluding the annual Montpellier dataset. It describes a registered
source, not a guarantee that every permit or permit family is published.
The broader ten-point coverage objective remains in progress.

## Sources and live verification

The production `readPermitCity` collector and daily-sweep OCR read the
September–October window with the normal robots and collection policies.

| Municipality | INSEE | Population | Selected order PDFs | Retained decision rows | Distinct dossiers | Latest publication | Source |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Eaubonne | 95203 | 26,211 | 5 | 5 | 5 | 2026-09-21 | [Municipal planning-theme index](https://www.eaubonne.fr/vie-municipale-et-citoyennete/actes-administratifs/) |
| Les Pavillons-sous-Bois | 93057 | 25,804 | 12 | 12 | 11 | 2026-09-29 | [Delibs legal board](https://delibs.com/pavillonssousbois/) |
| Sainte-Luce | 97227 | 9,410 | 8 | 6 | 6 | 2026-09-29 | [Delibs legal board](https://delibs.com/sainteluce/) |
| **Total** | | **61,425** | **25** | **23** | **22** | | |

All retained rows have a published project address. These are extracted
addresses, not a claim that every row has already been geocoded. Existing
cadastral/BAN placement remains responsible for map placement. Les
Pavillons-sous-Bois publishes the same withdrawal twice; both posting rows
are retained and the application identity is shared. No download failed,
and no file remained skipped or pending OCR.

Two Sainte-Luce PDFs produced no accepted dossier. The OCR-read identities
conflict with their index numbers (year 25 versus 26 in one; counter 00049
versus 00069 in the other). One also yields no usable site. The collector
rejects these records rather than replacing the document's identity with
an index guess. They remain opportunities for better OCR, not imported
permits. Unknown decision text remains a signed decision. Explicit PDF
certificate headings identify tacit authorization or non-opposition;
an index title alone does not establish a grant.

## Reader behavior

`src/data/publishedPermitBoards.js` supplies pure protocols and PDF readers,
registered in `permitBoards.js` and `permitBoardCities.js`.

Eaubonne's `urbanisme-arretes` act-type filter returns no acts. Its
`urbanisme` theme supplies the current orders and some unrelated municipal
acts, which are excluded by their titles. Collection uses the publisher's
month filters, the article's explicit `<time>` publication day and its
PDF link. Pagination keeps the collection filters. An upload folder is not
used as an exact posting day.

Delibs exposes `/api/organismes/<tenant>/actes` with
`noeud=affichage-legal&page=N&parPage=20`. Larger requested page sizes change
`nombrePages` while the API still returns only twenty acts, so the reader
uses the supported size and follows every reported page, including pages
with no planning orders. Only a municipality's own
`/api/organismes/<tenant>/documents/acte-<id>.pdf` is accepted. Rental
permits, advertising permissions, road orders, pre-emption and decisions
merely authorizing the municipality to file an application are excluded.
Annexes (CERFA forms, applicant attachments) are never requested.

Delibs allows its public pages but disallows `/api/` in robots.txt. These
two legal boards explicitly use the project's existing override policy,
as DematDOC's legal postings do. No authentication or challenge bypass is
used. Local live verification spaces requests by at least one second per
host. Scanned orders are read by the existing daily-sweep OCR budget;
visitors use collected snapshots rather than running OCR.

Sainte-Luce prints `972 227` in its dossiers. Its registry keeps INSEE
`97227` for geographic coverage and placement, with the narrow
`source.dossierCode: '972227'` option preserving the actual published
number. The default dossier behavior for every other municipality stays
unchanged. Applicant names, residential addresses and raw act titles are
not copied into metadata or stored rows. Street suffixes carrying cadastral
references or planning zones are removed before placement; ambiguous OCR
parcels are left unread. An order number accidentally joined to the works
field is removed.

## Remaining leads

- **Bry-sur-Marne:** anonymous municipal HTTP access and the latest weekly
  register are confirmed. The 28 September PDF has thirteen scanned pages,
  turned 90 degrees, mixing planning and ERP records. A rotated OCR probe
  reads it, but the existing table readers do not safely extract its rows.
  It is not counted as new coverage. Integrate a reader plus the rotation
  option in the board collector.
- **Igny:** its latest scanned filing register is confirmed; the section
  supplies PC/DP/PD prefixes omitted from the dossier cells. Applicant and
  project columns are separate, but OCR can fuse words across table borders.
  Its individual decisions remain covered by the preceding batch; filings
  still need a dedicated reader.
- **Bezons:** the inspected public land-use category contains older general
  property acts, not a confirmed recent planning-permit board. This does not
  establish that the municipality publishes nowhere else.
- **Mitry-Mory and Saint-Leu-la-Forêt:** their Delibs boards answer publicly;
  the earlier platform survey did not identify a fresh qualifying permit
  stream there. Do not infer coverage from a platform login or a municipal
  decision authorizing a filing.
- **Le Vésinet:** this continuation's municipal HTTP request returned 403.
  Public SharePoint folders remain unverified.

Scrubbed collector results, population snapshots and temporary OCR evidence
are under `.context/continuation/` and `.context/cov/`; raw PDFs and OCR
runs are not tracked. The [machine-readable follow-up](published-permits-2026-10-02.json)
keeps source identifiers, coverage measurements and live-check totals.
