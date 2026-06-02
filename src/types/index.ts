export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export type ClientType = 'RETAIL' | 'RESELLER';
export type ClientStatus = 'PAID' | 'OVERDUE';
export type OrderStatus = 'PENDING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID';
export type ProductType = 'WATER' | 'GAS';
export type PaymentMethod = 'PIX' | 'DINHEIRO' | 'SALDO';

export interface ClientResponseDTO {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  balance: number;
  fidelityPoints: number;
  pendingBonusWater: number;
  clientType: ClientType;
  clientStatus: ClientStatus;
}

export interface ProductResponseDTO {
  id: string;
  name: string;
  basePrice: number;
  lastCostPrice?: number;
  type: ProductType;
  isActive: boolean;
}

export interface OrderItemResponseDTO {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subTotal: number;
  bottleExpiration?: string;
  supplierId?: string;
  supplierName?: string;
  gasCostPrice?: number;
  receivedByUs?: boolean;
}

export interface OrderResponseDTO {
  id: string;
  deliveryDate?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  clientId: string;
  clientName: string;
  items: OrderItemResponseDTO[];
  totalValue: number;
  createDate: string;
}

export interface StockResponseDTO {
  productId: string;
  productName: string;
  quantityInStock: number;
  minimumStock: number;
  status: string;
}

export interface LoanedBottleResponseDTO {
  id: string;
  clientId: string;
  clientName: string;
  productId: string;
  productName: string;
  quantity: number;
  loanDate?: string;
  returnDate?: string;
  status: string;
}

export interface PaymentResponseDTO {
  id: string;
  orderId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface ClientRequestBody {
  name: string;
  phone: string;
  address: string;
  notes: string;
  clientType: ClientType;
  clientStatus: ClientStatus;
}

export interface GasSupplierResponseDTO {
  id: string;
  name: string;
  notes?: string;
}

export interface GasSupplierRequestDTO {
  name: string;
  notes?: string;
}

export interface LoanedBottleRequestDTO {
  productId: string;
  clientId: string;
  quantity: number;
  loanDate: string;
}

export type UserRole = 'ADMIN' | 'SELLER';

export interface UserResponseDTO {
  id: string;
  firstName: string;
  lastName?: string;
  username: string;
  email: string;
  userRole: UserRole;
}

export interface UserRequestDTO {
  firstName: string;
  lastName?: string;
  username: string;
  email: string;
  password: string;
  userRole: UserRole;
}

export interface UserUpdateDTO {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  password?: string;
  userRole?: UserRole;
}

export interface ProductRequestDTO {
  name: string;
  basePrice: number;
  lastCostPrice?: number;
  type: ProductType;
}

export interface ProductUpdateDTO {
  name?: string;
  basePrice?: number;
  type?: ProductType;
}

export interface OrderBalanceDTO {
  orderId: string;
  totalValue: number;
  totalPaid: number;
  remainingBalance: number;
}

export interface PaymentRequestDTO {
  paymentDate: string;
  amount: number;
  orderId: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface ClientPriceResponseDTO {
  id: string;
  productId: string;
  productName: string;
  customPrice: number;
}

export interface ClientPriceRequestDTO {
  productId: string;
  customPrice: number;
}

export interface OrderItemRequestBody {
  productId: string;
  quantity: number;
  gasCostPrice?: number;
  receivedByUs?: boolean;
  bottleExpiration?: string;
  supplierId?: string;
}

export interface OrderRequestBody {
  clientId: string;
  items: OrderItemRequestBody[];
  isDelivery: boolean;
  deliveryDate?: string;
}
