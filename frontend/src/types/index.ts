export type Role =
  | 'ADMIN'
  | 'WAREHOUSE_MANAGER'
  | 'INVENTORY_SPECIALIST'
  | 'PICKER_PACKER'
  | 'RECEIVING_CLERK';

export type LocationType =
  | 'RECEIVING'
  | 'STORAGE'
  | 'PICKING'
  | 'PACKING'
  | 'SHIPPING'
  | 'STAGING'
  | 'QUARANTINE';

export type LocationStatus = 'ACTIVE' | 'LOCKED' | 'MAINTENANCE';

export type POStatus =
  | 'DRAFT'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export type SOStatus =
  | 'PENDING'
  | 'ALLOCATED'
  | 'PICKING'
  | 'PICKED'
  | 'PACKED'
  | 'SHIPPED'
  | 'CANCELLED'
  | 'RETURNED';

export type PickTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SHORT_PICKED'
  | 'CANCELLED';

export type MovementType =
  | 'PURCHASE_RECEIPT'
  | 'PUTAWAY'
  | 'ORDER_PICK'
  | 'ORDER_SHIP'
  | 'TRANSFER'
  | 'CYCLE_COUNT_ADJUSTMENT'
  | 'RETURN_RESTOCK'
  | 'DAMAGE_WRITE_OFF';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
  createdAt?: string;
  memberships?: Array<{
    warehouse: Warehouse;
  }>;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  isDefault?: boolean;
}

export interface Location {
  id: string;
  warehouseId: string;
  zone: string;
  aisle: string;
  rack: string;
  shelf: string;
  bin: string;
  code: string;
  barcode?: string;
  type: LocationType;
  status: LocationStatus;
  capacityUnits: number;
  occupancyUnits?: number;
  utilizationPercent?: number;
  inventoryBalances?: Array<{
    id: string;
    onHand: number;
    reserved: number;
    damaged: number;
    available?: number;
    product: { sku: string; name: string };
  }>;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  categoryId: string;
  uom: string;
  barcode?: string;
  minReorderPoint: number;
  targetStock: number;
  unitCost: number;
  unitPrice: number;
  active: boolean;
  category?: Category;
}

export interface Lot {
  id: string;
  productId: string;
  lotNumber: string;
  manufactureDate?: string;
  expiryDate?: string;
  status: 'ACTIVE' | 'QUARANTINED' | 'EXPIRED';
}

export interface InventoryBalance {
  id: string;
  warehouseId: string;
  locationId: string;
  productId: string;
  lotId?: string | null;
  onHand: number;
  reserved: number;
  damaged: number;
  available: number;
  isLowStock?: boolean;
  valuation: number;
  warehouse: Warehouse;
  location: Location;
  product: Product;
  lot?: Lot | null;
}

export interface StockMovement {
  id: string;
  referenceType: MovementType;
  referenceId: string;
  productId: string;
  lotId?: string | null;
  sourceLocationId?: string | null;
  destinationLocationId?: string | null;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  userId?: string | null;
  reason?: string | null;
  createdAt: string;
  product: { id: string; sku: string; name: string; uom: string };
  lot?: { id: string; lotNumber: string } | null;
  sourceLocation?: { id: string; code: string; type: LocationType } | null;
  destinationLocation?: { id: string; code: string; type: LocationType } | null;
  user?: { id: string; fullName: string; role: Role } | null;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactEmail: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  email: string;
  phone?: string;
  shippingAddress: string;
  city: string;
  state: string;
  postalCode?: string;
  country?: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  expectedQty: number;
  receivedQty: number;
  unitCost: number;
  product: Product;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  warehouseId: string;
  status: POStatus;
  orderDate: string;
  expectedDate?: string | null;
  notes?: string | null;
  supplier: Supplier;
  warehouse: Warehouse;
  items: PurchaseOrderItem[];
}

export interface PutAwayTask {
  id: string;
  taskNumber: string;
  receiptId?: string | null;
  productId: string;
  lotId?: string | null;
  sourceLocationId: string;
  suggestedLocationId: string;
  confirmedLocationId?: string | null;
  quantity: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  product: Product;
  lot?: Lot | null;
  sourceLocation: Location;
  suggestedLocation: Location;
  confirmedLocation?: Location | null;
}

export interface SalesOrderItem {
  id: string;
  salesOrderId: string;
  productId: string;
  requestedQty: number;
  allocatedQty: number;
  pickedQty: number;
  packedQty: number;
  unitPrice: number;
  product: Product;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  warehouseId: string;
  status: SOStatus;
  orderDate: string;
  requiredDate?: string | null;
  shippingCarrier?: string | null;
  trackingNumber?: string | null;
  customer: Customer;
  warehouse: Warehouse;
  items: SalesOrderItem[];
  packages?: any[];
  shipments?: any[];
}

export interface StockReservation {
  id: string;
  salesOrderId: string;
  salesOrderItemId: string;
  productId: string;
  warehouseId: string;
  locationId: string;
  lotId?: string | null;
  reservedQty: number;
  status: 'ACTIVE' | 'CONSUMED' | 'RELEASED';
  createdAt: string;
  product: { id: string; sku: string; name: string; uom: string };
  location: { id: string; code: string; type: LocationType };
  salesOrder: { id: string; orderNumber: string; status: SOStatus; customer: { name: string } };
  lot?: { lotNumber: string; expiryDate?: string } | null;
}

export interface PickTaskItem {
  id: string;
  pickTaskId: string;
  salesOrderItemId: string;
  productId: string;
  locationId: string;
  lotId?: string | null;
  targetQty: number;
  pickedQty: number;
  discrepancyReason?: string | null;
  product: Product;
  location: Location;
  lot?: Lot | null;
}

export interface PickTask {
  id: string;
  taskNumber: string;
  salesOrderId: string;
  status: PickTaskStatus;
  createdAt: string;
  salesOrder: {
    id: string;
    orderNumber: string;
    customer: { name: string };
  };
  items: PickTaskItem[];
  assignedTo?: { id: string; fullName: string } | null;
}

export interface ReturnOrder {
  id: string;
  rmaNumber: string;
  salesOrderId?: string | null;
  customerId: string;
  warehouseId: string;
  status: 'REQUESTED' | 'RECEIVED' | 'INSPECTED' | 'CLOSED';
  reason?: string | null;
  createdAt: string;
  customer: Customer;
  salesOrder?: { orderNumber: string } | null;
  items: Array<{
    id: string;
    productId: string;
    expectedQty: number;
    receivedQty: number;
    disposition: 'RESTOCK' | 'QUARANTINE' | 'SCRAP';
    product: Product;
    targetLocation?: Location | null;
  }>;
}

export interface DashboardSummary {
  kpi: {
    totalSellableUnits: number;
    totalOnHandUnits: number;
    totalReservedUnits: number;
    totalDamagedUnits: number;
    totalValuation: number;
    openOrdersCount: number;
    awaitingPickingCount: number;
    receiptsAwaitingProcessingCount: number;
    pendingPutAwaysCount: number;
    lowStockCount: number;
  };
  categoryBreakdown: Array<{
    category: string;
    units: number;
    valuation: number;
  }>;
  recentMovements: StockMovement[];
  priorityTasks: Array<{
    id: string;
    type: string;
    title: string;
    priority: string;
    status: string;
    createdAt: string;
  }>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}
