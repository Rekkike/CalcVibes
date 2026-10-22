// v0.6.12.1 Task B (AUD-2): the financing overlay honors per-year profiles. The draws, the equity
// outlay, the fundability check and both leveraged solves derive from the profile-honoring
// incurred amounts (the lineIncurred basis the book view already uses). The comparator for every
// profile case is the equivalent profile-free formulation, whose code path is the byte-identity
// lock: the existing battery asserts every profile-free fixture is unchanged.
import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { EngineInputError } from "../src/validate.js";
import type { CostLine, FinancingConfig, ModelInputs, TariffRow } from "../src/types.js";

const fin = (over: Partial<FinancingConfig> = {}): FinancingConfig => ({
  enabled: true, sharePct: 50, debtRatePct: 5, termYears: 5, graceYears: 0,
  serviceStartYear: 3, amortization: "annuity", leveragedSolve: false, perLineSharePct: {}, ...over,
});
const project = (costs: CostLine[], financing: FinancingConfig, extra: Partial<ModelInputs> = {}): ModelInputs => ({
  projectName: "profiles0612", currency: "SEK", targetIrr: 8, costs,
  repayment: { graceYears: 0, termYears: 5, paymentsPerYear: 1, paymentEscalation: 0, balloon: 0, firstCollectionYear: 3 },
  financing, ...extra,
});
const capexProfile = (inertAmount = 1, inertStart = 1, years: Record<number, number> = { 1: 400000, 2: 600000 }): CostLine => ({
  id: "c1", name: "Capex profile", category: "capex", amount: inertAmount, startYear: inertStart, durationYears: 0, escalation: 0, yearOverrides: years,
});
const capexLumps = (): CostLine[] => [
  { id: "a", name: "Lump one", category: "capex", amount: 400000, startYear: 1, durationYears: 0, escalation: 0 },
  { id: "b", name: "Lump two", category: "capex", amount: 600000, startYear: 2, durationYears: 0, escalation: 0 },
];
const recurringProfile = (): CostLine => ({
  id: "c1", name: "Burn profile", category: "recurring", amount: 100000, startYear: 1, durationYears: 2, escalation: 0, yearOverrides: { 1: 300000, 2: 700000 },
});
const recurringYears = (): CostLine[] => [
  { id: "a", name: "Year one", category: "recurring", amount: 300000, startYear: 1, durationYears: 1, escalation: 0 },
  { id: "b", name: "Year two", category: "recurring", amount: 700000, startYear: 2, durationYears: 1, escalation: 0 },
];
// v0.6.14: the comparator is the legacy overlay fields; the per-facility positions carry line-keyed
// shares (a profile line and its two-lump twin differ in line ids by construction).
const fz = (r: ReturnType<typeof computeModel>) => JSON.stringify({ ...r.financing, facilities: undefined });

describe("v0.6.12.1 Task B: the financing overlay honors per-year profiles", () => {
  it("PROFILE-CAPEX-DRAWS: a CAPEX profile {1:400000, 2:600000} at the inert amount 1 draws and funds from the profile (the audit's case 1)", () => {
    const r = computeModel(project([capexProfile()], fin()));
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(z.drawnTotal).toBe(500000);
    expect(z.draws[11]).toBe(200000);
    expect(z.draws[23]).toBe(300000);
    expect(z.equity.outlay).toBe(500000);
    // the inert fields cannot move the overlay
    const other = computeModel(project([capexProfile(999999, 7)], fin()));
    expect(fz(other)).toBe(fz(r));
    // the equivalent two-lump formulation (the profile-free comparator)
    const lumps = computeModel(project(capexLumps(), fin()));
    expect(fz(r)).toBe(fz(lumps));
  });

  it("PROFILE-RECURRING-DRAWS: a recurring line with overrides totalling 1,000,000 at 50 percent draws 500,000, not 100,000 (the audit's case 2)", () => {
    const r = computeModel(project([recurringProfile()], fin()));
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(r.lineTotals[0].total).toBe(1000000);
    expect(z.drawnTotal).toBeCloseTo(500000, 6);
    expect(z.equity.outlay).toBe(500000);
    const years = computeModel(project(recurringYears(), fin()));
    expect(fz(r)).toBe(fz(years));
  });

  it("PROFILE-FUNDABILITY: the fundable-cost check follows the profile years, both ways", () => {
    // a profile year after the service start is refused even though the inert start year is early
    expect(() => computeModel(project([capexProfile(1, 1, { 1: 400000, 5: 600000 })], fin()))).toThrowError(EngineInputError);
    expect(() => computeModel(project([capexProfile(1, 1, { 1: 400000, 5: 600000 })], fin()))).toThrowError(/FIN-FUNDABLE-AFTER-START/);
    // a profile inside the service start is accepted even though the inert start year is late
    expect(() => computeModel(project([capexProfile(1, 9)], fin()))).not.toThrow();
  });

  it("PROFILE-LEVERAGED-ANNUITY: the leveraged annuity solve on a profile equals the profile-free comparator and earns the target on equity", () => {
    const r = computeModel(project([capexProfile()], fin({ leveragedSolve: true })));
    const lumps = computeModel(project(capexLumps(), fin({ leveragedSolve: true })));
    expect(r.paymentAmount).toBe(lumps.paymentAmount);
    expect(Math.abs((r.financing as NonNullable<typeof r.financing>).equity.npvAtTarget)).toBeLessThan(1e-6);
  });

  it("PROFILE-LEVERAGED-STABLE: the leveraged stable-tariff solve on a profile equals the profile-free comparator and earns the target on equity", () => {
    const rows: TariffRow[] = [
      { id: "r1", label: "Row one", weight: 1, lifts: [100, 200, 200, 200, 200, 150] },
      { id: "r2", label: "Row two", weight: 2, lifts: [50, 100, 100, 100, 100, 75] },
    ];
    const tariff = { mode: "stable" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null };
    const r = computeModel(project([capexProfile()], fin({ leveragedSolve: true }), { tariff }));
    const lumps = computeModel(project(capexLumps(), fin({ leveragedSolve: true }), { tariff }));
    expect(r.tariffBaseUnitPrice).toBe(lumps.tariffBaseUnitPrice);
    expect(Math.abs((r.financing as NonNullable<typeof r.financing>).equity.npvAtTarget)).toBeLessThan(1e-6);
  });

  it("PROFILE-EMPTY-LOCK: empty overrides are byte-identical to no overrides (the lock on every profile-free path)", () => {
    const plain: CostLine[] = [
      { id: "c1", name: "Burn", category: "recurring", amount: 400000, startYear: 1, durationYears: 2, escalation: 3 },
      { id: "c2", name: "Lump", category: "capex", amount: 250000, startYear: 2, durationYears: 0, escalation: 0 },
    ];
    const empty = plain.map((c) => ({ ...c, yearOverrides: {} }));
    for (const lev of [false, true]) {
      const a = computeModel(project(plain, fin({ leveragedSolve: lev })));
      const b = computeModel(project(empty, fin({ leveragedSolve: lev })));
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    }
  });
});
