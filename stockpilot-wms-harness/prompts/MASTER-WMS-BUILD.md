# StockPilot WMS — autonomous implementation goal

You are the autonomous principal engineer, product designer, backend architect, database engineer, QA lead, and integration engineer for this repository. Build the complete, polished Warehouse Management System described below. Do not ask me to select a stack, layout, libraries, features, or implementation alternatives. Make sensible, documented decisions and execute them.

## First inspect, then build
Inspect the actual repository, Git status, existing app, scripts, dependencies, environment, and docs before editing. Preserve existing user changes and working features. Do not replace an existing sound stack merely to match a preference. If this is an empty repo, use React + TypeScript + Vite + Tailwind + shadcn/ui/Radix + Lucide + TanStack Query + React Hook Form/Zod on the frontend, and Node.js + Express + TypeScript + PostgreSQL + Prisma on the backend. Use Vitest, Supertest, and Playwright where practical. Keep a modular monolith; do not introduce microservices without a real need.

Create/update IMPLEMENTATION_PLAN.md, ARCHITECTURE.md, README.md, and IMPLEMENTATION_STATUS.md. Then implement; do not stop after planning. Use parallel agents for independent audits/work where available, but coordinate shared files and integration centrally.

## Product and design
Product name: StockPilot WMS. Build an operational enterprise application, not a landing page. Prioritize a professional, bespoke, non-AI-slop frontend: neutral white/cool-gray surfaces, charcoal typography, subtle borders, one restrained amber/orange accent, compact but readable information density, crisp tables, deliberate spacing, coherent design tokens, Lucide icons, accessible focus, responsive layouts, and restrained transitions. Avoid purple gradients, glassmorphism, random charts, huge repetitive cards, emoji icons, decorative blobs, generic filler copy, and dead buttons. Use realistic warehouse language. Desktop-first but usable on tablets and mobile warehouse-floor screens.

Application shell: collapsible sidebar, workspace/warehouse selector, global search, breadcrumbs, notifications/profile, responsive navigation. Modules: dashboard, inventory, warehouse locations, receiving, put-away, purchase orders, suppliers, customers, customer orders, reservations, picking, packing, shipments, returns, stock movements, reports, users/roles, audit log, settings. Every visible destination must work or be clearly marked as intentionally unavailable; do not create dead-end routes.

## Frontend requirements
Build reusable accessible components for tables, filters, search, pagination, forms, dialogs/drawers, status badges, confirmations, toasts, skeletons, empty states, and errors. Use strict TypeScript. Use TanStack Query for API state and RHF/Zod for validated forms. All visible actions must work. Search, filters, pagination, sorting, CSV export, forms, status transitions, notifications, and links must have real behavior. No fake production data or silent fallback to mock data when the API is down.

Dashboard: total sellable units, inventory valuation, open orders, awaiting picking, receipts awaiting processing, low-stock SKUs, exceptions, inbound/outbound activity, fulfillment trends, recent movements, and priority tasks. Metrics derive from actual seeded or persisted data and navigate to relevant views.

Inventory: SKU/name/category, warehouse/bin, on-hand/reserved/available/damaged quantities, reorder point, UOM, stock status, lot and expiry where relevant. Product CRUD, filters, detail view, movement history, authorized adjustment with reason, transfers, CSV export, and safe bulk actions.

Locations: warehouse > zones > aisles/racks/shelves/bins; location type, capacity/occupancy, status, and stock. Prevent invalid/inactive destinations.

Inbound: purchase order > receipt > SKU/quantity capture > accepted/damaged/rejected quantities > lot/expiry capture > receipt confirmation > put-away task > destination bin confirmation. Ensure retries do not duplicate inventory.

Outbound: customer order > availability validation > stock reservation > picking > discrepancy handling > packing > shipment/dispatch > tracking. Support cancellation and reservation release under explicit rules, and returns/restocking. Never mark shipped before required steps.

Reports: valuation, low stock, stock movements, aging, expiring lots, fulfillment, receiving performance, warehouse utilization. Use real filtered queries and consistent date/time handling.

## Backend and data integrity
Use versioned REST API under /api/v1 with validation, consistent errors, pagination, filtering, server-side authorization, structured logs, request IDs, and OpenAPI/Swagger docs. Keep business logic in services/domain modules, not controllers. Use database migrations, foreign keys, unique constraints, check constraints and indexes as appropriate.

Core models: users, roles/permissions, warehouse membership, warehouses, locations, products/categories, inventory balances, reservations, stock movements, lots/batches, suppliers, purchase orders/items, receipts/items, put-away tasks, customers, sales orders/items, pick tasks/items, packages, shipments, returns/items, audit logs. Normalize appropriately and document invariants.

Inventory invariants: ordinary operations cannot make on-hand negative; reserved quantity cannot exceed eligible stock; available quantity is consistent everywhere; balances are scoped to product/warehouse/location/lot; all references validated; concurrent reservations cannot oversell; receiving/dispatch/returns/transfers are atomic; movement records reconcile with balances; duplicate retries do not duplicate effects. Use transactions, locking or atomic conditional updates, and idempotency keys where appropriate. Transfers must atomically debit source and credit destination. Do not rewrite historical movement records; use compensating transactions. Audit all material state changes.

Security: secure password hashing (Argon2id or reputable equivalent), protected sessions/routes, server-enforced RBAC, safe cookie/session configuration, CSRF protection where applicable, auth rate limiting, request validation, mass-assignment protection, restricted CORS, safe errors, and no secrets in frontend or Git. Provide .env.example only. Create repeatable, safe dev seed data and a documented demo login only if it is safe to configure. Never hardcode production credentials.

## Demo data
Create a deterministic, repeatable dataset: at least two warehouses, realistic hierarchical locations, 40–60 products, categories, suppliers, customers, purchase orders/receipts, customer orders in valid lifecycle states, inventory at multiple locations, movements, and low-stock exceptions. Include a few expired/near-expiry lots where relevant. Ensure quantities reconcile with movements and reservations. Label this as demo data, not live integrations.

## Tests and verification
Write meaningful unit tests for available stock, reservations, transitions, receiving, put-away, valuation, and permissions. Integration tests for auth, CRUD, receiving, transfers, reservation/cancellation, picking/packing/dispatch, invalid quantities, duplicate requests, concurrent reservations, and audit creation. E2E tests with Playwright where possible: login, dashboard real data, create product, receive stock, create order, reserve/pick, pack/dispatch, verify inventory and history, verify permissions. Run the actual available lint/typecheck/test/build scripts. Fix defects; never disable tests or claim a check passed without evidence.

Use browser automation if available to inspect dashboard, inventory, detail, receiving, fulfillment, reports, login, and narrow viewport. Fix overflow, broken columns, inconsistent spacing, dead controls, console/network errors, and missing loading/error states. If browser tools or services are unavailable, state that precisely and continue with other checks.

## Local setup and deliverables
Provide runnable dev scripts, migrations, seeds, .env.example, local PostgreSQL via Docker Compose if appropriate, health checks, API docs, setup instructions, deployment guidance, backup/migration guidance, and a security checklist. Do not deploy externally unless explicitly authorized and credentials are configured. Do not claim deployment if it did not happen.

## Autonomous behavior
Do not ask me to pick from alternatives. Use sensible defaults and continue through implementation, integration, testing, and repairs. Use available CLI agent/task/browser features when available. Preserve all existing work. Do not run destructive commands against user data, do not leak secrets, do not force-push, do not reset Git state, do not disable security to make a check pass. If a real blocker appears, document it and continue independent work. Run checks, inspect failures, fix them, and repeat. Prefer completing coherent end-to-end workflows over superficial pages.

## Definition of done
The app starts with documented commands; core pages are navigable and visually coherent; receiving and dispatch persist and reconcile inventory; reservations handle concurrency; roles are enforced on the server; forms, filters, search, tables, and actions work; loading/empty/error states exist; seed data reconciles; automated checks are run and results reported; major browser defects are fixed where browser QA is available; docs accurately describe setup, actual test results, features, and limitations.

Begin by inspecting the repository and creating the implementation plan, then immediately continue to implementation. Do not finish with a plan alone. Work until the project is substantially implemented and verified.
