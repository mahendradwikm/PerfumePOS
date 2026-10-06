"use server";

import prisma from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth";
import { restockSchema, stockAdjustmentSchema, type RestockInput, type StockAdjustmentInput } from "@/lib/validators";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { Prisma } from "@prisma/client";

// ============================================================
// RESTOCK / TAMBAH STOK
// ============================================================

export async function restockProduct(input: RestockInput) {
  const user = await requireRole("OWNER", "ADMIN");
  const data = restockSchema.parse(input);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get current product with lock
      const product = await tx.product.findUnique({
        where: { id: data.productId },
      });

      if (!product) {
        throw new Error("Produk tidak ditemukan");
      }

      const previousStock = Number(product.currentStock);
      const newStock = previousStock + data.quantity;

      // Update product stock
      const updatedProduct = await tx.product.update({
        where: { id: data.productId },
        data: {
          currentStock: new Prisma.Decimal(newStock),
        },
      });

      // Create stock movement
      const movement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          movementType: "RESTOCK",
          quantity: new Prisma.Decimal(data.quantity),
          previousStock: new Prisma.Decimal(previousStock),
          newStock: new Prisma.Decimal(newStock),
          referenceType: "RESTOCK",
          referenceId: data.referenceNumber || null,
          supplierId: data.supplierId || null,
          userId: user.id,
          notes: data.notes || `Restok ${data.quantity} ${product.unit}`,
        },
      });

      return { product: updatedProduct, movement };
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.RESTOCK,
      entity: "product",
      entityId: data.productId,
      previousValue: { stock: Number(result.product.currentStock) - data.quantity },
      newValue: { stock: Number(result.product.currentStock), added: data.quantity },
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Restock error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal melakukan restok",
    };
  }
}

// ============================================================
// STOCK ADJUSTMENT
// ============================================================

export async function adjustStock(input: StockAdjustmentInput) {
  const user = await requireRole("OWNER", "ADMIN");
  const data = stockAdjustmentSchema.parse(input);

  const isOutgoing = ["ADJUSTMENT_OUT", "DAMAGE", "LOST", "RETURN_TO_SUPPLIER"].includes(
    data.movementType
  );

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: data.productId },
      });

      if (!product) {
        throw new Error("Produk tidak ditemukan");
      }

      const previousStock = Number(product.currentStock);
      const adjustmentQty = isOutgoing ? -data.quantity : data.quantity;
      const newStock = previousStock + adjustmentQty;

      // Validate: no negative stock for outgoing adjustments
      if (isOutgoing && newStock < 0) {
        throw new Error(
          `Stok tidak mencukupi. Stok saat ini: ${previousStock} ${product.unit}`
        );
      }

      // Update product stock
      const updatedProduct = await tx.product.update({
        where: { id: data.productId },
        data: {
          currentStock: new Prisma.Decimal(newStock),
        },
      });

      // Create stock movement
      const movement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          movementType: data.movementType,
          quantity: new Prisma.Decimal(adjustmentQty),
          previousStock: new Prisma.Decimal(previousStock),
          newStock: new Prisma.Decimal(newStock),
          referenceType: "ADJUSTMENT",
          userId: user.id,
          notes: `${data.reason}${data.notes ? ` - ${data.notes}` : ""}`,
        },
      });

      return { product: updatedProduct, movement };
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.STOCK_ADJUSTMENT,
      entity: "product",
      entityId: data.productId,
      previousValue: { stock: Number(result.product.currentStock) - (isOutgoing ? -data.quantity : data.quantity) },
      newValue: {
        stock: Number(result.product.currentStock),
        type: data.movementType,
        quantity: isOutgoing ? -data.quantity : data.quantity,
        reason: data.reason,
      },
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Stock adjustment error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal melakukan penyesuaian stok",
    };
  }
}

// ============================================================
// GET STOCK MOVEMENTS
// ============================================================

export async function getStockMovements(params?: {
  productId?: string;
  movementType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  await requireAuth();

  const {
    productId,
    movementType,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = params || {};

  const where: Prisma.StockMovementWhereInput = {};

  if (productId) where.productId = productId;
  if (movementType) where.movementType = movementType as Prisma.EnumMovementTypeFilter["equals"];

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate + "T23:59:59.999Z");
  }

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true, unit: true } },
        user: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return {
    movements: movements.map((m) => ({
      ...m,
      quantity: Number(m.quantity),
      previousStock: Number(m.previousStock),
      newStock: Number(m.newStock),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ============================================================
// INVENTORY DASHBOARD DATA
// ============================================================

export async function getInventoryDashboard() {
  await requireAuth();

  const [
    totalProducts,
    activeProducts,
    totalStockResult,
    inventoryValueResult,
    lowStockProducts,
    outOfStockProducts,
    recentMovements,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.$queryRaw<[{ total: number }]>`
      SELECT COALESCE(SUM(current_stock::float), 0) as total FROM products WHERE is_active = true
    `,
    prisma.$queryRaw<[{ total: number }]>`
      SELECT COALESCE(SUM(current_stock * cost_price), 0)::float as total FROM products WHERE is_active = true
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM products WHERE current_stock <= minimum_stock AND current_stock > 0 AND is_active = true
    `,
    prisma.product.count({ where: { currentStock: { lte: 0 }, isActive: true } }),
    prisma.stockMovement.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        user: { select: { name: true } },
      },
    }),
  ]);

  return {
    totalProducts,
    activeProducts,
    totalStock: totalStockResult[0]?.total || 0,
    inventoryValue: inventoryValueResult[0]?.total || 0,
    lowStockCount: Number(lowStockProducts[0]?.count || 0),
    outOfStockCount: outOfStockProducts,
    recentMovements: recentMovements.map((m) => ({
      ...m,
      quantity: Number(m.quantity),
      previousStock: Number(m.previousStock),
      newStock: Number(m.newStock),
    })),
  };
}
