import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatNumber,
  parseCurrency,
  getStockStatus,
  generateTransactionNumber,
  decimalAdd,
  decimalSubtract,
  decimalMultiply,
  toDecimal,
} from "@/lib/utils";

describe("Utility Functions", () => {
  describe("formatCurrency", () => {
    it("should format valid number to Indonesian Rupiah", () => {
      const formatted = formatCurrency(50000);
      expect(formatted).toContain("50.000");
    });

    it("should handle 0 correctly", () => {
      const formatted = formatCurrency(0);
      expect(formatted).toContain("0");
    });

    it("should handle null and undefined safely", () => {
      expect(formatCurrency(null)).toBe("Rp0");
      expect(formatCurrency(undefined)).toBe("Rp0");
    });

    it("should parse and format valid string numbers", () => {
      const formatted = formatCurrency("125000");
      expect(formatted).toContain("125.000");
    });
  });

  describe("formatNumber", () => {
    it("should format numbers with thousand separators", () => {
      expect(formatNumber(1000)).toBe("1.000");
      expect(formatNumber(1500000)).toBe("1.500.000");
    });

    it("should handle empty or invalid inputs", () => {
      expect(formatNumber(null)).toBe("0");
      expect(formatNumber(undefined)).toBe("0");
    });
  });

  describe("parseCurrency", () => {
    it("should extract numbers from formatted strings", () => {
      expect(parseCurrency("Rp 50.000")).toBe(50.0);
      expect(parseCurrency("100000")).toBe(100000);
    });

    it("should return 0 on empty input", () => {
      expect(parseCurrency("")).toBe(0);
    });
  });

  describe("getStockStatus", () => {
    it("should return Habis (destructive) when currentStock is 0 or negative", () => {
      const statusZero = getStockStatus(0, 100);
      expect(statusZero.label).toBe("Habis");
      expect(statusZero.variant).toBe("destructive");

      const statusNeg = getStockStatus(-5, 100);
      expect(statusNeg.label).toBe("Habis");
    });

    it("should return Stok Rendah (warning) when stock is below or equal to threshold", () => {
      const statusLow = getStockStatus(50, 100);
      expect(statusLow.label).toBe("Stok Rendah");
      expect(statusLow.variant).toBe("warning");

      const statusExact = getStockStatus(100, 100);
      expect(statusExact.label).toBe("Stok Rendah");
    });

    it("should return Tersedia (success) when stock is safely above threshold", () => {
      const statusGood = getStockStatus(250, 100);
      expect(statusGood.label).toBe("Tersedia");
      expect(statusGood.variant).toBe("success");
    });
  });

  describe("generateTransactionNumber", () => {
    it("should start with default prefix TXN", () => {
      const txn = generateTransactionNumber();
      expect(txn.startsWith("TXN-")).toBe(true);
    });

    it("should support custom prefixes", () => {
      const txn = generateTransactionNumber("REF");
      expect(txn.startsWith("REF-")).toBe(true);
    });
  });

  describe("Decimal Safe Operations", () => {
    it("should safely add floats without floating point errors", () => {
      expect(decimalAdd(0.1, 0.2)).toBe(0.3);
    });

    it("should safely subtract floats", () => {
      expect(decimalSubtract(1.5, 0.4)).toBe(1.1);
    });

    it("should safely multiply floats", () => {
      expect(decimalMultiply(12.5, 4)).toBe(50);
    });

    it("should cast to 2 decimal places safely", () => {
      expect(toDecimal(12.3456)).toBe(12.35);
      expect(toDecimal(null)).toBe(0);
    });
  });
});
