export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface ClientResponseDTO {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  type: string;
  status: string;
  balance: number;
  fidelityPoints: number;
  isActive: boolean;
}

export interface OrderItemResponseDTO {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
}

export interface OrderResponseDTO {
  id: string;
  clientId: string;
  clientName: string;
  totalValue: number;
  status: string;
  paymentStatus: string;
  createDate: string;
  lastModifiedDate: string;
  items: OrderItemResponseDTO[];
}

export interface StockResponseDTO {
  id: string;
  productName: string;
  quantity: number;
  status: string;
}
