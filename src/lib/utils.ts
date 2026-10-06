import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as dateFnsFormat, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// CURRENCY FORMATTING
// ============================================================

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "Rp0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "Rp0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "0";
  const n = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(n)) return "0";
  return new Intl.NumberFormat("id-ID").format(n);
}

export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;
}

// ============================================================
// DATE/TIME FORMATTING — Asia/Jakarta, DD/MM/YYYY, 24h
// ============================================================

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? parseISO(date) : date;
  return dateFnsFormat(d, "dd/MM/yyyy", { locale: idLocale });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? parseISO(date) : date;
  return dateFnsFormat(d, "dd/MM/yyyy HH:mm", { locale: idLocale });
}

export function formatDateTimeFull(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? parseISO(date) : date;
  return dateFnsFormat(d, "dd/MM/yyyy HH:mm:ss", { locale: idLocale });
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? parseISO(date) : date;
  return dateFnsFormat(d, "HH:mm", { locale: idLocale });
}

export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? parseISO(date) : date;
  return dateFnsFormat(d, "EEEE, dd MMMM yyyy", { locale: idLocale });
}

// ============================================================
// TRANSACTION NUMBER GENERATOR
// ============================================================

export function generateTransactionNumber(prefix: string = "TXN"): string {
  const now = new Date();
  const dateStr = dateFnsFormat(now, "yyyyMMdd");
  const timeStr = dateFnsFormat(now, "HHmmss");
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}-${dateStr}-${timeStr}-${random}`;
}

// ============================================================
// STOCK STATUS
// ============================================================

export function getStockStatus(
  currentStock: number,
  minimumStock: number
): { label: string; color: string; variant: "destructive" | "warning" | "success" } {
  if (currentStock <= 0) {
    return { label: "Habis", color: "text-red-500", variant: "destructive" };
  }
  if (currentStock <= minimumStock) {
    return { label: "Stok Rendah", color: "text-yellow-500", variant: "warning" };
  }
  return { label: "Tersedia", color: "text-green-500", variant: "success" };
}

// ============================================================
// MOVEMENT TYPE LABELS (Indonesian)
// ============================================================

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  INITIAL_STOCK: "Stok Awal",
  RESTOCK: "Restok",
  PURCHASE: "Pembelian",
  SALE: "Penjualan",
  SALES_RETURN: "Retur Penjualan",
  ADJUSTMENT_IN: "Penyesuaian Masuk",
  ADJUSTMENT_OUT: "Penyesuaian Keluar",
  DAMAGE: "Kerusakan",
  LOST: "Hilang",
  RETURN_TO_SUPPLIER: "Retur ke Supplier",
  CORRECTION: "Koreksi",
};

export const SALE_STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Selesai",
  VOID: "Dibatalkan",
  REFUNDED: "Diretur",
  PARTIALLY_REFUNDED: "Diretur Sebagian",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  OTHER: "Lainnya",
};

export const CASH_SESSION_STATUS_LABELS: Record<string, string> = {
  OPEN: "Buka",
  CLOSED: "Tutup",
};

// ============================================================
// DECIMAL SAFE OPERATIONS
// ============================================================

export function toDecimal(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

export function decimalAdd(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}

export function decimalSubtract(a: number, b: number): number {
  return Math.round((a - b) * 100) / 100;
}

export function decimalMultiply(a: number, b: number): number {
  return Math.round(a * b * 100) / 100;
}

// ============================================================
// MISC
// ============================================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ============================================================
// SERIALIZE PRISMA DECIMALS TO PLAIN JAVASCRIPT NUMBERS
// ============================================================

export function serializeDecimal<T>(data: T): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle Prisma Decimal or Decimal.js (has d, e, s, or toNumber)
  if (
    typeof data === "object" &&
    data !== null &&
    (
      ("d" in data && "e" in data && "s" in data) ||
      typeof (data as any).toNumber === "function" ||
      (data as any).constructor?.name === "Decimal"
    )
  ) {
    return Number(data);
  }

  // Handle Dates (supported natively by React Flight)
  if (data instanceof Date) {
    return data;
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    return data.map((item) => serializeDecimal(item));
  }

  // Handle Plain Objects
  if (typeof data === "object") {
    const copy: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      copy[key] = serializeDecimal(val);
    }
    return copy;
  }

  return data;
}
