# StockPilot WMS — Enterprise Warehouse Management System

StockPilot WMS is a high-precision, production-ready Warehouse Management System built for modern multi-warehouse operations, real-time inventory ledger integrity, barcode-driven inbound receiving, and rapid outbound pick-pack-ship fulfillment.

---

## Key Features

- **Warehouse Network Management**: Multi-warehouse partitioning with hierarchical storage modeling (Zones > Aisles > Racks > Shelves > Bins) with capacity and occupancy tracking.
- **Strict Inventory Ledger**: Triple-counter stock balance (`on_hand`, `reserved`, `damaged`) with non-negative sellable stock invariants (`available = on_hand - reserved - damaged >= 0`).
- **Complete Inbound Pipeline**: Purchase order lifecycle, approved vendor supplier catalog and registration, multi-line receiving dock with accepted/damaged/rejected split, lot number and expiration capture, and auto-generated put-away tasks.
- **Optimized Outbound Operations**: Customer sales orders, customer accounts directory and registration, real-time stock reservations audit ledger, concurrency-safe FIFO/FEFO stock allocation, bin-sequenced pick lists, discrepancy handling, packing station manifests, and dispatch verification.
- **Reverse Logistics & Returns**: RMA receiving, quality inspection, and intelligent restock or quarantine disposition.
- **Immutable Movement Audit**: Every stock delta generates an audited, non-rewriteable ledger entry with full before/after state.
- **Operational Intelligence & Reports**: Real-time inventory valuation, low-stock reorder thresholds, lot aging and expiration analysis, bin utilization metrics, and CSV data exports.
- **Server-Enforced RBAC**: 5 distinct operational roles (`ADMIN`, `WAREHOUSE_MANAGER`, `INVENTORY_SPECIALIST`, `PICKER_PACKER`, `RECEIVING_CLERK`) with granular permission gates.
- **Bespoke Enterprise UI**: Neutral cool-gray surfaces, charcoal typography, restrained amber accent, keyboard-friendly command palette (Cmd+K), and responsive floor tablet compatibility.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Radix UI Primitives, Lucide Icons, TanStack Query v5, React Hook Form, Zod.
- **Backend**: Node.js, Express.js, TypeScript, Prisma ORM, PostgreSQL.
- **Security**: Argon2id/Bcrypt password hashing, JWT authentication, helmet, CORS isolation, rate limiting.
- **Testing**: Vitest for unit & domain tests, Supertest for API integration tests.

---

## Quickstart Guide

### Prerequisites
- Node.js v20+ or v26+
- npm v10+
- PostgreSQL v14+ running locally or remotely

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd "warehouse management system"
npm install
```

### 2. Configure Environment
Copy `.env.example` to `backend/.env`:
```bash
cp .env.example backend/.env
```

Ensure `DATABASE_URL` points to your PostgreSQL instance:
```env
DATABASE_URL="postgresql://sakshantwaghmare@localhost:5432/stockpilot_wms"
PORT=4000
JWT_SECRET="super-secret-stockpilot-jwt-key-2026"
NODE_ENV=development
```

### 3. Run Database Migrations & Deterministic Seed
```bash
npm run db:migrate
npm run db:seed
```
*The seed generates 2 warehouses (EDC, WCF), 50+ real-world industrial SKUs across 5 categories, lots with active and near-expiry dates, suppliers, customers, open purchase orders, sales orders, and reconciled stock movements.*

### 4. Start Development Servers
```bash
npm run dev
```
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:4000/api/v1
- **API Health Check**: http://localhost:4000/api/v1/health

---

## Deterministic Demo Accounts

The database seed provides pre-configured role-based credentials for testing:

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@stockpilot.io` | `StockPilot2026!` | Full system access, users, settings, adjustments |
| **Warehouse Manager** | `manager@stockpilot.io` | `StockPilot2026!` | Approvals, transfers, adjustments, all reports |
| **Inventory Specialist** | `inventory@stockpilot.io` | `StockPilot2026!` | Stock transfers, catalog management, movement ledger |
| **Picker / Packer** | `picker@stockpilot.io` | `StockPilot2026!` | Pick lists, package creation, dispatch |
| **Receiving Clerk** | `receiving@stockpilot.io` | `StockPilot2026!` | Inbound receiving dock, put-away tasks |

---

## Deterministic Repository Checks

Run the verification scripts locally:

```bash
# Typecheck TypeScript across client and server
npm run typecheck

# Lint codebase
npm run lint

# Run unit and API integration tests
npm run test

# Compile production builds
npm run build
```

---

## Cloudflare Deployment Guide

The repository includes pre-configured SPA client-side routing rules (`frontend/public/_redirects`) and HTTP security headers (`frontend/public/_headers`) tailored for **Cloudflare Pages**.

### Deploying Frontend to Cloudflare Pages (Instant CI/CD)

1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the sidebar, navigate to **Workers & Pages** > **Create application** > select the **Pages** tab.
3. Click **Connect to Git** and select the GitHub repository:
   `Kunalkh05/stockpilot-wms`
4. Configure the build settings:
   - **Framework preset**: `Vite`
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. *(Optional)* Under **Environment variables**, set:
   - `VITE_API_URL`: Your hosted backend API URL (defaults to `/api/v1` in local proxy mode)
6. Click **Save and Deploy**. Cloudflare Pages will build and assign an edge-distributed URL (e.g. `https://stockpilot-wms.pages.dev`).

### Deploying Backend & Database

The backend is a Node.js + Express + Prisma application backed by PostgreSQL:
- Host PostgreSQL on Cloudflare D1 / Supabase / Neon / AWS RDS.
- Run database migrations (`npx prisma migrate deploy` or `prisma db push`) and seed (`tsx prisma/seed.ts`).
- Set `DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGIN` in production environment variables.

---

## License
Proprietary & Confidential. Designed for StockPilot WMS Autonomous Systems.
