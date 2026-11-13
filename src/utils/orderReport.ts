import type { OrderResponseDTO } from '../types';

function groupByDay(orders: OrderResponseDTO[], days: number, now: Date) {
  const buckets: Record<string, { date: string; receita: number; pedidos: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[key] = { date: key, receita: 0, pedidos: 0 };
  }
  for (const o of orders) {
    const d = new Date(o.createDate);
    const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) {
      buckets[key].receita += o.totalValue;
      buckets[key].pedidos += 1;
    }
  }
  return Object.values(buckets);
}

function groupByWeek(orders: OrderResponseDTO[]) {
  const buckets: Record<string, { date: string; receita: number; pedidos: number }> = {};
  for (const o of orders) {
    const d = new Date(o.createDate);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = `${String(weekStart.getDate()).padStart(2, '0')}/${String(weekStart.getMonth() + 1).padStart(2, '0')}`;
    if (!buckets[key]) buckets[key] = { date: key, receita: 0, pedidos: 0 };
    buckets[key].receita += o.totalValue;
    buckets[key].pedidos += 1;
  }
  return Object.values(buckets).sort((a, b) => {
    const [da, ma] = a.date.split('/').map(Number);
    const [db, mb] = b.date.split('/').map(Number);
    return ma !== mb ? ma - mb : da - db;
  });
}

export function buildOrderReport(orders: OrderResponseDTO[], days: number, now = new Date()) {
  const cutoff = new Date(now.getTime() - days * 86400000);
  const periodOrders = orders.filter(o => new Date(o.createDate) >= cutoff);
  const commercialOrders = periodOrders.filter(o => o.status !== 'CANCELLED');
  const trendData = days <= 30 ? groupByDay(commercialOrders, days, now) : groupByWeek(commercialOrders);
  const totalRevenue = commercialOrders.reduce((sum, order) => sum + order.totalValue, 0);
  const deliveredCount = commercialOrders.filter(o => o.status === 'DELIVERED').length;
  const commercialCount = commercialOrders.length;
  const averageTicket = commercialCount > 0 ? totalRevenue / commercialCount : null;
  const deliveryRate = commercialCount > 0 ? Math.round((deliveredCount / commercialCount) * 100) : null;

  // Top clients by revenue
  const clientRevenue: Record<string, { name: string; revenue: number; orders: number }> = {};
  for (const o of commercialOrders) {
    if (!clientRevenue[o.clientId]) clientRevenue[o.clientId] = { name: o.clientName, revenue: 0, orders: 0 };
    clientRevenue[o.clientId].revenue += o.totalValue;
    clientRevenue[o.clientId].orders += 1;
  }
  const topClients = Object.values(clientRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map(c => ({ ...c, name: c.name.length > 16 ? c.name.slice(0, 16) + '…' : c.name }));

  return { periodOrders, trendData, totalRevenue, deliveredCount, averageTicket, deliveryRate, topClients };
}
