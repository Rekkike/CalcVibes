import { describe, expect, it } from "vitest";
import { computeModel, irrAnnual, npvMonthly } from "../src/engine.js";
import type { CostLine, ModelInputs } from "../src/types.js";

const baselineCosts: CostLine[] = [
  { id: "c1", name: "Development team", category: "recurring", amount: 1800000, startYear: 1, durationYears: 3, escalation: 3 },
  { id: "c2", name: "Infrastructure & licences", category: "recurring", amount: 600000, startYear: 1, durationYears: 3, escalation: 2 },
  { id: "c3", name: "Initial CAPEX", category: "capex", amount: 450000, startYear: 1, durationYears: 0, escalation: 0 },
];

function makeInputs(costs: CostLine[], targetIrr: number, repayment: ModelInputs["repayment"]): ModelInputs {
  return { projectName: "Project Alpha", currency: "EUR", targetIrr, costs, repayment };
}

describe("CP-1 unit pins", () => {
  it("npvMonthly(0.01, [100]) equals 99.00990099009901", () => {
    expect(npvMonthly(0.01, [100])).toBeCloseTo(99.00990099009901, 10);
  });

  it("irrAnnual of 13-entry vector with -1100 at month 1 and 1210 at month 13 equals 0.10 within 1e-8", () => {
    const flows = [-1100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1210];
    expect(Math.abs((irrAnnual(flows) as number) - 0.10)).toBeLessThan(1e-8);
  });

  it("irrAnnual of an all-zero vector returns null", () => {
    expect(irrAnnual([0, 0, 0, 0, 0, 0])).toBeNull();
  });
});

describe("CP-2 baseline scenario (prototype defaults)", () => {
  const result = computeModel(makeInputs(baselineCosts, 12, { graceYears: 0, termYears: 7, paymentsPerYear: 4, paymentEscalation: 0, balloon: 0 }));

  it("lastCostYear is 3", () => {
    expect(result.lastCostYear).toBe(3);
  });

  it("repaymentStartYear is 3", () => {
    expect(result.repaymentStartYear).toBe(3);
  });

  it("totalMonths is 120", () => {
    expect(result.monthly.length).toBe(120);
  });

  it("paymentCount is 28", () => {
    expect(result.paymentCount).toBe(28);
  });

  it("totalCost is 7,849,860", () => {
    expect(result.totalCost).toBe(7849860);
  });

  it("costNpv is 6,632,597.98344 within 0.01", () => {
    expect(Math.abs(result.costNpv - 6632597.98344)).toBeLessThan(0.01);
  });

  it("monthly discount rate rM is 0.00948879293 within 1e-9", () => {
    const rM = Math.pow(1 + 12 / 100, 1 / 12) - 1;
    expect(Math.abs(rM - 0.00948879293)).toBeLessThan(1e-9);
  });

  it("paymentAmount is 475,309.13407 within 0.01", () => {
    expect(Math.abs((result.paymentAmount as number) - 475309.13407)).toBeLessThan(0.01);
  });

  it("totalCollected is 13,308,655.75409 within 0.01", () => {
    expect(Math.abs(result.totalCollected - 13308655.75409)).toBeLessThan(0.01);
  });

  it("netGain is 5,458,795.75409 within 0.01", () => {
    expect(Math.abs(result.netGain - 5458795.75409)).toBeLessThan(0.01);
  });
});

describe("CP-3 adaptation scenario (grace, monthly payments, escalation, balloon)", () => {
  const result = computeModel(makeInputs(baselineCosts, 15, { graceYears: 1, termYears: 5, paymentsPerYear: 12, paymentEscalation: 2, balloon: 500000 }));

  it("repaymentStartYear is 4", () => {
    expect(result.repaymentStartYear).toBe(4);
  });

  it("totalMonths is 108", () => {
    expect(result.monthly.length).toBe(108);
  });

  it("paymentCount is 60", () => {
    expect(result.paymentCount).toBe(60);
  });

  it("costNpv is 6,385,436.57731 within 0.01", () => {
    expect(Math.abs(result.costNpv - 6385436.57731)).toBeLessThan(0.01);
  });

  it("paymentAmount is 242,934.21588 within 0.01", () => {
    expect(Math.abs((result.paymentAmount as number) - 242934.21588)).toBeLessThan(0.01);
  });

  it("totalCollected is 15,670,872.98786 within 0.01", () => {
    expect(Math.abs(result.totalCollected - 15670872.98786)).toBeLessThan(0.01);
  });

  it("netGain is 7,821,012.98786 within 0.01", () => {
    expect(Math.abs(result.netGain - 7821012.98786)).toBeLessThan(0.01);
  });

  it("achievedIrr is 0.15 within 1e-9", () => {
    expect(Math.abs((result.achievedIrr as number) - 0.15)).toBeLessThan(1e-9);
  });
});

describe("CP-5 DEFECT-001 regression pin", () => {
  const result = computeModel(makeInputs(baselineCosts, 12, { graceYears: 0, termYears: 7, paymentsPerYear: 4, paymentEscalation: 0, balloon: 0 }));

  it("repaired solver returns 0.12 on the CP-2 net-flow vector", () => {
    expect(Math.abs((result.achievedIrr as number) - 0.12)).toBeLessThan(1e-9);
  });

  it("repaired output differs from the historical degenerate value 3138428376720", () => {
    // Historical defect value from the prototype solver on this vector: 3138428376720 (11^12 - 1).
    expect(result.achievedIrr).not.toBe(3138428376720);
  });
});

describe("CP-4 degenerate inputs", () => {
  it("empty cost list yields zeros and a null achieved IRR without throwing", () => {
    const result = computeModel(makeInputs([], 12, { graceYears: 0, termYears: 7, paymentsPerYear: 4, paymentEscalation: 0, balloon: 0 }));
    expect(result.totalCost).toBe(0);
    expect(result.costNpv).toBe(0);
    expect(result.paymentAmount).toBe(0);
    expect(result.achievedIrr).toBeNull();
  });
});

describe("Payback pins", () => {
  it("CP-2 paybackYears is 6.95961 within 1e-4", () => {
    const result = computeModel(makeInputs(baselineCosts, 12, { graceYears: 0, termYears: 7, paymentsPerYear: 4, paymentEscalation: 0, balloon: 0 }));
    expect(Math.abs((result.paybackYears as number) - 6.95961)).toBeLessThan(1e-4);
  });

  it("CP-3 paybackYears is 6.56327 within 1e-4", () => {
    const result = computeModel(makeInputs(baselineCosts, 15, { graceYears: 1, termYears: 5, paymentsPerYear: 12, paymentEscalation: 2, balloon: 500000 }));
    expect(Math.abs((result.paybackYears as number) - 6.56327)).toBeLessThan(1e-4);
  });
});
