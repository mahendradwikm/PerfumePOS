import { getProducts, getCategories } from "@/lib/actions/products";
import { getActiveCashSession } from "@/lib/actions/cash";
import { getCurrentUser } from "@/lib/auth";
import { POSClient } from "@/components/pos/pos-client";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const currentUser = await getCurrentUser();
  const [productsRes, categories, activeSession, storeSettingsData] = await Promise.all([
    getProducts({ isActive: true, limit: 100 }),
    getCategories(),
    getActiveCashSession(),
    prisma.storeSetting.findMany(),
  ]);

  // Convert settings array into map
  const storeSettingsMap: Record<string, string> = {};
  for (const s of storeSettingsData) {
    storeSettingsMap[s.key] = s.value;
  }

  const storeSettings = {
    storeName: storeSettingsMap.store_name || "MISYourPOS Parfumerie",
    address: storeSettingsMap.store_address || "Jl. Malioboro No. 45, Yogyakarta",
    phone: storeSettingsMap.store_phone || "0812-3456-7890",
    receiptHeader: storeSettingsMap.receipt_header,
    receiptFooter: storeSettingsMap.receipt_footer,
  };

  return (
    <div className="h-full">
      <POSClient
        initialProducts={productsRes.products as any}
        categories={categories as any}
        activeSession={activeSession}
        currentUser={currentUser}
        storeSettings={storeSettings}
      />
    </div>
  );
}
