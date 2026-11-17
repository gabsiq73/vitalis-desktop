import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch } from '../src/utils/search.ts';

test('pesquisa ignora caixa, acentos compostos/decompostos e espaços', () => {
  for (const text of ['João da Conceição', 'J O A O D A C O N C E I C A O', 'João\tda\u00a0Conceição']) {
    assert.equal(normalizeSearch(text), 'joaodaconceicao');
  }
  assert.equal(normalizeSearch(undefined), '');
  assert.equal(normalizeSearch('100%_\\'), '100%_\\');
});
