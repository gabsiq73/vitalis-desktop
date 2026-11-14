import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreOrderDraftItems } from '../src/utils/orderDraft.ts';

test('legacy draft keeps quantities, removes redemption markers and requires review', () => {
  const old = [{ productId: 'water', quantity: 2, useBonus: true, unitPrice: 0 }];
  const result = restoreOrderDraftItems(old);
  assert.equal(result.needsReview, true);
  assert.deepEqual(result.items, [{ productId: 'water', quantity: 2 }]);
  assert.equal(old[0].useBonus, true);
});

test('normal draft preserves negotiated price and needs no loyalty review', () => {
  const result = restoreOrderDraftItems([{ productId: 'water', quantity: 1, unitPrice: 17, useBonus: false }]);
  assert.equal(result.needsReview, false);
  assert.deepEqual(result.items, [{ productId: 'water', quantity: 1, unitPrice: 17 }]);
});

test('older isBonus marker is removed and empty drafts remain valid', () => {
  assert.equal(restoreOrderDraftItems([{ quantity: 1, isBonus: true }]).needsReview, true);
  assert.deepEqual(restoreOrderDraftItems([]), { items: [], needsReview: false });
});

test('negotiated water price survives draft restoration without becoming a client price', () => {
  const items = [{ productId: 'water', quantity: 2, waterUnitPrice: '6.50' }];
  assert.deepEqual(restoreOrderDraftItems(items), { items, needsReview: false });
});
