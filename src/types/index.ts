export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export type ClientType = 'RETAIL' | 'RESELLER' | 'AVULSO';
export type ClientStatus = 'PAID' | 'OVERDUE';
export type OrderStatus = 'PENDING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
export type ProductType = 'WATER' | 'GAS';
export type PaymentMethod = 'PIX' | 'DINHEIRO' | 'SALDO';
export type GasPaymentMethod = Extract<PaymentMethod, 'PIX' | 'DINHEIRO'>;

export interface ClientResponseDTO {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  balance: number;
  clientType: ClientType;
  clientStatus: ClientStatus;
  orderCount?: number;
}

export interface ProductResponseDTO {
  id: string;
  name: string;
  basePrice: number;
  resellerPrice?: number;
  lastCostPrice?: number;
  type: ProductType;
  isActive: boolean;
  defaultSupplierId?: string;
  defaultSupplierName?: string;
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
  receivedByUs?: boolean | null;
  gasPaymentMethod?: PaymentMethod | null;
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
  isDelivery?: boolean;
  loanedBottlesCount?: number;
  notes?: string;
}

export interface ConfirmDeliveryRequestDTO {
  gasPayments: {
    orderItemId: string;
    receivedByUs: boolean;
    gasPaymentMethod: PaymentMethod | null;
  }[];
}

export type StockStatus = 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface StockResponseDTO {
  productId: string;
  productName: string;
  quantityInStock: number;
  minimumStock: number;
  status: StockStatus;
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
  orderId?: string;
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

export type SettlementType = 'YOU_OWE' | 'SUPPLIER_OWE';

export interface GasSettlementResponseDTO {
  id: string;
  supplierName: string;
  amount: number;
  settled: boolean;
  settledDate?: string;
  settlementType: SettlementType;
  orderItemId?: string;
  createDate: string;
  clientName?: string;
  productName?: string;
  quantity?: number;
  salePrice?: number;
  costPrice?: number;
}

export interface GasSupplierRequestDTO {
  name: string;
  notes?: string;
}

export interface LoanedBottleRequestDTO {
  productId: string;
  clientId: string;
  quantity: number;
  loanDate: string | null;
  orderId?: string;
}

export interface DepotBottleDebtRequestDTO {
  clientId: string;
  quantity: number;
  debtDate: string;
  notes?: string | null;
}

export interface DepotBottleDebtResponseDTO {
  id: string;
  clientId: string;
  clientName: string;
  quantity: number;
  debtDate: string;
  notes: string | null;
  status: 'PENDING' | 'COMPLETED';
  completionDate: string | null;
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
  resellerPrice?: number;
  lastCostPrice?: number;
  type: ProductType;
  defaultSupplierId?: string;
}

export interface ProductUpdateDTO {
  name?: string;
  basePrice?: number;
  resellerPrice?: number;
  type?: ProductType;
  lastCostPrice?: number;
  defaultSupplierId?: string;
}

export interface OrderBalanceDTO {
  orderId: string;
  totalValue: number;
  totalPaid: number;
  remainingBalance: number;
}

export interface SystemConfigDTO {
  pickupDiscountCents: number;
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

export interface DailyCashPaymentDTO {
  id: string;
  orderId: string | null;
  orderRef: string;
  clientName: string;
  paymentDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  entryType: 'PAYMENT' | 'CLIENT_CREDIT';
}

export interface DailyReportDTO {
  totalPix: number;
  totalCash: number;
  totalBalanceUsed: number;
  totalDebt: number;
  totalCreditGenerated: number;
  totalWaterSold: number;
  totalGasSold: number;
}

export type CashMovementType = 'ENTRY' | 'ADJUSTMENT' | 'WITHDRAWAL';
export type CashMovementDirection = 'IN' | 'OUT';

export type CashMovementRequestDTO = {
  amount: number;
  occurredAt: string;
  note: string | null;
} & (
  | { type: 'ENTRY' | 'WITHDRAWAL'; direction?: never }
  | { type: 'ADJUSTMENT'; direction: CashMovementDirection }
);

export interface CashMovementResponseDTO {
  id: string;
  type: CashMovementType;
  amount: number;
  direction: CashMovementDirection | null;
  occurredAt: string;
  note: string | null;
  createdAt: string;
}

export interface GasSettlementMovementDTO {
  id: string;
  supplierName: string;
  type: SettlementType;
  direction: CashMovementDirection;
  amount: number;
  settledDate: string;
}

export interface FinancialReportDTO {
  totalInvoiced: number;
  totalReceived: number;
  gasGrossProfit: number;
  getBalance: number;
  totalEntries: number;
  totalAdjustments: number;
  totalWithdrawals: number;
  finalBalance: number;
  cashMovements: CashMovementResponseDTO[];
  gasSettlementsIn: number;
  gasSettlementsOut: number;
  gasSettlementMovements: GasSettlementMovementDTO[];
}

export interface OrderItemRequestBody {
  productId: string;
  quantity: number;
  unitPrice?: number;
  gasCostPrice?: number;
  receivedByUs?: boolean;
  gasPaymentMethod?: GasPaymentMethod;
  bottleExpiration?: string;
  supplierId?: string;
}

export interface InitialPaymentRequestBody {
  amount: number;
  paymentMethod: PaymentMethod;
}

export interface OrderRequestBody {
  clientId: string;
  items: OrderItemRequestBody[];
  initialPayments?: InitialPaymentRequestBody[];
  isDelivery: boolean;
  deliveryDate?: string;
  notes?: string;
}
