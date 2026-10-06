import { getInventoryDashboard, getStockMovements } from "@/lib/actions/inventory";
import { getProducts } from "@/lib/actions/products";
import { getCurrentUser } from "@/lib/auth";
import { InventoryClient } from "@/components/inventory/inventory-client";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const currentUser = await getCurrentUser();
  const isOwnerOrAdmin = currentUser?.role === "OWNER" || currentUser?.role === "ADMIN";

  const [summary, movementsRes, productsRes, suppliers] = await Promise.all([
    getInventoryDashboard(),
    getStockMovements({ limit: 50 }),
    getProducts({ limit: 100 }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <InventoryClient
      initialSummary={summary as any}
      products={productsRes.products as any}
      suppliers={suppliers}
      initialMovements={movementsRes.movements as any}
      isOwnerOrAdmin={isOwnerOrAdmin}
    />
  );
}
