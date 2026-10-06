import { describe, it, expect } from "vitest";

describe("Perfume Refill Business Logic & Formulations", () => {
  describe("Refill Volume & Ratio Formulation", () => {
    it("should compute oil and solvent volume accurately for standard 2:1 (67% / 33%) ratio in 30ml", () => {
      const bottleVolume = 30; // ml
      const oilRatio = 2;
      const solventRatio = 1;
      const totalRatio = oilRatio + solventRatio;

      const oilMl = Math.round((bottleVolume * (oilRatio / totalRatio)) * 10) / 10;
      const solventMl = Math.round((bottleVolume * (solventRatio / totalRatio)) * 10) / 10;

      expect(oilMl).toBe(20);
      expect(solventMl).toBe(10);
      expect(oilMl + solventMl).toBe(30);
    });

    it("should calculate composite COGS (HPP) correctly for a refill custom mix", () => {
      // 50ml bottle, 1:1 ratio (25ml oil, 25ml absolute solvent), plus glass bottle
      const oilCostPerMl = 800; // Rp 800 / ml
      const solventCostPerMl = 150; // Rp 150 / ml
      const bottleCost = 6500; // Rp 6,500 / pcs

      const oilVolume = 25;
      const solventVolume = 25;

      const totalHPP = (oilVolume * oilCostPerMl) + (solventVolume * solventCostPerMl) + bottleCost;
      // 25 * 800 = 20,000
      // 25 * 150 = 3,750
      // bottle = 6,500
      // total = 30,250
      expect(totalHPP).toBe(30250);

      // Selling price Rp 75,000
      const sellingPrice = 75000;
      const grossProfit = sellingPrice - totalHPP;
      expect(grossProfit).toBe(44750);

      const grossMarginPercent = (grossProfit / sellingPrice) * 100;
      expect(Math.round(grossMarginPercent)).toBe(60); // 59.67% -> ~60%
    });
  });

  describe("Cash Management Shift Reconciliation", () => {
    it("should accurately compute expected cash in drawer", () => {
      const openingCash = 200000;
      const cashSales = 1250000;
      const cashExpenses = 75000;
      const cashRefunds = 50000;

      const expectedCash = openingCash + cashSales - cashExpenses - cashRefunds;
      expect(expectedCash).toBe(1325000);

      // Scenario 1: Balanced count
      const actualCashBalanced = 1325000;
      const diffBalanced = actualCashBalanced - expectedCash;
      expect(diffBalanced).toBe(0);

      // Scenario 2: Shortage (Selisih Kurang)
      const actualCashShort = 1300000;
      const diffShort = actualCashShort - expectedCash;
      expect(diffShort).toBe(-25000);

      // Scenario 3: Surplus (Selisih Lebih)
      const actualCashOver = 1350000;
      const diffOver = actualCashOver - expectedCash;
      expect(diffOver).toBe(25000);
    });
  });

  describe("POS Cart & Cash Payment Calculation", () => {
    it("should compute subtotal, discount, grand total, and change accurately", () => {
      const items = [
        { name: "Black Phantom 50ml", price: 95000, qty: 1 },
        { name: "Santal 33 30ml", price: 65000, qty: 2 },
      ];

      const subtotal = items.reduce((acc, it) => acc + it.price * it.qty, 0);
      expect(subtotal).toBe(225000);

      const discountPercent = 10; // 10% promo
      const discountAmount = Math.round(subtotal * (discountPercent / 100));
      expect(discountAmount).toBe(22500);

      const grandTotal = subtotal - discountAmount;
      expect(grandTotal).toBe(202500);

      const cashReceived = 250000;
      const change = cashReceived - grandTotal;
      expect(change).toBe(47500);
    });
  });
});
