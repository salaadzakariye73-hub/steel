export type UserRole = 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'STOREKEEPER';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  isActive?: boolean;
  lastLoginAt?: string;
}

export interface Product {
  _id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  totalQuantity: number;
  availableQuantity: number;
  rentedQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  purchasePrice: number;
  dailyRentalPrice: number;
  minStockThreshold: number;
  imageUrl: string;
  warehouseLocation: string;
  isActive: boolean;
  createdAt: string;
}

export interface InventoryTransaction {
  _id: string;
  product: { _id: string; name: string; sku: string };
  type: 'STOCK_IN' | 'RENTAL_OUT' | 'RETURN_IN' | 'DAMAGED' | 'LOST' | 'REPAIRED' | 'ADJUSTMENT';
  quantity: number;
  previousAvailable: number;
  newAvailable: number;
  rental?: { _id: string; rentalNumber: string };
  performedBy?: { _id: string; name: string; role: string };
  notes: string;
  createdAt: string;
}

export interface Customer {
  _id: string;
  customerCode: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  companyName: string;
  identificationNumber: string;
  registrationDate: string;
  notes: string;
  activeProjectsCount?: number;
  totalProjectsCount?: number;
  activeRentalsCount?: number;
  totalBilled?: number;
  totalPaid?: number;
  outstandingBalance?: number;
}

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export interface Project {
  _id: string;
  projectCode: string;
  name: string;
  customer: Customer | string;
  location: string;
  startDate: string;
  expectedCompletionDate: string;
  status: ProjectStatus;
  description: string;
  rentalCount?: number;
  activeRentalCount?: number;
  totalRentalValue?: number;
}

export type RentalStatus = 'ACTIVE' | 'PARTIALLY_RETURNED' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED';

export interface RentalItem {
  _id: string;
  rental: string;
  product: Product;
  initialQuantity: number;
  returnedQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  remainingQuantity: number;
  dailyRate: number;
  lastPeriodStartDate: string;
  accruedCharge: number;
}

export interface RentalReturn {
  _id: string;
  returnNumber: string;
  rental: string;
  returnDate: string;
  isFinalReturn: boolean;
  items: {
    rentalItem: string;
    product: string;
    productName: string;
    returnedGoodQty: number;
    damagedQty: number;
    lostQty: number;
    quantityHeldBeforeReturn: number;
    periodStartDate: string;
    periodEndDate: string;
    periodDays: number;
    dailyRate: number;
    periodCharge: number;
    replacementCharge: number;
  }[];
  totalPeriodCharge: number;
  totalReplacementCharge: number;
  notes: string;
  processedBy?: { name: string; role: string };
}

export interface InvoiceLineItem {
  description: string;
  productName: string;
  quantity: number;
  dailyRate: number;
  days: number;
  fromDate: string;
  toDate: string;
  amount: number;
  lineType: 'CLOSED_PERIOD' | 'ACTIVE_PERIOD' | 'DAMAGE_LOSS';
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  rental: Rental | string;
  customer: Customer;
  project: Project;
  issueDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  depositAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';
  notes: string;
}

export interface Rental {
  _id: string;
  rentalNumber: string;
  customer: Customer;
  project: Project;
  startDate: string;
  expectedReturnDate: string;
  actualCloseDate?: string;
  status: RentalStatus;
  depositAmount: number;
  accruedClosedCharge: number;
  damageChargeTotal: number;
  expectedTotalCharge: number;
  notes: string;
  extensions: {
    previousReturnDate: string;
    newReturnDate: string;
    additionalEstimatedCharge: number;
    reason: string;
    extendedAt: string;
  }[];
  items?: RentalItem[];
  invoice?: Invoice | null;
  totalInitialUnits?: number;
  totalRemainingUnits?: number;
  currentDailyRate?: number;
  createdBy?: { name: string; role: string };
}

export type PaymentMethod = 'CASH_USD' | 'CASH_SOS' | 'MOBILE_MONEY' | 'BANK_TRANSFER';

export interface Payment {
  _id: string;
  paymentNumber: string;
  customer: Customer;
  rental: { _id: string; rentalNumber: string };
  invoice: {
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount?: number;
    balanceAmount: number;
    status: string;
  };
  amount: number;
  currency: 'USD' | 'SOS';
  exchangeRate: number;
  usdEquivalent: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  referenceNumber?: string;
  notes: string;
  receivedBy?: { name: string; role: string };
}

export interface DamageRecord {
  _id: string;
  recordNumber: string;
  product: Product;
  rental?: { _id: string; rentalNumber: string; status: string };
  customer?: { _id: string; name: string; companyName: string; phone: string };
  damagedQuantity: number;
  lostQuantity: number;
  damageDescription: string;
  inspectionDate: string;
  replacementCost: number;
  responsibility: 'CUSTOMER' | 'COMPANY' | 'SHARED';
  resolved: boolean;
  notes: string;
  inspectedBy?: { name: string; role: string };
}

export interface Expense {
  _id: string;
  expenseNumber: string;
  category: 'MAINTENANCE' | 'TRANSPORT' | 'WAREHOUSE' | 'SALARIES' | 'UTILITIES' | 'PURCHASE' | 'OTHER';
  description: string;
  amount: number;
  currency: 'USD' | 'SOS';
  usdEquivalent: number;
  expenseDate: string;
  vendor: string;
  recordedBy?: { name: string };
}

export interface NotificationItem {
  _id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  titleSo: string;
  message: string;
  messageSo: string;
  relatedEntityType: string;
  relatedEntityId: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  _id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface DashboardData {
  kpis: {
    totalInventory: number;
    availableProps: number;
    rentedProps: number;
    returnedProps: number;
    damagedProps: number;
    lostProps: number;
    activeRentals: number;
    overdueRentals: number;
    totalRentalRevenue: number;
    totalPaymentsReceived: number;
    outstandingBalances: number;
    totalExpenses: number;
    netCashProfit: number;
  };
  monthlyChart: {
    key: string;
    label: string;
    billedRevenue: number;
    cashCollected: number;
    expenses: number;
  }[];
  recentRentals: Rental[];
  overdueList: Rental[];
  lowStockProducts: Product[];
  stockByCategory: {
    id: string;
    name: string;
    sku: string;
    available: number;
    rented: number;
    damaged: number;
    lost: number;
    total: number;
  }[];
}
