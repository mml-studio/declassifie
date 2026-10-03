/**
 * Digilor Datahall towns, batch A: data only (see `digilorTowns.js`).
 * Each entry is a `PERMIT_LISTS` city whose `source.kind` is `digilor`.
 */
// i18n-ignore-start — publishers' names and the titles of their legal boards
export const DIGILOR_TOWNS_A = [
  // Reims (app 515) posts a Cart@DS « Liste des avis de dépôt » every Monday
  // on « Dossiers déposés » — every dossier still under instruction, 210 rows
  // on 28 September 2026, some filed years ago — beside the odd order filed
  // there by mistake; and one order per dossier on « Autorisations délivrées »
  // (one sub-category per family, 345 since July 2026) and « Autorisations
  // retirées ». « Dossiers incomplets (rejetés) » holds letters to the
  // applicant, not orders: left out.
  { key: 'digilor-reims', insee: '51454', postcode: '51100', label: 'Ville de Reims — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/515',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 515, shelves: [
      { category: 5232, title: 'LISTE DES AVIS DE DEPOT', board: 'filings', layout: 'cartds-report-filings' },
      { category: 5186, board: 'decisions', layout: 'digilor-reims-order' },
      { category: 5436, board: 'decisions', layout: 'digilor-reims-order' },
    ] }, lists: [] },
  // Le Mans (app 23) posts its weekly lists on « URBANISME FONCIER » /
  // sub-category 328, named by title: `Affichage_Mairie_Depot_-2026-09-25`,
  // `Affichage Marie Decision - PC-2026-09-25` (one per family). Sub-category
  // 895 holds road-alignment orders (VCEP), 349 council deliberations.
  { key: 'digilor-le-mans', insee: '72181', postcode: '72000', label: 'Ville du Mans — autorisations d’urbanisme',
    page: 'https://datahall.mydigilor.fr/web/#/documents/23',
    source: { kind: 'digilor', base: 'https://datahall.mydigilor.fr', app: 23, shelves: [
      { category: 217, sub: 328, title: 'DEPOT', board: 'filings', layout: 'digilor-lemans-list' },
      { category: 217, sub: 328, title: 'DECISION', board: 'decisions', layout: 'digilor-lemans-list' },
    ] }, lists: [] },
];
// i18n-ignore-end
