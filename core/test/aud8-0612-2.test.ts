import { describe, expect, it } from "vitest";
import { computeModel, solveTerm } from "../src/engine.js";
import { EngineInputError } from "../src/validate.js";
import type { ContractParams, ModelInputs } from "../src/types.js";
import { capexLump, fixture } from "./_aud06122.js";

// v0.6.12.2 Task F (AUD-8) — Mode B is the true inverse of Mode A. Each pin: Mode B evaluated at
// the Mode A payment returns the Mode A payment count.
const solvedContract = (over: Partial<ContractParams> = {}): ContractParams => ({
  id: "k1", label: "K", startYear: 2, termYears: 10, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved", ...over,
});
const inverse = (inp: ModelInputs) => {
  const a = computeModel(inp);
  const b = solveTerm(inp, a.paymentAmount as number);
  return { a, b };
};
const refusalOf = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EngineInputError) return e.issues;
    throw e;
  }
  return [];
};

describe("AUD-8: Mode B takes the full basis", () => {
  it("GRANT", () => {
    const inp = fixture([capexLump(10000000)], { repayment: { termYears: 10 }, funding: { rows: [{ id: "g1", label: "AFIF", kind: "grant", amount: 4000000, year: 1 }] } });
    const { a, b } = inverse(inp);
    expect(a.paymentAmount).toBe(827941.6038726404);
    expect(b.paymentCount).toBe(10);
  });

  it("BOOK-RESIDUAL", () => {
    const inp = fixture([capexLump(10000000)], {
      repayment: { termYears: 10 },
      depreciationDefault: { mode: "straight-line", years: 10 },
      appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "book-value", amount: 0, year: 9 } },
    });
    const { a, b } = inverse(inp);
    expect(a.paymentAmount).toBe(1230798.9775353842);
    expect(a.residualAmountUsed).toBe(2000000);
    expect(b.paymentCount).toBe(10);
  });

  it("SINGLE CONTRACT", () => {
    const inp = fixture([capexLump(10000000)], { repayment: { termYears: 10 }, contracts: [solvedContract()] });
    const { a, b } = inverse(inp);
    expect(a.paymentAmount).toBe(1490294.8869707522);
    expect(b.paymentCount).toBe(10);
    expect(b.termYears).toBe(10);
  });

  it("CONTRACT+BALLOON", () => {
    const inp = fixture([capexLump(10000000)], {
      repayment: { termYears: 6 },
      contracts: [solvedContract({ termYears: 6, paymentsPerYear: 4, graceYears: 1, escalationPerYear: 2, balloon: 2000000 })],
    });
    const { a, b } = inverse(inp);
    expect(a.paymentAmount).toBe(512153.5847392555);
    expect(b.paymentCount).toBe(24);
    expect(b.termYears).toBe(6);
  });

  it("INTEREST-FREE LOAN", () => {
    const inp = fixture([capexLump(8000000)], {
      repayment: { termYears: 9 },
      funding: { rows: [{ id: "l1", label: "L", kind: "interest-free-loan", amount: 2000000, year: 1, termYears: 5, repaymentStartYear: 3 }] },
    });
    const { a, b } = inverse(inp);
    expect(a.paymentAmount).toBe(1108519.5988099715);
    expect(b.paymentCount).toBe(9);
  });

  it("GRANT+OPERATING", () => {
    const inp = fixture([capexLump(8000000)], {
      repayment: { termYears: 9 },
      funding: { rows: [{ id: "g1", label: "G", kind: "grant", amount: 3000000, year: 1 }] },
      operatingLines: [{ id: "o1", label: "Op", amount: 60000, startYear: 1, yearCount: 12, escalation: 0 }],
    });
    const { a, b } = inverse(inp);
    expect(a.paymentAmount).toBe(794805.432168725);
    expect(b.paymentCount).toBe(9);
  });

  it("REFUSALS: multiple solved contracts and tariff collection modes", () => {
    const two = fixture([capexLump(10000000)], { contracts: [solvedContract({ id: "k1" }), solvedContract({ id: "k2", label: "K2", startYear: 3 })] });
    expect(refusalOf(() => solveTerm(two, 1000000))).toEqual([
      "The term solver applies to exactly one solved contract; this project carries 2 solved contracts (SCE-CONTRACTS).",
    ]);
    const tariff = fixture([capexLump(10000000)], { tariff: { mode: "fixed", escalationPerYear: 0, rows: [], fixedAnnualAmount: 1500000, manualPrices: null } });
    expect(refusalOf(() => solveTerm(tariff, 1000000))).toEqual([
      "The term solver requires the solved payment stream; tariff collection modes carry none (SCE-TARIFF).",
    ]);
  });

  it("UNCHANGED CONTROLS: the plain, balloon and maintenance inversions", () => {
    const plain = fixture([capexLump(5000000)], { repayment: { termYears: 8 } });
    const balloon = fixture([capexLump(5000000)], { repayment: { termYears: 8, balloon: 1000000 } });
    const maint = fixture([capexLump(5000000)], { repayment: { termYears: 8 }, maintenance: { mode: "percent", percentPerYear: 0.5 } });
    const op = fixture([capexLump(5000000)], { repayment: { termYears: 8 }, operatingLines: [{ id: "o1", label: "Op", amount: 50000, startYear: 1, yearCount: 10, escalation: 0 }] });
    for (const [inp, pay] of [[plain, 805623.8916], [balloon, 718573.1874], [maint, 827689.7334]] as [ModelInputs, number][]) {
      const { a, b } = inverse(inp);
      expect(Math.abs((a.paymentAmount as number) - pay)).toBeLessThan(5e-5);
      expect(b.paymentCount).toBe(8);
    }
    expect(inverse(op).b.paymentCount).toBe(8);
  });
});
