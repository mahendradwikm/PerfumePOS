import { format as dateFnsFormat, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

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