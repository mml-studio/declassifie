/**
 * Communes whose Screensoft Docs2Web kiosk posts their urbanism acts, read by
 * the `docs2web` protocol (`permitBoardsDocs2web.js`): [INSEE, postcode,
 * name, the kiosk's page]. Data only, appended to `permitBoardCities.js`'s
 * list. Found on 2026-10-03 among the tenants the Wayback Machine lists under
 * `screensoft.eu/Docs2Web/` and the kiosks communes host on their own site:
 * these name a dossier in their papers' names and serve their PDFs. Teloché
 * names them too, but its kiosk's `content/` redirects to Screensoft's login;
 * Bassens is read by Bordeaux Métropole's portal; Quesnoy-sur-Deûle's kiosk is
 * served over plain HTTP only; La Valette-du-Var names its papers by applicant, Saint-Amand-les-Eaux
 * posts weekly lists, and Varennes-Jarcy and Font-Romeu posted no urbanism
 * since August.
 */
// i18n-ignore-start — publishers' names
const COMMUNES = [
  ['37122', '37300', 'Joué-lès-Tours', 'https://www.jouelestours.fr/wp-content/uploads/adtm/'],
  ['59098', '59166', 'Bousbecque', 'https://www.screensoft.eu/Docs2Web/2070%20-%20COMMUNE%20DE%20BOUSBECQUE/'],
];
// i18n-ignore-end

export const DOCS2WEB_CITIES = COMMUNES.map(([insee, postcode, name, page]) => ({
  key: `docs2web-${insee}`, insee, postcode,
  label: `${name} — affichage légal d’urbanisme`, // i18n-ignore-line — the commune's name and its board's title
  page,
  // Screensoft's robots.txt refuses every path but its login; the boards are the public display the Code requires.
  ...(page.includes('screensoft.eu') ? { robots: 'overridden' } : {}),
  source: { protocol: 'docs2web', ocr: true },
}));
