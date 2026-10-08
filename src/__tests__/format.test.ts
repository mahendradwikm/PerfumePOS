import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatNumber,
  parseCurrency,
  generateTransactionNumber,
} from "@/lib/format";

describe("Formatting Utilities", () => {
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
});