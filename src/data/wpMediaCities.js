/**
 * Communes whose WordPress site holds the permits they post — the weekly
 * lists their instruction service prints, or one PDF per avis de dépôt or
 * arrêté — read through the site's media API by the `wp-media` protocol
 * (`permitBoardsPostedLists.js`): [INSEE, postcode, name, the site]. Data
 * only, appended to `permitBoardCities.js`'s list.
 *
 * Found on 2026-10-03 by asking the media API of the sites of communes no
 * source covered for the PDFs they uploaded, and keeping those that posted a
 * list or an act of their own within the month. Most acts are signed scans,
 * read by the daily sweep's OCR. Left out: Cap-d’Ail, which posts each
 * dossier's plans rather than its notice; Mauges-sur-Loire, Cesson-Sévigné,
 * Vif, Saint-Jean-d’Angély, Bouillargues and Trèbes, whose media API asks for
 * a login; and the communes whose lists are laid out in a way no reader
 * takes yet.
 */
// i18n-ignore-start — publishers' names
const COMMUNES = [
  ['06012', '06240', 'Beausoleil', 'https://www.villedebeausoleil.fr/'],
  ['08480', '08000', 'Villers-Semeuse', 'https://www.villers-semeuse.fr/'],
  ['13021', '13620', 'Carry-le-Rouet', 'https://mairie-carrylerouet.fr/'],
  ['14117', '14390', 'Cabourg', 'https://www.cabourg.fr/'],
  ['14333', '14600', 'Honfleur', 'https://www.ville-honfleur.com/'],
  ['14406', '14480', 'Moulins-en-Bessin', 'https://www.moulins-en-bessin.fr/'],
  ['14514', '14130', 'Pont-l’Évêque', 'https://www.pontleveque.fr/'],
  ['14515', '14520', 'Port-en-Bessin-Huppain', 'https://www.portenbessin-huppain.fr/'],
  ['14738', '14790', 'Verson', 'https://www.ville-verson.fr/'],
  ['17077', '17270', 'Cercoux', 'https://www.cercoux.fr/'],
  ['18267', '18570', 'Trouy', 'https://villedetrouy.fr/'],
  ['22004', '22140', 'Bégard', 'https://begard.bzh/'],
  ['25057', '25200', 'Bethoncourt', 'https://www.bethoncourt.fr/'],
  ['25527', '25410', 'Saint-Vit', 'https://www.saintvit.fr/'],
  ['26124', '26800', 'Étoile-sur-Rhône', 'https://www.etoilesurrhone.fr/'],
  ['26381', '26300', 'Jaillans', 'https://jaillans.fr/'],
  ['27049', '27270', 'Mesnil-en-Ouche', 'https://www.mesnil-en-ouche.fr/'],
  ['27226', '27150', 'Étrépagny', 'https://www.etrepagny.fr/'],
  ['28298', '28130', 'Pierres', 'https://www.mairie-pierres.fr/'],
  ['29006', '29950', 'Bénodet', 'https://www.mairie-benodet.fr/'],
  ['31547', '31600', 'Seysses', 'https://www.mairie-seysses.fr/'],
  ['32208', '32700', 'Lectoure', 'https://lectoure.fr/'],
  ['34197', '34800', 'Péret', 'https://mairie-peret.fr/'],
  ['34224', '34480', 'Puissalicon', 'https://puissalicon.fr/'],
  ['34337', '34750', 'Villeneuve-lès-Maguelone', 'https://www.villeneuvelesmaguelone.fr/'],
  ['37058', '37140', 'La Chapelle-sur-Loire', 'https://www.lachapellesurloire.fr/'],
  ['41212', '41350', 'Saint-Gervais-la-Forêt', 'https://stgervais41.fr/'],
  ['44032', '44330', 'La Chapelle-Heulin', 'https://www.mairie-lachapelleheulin.fr/'],
  ['44117', '44330', 'Le Pallet', 'https://www.lepallet.fr/'],
  ['45173', '45150', 'Jargeau', 'https://www.jargeau.fr/'],
  ['45227', '45500', 'Nevoy', 'https://www.nevoy.fr/'],
  ['45327', '45470', 'Traînou', 'https://mairie-trainou.fr/'],
  ['45338', '45700', 'Villemandeur', 'https://villemandeur.fr/'],
  ['50410', '50170', 'Pontorson', 'https://www.pontorson.eu/'],
  ['53140', '53950', 'Louverné', 'https://louverne.fr/'],
  ['57588', '57570', 'Rodemack', 'https://mairie-rodemack.fr/'],
  ['59514', '59131', 'Rousies', 'https://www.mairie-rousies.fr/'],
  ['61145', '61700', 'Domfront en Poiraie', 'https://villededomfrontenpoiraie.fr/'],
  ['62491', '62840', 'Laventie', 'https://www.laventie.fr/'],
  ['62516', '62190', 'Lillers', 'https://lillers.fr/'],
  ['62617', '62290', 'Nœux-les-Mines', 'https://www.noeux-les-mines.fr/'],
  ['62767', '62130', 'Saint-Pol-sur-Ternoise', 'https://www.saintpolsurternoise.fr/'],
  ['63103', '63140', 'Châtel-Guyon', 'https://www.chatel-guyon.fr/'],
  ['63308', '63130', 'Royat', 'https://www.royat.fr/'],
  ['65286', '65100', 'Lourdes', 'https://www.lourdes.fr/'],
  ['67282', '67520', 'Marlenheim', 'https://www.marlenheim.fr/'],
  ['67345', '67240', 'Oberhoffen-sur-Moder', 'https://www.oberhoffen.com/'],
  ['67550', '67360', 'Wœrth', 'https://www.ville-woerth.eu/'],
  ['68006', '68210', 'Bernwiller', 'https://ammertzwiller-bernwiller.fr/'],
  ['69089', '69340', 'Francheville', 'https://www.mairie-francheville69.fr/'],
  ['71497', '71000', 'Sancé', 'https://www.sance.fr/'],
  ['72308', '72610', 'Saint-Paterne - Le Chevain', 'https://www.saintpaterne-lechevain.fr/'],
  ['74008', '74100', 'Ambilly', 'https://ambilly.fr/'],
  ['74224', '74800', 'La Roche-sur-Foron', 'https://larochesurforon.fr/'],
  ['77171', '77450', 'Esbly', 'https://www.esbly.fr/'],
  ['85084', '85140', 'Essarts-en-Bocage', 'https://www.essartsenbocage.fr/'],
  ['85236', '85150', 'Saint-Julien-des-Landes', 'https://www.stjuliendeslandes.fr/'],
  ['88132', '88000', 'Deyvillers', 'https://deyvillers.fr/'],
  ['95116', '95820', 'Bruyères-sur-Oise', 'https://www.bruyeres-sur-oise.com/'],
  ['95371', '95670', 'Marly-la-Ville', 'https://marly-la-ville.fr/'],
];
// i18n-ignore-end

export const WP_MEDIA_CITIES = COMMUNES.map(([insee, postcode, name, page]) => ({
  key: `wp-media-${insee}`, insee, postcode,
  label: `${name} — affichage légal d’urbanisme`, // i18n-ignore-line — the commune's name and its board's title
  page,
  source: { protocol: 'wp-media', ocr: true },
}));
