import prisma from "@/lib/prisma";

interface AuditLogParams {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
}

export async function createAuditLog({
  userId,
  action,
  entity,
  entityId,
  previousValue,
  newValue,
}: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entity,
        entityId: entityId || null,
        previousValue: previousValue ? JSON.stringify(previousValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
      },
    });
  } catch (error) {
    // Don't throw - audit logging should not break the main operation
    console.error("Failed to create audit log:", error);
  }
}

export const AUDIT_ACTIONS = {
  // Auth
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  // Product
  PRODUCT_CREATE: "PRODUCT_CREATE",
  PRODUCT_UPDATE: "PRODUCT_UPDATE",
  PRODUCT_DEACTIVATE: "PRODUCT_DEACTIVATE",
  PRODUCT_IMPORT: "PRODUCT_IMPORT",
  // Inventory
  INITIAL_STOCK: "INITIAL_STOCK",
  RESTOCK: "RESTOCK",
  STOCK_ADJUSTMENT: "STOCK_ADJUSTMENT",
  // Sales
  SALE_CREATE: "SALE_CREATE",
  SALE_VOID: "SALE_VOID",
  // Refund
  REFUND_CREATE: "REFUND_CREATE",
  // Cash
  CASH_SESSION_OPEN: "CASH_SESSION_OPEN",
  CASH_SESSION_CLOSE: "CASH_SESSION_CLOSE",
  // Expense
  EXPENSE_CREATE: "EXPENSE_CREATE",
  EXPENSE_UPDATE: "EXPENSE_UPDATE",
  EXPENSE_DELETE: "EXPENSE_DELETE",
  // User
  USER_CREATE: "USER_CREATE",
  USER_UPDATE: "USER_UPDATE",
  USER_DEACTIVATE: "USER_DEACTIVATE",
  // Settings
  SETTING_UPDATE: "SETTING_UPDATE",
  // Category
  CATEGORY_CREATE: "CATEGORY_CREATE",
  CATEGORY_UPDATE: "CATEGORY_UPDATE",
  // Supplier
  SUPPLIER_CREATE: "SUPPLIER_CREATE",
  SUPPLIER_UPDATE: "SUPPLIER_UPDATE",
} as const;
