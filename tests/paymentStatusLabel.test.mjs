import test from 'node:test';
import assert from 'node:assert/strict';
import { getPaymentStatusBadge, getOrderStatusBadge } from '../src/utils/format.ts';

test('unpaid payment is shown as Fiado without changing delivery status labels', () => {
  assert.equal(getPaymentStatusBadge('PENDING').label, 'Fiado');
  assert.equal(getPaymentStatusBadge('pending').label, 'Fiado');
  assert.equal(getOrderStatusBadge('PENDING').label, 'Pendente');
});

test('paid, partial and cancelled payments retain their existing meaning', () => {
  assert.equal(getPaymentStatusBadge('PAID').label, 'Pago');
  assert.equal(getPaymentStatusBadge('PARTIAL').label, 'Parcial');
  assert.equal(getPaymentStatusBadge('CANCELLED').label, 'Cancelado');
});
