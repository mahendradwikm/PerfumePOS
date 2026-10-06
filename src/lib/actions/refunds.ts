"use server";

import prisma from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth";
import { createRefundSchema, type CreateRefundInput } from "@/lib/validators";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { generateTransactionNumber } from "@/lib/utils";
import { Prisma } from "@prisma/client";

// ============================================================
// CREATE REFUND — ATOMIC TRANSACTION
// ============================================================

export async function createRefund(input: CreateRefundInput) {
  const user = await requireRole("OWNER", "ADMIN");
  const data = createRefundSchema.parse(input);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get original sale
      const sale = await tx.sale.findUnique({
        where: { id: data.saleId },
        include: { items: true },
      });

      if (!sale) throw new Error("Transaksi asal tidak ditemukan");
      if (sale.status === "VOID") throw new Error("Transaksi yang dibatalkan tidak bisa direfund");

      // Calculate refund amount
      let refundAmount = 0;
      for (const item of data.items) {
        refundAmount += item.quantity * item.unitPrice;
      }

      const refundNumber = generateTransactionNumber("RFD");

      // Create refund record
      const refund = await tx.refund.create({
        data: {
          refundNumber,
          saleId: data.saleId,
          refundAmount: new Prisma.Decimal(refundAmount),
          reason: data.reason,
          userId: user.id,
        },
      });

      // Create refund items and restore stock
      for (const item of data.items) {
        await tx.refundItem.create({
          data: {
            refundId: refund.id,
            productId: item.productId,
            productName: item.productName,
            quantity: new Prisma.Decimal(item.quantity),
            unitPrice: new Prisma.Decimal(item.unitPrice),
            lineTotal: new Prisma.Decimal(item.quantity * item.unitPrice),
            restoreStock: item.restoreStock,
          },
        });

        // Restore stock if applicable
        if (item.restoreStock) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (product) {
            const previousStock = Number(product.currentStock);
            const newStock = previousStock + item.quantity;

            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: new Prisma.Decimal(newStock) },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                movementType: "SALES_RETURN",
                quantity: new Prisma.Decimal(item.quantity),
                previousStock: new Prisma.Decimal(previousStock),
                newStock: new Prisma.Decimal(newStock),
                referenceType: "REFUND",
                referenceId: refund.id,
                userId: user.id,
                notes: `Refund ${refundNumber} dari transaksi ${sale.transactionNumber}`,
              },
            });
          }
        }
      }

      // Update sale status
      const totalSaleAmount = Number(sale.grandTotal);
      const isFullRefund = refundAmount >= totalSaleAmount;

      await tx.sale.update({
        where: { id: data.saleId },
        data: {
          status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
        },
      });

      // Update cash session if original payment was CASH
      if (sale.cashSessionId && sale.paymentMethod === "CASH") {
        await tx.cashSession.update({
          where: { id: sale.cashSessionId },
          data: {
            cashRefunds: { increment: new Prisma.Decimal(refundAmount) },
          },
        });
      }

      return refund;
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.REFUND_CREATE,
      entity: "refund",
      entityId: result.id,
      newValue: {
        saleId: data.saleId,
        refundAmount: data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
        items: data.items.length,
        reason: data.reason,
      },
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Create refund error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal membuat refund",
    };
  }
}

// ============================================================
// GET REFUNDS
// ============================================================

export async function getRefunds(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  await requireAuth();

  const { startDate, endDate, page = 1, limit = 20 } = params || {};

  const where: Prisma.RefundWhereInput = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate + "T23:59:59.999Z");
  }

  const [refunds, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      include: {
        sale: {
          select: {
            transactionNumber: true,
            paymentMethod: true,
            grandTotal: true,
          },
        },
        user: { select: { name: true } },
        items: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.refund.count({ where }),
  ]);

  return {
    refunds: refunds.map((r) => ({
      ...r,
      refundAmount: Number(r.refundAmount),
      sale: {
        ...r.sale,
        grandTotal: Number(r.sale.grandTotal),
      },
      items: r.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getSaleForRefund(transactionNumber: string) {
  await requireAuth();
  const sale = await prisma.sale.findFirst({
    where: {
      OR: [
        { transactionNumber },
        { id: transactionNumber },
      ],
      status: "COMPLETED",
    },
    include: {
      items: true,
      user: { select: { name: true } },
    },
  });

  if (!sale) {
    return { success: false, error: "Transaksi tidak ditemukan atau sudah dibatalkan." };
  }

  return {
    success: true,
    data: {
      ...sale,
      subtotal: Number(sale.subtotal),
      discountAmount: Number(sale.discountAmount),
      grandTotal: Number(sale.grandTotal),
      items: sale.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      })),
    },
  };
}

