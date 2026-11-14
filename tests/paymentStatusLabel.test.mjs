import test from 'node:test';
import assert from 'node:assert/strict';
import { getPaymentStatusBadge, getOrderStatusBadge } from '../src/utils/format.ts';

test('unpaid orders await payment before delivery, including scheduled and shipped orders', () => {
  for (const status of ['PENDING', 'SHIPPED', 'PROCESSING', 'pending']) {
    assert.equal(getPaymentStatusBadge('PENDING', status).label, 'Aguardando');
  }
  assert.equal(getOrderStatusBadge('PENDING').label, 'Pendente');
});

test('only confirmed delivery with unpaid balance makes pending payment Fiado', () => {
  assert.equal(getPaymentStatusBadge('PENDING', 'DELIVERED').label, 'Fiado');
  assert.equal(getPaymentStatusBadge('pending', 'delivered').label, 'Fiado');
  // Choosing fiado and cancelling/failed confirmation leaves the order undelivered.
  assert.equal(getPaymentStatusBadge('PENDING', 'PENDING').label, 'Aguardando');
  assert.equal(getPaymentStatusBadge('PENDING', 'SHIPPED').label, 'Aguardando');
});

test('paid and partial payments retain their meaning before and after delivery', () => {
  for (const status of ['PENDING', 'SHIPPED', 'DELIVERED']) {
    assert.equal(getPaymentStatusBadge('PAID', status).label, 'Pago');
    assert.equal(getPaymentStatusBadge('PARTIAL', status).label, 'Parcial');
    assert.equal(getPaymentStatusBadge('CANCELLED', status).label, 'Cancelado');
  }
  assert.equal(getPaymentStatusBadge('PENDING', 'CANCELLED').label, 'Cancelado');
});
