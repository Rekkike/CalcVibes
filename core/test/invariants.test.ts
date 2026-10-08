import { describe, expect, it } from "vitest";
import { computeModel, npvMonthly } from "../src/engine.js";
import type { CostLine, ModelInputs, ModelResult, RepaymentParams } from "../src/types.js";

const baselineCosts: CostLine[] = [
  { id: "c1", name: "Development team", category: "recurring", amount: 1800000, startYear: 1, durationYears: 3, escalation: 3 },
  { id: "c2", name: "Infrastructure & licences", category: "recurring", amount: 600000, startYear: 1, durationYears: 3, escalation: 2 },
  { id: "c3", name: "Initial CAPEX", category: "capex", amount: 450000, startYear: 1, durationYears: 0, escalation: 0 },
];

function makeInputs(costs: CostLine[], targetIrr: number, repayment: RepaymentParams): ModelInputs {
  return { projectName: "Project Alpha", currency: "EUR", targetIrr, costs, repayment };
}

function allCases(): ModelInputs[] {
  const cases: ModelInputs[] = [];
  for (const targetIrr of [0, 12, 40]) {
    for (const graceYears of [0, 2]) {
      for (const termYears of [3, 10, 15]) {
        for (const paymentsPerYear of [1, 12]) {
          for (const paymentEscalation of [0, 3]) {
            for (const balloon of [0, 500000]) {
              cases.push(makeInputs(baselineCosts, targetIrr, {
                graceYears, termYears, paymentsPerYear, paymentEscalation, balloon,
              }));
            }
          }
        }
      }
    }
  }
  return cases;
}

const cases = allCases();

function npvOfInflowsAtTarget(result: ModelResult, targetIrr: number): number {
  const rM = Math.pow(1 + targetIrr / 100, 1 / 12) - 1;
  return npvMonthly(rM, result.monthly.map((row) => row.inflow));
}

function relDiff(a: number, b: number): number {
  if (a === b) return 0;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / scale;
}

describe("INV-1 solver identity", () => {
  it("NPV of inflows at the target rate equals costNpv within 1e-6 relative, for all 144 cases", () => {
    for (const inp of cases) {
      const result = computeModel(inp);
      const npvIn = npvOfInflowsAtTarget(result, inp.targetIrr);
      const diff = Math.abs(npvIn - result.costNpv);
      expect(diff).toBeLessThanOrEqual(1e-6 * result.costNpv);
    }
  });
});

describe("INV-2 achieved-IRR identity", () => {
  it("achievedIrr equals targetIrr within 1e-9, for all 144 cases", () => {
    for (const inp of cases) {
      const result = computeModel(inp);
      expect(Math.abs((result.achievedIrr as number) - inp.targetIrr / 100)).toBeLessThan(1e-9);
    }
  });
});

describe("INV-3 scaling invariance", () => {
  it("scaling all amounts by k = 7.3 scales monetary outputs by k and leaves rates and payback unchanged", () => {
    const repayment: RepaymentParams = { graceYears: 0, termYears: 7, paymentsPerYear: 4, paymentEscalation: 0, balloon: 0 };
    const base = computeModel(makeInputs(baselineCosts, 12, repayment));
    const k = 7.3;
    const scaledCosts = baselineCosts.map((c) => ({ ...c, amount: c.amount * k }));
    const scaled = computeModel(makeInputs(scaledCosts, 12, { ...repayment, balloon: repayment.balloon * k }));
    for (const key of ["costNpv", "paymentAmount", "totalCollected", "netGain", "totalCost"] as const) {
      expect(relDiff((scaled as any)[key], (base as any)[key] * k)).toBeLessThan(1e-9);
    }
    expect(Math.abs((scaled.achievedIrr as number) - (base.achievedIrr as number))).toBeLessThan(1e-12);
    expect(Math.abs((scaled.paybackYears as number) - (base.paybackYears as number))).toBeLessThan(1e-12);
  });
});

describe("INV-4 determinism", () => {
  it("two calls with identical inputs produce deeply equal results", () => {
    for (const inp of cases.slice(0, 12)) {
      const a = computeModel(inp);
      const b = computeModel(inp);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });
});

describe("INV-5 finiteness", () => {
  it("no numeric output is NaN or Infinity across all cases and the empty-costs case", () => {
    const inputs = [...cases, makeInputs([], 12, { graceYears: 0, termYears: 7, paymentsPerYear: 4, paymentEscalation: 0, balloon: 0 })];
    for (const inp of inputs) {
      const r = computeModel(inp);
      for (const key of ["totalCost", "costNpv", "paymentAmount", "totalCollected", "netGain"] as const) {
        expect(Number.isFinite(r[key])).toBe(true);
      }
      for (const key of ["achievedIrr", "paybackYears"] as const) {
        const v = r[key];
        expect(v === null || Number.isFinite(v)).toBe(true);
      }
      for (const row of r.monthly) {
        for (const key of ["cost", "inflow", "net", "cumulative"] as const) {
          expect(Number.isFinite(row[key])).toBe(true);
        }
      }
      for (const row of r.yearly) {
        for (const key of ["cost", "inflow", "net", "cumulative"] as const) {
          expect(Number.isFinite(row[key])).toBe(true);
        }
      }
      for (const row of r.lineTotals) {
        expect(Number.isFinite(row.total)).toBe(true);
      }
    }
  });
});

describe("INV-6 aggregation identities", () => {
  it("yearly rows aggregate the monthly vector, cumulative closes to netGain, and structure is consistent", () => {
    for (const inp of cases) {
      const r = computeModel(inp);
      const monthsByYear = new Map<number, number[]>();
      r.monthly.forEach((row) => {
        const list = monthsByYear.get(row.year) || [];
        list.push(row.cost);
        monthsByYear.set(row.year, list);
      });
      for (const y of r.yearly) {
        const sum = (monthsByYear.get(y.year) || []).reduce((a, b) => a + b, 0);
        if (sum !== 0 || y.cost !== 0) {
          expect(relDiff(y.cost, sum)).toBeLessThan(1e-9);
        }
      }
      expect(Math.abs(r.monthly[r.monthly.length - 1].cumulative - r.netGain)).toBeLessThan(0.01);
      const termMonths = Math.round(inp.repayment.termYears * 12);
      const expectedMonths = Math.max(r.lastCostYear * 12, r.repaymentStartYear * 12 + termMonths);
      expect(r.monthly.length).toBe(expectedMonths);
    }
  });
});

describe("INV-7 monotonicity probes", () => {
  it("balloon, grace, target IRR, and term move the solved payment and cost NPV in the documented directions", () => {
    const base = makeInputs(baselineCosts, 12, { graceYears: 0, termYears: 7, paymentsPerYear: 4, paymentEscalation: 0, balloon: 0 });
    const baseResult = computeModel(base);
    const withBalloon = computeModel({ ...base, repayment: { ...base.repayment, balloon: 500000 } });
    expect((withBalloon.paymentAmount as number)).toBeLessThan(baseResult.paymentAmount as number);
    expect(Math.abs((withBalloon.paymentAmount as number) - 463772.41644)).toBeLessThan(0.01);

    const withGrace = computeModel({ ...base, repayment: { ...base.repayment, graceYears: 2 } });
    expect((withGrace.paymentAmount as number)).toBeGreaterThan(baseResult.paymentAmount as number);
    expect(Math.abs((withGrace.paymentAmount as number) - 596227.77778)).toBeLessThan(0.01);

    const at40 = computeModel({ ...base, targetIrr: 40 });
    expect(at40.costNpv).toBeLessThan(baseResult.costNpv);
    expect(Math.abs(at40.costNpv - 4888228.88535)).toBeLessThan(0.01);

    const term15 = computeModel({ ...base, repayment: { ...base.repayment, termYears: 15 } });
    const term3 = computeModel({ ...base, repayment: { ...base.repayment, termYears: 3 } });
    expect((term15.paymentAmount as number)).toBeLessThan(term3.paymentAmount as number);
    expect(Math.abs((term15.paymentAmount as number) - 318490.43128)).toBeLessThan(0.01);
    expect(Math.abs((term3.paymentAmount as number) - 903142.19709)).toBeLessThan(0.01);
  });
});

describe("INV-8 slot grid", () => {
  it("paymentCount and first slot position match the structural formula, for all 144 cases", () => {
    for (const inp of cases) {
      const r = computeModel(inp);
      const termMonths = Math.round(inp.repayment.termYears * 12);
      const expectedMonths = Math.max(r.lastCostYear * 12, r.repaymentStartYear * 12 + termMonths);
      const unclamped = Math.round(inp.repayment.termYears * inp.repayment.paymentsPerYear);
      const spacing = 12 / inp.repayment.paymentsPerYear;
      let clamped = 0;
      for (let k = 0; k < unclamped; k++) {
        if (r.repaymentStartYear * 12 + k * spacing > expectedMonths) break;
        clamped++;
      }
      expect(r.paymentCount).toBe(clamped);
      const firstInflowRow = r.monthly.find((row) => row.inflow > 0);
      expect(firstInflowRow ? firstInflowRow.period : r.repaymentStartYear * 12).toBe(r.repaymentStartYear * 12);
    }
  });
});
