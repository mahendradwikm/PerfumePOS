import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user) return null;
  return session.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireRole(...roles: UserRole[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    redirect("/dashboard");
  }
  return user;
}

export function isOwnerOrAdmin(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageProducts(role: UserRole): boolean {
  return isOwnerOrAdmin(role);
}

export function canManageUsers(role: UserRole): boolean {
  return role === "OWNER";
}

export function canViewFinancials(role: UserRole): boolean {
  return isOwnerOrAdmin(role);
}

export function canAdjustStock(role: UserRole): boolean {
  return isOwnerOrAdmin(role);
}

export function canManageExpenses(role: UserRole): boolean {
  return isOwnerOrAdmin(role);
}

export function canProcessRefund(role: UserRole): boolean {
  return isOwnerOrAdmin(role);
}

export function canViewAuditLogs(role: UserRole): boolean {
  return isOwnerOrAdmin(role);
}
