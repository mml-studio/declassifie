/**
 * Strings of `src/data/cctvPacks.js` — see docs/i18n/CONVENTIONS.md.
 *
 * One line: the Data attribution entry a camera pack adds. The publisher's
 * name, the city and the licence name come from the pack file and are data.
 */
import { defineMessages } from '../i18n/messages.js';

export default defineMessages({
  creditLead: {
    fr: (city) => (city ? `Caméras publiques et images (${city})` : 'Caméras publiques et images'),
    en: (city) => (city ? `Public cameras and frames (${city})` : 'Public cameras and frames'),
    sample: ['Rennes'],
  },
});
