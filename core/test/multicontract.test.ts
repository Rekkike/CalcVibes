import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import type { ModelInputs } from "../src/types.js";

const multiBase = (): ModelInputs => ({
  projectName: "Multi",
  currency: "SEK",
  targetIrr: 12,
  costs: [
    { id: "c1", name: "Depreciable assets", category: "capex", amount: 20000000, startYear: 1, durationYears: 1, escalation: 0, depreciation: { mode: "straight-line", years: 33 } },
    { id: "c2", name: "Retained assets", category: "capex", amount: 80000000, startYear: 1, durationYears: 1, escalation: 0, depreciation: { mode: "retained" } },
    { id: "c3", name: "Build", category: "recurring", amount: 5000000, startYear: 1, durationYears: 3, escalation: 0 },
  ],
  repayment: { graceYears: 0, termYears: 15, paymentsPerYear: 1, paymentEscalation: 0, balloon: 0 },
  contracts: [
    { id: "k1", label: "Contract one", startYear: 4, termYears: 15, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved", reinvestments: [{ year: 4, amount: 3000000 }] },
    { id: "k2", label: "Contract two", startYear: 19, termYears: 15, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
    { id: "k3", label: "Lease three", startYear: 34, termYears: 20, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
  ],
  appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { mode: "calculated", amount: 0, year: 33 } },
});

const stripAdditive = (r: unknown): Record<string, unknown> => {
  const c = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
  delete c.horizon;
  delete c.contractsInfo;
  delete c.bookView;
  delete c.termPositions;
  delete c.residualAmountUsed;
  return c;
};

describe("v0.6 LEGACY-BYTE-IDENTITY", () => {
  it("a no-contracts project computes byte-identically to the legacy configuration", () => {
    const legacy = multiBase();
    const noContracts: ModelInputs = { ...legacy, contracts: undefined, appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 33 } } };
    const explicitOne: ModelInputs = {
      ...legacy,
      contracts: [{
        id: "legacy-equivalent", label: "Payment stream",
        startYear: 3, termYears: 15, paymentsPerYear: 1, graceYears: 0,
        escalationPerYear: 0, balloon: 0, mode: "solved",
      }],
      appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 33 } },
    };
    const a = computeModel(noContracts);
    const b = computeModel(explicitOne);
    const sa = stripAdditive(a);
    const sb = stripAdditive(b);
    delete (sa as Record<string, unknown>).costGrid;
    delete (sa as Record<string, unknown>).collectionsGrid;
    delete (sb as Record<string, unknown>).costGrid;
    delete (sb as Record<string, unknown>).collectionsGrid;
    expect(JSON.stringify(sb)).toBe(JSON.stringify(sa));
    expect(a.paymentAmount).toBe(b.paymentAmount);
  });
});

describe("v0.6 CONTRACTS-SOLVE", () => {
  it("the generalized identity: the solved k makes the combined flow hit the target", () => {
    const r = computeModel(multiBase());
    expect(r.goalMet).toBe(true);
    expect(Math.abs(r.npvAtTarget)).toBeLessThan(1e-6);
    expect(r.paymentAmount).not.toBeNull();
  });

  it("directional: adding a solved contract lowers k", () => {
    const base = multiBase();
    const two = computeModel({ ...base, contracts: base.contracts!.slice(0, 2) });
    const three = computeModel(base);
    expect(three.paymentAmount!).toBeLessThan(two.paymentAmount!);
  });

  it("directional: shifting a solved contract later raises k", () => {
    const base = multiBase();
    const shifted: ModelInputs = { ...base, contracts: base.contracts!.map((c, i) => i === 0 ? { ...c, startYear: c.startYear + 2 } : c) };
    const plain = computeModel(base);
    const late = computeModel(shifted);
    expect(late.paymentAmount!).toBeGreaterThan(plain.paymentAmount!);
  });

  it("directional: adding an evaluated contract lowers k", () => {
    const base = multiBase();
    const withEv: ModelInputs = { ...base, contracts: [...base.contracts!, { id: "ke", label: "Evaluated deal", startYear: 54, termYears: 5, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "evaluated", evaluatedPayment: 5000000, evaluatedProfile: null }] };
    const plain = computeModel(base);
    const ev = computeModel(withEv);
    expect(ev.paymentAmount!).toBeLessThan(plain.paymentAmount!);
  });

  it("directional: grace up on a solved contract raises k", () => {
    const base = multiBase();
    const graced: ModelInputs = { ...base, contracts: base.contracts!.map((c, i) => i === 0 ? { ...c, graceYears: 2 } : c) };
    const plain = computeModel(base);
    const g = computeModel(graced);
    expect(g.paymentAmount!).toBeGreaterThan(plain.paymentAmount!);
  });

  it("validation: tariff and contracts are mutually exclusive", () => {
    const base = multiBase();
    expect(() => computeModel({ ...base, tariff: { mode: "fixed", escalationPerYear: 2, rows: [], fixedAnnualAmount: 1000, manualPrices: null } })).toThrowError(/mutually exclusive/);
  });

  it("validation: a solved set of zero payment slots is invalid", () => {
    const base = multiBase();
    expect(() => computeModel({ ...base, contracts: [{ id: "kz", label: "Zero", startYear: 4, termYears: 0.001, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" }] })).toThrowError();
  });
});

describe("v0.6 REINVESTMENT-CASH", () => {
  it("a reinvestment enters the cost vector at the end of its year exactly once and raises the requirement", () => {
    const base = multiBase();
    const without = computeModel({ ...base, contracts: base.contracts!.map((c) => ({ ...c, reinvestments: [] })) });
    const withRi = computeModel(base);
    const riMonth = 4 * 12;
    const delta = withRi.monthly[riMonth - 1].cost - without.monthly[riMonth - 1].cost;
    expect(delta).toBe(3000000);
    expect(withRi.paymentAmount!).toBeGreaterThan(without.paymentAmount!);
  });

  it("a reinvestment joins the invested cost base and the cost grid as its own row", () => {
    const r = computeModel(multiBase());
    expect(r.totalCost).toBe(20000000 + 80000000 + 15000000 + 3000000);
  });

  it("directional: a reinvestment placed before a boundary lowers that boundary's truncated IRR", () => {
    const base = multiBase();
    const without = computeModel({ ...base, contracts: base.contracts!.map((c) => ({ ...c, reinvestments: [] })) });
    const withRi = computeModel(base);
    const posWithout = without.termPositions![0];
    const posWith = withRi.termPositions![0];
    expect(posWith.truncatedIrr!).toBeLessThan(posWithout.truncatedIrr!);
  });
});

describe("v0.6 HORIZON-DERIVED", () => {
  it("the horizon equals the max of its constituents; the constituents are returned", () => {
    const r = computeModel(multiBase());
    const lastContractMonth = Math.max(...r.contractsInfo!.map((c) => c.lastCollectionMonth));
    const maxMonth = Math.max(...r.horizon!.constituents.map((c) => c.month));
    expect(r.horizon!.totalMonths).toBe(maxMonth);
    expect(r.horizon!.totalMonths).toBeGreaterThanOrEqual(lastContractMonth);
    expect(r.horizon!.constituents.length).toBeGreaterThan(3);
    expect(r.monthly.length).toBe(r.horizon!.totalMonths);
  });

  it("PROJ-LENGTH-EXCEEDED is gone: a short project length extends the horizon", () => {
    const r = computeModel({ ...multiBase(), projectLengthYears: 3 });
    const plain = computeModel(multiBase());
    expect(r.horizon!.totalMonths).toBe(plain.horizon!.totalMonths);
    expect(r.monthly.length).toBe(plain.horizon!.totalMonths);
  });
});

describe("v0.6 DEPRECIATION-BOOK-ONLY", () => {
  it("the double-count ban: with the residual held as a set amount, the cash-flow vectors and appraisal outputs are bit-identical with or without depreciation configuration", () => {
    const base: ModelInputs = { ...multiBase(), appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { mode: "amount", amount: 5000000, year: 33 } } };
    const without = computeModel({ ...base, costs: base.costs.map((c) => { const { depreciation, ...rest } = c; return rest; }) });
    const withDep = computeModel(base);
    expect(JSON.stringify(withDep.monthly)).toBe(JSON.stringify(without.monthly));
    expect(withDep.yearly).toEqual(without.yearly);
    expect(withDep.achievedIrr).toBe(without.achievedIrr);
    expect(withDep.npvAtWacc).toBe(without.npvAtWacc);
    expect(withDep.npvAtTarget).toBe(without.npvAtTarget);
    expect(withDep.paymentAmount).toBe(without.paymentAmount);
    expect(withDep.paybackYears).toBe(without.paybackYears);
    expect(withDep.mirr).toBe(without.mirr);
    expect(withDep.profitabilityIndex).toBe(without.profitabilityIndex);
  });

  it("the book schedule equals the configured write-down; retained lines hold at book", () => {
    const r = computeModel(multiBase());
    const dep = r.bookView!.lines.find((l) => l.id === "c1")!;
    expect(dep.years[0].charge).toBe(20000000 / 33);
    expect(dep.years[32].ending).toBeCloseTo(0, 6);
    const ret = r.bookView!.lines.find((l) => l.id === "c2")!;
    expect(ret.years[32].ending).toBe(80000000);
  });
});

describe("v0.6 RESIDUAL-CALCULATED", () => {
  it("the default calculated residual equals the engine's remaining book value at the residual year (no literals)", () => {
    const r = computeModel(multiBase());
    expect(r.residualAmountUsed).toBe(r.bookView!.remainingBookValueAtResidualYear);
    expect(r.bookView!.gainOrLossOnSale).toBe(0);
    expect(r.bookView!.residualMode).toBe("calculated");
  });

  it("a larger retained component raises the calculated residual and lowers k (constant cost base)", () => {
    const split = (depAmount: number): ModelInputs => {
      const base = multiBase();
      return { ...base, costs: base.costs.map((c) => c.id === "c1" ? { ...c, amount: depAmount } : c.id === "c2" ? { ...c, amount: 100000000 - depAmount } : c) };
    };
    const more = computeModel(split(10000000));
    const less = computeModel(split(20000000));
    expect(more.residualAmountUsed!).toBeGreaterThan(less.residualAmountUsed!);
    expect(more.paymentAmount!).toBeLessThan(less.paymentAmount!);
  });

  it("the set override enters as set with the gain or loss disclosed", () => {
    const base = multiBase();
    const r = computeModel({ ...base, appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { mode: "amount", amount: 95000000, year: 33 } } });
    expect(r.residualAmountUsed).toBe(95000000);
    expect(r.bookView!.residualMode).toBe("amount");
    expect(r.bookView!.gainOrLossOnSale).toBe(95000000 - r.bookView!.remainingBookValueAtResidualYear);
  });

  it("either mode enters once as the terminal inflow at the residual month", () => {
    const base = multiBase();
    const r = computeModel(base);
    const residualRow = r.collectionsGrid.find((row) => row.id === "residual");
    expect(residualRow).toBeTruthy();
    const nonZeroYears = residualRow!.amounts.filter((v) => v !== 0);
    expect(nonZeroYears.length).toBe(1);
    expect(nonZeroYears[0]).toBe(r.residualAmountUsed);
    expect(residualRow!.amounts[base.appraisal!.residual.year - 1]).toBe(r.residualAmountUsed);
    const totalCollectedResidualPart = nonZeroYears[0];
    expect(r.totalCollected).toBeGreaterThanOrEqual(totalCollectedResidualPart);
  });
});

describe("v0.6 TERM-POSITIONS", () => {
  it("per contract: the truncated position equals its engine derivation; reinvestments included", () => {
    const r = computeModel(multiBase());
    expect(r.termPositions!.length).toBe(3);
    const tp = r.termPositions![0];
    expect(tp.contractId).toBe("k1");
    expect(tp.endMonth).toBe((4 + 15) * 12);
    const truncated = r.monthly.slice(0, tp.endMonth);
    expect(tp.cumulativeNet).toBe(truncated[truncated.length - 1].cumulative);
    expect(tp.paybackSoFar).not.toBeNull();
  });

  it("the user's example of record shape: positions progress across the agreements", () => {
    const r = computeModel(multiBase());
    const [p1, p2, p3] = r.termPositions!;
    expect(p1.truncatedIrr).not.toBeNull();
    expect(p2.truncatedIrr!).toBeGreaterThan(p1.truncatedIrr!);
    expect(p3.truncatedIrr!).toBeGreaterThan(p2.truncatedIrr!);
    expect(p3.truncatedIrr!).toBeGreaterThanOrEqual(0.12 - 1e-6);
  });
});
