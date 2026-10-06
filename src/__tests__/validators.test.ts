import { describe, it, expect } from "vitest";
import {
  createProductSchema,
  createSaleSchema,
  stockMovementSchema,
  openCashSessionSchema,
  closeCashSessionSchema,
  expenseSchema,
  createRefundSchema,
} from "@/lib/validators";

describe("Validator Schemas", () => {
  describe("createProductSchema", () => {
    it("should validate a valid perfume refill product", () => {
      const validProduct = {
        sku: "PRF-BACCARAT-540",
        name: "Baccarat Rouge 540 Inspired",
        category: "REFILL_PERFUME",
        gender: "UNISEX",
        scentCategory: "Oriental Floral",
        unit: "ml",
        costPrice: 800,
        sellingPrice: 2500,
        currentStock: 500,
        minimumStock: 100,
        isActive: true,
      };

      const result = createProductSchema.safeParse(validProduct);
      expect(result.success).toBe(true);
    });

    it("should fail when required fields like sku or name are missing", () => {
      const invalidProduct = {
        name: "Missing SKU",
      };

      const result = createProductSchema.safeParse(invalidProduct);
      expect(result.success).toBe(false);
    });
  });

  describe("createSaleSchema", () => {
    it("should validate a valid sale transaction", () => {
      const validSale = {
        items: [
          {
            productId: "prod-1",
            productName: "Sauvage Refill 30ml",
            productSku: "PRF-SAUVAGE",
            quantity: 30,
            unitPrice: 2000,
            costPrice: 800,
            discount: 0,
            unit: "ml",
          },
        ],
        paymentMethod: "CASH",
        cashReceived: 100000,
        subtotal: 60000,
        discountAmount: 0,
        grandTotal: 60000,
        customerName: "Ahmad",
      };

      const result = createSaleSchema.safeParse(validSale);
      expect(result.success).toBe(true);
    });

    it("should reject sale with empty items", () => {
      const emptySale = {
        items: [],
        paymentMethod: "CASH",
        subtotal: 0,
        grandTotal: 0,
      };

      const result = createSaleSchema.safeParse(emptySale);
      expect(result.success).toBe(false);
    });
  });

  describe("openCashSessionSchema and closeCashSessionSchema", () => {
    it("should validate opening a cash session with positive opening balance", () => {
      const validOpen = {
        openingCash: 200000,
        notes: "Shift Pagi Kasir 1",
      };

      const result = openCashSessionSchema.safeParse(validOpen);
      expect(result.success).toBe(true);
    });

    it("should validate closing a cash session with actual closing count", () => {
      const validClose = {
        sessionId: "session-123",
        closingCash: 850000,
        notes: "Uang pas dengan laporan",
      };

      const result = closeCashSessionSchema.safeParse(validClose);
      expect(result.success).toBe(true);
    });
  });

  describe("expenseSchema", () => {
    it("should validate an operational expense", () => {
      const validExpense = {
        date: new Date().toISOString(),
        category: "OPERATIONAL",
        description: "Beli botol tester & spray cleaner",
        amount: 45000,
        paymentMethod: "CASH" as const,
      };

      const result = expenseSchema.safeParse(validExpense);
      expect(result.success).toBe(true);
    });

    it("should fail when amount is non-positive", () => {
      const invalidExpense = {
        date: new Date().toISOString(),
        category: "OPERATIONAL",
        description: "Free",
        amount: 0,
        paymentMethod: "CASH" as const,
      };

      const result = expenseSchema.safeParse(invalidExpense);
      expect(result.success).toBe(false);
    });
  });

  describe("createRefundSchema", () => {
    it("should validate a refund request with reason and items", () => {
      const validRefund = {
        saleId: "sale-456",
        items: [
          {
            productId: "prod-1",
            productName: "Sauvage 30ml",
            quantity: 1,
            unitPrice: 60000,
            restoreStock: true,
          },
        ],
        reason: "Botol bocor",
      };

      const result = createRefundSchema.safeParse(validRefund);
      expect(result.success).toBe(true);
    });
  });
});
