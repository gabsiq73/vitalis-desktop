export const CLOSING_MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export function formatClosingPercentage(value: number | null): string {
  return value === null ? '—' : `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
}
export function closingTitle(month: number, movementDays: number): string {
  return `Fechamento do mês ${CLOSING_MONTHS[month - 1]} - ${movementDays} dias`;
}
