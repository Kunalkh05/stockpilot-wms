# StockPilot WMS — Architecture & Design Document

## 1. Architectural Overview

StockPilot WMS is designed as an operational, high-reliability Modular Monolith. It unifies backend API services, relational transactional storage, and a responsive frontend client.

```
+-----------------------------------------------------------------------------------+
|                               StockPilot Client UI                                |
|  React 18/19 | Vite | TypeScript | Tailwind CSS | Radix Primitives | TanStack Query |
+-----------------------------------------------------------------------------------+
                                         |  HTTPS / REST JSON
                                         v
+-----------------------------------------------------------------------------------+
|                               Express API Gateway                                 |
|      /api/v1 (CORS, Rate Limiter, Request ID, Zod Validation, JWT RBAC Guard)     |
+-----------------------------------------------------------------------------------+
                                         |
     +-----------------+-----------------+-----------------+-----------------+
     |                 |                 |                 |                 |
     v                 v                 v                 v                 v
+----------+     +----------+     +----------+     +----------+     +----------+
|  IAM &   |     |Inventory |     | Inbound  |     | Outbound |     | Reports  |
|  Auth    |     | Ledger   |     | Receiving|     | Picking  |     | & Audit  |
|  Service |     | Service  |     | Service  |     | Service  |     | Service  |
+----------+     +----------+     +----------+     +----------+     +----------+
     |                 |                 |                 |                 |
     +-----------------+-----------------+-----------------+-----------------+
                                         |  Prisma Client (Interactive Transactions)
                                         v
+-----------------------------------------------------------------------------------+
|                        PostgreSQL 14+ Transactional Store                         |
|   Strict Foreign Keys, Unique & Check Constraints, Compound Indexes, Row Locks    |
+-----------------------------------------------------------------------------------+
```

---

## 2. Core Domain Models & Invariants

### 2.1 The Inventory Ledger Invariant
Inventory is tracked at the granular level: `(warehouse_id, location_id, product_id, lot_id)`.
Every balance maintains three essential counters:
- `on_hand`: Physical quantity currently present in the bin.
- `reserved`: Quantity earmarked for active customer sales orders undergoing fulfillment.
- `damaged`: Physical quantity flagged as defective, awaiting quarantine, inspection, or write-off.

**Mathematical Invariants**:
1. `on_hand >= 0` at all times (ordinary warehouse operations can never create phantom negative inventory).
2. `reserved >= 0` and `reserved <= (on_hand - damaged)`.
3. `available = on_hand - reserved - damaged`. Available quantity represents sellable, allocate-ready stock.
4. `available >= 0`. Any attempt to allocate stock when `requested_qty > available` throws a domain violation `INSUFFICIENT_AVAILABLE_STOCK`.

### 2.2 Ledger Movement Reconciliation
Stock records are never modified in isolation without a matching `StockMovement` ledger entry:
```
Delta(Balance.on_hand) == Sum(Movements.to_location) - Sum(Movements.from_location)
```
- Movement types are strictly typed:
  - `PURCHASE_RECEIPT`: Credits receiving bin.
  - `PUTAWAY`: Debits receiving bin, credits storage/picking bin.
  - `ORDER_PICK`: Transfers stock from storage/picking to packing/staging.
  - `ORDER_SHIP`: Debits packing/staging bin permanently, decrementing `on_hand` and clearing `reserved`.
  - `TRANSFER`: Debits source bin, credits destination bin within an atomic transaction.
  - `CYCLE_COUNT_ADJUSTMENT`: Compensating delta with mandatory documented audit reason.
  - `RETURN_RESTOCK`: Credits inspected good stock back to active bin.
  - `DAMAGE_QUARANTINE`: Increments `damaged` counter, decrementing `available`.

### 2.3 Concurrency Control & Overselling Prevention
When allocating customer orders or picking high-velocity SKUs concurrently:
- Transactions acquire row-level locks on `InventoryBalance` records (`SELECT ... FOR UPDATE` via Prisma `$transaction` with serializable or isolation guarantees).
- Alternatively, atomic conditional SQL increments are utilized:
  ```sql
  UPDATE inventory_balances
  SET reserved = reserved + $qty
  WHERE id = $id AND (on_hand - reserved - damaged) >= $qty;
  ```
  If zero rows are updated, the transaction aborts and returns an availability conflict, ensuring zero overselling.

---

## 3. Inbound Lifecycle (PO -> Put-Away)

```
[Purchase Order Created]
         |
         v
[Supplier Ships Goods]
         |
         v
[Receiving Session at Inbound Dock (Idempotency Key Checked)]
  ├── Capture SKU & Barcode Scan
  ├── Validate against PO Item Expected Qty
  ├── Capture Lot Number & Expiration Date
  ├── Record Quantities:
  │     ├── Accepted -> credited to RECEIVING bin on_hand
  │     ├── Damaged  -> credited to QUARANTINE bin
  │     └── Rejected -> returned to supplier (no inventory credit)
  └── Receipt Confirmed -> PO updated to PARTIALLY_RECEIVED or RECEIVED
         |
         v
[Auto-generate Put-Away Tasks]
  ├── System suggests optimal storage bin based on Zone & SKU velocity
  ├── Warehouse operator confirms physically stored destination bin
  └── Atomic transfer: RECEIVING bin -> Final STORAGE bin
```

---

## 4. Outbound Lifecycle (Order -> Dispatch)

```
[Sales Order Received] (Status: PENDING)
         |
         v
[Stock Allocation Engine]
  ├── Queries available stock across eligible storage bins (FIFO/FEFO order)
  ├── Reserves stock atomically (Status: ALLOCATED)
  └── Generates Pick Task with bin-sequenced routing
         |
         v
[Floor Picking Operation]
  ├── Operator picks items in aisle/shelf order
  ├── Handles discrepancies (Short Pick -> notifies inventory lead)
  └── Pick confirmed (Status: PICKED, items staged at Packing Station)
         |
         v
[Packing Station Verification]
  ├── Barcode scan verification against order manifest
  ├── Package created: weight, dimensions, box type recorded
  └── Packing slip generated (Status: PACKED)
         |
         v
[Shipping & Dispatch]
  ├── Carrier selected, tracking number captured
  ├── Dispatch Confirmed:
  │     ├── Balance on_hand decremented
  │     ├── Balance reserved cleared
  │     └── StockMovement (ORDER_SHIP) committed
  └── Order status -> SHIPPED
```

---

## 5. Security & Server-Enforced RBAC

### Role Matrix
| Permission / Action | ADMIN | WAREHOUSE_MANAGER | INVENTORY_SPECIALIST | PICKER_PACKER | RECEIVING_CLERK |
|---|:---:|:---:|:---:|:---:|:---:|
| User & Role Management | ✓ | ✗ | ✗ | ✗ | ✗ |
| Warehouse Configuration | ✓ | ✓ | ✗ | ✗ | ✗ |
| Inventory Adjustment (Manual) | ✓ | ✓ | ✗ | ✗ | ✗ |
| Stock Transfer | ✓ | ✓ | ✓ | ✗ | ✗ |
| Inbound PO Creation | ✓ | ✓ | ✓ | ✗ | ✗ |
| Inbound Receiving / Put-Away | ✓ | ✓ | ✓ | ✗ | ✓ |
| Outbound Order Creation | ✓ | ✓ | ✓ | ✗ | ✗ |
| Outbound Pick & Pack | ✓ | ✓ | ✓ | ✓ | ✗ |
| Outbound Shipment Dispatch | ✓ | ✓ | ✓ | ✓ | ✗ |
| View Financial Valuation Reports | ✓ | ✓ | ✗ | ✗ | ✗ |
| View Operational Reports | ✓ | ✓ | ✓ | ✓ | ✓ |
| View Audit Logs | ✓ | ✓ | ✗ | ✗ | ✗ |

### Authentication & Token Flow
- Standard JWT bearer tokens signed with a cryptographically secure server secret.
- Passwords salted and hashed with `bcrypt` / `argon2`.
- Timing-attack-resistant comparison.
- Rate limiting on `/api/v1/auth/*` endpoints (prevents brute-force attacks).
- Request ID attached via `X-Request-ID` to all HTTP requests and structured log entries.

---

## 6. Directory Structure

```
warehouse-management-system/
├── backend/
│   ├── src/
│   │   ├── config/             # Environment, DB client, logger
│   │   ├── controllers/        # Express route handlers
│   │   ├── middlewares/        # Auth, RBAC, Validation, Error Handler, RequestID
│   │   ├── routes/             # Versioned express routers (/api/v1)
│   │   ├── services/           # Core domain logic & transactions
│   │   ├── types/              # Domain & request DTO interfaces
│   │   ├── utils/              # Calculation helpers, CSV generation
│   │   └── server.ts           # Express server entry point
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema & indexes
│   │   ├── migrations/         # SQL migration history
│   │   └── seed.ts             # Deterministic 50+ product seed data
│   ├── tests/
│   │   ├── unit/               # Inventory math, reservation, invariants
│   │   └── integration/        # Supertest API endpoint workflows
│   ├── tsconfig.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── assets/             # Brand logos & icons
│   │   ├── components/         # Reusable UI primitives (Tables, Badges, Modals, Forms)
│   │   ├── context/            # AuthContext, WarehouseContext
│   │   ├── hooks/              # Custom TanStack Query hooks
│   │   ├── layouts/            # AppShell, CollapsibleSidebar, Header, Breadcrumbs
│   │   ├── pages/              # 18 Domain Pages (Dashboard, Inventory, Receiving, etc.)
│   │   ├── services/           # Axios / Fetch client API wrappers
│   │   ├── types/              # Frontend TypeScript definitions
│   │   ├── utils/              # Formatting, CSV exporter, date helpers
│   │   ├── App.tsx             # Route definitions & Query Client Provider
│   │   ├── main.tsx            # Entry point
│   │   └── index.css           # Tailwind custom styles & tokens
│   ├── public/
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── package.json                # Root workspace orchestrator
├── tsconfig.json
├── .gitignore
├── .env.example
├── README.md
├── IMPLEMENTATION_PLAN.md
├── IMPLEMENTATION_STATUS.md
└── ARCHITECTURE.md
```
