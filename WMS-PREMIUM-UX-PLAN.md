# StockPilot WMS — Premium UI/UX Refinement Plan

## Mission & Principles
Transform StockPilot WMS into a calm, precise, and dependable B2B operations tool for Indian e-commerce fulfillment centers, FMCG warehouses, wholesalers, and multi-branch retailers. 

- **Restrained Visual Polish**: Soft neutral canvas (`#f8fafc`), crisp white cards, charcoal typography (`#0f172a`), cool grey borders (`#e2e8f0`), deep indigo/slate brand accent (`#1e293b`), consistent 4/8px spacing, small radii.
- **Indian Locale Precision**: Indian Rupee formatting (`₹1,24,500`), Indian number grouping (`en-IN`), consistent `Asia/Kolkata` (IST) timestamp formatting.
- **Compact Information Architecture**: Reduce 16-item sidebar to 7 high-frequency operational routes (Home, Orders, Inventory, Inward, Outward, Locations, Reports) with secondary administration grouped cleanly.
- **Action-Oriented Workflows**:
  - **Home**: "Today at the warehouse" with <=4 clickable operational metrics, deliberate two-column layout (Work Queue + Needs Attention), and one real-data operational chart.
  - **Orders**: Work queue first with fulfillment stage views (All, New, To Pick, To Pack, Dispatched, Exceptions) and order inspection drawer.
  - **Inventory**: Instant multi-field stock lookup, clear quantity semantics (`Available = On Hand - Reserved - Damaged`), and product detail drawer.
  - **Inward**: 5-stage receiving wizard with real-time summary panel and duplicate-submission guards.
  - **Outward**: Guided picking with prominent bin guidance, real line progress, and packing/dispatch pipeline.
  - **Locations**: Scannable bin hierarchy and capacity utilization.
  - **Reports**: Data-backed valuation, reorder deficits, lot aging, and capacity metrics with export.

---

## Implementation Checklist

- [x] Baseline Visual Inspection via Chrome DevTools Protocol (Desktop 1440px & Mobile 390px)
- [ ] **1. Design Tokens & Indian Locale Utilities**
  - [ ] Add `formatINR(amount)` and `formatIST(date)` helper functions in `src/utils/formatters.ts`
  - [ ] Standardize typography, tabular numerals (`tabular-nums font-mono`), and semantic color tokens in `tailwind.config.js` and `index.css`
- [ ] **2. Navigation & App Shell Overhaul**
  - [ ] Compact 7-item main navigation: Home, Orders, Inventory, Inward, Outward, Locations, Reports
  - [ ] Secondary "Administration & More" drawer/menu for Purchase Orders, Suppliers, Customers, Returns, Movements, Users, Audit, Settings
  - [ ] Top bar with facility switcher, contextual breadcrumbs, functional global search (Cmd+K), and user/demo role switcher
  - [ ] Fully responsive drawer and optimized mobile navigation header
- [ ] **3. Home — "Today at the warehouse"**
  - [ ] Top strip with <=4 compact operational metrics: Orders to Process, Inward Pending, Outward Pending, Low-Stock Items
  - [ ] Left column: Work Queue with prioritized floor tasks, priority badges, context, and immediate action buttons
  - [ ] Right column: Needs Attention with low-stock alerts, damaged units, pending receipts
  - [ ] One real-data operational figure: 7-day fulfillment pipeline & movement stage distribution with tooltips and empty states
  - [ ] Compact recent movement ledger table
- [ ] **4. Orders — Work Queue First**
  - [ ] Segmented tabs: All, New (Pending Allocation), To Pick, To Pack, Dispatched, Exceptions
  - [ ] Columns: Order ID, Channel/Source (neutral labels), Date/Time (IST), Item Lines, Fulfillment State, Priority, Next Action
  - [ ] Slide-out Order Detail drawer with line items, reservation status, customer details, and workflow action triggers
  - [ ] Search, status filtering, and one-click clear filters
- [ ] **5. Inventory — Fast Stock Lookup**
  - [ ] Prominent instant search for SKU, Product Name, Barcode, Bin
  - [ ] Clear columns: SKU, Product Name, Available, On Hand, Reserved, Bin/Location, Status
  - [ ] Right-aligned tabular numeric quantities, deficit alerts on low stock
  - [ ] Slide-out Product Detail drawer with Overview, Bin Allocations, Movement History, and Stock Composition Bar
- [ ] **6. Inward — Guided Receiving Wizard**
  - [ ] 5-step staged receiving wizard: 1. Inbound PO -> 2. SKU/Item Entry -> 3. Quantity Breakdown -> 4. Bin & Lot Assignment -> 5. Review & Confirm
  - [ ] Live summary panel updating dynamically from form state
  - [ ] Duplicate submission prevention and clear confirmation
- [ ] **7. Outward — Guided Picking, Packing & Dispatch**
  - [ ] Prominent source bin display for warehouse pickers
  - [ ] Pick progress indicator derived from real line counts
  - [ ] Short-pick discrepancy recording with reason codes
  - [ ] Seamless handover to packing & dispatch
- [ ] **8. Locations & Reports Refinement**
  - [ ] Locations: Clean Zone > Aisle > Rack > Bin hierarchy with occupancy bars
  - [ ] Reports: INR valuation formatting, low-stock deficit analysis, lot expiry schedule
- [ ] **9. Verification & Evidence**
  - [ ] Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`
  - [ ] Capture after-screenshots at 1440px and 390px
  - [ ] Update `IMPLEMENTATION_STATUS.md` with complete evidence
