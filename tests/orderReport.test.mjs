import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderReport } from '../src/utils/orderReport.ts';

const now = new Date(2026, 10, 12, 12);
function order(id, status, totalValue, daysAgo = 0, clientId = id) {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  return { id, status, totalValue, clientId, clientName: clientId, createDate: date.toISOString(),
    paymentStatus: 'PENDING', items: [] };
}
const mixed = [
  order('delivered', 'DELIVERED', 60),
  order('pending', 'PENDING', 30),
  order('shipped', 'SHIPPED', 10),
  order('cancelled', 'CANCELLED', 900),
];

for (const days of [7, 30, 90]) {
  test(`${days} days: excludes cancelled values and counts from commercial metrics, keeps status population`, () => {
    const report = buildOrderReport(mixed, days, now);
    assert.equal(report.periodOrders.length, 4);
    assert.equal(report.periodOrders.filter(o => o.status === 'CANCELLED').length, 1);
    assert.equal(report.totalRevenue, 100);
    assert.equal(report.deliveredCount, 1);
    assert.equal(report.averageTicket, 100 / 3);
    assert.equal(report.deliveryRate, 33);
    assert.equal(report.trendData.reduce((sum, point) => sum + point.receita, 0), 100);
    assert.equal(report.trendData.reduce((sum, point) => sum + point.pedidos, 0), 3);
    assert.deepEqual(report.topClients.map(c => [c.name, c.revenue, c.orders]), [
      ['delivered', 60, 1], ['pending', 30, 1], ['shipped', 10, 1],
    ]);
  });

  test(`${days} days: only cancelled orders preserve distribution but have no commercial activity`, () => {
    const report = buildOrderReport([mixed[3]], days, now);
    assert.equal(report.periodOrders.length, 1);
    assert.equal(report.totalRevenue, 0);
    assert.equal(report.deliveredCount, 0);
    assert.equal(report.averageTicket, null);
    assert.equal(report.deliveryRate, null);
    assert.deepEqual(report.topClients, []);
    assert.ok(report.trendData.every(point => point.receita === 0 && point.pedidos === 0));
  });

  test(`${days} days: retains the existing period cutoff for all selections`, () => {
    const report = buildOrderReport([
      order('included', 'PENDING', 10, days - 1),
      order('outside', 'DELIVERED', 1000, days + 1),
      order('old-cancelled', 'CANCELLED', 9000, days + 1),
    ], days, now);
    assert.deepEqual(report.periodOrders.map(o => o.id), ['included']);
    assert.equal(report.totalRevenue, 10);
    assert.equal(report.averageTicket, 10);
    assert.equal(report.deliveryRate, 0);
    assert.deepEqual(report.topClients.map(c => c.name), ['included']);
  });
}

test('cancelling a delivered order removes its revenue, count and ranking contribution', () => {
  const orders = [order('first', 'DELIVERED', 60), order('second', 'PENDING', 40)];
  const before = buildOrderReport(orders, 30, now);
  const after = buildOrderReport([{ ...orders[0], status: 'CANCELLED' }, orders[1]], 30, now);
  assert.equal(before.totalRevenue, 100);
  assert.equal(before.averageTicket, 50);
  assert.equal(before.deliveryRate, 50);
  assert.equal(after.totalRevenue, 40);
  assert.equal(after.averageTicket, 40);
  assert.equal(after.deliveryRate, 0);
  assert.equal(after.deliveredCount, 0);
  assert.deepEqual(after.topClients.map(c => c.name), ['second']);
  assert.equal(after.periodOrders.length, 2);
});

test('ranking aggregates only eligible orders for a client with valid and cancelled purchases', () => {
  const report = buildOrderReport([
    order('a', 'PENDING', 10, 0, 'Cliente A'), order('b', 'DELIVERED', 20, 0, 'Cliente A'),
    order('c', 'CANCELLED', 500, 0, 'Cliente A'), order('d', 'SHIPPED', 40, 0, 'Cliente B'),
  ], 90, now);
  assert.deepEqual(report.topClients.map(c => [c.name, c.revenue, c.orders]), [
    ['Cliente B', 40, 1], ['Cliente A', 30, 2],
  ]);
});

test('empty period and zero-value valid order retain distinct average and delivery states', () => {
  const empty = buildOrderReport([], 30, now);
  assert.equal(empty.totalRevenue, 0);
  assert.equal(empty.averageTicket, null);
  assert.equal(empty.deliveryRate, null);
  assert.deepEqual(empty.topClients, []);
  const zero = buildOrderReport([order('zero', 'DELIVERED', 0)], 30, now);
  assert.equal(zero.averageTicket, 0);
  assert.equal(zero.deliveryRate, 100);
});
