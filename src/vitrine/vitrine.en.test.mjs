// The landing page in English: what it says, what it does not carry, and the
// way between the two languages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import markupMessages from '../i18n/markup.i18n.js';
import { walkHtml } from '../../scripts/lib/i18nScan.mjs';
import { assertNoFrench, useTestLocale, withLocale } from '../i18n/testing.js';
import messages from './vitrine.i18n.js';
import { applyPulse } from './counters.js';

const INDEX_HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const LANDING_CSS = readFileSync(new URL('../../landing.css', import.meta.url), 'utf8');
const SHOWCASE = INDEX_HTML.slice(INDEX_HTML.indexOf('<div id="vitrine"'), INDEX_HTML.indexOf('<div id="world-overlay-root"'));

/** Every opening tag of the showcase whose source contains `fragment`. */
const tagsWith = (fragment) => [...SHOWCASE.matchAll(/<[a-z]+\b[^>]*>/g)].map((m) => m[0]).filter((tag) => tag.includes(fragment));

test('every word of the showcase has its English, and the English has no French in it', () => {
  const en = markupMessages('en').vitrine;
  assertNoFrench(en, { allow: ['Roissy', 'Roissy-Charles-de-Gaulle', 'Saint-Jean', 'Lyon', 'Bordeaux', 'Paris', 'La Défense'] });
  // The sentences a reader meets first.
  // The glossary's tagline, with a word joiner so the line never breaks
  // inside « X-rayed ».
  assert.equal(en.hero.title, 'France, X-\u2060rayed.');
  assert.equal(en.slogan, 'No blind spots.');
  assert.equal(en.dock.open, 'Open the globe');
  assert.equal(en.dock.note, 'No account. Nothing to install.');
  // Every text run and attribute of the showcase is keyed or exists in one
  // language only — the R3 rule, asserted here on the showcase alone.
  const loose = [];
  walkHtml(SHOWCASE, (item) => { if (!item.covered) loose.push(item.text); });
  assert.deepEqual(loose, []);
});

test('the root no longer pins French, so it takes the page’s language', () => {
  assert.match(SHOWCASE, /^<div id="vitrine" class="landing" data-state="poster">/);
});

test('the waitlist and « premium » are French only; the English sells nothing', () => {
  const waitlist = tagsWith('data-link="waitlist"');
  assert.equal(waitlist.length, 2, 'the voice panel and the footer');
  for (const tag of waitlist) assert.match(tag, /data-locale-only="fr"/, tag);
  assert.match(SHOWCASE, /<span class="premium" data-locale-only="fr">premium<\/span>/);
  assert.doesNotMatch(JSON.stringify(markupMessages('en').vitrine), /premium|waitlist|subscri|pricing|€|\$/i);
});

test('the English page credits the project the globe is built on, with both links', () => {
  const credit = SHOWCASE.match(/<p class="footer-credit"[^>]*>[\s\S]*?<\/p>/)?.[0] || '';
  assert.match(credit, /data-locale-only="en"/);
  assert.match(credit, /lang="en"/);
  assert.match(credit, /<a href="https:\/\/github\.com\/bilawalsidhu\/gods-eye-view">God’s Eye View<\/a>/);
  assert.match(credit, /<a href="https:\/\/github\.com\/bilawalsidhu">Bilawal Sidhu<\/a>/);
});

test('both languages name the author, with a link to the project page of the author’s site', () => {
  const line = SHOWCASE.match(/<p class="footer-author"[^>]*>[\s\S]*?<\/p>/)?.[0] || '';
  assert.doesNotMatch(line, /data-locale-only/);
  assert.match(line, /<span data-i18n="vitrine\.footer\.author">Conçu par<\/span>/);
  assert.match(line, /<a href="https:\/\/melvynraymond\.com\/surplomb" rel="author"[^>]*translate="no">Melvyn Raymond<\/a>/);
  assert.equal(markupMessages('en').vitrine.footer.author, 'Designed by');
});

test('the language links: each names the other language, and only one shows', () => {
  const links = tagsWith('data-locale-link');
  assert.equal(links.length, 2);
  const [toEnglish, toFrench] = links;
  assert.match(toEnglish, /href="\/\?lang=en" hreflang="en" lang="en"/);
  assert.match(toEnglish, /data-locale-only="fr"/);
  assert.match(toFrench, /href="\/\?lang=fr" hreflang="fr" lang="fr"/);
  assert.match(toFrench, /data-locale-only="en"/);
  // And landing.css hides each one-language element in the other language.
  assert.match(LANDING_CSS, /html:not\(\[lang="fr"\]\) #vitrine \[data-locale-only="fr"\],\s*html:not\(\[lang="en"\]\) #vitrine \[data-locale-only="en"\] \{\s*display: none;/);
});

test('an English page keeps its words hidden until they are translated, never for good', () => {
  assert.match(LANDING_CSS, /html\[lang="en"\]:not\(\[data-i18n-ready\]\) #vitrine > :not\(\.world\):not\(\.world-credit\) \{\s*opacity: 0;\s*animation: vitrine-words-late 0s linear 3s forwards;/);
});

test('what the scripts write reads in English on an English page', (t) => {
  useTestLocale('en', t);
  const m = messages();
  assert.deepEqual([m.pause, m.resume, m.locating, m.opening], ['Pause', 'Resume', 'Finding your location…', 'Opening the globe…']);
  assertNoFrench(m);
  // The French still answers from the same catalog.
  assert.equal(withLocale('fr', () => messages().resume), 'Reprendre');
});

test('the live figures group thousands the English way', (t) => {
  useTestLocale('en', t);
  const slot = { textContent: '', getAttribute: () => 'counter:navires' };
  const counter = { hidden: true, setAttribute: () => {}, querySelector: () => slot };
  const panel = { hidden: true, querySelectorAll: () => [counter] };
  const at = '2026-09-22T12:00:00.000Z';
  applyPulse(panel, { at, maxAgeMs: 600_000, navires: { value: 1925, at } });
  assert.equal(slot.textContent, '1,925');
});
