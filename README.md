# 🌸 AromaPOS — Retail Refill Perfume POS, Inventory & Financial System

**AromaPOS** is a full-stack, production-ready Point of Sale (POS), Inventory Control, Cash Management, and Financial Analytics system purpose-built for the perfume refill retail industry.

It handles the unique operational requirements of refill parfumeries: tracking fragrance concentrate oils in milliliters (ml), solvents/absolute alcohols in ml, empty atomizers/bottles in pieces (pcs), composite cost calculation (COGS/HPP), cash drawer shift reconciliation, dual-mode payment (Cash & QRIS), and comprehensive financial accounting.

---

## 🌟 Key Features

### 1. 🛒 Point of Sale (POS) Terminal
- **Fast Search & Barcode Scanner**: Instant lookup by fragrance name, SKU, or barcode with keyboard navigation.
- **Dynamic Perfume Formulation**:
  - Bottle sizes: 30ml, 50ml, 100ml (or custom).
  - Oil-to-Solvent ratios (e.g. 1:1 for 50/50 EDP, 2:1 for 67/33 Extrait de Parfum, or pure concentrate).
  - Auto-calculation of oil volume, solvent volume, and bottle deduction.
- **Cart & Pricing Engine**: Line-item discounts, overall discount percentage/fixed amount, subtotal, and grand total.
- **Split Payment & Change Calculation**: Cash payment with tender presets and exact change calculation; QRIS payment with simulated QR scan confirmation.
- **Digital Receipt & Thermal Printing**: Responsive receipt preview formatted for 58mm/80mm thermal receipt printers with store headers, itemized breakdowns, cashier info, and custom footer messages.

### 2. 🧪 Integrated Inventory & Bill of Materials (BOM)
- **Multi-Unit Inventory Tracking**:
  - Fragrance Oils (Bibit Parfum) tracked in **ml**.
  - Solvents (Absolute / Alcohol Denat) tracked in **ml**.
  - Empty Bottles & Atomizers (Botol Kaca/Spray) tracked in **pcs**.
  - Ready-to-wear / boxed perfumes tracked in **pcs**.
- **Atomic Stock Deduction**: Automatically deducts raw ingredients during transaction commit within an ACID database transaction.
- **Stock Receiving / Restocking**: Inbound receiving workflow with supplier tracking, batch invoice numbers, unit cost updates, and stock card generation.
- **Stock Movement Audit Card**: Complete ledger of every inventory change (SALE, RESTOCK, SALES_RETURN, ADJUSTMENT_IN, ADJUSTMENT_OUT, DAMAGE, LOST) with timestamp and actor.
- **Low Stock & Out-of-Stock Alerts**: Real-time visual badge indicators and warning thresholds.

### 3. 💵 Cash Management & Shift Control
- **Open Shift**: Record opening cash float (uang modal/kembalian) and cashier notes.
- **Real-Time Cash Tracking**: Tracks cash sales, QRIS sales, cash expenses, and cash refunds in the active shift.
- **Close Shift & Reconciliation**:
  - Cashier enters physical cash count (`closingCashActual`).
  - System calculates theoretical expected cash: `openingCash + cashSales - cashExpenses - cashRefunds`.
  - Computes discrepancy (Selisih Lebih / Selisih Kurang) and logs mandatory notes.
- **Shift Report Generation**: Summary of transactions, total volume sold, and payment method breakdown.

### 4. 📉 Operational Expenses
- Categorized expense logging (Sewa Toko, Listrik & Air, Gaji Karyawan, Botol Tester, Perlengkapan Kasir, Operasional).
- Linked to payment method (`CASH`, `QRIS`, `BANK_TRANSFER`).
- If paid in cash during an active session, automatically reduces the drawer cash balance.

### 5. 🔄 Refunds & Returns
- Full or itemized partial returns linked to original transaction number.
- Choice to restock item back to inventory or discard damaged goods.
- Reverses cash drawer balance if originally paid by Cash.
- Strict authorization (Owner / Admin only) and full audit trail.

### 6. 📊 Financial Analytics & Business Intelligence
- **Executive KPI Cards**: Today's Gross Revenue, Net Profit, Average Order Value (AOV), and Total Transactions.
- **Gross Profit & COGS (HPP)**: Real-time calculation of material cost vs selling price.
- **Net Profit Computation**: `Gross Profit - Operational Expenses`.
- **Top Fragrances Chart**: Identifies best-selling perfume scents by volume (ml) and revenue.
- **Revenue by Payment Method**: Cash vs QRIS distribution.
- **CSV & Excel Export**: Instant download of sales reports, inventory levels, and financial statements.

### 7. 🔐 Authentication, RBAC & Audit Trails
- **Role-Based Access Control (RBAC)**:
  - `OWNER`: Full system access, financials, settings, user management, deletions.
  - `ADMIN`: Inventory receiving, price changes, expense management, shifts.
  - `CASHIER`: POS sales, shift opening/closing, receipt reprint.
- **Tamper-Evident Audit Logs**: Logs actor user, action type, entity affected, old values, new values, and timestamp.

---

## 🏗️ System Architecture & Tech Stack

```mermaid
graph TD
  UI[Next.js 16 App Router UI / React 19] --> Actions[Next.js Server Actions & API Routes]
  Actions --> Auth[NextAuth.js RBAC & Session]
  Actions --> Validators[Zod Validation Schemas]
  Actions --> Prisma[Prisma ORM Client]
  Prisma --> DB[(PostgreSQL Database)]
  DB --> Tables[Products, Sales, SaleItems, Inventory, Movements, CashSessions, Expenses, Refunds, AuditLogs]
```

- **Frontend & App Framework**: [Next.js 16](https://nextjs.org/) (Turbopack, App Router, React 19)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) with Lucide Icons and Radix UI primitives
- **Database ORM**: [Prisma ORM 6](https://www.prisma.io/)
- **Database Engine**: PostgreSQL (Supports PostgreSQL 14+, Neon, Supabase, or Local Embedded Postgres)
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Data Export**: PapaParse (CSV) & SheetJS XLSX (Excel)
- **Unit & Logic Testing**: [Vitest 2](https://vitest.dev/)

---

## 🗄️ Database Schema Overview

```
User (id, name, username, email, password, role, isActive)
  ├── CashSession (id, openingCash, closingCashExpected, closingCashActual, discrepancy, status)
  ├── Sale (id, transactionNumber, subtotal, discount, grandTotal, paymentMethod, status)
  │     ├── SaleItem (id, saleId, productId, quantity, unitPrice, costPrice, lineTotal)
  │     └── Refund (id, saleId, refundAmount, reason)
  ├── Expense (id, category, description, amount, paymentMethod, cashSessionId)
  └── AuditLog (id, userId, action, entity, entityId, previousValue, newValue)

Product (id, sku, barcode, name, fragranceName, category, unit, costPrice, sellingPrice, currentStock, minimumStock)
  ├── StockMovement (id, productId, movementType, quantity, previousStock, newStock, referenceType)
  └── SaleItem
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 20+ (LTS recommended)
- npm or pnpm

### 2. Installation
```bash
# Clone or navigate to the repository
cd perfume-pos

# Install dependencies
npm install
```

### 3. Environment Configuration
Ensure `.env` contains your database connection string and NextAuth secret:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/perfume_pos?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="perfume-pos-super-secret-jwt-key-minimum-32-chars-2026"
```

### 4. Database Setup & Seeding
```bash
# Push database schema
npm run db:push

# Seed with rich demonstration data
npm run db:seed
```

### 5. Running the Application
```bash
# Development mode
npm run dev

# Or build and run for production
npm run build
npm start
```
The application will be live at `http://localhost:3000`.

---

## 🔑 Default Credentials

The seed script initializes three accounts for testing the role hierarchy:

| Role | Username | Email | Password | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Owner** | `admin` | `owner@aromaperfume.com` | `admin123` | Full access, financial analytics, delete rights |
| **Cashier 1** | `kasir1` | `rina@aromaperfume.com` | `kasir123` | POS sales, shift open/close, receipt printing |
| **Cashier 2** | `kasir2` | `budi@aromaperfume.com` | `kasir123` | POS sales, shift open/close, receipt printing |

---

## 🧪 Testing

The test suite validates calculations, formulations, business rules, and validator schemas:

```bash
# Run Vitest test suite
npm test
```

### Tested Modules:
- **`financial-and-perfume-logic.test.ts`**: Refill 2:1 & 1:1 ratio formulations, composite COGS (HPP), gross margin %, shift drawer cash reconciliation, and change calculations.
- **`validators.test.ts`**: Zod validation schemas for products, sales, cash shifts, expenses, and refund payloads.
- **`utils.test.ts`**: Indonesian Rupiah formatting, date localization, stock badge thresholds, and floating-point decimal operations.

---

## 📄 License
MIT License. Built with passion for modern retail parfumeries.
