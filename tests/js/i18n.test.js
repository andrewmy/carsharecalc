import test from 'node:test';
import assert from 'node:assert/strict';

import { detectLanguage, setLang, getLang, t } from '../../web/lib/i18n.js';

test('i18n defaults to Latvian when no browser language is available', () => {
  assert.equal(detectLanguage({ languages: [], language: '' }), 'lv');
});

test('i18n setLang switches dictionaries and affects t()', () => {
  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(t('results_title'), 'Results');

  setLang('lv');
  assert.equal(getLang(), 'lv');
  assert.equal(t('results_title'), 'Rezultāti');
});

