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

export default async function ReportsPage() {
  await requireRole("OWNER", "ADMIN");

  const [kpis, topProducts, trends, paymentBreakdown, categories] = await Promise.all([
    getFinancialDashboard(),
    getTopProducts({ limit: 5 }),
    getSalesTrends({ groupBy: "day" }),
    getPaymentMethodBreakdown(),
    getCategories(),
  ]);

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
      topProducts={topProducts as any}
      slowProducts={slowProducts.map((p) => ({
        ...p,
        currentStock: Number(p.currentStock),
        salesCount: p._count.saleItems,
      })) as any}
      salesTrends={trends as any}
      paymentBreakdown={paymentBreakdown as any}
      categories={categories as any}
    />
  );
}
