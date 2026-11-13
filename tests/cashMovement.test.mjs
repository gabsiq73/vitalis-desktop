import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCashMovement, cashDifference, cashMovementDirection } from '../src/utils/cashMovement.ts';
import { cashMovementApiError } from '../src/utils/parseApiError.ts';

const input = { type: 'ENTRY', amount: 12.5, direction: 'OUT', occurredAt: '2026-11-12T10:30', note: '  Troco inicial  ' };

test('entry and withdrawal responses have nullable direction; signs come from their type', () => {
  assert.equal(cashMovementDirection({ type: 'ENTRY', direction: null }), 'IN');
  assert.equal(cashMovementDirection({ type: 'WITHDRAWAL', direction: null }), 'OUT');
  assert.equal(cashMovementDirection({ type: 'ADJUSTMENT', direction: 'IN' }), 'IN');
  assert.equal(cashMovementDirection({ type: 'ADJUSTMENT', direction: 'OUT' }), 'OUT');
  assert.equal(cashMovementDirection({ type: 'ADJUSTMENT', direction: null }), null);
});

test('entry and withdrawal send no direction; withdrawal trims its required reason', () => {
  for (const type of ['ENTRY', 'WITHDRAWAL']) {
    assert.deepEqual(buildCashMovement({ ...input, type }), {
      type, amount: 12.5, occurredAt: input.occurredAt, note: 'Troco inicial',
    });
  }
  assert.throws(() => buildCashMovement({ ...input, type: 'WITHDRAWAL', note: '   ' }), /motivo/);
  assert.equal(buildCashMovement({ ...input, note: ' ' }).note, null);
});

test('manual adjustments require a positive amount and retain chosen direction', () => {
  for (const direction of ['IN', 'OUT']) {
    assert.deepEqual(buildCashMovement({ ...input, type: 'ADJUSTMENT', direction }), {
      type: 'ADJUSTMENT', amount: 12.5, direction, occurredAt: input.occurredAt, note: 'Troco inicial',
    });
  }
});

test('conference submits only positive difference with matching direction', () => {
  const base = { ...input, type: 'ADJUSTMENT', balance: 100, amount: NaN };
  assert.equal(buildCashMovement({ ...base, counted: 100 }), null);
  assert.deepEqual(buildCashMovement({ ...base, counted: 112.5 }), {
    type: 'ADJUSTMENT', amount: 12.5, direction: 'IN', occurredAt: input.occurredAt, note: 'Troco inicial',
  });
  assert.deepEqual(buildCashMovement({ ...base, counted: 87.5 }), {
    type: 'ADJUSTMENT', amount: 12.5, direction: 'OUT', occurredAt: input.occurredAt, note: 'Troco inicial',
  });
});

test('conference supports zero counted, negative API balance and precision in cents', () => {
  assert.equal(cashDifference(0.3, 0.1), 0.2);
  assert.equal(buildCashMovement({ ...input, type: 'ADJUSTMENT', counted: 0, balance: 100 }).amount, 100);
  const negative = buildCashMovement({ ...input, type: 'ADJUSTMENT', counted: 0, balance: -10 });
  assert.equal(negative.amount, 10);
  assert.equal(negative.direction, 'IN');
});

test('rejects invalid amounts, dates, notes and unavailable conference base', () => {
  for (const amount of [0, -1, NaN, Infinity, 0.001, 100000000]) assert.throws(() => buildCashMovement({ ...input, amount }));
  for (const counted of [-1, NaN, Infinity]) assert.throws(() => buildCashMovement({ ...input, type: 'ADJUSTMENT', counted, balance: 10 }));
  assert.throws(() => buildCashMovement({ ...input, occurredAt: '' }), /data/);
  assert.throws(() => buildCashMovement({ ...input, occurredAt: 'invalid' }), /data/);
  assert.throws(() => buildCashMovement({ ...input, note: 'x'.repeat(256) }), /255/);
  assert.throws(() => buildCashMovement({ ...input, type: 'ADJUSTMENT', counted: 10 }), /indisponível/);
});

test('access restrictions are explicit and API business errors preserve their message', () => {
  const error = status => ({ isAxiosError: true, response: { status, data: { message: 'Erro do servidor' } } });
  assert.match(cashMovementApiError(error(403)), /administradores/);
  assert.match(cashMovementApiError(error(401)), /Entre novamente/);
  assert.equal(cashMovementApiError(error(400)), 'Erro do servidor');
});
