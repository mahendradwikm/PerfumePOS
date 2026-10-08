"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth";
import { createProductSchema, updateProductSchema, type CreateProductInput, type UpdateProductInput } from "@/lib/validators";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import { serializeDecimal } from "@/lib/decimal";

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

export async function createCategory(name: string, description?: string) {
  await requireRole("OWNER", "ADMIN");
  return await prisma.category.create({
    data: { name, description },
  });
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

