import { describe, it, expect } from "vitest";
import { getStockStatus } from "@/lib/stock-status";

describe("Stock Status", () => {
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