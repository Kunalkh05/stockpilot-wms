# StockPilot WMS — Implementation Plan

## Executive Summary
StockPilot WMS is an enterprise-grade Warehouse Management System engineered for operational precision, strict data integrity, real-time inventory reconciliation, and responsive floor usability.

This document details the multi-phase implementation roadmap to build, verify, and deliver StockPilot WMS.

---

## 1. System Architecture & Tech Stack

### Core Principles
- **Modular Monolith**: Clean domain boundaries (Inventory, Inbound, Outbound, Locations, Reports, IAM) without distributed microservice overhead.
- **Strict Invariants**: Double-entry style stock ledger movements, non-negative sellable stock, transactional reservations, and atomic state transitions.
- **Auditable & Idempotent**: Immutable stock movement records, compensating transactions for adjustments, idempotency keys for receiving/dispatch operations.
- **Operational Ergonomics**: High information density, keyboard navigation, clear status signifiers, zero dead-end routes, tablet/barcode-scanner friendly layouts.

### Technology Choices
- **Backend**: Node.js v20+ / v26 with TypeScript, Express.js (modular REST API under `/api/v1`), Prisma ORM, PostgreSQL 14+, Zod validation schemas, Argon2id/Bcrypt password hashing, Winston/Morgan structured logging, Swagger/OpenAPI documentation.
- **Frontend**: React 18 / 19 with TypeScript, Vite, Tailwind CSS, Radix UI primitives, Lucide React icons, TanStack Query (React Query v5), React Hook Form with Zod resolver, Sonner/Toaster for operational alerts.
- **Testing & QA**: Vitest for unit tests, Supertest for API integration tests, Playwright for end-to-end flows.

---

## 2. Domain Data Model & Inventory Invariants

### Entities & Relationships
1. **IAM & Context**:
   - `User` (email, hashed_password, full_name, role: `ADMIN`, `WAREHOUSE_MANAGER`, `INVENTORY_SPECIALIST`, `PICKER_PACKER`, `RECEIVING_CLERK`, active)
   - `Warehouse` (code, name, address, active, default)
   - `WarehouseMembership` (user_id, warehouse_id, role_override)
2. **Locations & Hierarchy**:
   - `Location` (warehouse_id, zone, aisle, rack, shelf, bin, code e.g. `Z1-A02-R03-S1-B04`, type: `RECEIVING`, `STORAGE`, `PICKING`, `PACKING`, `SHIPPING`, `STAGING`, `QUARANTINE`, status: `ACTIVE`, `LOCKED`, `MAINTENANCE`, capacity_units, occupancy_units)
3. **Products & Catalog**:
   - `Product` (sku, name, description, category_id, uom: `EA`, `BOX`, `PLT`, `KG`, barcode, min_reorder_point, target_stock, unit_cost, unit_price, active)
   - `Category` (name, code, description)
   - `Lot` (product_id, lot_number, manufacture_date, expiry_date, status: `ACTIVE`, `QUARANTINED`, `EXPIRED`)
4. **Inventory Balances & Ledger**:
   - `InventoryBalance` (warehouse_id, location_id, product_id, lot_id [optional], on_hand, reserved, damaged)
   - *Invariant*: `available = on_hand - reserved - damaged >= 0`
   - `StockMovement` (id, reference_type: `PURCHASE_RECEIPT`, `PUTAWAY`, `ORDER_PICK`, `ORDER_SHIP`, `TRANSFER`, `CYCLE_COUNT_ADJUSTMENT`, `RETURN_RESTOCK`, `DAMAGE_WRITE_OFF`, reference_id, product_id, lot_id, source_location_id, destination_location_id, quantity, user_id, reason, created_at)
5. **Inbound Operations**:
   - `Supplier` (code, name, contact_email, phone, address)
   - `PurchaseOrder` (po_number, supplier_id, warehouse_id, status: `DRAFT`, `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED`, order_date, expected_date)
   - `PurchaseOrderItem` (po_id, product_id, expected_qty, received_qty, unit_cost)
   - `Receipt` (receipt_number, po_id, warehouse_id, receiving_location_id, status: `PROCESSING`, `CONFIRMED`, received_by, idempotency_key)
   - `ReceiptItem` (receipt_id, po_item_id, product_id, lot_number, expiry_date, accepted_qty, damaged_qty, rejected_qty, notes)
   - `PutAwayTask` (task_number, receipt_id, product_id, lot_id, source_location_id, suggested_location_id, confirmed_location_id, quantity, status: `PENDING`, `IN_PROGRESS`, `COMPLETED`, assigned_to)
6. **Outbound Operations**:
   - `Customer` (code, name, email, phone, shipping_address)
   - `SalesOrder` (order_number, customer_id, warehouse_id, status: `PENDING`, `ALLOCATED`, `PICKING`, `PICKED`, `PACKED`, `SHIPPED`, `CANCELLED`, `RETURNED`, order_date, required_date, idempotency_key)
   - `SalesOrderItem` (order_id, product_id, requested_qty, allocated_qty, picked_qty, packed_qty, unit_price)
   - `StockReservation` (order_id, order_item_id, product_id, warehouse_id, location_id, lot_id, reserved_qty, status: `ACTIVE`, `RELEASED`, `CONSUMED`)
   - `PickTask` (task_number, order_id, status: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `SHORT_PICKED`, assigned_to)
   - `PickTaskItem` (pick_task_id, order_item_id, product_id, location_id, lot_id, target_qty, picked_qty, discrepancy_reason)
   - `Package` (package_number, order_id, tracking_number, carrier, weight_kg, box_type, packed_by)
   - `Shipment` (shipment_number, order_id, package_id, carrier, tracking_number, dispatched_at, dispatched_by)
7. **Returns & Reverse Logistics**:
   - `ReturnOrder` (rma_number, order_id, customer_id, warehouse_id, status: `REQUESTED`, `RECEIVED`, `INSPECTED`, `CLOSED`, reason)
   - `ReturnOrderItem` (return_order_id, product_id, expected_qty, received_qty, disposition: `RESTOCK`, `QUARANTINE`, `SCRAP`, target_location_id)
8. **System Audit Trail**:
   - `AuditLog` (user_id, action, entity_type, entity_id, ip_address, changes_json, created_at)

---

## 3. Implementation Phases

### Phase 1: Environment & Base Infrastructure
- [x] Workspace audit and tool availability validation (PostgreSQL running locally).
- [ ] Initialize repository structure with root orchestrator (`package.json`, scripts for `build`, `lint`, `typecheck`, `test`, `dev`).
- [ ] Set up `backend` with TypeScript, Express, Prisma ORM schema, PostgreSQL connection, migrations, and seed scripts.
- [ ] Set up `frontend` with Vite, React, TypeScript, Tailwind CSS, Lucide icons, TanStack Query, and Radix UI components.

### Phase 2: Database Schema, Migrations, and Domain Services
- [ ] Write complete Prisma schema modeling all 8 core domains and invariants.
- [ ] Implement database migration and verify indexes and foreign keys.
- [ ] Build transactional Domain Services:
  - `AuthService` (Argon2/Bcrypt hashing, JWT/token verification, RBAC guards).
  - `InventoryService` (balance queries, atomic adjustments, multi-location transfers, availability checks).
  - `InboundService` (PO lifecycle, receipt processing with idempotency, lot tracking, auto-generation of put-away tasks).
  - `OutboundService` (order intake, atomic stock reservation with concurrency lock, pick lists, discrepancy handling, package verification, dispatch).
  - `ReportService` (valuation, aging, stock movements, low-stock reorder, warehouse bin utilization).

### Phase 3: Comprehensive Deterministic Seed Data
- [ ] 2 operational warehouses: East Coast Distribution Center (EDC), West Coast Fulfillment Hub (WCF).
- [ ] Hierarchical locations (Receiving, Bulk Storage, Forward Pick, Packing, Shipping, Quarantine).
- [ ] 50+ real-world industrial & retail products across multiple categories (Industrial Electronics, Safety Gear, Packaging Materials, Precision Tools, Consumables).
- [ ] Suppliers, purchase orders in various statuses (Ordered, Partially Received, Received).
- [ ] Customers, sales orders in lifecycle stages (Pending, Allocated, Picking, Packed, Shipped).
- [ ] Pre-calculated inventory balances, lots with near-expiry dates for FEFO checks, and reconciled stock movements.

### Phase 4: REST API Endpoints & Middlewares
- [ ] Modular controllers mounted under `/api/v1`:
  - `/auth`, `/warehouses`, `/locations`, `/products`, `/inventory`, `/inbound`, `/outbound`, `/returns`, `/reports`, `/audit`, `/users`.
- [ ] Express middleware: request IDs, structured logging, centralized error handler with RFC 7807 error format, JWT RBAC authorization middleware, validation middleware using Zod.
- [ ] OpenAPI / Swagger interactive documentation endpoint at `/api/docs`.

### Phase 5: Production-Grade Frontend Application Shell & Modules
- [ ] Design tokens: neutral cool-gray slate surfaces (`#0f172a`, `#1e293b`, `#f8fafc`), charcoal typography, subtle 1px borders (`#e2e8f0` / `#334155`), restrained amber accent (`#f59e0b` / `#d97706`).
- [ ] Layout shell:
  - Collapsible navigation sidebar with module badges and operational status.
  - Top header with active warehouse selector, global command search (Cmd+K), quick notifications, user profile menu.
  - Responsive drawer for mobile and floor tablet viewports.
- [ ] Feature modules with rich interactive tables, filtering, sorting, pagination, CSV exports, and validated modal workflows:
  - **Dashboard**: High-level KPIs, inventory valuation, active tasks, fulfillment velocity, low stock alerts, quick links.
  - **Inventory Catalog & Balances**: Master list, filters (warehouse, category, stock level), adjustment drawer with reason, location transfer dialog, detail modal with lot history and movement audit trail.
  - **Warehouse Locations**: Interactive zone/aisle/shelf/bin explorer, occupancy meters, status toggles (Active, Locked, Maintenance).
  - **Inbound Management**: Purchase Orders list & creation, Step-by-step Receiving Wizard (capture quantities, inspect lot/expiry, accept/reject), Put-away Task execution.
  - **Outbound Fulfillment**: Sales Order board, Stock Allocation trigger, Guided Pick Task workflow with discrepancy handling, Packing station & Dispatch confirmation.
  - **Returns / RMA**: Reverse logistics receiving and restock/quarantine routing.
  - **Stock Movement Ledger**: Immutable transaction history with filtering by date, product, type, and source/dest bin.
  - **Analytics & Reports**: Inventory Valuation breakdown, Low-Stock Reorder report, FEFO Expiration warnings, Bin Utilization heatmap.
  - **Administration & Security**: User management, RBAC permission matrices, system audit logs, environment configuration.

### Phase 6: Automated Testing & Verification
- [ ] Unit tests (domain inventory invariants, reservation math, availability formulas, permission checks).
- [ ] Integration tests (Supertest test suite exercising end-to-end API workflows with real database transactions).
- [ ] Linting and type checking (zero TypeScript errors, clean ESLint).
- [ ] Production build verification (`npm run build` succeeds for both backend and frontend).

---

## 4. Verification Checkpoints & Deliverables
1. `npm run typecheck` passes with zero errors.
2. `npm run lint` passes cleanly.
3. `npm run test` passes with full coverage on inventory math, reservations, inbound receiving, and outbound dispatch.
4. `npm run build` compiles clean frontend production bundle and backend server.
5. All 18 modules navigable without runtime errors or dead ends.
6. Deterministic seed data verified against movement reconciliation rules.
