"use server";

import prisma from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth";
import { Prisma } from "@prisma/client";

// ============================================================
// FINANCIAL DASHBOARD
// ============================================================

export async function getFinancialDashboard(params?: {
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  categoryId?: string;
  userId?: string;
}) {
  await requireRole("OWNER", "ADMIN");

  const { startDate, endDate, paymentMethod, categoryId, userId } = params || {};

  // Default to today
  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().setHours(0, 0, 0, 0));
  const end = endDate
    ? new Date(endDate + "T23:59:59.999Z")
    : new Date(new Date().setHours(23, 59, 59, 999));

  // Base where for completed sales
  const saleWhere: Prisma.SaleWhereInput = {
    status: "COMPLETED",
    date: { gte: start, lte: end },
  };

  if (paymentMethod) saleWhere.paymentMethod = paymentMethod as Prisma.EnumPaymentMethodFilter["equals"];
  if (userId) saleWhere.userId = userId;

  // Build item filter for category
  const itemWhere: Prisma.SaleItemWhereInput = {};
  if (categoryId) {
    itemWhere.product = { categoryId };
  }

  const [
    salesAgg,
    cashSalesAgg,
    qrisSalesAgg,
    transactionCount,
    itemsAgg,
    expensesAgg,
    refundsAgg,
  ] = await Promise.all([
    // Gross sales & discount
    prisma.sale.aggregate({
      where: saleWhere,
      _sum: { subtotal: true, discountAmount: true, grandTotal: true },
    }),
    // Cash sales
    prisma.sale.aggregate({
      where: { ...saleWhere, paymentMethod: "CASH" },
      _sum: { grandTotal: true },
    }),
    // QRIS sales
    prisma.sale.aggregate({
      where: { ...saleWhere, paymentMethod: "QRIS" },
      _sum: { grandTotal: true },
    }),
    // Transaction count
    prisma.sale.count({ where: saleWhere }),
    // COGS and units sold
    prisma.saleItem.aggregate({
      where: {
        sale: saleWhere,
        ...itemWhere,
      },
      _sum: { quantity: true, lineTotal: true },
    }),
    // Expenses
    prisma.expense.aggregate({
      where: {
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    // Refunds
    prisma.refund.aggregate({
      where: {
        status: "COMPLETED",
        createdAt: { gte: start, lte: end },
      },
      _sum: { refundAmount: true },
    }),
  ]);

  // Calculate COGS
  const cogsResult = await prisma.$queryRaw<[{ total: number }]>`
    SELECT COALESCE(SUM(si.quantity * si.cost_price), 0)::float as total
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'COMPLETED'
    AND s.date >= ${start}
    AND s.date <= ${end}
    ${paymentMethod ? Prisma.sql`AND s.payment_method = ${paymentMethod}` : Prisma.empty}
    ${userId ? Prisma.sql`AND s.user_id = ${userId}` : Prisma.empty}
    ${categoryId ? Prisma.sql`AND si.product_id IN (SELECT id FROM products WHERE category_id = ${categoryId})` : Prisma.empty}
  `;

  const grossSales = Number(salesAgg._sum.subtotal || 0);
  const totalDiscount = Number(salesAgg._sum.discountAmount || 0);
  const totalRefunds = Number(refundsAgg._sum.refundAmount || 0);
  const netSales = grossSales - totalDiscount - totalRefunds;
  const cashSales = Number(cashSalesAgg._sum.grandTotal || 0);
  const qrisSales = Number(qrisSalesAgg._sum.grandTotal || 0);
  const unitsSold = Number(itemsAgg._sum.quantity || 0);
  const avgTransactionValue = transactionCount > 0 ? netSales / transactionCount : 0;
  const cogs = cogsResult[0]?.total || 0;
  const grossProfit = netSales - cogs;
  const totalExpenses = Number(expensesAgg._sum.amount || 0);
  const operatingResult = grossProfit - totalExpenses;

  return {
    grossSales,
    totalDiscount,
    totalRefunds,
    netSales,
    cashSales,
    qrisSales,
    transactionCount,
    unitsSold,
    avgTransactionValue: Math.round(avgTransactionValue),
    cogs,
    grossProfit,
    totalExpenses,
    operatingResult,
  };
}

// ============================================================
// SALES ANALYTICS
// ============================================================

export async function getSalesAnalytics(params?: {
  startDate?: string;
  endDate?: string;
  groupBy?: "day" | "month" | "hour";
}) {
  await requireAuth();

  const { startDate, endDate, groupBy = "day" } = params || {};

  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate
    ? new Date(endDate + "T23:59:59.999Z")
    : new Date();

  let dateFormat: string;
  switch (groupBy) {
    case "hour":
      dateFormat = "YYYY-MM-DD HH24";
      break;
    case "month":
      dateFormat = "YYYY-MM";
      break;
    default:
      dateFormat = "YYYY-MM-DD";
  }

  const salesTrend = await prisma.$queryRaw<
    Array<{ period: string; total_sales: number; transaction_count: number; units_sold: number }>
  >`
    SELECT
      TO_CHAR(s.date, ${Prisma.raw(`'${dateFormat}'`)}) as period,
      SUM(s.grand_total)::float as total_sales,
      COUNT(*)::int as transaction_count,
      (SELECT COALESCE(SUM(si.quantity), 0)::float FROM sale_items si WHERE si.sale_id = ANY(ARRAY_AGG(s.id))) as units_sold
    FROM sales s
    WHERE s.status = 'COMPLETED'
    AND s.date >= ${start}
    AND s.date <= ${end}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return salesTrend;
}

// ============================================================
// TOP SELLING PRODUCTS
// ============================================================

export async function getTopSellingProducts(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  sortBy?: "quantity" | "revenue" | "profit";
}) {
  await requireAuth();

  const {
    startDate,
    endDate,
    limit: lim = 10,
    sortBy = "quantity",
  } = params || {};

  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate
    ? new Date(endDate + "T23:59:59.999Z")
    : new Date();

  let orderByClause: string;
  switch (sortBy) {
    case "revenue":
      orderByClause = "total_revenue";
      break;
    case "profit":
      orderByClause = "total_profit";
      break;
    default:
      orderByClause = "total_quantity";
  }

  const topProducts = await prisma.$queryRaw<
    Array<{
      product_id: string;
      product_name: string;
      product_sku: string;
      unit: string;
      total_quantity: number;
      total_revenue: number;
      total_profit: number;
    }>
  >`
    SELECT
      si.product_id,
      si.product_name,
      si.product_sku,
      MAX(si.unit) as unit,
      SUM(si.quantity)::float as total_quantity,
      SUM(si.line_total)::float as total_revenue,
      SUM(si.line_total - (si.quantity * si.cost_price))::float as total_profit
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'COMPLETED'
    AND s.date >= ${start}
    AND s.date <= ${end}
    GROUP BY si.product_id, si.product_name, si.product_sku
    ORDER BY ${Prisma.raw(orderByClause)} DESC
    LIMIT ${lim}
  `;

  return topProducts;
}

// ============================================================
// SALES BY CATEGORY
// ============================================================

export async function getSalesByCategory(params?: {
  startDate?: string;
  endDate?: string;
}) {
  await requireAuth();

  const { startDate, endDate } = params || {};

  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate
    ? new Date(endDate + "T23:59:59.999Z")
    : new Date();

  const salesByCategory = await prisma.$queryRaw<
    Array<{ category_name: string; total_sales: number; total_quantity: number }>
  >`
    SELECT
      COALESCE(c.name, 'Tanpa Kategori') as category_name,
      SUM(si.line_total)::float as total_sales,
      SUM(si.quantity)::float as total_quantity
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE s.status = 'COMPLETED'
    AND s.date >= ${start}
    AND s.date <= ${end}
    GROUP BY c.name
    ORDER BY total_sales DESC
  `;

  return salesByCategory;
}

// ============================================================
// PAYMENT METHOD BREAKDOWN
// ============================================================

export async function getPaymentBreakdown(params?: {
  startDate?: string;
  endDate?: string;
}) {
  await requireAuth();

  const { startDate, endDate } = params || {};

  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().setHours(0, 0, 0, 0));
  const end = endDate
    ? new Date(endDate + "T23:59:59.999Z")
    : new Date(new Date().setHours(23, 59, 59, 999));

  const breakdown = await prisma.$queryRaw<
    Array<{ payment_method: string; total: number; count: number }>
  >`
    SELECT
      payment_method,
      SUM(grand_total)::float as total,
      COUNT(*)::int as count
    FROM sales
    WHERE status = 'COMPLETED'
    AND date >= ${start}
    AND date <= ${end}
    GROUP BY payment_method
  `;

  return breakdown;
}

// ============================================================
// SLOW MOVING PRODUCTS
// ============================================================

export async function getSlowMovingProducts(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  await requireAuth();

  const {
    startDate,
    endDate,
    limit: lim = 10,
  } = params || {};

  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate
    ? new Date(endDate + "T23:59:59.999Z")
    : new Date();

  const slowProducts = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      sku: string;
      current_stock: number;
      total_sold: number;
      unit: string;
    }>
  >`
    SELECT
      p.id,
      p.name,
      p.sku,
      p.current_stock::float,
      COALESCE(
        (SELECT SUM(si.quantity)::float
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE si.product_id = p.id
         AND s.status = 'COMPLETED'
         AND s.date >= ${start}
         AND s.date <= ${end}
        ), 0
      ) as total_sold,
      p.unit
    FROM products p
    WHERE p.is_active = true AND p.current_stock > 0
    ORDER BY total_sold ASC, p.current_stock DESC
    LIMIT ${lim}
  `;

  return slowProducts;
}

export const getTopProducts = getTopSellingProducts;
export const getSalesTrends = getSalesAnalytics;
export const getPaymentMethodBreakdown = getPaymentBreakdown;

// ============================================================
// INTERNAL (NO AUTH) VERSIONS FOR SERVER ACTIONS / EXPORT
// ============================================================

export async function getFinancialDashboardInternal(params?: {
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  categoryId?: string;
  userId?: string;
}) {
  const { startDate, endDate, paymentMethod, categoryId, userId } = params || {};

  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().setHours(0, 0, 0, 0));
  const end = endDate
    ? new Date(endDate + "T23:59:59.999Z")
    : new Date(new Date().setHours(23, 59, 59, 999));

  const saleWhere: Prisma.SaleWhereInput = {
    status: "COMPLETED",
    date: { gte: start, lte: end },
  };

  if (paymentMethod) saleWhere.paymentMethod = paymentMethod as Prisma.EnumPaymentMethodFilter["equals"];
  if (userId) saleWhere.userId = userId;

  const itemWhere: Prisma.SaleItemWhereInput = {};
  if (categoryId) {
    itemWhere.product = { categoryId };
  }

  const [
    salesAgg,
    cashSalesAgg,
    qrisSalesAgg,
    transactionCount,
    itemsAgg,
    expensesAgg,
    refundsAgg,
  ] = await Promise.all([
    prisma.sale.aggregate({ where: saleWhere, _sum: { subtotal: true, discountAmount: true, grandTotal: true } }),
    prisma.sale.aggregate({ where: { ...saleWhere, paymentMethod: "CASH" }, _sum: { grandTotal: true } }),
    prisma.sale.aggregate({ where: { ...saleWhere, paymentMethod: "QRIS" }, _sum: { grandTotal: true } }),
    prisma.sale.count({ where: saleWhere }),
    prisma.saleItem.aggregate({
      where: { sale: saleWhere, ...itemWhere },
      _sum: { quantity: true, lineTotal: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.refund.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: start, lte: end } },
      _sum: { refundAmount: true },
    }),
  ]);

  const cogsResult = await prisma.$queryRaw<[{ total: number }]>`
    SELECT COALESCE(SUM(si.quantity * si.cost_price), 0)::float as total
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'COMPLETED'
    AND s.date >= ${start}
    AND s.date <= ${end}
    ${paymentMethod ? Prisma.sql`AND s.payment_method = ${paymentMethod}` : Prisma.empty}
    ${userId ? Prisma.sql`AND s.user_id = ${userId}` : Prisma.empty}
    ${categoryId ? Prisma.sql`AND si.product_id IN (SELECT id FROM products WHERE category_id = ${categoryId})` : Prisma.empty}
  `;

  const grossSales = Number(salesAgg._sum.subtotal || 0);
  const totalDiscount = Number(salesAgg._sum.discountAmount || 0);
  const totalRefunds = Number(refundsAgg._sum.refundAmount || 0);
  const netSales = grossSales - totalDiscount - totalRefunds;
  const cashSales = Number(cashSalesAgg._sum.grandTotal || 0);
  const qrisSales = Number(qrisSalesAgg._sum.grandTotal || 0);
  const unitsSold = Number(itemsAgg._sum.quantity || 0);
  const avgTransactionValue = transactionCount > 0 ? netSales / transactionCount : 0;
  const cogs = cogsResult[0]?.total || 0;
  const grossProfit = netSales - cogs;
  const totalExpenses = Number(expensesAgg._sum.amount || 0);
  const operatingResult = grossProfit - totalExpenses;

  return {
    grossSales,
    totalDiscount,
    totalRefunds,
    netSales,
    cashSales,
    qrisSales,
    transactionCount,
    unitsSold,
    avgTransactionValue: Math.round(avgTransactionValue),
    cogs,
    grossProfit,
    totalExpenses,
    operatingResult,
    grossProfitMargin: netSales > 0 ? Math.round((grossProfit / netSales) * 100) : 0,
    netProfitMargin: netSales > 0 ? Math.round((operatingResult / netSales) * 100) : 0,
  };
}

export async function getTopSellingProductsInternal(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const { startDate, endDate, limit: lim = 10 } = params || {};

  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate
    ? new Date(endDate + "T23:59:59.999Z")
    : new Date();

  const topProducts = await prisma.$queryRaw<
    Array<{
      product_id: string;
      product_name: string;
      product_sku: string;
      unit: string;
      total_quantity: number;
      total_revenue: number;
      total_profit: number;
    }>
  >`
    SELECT
      si.product_id,
      si.product_name,
      si.product_sku,
      MAX(si.unit) as unit,
      SUM(si.quantity)::float as total_quantity,
      SUM(si.line_total)::float as total_revenue,
      SUM(si.line_total - (si.quantity * si.cost_price))::float as total_profit
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'COMPLETED'
    AND s.date >= ${start}
    AND s.date <= ${end}
    GROUP BY si.product_id, si.product_name, si.product_sku
    ORDER BY total_quantity DESC
    LIMIT ${lim}
  `;

  return topProducts;
}

export async function getSalesAnalyticsInternal(params?: {
  startDate?: string;
  endDate?: string;
  groupBy?: "day" | "month" | "hour";
}) {
  const { startDate, endDate, groupBy = "day" } = params || {};

  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate
    ? new Date(endDate + "T23:59:59.999Z")
    : new Date();

  let dateFormat: string;
  switch (groupBy) {
    case "hour":
      dateFormat = "YYYY-MM-DD HH24";
      break;
    case "month":
      dateFormat = "YYYY-MM";
      break;
    default:
      dateFormat = "YYYY-MM-DD";
  }

  const salesTrend = await prisma.$queryRaw<
    Array<{ period: string; total_sales: number; transaction_count: number; units_sold: number }>
  >`
    SELECT
      TO_CHAR(s.date, ${Prisma.raw(`'${dateFormat}'`)}) as period,
      SUM(s.grand_total)::float as total_sales,
      COUNT(*)::int as transaction_count,
      (SELECT COALESCE(SUM(si.quantity), 0)::float FROM sale_items si WHERE si.sale_id = ANY(ARRAY_AGG(s.id))) as units_sold
    FROM sales s
    WHERE s.status = 'COMPLETED'
    AND s.date >= ${start}
    AND s.date <= ${end}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return salesTrend;
}

