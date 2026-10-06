import {
  getFinancialDashboard,
  getTopProducts,
  getSalesTrends,
  getPaymentMethodBreakdown,
} from "@/lib/actions/reports";
import { getCategories } from "@/lib/actions/products";
import { requireRole } from "@/lib/auth";
import { ReportsClient } from "@/components/reports/reports-client";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Period = "day" | "week" | "month" | "custom";

function getDateRange(period: Period, customDate?: string) {
  const now = new Date();
  const end = now;
  let start: Date;
  const validCustom = customDate && /^\d{4}-\d{2}-\d{2}$/.test(customDate);
  switch (period) {
    case "custom":
      start = validCustom ? new Date(customDate + "T00:00:00") : new Date(now);
      start.setHours(0, 0, 0, 0);
      if (validCustom) {
        const e = new Date(customDate + "T00:00:00");
        e.setHours(23, 59, 59, 999);
        return { start, end: e, startDate: customDate!, endDate: customDate! };
      }
      break;
    case "week":
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "day":
    default:
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
  }
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start, end, startDate: fmt(start), endDate: fmt(end) };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  await requireRole("OWNER", "ADMIN");

  const sp = await searchParams;
  const period: Period =
    sp?.period === "week"
      ? "week"
      : sp?.period === "month"
        ? "month"
        : sp?.period === "custom"
          ? "custom"
          : "day";

  const { startDate, endDate } = getDateRange(period, sp?.date);

  const groupBy: "day" | "month" = "day";

  const [kpis, topProducts, trends, paymentBreakdown, categories] = await Promise.all([
    getFinancialDashboard({ startDate, endDate }),
    getTopProducts({ limit: 5, startDate, endDate }),
    getSalesTrends({ groupBy, startDate, endDate }),
    getPaymentMethodBreakdown({ startDate, endDate }),
    getCategories(),
  ]);

  // Map DB trend rows to the chart shape expected by the client component
  const salesTrends = trends.map((t) => ({
    label: t.period,
    sales: t.total_sales,
    transactions: t.transaction_count,
    units: t.units_sold,
  }));

  // Map raw query rows to the shape expected by the client component
  const topProductsMapped = topProducts.map((p: any) => ({
    id: p.product_id,
    name: p.product_name,
    sku: p.product_sku,
    unit: p.unit || "ml",
    totalQuantity: Number(p.total_quantity ?? p.totalQuantity ?? 0),
    totalRevenue: Number(p.total_revenue ?? p.totalRevenue ?? 0),
    profit: Number(p.total_profit ?? p.profit ?? 0),
    categoryName: p.category_name ?? p.categoryName ?? null,
  }));

  // Slow moving products (active products with highest stock)
  const slowProducts = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { currentStock: "desc" },
    take: 5,
    select: {
      id: true,
      sku: true,
      name: true,
      currentStock: true,
      unit: true,
      _count: { select: { saleItems: true } },
    },
  });

  return (
    <ReportsClient
      initialKPIs={kpis as any}
      topProducts={topProductsMapped as any}
      slowProducts={slowProducts.map((p) => ({
        ...p,
        currentStock: Number(p.currentStock),
        salesCount: p._count.saleItems,
      })) as any}
      salesTrends={salesTrends as any}
      paymentBreakdown={paymentBreakdown as any}
      categories={categories as any}
      period={period}
      customDate={sp?.date}
    />
  );
}
