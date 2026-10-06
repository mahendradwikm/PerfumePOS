"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createSaleSchema, type CreateSaleInput } from "@/lib/validators";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { generateTransactionNumber, serializeDecimal } from "@/lib/utils";
import { Prisma } from "@prisma/client";

// ============================================================
// CREATE SALE — ATOMIC TRANSACTION
// This is the most critical business operation.
// It atomically:
// 1. Validates all product stock
// 2. Creates the sale record
// 3. Creates sale items
// 4. Deducts inventory for each item
// 5. Creates stock movements for each item
// 6. Updates cash session if applicable
// ============================================================

export async function createSale(input: CreateSaleInput) {
  const user = await requireAuth();
  const data = createSaleSchema.parse(input);

  // Calculate totals
  let subtotal = 0;
  for (const item of data.items) {
    const lineTotal = item.quantity * item.unitPrice - item.discount;
    subtotal += lineTotal;
  }

  const discountAmount = data.discountAmount || 0;
  const grandTotal = subtotal - discountAmount;

  // Validate cash payment
  if (data.paymentMethod === "CASH") {
    if (!data.cashReceived || data.cashReceived < grandTotal) {
      return {
        success: false,
        error: `Uang tunai tidak cukup. Total: Rp${grandTotal.toLocaleString("id-ID")}, Diterima: Rp${(data.cashReceived || 0).toLocaleString("id-ID")}`,
      };
    }
  }

  const changeAmount =
    data.paymentMethod === "CASH" ? (data.cashReceived || 0) - grandTotal : 0;

  const transactionNumber = generateTransactionNumber("TXN");

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ---- STEP 1: Validate all products and stock ----
      for (const item of data.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, currentStock: true, isActive: true, unit: true },
        });

        if (!product) {
          throw new Error(`Produk tidak ditemukan: ${item.productName}`);
        }

        if (!product.isActive) {
          throw new Error(`Produk tidak aktif: ${product.name}`);
        }

        const currentStock = Number(product.currentStock);
        if (currentStock < item.quantity) {
          throw new Error(
            `Stok produk tidak mencukupi. ${product.name}: stok ${currentStock} ${product.unit}, diminta ${item.quantity} ${product.unit}`
          );
        }
      }

      // ---- STEP 2: Create sale ----
      const sale = await tx.sale.create({
        data: {
          transactionNumber,
          date: new Date(),
          subtotal: new Prisma.Decimal(subtotal),
          discountAmount: new Prisma.Decimal(discountAmount),
          discountPercent: new Prisma.Decimal(data.discountPercent || 0),
          grandTotal: new Prisma.Decimal(grandTotal),
          paymentMethod: data.paymentMethod,
          cashReceived: data.cashReceived
            ? new Prisma.Decimal(data.cashReceived)
            : null,
          changeAmount: new Prisma.Decimal(changeAmount),
          status: "COMPLETED",
          notes: data.notes || null,
          userId: user.id,
          cashSessionId: data.cashSessionId || null,
          customerName: data.customerName || null,
        },
      });

      // ---- STEP 3: Create sale items ----
      for (const item of data.items) {
        const lineTotal = item.quantity * item.unitPrice - item.discount;

        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            quantity: new Prisma.Decimal(item.quantity),
            unitPrice: new Prisma.Decimal(item.unitPrice),
            costPrice: new Prisma.Decimal(item.costPrice),
            discount: new Prisma.Decimal(item.discount || 0),
            lineTotal: new Prisma.Decimal(lineTotal),
            unit: item.unit || "ml",
          },
        });

        // ---- STEP 4: Deduct inventory ----
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) throw new Error(`Produk tidak ditemukan: ${item.productId}`);

        const previousStock = Number(product.currentStock);
        const newStock = previousStock - item.quantity;

        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: new Prisma.Decimal(newStock),
          },
        });

        // ---- STEP 5: Create stock movement ----
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            movementType: "SALE",
            quantity: new Prisma.Decimal(-item.quantity),
            previousStock: new Prisma.Decimal(previousStock),
            newStock: new Prisma.Decimal(newStock),
            referenceType: "SALE",
            referenceId: sale.id,
            userId: user.id,
            notes: `Penjualan ${transactionNumber}`,
          },
        });
      }

      // ---- STEP 6: Update cash session if applicable ----
      if (data.cashSessionId) {
        const sessionUpdate: Prisma.CashSessionUpdateInput = {
          totalTransactions: { increment: 1 },
          totalSales: { increment: new Prisma.Decimal(grandTotal) },
        };

        if (data.paymentMethod === "CASH") {
          sessionUpdate.cashSales = { increment: new Prisma.Decimal(grandTotal) };
        } else if (data.paymentMethod === "QRIS") {
          sessionUpdate.qrisSales = { increment: new Prisma.Decimal(grandTotal) };
        }

        await tx.cashSession.update({
          where: { id: data.cashSessionId },
          data: sessionUpdate,
        });
      }

      return sale;
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.SALE_CREATE,
      entity: "sale",
      entityId: result.id,
      newValue: {
        transactionNumber,
        grandTotal,
        paymentMethod: data.paymentMethod,
        items: data.items.length,
      },
    });

    revalidatePath("/", "layout");

    return {
      success: true,
      data: {
        id: result.id,
        transactionNumber: result.transactionNumber,
        grandTotal: Number(result.grandTotal),
        changeAmount: Number(result.changeAmount),
        paymentMethod: result.paymentMethod,
      },
    };
  } catch (error) {
    console.error("Create sale error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal membuat transaksi",
    };
  }
}

// ============================================================
// GET SALES
// ============================================================

export async function getSales(params?: {
  search?: string;
  status?: string;
  paymentMethod?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  cashSessionId?: string;
  page?: number;
  limit?: number;
}) {
  await requireAuth();

  const {
    search = "",
    status,
    paymentMethod,
    userId,
    startDate,
    endDate,
    cashSessionId,
    page = 1,
    limit = 20,
  } = params || {};

  const where: Prisma.SaleWhereInput = {};

  if (search) {
    where.transactionNumber = { contains: search, mode: "insensitive" };
  }

  if (status) where.status = status as Prisma.EnumSaleStatusFilter["equals"];
  if (paymentMethod) where.paymentMethod = paymentMethod as Prisma.EnumPaymentMethodFilter["equals"];
  if (userId) where.userId = userId;
  if (cashSessionId) where.cashSessionId = cashSessionId;

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate + "T23:59:59.999Z");
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        _count: { select: { items: true, refunds: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { date: "desc" },
    }),
    prisma.sale.count({ where }),
  ]);

  return serializeDecimal({
    sales: sales.map((s) => ({
      ...s,
      subtotal: Number(s.subtotal),
      discountAmount: Number(s.discountAmount),
      discountPercent: Number(s.discountPercent),
      grandTotal: Number(s.grandTotal),
      cashReceived: s.cashReceived ? Number(s.cashReceived) : null,
      changeAmount: s.changeAmount ? Number(s.changeAmount) : null,
      taxAmount: Number(s.taxAmount),
      items: s.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        costPrice: Number(i.costPrice),
        discount: Number(i.discount),
        lineTotal: Number(i.lineTotal),
      })),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

// ============================================================
// GET SALE DETAIL
// ============================================================

export async function getSaleDetail(id: string) {
  await requireAuth();

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
      refunds: {
        include: {
          items: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!sale) return null;

  return serializeDecimal({
    ...sale,
    subtotal: Number(sale.subtotal),
    discountAmount: Number(sale.discountAmount),
    discountPercent: Number(sale.discountPercent),
    grandTotal: Number(sale.grandTotal),
    cashReceived: sale.cashReceived ? Number(sale.cashReceived) : null,
    changeAmount: sale.changeAmount ? Number(sale.changeAmount) : null,
    taxAmount: Number(sale.taxAmount),
    items: sale.items.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      costPrice: Number(i.costPrice),
      discount: Number(i.discount),
      lineTotal: Number(i.lineTotal),
    })),
    refunds: sale.refunds.map((r) => ({
      ...r,
      refundAmount: Number(r.refundAmount),
      items: r.items.map((ri) => ({
        ...ri,
        quantity: Number(ri.quantity),
        unitPrice: Number(ri.unitPrice),
        lineTotal: Number(ri.lineTotal),
      })),
    })),
  });
}

// ============================================================
// VOID SALE
// ============================================================

export async function voidSale(saleId: string, reason: string) {
  const user = await requireAuth();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      });

      if (!sale) throw new Error("Transaksi tidak ditemukan");
      if (sale.status !== "COMPLETED") throw new Error("Hanya transaksi selesai yang bisa dibatalkan");

      // Restore stock for each item
      for (const item of sale.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (product) {
          const previousStock = Number(product.currentStock);
          const newStock = previousStock + Number(item.quantity);

          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: new Prisma.Decimal(newStock) },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              movementType: "SALES_RETURN",
              quantity: item.quantity,
              previousStock: new Prisma.Decimal(previousStock),
              newStock: new Prisma.Decimal(newStock),
              referenceType: "VOID",
              referenceId: sale.id,
              userId: user.id,
              notes: `Pembatalan transaksi ${sale.transactionNumber}: ${reason}`,
            },
          });
        }
      }

      // Update cash session
      if (sale.cashSessionId) {
        const sessionUpdate: Prisma.CashSessionUpdateInput = {
          totalTransactions: { decrement: 1 },
          totalSales: { decrement: sale.grandTotal },
        };

        if (sale.paymentMethod === "CASH") {
          sessionUpdate.cashSales = { decrement: sale.grandTotal };
        } else if (sale.paymentMethod === "QRIS") {
          sessionUpdate.qrisSales = { decrement: sale.grandTotal };
        }

        await tx.cashSession.update({
          where: { id: sale.cashSessionId },
          data: sessionUpdate,
        });
      }

      // Mark sale as void
      const voidedSale = await tx.sale.update({
        where: { id: saleId },
        data: { status: "VOID", notes: `VOID: ${reason}` },
      });

      return voidedSale;
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.SALE_VOID,
      entity: "sale",
      entityId: saleId,
      newValue: { reason },
    });

    revalidatePath("/", "layout");
    return { success: true, data: serializeDecimal(result) };
  } catch (error) {
    console.error("Void sale error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal membatalkan transaksi",
    };
  }
}
