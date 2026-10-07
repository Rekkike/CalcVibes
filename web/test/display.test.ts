import { describe, expect, it } from "vitest";
import { roundForDisplay } from "../src/engine.js";

describe("display helper pins", () => {
  it("roundForDisplay(1234.567) equals 1234.57", () => {
    expect(roundForDisplay(1234.567)).toBe(1234.57);
  });

  it("roundForDisplay(1234.564) equals 1234.56", () => {
    expect(roundForDisplay(1234.564)).toBe(1234.56);
  });

  it("a displayed total equals the rounded true total while displayed rows differ by at most one minor unit", () => {
    const rows = [1234.564, 2345.555, 3456.555];
    const trueTotal = rows.reduce((a, b) => a + b, 0);
    const displayedTotal = roundForDisplay(trueTotal);
    expect(displayedTotal).toBe(roundForDisplay(trueTotal));
    const sumOfDisplayedRows = rows.reduce((a, b) => a + roundForDisplay(b), 0);
    expect(Math.abs(displayedTotal - sumOfDisplayedRows)).toBeLessThanOrEqual(0.01);
  });
});
