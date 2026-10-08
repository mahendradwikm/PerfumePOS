import { describe, it, expect } from "vitest";
import {
  decimalAdd,
  decimalSubtract,
  decimalMultiply,
  toDecimal,
} from "@/lib/decimal";

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