/**
 * Towns that post their permits on Digilor Datahall (`datahall.mydigilor.fr`),
 * beyond the five of `municipalPermitExtensions.js` and Argenteuil: read by
 * the same reader (`readDigilorCity`), each with its app id and the shelves
 * that hold its permits (`digilorDocuments`). Found on 2026-10-02 by asking
 * the platform's public index of every app id. Data only, so that
 * `permitListsFeed.js` can hold them without importing the readers.
 */
import { DIGILOR_TOWNS_A } from './digilorTownsA.js';
import { DIGILOR_TOWNS_B } from './digilorTownsB.js';
import { DIGILOR_TOWNS_C } from './digilorTownsC.js';
import { DIGILOR_TOWNS_D } from './digilorTownsD.js';
import { DIGILOR_TOWNS_ACTS } from './digilorTownsActs.js';

const freezeSource = (source) => Object.freeze({
  ...source,
  ...(source.formats ? { formats: Object.freeze({ ...source.formats }) } : {}),
  ...(source.shelves ? { shelves: Object.freeze(source.shelves.map((shelf) => Object.freeze({ ...shelf }))) } : {}),
});

export const DIGILOR_TOWNS = Object.freeze([...DIGILOR_TOWNS_A, ...DIGILOR_TOWNS_B, ...DIGILOR_TOWNS_C, ...DIGILOR_TOWNS_D, ...DIGILOR_TOWNS_ACTS]
  .map((town) => Object.freeze({ ...town, source: freezeSource(town.source), lists: Object.freeze([...(town.lists ?? [])]) })));
