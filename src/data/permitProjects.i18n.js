/**
 * Strings of `src/data/permitProjects.js` — the words the « Urbanisme » row
 * uses for a building project, whichever of its two permit layers drew it.
 *
 * WRITTEN FOR A READER WHO HAS NEVER FILED A PERMIT (the approved mock of
 * 2026-09-23, and the plain-legend rule of 2026-09-21): one name per colour,
 * no acronym, no count, no sentence under a swatch. « DOC » and « DAACT » are
 * what the register calls the two declarations; the reader is told what they
 * mean — the work started, the work is finished.
 *
 * See docs/i18n/CONVENTIONS.md.
 */
import { monthName, ordinal, plural } from '../i18n/format.js';
import { defineMessages } from '../i18n/messages.js';

export default defineMessages({
  /** One name per colour of the key, in the order the key prints them. */
  classes: {
    filed: {
      fr: 'Demande en cours d’examen',
      en: 'Application under review',
      note: 'Only Paris, Bordeaux and Nantes publish files still at the counter.',
    },
    granted: { fr: 'Permis accordé', en: 'Permit granted' },
    started: { fr: 'Travaux commencés', en: 'Work started' },
    completed: { fr: 'Travaux terminés', en: 'Work completed' },
    cancelled: { fr: 'Annulé ou refusé', en: 'Canceled or refused' },
    demolition: { fr: 'Permis de démolir', en: 'Demolition permit' },
    unknown: { fr: 'État non publié', en: 'State not published' },
  },

  /** The fold that holds the colours under a project's card. */
  fold: { fr: 'Couleurs des projets', en: 'Project colors' },

  /** The card of one project, in the map key. */
  card: {
    dwellings: {
      fr: (count, n) => `${count} logement${n > 1 ? 's' : ''} autorisé${n > 1 ? 's' : ''}`,
      en: (count, n) => `${count} ${plural(n, 'dwelling', 'dwellings', { locale: 'en' })} authorized`,
      note: 'The headline of the card: what the permit allows, in dwellings.',
      sample: ['40', 40],
    },
    tagDwellings: {
      fr: (count, n) => `${count} logement${n > 1 ? 's' : ''}`,
      en: (count, n) => `${count} ${plural(n, 'dwelling', 'dwellings', { locale: 'en' })}`,
      note: 'The tag the globe keeps over a selected project.',
      sample: ['40', 40],
    },
    surface: { fr: 'Surface déclarée', en: 'Declared floor area' },
    demolished: { fr: 'Démolition prévue', en: 'Planned demolition' },
    demolishedDwellings: {
      fr: (count, n) => `${count} logement${n > 1 ? 's' : ''}`,
      en: (count, n) => `${count} ${plural(n, 'dwelling', 'dwellings', { locale: 'en' })}`,
      sample: ['2', 2],
    },
    squareMeters: {
      fr: (value) => `${value} m²`,
      en: (value) => `${value} m²`,
      sample: ['2,390'],
    },
    /** The three moments of a permit, as a timeline. */
    steps: {
      filed: { fr: 'Demande déposée', en: 'Application filed' },
      granted: { fr: 'Permis accordé', en: 'Permit granted' },
      decided: { fr: 'Décision', en: 'Decision' },
      /** A grant whose day is unknown, but not after the day it was published. */
      grantedBy: {
        fr: (date) => `Au plus tard le ${date}`,
        en: (date) => `By ${date}`,
        sample: ['Oct 2, 2026'],
      },
      started: { fr: 'Début des travaux déclaré', en: 'Start of work declared' },
      completed: { fr: 'Fin des travaux', en: 'End of work' },
      missing: {
        fr: 'Non renseignée',
        en: 'Not reported',
        note: 'A date the register has not received — not a date that is late.',
      },
    },
    approximate: {
      title: { fr: 'Localisation à confirmer', en: 'Location to be confirmed' },
      text: {
        fr: 'Le repère sur la carte est approximatif.',
        en: 'The marker on the map is approximate.',
      },
      tag: { fr: 'Repère approximatif', en: 'Approximate marker' },
    },
    details: { fr: 'Voir les détails du permis', en: 'See the permit details' },
    source: {
      fr: (source) => `Source : ${source}`,
      en: (source) => `Source: ${source}`,
      sample: ['Sitadel · SDES'],
    },
    /** `2024-12-06` → `6 déc. 2024` / `Dec 6, 2024`; the 1st is `1ᵉʳ`. */
    date: {
      fr: (year, month, day) => `${day === 1 ? ordinal(1, { locale: 'fr' }) : day} `
        + `${monthName(month - 1, { style: 'short', locale: 'fr' })} ${year}`,
      en: (year, month, day) => `${monthName(month - 1, { style: 'short', locale: 'en' })} ${day}, ${year}`,
      sample: [2024, 12, 6],
    },
  },
});
