"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth";
import { createProductSchema, updateProductSchema, type CreateProductInput, type UpdateProductInput } from "@/lib/validators";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import { serializeDecimal } from "@/lib/decimal";

/** Narrows a caught value to a known Prisma error code (P2002 = unique). */
function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === code
  );
}

/**
 * The embedded Postgres used in local/dev runs behind a driver that surfaces
 * FK violations as `PrismaClientUnknownRequestError` with no `code`, so the
 * usual `P2003` check silently never fires. Match on the message too, otherwise
 * a concurrent write would collapse into a generic "gagal menghapus" message.
 */
function isForeignKeyViolation(error: unknown): boolean {
  if (isPrismaError(error, "P2003")) return true;
  const message = error instanceof Error ? error.message : "";
  return /foreign key constraint|violates (ON DELETE )?RESTRICT/i.test(message);
}

/** Record-not-found, as reported by Prisma or by the underlying driver. */
function isRecordNotFound(error: unknown): boolean {
  if (isPrismaError(error, "P2025")) return true;
  const message = error instanceof Error ? error.message : "";
  return /Record to (delete|update) does not exist|RecordNotFound/i.test(message);
}

// ============================================================
// CREATE PRODUCT
// ============================================================

export async function createProduct(input: CreateProductInput) {
  const user = await requireRole("OWNER", "ADMIN");
  const data = createProductSchema.parse(input);

  const { initialStock, ...productData } = data;

  // Check for duplicate SKU
  const existing = await prisma.product.findUnique({
    where: { sku: productData.sku },
  });
  if (existing) {
    return { success: false, error: "SKU sudah digunakan" };
  }

  // Check for duplicate barcode if provided
  if (productData.barcode) {
    const existingBarcode = await prisma.product.findUnique({
      where: { barcode: productData.barcode },
    });
    if (existingBarcode) {
      return { success: false, error: "Barcode sudah digunakan" };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create product
      const product = await tx.product.create({
        data: {
          ...productData,
          costPrice: new Prisma.Decimal(productData.costPrice),
          sellingPrice: new Prisma.Decimal(productData.sellingPrice),
          minimumStock: new Prisma.Decimal(productData.minimumStock || 0),
          currentStock: new Prisma.Decimal(initialStock || 0),
          barcode: productData.barcode || null,
          fragranceName: productData.fragranceName || null,
          description: productData.description || null,
          notes: productData.notes || null,
          image: productData.image || null,
          rackLocation: productData.rackLocation || null,
          categoryId: productData.categoryId || null,
          supplierId: productData.supplierId || null,
        },
      });

      // If initial stock > 0, create stock movement
      if (initialStock && initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: "INITIAL_STOCK",
            quantity: new Prisma.Decimal(initialStock),
            previousStock: new Prisma.Decimal(0),
            newStock: new Prisma.Decimal(initialStock),
            referenceType: "PRODUCT",
            referenceId: product.id,
            userId: user.id,
            notes: "Stok awal saat pembuatan produk",
          },
        });
      }

      return product;
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.PRODUCT_CREATE,
      entity: "product",
      entityId: result.id,
      newValue: { ...productData, initialStock },
    });

    const serialized = {
      ...result,
      costPrice: Number(result.costPrice),
      sellingPrice: Number(result.sellingPrice),
      currentStock: Number(result.currentStock),
      minimumStock: Number(result.minimumStock),
    };

    revalidatePath("/", "layout");
    return { success: true, data: serializeDecimal(serialized) };
  } catch (error) {
    console.error("Create product error:", error);
    return { success: false, error: "Gagal membuat produk" };
  }
}

// ============================================================
// UPDATE PRODUCT
// ============================================================

export async function updateProduct(id: string, input: UpdateProductInput) {
  const user = await requireRole("OWNER", "ADMIN");
  const data = updateProductSchema.parse(input);

  try {
    const previous = await prisma.product.findUnique({ where: { id } });
    if (!previous) {
      return { success: false, error: "Produk tidak ditemukan" };
    }

    // Check SKU uniqueness if changed
    if (data.sku && data.sku !== previous.sku) {
      const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
      if (existing) {
        return { success: false, error: "SKU sudah digunakan" };
      }
    }

    // Check barcode uniqueness if changed
    if (data.barcode && data.barcode !== previous.barcode) {
      const existing = await prisma.product.findUnique({ where: { barcode: data.barcode } });
      if (existing) {
        return { success: false, error: "Barcode sudah digunakan" };
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.barcode !== undefined) updateData.barcode = data.barcode || null;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.fragranceName !== undefined) updateData.fragranceName = data.fragranceName || null;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.costPrice !== undefined) updateData.costPrice = new Prisma.Decimal(data.costPrice);
    if (data.sellingPrice !== undefined) updateData.sellingPrice = new Prisma.Decimal(data.sellingPrice);
    if (data.minimumStock !== undefined) updateData.minimumStock = new Prisma.Decimal(data.minimumStock);
    if (data.image !== undefined) updateData.image = data.image || null;
    if (data.rackLocation !== undefined) updateData.rackLocation = data.rackLocation || null;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      userId: user.id,
      action: data.isActive === false ? AUDIT_ACTIONS.PRODUCT_DEACTIVATE : AUDIT_ACTIONS.PRODUCT_UPDATE,
      entity: "product",
      entityId: id,
      previousValue: previous,
      newValue: product,
    });

    const serialized = {
      ...product,
      costPrice: Number(product.costPrice),
      sellingPrice: Number(product.sellingPrice),
      currentStock: Number(product.currentStock),
      minimumStock: Number(product.minimumStock),
    };

    revalidatePath("/", "layout");
    return { success: true, data: serializeDecimal(serialized) };
  } catch (error) {
    console.error("Update product error:", error);
    return { success: false, error: "Gagal mengupdate produk" };
  }
}

// ============================================================
// DELETE PRODUCT
// ============================================================

export interface ProductDeleteResult {
  success: boolean;
  error?: string;
  /** `NOT_FOUND` when the id is stale (already deleted elsewhere / never existed). */
  code?: "NOT_FOUND" | "HAS_TRANSACTION_HISTORY" | "IN_USE";
  /** True when the caller should offer "Nonaktifkan" instead of a hard delete. */
  canDeactivate?: boolean;
  salesCount?: number;
  refundCount?: number;
  /** True when there was nothing left to delete - the desired end state already holds. */
  alreadyDeleted?: boolean;
}

/**
 * Hard-deletes a product together with its stock movements.
 *
 * Idempotent: deleting an id that no longer exists resolves to `success` with
 * `alreadyDeleted`, so the Produk / Inventori / Kasir menus always converge on
 * the same list instead of erroring out on stale rows.
 */
export async function deleteProduct(id: string): Promise<ProductDeleteResult> {
  const user = await requireRole("OWNER", "ADMIN");

  if (!id) {
    return { success: false, code: "NOT_FOUND", error: "ID produk tidak valid" };
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { saleItems: true, refundItems: true } } },
    });

    if (!product) {
      // Nothing to remove - treat as success so the UI stays consistent.
      return { success: true, alreadyDeleted: true };
    }

    const { saleItems, refundItems } = product._count;

    // A movement created by a sale/refund still points at this product even if the
    // sale rows themselves were detached, so it counts as transaction history too.
    const transactionalMovements = await prisma.stockMovement.count({
      where: { productId: id, referenceType: { in: ["SALE", "REFUND"] } },
    });

    if (saleItems > 0 || refundItems > 0 || transactionalMovements > 0) {
      const parts: string[] = [];
      if (saleItems > 0) parts.push(`${saleItems} transaksi penjualan`);
      if (refundItems > 0) parts.push(`${refundItems} refund`);
      // Can be reached when sale rows were detached but their stock movements remain.
      if (parts.length === 0) parts.push("riwayat mutasi stok dari penjualan");

      return {
        success: false,
        code: "HAS_TRANSACTION_HISTORY",
        canDeactivate: true,
        salesCount: saleItems,
        refundCount: refundItems,
        error:
          `"${product.name}" sudah pernah masuk transaksi (${parts.join(", ")}), ` +
          `jadi tidak bisa dihapus permanen karena akan merusak laporan. ` +
          `Nonaktifkan saja agar hilang dari Kasir & Inventori.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      // Stock movements are ledger rows owned by the product. The FK is required
      // and has no cascade, so they must go first.
      await tx.stockMovement.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.PRODUCT_DELETE,
      entity: "product",
      entityId: id,
      previousValue: {
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        categoryId: product.categoryId,
        unit: product.unit,
        costPrice: Number(product.costPrice),
        sellingPrice: Number(product.sellingPrice),
        currentStock: Number(product.currentStock),
      },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    console.error("Delete product error:", error);

    // Someone else deleted it between our read and the write.
    if (isRecordNotFound(error)) {
      return { success: true, alreadyDeleted: true };
    }
    // Another record started referencing the product in the meantime.
    if (isForeignKeyViolation(error)) {
      return {
        success: false,
        code: "IN_USE",
        canDeactivate: true,
        error:
          "Produk sudah tercatat pada transaksi lain. Nonaktifkan saja agar disembunyikan dari Kasir & Inventori.",
      };
    }

    return { success: false, error: "Gagal menghapus produk" };
  }
}

// ============================================================
// DEACTIVATE PRODUCT (soft delete)
// ============================================================

/**
 * Soft delete: flips `isActive` to false so the product disappears from Kasir
 * and reports while keeping its sales history intact. Idempotent.
 */
export async function deactivateProduct(id: string) {
  const user = await requireRole("OWNER", "ADMIN");

  try {
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      return { success: true, alreadyDeactivated: true };
    }

    if (!product.isActive) {
      return { success: true, alreadyDeactivated: true };
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.PRODUCT_DEACTIVATE,
      entity: "product",
      entityId: id,
      previousValue: { isActive: product.isActive },
      newValue: { isActive: updated.isActive },
    });

    revalidatePath("/", "layout");
    return {
      success: true,
      data: serializeDecimal({
        ...updated,
        costPrice: Number(updated.costPrice),
        sellingPrice: Number(updated.sellingPrice),
        currentStock: Number(updated.currentStock),
        minimumStock: Number(updated.minimumStock),
      }),
    };
  } catch (error: unknown) {
    console.error("Deactivate product error:", error);
    return { success: false, error: "Gagal menonaktifkan produk" };
  }
}

// ============================================================
// GET PRODUCTS
// ============================================================

export async function getProducts(params?: {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  lowStock?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  await requireAuth();

  const {
    search = "",
    categoryId,
    isActive,
    lowStock,
    page = 1,
    limit = 20,
    sortBy = "name",
    sortOrder = "asc",
  } = params || {};

  const where: Prisma.ProductWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
      { fragranceName: { contains: search, mode: "insensitive" } },
    ];
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (lowStock) {
    where.currentStock = {
      lte: prisma.product.fields.minimumStock,
    };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.product.count({ where }),
  ]);

  return serializeDecimal({
    products: products.map((p) => ({
      ...p,
      costPrice: Number(p.costPrice),
      sellingPrice: Number(p.sellingPrice),
      currentStock: Number(p.currentStock),
      minimumStock: Number(p.minimumStock),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

// ============================================================
// GET SINGLE PRODUCT
// ============================================================

export async function getProduct(id: string) {
  await requireAuth();

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      supplier: true,
      stockMovements: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!product) return null;

  return serializeDecimal({
    ...product,
    costPrice: Number(product.costPrice),
    sellingPrice: Number(product.sellingPrice),
    currentStock: Number(product.currentStock),
    minimumStock: Number(product.minimumStock),
    stockMovements: product.stockMovements.map((m) => ({
      ...m,
      quantity: Number(m.quantity),
      previousStock: Number(m.previousStock),
      newStock: Number(m.newStock),
    })),
  });
}

// ============================================================
// GET LOW STOCK PRODUCTS
// ============================================================

export async function getLowStockProducts() {
  await requireAuth();

  const products = await prisma.$queryRaw<
    Array<{
      id: string;
      sku: string;
      name: string;
      current_stock: number;
      minimum_stock: number;
      unit: string;
    }>
  >`
    SELECT id, sku, name, current_stock::float, minimum_stock::float, unit
    FROM products
    WHERE current_stock <= minimum_stock AND is_active = true
    ORDER BY current_stock ASC
    LIMIT 50
  `;

  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    currentStock: p.current_stock,
    minimumStock: p.minimum_stock,
    unit: p.unit,
  }));
}

// ============================================================
// SEARCH PRODUCTS (for POS - optimized)
// ============================================================

export async function searchProducts(query: string, limit: number = 20) {
  await requireAuth();

  if (!query || query.length < 1) {
    return [];
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
        { barcode: { contains: query, mode: "insensitive" } },
        { fragranceName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      sku: true,
      barcode: true,
      name: true,
      fragranceName: true,
      unit: true,
      sellingPrice: true,
      costPrice: true,
      currentStock: true,
      minimumStock: true,
      category: { select: { name: true } },
    },
    take: limit,
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    ...p,
    sellingPrice: Number(p.sellingPrice),
    costPrice: Number(p.costPrice),
    currentStock: Number(p.currentStock),
    minimumStock: Number(p.minimumStock),
  }));
}

// ============================================================
// CATEGORIES
// ============================================================

export async function getCategories() {
  await requireAuth();
  return await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });
}

export async function createCategory(name: string, description?: string | null) {
  const user = await requireRole("OWNER", "ADMIN");

  const trimmedName = name?.trim();
  if (!trimmedName) {
    return { success: false, error: "Nama kategori wajib diisi" };
  }

  try {
    const existing = await prisma.category.findUnique({ where: { name: trimmedName } });
    if (existing) {
      return { success: false, error: `Kategori "${trimmedName}" sudah ada` };
    }

    const category = await prisma.category.create({
      data: { name: trimmedName, description: description?.trim() || null },
      include: { _count: { select: { products: true } } },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.CATEGORY_CREATE,
      entity: "category",
      entityId: category.id,
      newValue: { name: category.name, description: category.description },
    });

    revalidatePath("/", "layout");
    return { success: true, data: category };
  } catch (error: unknown) {
    console.error("Create category error:", error);
    const message = error instanceof Error ? error.message : "";
    if (isPrismaError(error, "P2002") || /unique constraint/i.test(message)) {
      return { success: false, error: `Kategori "${trimmedName}" sudah ada` };
    }
    return { success: false, error: "Gagal membuat kategori" };
  }
}

export async function updateCategory(
  id: string,
  input: { name?: string; description?: string | null; isActive?: boolean }
) {
  const user = await requireRole("OWNER", "ADMIN");

  try {
    const previous = await prisma.category.findUnique({ where: { id } });
    if (!previous) {
      return { success: false, error: "Kategori tidak ditemukan" };
    }

    const updateData: Prisma.CategoryUpdateInput = {};
    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        return { success: false, error: "Nama kategori wajib diisi" };
      }
      // Checked up front: the unique-violation code is not surfaced by the
      // embedded Postgres driver, so the catch block cannot rely on it.
      if (trimmedName !== previous.name) {
        const taken = await prisma.category.findUnique({ where: { name: trimmedName } });
        if (taken) {
          return { success: false, error: `Kategori "${trimmedName}" sudah dipakai kategori lain` };
        }
      }
      updateData.name = trimmedName;
    }
    if (input.description !== undefined) {
      updateData.description = input.description?.trim() || null;
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { products: true } } },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.CATEGORY_UPDATE,
      entity: "category",
      entityId: id,
      previousValue: { name: previous.name, description: previous.description, isActive: previous.isActive },
      newValue: { name: category.name, description: category.description, isActive: category.isActive },
    });

    revalidatePath("/", "layout");
    return { success: true, data: category };
  } catch (error: unknown) {
    console.error("Update category error:", error);
    const message = error instanceof Error ? error.message : "";
    if (isPrismaError(error, "P2002") || /unique constraint/i.test(message)) {
      return { success: false, error: "Nama kategori sudah digunakan" };
    }
    return { success: false, error: "Gagal mengupdate kategori" };
  }
}

export interface CategoryDeleteResult {
  success: boolean;
  error?: string;
  code?: "NOT_FOUND" | "NOT_EMPTY";
  /** How many products are still attached - surfaced so the UI can name them. */
  productCount?: number;
  alreadyDeleted?: boolean;
}

/**
 * Deletes an empty category. Refuses while products are still attached so a
 * deletion can never silently orphan catalog entries or stale category filters
 * in Kasir / Inventori / Laporan.
 */
export async function deleteCategory(id: string): Promise<CategoryDeleteResult> {
  const user = await requireRole("OWNER", "ADMIN");

  if (!id) {
    return { success: false, code: "NOT_FOUND", error: "ID kategori tidak valid" };
  }

  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!category) {
      return { success: true, alreadyDeleted: true };
    }

    const productCount = category._count.products;
    if (productCount > 0) {
      return {
        success: false,
        code: "NOT_EMPTY",
        productCount,
        error:
          `Kategori "${category.name}" masih memiliki ${productCount} produk. ` +
          `Pindahkan atau hapus produknya dulu, baru kategori ini bisa dihapus.`,
      };
    }

    await prisma.category.delete({ where: { id } });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.CATEGORY_DELETE,
      entity: "category",
      entityId: id,
      previousValue: { name: category.name, description: category.description },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    console.error("Delete category error:", error);

    if (isRecordNotFound(error)) {
      return { success: true, alreadyDeleted: true };
    }
    if (isForeignKeyViolation(error)) {
      return {
        success: false,
        code: "NOT_EMPTY",
        error: "Kategori masih digunakan produk. Pindahkan atau hapus produknya dulu.",
      };
    }

    return { success: false, error: "Gagal menghapus kategori" };
  }
}

// ============================================================
// BULK IMPORT PRODUCTS (CSV / Excel)
// ============================================================

export async function bulkCreateProducts(items: {
  sku: string;
  name: string;
  fragranceName?: string;
  categoryName?: string;
  unit?: string;
  costPrice: number;
  sellingPrice: number;
  initialStock?: number;
  minimumStock?: number;
}[]) {
  const user = await requireRole("OWNER", "ADMIN");

  if (!items || items.length === 0) {
    return { success: false, error: "Data impor kosong" };
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    if (!item.name || !item.sku) continue;

    // Find or create category if provided
    let categoryId: string | null = null;
    if (item.categoryName) {
      let cat = await prisma.category.findUnique({
        where: { name: item.categoryName.trim() },
      });
      if (!cat) {
        cat = await prisma.category.create({
          data: { name: item.categoryName.trim() },
        });
      }
      categoryId = cat.id;
    }

    const existing = await prisma.product.findUnique({
      where: { sku: item.sku },
    });

    if (existing) {
      // Update existing
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          fragranceName: item.fragranceName || existing.fragranceName,
          costPrice: new Prisma.Decimal(item.costPrice || 0),
          sellingPrice: new Prisma.Decimal(item.sellingPrice || 0),
          minimumStock: new Prisma.Decimal(item.minimumStock || 10),
          ...(categoryId ? { categoryId } : {}),
        },
      });
      updatedCount++;
    } else {
      // Create new
      const prod = await prisma.product.create({
        data: {
          sku: item.sku,
          name: item.name,
          fragranceName: item.fragranceName || null,
          category: categoryId ? undefined : undefined,
          categoryId: categoryId,
          unit: item.unit || "ml",
          costPrice: new Prisma.Decimal(item.costPrice || 0),
          sellingPrice: new Prisma.Decimal(item.sellingPrice || 0),
          currentStock: new Prisma.Decimal(item.initialStock || 0),
          minimumStock: new Prisma.Decimal(item.minimumStock || 20),
          isActive: true,
        },
      });

      if (item.initialStock && item.initialStock > 0) {
        await prisma.stockMovement.create({
          data: {
            productId: prod.id,
            movementType: "INITIAL_STOCK",
            quantity: new Prisma.Decimal(item.initialStock),
            previousStock: new Prisma.Decimal(0),
            newStock: new Prisma.Decimal(item.initialStock),
            referenceType: "PRODUCT",
            referenceId: prod.id,
            userId: user.id,
            notes: "Impor bulk Excel/CSV",
          },
        });
      }

      createdCount++;
    }
  }

  await createAuditLog({
    userId: user.id,
    action: AUDIT_ACTIONS.PRODUCT_CREATE,
    entity: "product",
    newValue: { bulkImportCount: createdCount + updatedCount, createdCount, updatedCount },
  });

  revalidatePath("/", "layout");
  return { success: true, createdCount, updatedCount };
}

