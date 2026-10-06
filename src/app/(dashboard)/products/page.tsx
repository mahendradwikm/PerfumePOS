import { getProducts, getCategories } from "@/lib/actions/products";
import { getCurrentUser } from "@/lib/auth";
import { ProductsClient } from "@/components/products/products-client";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const currentUser = await getCurrentUser();
  const isOwnerOrAdmin = currentUser?.role === "OWNER" || currentUser?.role === "ADMIN";

  const [productsRes, categories] = await Promise.all([
    getProducts({ limit: 200 }),
    getCategories(),
  ]);

  return (
    <ProductsClient
      initialProducts={productsRes.products as any}
      categories={categories as any}
      isOwnerOrAdmin={isOwnerOrAdmin}
    />
  );
}
