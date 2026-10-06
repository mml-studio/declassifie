/**
 * English for the static markup of `index.html` — see src/i18n/markup.js.
 *
 * One entry per `data-i18n*` key used in the HTML. `fr` is the French the HTML
 * carries, whitespace collapsed; `markup.test.mjs` fails when the two drift.
 * Group keys by the part of the page they belong to (`loader.*`, `search.*`,
 * `firstRun.*`), and give a `note` wherever the English needs context the key
 * does not give — a button label out of context is the hardest string there is
 * to translate.
 *
 *     loader: {
 *       status: { fr: 'Initialisation du globe…', en: 'Starting the globe…' },
 *     },
 *
 * The landing page (`#vitrine`, the `vitrine.*` group) lives here too: it is
 * the same document. What it shows in one language only — the French
 * waitlist, the English credit — carries `data-locale-only` in the HTML and has
 * no key.
 *
 * WHAT IS NOT HERE. `<head>`: crawlers read the French; an English page takes
 * its title from src/boot.i18n.js. Values that are the same word in both
 * languages — a style name (NORMAL, CRT, NVG), a brand, a provider — carry
 * `translate="no"` in the HTML instead of a key they would only echo.
 */
import { defineMessages } from './messages.js';

export default defineMessages({
  overlay: {
    actions: {
      fr: 'Objets visibles sur la carte',
      en: 'Visible map targets',
      note: 'Region holding one button per object the world overlay has drawn, for readers who do not click the canvas.',
    },
  },
  title: {
    tagline: { fr: 'Aucun angle mort.', en: 'No blind spots.', note: 'The product’s slogan, under the logo.' },
  },
  // The mark in the corner of the globe is a link to the landing page, and
  // asks before it leaves (src/homeLink.js).
  home: {
    link: {
      fr: 'Surplomb — revenir à la page d’accueil',
      en: 'Surplomb — back to the home page',
      note: 'Accessible name and tooltip of the logo. “Home page” is the reader’s word for the landing page at /.',
    },
    kicker: { fr: 'SURPLOMB · ACCUEIL', en: 'SURPLOMB · HOME' },
    title: { fr: 'Revenir à la page d’accueil ?', en: 'Go back to the home page?' },
    body: {
      fr: 'Vous allez être redirigé vers la page d’accueil de Surplomb. Le bouton Retour du navigateur vous ramènera à cette vue du globe.',
      en: 'You will be taken to the Surplomb home page. Your browser’s Back button will bring you back to this view of the globe.',
      note: 'True because the share link is written into the address before leaving: Back reloads the globe on the same camera and layers.',
    },
    cancel: { fr: 'Annuler', en: 'Cancel' },
    confirm: { fr: 'Confirmer', en: 'Confirm', note: 'Leaves the globe for the home page.' },
  },
  // The place search at the top centre of a desktop (src/globeShell.js).
  placeSearch: {
    recents: { fr: 'Lieux récents', en: 'Recent places', note: 'Heading of the places this browser searched before.' },
    cities: { fr: 'Grandes villes', en: 'Major cities', note: 'Heading of the shortcuts to the largest French municipalities.' },
  },
  // The top bar and its « Apparence » panel (src/globeShell.js): map style,
  // base map and display settings, gathered in one place.
  // The navigation bar at the bottom centre of a desktop (src/globeNav.js).
  globeNav: {
    label: { fr: 'Navigation dans la vue', en: 'View navigation' },
    back: { fr: 'Vue précédente', en: 'Previous view', note: 'Steps back to the framing the camera had before the last move.' },
    backTitle: {
      fr: 'Revenir au cadrage d’avant le dernier déplacement',
      en: 'Go back to the framing before the last move',
    },
    top: { fr: 'Vue du dessus', en: 'Top view', note: 'Turns the camera until it looks straight down at the centre of the view.' },
    mode: { fr: 'Mode de vue', en: 'View mode', note: 'The 2D / 3D pair of buttons.' },
    flatTitle: {
      fr: 'Carte à plat : vue du dessus, nord en haut, inclinaison bloquée',
      en: 'Flat map: top view, north up, tilt locked',
    },
    reliefTitle: {
      fr: 'Vue en relief : la caméra s’incline librement',
      en: 'Relief view: the camera tilts freely',
    },
    north: { fr: 'Remettre le nord en haut', en: 'Turn north up', note: 'The compass needle button.' },
    zoom: { fr: 'Zoomer ou dézoomer', en: 'Zoom in or out' },
    zoomOut: { fr: 'Dézoomer', en: 'Zoom out' },
    zoomIn: { fr: 'Zoomer', en: 'Zoom in' },
  },
  appearance: {
    button: { fr: 'Apparence', en: 'Appearance' },
    buttonTitle: { fr: 'Style de carte, fond de carte et affichage', en: 'Map style, base map and display' },
    more: { fr: 'Plus d’actions', en: 'More actions', note: 'The « … » button: share, clear layers, locate, language.' },
    title: { fr: 'Apparence', en: 'Appearance' },
    close: { fr: 'Fermer le panneau Apparence', en: 'Close the Appearance panel' },
    styles: { fr: 'Style de carte', en: 'Map style' },
    edgeShade: {
      fr: 'Assombrissement des bords',
      en: 'Edge shading',
      note: 'A slider darkening the corners of the view, like a photographic vignette.',
    },
    hud: { fr: 'Mesures techniques', en: 'Technical readouts', note: 'Switches the HUD on: altitude, sun elevation, coordinates.' },
    hudHint: { fr: 'Altitude, soleil, coordonnées · touche H', en: 'Altitude, sun, coordinates · H key' },
    clean: { fr: 'Vue épurée', en: 'Clean view', note: 'Hides every control so only the globe is left.' },
    cleanHint: { fr: 'Masque toutes les commandes · touche V', en: 'Hides every control · V key' },
    advanced: { fr: 'Réglages avancés', en: 'Advanced settings' },
  },
  actions: {
    nav: { fr: 'Actions du globe', en: 'Globe actions' },
    clearLayers: { fr: 'Éteindre les couches sélectionnées', en: 'Clear selected data layers' },
    clearLayersTitle: { fr: 'Éteindre toutes les couches sélectionnées', en: 'Turn off all selected data layers' },
    share: { fr: 'Copier le lien de partage', en: 'Copy share link' },
    locate: { fr: 'Autour de moi', en: 'Around me' },
    locateTitle: { fr: 'Centrer la carte sur ma position', en: 'Center the map on my location' },
    resetGlobe: { fr: 'Réinitialiser : revenir au globe entier', en: 'Reset to full globe view', note: 'Starts with the visible label of the button in the navigation bar, « Réinitialiser » (« Reset »).' },
    resetGlobeTitle: {
      fr: 'Réinitialiser la caméra et revenir au globe entier',
      en: 'Reset camera and return to full globe view',
    },
    stopFollow: { fr: 'Ne plus suivre', en: 'Stop following', note: 'Releases the object the camera is tracking.' },
    stopFollowTitle: { fr: 'Ne plus suivre cet objet', en: 'Stop following this object' },
  },
  // The FR/EN switch names the language it goes TO, so a French page reads
  // “EN / English” and an English page reads “FR / Français”. That is why the
  // two languages of these leaves look swapped: they are.
  localeSwitch: {
    label: { fr: 'EN', en: 'FR', note: 'Two letters, the size of the icons beside it: the language this button switches to.' },
    action: {
      fr: 'English — passer en anglais',
      en: 'Français — switch to French',
      keep: ['Français'],
      note: 'Each label names the other language IN that language, which is how a reader who does not read this page recognizes it.',
    },
  },
  status: {
    loading: {
      fr: 'CHARGEMENT DES DONNÉES EN DIRECT',
      en: 'LOADING LIVE DATA',
      note: 'First state of the loading chip; src/loadingFeedback.js writes the ones that follow.',
    },
    trafficSync: {
      fr: 'synchronisation du réseau routier',
      en: 'syncing road network',
      note: 'Lower case on purpose: the traffic chip is a quiet progress line, not a headline.',
    },
    cctvSync: { fr: 'chargement des images', en: 'loading frames', note: 'Camera frames of the public-camera layer.' },
  },
  heading: {
    camera: { fr: 'Cap de la caméra', en: 'Camera heading', note: 'The compass tape above the globe.' },
  },
  // The first-person cockpit: an inherited aviation surface, so its French
  // keeps the flight vocabulary (cap, vitesse sol, contact) and its units
  // (KTS, FT, WX, MM) stay the symbols pilots read in both languages.
  cockpit: {
    view: { fr: 'Vue cockpit de l’avion', en: 'Aircraft cockpit view' },
    level: { fr: 'HORIZON', en: 'LEVEL', note: 'The wings-level mark of the artificial horizon.' },
    routeDirection: { fr: 'Direction estimée de la destination', en: 'Estimated destination direction' },
    opticalPlane: { fr: 'PLAN OPTIQUE · 01', en: 'OPTICAL PLANE · 01' },
    visorLock: { fr: 'VERROU DE VISIÈRE · ACTIF', en: 'VISOR LOCK · ACTIVE' },
    speedRim: { fr: 'VITESSE SOL · KTS', en: 'GROUND SPEED · KTS' },
    altitudeRim: { fr: 'ALTITUDE · FT', en: 'ALTITUDE · FT' },
    firstPerson: { fr: 'VUE PILOTE', en: 'FIRST PERSON' },
    callsign: { fr: 'AVION', en: 'AIRCRAFT', note: 'Stands in until the tracked aircraft gives a callsign.' },
    aircraftMeta: { fr: 'SUIVI EN DIRECT · CAP ALIGNÉ', en: 'LIVE TRACK · COURSE ALIGNED' },
    compass: { fr: 'Cap actuel de l’avion', en: 'Current aircraft heading' },
    groundSpeed: { fr: 'VITESSE SOL', en: 'GROUND SPEED' },
    altitude: { fr: 'ALTITUDE', en: 'ALTITUDE' },
    vision: {
      group: { fr: 'Style de vision du cockpit', en: 'Cockpit vision style' },
      previous: { fr: 'Style de vision précédent', en: 'Previous cockpit vision style' },
      previousTitle: { fr: 'Vision précédente', en: 'Previous vision style' },
      prevShort: { fr: 'PRÉC', en: 'PREV' },
      current: {
        fr: 'Style de vision actuel : NORMAL. Activer pour passer au suivant.',
        en: 'Current cockpit vision style: NORMAL. Activate for next style.',
        note: 'The style name is rewritten by src/ui.js; NORMAL is what the page ships with.',
      },
      currentTitle: { fr: 'Style actuel : NORMAL — cliquer pour le suivant', en: 'Current style: NORMAL — click for next' },
      currentShort: { fr: 'ACTUEL', en: 'CURRENT' },
      next: { fr: 'Style de vision suivant', en: 'Next cockpit vision style' },
      nextTitle: { fr: 'Vision suivante', en: 'Next vision style' },
      nextShort: { fr: 'SUIV', en: 'NEXT' },
    },
    context: {
      summary: { fr: 'Résumé des contacts', en: 'Contact cockpit summary' },
      kicker: { fr: 'CONTACT', en: 'CONTACT' },
      subject: { fr: 'CONTACTS · 250 KM', en: 'CONTACTS · 250 KM' },
      nav: { fr: 'Navigation entre les contacts', en: 'Contact navigation' },
      previous: {
        fr: 'Précédent — contact déjà visité dans la fenêtre de 250 km',
        en: 'Previous — prior visited contact in the 250 km window',
      },
      next: {
        fr: 'Suivant — contact le plus proche jamais visité dans la fenêtre de 250 km',
        en: 'Next — nearest unvisited contact in the 250 km window',
      },
      collapse: { fr: 'Replier le panneau Contacts', en: 'Collapse Contact panel' },
      collapseTitle: { fr: 'Replier le panneau des contacts', en: 'Collapse contact panel' },
      qualifier: {
        fr: 'CONTEXTE SEUL',
        en: 'CONTEXT ONLY',
        note: 'Warns that the panel counts what the feeds published, not everything that is there.',
      },
      cohorts: { fr: 'Effectifs à proximité', en: 'Nearby cohort counts' },
      cohortFlights: { fr: 'VOL', en: 'FLT', note: 'Short for flights; MIL, AIS and SITE read the same in French.' },
      nearest: { fr: 'LE PLUS PROCHE OBSERVÉ / CARTOGRAPHIÉ', en: 'NEAREST OBSERVED / MAPPED' },
      noExample: { fr: 'AUCUN EXEMPLE DISPONIBLE', en: 'NO AVAILABLE EXAMPLE' },
      uncertainty: {
        fr: 'ENTRÉES DISPONIBLES SEULEMENT · PAS UN FEU VERT',
        en: 'AVAILABLE INPUTS ONLY · NOT AN ALL-CLEAR',
        note: 'Says the count is what the feeds report, and that an empty panel proves nothing.',
      },
    },
    weather: {
      enable: { fr: 'Activer les effets météo du cockpit', en: 'Enable cockpit weather effects' },
      off: { fr: 'ÉTEINT', en: 'OFF' },
    },
    route: {
      plan: { fr: 'Plan de vol estimé', en: 'Estimated flight plan' },
      kicker: { fr: 'PLAN DE VOL ESTIMÉ', en: 'ESTIMATED FLIGHT PLAN' },
      unavailable: { fr: 'DONNÉES D’ITINÉRAIRE INDISPONIBLES', en: 'ROUTE DATA UNAVAILABLE' },
      from: { fr: 'DE', en: 'FROM' },
      to: { fr: 'VERS', en: 'TO' },
      unknown: { fr: 'INCONNU', en: 'UNKNOWN', note: 'Airport not resolved yet.' },
    },
    brief: {
      carousel: { fr: 'Carrousel de briefing du cockpit', en: 'Cockpit briefing carousel' },
      signals: { fr: 'SIGNAUX EN DIRECT', en: 'LIVE SIGNALS' },
      signalsSubtitle: { fr: 'ÉCHOS OBSERVÉS / CARTOGRAPHIÉS', en: 'OBSERVED / MAPPED PINGS' },
      controls: { fr: 'Commandes du briefing', en: 'Cockpit briefing controls' },
      previous: { fr: 'Page de briefing précédente', en: 'Previous briefing page' },
      next: { fr: 'Page de briefing suivante', en: 'Next briefing page' },
      cycleOff: { fr: 'DÉFILEMENT ÉTEINT', en: 'CYCLE OFF' },
      cycleTitle: {
        fr: 'Fait défiler les pages du briefing toutes les 9 secondes (Signaux → Actualités → Local). En pause tant que le pointeur ou le clavier est sur le panneau. Les signaux en direct se rafraîchissent dans tous les cas.',
        en: 'Cycle briefing pages automatically every 9 seconds (Signals → News → Local). Pauses while you hover or focus the panel. Live signal data refreshes continuously either way.',
      },
      collapse: { fr: 'Replier le panneau de briefing du cockpit', en: 'Collapse cockpit briefing panel' },
      collapseTitle: { fr: 'Replier le panneau de briefing', en: 'Collapse briefing panel' },
      signalsPage: { fr: 'Signaux en direct', en: 'Live signals' },
      newsPage: { fr: 'Dernières actualités régionales', en: 'Latest regional news' },
      newsAcquiring: { fr: 'RÉCUPÉRATION DES ACTUALITÉS RÉGIONALES', en: 'ACQUIRING REGIONAL NEWS' },
      localPage: { fr: 'Informations sur le lieu', en: 'Location-based information' },
      sourceNote: {
        fr: 'ÉVÉNEMENTS SOURCÉS · AUCUNE ACTUALITÉ SYNTHÉTIQUE',
        en: 'SOURCE-BACKED EVENTS · NO SYNTHETIC NEWS',
      },
      pages: { fr: 'Pages du briefing', en: 'Cockpit briefing pages' },
      showSignals: { fr: 'Afficher les signaux en direct', en: 'Show Live Signals' },
      showNews: { fr: 'Afficher les actualités régionales', en: 'Show Regional News' },
      showLocal: { fr: 'Afficher les infos locales', en: 'Show Local Info' },
      signalsTab: { fr: 'SIG', en: 'SIG', note: 'Tab of the briefing carousel; the abbreviation is the same word in French.' },
      newsTab: { fr: 'ACTU', en: 'NEWS' },
      localTab: { fr: 'LOCAL', en: 'LOCAL' },
    },
    local: {
      resolving: { fr: 'IDENTIFICATION DE LA RÉGION', en: 'RESOLVING REGION' },
      wind: { fr: 'VENT', en: 'WIND' },
      sky: { fr: 'CIEL', en: 'SKY' },
      unknown: { fr: 'INCONNU', en: 'UNKNOWN', note: 'Sky condition not published.' },
      precip: { fr: 'PRÉCIP', en: 'PRECIP' },
      credit: { fr: 'Données météo par Open-Meteo.com', en: 'Weather data by Open-Meteo.com' },
    },
    utility: {
      group: { fr: 'Affichage du cockpit et commandes Radio', en: 'Cockpit display and Radio controls' },
      display: { fr: 'AFFICHAGE', en: 'DISPLAY' },
      displayExpand: { fr: 'Déplier les options d’affichage du cockpit', en: 'Expand Cockpit display options' },
      displayOptions: { fr: 'Options d’affichage du cockpit', en: 'Cockpit display options' },
      radioExpand: { fr: 'Déplier les commandes Radio du cockpit', en: 'Expand Cockpit Radio controls' },
      radioCompact: { fr: 'Commandes Radio compactes du cockpit', en: 'Cockpit compact Radio controls' },
      radioVolume: { fr: 'Volume de la Radio du cockpit', en: 'Cockpit Radio volume' },
    },
    help: {
      exit: { fr: 'ÉCHAP QUITTER', en: 'ESC EXIT', note: 'Keyboard hint at the bottom of the cockpit.' },
      toggle: { fr: 'C BASCULER', en: 'C TOGGLE' },
    },
  },
  // The radio companion: the same three controls appear in the cockpit, in the
  // Context rail and in the full panel, so they share one group of keys.
  radio: {
    ready: { fr: 'PRÊTE', en: 'READY' },
    enable: { fr: 'ACTIVER', en: 'ENABLE' },
    previousStation: { fr: 'Station précédente parmi les stations filtrées', en: 'Previous filtered radio station' },
    playStation: { fr: 'Lire la station sélectionnée', en: 'Play selected radio station' },
    nextStation: { fr: 'Station suivante parmi les stations filtrées', en: 'Next filtered radio station' },
    previousShort: { fr: 'Station précédente', en: 'Previous station' },
    playShort: { fr: 'Lire', en: 'Play' },
    nextShort: { fr: 'Station suivante', en: 'Next station' },
    play: { fr: 'LIRE', en: 'PLAY' },
    stop: { fr: 'STOP', en: 'STOP', note: 'The transport button; the word is the same in French.' },
    stopAria: { fr: 'Arrêter la lecture radio', en: 'Stop radio playback' },
    radioReady: { fr: 'RADIO PRÊTE', en: 'RADIO READY' },
    openCompact: { fr: 'Ouvrir les commandes Radio compactes', en: 'Open compact Radio controls' },
    closeCompact: { fr: 'Fermer les commandes Radio compactes', en: 'Close compact Radio controls' },
    compactGroup: { fr: 'Commandes Radio compactes', en: 'Compact Radio controls' },
    compactVolume: { fr: 'Volume de la Radio compacte', en: 'Compact Radio volume' },
    openDetailed: { fr: 'Ouvrir les commandes Radio détaillées', en: 'Open detailed Radio controls' },
    panel: { fr: 'Radio internet', en: 'Internet radio companion' },
    stateOff: { fr: 'ÉTEINTE', en: 'OFF', note: 'The radio layer’s state chip, next to the panel title.' },
    expand: { fr: 'Déplier la Radio', en: 'Expand Radio' },
    expandSection: { fr: 'Déplier la section Radio', en: 'Expand Radio section' },
    stationTag: { fr: 'ÉTIQUETTE DE STATION', en: 'STATION TAG', note: 'Radio Browser’s own word for a station’s genre tag.' },
    filterAria: { fr: 'Filtrer les stations par étiquette', en: 'Filter stations by station tag' },
    filterAll: { fr: 'Toutes', en: 'All' },
    noStation: { fr: 'AUCUNE STATION SÉLECTIONNÉE', en: 'NO STATION SELECTED' },
    noStationHint: {
      fr: 'Activez la Radio, puis choisissez un repère sur le globe ou passez à la suivante.',
      en: 'Enable Radio, then choose a globe marker or use next.',
    },
    band: { fr: 'BANDE DE L’ANNUAIRE', en: 'DIRECTORY BAND' },
    dragToTune: { fr: 'GLISSER POUR ACCORDER', en: 'DRAG TO TUNE' },
    tuneAria: { fr: 'Accorder les stations de radio disponibles', en: 'Tune available internet radio stations' },
    tunerAll: { fr: 'TOUTES · GLISSER L’AIGUILLE', en: 'ALL · DRAG THE NEEDLE' },
    tunerSnaps: { fr: 'S’ACCROCHE AUX STATIONS DISPONIBLES', en: 'SNAPS TO AVAILABLE STATIONS' },
    playback: { fr: 'Lecture radio', en: 'Radio playback' },
    volume: { fr: 'Volume de la radio', en: 'Radio volume' },
    playbackOff: { fr: 'Radio éteinte', en: 'Radio off' },
    stationSite: { fr: 'SITE DE LA STATION', en: 'STATION SITE' },
    directory: { fr: 'ANNUAIRE : RADIO BROWSER', en: 'DIRECTORY: RADIO BROWSER' },
    privacy: {
      fr: 'Le son vient directement du diffuseur dès que vous appuyez sur Lire. Votre adresse IP lui est visible.',
      en: 'Audio connects directly to the broadcaster after you press play. Your IP is visible to that broadcaster.',
    },
  },
  // Panels share one collapse button, so they share its two strings.
  panel: {
    collapse: { fr: 'Replier le panneau', en: 'Collapse panel' },
    expand: { fr: 'Déplier le panneau', en: 'Expand panel' },
  },
  // The DISPLAY tray, top right: render switches, not data.
  display: {
    title: { fr: 'AFFICHAGE', en: 'DISPLAY' },
    hudTitle: { fr: 'HUD d’analyse (H)', en: 'Intelligence HUD (H)', note: 'H is the keyboard shortcut.' },
    layout: { fr: 'Disposition', en: 'Layout' },
    layoutAria: { fr: 'Disposition du HUD', en: 'HUD layout' },
    layoutTactical: { fr: 'Tactique', en: 'Tactical' },
    layoutOperator: { fr: 'Opérateur', en: 'Operator' },
    layoutMinimal: { fr: 'Minimal', en: 'Minimal' },
    detection: { fr: 'Surcouche de détection', en: 'Detection overlay' },
    detectionTitle: { fr: 'Surcouche de détection (D)', en: 'Detection Overlay (D)' },
    detectShort: { fr: 'DÉTECT', en: 'DETECT' },
    density: { fr: 'Densité', en: 'Density' },
    densityAria: { fr: 'Densité des étiquettes de détection', en: 'Detection label density' },
    allocation: { fr: 'Allocation', en: 'Allocation', note: 'How the overlay hands its label slots out.' },
    allocationAria: { fr: 'Allocation des étiquettes de détection', en: 'Detection label allocation' },
    allocationElastic: { fr: 'Élastique', en: 'Elastic' },
    allocationWeighted: { fr: 'Pondérée', en: 'Weighted' },
    fade: { fr: 'Fondu', en: 'Fade' },
    fadeAria: { fr: 'Distance de fondu de la détection', en: 'Detection fade distance' },
    fadeTitle: {
      fr: 'Distance de fondu de la surcouche hors de la lunette, en pourcentage de son rayon',
      en: 'World-overlay fade distance outside the keyhole as a percentage of its radius',
      note: 'The keyhole is the circular scope mask; French calls it « la lunette », as the visual identity does.',
    },
    outside: { fr: 'Au-dehors', en: 'Outside' },
    outsideAria: { fr: 'Opacité de la détection hors de la lunette', en: 'Detection opacity outside the keyhole' },
    outsideTitle: {
      fr: 'Opacité des étiquettes et des fiches de la surcouche au-delà de la distance de fondu',
      en: 'World-overlay label and card opacity beyond the fade distance',
    },
    parameters: { fr: 'PARAMÈTRES', en: 'PARAMETERS' },
    models3dTitle: {
      fr: 'Avions 3D — icônes plates de loin, modèles 3D de près',
      en: '3D aircraft — flat icons zoomed out, 3D models up close',
    },
    models: { fr: 'Modèles', en: 'Models' },
    modelsAria: { fr: 'Couverture des modèles 3D', en: '3D model coverage' },
    modelsProximity: { fr: 'Proximité', en: 'Proximity' },
    modelsAll: { fr: 'Tous', en: 'All' },
    scope: { fr: 'Lunette', en: 'Scope' },
    scopeTitle: { fr: 'Lunette — le masque circulaire de la vue', en: 'Scope — the circular viewport mask' },
    feather: { fr: 'Adoucissement', en: 'Feather' },
    featherTitle: {
      fr: 'Adoucissement du bord de la lunette, en pourcentage de son rayon',
      en: 'Scope edge feather as a percentage of the keyhole radius',
    },
    celestial: { fr: 'Céleste', en: 'Celestial' },
    celestialTitle: { fr: 'Anneau céleste — révéler le globe entier', en: 'Celestial ring — reveal the full globe' },
    lite: { fr: 'Léger', en: 'Lite' },
    liteTitle: {
      fr: 'Rendu léger — moins d’échantillons par pixel et moins de pixels quand la caméra bouge. Même carte, mêmes données.',
      en: 'Lite render — fewer samples per pixel and fewer pixels while the camera moves. Same map, same data.',
    },
    clean: { fr: 'Vue épurée', en: 'Clean UI', note: 'Hides every panel so the globe can be recorded.' },
    cleanTitle: { fr: 'Masquer l’interface', en: 'Hide UI chrome' },
    cleanExit: { fr: 'QUITTER LA VUE ÉPURÉE', en: 'EXIT CLEAN VIEW' },
    cleanExitTitle: { fr: 'Rendre les commandes', en: 'Return UI controls' },
    sharpen: { fr: 'Netteté', en: 'Sharpen' },
    sharpenTitle: { fr: 'Netteté', en: 'Sharpening' },
  },
  // Words several panels share, so that PREV and NEXT read the same way
  // wherever they appear.
  common: {
    prev: { fr: 'PRÉC', en: 'PREV' },
    next: { fr: 'SUIV', en: 'NEXT' },
  },
  layers: {
    title: { fr: 'COUCHES', en: 'DATA LAYERS', note: 'Header of the left panel listing every layer.' },
  },
  // Public cameras. French says « caméras »: the product never calls them
  // surveillance, and CCTV is not a word a French reader reads (GLOSSARY).
  cctv: {
    title: { fr: 'CAMÉRAS', en: 'CCTV' },
    lightboxTitle: { fr: 'CAMÉRA', en: 'CCTV', note: 'Title bar of the full-resolution camera view: one camera.' },
    lightboxClose: { fr: 'Fermer la vue pleine résolution (Échap)', en: 'Close full-resolution view (Escape)' },
    escClose: { fr: 'ÉCHAP ✕', en: 'ESC ✕' },
    openFull: { fr: 'Ouvrir l’image de la caméra en pleine résolution', en: 'Open the camera frame at full resolution' },
    openFullTitle: { fr: 'Cliquer pour voir en pleine résolution', en: 'Click to view at full resolution' },
    frameAlt: { fr: 'Image du flux de la caméra', en: 'CCTV feed frame' },
    expand: { fr: 'AGRANDIR', en: 'EXPAND' },
    sourceUnknown: { fr: 'SOURCE · INCONNUE', en: 'SOURCE · UNKNOWN' },
    enableToLoad: {
      fr: 'Activez les caméras pour charger les carrefours équipés',
      en: 'Enable CCTV to load camera intersections',
    },
    off: { fr: 'CAMÉRAS ÉTEINTES', en: 'CCTV OFF' },
    nearest: { fr: 'LA PLUS PROCHE', en: 'NEAREST' },
    cameraSelect: { fr: 'Caméra', en: 'CCTV camera' },
    focus: { fr: 'CADRER', en: 'FOCUS', note: 'Points the camera at what the globe is showing.' },
    coverageOff: { fr: 'COUVERTURE ÉTEINTE', en: 'COVERAGE OFF' },
    autoHopOff: { fr: 'SAUT AUTO ÉTEINT', en: 'AUTO HOP OFF' },
    projectionOn: { fr: 'PROJECTION ACTIVE', en: 'PROJECTION ON' },
    calibration: { fr: 'CALIBRAGE', en: 'CALIBRATION' },
    adjust: { fr: 'RÉGLER', en: 'ADJUST' },
    adjustTitle: {
      fr: 'Faites glisser la caméra dans le monde : les anneaux tournent, les flèches déplacent, les poignées règlent la portée et le champ',
      en: 'Drag the camera in the world: rings rotate, arrows move, handles set range/FOV',
    },
    pose: { fr: 'Pose de la caméra — cliquer une valeur pour la saisir', en: 'Camera pose — click a value to type' },
    cal: {
      heading: { fr: 'CAP --', en: 'HDG --' },
      headingTitle: { fr: 'Cap (° boussole) — cliquer pour saisir', en: 'Heading (compass °) — click to type' },
      pitch: { fr: 'TANGAGE --', en: 'PITCH --' },
      pitchTitle: { fr: 'Tangage (° haut/bas) — cliquer pour saisir', en: 'Pitch (° up/down) — click to type' },
      fov: { fr: 'CHAMP --', en: 'FOV --' },
      fovTitle: { fr: 'Champ horizontal (°) — cliquer pour saisir', en: 'Horizontal FOV (°) — click to type' },
      range: { fr: 'PORTÉE --', en: 'RANGE --' },
      rangeTitle: {
        fr: 'Portée / distance du plan de projection (m) — cliquer pour saisir',
        en: 'Range / monitor-plane distance (m) — click to type',
      },
      height: { fr: 'HAUT --', en: 'HGT --' },
      heightTitle: {
        fr: 'Hauteur de fixation au-dessus du sol (m) — cliquer pour saisir',
        en: 'Mount height above ground (m) — click to type',
      },
      north: { fr: 'ΔN --', en: 'ΔN --' },
      northTitle: {
        fr: 'Décalage nord par rapport à la position du catalogue (m) — cliquer pour saisir',
        en: 'North offset from catalog position (m) — click to type',
      },
      east: { fr: 'ΔE --', en: 'ΔE --' },
      eastTitle: {
        fr: 'Décalage est par rapport à la position du catalogue (m) — cliquer pour saisir',
        en: 'East offset from catalog position (m) — click to type',
      },
    },
    saveCal: { fr: 'ENREGISTRER', en: 'SAVE CAL' },
    resetCal: { fr: 'RÉINITIALISER', en: 'RESET CAL' },
    timelapsePause: { fr: 'Mettre l’accéléré en pause', en: 'Pause the timelapse' },
    timelapseScrub: { fr: 'Moment affiché dans l’accéléré', en: 'Moment shown in the timelapse' },
    key: {
      fr: 'Chaque cône montre ce que filme une caméra ; en pointillé, sa direction est inconnue.',
      en: 'Each cone shows what a camera films; dashed, its direction is unknown.',
      note: 'The map key for the camera cones, shown inside the camera panel instead of the map legend.',
    },
    sceneSummary: { fr: 'RÉSUMÉ DE SCÈNE', en: 'SCENE SUMMARY' },
    summaryIdle: {
      fr: 'Activez les caméras pour obtenir des résumés liés à la caméra.',
      en: 'Enable CCTV to start camera-linked intelligence summaries.',
    },
  },
  scenes: {
    title: { fr: 'SCÈNES', en: 'SCENES', note: 'Camera-move recorder, for making videos of the globe.' },
    recipe: { fr: 'Recette de scène', en: 'Scene recipe' },
    new: { fr: 'NOUVELLE', en: 'NEW' },
    delete: { fr: 'SUPPR', en: 'DEL' },
    capture: { fr: 'CAPTURER UN PLAN', en: 'CAPTURE SHOT' },
    updateShot: { fr: 'METTRE À JOUR LE PLAN', en: 'UPDATE SHOT' },
    start: { fr: 'DÉMARRER', en: 'START' },
    stop: { fr: 'ARRÊTER', en: 'STOP' },
    next: { fr: 'SUIVANT', en: 'NEXT' },
    export: { fr: 'EXPORTER', en: 'EXPORT PRESETS' },
    import: { fr: 'IMPORTER', en: 'IMPORT' },
    runLog: { fr: 'JOURNAL', en: 'RUN LOG' },
    ready: { fr: 'Prêt', en: 'Ready' },
  },
  legend: {
    aria: { fr: 'Légende de la carte', en: 'Map legend' },
    title: { fr: 'LÉGENDE', en: 'LEGEND' },
    collapse: { fr: 'Replier la légende', en: 'Collapse Legend' },
  },
  context: {
    title: { fr: 'CONTEXTE', en: 'CONTEXT' },
    mode: { fr: 'Mode du contexte', en: 'Context mode' },
    contacts: { fr: 'CONTACTS', en: 'CONTACTS' },
    contactsTitle: {
      fr: 'Parcourt les contacts les plus proches du type choisi — avions, navires, installations. Les satellites se suivent à part.',
      en: 'Cycles the nearest contacts of whatever type you select — planes, vessels, installations. Satellites track independently.',
    },
    missions: { fr: 'MISSIONS SPATIALES', en: 'SPACE MISSIONS' },
    selectContext: { fr: 'CHOISIR UN CONTEXTE', en: 'SELECT CONTEXT' },
    standbyContacts: { fr: 'CONTACTS — avions · navires · sites les plus proches', en: 'CONTACTS — nearest planes · vessels · sites' },
    standbyMissions: { fr: 'MISSIONS SPATIALES — lancements et objets en orbite', en: 'SPACE MISSIONS — launches & orbital assets' },
    actions: { fr: 'Actions du contexte Contacts', en: 'Contact Context actions' },
    showRoute: { fr: 'AFFICHER L’ITINÉRAIRE', en: 'SHOW ROUTE' },
    showRouteTitle: {
      fr: 'Reculer pour tenir le départ et l’arrivée du vol suivi dans une seule vue, et tracer son plan de vol estimé',
      en: 'Pull back to hold the tracked flight’s origin and destination in one view, and draw its estimated flight plan',
    },
    tr3b: { fr: 'Reclasser le contact suivi en TR-3B', en: 'Reclassify tracked contact as TR-3B' },
    tr3bTitle: { fr: 'Reclasser en TR-3B', en: 'Reclassify as TR-3B' },
    contactsOff: { fr: 'CONTEXTE CONTACTS ÉTEINT', en: 'CONTACTS CONTEXT OFF' },
    contactsOffHint: {
      fr: 'CHOISIR CONTACTS POUR CHARGER LA PROXIMITÉ OBSERVÉE / CARTOGRAPHIÉE',
      en: 'SELECT CONTACTS TO LOAD OBSERVED / MAPPED PROXIMITY',
    },
  },
  missions: {
    available: { fr: 'Missions spatiales disponibles', en: 'Available Space Missions' },
    availableTitle: { fr: 'MISSIONS DISPONIBLES', en: 'AVAILABLE MISSIONS' },
    selectHint: { fr: 'CHOISIR UNE MISSION À INSPECTER', en: 'SELECT A MISSION TO INSPECT' },
    loading: { fr: 'CHARGEMENT DE L’INDEX DES MISSIONS SUR 30 JOURS', en: 'LOADING 30-DAY MISSION INDEX' },
  },
  dock: {
    label: { fr: 'Navigation, voix et styles visuels', en: 'Navigation, voice, and visual preset controls' },
  },
  presets: {
    title: { fr: 'STYLES VISUELS', en: 'VISUAL PRESETS' },
    expand: { fr: 'Déplier les styles visuels', en: 'Expand Visual Presets' },
    pin: { fr: 'Épingler les styles visuels', en: 'Pin visual presets' },
    pinTitle: { fr: 'Garder les styles visuels ouverts', en: 'Keep visual presets open' },
    styleLabel: { fr: 'Style', en: 'Style' },
    night: {
      fr: 'Nuit',
      en: 'Night',
      note: 'Button of the night-atlas preset: dark basemap, data in full colour. Its neighbours are CRT, NVG, FLIR — keep it one short word.',
    },
    dusk: {
      fr: 'Crépuscule',
      en: 'Dusk',
      note: 'Button of the lighter night atlas: the basemap dimmed less than at night. Brought by the digital infrastructure row.',
    },
  },
  mapSource: {
    title: { fr: 'FOND DE CARTE', en: 'MAP SOURCE' },
    group: { fr: 'Fond de carte', en: 'Map source' },
  },
  location: {
    title: { fr: 'LIEU', en: 'LOCATION' },
    miniCity: { fr: '📍 Lieu : --', en: '📍 Location: --', note: 'Line one of the collapsed LOCATION tray, before any flight.' },
    miniPoi: { fr: 'Point de repère : --', en: 'Landmark: --' },
    pin: { fr: 'Épingler le panneau Lieu', en: 'Pin location tray' },
    pinTitle: { fr: 'Garder le panneau Lieu ouvert', en: 'Keep location tray open' },
  },
  search: {
    any: { fr: 'Rechercher un lieu', en: 'Search any location' },
    placeholder: { fr: 'Rechercher un lieu…', en: 'Search any location…' },
    submit: { fr: 'Rechercher', en: 'Search' },
  },
  // The phone shell: the bottom sheet, its four tabs, and the basemap sheet
  // behind its own round button.
  phone: {
    sheet: { fr: 'Panneau téléphone', en: 'Phone panel' },
    grip: { fr: 'Glissez pour redimensionner le panneau', en: 'Drag to resize the panel' },
    tabs: { fr: 'Onglets du panneau', en: 'Panel tabs' },
    tabSearch: { fr: 'Recherche', en: 'Search' },
    tabLayers: { fr: 'Couches', en: 'Layers' },
    tabLegend: { fr: 'Légende', en: 'Legend' },
    tabSelection: { fr: 'Sélection', en: 'Selection', note: 'The card of whatever the reader last tapped.' },
    chips: { fr: 'Couches en un geste', en: 'One-tap layers' },
    basemapChange: { fr: 'Changer le fond de carte', en: 'Change the basemap' },
    basemapTitle: { fr: 'Fond de carte', en: 'Basemap' },
    basemapClose: { fr: 'Fermer le choix du fond de carte', en: 'Close the basemap picker' },
  },
  // The first-visit card. Three variants (A address, B three questions,
  // C a bubble on the search field) live in templates; src/firstRunVariants.js
  // clones one of them into the shell.
  firstRun: {
    kicker: { fr: 'SURPLOMB · PREMIÈRE VISITE', en: 'SURPLOMB · FIRST VISIT' },
    escClose: { fr: 'Échap pour fermer', en: 'Esc to close' },
    status: {
      fr: '59 couches de données publiques · 56 sans clé',
      en: '59 public data layers · 56 need no key',
      note: 'The two numbers the README and the page description carry; keep them in step.',
    },
    a: {
      title: { fr: 'Qu’est-ce qui est vrai à cette adresse ?', en: 'What is true at this address?' },
      description: {
        fr: 'Ce que les voisins ont payé, ce qui se construit au bout de la rue, l’école, le bruit, le risque. Tout vient de registres publics.',
        en: 'What the neighbors paid, what is going up down the street, the school, the noise, the risk. All of it from public registers.',
      },
      addressAria: { fr: 'Adresse, commune ou lieu', en: 'Address, municipality or place' },
      addressPlaceholder: { fr: 'Une adresse, une commune, un lieu…', en: 'An address, a municipality, a place…' },
      submit: { fr: 'Voir', en: 'Go', note: 'Submits the address field; the camera flies there.' },
      try: { fr: 'Essayer :', en: 'Try:' },
      lookAround: { fr: 'Regarder autour d’ici sans rien taper', en: 'Look around here without typing' },
    },
    b: {
      title: { fr: 'Par où commencer ?', en: 'Where do I start?' },
      description: {
        fr: 'Vous survolez Paris. Choisissez une question : les couches s’allument ici, sans bouger.',
        en: 'You are over Paris. Pick a question: the layers switch on right here, without moving.',
      },
      salesTitle: { fr: 'Ce que les voisins ont payé', en: 'What the neighbors paid' },
      salesSub: { fr: 'Ventes DVF et parcelle exacte, 5 ans', en: 'Property sales (DVF) and the exact parcel, 5 years' },
      permitsTitle: { fr: 'Ce qui se construit', en: 'What is going up' },
      permitsSub: { fr: 'Permis accordés, chantiers ouverts (Sitadel)', en: 'Granted permits, open sites (Sitadel)' },
      liveTitle: { fr: 'Ce qui bouge maintenant', en: 'What is moving right now' },
      liveSub: { fr: 'Trafic, bus en direct, avions au-dessus', en: 'Traffic, live buses, planes overhead' },
      exploreTitle: { fr: 'Je regarde par moi-même', en: 'I’ll look around myself' },
      exploreSub: { fr: 'Rester ici, rien d’autre ne s’allume', en: 'Stay here, nothing else switches on' },
    },
    c: {
      title: { fr: 'Première visite ? Tapez une adresse ici.', en: 'First time? Type an address here.' },
      body: { fr: 'Ce qui s’est vendu, ce qui se construit, l’école, le risque.', en: 'What sold, what is going up, the school, the risk.' },
      chip: { fr: '59 couches · 56 sans clé', en: '59 layers · 56 need no key' },
    },
  },
  // What a territorial layer says when the camera is outside its coverage.
  coverage: {
    kicker: { fr: 'COUVERTURE DE LA COUCHE', en: 'LAYER COVERAGE' },
    goto: { fr: 'Aller à la zone couverte', en: 'Go to the covered area' },
    here: { fr: 'Activer sans bouger', en: 'Switch on without moving' },
    suppress: { fr: 'Ne plus demander — aller directement', en: 'Stop asking — just go' },
    cancel: { fr: 'ESC pour annuler', en: 'Esc to cancel' },
  },
  // The provider-key dialog, dev server only: src/keySetup.js removes both
  // nodes when /api/setup/status is absent, which is every deployed build.
  keySetup: {
    chip: { fr: 'PUISSANCE', en: 'POWER UP', note: 'src/keySetup.js rewrites it with the count of keys still missing.' },
    kicker: { fr: 'STATION AU SOL · RÉGLAGES DES FOURNISSEURS', en: 'GROUND STATION · PROVIDER SETTINGS' },
    close: { fr: 'Fermer les réglages des clés', en: 'Close key setup' },
    title: { fr: 'Donnez au globe toute sa puissance', en: 'Power up the globe' },
    description: {
      fr: 'Le globe vole déjà sans clé — Esri dans le monde, l’IGN sur la France. Chaque clé ci-dessous allume un flux réel de plus : collez-la et elle est écrite dans le .env de ce dépôt, puis le serveur redémarre tout seul. Les clés côté serveur ne quittent jamais cette machine ; Google Maps et Cesium ion tournent dans le navigateur et doivent être restreintes chez le fournisseur. Les clés configurées ailleurs — votre shell, votre trousseau — sont affichées mais jamais touchées.',
      en: 'The globe already flies keyless — Esri worldwide, IGN over France. Every key below switches on another real feed: paste one and it is saved into this checkout’s own .env, then the server restarts itself. Server-side keys never leave this machine; Google Maps and Cesium ion run in the browser and must be provider-restricted. Keys you configured elsewhere — your shell, your Keychain — are shown but never touched.',
    },
    save: { fr: 'ENREGISTRER LES CLÉS', en: 'SAVE KEYS' },
    note: {
      fr: 'Depuis la France, c’est le jeton Cesium ion qui achète le globe 3D — Google le refuse aux comptes facturés dans l’EEE.',
      en: 'From France, the Cesium ion token is the one that buys the 3D globe — Google withholds it from EEA-billed accounts.',
    },
  },
  loader: {
    status: {
      fr: 'Initialisation du monde photoréaliste…',
      en: 'Initializing photorealistic world…',
      note: 'First line of the loading veil; src/main.js writes the ones that follow. style.css hides it on an English page until the markup is translated, so its French never flashes.',
    },
  },
  // The landing page at `/` (index.html, `#vitrine`). Its copy is argued in
  // docs/designs/landing; the English makes the same claims, in the same
  // register: short, concrete, second person.
  vitrine: {
    skip: { fr: 'Aller au contenu', en: 'Skip to content' },
    backToTop: { fr: 'Surplomb, retour en haut', en: 'Surplomb, back to top', note: 'Accessible name of the two marks, top and bottom of the page.' },
    slogan: { fr: 'Aucun angle mort.', en: 'No blind spots.' },
    pause: {
      fr: 'Mettre en pause',
      en: 'Pause',
      note: 'The rotating examples and the scene of views; src/vitrine/vitrine.i18n.js writes it back after « Resume ».',
    },
    publicCopy: {
      fr: 'Les administrations publient. Surplomb met leurs données sur une carte : avions, bus, ventes, centrales, météo… plus de cinquante sources, au même endroit.',
      en: 'Public agencies publish. Surplomb puts their data on a map: planes, buses, property sales, power plants, weather… more than fifty sources, in one place.',
      note: 'Twice on the page: under « It all starts with a place » and in the footer.',
    },
    hero: {
      title: {
        fr: 'La France au rayon X.',
        en: 'France, X-\u2060rayed.',
        note: 'A word joiner (U+2060) follows the hyphen: at display size the line broke inside « X-rayed ». The glossary’s tagline is the same words.',
      },
      intro: { fr: 'Tout ce que vous n’auriez jamais pensé à chercher.', en: 'Everything you never thought to look up.' },
      place: {
        fr: 'Paris · le trafic, rue par rue',
        en: 'Paris · traffic, street by street',
        note: 'Caption of the recorded loop behind the first screen.',
      },
      still: { fr: 'Image fixe', en: 'Still image', note: 'Checkbox that stops every loop on the page on the frame being shown.' },
    },
    discover: {
      title: { fr: 'Tout commence par un lieu.', en: 'It all starts with a place.' },
      examples: { fr: 'Des vues à explorer', en: 'Views to explore' },
      example0: {
        fr: 'Le prix auquel l’appartement d’en face s’est vendu, et la parcelle qui allait avec.',
        en: 'The price the apartment across the street sold for, and the parcel that came with it.',
      },
      example1: { fr: 'Ce que produit chaque centrale à cette minute.', en: 'What every power plant is producing this minute.' },
      example2: { fr: 'Le bus qui arrive, en direct.', en: 'The bus pulling in, live.' },
      example3: { fr: 'Les voitures qui roulent en ce moment, rue par rue.', en: 'The cars on the road right now, street by street.' },
      example4: { fr: 'Le vélo libre le plus proche.', en: 'The nearest available bike.', note: 'A shared bike nobody has taken.' },
      example5: {
        fr: 'Les permis de construire accordés dans la rue.',
        en: 'The building permits granted on the street.',
        note: 'Held back (`data-pending`): never shown until the permits layer is fixed.',
      },
      example6: { fr: 'L’avion qui passe au-dessus, et d’où il vient.', en: 'The plane passing overhead, and where it came from.' },
      example7: { fr: 'Le risque d’inondation sous le trottoir.', en: 'The flood risk under the sidewalk.' },
      next: { fr: 'Autre exemple', en: 'Another example' },
    },
    counters: {
      title: { fr: 'En ce moment au-dessus de la France', en: 'Right now, above France' },
      avions: { fr: 'Avions', en: 'Planes' },
      navires: { fr: 'Navires', en: 'Ships' },
      bus: { fr: 'Bus et trams', en: 'Buses and trams' },
      meteo: { fr: 'Stations météo qui émettent', en: 'Weather stations reporting' },
    },
    gallery: {
      title: { fr: 'Choisissez une vue.', en: 'Pick a view.' },
      open: { fr: 'Ouvrir dans le globe', en: 'Open in the globe' },
      tabs: { fr: 'Vues', en: 'Views' },
      tab01: { fr: 'Avions', en: 'Planes' },
      tab02: { fr: 'Immobilier', en: 'Property' },
      tab03: { fr: 'Trafic', en: 'Traffic' },
      tab04: { fr: 'Énergie', en: 'Energy' },
      tab05: { fr: 'Bus', en: 'Buses' },
      tab06: { fr: 'Numérique', en: 'Digital' },
      v01: {
        alt: { fr: 'Roissy et les avions en approche', en: 'Roissy and the planes on approach', keep: ['Roissy'] },
        title: { fr: 'Avions en approche', en: 'Planes on approach' },
        place: { fr: 'Roissy-Charles-de-Gaulle', en: 'Roissy-Charles-de-Gaulle', keep: ['Roissy-Charles-de-Gaulle'] },
      },
      v02: {
        alt: {
          fr: 'Les ventes autour de l’Hôtel de Ville de Lyon, puis chaque parcelle peinte selon son DPE',
          en: 'The sales around Lyon’s city hall, then every parcel painted by its energy rating (DPE)',
        },
        title: { fr: 'Ventes et DPE', en: 'Sales and energy ratings' },
        place: { fr: 'Lyon : chaque vente, puis chaque DPE', en: 'Lyon: every sale, then every energy rating' },
      },
      v03: {
        alt: { fr: 'Les voitures en direct dans les rues, avec les bouchons', en: 'Live cars in the streets, traffic jams included' },
        title: { fr: 'Trafic routier', en: 'Road traffic' },
        place: { fr: 'Les bouchons en direct, rue par rue', en: 'Live traffic jams, street by street' },
      },
      v04: {
        alt: { fr: 'Le réseau électrique et ce qu’il produit', en: 'The power grid and what it produces' },
        title: { fr: 'Réseau électrique', en: 'Power grid' },
        place: { fr: 'La production en France', en: 'Output across France' },
      },
      v05: {
        alt: { fr: 'Les bus de Bordeaux, en direct', en: 'Bordeaux’s buses, live' },
        title: { fr: 'Bus en direct', en: 'Live buses' },
        place: { fr: 'Le réseau de Bordeaux', en: 'The Bordeaux network' },
      },
      v06: {
        alt: {
          fr: 'Les antennes de France s’allument, puis les zones sans 4G, les data centers d’Île-de-France et tout ce que voit une antenne de La Défense',
          en: 'France’s antennas light up, then the areas without 4G, the data centres of Île-de-France and all that one antenna at La Défense can see',
          keep: ['Île-de-France', 'La Défense'],
        },
        title: { fr: 'Antennes et data centers', en: 'Antennas and data centres' },
        place: { fr: 'De la France entière à une antenne de La Défense', en: 'From all of France to one antenna at La Défense', keep: ['La Défense'] },
      },
    },
    voice: {
      title: { fr: 'Parlez au globe.', en: 'Talk to the globe.' },
      microphoneAlt: { fr: 'Microphone en verre traversé par un ruban corail', en: 'A glass microphone crossed by a coral ribbon' },
      quote: {
        fr: '« Montre-moi les bus autour de la gare Saint-Jean. »',
        en: '“Show me the buses around Saint-Jean station.”',
        keep: ['Saint-Jean'],
        note: 'A spoken request, in quotation marks; the picture under it is the globe’s answer.',
      },
      answerLink: { fr: 'Voir les bus de Bordeaux dans le globe', en: 'See Bordeaux’s buses in the globe' },
      answerAlt: {
        fr: 'Les bus autour de la gare Saint-Jean à Bordeaux',
        en: 'The buses around Saint-Jean station in Bordeaux',
        keep: ['Saint-Jean'],
      },
      caption: { fr: 'Les bus de Bordeaux, en direct.', en: 'Bordeaux’s buses, live.' },
    },
    footer: {
      nav: { fr: 'Liens de pied de page', en: 'Footer links' },
      author: {
        fr: 'Conçu par',
        en: 'Designed by',
        note: 'Followed by the author’s name, a link the page never translates (translate="no").',
      },
      code: { fr: 'Voir le code', en: 'See the code' },
      codeAria: { fr: 'Voir le code open source', en: 'See the open-source code' },
      legal: { fr: 'Mentions légales', en: 'Legal notice', note: 'The page it opens is in French (hreflang="fr").' },
      privacy: { fr: 'Confidentialité', en: 'Privacy', note: 'The page it opens is in French (hreflang="fr").' },
      terms: {
        fr: 'CGV',
        en: 'Terms of sale',
        note: 'Conditions générales de vente, the B2B terms of the paid offer. The page it opens is in French (hreflang="fr").',
      },
    },
    dock: {
      form: { fr: 'Ouvrir le globe sur un lieu', en: 'Open the globe on a place' },
      locate: { fr: 'Utiliser ma position', en: 'Use my location' },
      place: {
        fr: 'une adresse, une ville, ou ma position',
        en: 'an address, a city, or my location',
        note: 'Placeholder of the field, and its hidden label. Lower case on purpose: it reads as the end of « Open the globe on… ».',
      },
      open: { fr: 'Ouvrir le globe', en: 'Open the globe' },
      note: { fr: 'Sans compte. Sans installation.', en: 'No account. Nothing to install.' },
    },
  },
  viewSwitcher: {
    nav: { fr: 'Changement de vue', en: 'View switcher' },
    resetCockpit: { fr: 'Réinitialiser le cockpit et revenir au globe entier', en: 'Reset cockpit to full globe view' },
    resetCockpitTitle: { fr: 'Quitter le cockpit et revenir au globe entier', en: 'Exit cockpit and return to full globe view' },
    reset: { fr: 'RÉINIT.', en: 'RESET' },
    exitCockpit: { fr: 'Quitter la vue cockpit', en: 'Exit cockpit view' },
    exitCockpitLabel: { fr: 'QUITTER LE COCKPIT', en: 'EXIT COCKPIT' },
  },
});
