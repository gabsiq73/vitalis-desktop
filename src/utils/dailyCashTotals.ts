import type { DailyCashPaymentDTO, PaymentMethod } from '../types';

export function dailyCashTotals(payments: DailyCashPaymentDTO[]) {
  const totals: Record<PaymentMethod, { amount: number; count: number }> = {
    PIX: { amount: 0, count: 0 },
    DINHEIRO: { amount: 0, count: 0 },
    SALDO: { amount: 0, count: 0 },
  };

  for (const payment of payments) {
    const total = totals[payment.paymentMethod];
    total.amount += Math.round(payment.amount * 100);
    total.count += 1;
  }
  const newReceipts = (totals.PIX.amount + totals.DINHEIRO.amount) / 100;
  for (const total of Object.values(totals)) total.amount /= 100;

  return { ...totals, newReceipts };
}
