import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_TYPE_LABELS, PRODUCT_TYPE_LABELS, parseClientType, parseProductType } from '../src/utils/importTypes.ts';

test('client and product exports round trip through the Portuguese import values', () => {
  for (const [code, label] of Object.entries(CLIENT_TYPE_LABELS)) assert.equal(parseClientType(label), code);
  for (const [code, label] of Object.entries(PRODUCT_TYPE_LABELS)) assert.equal(parseProductType(label), code);
});

test('imports retain compatibility with old files, accented names and spacing', () => {
  for (const [value, code] of [[' varejo ', 'RETAIL'], ['revenda', 'RESELLER'], ['Revendedor', 'RESELLER'], ['RETAIL', 'RETAIL'], ['RESELLER', 'RESELLER'], ['Avulso', 'AVULSO']]) assert.equal(parseClientType(value), code);
  for (const [value, code] of [[' água ', 'WATER'], ['AGUA', 'WATER'], ['WATER', 'WATER'], ['gás', 'GAS'], ['GAS', 'GAS']]) assert.equal(parseProductType(value), code);
  assert.equal(parseClientType(undefined), undefined);
  assert.equal(parseProductType('outro'), undefined);
});
