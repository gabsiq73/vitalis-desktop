import type { CashMovementDirection, CashMovementRequestDTO, CashMovementResponseDTO, CashMovementType } from '../types';

export function cashMovementDirection(movement: Pick<CashMovementResponseDTO, 'type' | 'direction'>): CashMovementDirection | null {
  if (movement.type === 'ENTRY') return 'IN';
  if (movement.type === 'WITHDRAWAL') return 'OUT';
  return movement.direction;
}

export function cashDifference(counted: number, balance: number): number {
  return (Math.round(counted * 100) - Math.round(balance * 100)) / 100;
}

export function buildCashMovement(input: {
  type: CashMovementType;
  amount: number;
  direction: CashMovementDirection;
  occurredAt: string;
  note: string;
  counted?: number;
  balance?: number;
}): CashMovementRequestDTO | null {
  const { type, occurredAt } = input;
  const note = input.note.trim();
  if (!occurredAt || !Number.isFinite(new Date(occurredAt).getTime())) throw new Error('Informe uma data e horário válidos.');
  if (note.length > 255) throw new Error('O motivo deve ter até 255 caracteres.');
  if (type === 'WITHDRAWAL' && !note) throw new Error('Informe o motivo da retirada.');
  let amount = input.amount;
  let direction = input.direction;
  if (type === 'ADJUSTMENT' && input.counted !== undefined) {
    if (!Number.isFinite(input.counted) || input.counted < 0) throw new Error('Informe um valor conferido maior ou igual a zero.');
    if (input.balance === undefined || !Number.isFinite(input.balance)) throw new Error('Saldo do caixa indisponível para conferência.');
    const difference = cashDifference(input.counted, input.balance);
    if (difference === 0) return null;
    amount = Math.abs(difference);
    direction = difference > 0 ? 'IN' : 'OUT';
  }
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) <= 0 || amount > 99999999.99) {
    throw new Error('Informe um valor positivo de até R$ 99.999.999,99.');
  }
  const common = { amount: Math.round(amount * 100) / 100, occurredAt, note: note || null };
  return type === 'ADJUSTMENT' ? { ...common, type, direction } : { ...common, type };
}
