"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  openCashSessionSchema,
  closeCashSessionSchema,
  type OpenCashSessionInput,
  type CloseCashSessionInput,
} from "@/lib/validators";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { Prisma } from "@prisma/client";

// ============================================================
// OPEN CASH SESSION
// ============================================================

export async function openCashSession(input: OpenCashSessionInput) {
  const user = await requireAuth();
  const data = openCashSessionSchema.parse(input);

  // Check if there's already an open session for this user
  const existingOpen = await prisma.cashSession.findFirst({
    where: {
      userId: user.id,
      status: "OPEN",
    },
  });

  if (existingOpen) {
    return {
      success: false,
      error: "Anda masih memiliki sesi kasir yang terbuka. Tutup terlebih dahulu.",
    };
  }

  try {
    const session = await prisma.cashSession.create({
      data: {
        sessionDate: new Date(),
        openingCash: new Prisma.Decimal(data.openingCash),
        status: "OPEN",
        userId: user.id,
        notes: data.notes || null,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.CASH_SESSION_OPEN,
      entity: "cash_session",
      entityId: session.id,
      newValue: { openingCash: data.openingCash },
    });

    return { success: true, data: session };
  } catch (error) {
    console.error("Open cash session error:", error);
    return { success: false, error: "Gagal membuka sesi kasir" };
  }
}

// ============================================================
// CLOSE CASH SESSION
// ============================================================

export async function closeCashSession(input: CloseCashSessionInput) {
  const user = await requireAuth();
  const data = closeCashSessionSchema.parse(input);

  try {
    const session = await prisma.cashSession.findUnique({
      where: { id: data.sessionId },
    });

    if (!session) {
      return { success: false, error: "Sesi kasir tidak ditemukan" };
    }

    if (session.status === "CLOSED") {
      return { success: false, error: "Sesi kasir sudah ditutup" };
    }

    // Calculate expected cash
    // Expected = Opening + Cash Sales - Cash Expenses - Cash Refunds
    const openingCash = Number(session.openingCash);
    const cashSales = Number(session.cashSales);
    const cashExpenses = Number(session.cashExpenses);
    const cashRefunds = Number(session.cashRefunds);

    const expectedCash = openingCash + cashSales - cashExpenses - cashRefunds;
    const variance = data.closingCash - expectedCash;

    const updatedSession = await prisma.cashSession.update({
      where: { id: data.sessionId },
      data: {
        closingCash: new Prisma.Decimal(data.closingCash),
        expectedCash: new Prisma.Decimal(expectedCash),
        variance: new Prisma.Decimal(variance),
        status: "CLOSED",
        closedAt: new Date(),
        notes: data.notes || session.notes,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.CASH_SESSION_CLOSE,
      entity: "cash_session",
      entityId: session.id,
      previousValue: { status: "OPEN" },
      newValue: {
        closingCash: data.closingCash,
        expectedCash,
        variance,
        status: "CLOSED",
      },
    });

    return { success: true, data: updatedSession };
  } catch (error) {
    console.error("Close cash session error:", error);
    return { success: false, error: "Gagal menutup sesi kasir" };
  }
}

// ============================================================
// GET CURRENT OPEN SESSION
// ============================================================

export async function getCurrentCashSession() {
  const user = await requireAuth();

  const session = await prisma.cashSession.findFirst({
    where: {
      userId: user.id,
      status: "OPEN",
    },
    include: {
      user: { select: { name: true } },
    },
  });

  if (!session) return null;

  return {
    ...session,
    openingCash: Number(session.openingCash),
    closingCash: session.closingCash ? Number(session.closingCash) : null,
    expectedCash: session.expectedCash ? Number(session.expectedCash) : null,
    variance: session.variance ? Number(session.variance) : null,
    cashSales: Number(session.cashSales),
    qrisSales: Number(session.qrisSales),
    cashExpenses: Number(session.cashExpenses),
    cashRefunds: Number(session.cashRefunds),
    totalSales: Number(session.totalSales),
  };
}

// ============================================================
// GET CASH SESSIONS
// ============================================================

export async function getCashSessions(params?: {
  status?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  await requireAuth();

  const { status, userId, startDate, endDate, page = 1, limit = 20 } = params || {};

  const where: Prisma.CashSessionWhereInput = {};

  if (status) where.status = status as Prisma.EnumCashSessionStatusFilter["equals"];
  if (userId) where.userId = userId;
  if (startDate || endDate) {
    where.sessionDate = {};
    if (startDate) where.sessionDate.gte = new Date(startDate);
    if (endDate) where.sessionDate.lte = new Date(endDate + "T23:59:59.999Z");
  }

  const [sessions, total] = await Promise.all([
    prisma.cashSession.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { sales: true, expenses: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { sessionDate: "desc" },
    }),
    prisma.cashSession.count({ where }),
  ]);

  return {
    sessions: sessions.map((s) => ({
      ...s,
      openingCash: Number(s.openingCash),
      closingCash: s.closingCash ? Number(s.closingCash) : null,
      expectedCash: s.expectedCash ? Number(s.expectedCash) : null,
      variance: s.variance ? Number(s.variance) : null,
      cashSales: Number(s.cashSales),
      qrisSales: Number(s.qrisSales),
      cashExpenses: Number(s.cashExpenses),
      cashRefunds: Number(s.cashRefunds),
      totalSales: Number(s.totalSales),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export const getActiveCashSession = getCurrentCashSession;

