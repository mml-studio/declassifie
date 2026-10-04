# Glossary — French ↔ English

Surplomb is a French product with a bilingual interface. This page fixes how
French public-data vocabulary reads in English, so that the docs, the globe's
English strings and every translation batch use the same words. It is the only
file in the repository where French and English sit side by side on purpose.

**Who uses it:** anyone writing English docs or English UI strings, and every
translation batch (human or agent). A batch that meets a term missing here adds
it to the section of its domain. Terms already listed only change between two
translation waves, never inside one, so that parallel batches stay consistent.

The machine-readable half of this page is [`src/i18n/glossary.js`](../src/i18n/glossary.js):
the proper nouns below, which the French detector must accept inside English
text. `src/i18n/glossary.test.mjs` fails when the two lists drift apart.

## Writing rules

- **US English.** *color, center, meter, neighborhood, license (noun and verb),
  catalog.* Code comments are not rewritten for this; UI strings and docs are.
- **Acronyms stay, glossed once.** Keep the French acronym (DVF, DPE, PLU…) and
  gloss it at its first use on a page, card or legend:
  *property sales (DVF)*. After that, the acronym alone is fine.
- **Proper nouns stay French**, accents included: *Géorisques, Île-de-France,
  Météo-France, Saint-Étienne.* Never anglicize a place or an organization.
- **Data values are not prose.** A commune name, a DVF `type_local`, a crime
  category from the CSV stay as published in the data; only their display label
  is translated (see `labelFor()` in the i18n conventions).
- **Numbers and units:** decimal point, comma for thousands, no space before
  `%`, a space before other units.

  | French | English |
  |---|---|
  | `5,6 s` | `5.6 s` |
  | `12 400 ventes` | `12,400 sales` |
  | `91,3 %` | `91.3%` |
  | `3 200 €/m²` | `€3,200/m²` |
  | `245 000 €` | `€245,000` |
  | `120 km`, `15 m` | `120 km`, `15 m` (metric everywhere, never miles or feet) |
  | `19 sept. 2026` | `Sep 19, 2026` |
  | `14 h 05`, `14:05` | `14:05` (24-hour clock: timetables and data timestamps are French) |
  | `2ᵉ`, `11ᵉ arrondissement` | `2nd`, `11th arrondissement` |

- **Punctuation:** no space before `: ; ? !`; French guillemets « » become
  curly quotes “ ”; apostrophes are typographic (’) in UI strings.
- **Capitalization:** sentence case for layer names and buttons (*Property
  prices*); layer-group headers stay in capitals, as in French (*ENERGY*).
- **Tone:** plain and factual, as in French. No spy or military fiction
  (*intel, target, surveillance*) for public data: a camera is a *public
  camera*, a building is a *building*.

## Product and brand

| French | English | Note |
|---|---|---|
| Surplomb | Surplomb | The product name. Never translated. |
| Belvédère | Belvédère | Name of the visual identity (logo, colors). Internal. |
| La France au rayon X | France, X-rayed | Tagline. |
| Aucun angle mort. | No blind spots. | Slogan. |
| la vitrine, la page d’accueil (`/`) | the landing page | |
| le globe, le cockpit (`/globe`) | the globe | “Cockpit” is a code word; say *globe* to readers. |
| couche | layer | |
| fiche (d’un objet cliqué) | card | The panel that opens on click. |
| Radiographie d’adresse | Address X-ray | `fiche.html`. |
| Fiche implantation | Site report | Where a business could open. |
| Estimation d’un bien | Property valuation | |
| Comparables (sélection conseiller) | Comparables (agent’s selection) | |
| Zone de chalandise | Catchment area | |
| la chronique | the chronicle | Server-side archive of live feeds. |
| essai, liste d’attente | trial, waitlist | |
| Mentions légales, Confidentialité, Conditions générales de vente (CGV) | Legal notice, Privacy, Terms of sale | The three legal pages. Only the labels of the links are translated; the pages stay French. |
| Pass propriétaire | owner pass | |
| barème national | national scale | The percentile ladder behind the Address X-ray. |
| note, lettre, rang | score, letter, rank | |
| fourchette | range | |

## Administrative and statistical geography

| French | English | Note |
|---|---|---|
| commune | municipality | *commune* allowed in parentheses on first use in docs. |
| arrondissement (Paris, Lyon, Marseille) | arrondissement | *Paris 11th arrondissement*. |
| arrondissement (départemental) | arrondissement (sub-prefecture district) | |
| département | department | *Gironde department*, *department 33*. |
| région | region | |
| EPCI, intercommunalité | intercommunality (EPCI) | |
| métropole, France métropolitaine | mainland France | *Métropole de Lyon* is a proper noun. |
| outre-mer, DROM | overseas France, overseas departments (DROM) | |
| IRIS | IRIS (INSEE neighborhood unit) | |
| carreau, carroyage INSEE | grid cell, INSEE 200 m grid | *Territoire (carroyage INSEE)* → *Territory (INSEE 200 m grid)*. |
| quartier | neighborhood | |
| lieu-dit | locality | |
| préfecture, sous-préfecture | prefecture, sub-prefecture | |
| mairie | town hall | |
| code INSEE, code commune | INSEE code | |
| code postal | postal code | |
| adresse, Base adresse nationale | address, national address database (BAN) | |
| cadastre, parcelle cadastrale | cadastre, cadastral parcel | *Parcelles cadastrales* → *Cadastral parcels*. |
| section cadastrale | cadastral section | The cadastre's subdivision of a commune (`AB`, `0C`); the unit the property-prices and energy-rating layers paint above 1,800 m. |
| revenu médian | median income | |
| niveau de vie | standard of living (per consumption unit) | |
| taux de pauvreté | poverty rate | |
| ménage | household | |
| logement (statistique) | dwelling | *housing* in running prose. |
| résidence principale / secondaire | primary residence / second home | |
| logement vacant | vacant dwelling | |
| pour 1 000 habitants | per 1,000 residents | |
| arrêté (préfectoral, ministériel) | (prefectoral, ministerial) order | |
| CGU | terms of use | |
| loi Informatique et Libertés (LIL) | French data protection act (LIL) | |
| carreau imputé | imputed cell | Filosofi. |
| secret statistique, non diffusé | statistical confidentiality, not released | |
| niveau de vie moyen / médian | mean / median standard of living | |
| écart interdécile D9/D1 | D9/D1 ratio | |
| indice de Gini | Gini index | |
| EQTP | full-time equivalent (FTE) | |
| rentrée, effectif étudiant | intake, enrolment | |

## Real estate and housing

| French | English | Note |
|---|---|---|
| DVF (demandes de valeurs foncières) | property sales (DVF) | |
| Prix de l’immobilier | Property prices | |
| vente, mutation | sale | *mutation* is the legal term; readers see *sale*. |
| prix au m² | price per m² | |
| Appartement / Maison / Dépendance | Apartment / House / Outbuilding | DVF `type_local` values. |
| Local industriel, commercial ou assimilé | Commercial or industrial premises | DVF `type_local` value. |
| surface habitable, surface réelle bâtie | living area, built floor area | |
| surface du terrain | land area | |
| nombre de pièces | number of rooms | |
| DPE (diagnostic de performance énergétique) | energy rating (DPE) | *Performance énergétique (DPE)* → *Energy rating (DPE)*. |
| étiquette énergie A à G | energy label A to G | |
| étiquette climat, GES | greenhouse-gas label | |
| passoire thermique | energy-inefficient home (F or G) | |
| diagnostic (un DPE déposé) | rating | *16 diagnostics* → *16 ratings*; one per dwelling, never per building. |
| classe (DPE), classe la plus fréquente | class, most frequent class | The mode of an address's ratings — never « the building's class ». |
| loyer, encadrement des loyers | rent, rent control | |
| copropriété | condominium building | |
| logement social, HLM, bailleur social | social housing (HLM), social landlord | |
| ERP (état des risques et pollutions) | risk disclosure statement (ERP) | **Not** the building category below. |
| notaire | notary | |
| estimation | valuation | |
| bornage | surveyor's boundary marking | Cadastre. On roads, see *Transport*. |
| contenance | registered area | Cadastre. |
| tracé, milieu, échelon | drawn, middle, rung | |
| dérive du marché | market drift | |
| VEFA | off-plan sale (VEFA) | |
| millésime non téléchargé, domaine gelé | vintage not downloaded, frozen domain | |
| levé au 1:500 | surveyed at 1:500 | |
| dossier de comparables | comparables file | |
| retenu / écarté | shortlisted / left out | |
| écart affichage sur acte | asking-over-deed gap | |
| bornes de plausibilité | plausibility bounds | |
| lot multiple | multi-lot | |

## Urban planning and buildings

| French | English | Note |
|---|---|---|
| Urbanisme | Planning | Layer name (the row; its primary is `ads-fr` since 2026-09-23). |
| Règles d’urbanisme | Planning rules | The zoning's tile and its layer name. |
| Permis & travaux | Permits & works | The permits' tile on the « Urbanisme » row. |
| Couleurs des projets | Project colors | The permits' block of the map key. |
| permis accordé, travaux commencés, travaux terminés, annulé ou refusé | permit granted, work started, work completed, canceled or refused | The classes of a building project. |
| demande en cours d’examen | application under review | |
| début des travaux déclaré, fin des travaux | start of work declared, end of work | The card's timeline. |
| surface déclarée, démolition prévue | declared floor area, planned demolition | |
| localisation à confirmer, repère approximatif | location to be confirmed, approximate marker | |
| période, toutes les dates | period, all dates | |
| PLU, PLUi | local zoning plan (PLU, PLUi) | |
| zonage, zone U / AU / A / N | zoning, urban / future urban / agricultural / natural zone | |
| Géoportail de l’urbanisme (GPU) | Géoportail de l’urbanisme (GPU) | Proper noun. |
| servitude d’utilité publique (SUP) | public utility easement (SUP) | |
| périmètre des abords (monument historique) | historic monument protection zone | |
| Autorisations d’urbanisme | Planning permits | Layer name. |
| permis de construire / d’aménager / de démolir | building / development / demolition permit | |
| déclaration préalable | prior declaration (minor works) | |
| abrogation | repeal | Published decision outcome; closes the permit's active state. |
| Sitadel | building permits (Sitadel) | |
| Bâti 3D | 3D buildings | |
| bâti, emprise au sol, hauteur | buildings, footprint, height | |
| RNB (Référentiel national des bâtiments) | national building register (RNB) | |
| établissement recevant du public (ERP) | public-access building (ERP) | **Not** the risk statement above. |
| îlot de fraîcheur / îlot de chaleur | cool island / heat island | *Îlots de fraîcheur* → *Cool islands*. |
| BÂTI & TERRITOIRE | BUILDINGS & LAND | Layer group. |
| zone à urbaniser ouverte / fermée | future urban zone, OPEN / CLOSED | |
| enclave | enclave | |
| emprise, assiette (d’une servitude) | extent | *Emprise au sol* stays *footprint*. |
| ouverture de chantier (DOC) | site opening declaration (DOC) | |
| achèvement (DAACT) | completion declaration (DAACT) | |
| nature du projet, destination principale | project nature, main use | |
| lotissement | housing subdivision | |
| certificat d’urbanisme | planning certificate | |
| préfixe de section | section prefix | Cadastre. |
| avis de dépôt | filing notice | The posting of a filed application (art. R.423-6). |
| récépissé de dépôt | filing receipt | A commune that posts the receipt posts a filing. |
| affichage réglementaire / affichage légal | legal posting board | A commune's board of acts and notices. |

## Energy

| French | English | Note |
|---|---|---|
| ÉNERGIE | ENERGY | Layer group. |
| Réseau électrique | Power grid | |
| Réseau électrique et centrales | Power grid and plants | The fused row (grid + power stations), since 2026-09-21. |
| ligne haute tension (HTB), moyenne tension (HTA) | high-voltage line, medium-voltage line | |
| poste électrique, poste source | substation, primary substation | |
| capacité d’accueil | hosting capacity | |
| S3REnR | regional renewable connection scheme (S3REnR) | |
| raccordement | grid connection | |
| Centrales électriques | Power plants | |
| Groupes de production | Generating units | |
| Centrales hydro | Hydro plants | |
| Mix électrique | Electricity mix | |
| nucléaire, éolien, solaire photovoltaïque, hydraulique | nuclear, wind, solar PV, hydro | |
| méthanisation, méthaniseur | anaerobic digestion, biogas plant | |
| Bornes de recharge, point de charge | EV charging, charge point | *Bornes de recharge* → *EV charging stations*. |
| Réseau gaz | Gas network | |
| filière | generation type | |
| palier (nucléaire) | reactor series | |
| fil de l’eau, éclusée, lac | run-of-river, pondage, reservoir | Hydro plant types. |
| thermique à flamme | fossil-fired | |
| poste de transformation | transformer substation | |
| point de piquage | tap-off point | |
| tronçon (de ligne) | segment | |
| régie | local utility | |
| point de piquage, régie | tap-off point, local utility | |

## Transport and mobility

| French | English | Note |
|---|---|---|
| MOBILITÉ TERRESTRE | GROUND MOBILITY | Layer group. |
| Transports en commun | Public transit | |
| réseau, ligne, arrêt, gare | network, line, stop, station | *line* for a GTFS route shown to readers. |
| horaire théorique, temps réel | scheduled time, real time | |
| retard, en avance | delay, early | |
| fréquence, intervalle | frequency, headway | |
| Réseau et fréquence IDFM (Paris) | IDFM network and frequency (Paris) | |
| Trafic routier | Road traffic | |
| bouchon, ralentissement | traffic jam, slowdown | |
| Comptages routiers | Traffic counts | |
| Événements routiers | Road events | |
| chantier, fermeture, déviation | roadworks, closure, detour | |
| État du réseau routier | Road network status | |
| Véhicules partagés, vélos en libre-service | Shared vehicles, bike share | |
| trottinette | e-scooter | |
| Pouls vélo (semaine type) | Cycling pulse (typical week) | |
| compteur vélo | bike counter | |
| Vols en direct, Vols militaires | Live flights, Military flights | |
| Aéroports | Airports | |
| Navires et ports, Ports | Ships and ports, Ports | |
| itinéraire | route | |
| PAN (point d’accès national) | national access point (PAN) | transport.data.gouv.fr. |
| créneau, semaine type | slot, typical week | |
| RRN non concédé | State-run national road network | |
| bornage (routes) | kilometer-post survey | |
| Aéroport à trafic régulier / sans trafic régulier | Scheduled-service airport / Airport without scheduled service | |
| Aérodrome & aéroclub | Airfield & flying club | |
| piste (aéroport) | runway | |
| enveloppe (isochrone), surface majorée | envelope, upper-bound area | |
| Durée maximale (isochrone) | Maximum time | How many of the 5/10/15-minute rings are drawn. |
| Surface cumulée | Cumulative area | Nested rings: the 15-minute area contains the 5-minute one. |
| Temps de trajet estimés | Estimated travel times | |
| expansion libre | free expansion | |
| jour ouvré type, week-end type | typical weekday, typical weekend | |
| semaine archivée, Mesuré, J-2 | archived week, Measured, D-2 | |
| arc (comptage) | link | |
| état barré / invalide | declared closed / declared invalid | |
| Pré-saturé | Near saturation | |
| Pendulaire / Nocturne / Continu | Commuter / Night / Steady | Traffic rhythms. |
| à l’estime | dead reckoning | AIS. |
| Plage OACI militaire | Military ICAO block | |
| Jet monocouloir / Gros-porteur | Narrow-body jet / Wide-body jet | |
| Type laissé vide à bord | Type left blank on board | |
| Identité pas encore reçue | Identity not received yet | |
| borne / place (libre-service) | dock / space | |
| VAE, Trottinette, Scooter | E-bike, E-scooter, Moped | |
| Fournisseurs (mobilité partagée), Tout afficher | Operators, Show all | The shared-mobility key. |
| bien remplie, à moitié, presque vide (station) | well stocked, half full, nearly empty | A dock's fill. |
| ville équipée, vue France (mobilité partagée) | city with a network, country view | The shared-mobility layer above 250 km: one label per place. |
| point de repère (PR) | kilometer post (PR) | |
| tige (bouée) | stem | |
| mer forte / grosse | Rough / High | WMO's own English. |

## Risks and environment

| French | English | Note |
|---|---|---|
| RISQUES & ENVIRONNEMENT | RISKS & ENVIRONMENT | Layer group. |
| Risques (Géorisques) | Risks (Géorisques) | |
| inondation, zone inondable | flooding, flood zone | |
| TRI (territoire à risque important d’inondation) | high flood-risk area (TRI) | |
| PPR, PPRI | risk prevention plan (PPR), flood risk prevention plan (PPRI) | |
| retrait-gonflement des argiles | clay shrink-swell | |
| zone de sismicité | seismic zone | |
| cavités souterraines, mouvements de terrain | underground cavities, ground movements | |
| ICPE | classified industrial facility (ICPE) | |
| site Seveso | Seveso site | |
| sites et sols pollués (SIS), CASIAS | contaminated sites (SIS), former industrial sites (CASIAS) | |
| Incendies | Fires | Layer name since 2026-09-23 (was *Feux actifs (FIRMS)*). |
| Détections récentes, Grands incendies | Recent detections, Major fires | The two mode tiles of *Incendies*. |
| Gironde · été 2026 | Gironde · summer 2026 | Layer name since 2026-09-23 (was *Mégafeu de Gironde (juil. 2026)*). |
| Chaleur vue par satellite | Heat seen by satellite | FIRMS detections, in plain words. |
| Progression du feu, étape, fin des détections, fin des relevés | Fire spread, stage, end of detections, end of the record | The replay bar. |
| Vue : Au sol, Temps en 3D | View: On the ground, Time in 3D | The two views of *Grands incendies* (2026-09-23). |
| strate, étage | layer, level | One stage of the fire floating at its height in *Temps en 3D*. |
| Plus haut = plus tard | Higher = later | What height means in *Temps en 3D*: the order of the stages, nothing else. |
| Séismes (24 h) | Earthquakes (24 h) | |
| Barrages & digues | Dams & levees | |
| bruit, carte de bruit | noise, noise map | |
| qualité de l’air | air quality | |
| Météo, Stations météo | Weather, Weather stations | |
| vigilance (Météo-France) | weather warning | |
| canicule | heatwave | |
| houle | swell | |
| Bouées marines | Marine buoys | |
| CIEL & MER | SKY & SEA | Layer group. |
| Missions spatiales, Satellites | Space missions, Satellites | |
| Contexte global | Global context | |
| Cours d’eau | Rivers (Vigicrues) | Layer name. |
| tronçon Vigicrues | river reach | |
| Stations Hub’Eau | Hub’Eau stations | |
| Bruit des aéroports, PEB (plan d’exposition au bruit) | Airport noise, noise exposure plan (PEB) | |
| gêne très forte / forte / modérée | very strong / strong / moderate nuisance | PEB zones. |
| Bruit & urbanisme | Noise & planning | The PEB tile of the « Aéroports » row, and the title of its card in the key. |
| Consulter le plan officiel | Open the official plan | The button to an airport's PEB arrêté. |
| PGS (plan de gêne sonore), insonorisation | noise nuisance plan (PGS), soundproofing | No longer drawn since 2026-09-24; the term survives in comments and in the data credits' history. |
| secteur bâti (Ah, Nh) | built pocket | Zoning. |
| houlographe | wave buoy | |
| poste (météo) | station | |
| fiche climatologique | climate summary sheet | |
| échéance | forecast horizon | |
| seuil, levée, digue d’étang | weir, levee, pond dyke | |
| obstacles à l’écoulement | obstacles to river flow | |
| point chaud, front de feu actif | hotspot, active fire front | |
| périmètre (brûlé) | burned perimeter | |
| colonne de fumée, panache | smoke column, plume | |
| photo-interprété | photo-interpreted | |
| puissance radiative | radiative power | FIRMS. |
| première / dernière détection | first / last detection | |
| houlographe, fiche climatologique | wave buoy, climate summary sheet | |
| détection (satellite), expertisé à J+1 | detection, quality-checked at D+1 | |
| indicatif OMM | WMO number | |
| pack RADOME / Étendu | RADOME / Extended pack | Météo-France station packs. |
| thermomètre sous abri | thermometer in a screen | |
| héliographe, célomètre, visibilimètre | sunshine recorder, ceilometer, visibility meter | |
| temps présent, nébulosité | present weather, cloud cover | |
| état de la mer | sea state | |
| gêne (PEB) | nuisance | |
| arrêté préfectoral | prefectoral order | |
| aérodrome | aerodrome | |
| foyer (séisme), secousse | focus, shaking | |
| séisme dévastateur / majeur / destructeur | devastating / major / destructive earthquake | |
| canopée, arbre remarquable | canopy, heritage tree | |

## Health, emergency services and education

| French | English | Note |
|---|---|---|
| Santé & secours | Health & emergency services | |
| FINESS | health facility register (FINESS) | |
| médecin généraliste | general practitioner (GP) | |
| pharmacie, officine | pharmacy | |
| urgences | emergency department | |
| centre de santé, maison de santé | health center, multidisciplinary health center | |
| APL (accessibilité potentielle localisée) | local GP accessibility (APL) | |
| désert médical | medical desert | |
| caserne de pompiers, SDIS | fire station, departmental fire service (SDIS) | |
| commissariat, gendarmerie | police station, gendarmerie | |
| défibrillateur | defibrillator (AED) | |
| Enseignement | Schools | Layer name. |
| école maternelle / élémentaire | preschool / elementary school | |
| collège, lycée | middle school, high school | |
| Enseignement supérieur | Higher education | |
| IPS (indice de position sociale) | social position index (IPS) | |
| éducation prioritaire (REP, REP+) | priority education network (REP, REP+) | |
| académie | education authority (académie) | |
| Accueil du jeune enfant, crèche | Early childcare, daycare | |
| conventionné secteur 1 / secteur 2 | under the health-insurance agreement, sector 1 / sector 2 | |
| exercice libéral | private practice | |
| CNAM, Assurance maladie | national health insurance fund (CNAM) | |
| assistante maternelle | childminder | |
| conventionné secteur 1 / 2 | under the health-insurance agreement, sector 1 / 2 | |
| tarif fixé (secteur 1) | set fee (sector 1) | |
| honoraires libres (secteur 2) | own fees (sector 2) | |
| dépassements plafonnés (OPTAM) | capped extra billing (OPTAM) | |
| zone sous-dotée / moyennement dotée / bien dotée | under-served / moderately served / well-served area | APL. |
| Base permanente des équipements (BPE) | Permanent database of amenities (BPE) | |

## Public safety, business and telecoms

| French | English | Note |
|---|---|---|
| Délinquance enregistrée | Recorded crime | |
| cambriolage | burglary | |
| vol avec violence | violent theft | |
| coups et blessures volontaires | assault | |
| Sites militaires | Military sites | |
| Caméras publiques | Public cameras | |
| SIRENE, SIREN, SIRET | SIRENE register, SIREN company number, SIRET establishment number | |
| entreprise, établissement | company, establishment | |
| BODACC | official commercial announcements (BODACC) | |
| DECP, marché public | public contract data (DECP), public contract | |
| acheteur, titulaire | buyer, contractor | |
| Équipements (BPE) | Amenities (BPE) | |
| Antennes mobiles | Mobile antennas | |
| Infrastructure numérique | Digital infrastructure | |
| Câbles sous-marins | Submarine cables | |
| fibre (FTTH) | fiber (FTTH) | |
| RÉSEAUX & CAPTEURS | NETWORKS & SENSORS | Layer group. |
| escroqueries | fraud | |
| dégradations | criminal damage | |
| Équipements du quotidien | Everyday amenities | Layer name. |
| Base aérienne / Base navale / Champ de tir / Terrain militaire | Air base / Naval base / Firing range / Military land | Military sites key. |
| support (ANFR), fût | support, shaft | A mast and everything on it. |
| relevé d’ondes, champ global | field measurement, total field | |
| azimut, faisceau | bearing, beam | |
| Techniquement opérationnel, Projet approuvé | Technically operational, Approved project | ANFR status. |
| 5G rapide / moyenne / basse | 5G high-band / mid-band / low-band | The rung, never a speed. |
| zone blanche (mobile) | dead zone | No operator reaches it, not even at limited coverage. One operator only is not a dead zone. |
| très bonne / bonne couverture, couverture limitée | very good / good / limited coverage | ARCEP's three levels. |
| couverture théorique (ARCEP) | simulated coverage (ARCEP) | The operators' own model, checked by ARCEP — never "measured". |
| Couverture 4G, Sans 4G, Par opérateur | 4G coverage, No 4G, By operator | The coverage tile and block of the key, and its two modes. |
| point d’atterrissement, station d’atterrissement | landing point, landing station | Where a submarine cable comes ashore (ARCEP's word). |
| Tracé publié, géométries illustratives | Published route, illustrative geometry | TeleGeography's schematic routes — never "the cable's path". |
| câbles associés (à un point d’atterrissement) | connected cables | The cables whose route reaches a landing point. |
| regroupement (de data centers) | group of sites | Several data centres merged into one mark because they share a spot on the screen. |
| sans teinte | left untinted | The class a coverage map leaves unpainted. |
| Mon réseau mobile | Mon réseau mobile | ARCEP dataset title, kept in French. |
| Direction relevée / non relevée | Direction mapped / not mapped | Public cameras. |

## Cartography and data

| French | English | Note |
|---|---|---|
| maille | spatial unit | The unit a value is aggregated on (IRIS, 200 m cell, municipality). |
| discrétisation | classification | Class breaks of a choropleth. |
| aplat | fill | |
| pastille | dot | |
| épingle (repère) | pin | The few vehicles of the shared fleets that wear their silhouette. |
| bulle, groupe (regroupement) | bubble, group | A count drawn for a cell of the proxy's grid, from the city-wide view. |
| tige de rappel | leader stem | The line from a raised label to its ground point. |
| faisceau | beam | |
| écrêtage | cap | |
| maillage (aminci) | (thinned) mesh | |
| emprise (d’un jeu, d’une couche) | extent | *Emprise au sol* stays *footprint*. |
| MNT (modèle numérique de terrain) | digital terrain model (MNT) | |
| millésime | vintage | The year edition of a dataset. |
| tirage (au sort) | draw | |
| palier (d’un barème) | plateau | |
| curseur (temps) | cursor | |
| repli (d’un panneau) | fold | |
| maillage (couche nationale amincie) | mesh | |
| brouillon, Écartés (jeu de données) | draft, Set aside | Dataset box. |
| relais (`/api/plug`) | relay | |

## Interface words

| French | English | Note |
|---|---|---|
| Couches | Layers | Tab and panel. |
| légende | legend | |
| tuile (d’un membre, dans la légende) | tile | A fused row's member switch in the key. |
| source, crédit, licence | source, credit, license | |
| Licence Ouverte | Licence Ouverte (Etalab Open License 2.0) | Name kept, glossed. |
| fond de carte | basemap | |
| Plan IGN | IGN map (Plan IGN) | |
| photoréaliste | photorealistic 3D | |
| JEUX BRANCHÉS | PLUGGED DATASETS | Layer group. |
| ＋ BRANCHER UN JEU DE DONNÉES | ＋ PLUG IN A DATASET | |
| ACTIF, CHARGEMENT, ÉTEINT | ON, LOADING, OFF | Layer status. |
| Zoomez pour voir | Zoom in to see | |
| Aucun résultat | No results | |
| Rechercher une adresse | Search an address | |
| Partager, Fermer, Ouvrir le globe | Share, Close, Open the globe | |
| non publié, non publiée | not published | |
| mesuré, estimé | measured, estimated | |
| À LA UNE, Toutes les couches | FEATURED, All layers | Phone chips. |
| Autour de moi, Zoomer ici | Around me, Zoom here | |
| Image fixe | Still image | |
| RADIOGRAPHIE, LOURD | X-RAY, HEAVY | Badges. |
| Recherche | Search | Tab. |
| Moyenne ouvrée, À cette heure | Weekday average, At this hour | |
| VENT, SEMAINE, Vélos, Le reste | WIND, WEEK, Bikes, Everything else | Chips. |
| CHERCHER, ANALYSER, BRANCHER | SEARCH, ANALYZE, PLUG IN | Dataset box steps. |
| brouillon, sélection | draft, shortlist | |
| volet A / B / C | part A / B / C | Of a piece of work. |
| n/m ACTIVES, Couches allumées | n/m ON, Layers switched on | Panel tally. |
| TOUT ÉTEINDRE | TURN EVERYTHING OFF | |
| Couverture :, vue rapprochée | Coverage:, close-up view | |
| instantané figé | fixed snapshot | |
| chargement…, jamais, à l’instant | loading…, never, just now | Freshness line. |
| nouvelle tentative dans N s | retrying in N s | |
| hors de cette vue, Aucune donnée dans cette vue | outside this view, No data in this view | |
| Zone non publiée | Unpublished area | |
| DÉGRADÉ, PÉRIMÉ, REPLI, INDISPONIBLE, INCERTAIN | DEGRADED, STALE, FALLBACK, UNAVAILABLE, UNCERTAIN | Fault states. Identical in both languages today; the French is the decision recorded here. |
| Plan Google, Plan IGN | Google map, IGN map | Basemap chips; brand names are not translated. |
| Nuit, NUIT | Night, NIGHT | The night-atlas visual preset (id `noir`). The other presets — NORMAL, CRT, NVG, FLIR, ANIME — are the same word in both languages. |
| Crépuscule, CRÉPUSCULE | Dusk, DUSK | The lighter night atlas (id `dusk`), brought by « Infrastructure numérique ». It replaced Snow on 2026-09-23. |
| (fond) imposé par | (map source) set by | « Satellite imposé par Infrastructure numérique » — the basemap a lit row holds. |
| Apparence, Réglages avancés | Appearance, Advanced settings | The top bar's panel on a desktop (`src/globeShell.js`); « Réglages avancés » holds the former AFFICHAGE panel. |
| Style de carte | Map style | The previews of the visual presets in Appearance. |
| Assombrissement des bords | Edge shading | The light corner falloff (`src/edgeShade.js`). Not the scope. |
| lunette | scope | The circular mask of the view (`src/scopeMask.js`), off by default since 2026-09-23. |
| Mesures techniques | Technical readouts | The HUD switch (altitude, sun, coordinates). |
| Vue épurée | Clean view | Hides every control. |
| Lieux récents, Grandes villes | Recent places, Major cities | The place search's menu. |
| Plus d’actions | More actions | The « … » menu of the top bar. |
| limites (d’une commune, d’un département, d’une région) | limits, outline | What a place search draws around an area it found. |
| Vue précédente | Previous view | The navigation bar's step back to the last framing (`src/globeNav.js`). |
| Vue du dessus | Top view | The camera looking straight down, heading kept. |
| Vue 2D, Vue 3D | 2D view, 3D view | 2D: flat map, north up, tilt locked. 3D: the camera tilts freely. |
| Remettre le nord en haut | Turn north up | The compass needle's action. |
| Zoomer, Dézoomer | Zoom in, Zoom out | |
| Réinitialiser | Reset | The navigation bar's return to the whole globe. |

## Panel chips and fused rows

One row per subject; a fused row carries a chip per source (`layerFusions.js`).

| French | English | Note |
|---|---|---|
| PLU & servitudes | PLU & easements | |
| Autorisations, Sur parcelle | Permits, On the parcel | |
| Estimer un bien, Mes comparables | Value a property, My comparables | |
| Écoles et lycées | Schools and high schools | |
| Anneau, Fiche | Ring, Report | |
| Vigilance | Warnings | Météo-France. |
| Registre EDF, Groupes RTE | EDF register, RTE units | « Groupes RTE » retired as a chip on 2026-09-21. |
| Réseau, Production | Grid, Output | Chips of *Réseau électrique et centrales*. |
| Véhicules en direct, Vélos en station | Live vehicles, Docked bikes | |
| Flottes partagées | Shared fleets | |
| Semaine type, Débit mesuré | Typical week, Measured flow | |
| État du réseau, Comptages · Paris | Network status, Counts · Paris | |
| Revenus, Délinquance | Income, Crime | |
| Câbles, Antennes | Cables, Antennas | |
| Civils / Militaires | Civil / Military | |
| Feux en cours | Active fires | Retired chip (2026-09-23): now *Détections récentes*. |
| Vélos et véhicules partagés | Bikes and shared vehicles | Layer name. |
| Paris intra-muros | Paris proper | |
| Paris et sa proche couronne | Paris and its inner suburbs | |

## The voice

| French | English | Note |
|---|---|---|
| Parler à Surplomb | Talk to Surplomb | The desktop mic button at rest, and the start of the mic button's screen-reader name (was « Contrôle vocal »). |
| Je vous écoute | Listening | The desktop card while the mic is open. |
| Surplomb répond | Surplomb is answering | |
| À vous | Your turn | A session is open and the mic is shut. |
| J’agis sur la carte… | Working on the map… | A tool is running. |
| Voix indisponible | Voice unavailable | |
| Demande d’accès au micro | Requesting microphone | While the browser asks for the mic. |
| Commande en cours | Running command | While a tool the voice called runs. |
| Arrêter ; Arrêter la conversation avec Surplomb | Stop; Stop the conversation with Surplomb | Ends the voice session. |
| Vous | You | Who said a line of the transcript; the other one is « Surplomb ». |
| Fermer le message d’erreur | Close the error message | |
| Aide vocale | Voice help | The `?` that opens the tray on a touchscreen. |
| Cliquez le micro ou maintenez Espace pour parler | Click the mic or hold Space to speak | Cursor. |
| Touchez le micro pour parler · il se referme seul | Tap the mic to speak · it closes itself | One request per tap. |
| Micro ou Espace pour parler | Mic or Space to speak | ~30 characters on the dock line. |
| Question ou commande | Ask or command | Caption of a live mic. |
| Commandes offertes utilisées | Free commands used up | The hosted trial, spent. |
| Modèle vocal, niveau du modèle vocal | Voice model, voice model tier | STD ↔ MINI. |
| Coût estimé de la session | Estimated session cost | |
| Écouter cette voix | Hear this voice | |
| L’autorisation du micro a été refusée | Microphone permission was denied | |
| Reconnaissance vocale | Speech recognition | The Web Speech API's ears. |
| Voix sans clé | Keyless voice | The browser-ears path, as opposed to Realtime. |
| Pas le micro : … | Not the microphone: … | Opens every unreachable-server line. |
| IA | AI | The mark on the mic and on the HUD summary (EU AI Act art. 50). Translated, unlike the instrument lettering: a disclosure is read in the reader's language. |
| Assistant d’intelligence artificielle — voix de synthèse | Artificial intelligence assistant — synthetic voice | The mic mark's tooltip. Names no vendor: the voice runs on OpenAI or OpenRouter. |
| Résumé rédigé par une intelligence artificielle | Summary written by artificial intelligence | The HUD summary mark's tooltip. |

Instrument lettering on the voice dock (`MIC`, `HEARD`, `STD`, `TOKEN LIMIT`)
and everything the model reads stay English in both languages, as the HUD does.

## Never translate

Proper nouns: organizations, datasets, services and brands. They stay exactly as
written, accents included, inside English text. Place names (communes,
departments, regions, rivers) follow the same rule without being listed here;
the detector recognizes them from the data. Items are separated by `·`, one
category per line. This list is mirrored in `src/i18n/glossary.js`.

- Product: Surplomb · Belvédère · God’s Eye View
- Public bodies: INSEE · IGN · Etalab · ADEME · BRGM · Cerema · Météo-France · SHOM · ANFR · ARCEP · DGAC · SSMSI · Géorisques · Géoportail · Géoportail de l’urbanisme · Géoplateforme · Ville de Paris · Eau de Paris · MENJ · DREES
- Networks and operators: RTE · Enedis · GRDF · GRTgaz · Teréga · ODRÉ · éCO2mix · SNCF · TER · TGV · RER · Transilien · Île-de-France Mobilités · IDFM · Vélib’ · Bison Futé
- Datasets and registers: data.gouv.fr · BD TOPO · BD ORTHO · LiDAR HD · Filosofi · Sitadel · FINESS · SIRENE · BODACC · DECP · CASIAS · CANDHIS · Licence Ouverte
- Places used as names: Île-de-France · Métropole de Lyon · Gironde
