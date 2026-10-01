/** Canonical verdicts in the server's French payload, with English labels. */
import { defineMessages } from '../i18n/messages.js';

export default defineMessages({
  signed: { fr: 'Décision signée', en: 'Decision signed' },
  withdrawn: { fr: 'Retrait', en: 'Withdrawal' },
  unopposed: { fr: 'Non-opposition', en: 'No opposition' },
  refused: { fr: 'Refus', en: 'Refusal' },
  granted: { fr: 'Accord', en: 'Grant' },
  tacit: { fr: 'Accord tacite', en: 'Tacit grant' },
});
