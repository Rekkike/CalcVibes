import { describe, it, expect } from "vitest";
import { computeModel } from "../src/engine.js";
import { EngineInputError } from "../src/validate.js";
import type { ModelInputs } from "../src/types.js";

function bkFixture(overrides: Partial<ModelInputs> = {}): ModelInputs {
  return {
    projectName: "BK",
    currency: "kr",
    targetIrr: 7,
    costs: [
      { id: "bk", name: "Build", category: "recurring", amount: 100000, startYear: 1, durationYears: 3, escalation: 0 },
    ],
    repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 1, paymentEscalation: 0, balloon: 0 },
    appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "none", amount: 0, year: 10 } },
    ...overrides,
  } as ModelInputs;
}

function nunyaFixture(overrides: Partial<ModelInputs> = {}): ModelInputs {
  return {
    projectName: "nunya",
    currency: "kr",
    targetIrr: 5,
    costs: [
      { id: "cap", name: "CAPEX", category: "capex", amount: 0, startYear: 1, durationYears: 1, escalation: 0, yearOverrides: { 1: 420000 } },
    ],
    repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 1, paymentEscalation: 2, balloon: 0 },
    appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "none", amount: 0, year: 10 } },
    ...overrides,
  } as ModelInputs;
}

describe("v0.6.2 chunk 0 pins: the commissioning book model", () => {
  it("BK-1 straight-line 20, default commissioning", () => {
    const r = computeModel(bkFixture({ depreciationDefault: { mode: "straight-line", years: 20 } }));
    const line = r.bookView!.lines[0];
    const y1 = line.years.find((y) => y.year === 1)!;
    expect(y1.beginning).toBe(0);
    expect(y1.charge).toBe(0);
    expect(y1.ending).toBe(100000);
    const y3 = line.years.find((y) => y.year === 3)!;
    expect(y3.ending).toBe(300000);
    const y4 = line.years.find((y) => y.year === 4)!;
    expect(y4.beginning).toBe(300000);
    expect(y4.charge).toBe(15000);
    expect(y4.ending).toBe(285000);
    const y23 = line.years.find((y) => y.year === 23)!;
    expect(y23.ending).toBe(0);
    expect(r.bookView!.totalCharge).toBe(300000);
  });

  it("BK-2 user-set startYear 5", () => {
    const r = computeModel(bkFixture({ depreciationDefault: { mode: "straight-line", years: 20, startYear: 5 } }));
    const line = r.bookView!.lines[0];
    const y4 = line.years.find((y) => y.year === 4)!;
    expect(y4.charge).toBe(0);
    expect(y4.ending).toBe(300000);
    const y5 = line.years.find((y) => y.year === 5)!;
    expect(y5.beginning).toBe(300000);
    expect(y5.charge).toBe(15000);
  });

  it("BK-3 one-time CAPEX 420000 at year 1, straight-line 20", () => {
    const r = computeModel(bkFixture({
      costs: [
        { id: "cap", name: "CAPEX", category: "capex", amount: 0, startYear: 1, durationYears: 1, escalation: 0, yearOverrides: { 1: 420000 } },
      ],
      depreciationDefault: { mode: "straight-line", years: 20 },
    }));
    const line = r.bookView!.lines[0];
    const y1 = line.years.find((y) => y.year === 1)!;
    expect(y1.ending).toBe(420000);
    expect(y1.charge).toBe(0);
    const y2 = line.years.find((y) => y.year === 2)!;
    expect(y2.charge).toBe(21000);
    const y21 = line.years.find((y) => y.year === 21)!;
    expect(y21.ending).toBe(0);
  });

  it("BK-4 calculated residual at year 21 inside the horizon", () => {
    const none = computeModel(bkFixture({ depreciationDefault: { mode: "straight-line", years: 20 } }));
    expect(none.paymentAmount).toBe(29259.908310158527);
    const bv = computeModel(bkFixture({
      depreciationDefault: { mode: "straight-line", years: 20 },
      appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "book-value", amount: 0, year: 21 } },
    }));
    expect(bv.residualAmountUsed).toBe(30000);
    expect(bv.paymentAmount).toBe(28476.89539380002);
    expect(bv.residualDisclosure).toBe("Assumes sale at remaining book value at year 21 for 30000");
    const ret = computeModel(bkFixture({
      depreciationDefault: { mode: "retained" },
      appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "book-value", amount: 0, year: 21 } },
    }));
    expect(ret.residualAmountUsed).toBe(300000);
    expect(ret.paymentAmount).toBe(21429.779146573448);
  });

  it("RES-1 retained book-value residual at year 25 extends the horizon", () => {
    const base = computeModel(bkFixture({ depreciationDefault: { mode: "retained" } }));
    expect(base.paymentAmount).toBe(29259.908310158527);
    const res = computeModel(bkFixture({
      depreciationDefault: { mode: "retained" },
      appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "book-value", amount: 0, year: 25 } },
    }));
    expect(res.residualAmountUsed).toBe(300000);
    expect(res.paymentAmount).toBe(23286.340261545774);
    expect(res.horizon!.totalYears).toBe(25);
    expect(res.residualDisclosure).toBe("Assumes sale at remaining book value at year 25 for 300000");
    expect(res.monthly[299].inflow).toBeCloseTo(300000, 6);
  });

  it("RES-2 straight-line 20 book-value residual at year 25: zero book, no extension", () => {
    const res = computeModel(bkFixture({
      depreciationDefault: { mode: "straight-line", years: 20 },
      appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "book-value", amount: 0, year: 25 } },
    }));
    expect(res.residualAmountUsed).toBe(0);
    expect(res.paymentAmount).toBe(29259.908310158527);
    expect(res.residualDisclosure).toBe(null);
    expect(res.horizon!.totalYears).toBe(23);
  });

  it("BK-REANCHOR: cash figures unchanged on posture none", () => {
    const r = computeModel(bkFixture({ depreciationDefault: { mode: "straight-line", years: 20 } }));
    expect(r.costNpv).toBe(300000 / 3 * 0 + r.costNpv);
    expect(r.paymentAmount).toBe(29259.908310158527);
    const retained = computeModel(bkFixture({ depreciationDefault: { mode: "retained" } }));
    expect(retained.paymentAmount).toBe(29259.908310158527);
  });
});

describe("v0.6.2 chunk 0 pins: the absurd-override guard", () => {
  it("YR-GUARD-1 the walkthrough fixture is refused with the named message", () => {
    expect(() => computeModel(nunyaFixture({
      repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 1, paymentEscalation: 2, balloon: 0, firstCollectionYear: 2028 },
    }))).toThrowError(EngineInputError);
    try {
      computeModel(nunyaFixture({
        repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 1, paymentEscalation: 2, balloon: 0, firstCollectionYear: 2028 },
      }));
    } catch (e) {
      expect((e as EngineInputError).issues.some((i) => i.includes("REP-START-ABSURD"))).toBe(true);
      expect((e as EngineInputError).issues.some((i) => i.includes("The first collection year is unreasonably far beyond the cost program; it must be within 100 years of the last cost year."))).toBe(true);
    }
  });

  it("YR-GUARD-2 sane entry unchanged", () => {
    const r = computeModel(nunyaFixture({
      repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 1, paymentEscalation: 2, balloon: 0, firstCollectionYear: 3 },
    }));
    expect(r.paymentAmount).toBe(30070.775125024767);
    expect(r.paymentCount).toBe(20);
    expect(r.horizon!.totalYears).toBe(23);
    expect(r.goalMet).toBe(true);
  });

  it("YR-GUARD-3 boundary accepted at +100, refused at +101", () => {
    const ok = computeModel(nunyaFixture({
      repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 1, paymentEscalation: 2, balloon: 0, firstCollectionYear: 101 },
    }));
    expect(ok.goalMet).toBe(true);
    expect(() => computeModel(nunyaFixture({
      repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 1, paymentEscalation: 2, balloon: 0, firstCollectionYear: 102 },
    }))).toThrowError(/REP-START-ABSURD/);
  });
});
