import test from 'node:test';
import assert from 'node:assert/strict';
import { getStockStatus, isStockLow } from '../src/utils/stock.ts';

test('stock far above minimum has no critical alert regardless of an old status label', () => {
  const stock = { quantityInStock: 200, minimumStock: 5, status: 'CRITICAL' };
  assert.equal(getStockStatus(stock), 'NORMAL');
  assert.equal(isStockLow(stock), false);
});

test('the minimum is inclusive in badges, counters and alerts', () => {
  for (const quantityInStock of [1, 4, 5]) {
    const stock = { quantityInStock, minimumStock: 5 };
    assert.equal(getStockStatus(stock), 'LOW_STOCK');
    assert.equal(isStockLow(stock), true);
  }
  assert.equal(isStockLow({ quantityInStock: 6, minimumStock: 5 }), false);
});

test('zero stock is out of stock even when minimum is zero', () => {
  for (const minimumStock of [0, 5]) {
    assert.equal(getStockStatus({ quantityInStock: 0, minimumStock }), 'OUT_OF_STOCK');
    assert.equal(isStockLow({ quantityInStock: 0, minimumStock }), true);
  }
  assert.equal(getStockStatus({ quantityInStock: 1, minimumStock: 0 }), 'NORMAL');
});

test('a page of normal physical stock yields zero alerts while low and empty stock are counted once', () => {
  const normal = { quantityInStock: 200, minimumStock: 5 };
  assert.equal([normal].filter(isStockLow).length, 0);
  assert.equal([normal, { quantityInStock: 5, minimumStock: 5 }, { quantityInStock: 0, minimumStock: 0 }].filter(isStockLow).length, 2);
});
