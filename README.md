# Kaah Steel Prop Rental Management System

Enterprise Full-Stack Equipment Rental Management System built for **Steel Props, Shoring Systems, and Construction Scaffolding** operations.

## Architecture & Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide React Icons, Bilingual UI (`English` & `Soomaali`)
- **Backend**: Node.js, Express.js, TypeScript, JWT Authentication, Zod Input Validation, Helmet Security
- **Database**: MongoDB Atlas & Mongoose ODM (with automatic in-memory ReplicaSet MongoDB fallback when `MONGODB_URI` is unset in local development)
- **Exports**: Bilingual PDF Invoices, Payment Receipts, & Analytical Reports (`jsPDF` + `jspdf-autotable`), Excel Export (`xlsx`)

## Core Business Modules

1. **Executive Dashboard**: Real-time totals for Total/Available/Rented/Returned/Damaged/Lost Props, Active & Overdue Rentals, Total Billed Revenue, Payments Received, Outstanding Balances, Net Cash Position, and a 6-month Revenue vs. Cash Collected chart.
2. **Inventory Management**: Track SKU, Category, Warehouse Location, Purchase Price, Daily Rental Rate, and Low Stock Threshold. Prevents negative stock on all rentals and manual adjustments, with a full `InventoryTransaction` audit ledger.
3. **Customer & Construction Project Management**: Register contractors/customers and link multiple construction projects (`PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`) with 360-degree financial and rental history views.
4. **Rental & Partial Return Billing Engine**:
   - Automatic daily charge calculation (`Quantity × Daily Rate × Days`).
   - Supports rental extensions, early returns, **partial returns** (settling the exact period held before return while keeping remaining units active and updating stock), and final returns.
   - Automatically transitions rental status (`ACTIVE` → `PARTIALLY_RETURNED` / `OVERDUE` → `COMPLETED`) only when all units are returned or accounted for.
5. **Invoicing & Multi-Currency Payments**:
   - Automatic synchronized invoices per rental contract.
   - Supports multiple installment payments via **Cash USD**, **Cash SOS** (with live exchange rate conversion), **Mobile Money**, and **Bank Transfer**.
   - Prevents duplicate reference numbers and idempotency collisions; preserves immutable financial history.
6. **Damage & Loss Tracking**: Records damaged and lost equipment inspections, excludes them from available rental stock, tracks responsibility (`CUSTOMER`, `COMPANY`, `SHARED`), and adds replacement charges to customer invoices.
7. **Reports & Operational Alerts**:
   - 12 analytical reports (Daily/Weekly/Monthly/Annual Revenue, Active/Completed/Overdue Rentals, Customer Balances, Inventory Movement, Damaged Equipment, Lost Equipment, Profit & Expenses) with date, customer, project, and product filters + Excel/PDF exports.
   - Automated bilingual notifications for approaching returns, overdue rentals, unpaid invoices, low inventory, unresolved damage, and project completion dates.

## Role-Based Access Control (RBAC)

Default seeded accounts on first startup:

| Role | Email | Password | Permissions |
| --- | --- | --- | --- |
| `ADMIN` | `admin@kaahprops.so` | `KaahAdmin2026!` | Full system access, User Management, Audit Trail |
| `MANAGER` | `manager@kaahprops.so` | `StaffPass2026!` | Manage rentals, customers, projects, inventory, reports |
| `ACCOUNTANT` | `accountant@kaahprops.so` | `StaffPass2026!` | Manage invoices, payments, expenses, financial reports |
| `STOREKEEPER` | `storekeeper@kaahprops.so` | `StaffPass2026!` | Manage inventory stock, dispatches, returns, damage inspections |

## Environment Variables (`.env`)

Copy `.env.example` to `.env` and configure:

```env
MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/kaah_steel_props?retryWrites=true&w=majority"
JWT_SECRET="your-strong-random-secret"
JWT_EXPIRES_IN="24h"
PORT="3000"
SOS_EXCHANGE_RATE="27000"
```

## Development & Production Deployment

```bash
# Install dependencies
npm install

# Run full-stack development server (Express + Vite on port 3000)
npm run dev

# Type-check and build frontend bundle
npm run lint
npm run build

# Run production server
NODE_ENV=production npm start
```
