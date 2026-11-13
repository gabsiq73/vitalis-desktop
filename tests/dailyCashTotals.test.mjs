import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyCashTotals } from '../src/utils/dailyCashTotals.ts';

test('includes excess credits by method and separates existing balance from new receipts', () => {
  const totals = dailyCashTotals([
    { paymentMethod: 'PIX', amount: 70, entryType: 'PAYMENT' },
    { paymentMethod: 'PIX', amount: 10, entryType: 'CLIENT_CREDIT' },
    { paymentMethod: 'DINHEIRO', amount: 20, entryType: 'PAYMENT' },
    { paymentMethod: 'DINHEIRO', amount: 5, entryType: 'CLIENT_CREDIT' },
    { paymentMethod: 'SALDO', amount: 15, entryType: 'PAYMENT' },
  ]);
  assert.deepEqual(totals.PIX, { amount: 80, count: 2 });
  assert.deepEqual(totals.DINHEIRO, { amount: 25, count: 2 });
  assert.deepEqual(totals.SALDO, { amount: 15, count: 1 });
  assert.equal(totals.newReceipts, 105);
});

test('empty day has no receipts or balance usage', () => {
  assert.deepEqual(dailyCashTotals([]), {
    PIX: { amount: 0, count: 0 }, DINHEIRO: { amount: 0, count: 0 },
    SALDO: { amount: 0, count: 0 }, newReceipts: 0,
  });
});

test('a day paid only with existing balance has no new receipts', () => {
  const totals = dailyCashTotals([{ paymentMethod: 'SALDO', amount: 25, entryType: 'PAYMENT' }]);
  assert.equal(totals.newReceipts, 0);
  assert.deepEqual(totals.PIX, { amount: 0, count: 0 });
  assert.deepEqual(totals.DINHEIRO, { amount: 0, count: 0 });
  assert.deepEqual(totals.SALDO, { amount: 25, count: 1 });
});

test('adds currency in cents without floating point residue', () => {
  const totals = dailyCashTotals([
    { paymentMethod: 'PIX', amount: 0.1 },
    { paymentMethod: 'PIX', amount: 0.2 },
    { paymentMethod: 'DINHEIRO', amount: 0.7 },
  ]);
  assert.equal(totals.PIX.amount, 0.3);
  assert.equal(totals.newReceipts, 1);
});
