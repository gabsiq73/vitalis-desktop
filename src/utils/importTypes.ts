import type { ClientType, ProductType } from '../types';

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = { RETAIL: 'Varejo', RESELLER: 'Revenda', AVULSO: 'Avulso' };
export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = { WATER: 'Água', GAS: 'Gás', FULL_BOTTLE: 'Garrafão completo', EXPIRED_BOTTLE: 'Garrafão vencido' };

function normalize(value?: string): string {
  return (value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

export function parseClientType(value?: string): ClientType | undefined {
  const types: Record<string, ClientType> = { VAREJO: 'RETAIL', RETAIL: 'RETAIL', REVENDA: 'RESELLER', REVENDEDOR: 'RESELLER', RESELLER: 'RESELLER', AVULSO: 'AVULSO' };
  return types[normalize(value)];
}

export function parseProductType(value?: string): ProductType | undefined {
  const types: Record<string, ProductType> = { AGUA: 'WATER', WATER: 'WATER', GAS: 'GAS', 'GARRAFAO COMPLETO': 'FULL_BOTTLE', GARRAFAO_COMPLETO: 'FULL_BOTTLE', FULL_BOTTLE: 'FULL_BOTTLE', 'GARRAFAO VENCIDO': 'EXPIRED_BOTTLE', GARRAFAO_VENCIDO: 'EXPIRED_BOTTLE', EXPIRED_BOTTLE: 'EXPIRED_BOTTLE' };
  return types[normalize(value)];
}
