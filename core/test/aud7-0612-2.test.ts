import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { capexLump, fixture } from "./_aud06122.js";

// v0.6.12.2 Task E (AUD-7) — the beyond-horizon book-value residual is booked where it enters.
const book = (years: number, saleYear: number, termYears = 5) =>
  fixture([capexLump(10000000)], {
    repayment: { termYears },
    depreciationDefault: { mode: "straight-line", years },
    appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "book-value", amount: 0, year: saleYear } },
  });
const vectorInflow = (r: ReturnType<typeof computeModel>) => r.monthly.reduce((a, m) => a + m.inflow, 0);

describe("AUD-7: the beyond-horizon book-value residual", () => {
  it("zero case: nothing is booked, nothing stretches", () => {
    const r = computeModel(book(10, 15));
    expect(r.residualAmountUsed).toBe(0);
    expect(r.totalCollected).toBe(11595206.229946133);
    expect(vectorInflow(r)).toBe(11595206.229946133);
    expect(r.totalCollected).toBe(vectorInflow(r));
    // The directive spells netGain 1595206.229946133; the engine's double is 1595206.2299461327,
    // exactly totalCollected - totalCost (one ulp from the 16-digit spelling) — disclosed.
    expect(r.netGain).toBe(r.totalCollected - 10000000);
    expect(r.netGain).toBe(1595206.2299461327);
    expect(Math.abs(r.netGain - 1595206.229946133)).toBeLessThan(1e-6);
    expect(r.residualDisclosure).toBeNull();
    expect(r.bookView!.remainingBookValueAtResidualYear).toBe(0);
    expect(r.paymentAmount).toBe(2319041.2459892267);
    expect(r.lastPaymentMonth).toBe(60);
    expect(r.horizon!.totalMonths).toBe(72);
  });

  it("extension case (no-drift control): the sale-year value enters the vector at month 180", () => {
    const r = computeModel(book(20, 15));
    expect(r.residualAmountUsed).toBe(3000000);
    expect(r.monthly[179].inflow).toBeGreaterThanOrEqual(3000000);
    expect(r.horizon!.totalMonths).toBe(180);
    expect(r.totalCollected).toBe(13410891.433585707);
    expect(r.totalCollected).toBe(vectorInflow(r));
    expect(r.paymentAmount).toBe(2082178.2867171413);
    expect(r.npvAtTarget).toBe(1.1641532182693481e-10);
    expect(r.residualDisclosure).toBe("Assumes sale at remaining book value at year 15 for 3000000");
  });

  it("within-horizon control", () => {
    expect(computeModel(book(10, 9, 10)).residualAmountUsed).toBe(2000000);
  });
});
