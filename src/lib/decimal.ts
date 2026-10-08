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