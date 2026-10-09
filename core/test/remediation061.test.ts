import { describe, expect, it } from "vitest";
import { computeModel, irrAnnual, npvYearly, irrYearly } from "../src/engine.js";
import { applyScenario } from "../src/scenarios.js";
import { validateInputs } from "../src/validate.js";
import { EngineInputError } from "../src/validate.js";
import type { ModelInputs } from "../src/types.js";
import template from "../../data/template-project.json";

const base = (over: Partial<ModelInputs> = {}): ModelInputs => ({
  projectName: template.projectName,
  currency: "SEK",
  targetIrr: template.targetIrr,
  costs: template.costs.map((c) => ({ ...c, category: c.category as "recurring" | "capex" })),
  repayment: { ...template.repayment },
  operatingLines: template.operatingLines ?? [],
  maintenance: { mode: "off" },
  ...over,
});

const fixAFixture = (): ModelInputs => base({ appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { mode: "amount", amount: 100000000, year: 10 } } }) as ModelInputs;

const fixBFixture = (): ModelInputs => base({
  costs: [{ id: "o1", name: "Operations", category: "recurring", amount: 800000, startYear: 1, durationYears: 15, escalation: 0 }],
  contracts: [
    { id: "k1", label: "Anchor tenant", startYear: 2, termYears: 14, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "evaluated", evaluatedPayment: 1000000 },
  ],
}) as ModelInputs;

const fixCFixture = (): ModelInputs => base({
  repayment: { ...template.repayment, termYears: 7, paymentsPerYear: 1 },
  contracts: [
    { id: "k1", label: "Anchor tenant", startYear: 4, termYears: 29, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "evaluated", evaluatedPayment: 1000000 },
    { id: "k2", label: "Top-up", startYear: 4, termYears: 3, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
  ],
}) as ModelInputs;

describe("v0.6.1 FIX-A: the zero-clamp on the solved payment", () => {
  it("the raw negative solve is clamped to zero; the verdict and figures are honest (F12/F13/F14)", () => {
    const r = computeModel(fixAFixture());
    expect(r.paymentAmount).toBe(0);
    expect(r.solvedClamped).toBe(true);
    expect(r.achievedIrr).toBeCloseTo(0.34533091318844233, 15);
    expect(r.goalMet).toBe(true);
    expect(r.netGain).toBe(92150140);
    expect(r.totalCollected).toBe(100000000);
    expect(r.signChanges).toBe(1);
  });

  it("a negative solved rent never exists on any surface: every non-collection-mode case with a negative raw solve reports zero", () => {
    const r = computeModel(fixAFixture());
    expect((r.paymentAmount as number) >= 0).toBe(true);
  });
});

describe("v0.6.1 FIX-B: the conditional headline IRR (F15-b)", () => {
  it("the all-evaluated portfolio is accepted (F7) and reports the yearly-aggregated headline with a null solved payment", () => {
    const r = computeModel(fixBFixture());
    expect(r.paymentAmount).toBeNull();
    expect(r.achievedIrr).toBeCloseTo(0.23731753539433476, 15);
    expect(r.npvAtWacc).toBeCloseTo(538380.339462708, 6);
    expect(r.netGain).toBe(2000000);
    expect(r.totalCollected).toBe(14000000);
    expect(r.goalMet).toBe(true);
    expect(r.paymentCount).toBe(14);
    expect(r.headlineSource).toBe("yearly");
    expect(r.signChanges).toBe(27);
  });

  it("the monthly vector on FIX-B is non-conventional (27 sign changes) and its arbitrary monthly root is never the headline", () => {
    const r = computeModel(fixBFixture());
    expect(r.signChanges).toBe(27);
    const monthlyRoot = irrAnnual(r.monthly.map((m) => m.net));
    expect(monthlyRoot).not.toBeNull();
    expect(monthlyRoot).not.toBe(r.achievedIrr);
    expect(r.achievedIrr).toBeCloseTo(0.23731753539433476, 15);
  });

  it("npvYearly and irrYearly: end-of-year timing, the annual rate returned directly", () => {
    expect(npvYearly(0, [-100, 110])).toBeCloseTo(10, 9);
    expect(irrYearly([-100, 110])).toBeCloseTo(0.1, 9);
    expect(irrYearly([0, 0, 0])).toBeNull();
  });

  it("a conventional monthly flow keeps the monthly headline (the template profile) and INV-2 is untouched", () => {
    const r = computeModel(base({ appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } } }) as ModelInputs);
    expect(r.headlineSource).toBe("monthly");
    expect(Math.abs((r.achievedIrr as number) - 0.12)).toBeLessThan(1e-9);
  });

  it("an ambiguous yearly aggregate renders a null headline with the disclosure carrying", () => {
    const inp = base({
      costs: [{ id: "z", name: "Z", category: "recurring", amount: 100000, startYear: 1, durationYears: 4, escalation: 0 }],
      contracts: [
        { id: "k1", label: "A", startYear: 1, termYears: 3, paymentsPerYear: 12, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "evaluated", evaluatedPayment: 400000 },
        { id: "k2", label: "B", startYear: 24, termYears: 3, paymentsPerYear: 12, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "evaluated", evaluatedPayment: 300000 },
        { id: "k3", label: "C", startYear: 48, termYears: 3, paymentsPerYear: 12, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "evaluated", evaluatedPayment: 200000 },
      ],
    }) as ModelInputs;
    const r = computeModel(inp);
    const years = Math.ceil(r.monthly.length / 12);
    const yearlyFlows: number[] = [];
    for (let y = 0; y < years; y++) {
      let sum = 0;
      for (let m = y * 12; m < Math.min(r.monthly.length, (y + 1) * 12); m++) sum += r.monthly[m].net;
      yearlyFlows.push(sum);
    }
    let changes = 0;
    let prev = 0;
    for (const f of yearlyFlows) {
      if (f === 0) continue;
      const sign = f > 0 ? 1 : -1;
      if (prev !== 0 && sign !== prev) changes++;
      prev = sign;
    }
    if (changes >= 2) {
      expect(r.headlineSource).toBe("ambiguous");
      expect(r.achievedIrr).toBeNull();
    } else {
      expect(r.headlineSource).not.toBe("ambiguous");
    }
  });

  it("no-drift proof: the template golden profile is byte-identical under the headline change", () => {
    const r = computeModel(base({ appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } } }) as ModelInputs);
    expect(r.costNpv).toBeCloseTo(6632597.98343582, 6);
    expect(r.paymentAmount).toBeCloseTo(475309.1340746104, 6);
    expect(r.paybackYears).toBeCloseTo(6.959606064286818, 9);
    expect(r.achievedIrr).toBeCloseTo(0.120000000000001, 15);
  });
});

describe("v0.6.1 FIX-C: mode-aware payment statistics (F7)", () => {
  it("paymentCount is the active-slot count across all contracts, not the dormant legacy block", () => {
    const r = computeModel(fixCFixture());
    expect(r.paymentCount).toBe(32);
    expect(r.contractsInfo?.map((c) => c.paymentCount)).toEqual([29, 3]);
    expect(r.paymentAmount).toBeCloseTo(539803.3546482878, 6);
    expect(r.achievedIrr).toBeCloseTo(0.120000000000001, 12);
    expect(r.signChanges).toBe(1);
  });
});

describe("v0.6.1 FIX-D: contracts-aware scenario term shifts (F8)", () => {
  it("the term shift applies to every contract, never the dormant legacy block", () => {
    const inp = fixCFixture();
    const shifted = applyScenario(inp, { burnMultiplier: 1.1, escalationShift: 1, targetShift: 2, termShift: -1 });
    expect(shifted.contracts?.[0].termYears).toBe(28);
    expect(shifted.contracts?.[1].termYears).toBe(2);
    expect(shifted.repayment.termYears).toBe(7);
    const r = computeModel(shifted);
    expect(r.paymentAmount).toBeCloseTo(2226569.460608867, 6);
    expect(r.achievedIrr).toBeCloseTo(0.1399999999999988, 12);
    expect(r.paymentCount).toBe(30);
    expect(r.goalMet).toBe(true);
  });

  it("legacy mode unchanged: the shift applies to the repayment block there", () => {
    const inp = base() as ModelInputs;
    const shifted = applyScenario(inp, { burnMultiplier: 1, escalationShift: 0, targetShift: 0, termShift: -1 });
    expect(shifted.repayment.termYears).toBe(6);
    expect(shifted.contracts).toBeUndefined();
  });
});

describe("v0.6.1 0.5: the end-of-case disposition (F14-a/F15-a)", () => {
  it("the none posture: no terminal inflow; byte-identical to the amount-0 case", () => {
    const noneCase = base({ appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "none", amount: 5000000, year: 10 } } }) as ModelInputs;
    const zeroCase = base({ appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } } }) as ModelInputs;
    const a = computeModel(noneCase);
    const b = computeModel(zeroCase);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.residualDisclosure).toBeNull();
    expect(a.residualAmountUsed).toBe(0);
  });

  it("strict validation names the field and posture; the silent empty-year acceptance dies", () => {
    const issues = validateInputs(base({ appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "set-price", amount: 1000000, year: 0 } } }) as ModelInputs);
    expect(issues).toContain("The set-price disposition requires a sale year that is an integer of at least 1.");
    const issues2 = validateInputs(base({ appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "book-value", amount: 0, year: 0 } } }) as ModelInputs);
    expect(issues2).toContain("The book-value disposition requires a sale year that is an integer of at least 1.");
    const issues3 = validateInputs(base({ appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "set-price", amount: 0, year: 5 } } }) as ModelInputs);
    expect(issues3).toContain("The set-price disposition requires a finite sale amount greater than 0.");
  });

  it("the legacy derivation maps the standing fixtures: amount-positive maps to set-price, calculated maps to book-value", () => {
    const r = computeModel(fixAFixture());
    expect(r.residualDisclosure).toBe("Assumes sale at year 10 for 100000000");
    const issues = validateInputs(base({ appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { mode: "amount", amount: 1000000, year: 1.5 } } }) as ModelInputs);
    expect(issues).toContain("The set-price disposition requires a sale year that is an integer of at least 1.");
  });

  it("the book-value posture emits the remaining-book-value disclosure", () => {
    const r = computeModel(base({
      costs: [
        { id: "d1", name: "Depreciable", category: "capex", amount: 20000000, startYear: 1, durationYears: 1, escalation: 0, depreciation: { mode: "straight-line", years: 33 } },
        { id: "d2", name: "Retained", category: "capex", amount: 80000000, startYear: 1, durationYears: 1, escalation: 0, depreciation: { mode: "retained" } },
      ],
      appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "book-value", amount: 0, year: 33 } },
    }) as ModelInputs);
    expect(r.residualDisclosure).toContain("Assumes sale at remaining book value at year 33 for");
    expect(r.residualAmountUsed).toBe(r.bookView?.remainingBookValueAtResidualYear);
  });

  it("the engine refuses an invalid model loudly (the standing EngineInputError contract)", () => {
    expect(() => computeModel(base({ appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "set-price", amount: 1000000, year: 0 } } }) as ModelInputs)).toThrowError(EngineInputError);
  });
});
