"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth";
import { expenseSchema, type ExpenseInput } from "@/lib/validators";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import { serializeDecimal } from "@/lib/decimal";

// ============================================================
// CREATE EXPENSE
// ============================================================

export async function createExpense(input: ExpenseInput) {
  const user = await requireRole("OWNER", "ADMIN");
  const data = expenseSchema.parse(input);

  try {
    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          date: new Date(data.date),
          category: data.category,
          description: data.description,
          amount: new Prisma.Decimal(data.amount),
          paymentMethod: data.paymentMethod,
          notes: data.notes || null,
          userId: user.id,
          cashSessionId: data.cashSessionId || null,
        },
      });

      // Update cash session if cash expense
      if (data.cashSessionId && data.paymentMethod === "CASH") {
        await tx.cashSession.update({
          where: { id: data.cashSessionId },
          data: {
            cashExpenses: { increment: new Prisma.Decimal(data.amount) },
          },
        });
      }

      return exp;
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.EXPENSE_CREATE,
      entity: "expense",
      entityId: expense.id,
      newValue: data,
    });

    const serialized = {
      ...expense,
      amount: Number(expense.amount),
    };

    revalidatePath("/", "layout");
    return { success: true, data: serializeDecimal(serialized) };
  } catch (error) {
    console.error("Create expense error:", error);
    return { success: false, error: "Gagal membuat pengeluaran" };
  }
}

// ============================================================
// GET EXPENSES
// ============================================================

export async function getExpenses(params?: {
  category?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  await requireAuth();

  const { category, paymentMethod, startDate, endDate, page = 1, limit = 20 } = params || {};

  const where: Prisma.ExpenseWhereInput = {};

  if (category) where.category = category;
  if (paymentMethod) where.paymentMethod = paymentMethod as Prisma.EnumPaymentMethodFilter["equals"];
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate + "T23:59:59.999Z");
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { user: { select: { name: true } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { date: "desc" },
    }),
    prisma.expense.count({ where }),
  ]);

  return serializeDecimal({
    expenses: expenses.map((e) => ({
      ...e,
      amount: Number(e.amount),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

// ============================================================
// DELETE EXPENSE
// ============================================================

export async function deleteExpense(id: string) {
  const user = await requireRole("OWNER", "ADMIN");

  try {
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) return { success: false, error: "Pengeluaran tidak ditemukan" };

    await prisma.$transaction(async (tx) => {
      // Revert cash session
      if (expense.cashSessionId && expense.paymentMethod === "CASH") {
        await tx.cashSession.update({
          where: { id: expense.cashSessionId },
          data: {
            cashExpenses: { decrement: expense.amount },
          },
        });
      }

      await tx.expense.delete({ where: { id } });
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.EXPENSE_DELETE,
      entity: "expense",
      entityId: id,
      previousValue: expense,
    });

    return { success: true };
  } catch (error) {
    console.error("Delete expense error:", error);
    return { success: false, error: "Gagal menghapus pengeluaran" };
  }
}

