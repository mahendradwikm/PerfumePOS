"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

// ============================================================
// GET USERS
// ============================================================

export async function getUsers() {
  await requireRole("OWNER", "ADMIN");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return users;
}

// ============================================================
// CREATE USER (ADMIN / CASHIER)
// ============================================================

export async function createUser(input: {
  name: string;
  email: string;
  username: string;
  password: string;
  role: "ADMIN" | "CASHIER";
  phone?: string;
}) {
  try {
    const user = await requireRole("OWNER", "ADMIN");

    if (!input.name?.trim() || !input.email?.trim() || !input.username?.trim() || !input.password) {
      return { success: false, error: "Semua field wajib diisi." };
    }

    if (input.password.length < 6) {
      return { success: false, error: "Password minimal 6 karakter." };
    }

    // Email & username must be unique
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.email.toLowerCase() }, { username: input.username.toLowerCase() }],
      },
    });
    if (existing) {
      return { success: false, error: "Email atau username sudah digunakan." };
    }

    const hashed = await bcrypt.hash(input.password, 10);

    const created = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
        username: input.username.toLowerCase().trim(),
        password: hashed,
        role: input.role,
        phone: input.phone || null,
      },
      select: { id: true, name: true, email: true, username: true, role: true },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.USER_CREATE,
      entity: "user",
      entityId: created.id,
      newValue: { username: created.username, role: created.role },
    });

    revalidatePath("/", "layout");
    return { success: true, data: created };
  } catch (error) {
    console.error("Create user error:", error);
    return { success: false, error: "Gagal membuat user." };
  }
}

export async function deleteUser(targetUserId: string) {
  try {
    const currentUser = await requireRole("OWNER", "ADMIN");

    if (currentUser.id === targetUserId) {
      return { success: false, error: "Tidak dapat menghapus akun sendiri." };
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) return { success: false, error: "User tidak ditemukan." };

    // Cegah menghapus user jika masih punya relasi data
    const [saleCount, sessionCount, expenseCount, refundCount, stockMovementCount] =
      await Promise.all([
        prisma.sale.count({ where: { userId: targetUserId } }),
        prisma.cashSession.count({ where: { userId: targetUserId } }),
        prisma.expense.count({ where: { userId: targetUserId } }),
        prisma.refund.count({ where: { userId: targetUserId } }),
        prisma.stockMovement.count({ where: { userId: targetUserId } }),
      ]);

    if (saleCount + sessionCount + expenseCount + refundCount + stockMovementCount > 0) {
      return {
        success: false,
        error: "User memiliki data transaksi/histori. Nonaktifkan saja agar data tetap utuh.",
      };
    }

    await prisma.user.delete({ where: { id: targetUserId } });

    await createAuditLog({
      userId: currentUser.id,
      action: "USER_DELETE",
      entity: "user",
      entityId: targetUserId,
      previousValue: { username: target.username, role: target.role },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Delete user error:", error);
    return { success: false, error: "Gagal menghapus user." };
  }
}

// ============================================================
// UPDATE USER
// ============================================================

export async function updateUser(
  userId: string,
  input: {
    name: string;
    email: string;
    username: string;
    role: "OWNER" | "ADMIN" | "CASHIER";
    phone?: string;
    password?: string;
  }
) {
  try {
    const user = await requireRole("OWNER", "ADMIN");

    if (!input.name?.trim() || !input.email?.trim() || !input.username?.trim()) {
      return { success: false, error: "Nama, email, dan username wajib diisi." };
    }

    // Unique checks on other users
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.email.toLowerCase() },
          { username: input.username.toLowerCase() },
        ],
        NOT: { id: userId },
      },
    });
    if (existing) {
      return { success: false, error: "Email atau username sudah digunakan user lain." };
    }

    const data: any = {
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      username: input.username.toLowerCase().trim(),
      role: input.role,
      phone: input.phone || null,
    };

    if (input.password && input.password.length > 0) {
      if (input.password.length < 6) {
        return { success: false, error: "Password minimal 6 karakter." };
      }
      data.password = await bcrypt.hash(input.password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, username: true, role: true, phone: true },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.USER_UPDATE,
      entity: "user",
      entityId: userId,
      newValue: { username: updated.username, role: updated.role },
    });

    revalidatePath("/", "layout");
    return { success: true, data: updated };
  } catch (error) {
    console.error("Update user error:", error);
    return { success: false, error: "Gagal mengupdate user." };
  }
}

// ============================================================
// TOGGLE USER ACTIVE
// ============================================================

export async function toggleUserActive(userId: string, isActive: boolean) {
  try {
    const user = await requireRole("OWNER", "ADMIN");

    if (userId === user.id) {
      return { success: false, error: "Tidak dapat menonaktifkan akun sendiri." };
    }

    await prisma.user.update({ where: { id: userId }, data: { isActive } });

    await createAuditLog({
      userId: user.id,
      action: isActive ? AUDIT_ACTIONS.USER_UPDATE : AUDIT_ACTIONS.USER_DEACTIVATE,
      entity: "user",
      entityId: userId,
      newValue: { isActive },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Toggle user error:", error);
    return { success: false, error: "Gagal mengubah status user." };
  }
}
