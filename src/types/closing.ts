export interface ClosingValues {
  waterProfit: number;
  gasProfit: number;
  purchases: number;
  expenses: number;
  dailyBalance: number;
  accumulatedBalance: number;
  withdrawals: number;
}
export interface ClosingMetric { value: number; percentage: number | null }
export interface MonthlyClosingDTO {
  year: number;
  month: number;
  timeZone: string;
  movementDays: number;
  days: (ClosingValues & { date: string })[];
  totals: ClosingValues;
  summary: { revenue: ClosingMetric; purchases: ClosingMetric; expenses: ClosingMetric; profitMargin: ClosingMetric };
  warnings: string[];
}
