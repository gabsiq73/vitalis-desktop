import type { StockResponseDTO, StockStatus } from '../types';

// Mesma regra de StockMapper: zerado tem prioridade; mínimo é inclusivo.
export function getStockStatus(stock: Pick<StockResponseDTO, 'quantityInStock' | 'minimumStock'>): StockStatus {
  if (stock.quantityInStock <= 0) return 'OUT_OF_STOCK';
  return stock.quantityInStock <= stock.minimumStock ? 'LOW_STOCK' : 'NORMAL';
}

export function isStockLow(stock: Pick<StockResponseDTO, 'quantityInStock' | 'minimumStock'>): boolean {
  return getStockStatus(stock) !== 'NORMAL';
}
