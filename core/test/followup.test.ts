import { describe, expect, it } from "vitest";
import { computeModel, solveTerm } from "../src/engine.js";
import { EngineInputError } from "../src/validate.js";
import { appraisal, templateLike } from "./_shared.js";
import type { TariffRow } from "../src/types.js";

const rows: TariffRow[] = [
  { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] },
  { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] },
];
const base = () => ({ ...templateLike(), appraisal: appraisal() });
const maint = { mode: "percent" as const, percentPerYear: 0.5 };

describe("Task A: solveTerm fixed-point window and shortfall semantics", () => {
  it("A-1 regression: no maintenance, P = 400,000", () => {
    const b = solveTerm(base(), 400000);
    expect(b.paymentCount).toBe(38);
    expect(b.termYears).toBe(9.5);
    expect(b.lastPaymentMonth).toBe(147);
    expect(Math.abs((b.minimalityShortfall as number) - 13199.65)).toBeLessThan(0.01);
    expect(Math.abs((b.result.achievedIrr as number) - 0.12272649)).toBeLessThan(1e-6);
  });

  it("A-2 MB-MINT: window [36, 147], both shortfalls on the converged basis", () => {
    const b = solveTerm({ ...base(), maintenance: maint }, 400000);
    expect(b.paymentCount).toBe(38);
    expect(b.termYears).toBe(9.5);
    expect(b.lastPaymentMonth).toBe(147);
    expect(b.result.operatingLines[0].effectiveWindow).toEqual([36, 147]);
    expect(Math.abs(b.result.costNpv - 6641866.07220)).toBeLessThan(0.01);
    expect(b.result.operatingTotal).toBe(21000);
    expect(Math.abs((b.minimalityShortfall as number) - 22467.74)).toBeLessThan(0.01);
    expect(Math.abs((b.shortfall as number) - -77334.25155)).toBeLessThan(0.01);
    expect(Math.abs((b.result.achievedIrr as number) - 0.12243572)).toBeLessThan(1e-6);
    expect(b.result.signChanges).toBe(75);
    expect(b.result.goalMet).toBe(true);
  });

  it("A-3 MB-FLIP: count 39 with maintenance, 38 without, both sides hold", () => {
    const withM = solveTerm({ ...base(), maintenance: maint }, 394900);
    expect(withM.paymentCount).toBe(39);
    expect(withM.termYears).toBe(9.75);
    expect(withM.lastPaymentMonth).toBe(150);
    expect(withM.result.operatingLines[0].effectiveWindow).toEqual([36, 150]);
    expect(Math.abs(withM.result.costNpv - 6642003.79684)).toBeLessThan(0.01);
    expect(withM.result.operatingTotal).toBe(21562.50);
    expect(Math.abs((withM.minimalityShortfall as number) - 8473.28)).toBeLessThan(0.01);
    expect(Math.abs((withM.shortfall as number) - -87303.85967)).toBeLessThan(0.01);
    expect(Math.abs((withM.result.achievedIrr as number) - 0.12270738)).toBeLessThan(1e-6);
    expect(withM.result.signChanges).toBe(77);
    const without = solveTerm(base(), 394900);
    expect(without.paymentCount).toBe(38);
    expect(Math.abs((without.result.achievedIrr as number) - 0.12002947)).toBeLessThan(1e-6);
  });

  it("A-4 MB-BOUND: the discriminating boundary case at P = 395,400", () => {
    const b = solveTerm({ ...base(), maintenance: maint }, 395400);
    expect(b.paymentCount).toBe(38);
    expect(b.termYears).toBe(9.5);
    expect(b.lastPaymentMonth).toBe(147);
    expect(b.result.operatingLines[0].effectiveWindow).toEqual([36, 147]);
    expect(Math.abs(b.result.costNpv - 6641866.07220)).toBeLessThan(0.01);
    expect(b.result.operatingTotal).toBe(21000);
    expect(Math.abs((b.minimalityShortfall as number) - 98590.82216)).toBeLessThan(0.01);
    expect(Math.abs((b.shortfall as number) - -63.44782)).toBeLessThan(0.01);
  });

  it("A-5 trace: the iteration is monotone and converges within three iterations, window end always (n - 1) x spacing", () => {
    const b = solveTerm({ ...base(), maintenance: maint }, 395400);
    expect(b.paymentCount).toBe(38);
    const last = 36 + ((b.paymentCount as number) - 1) * 3;
    expect(b.lastPaymentMonth).toBe(last);
    expect(b.result.operatingLines[0].effectiveWindow[1]).toBe(last);
  });
});

describe("Task B: decompose operating window", () => {
  it("B-1 DEC-MAINT byte identity with the tariff-off MAINT case", () => {
    const decM = computeModel({ ...base(), maintenance: maint, tariff: { mode: "decompose", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } });
    const offM = computeModel({ ...base(), maintenance: maint });
    expect(Math.abs((decM.paymentAmount as number) - 475857.58728)).toBeLessThan(0.01);
    expect(decM.totalCost).toBe(7865235);
    expect(Math.abs(decM.npvAtWacc - 1252816.91198)).toBeLessThan(0.01);
    expect(Math.abs((decM.profitabilityIndex as number) - 1.17888)).toBeLessThan(1e-4);
    expect(Math.abs((decM.mirr as number) - 0.08754387)).toBeLessThan(1e-6);
    expect(decM.signChanges).toBe(55);
    expect(decM.operatingTotal).toBe(15375);
    expect(decM.operatingLines[0].effectiveWindow).toEqual([36, 117]);
    expect(decM.firstPaymentMonth).toBe(36);
    const strip = (o: unknown) => {
      const c = JSON.parse(JSON.stringify(o)) as Record<string, unknown>;
      delete c.tariffYears;
      delete c.tariffBaseUnitPrice;
      return c;
    };
    expect(JSON.stringify(strip(decM))).toBe(JSON.stringify(strip(offM)));
  });

  it("B-2 regression: collection modes keep the last-tariff-month window (STABLE-MAINT pins)", () => {
    const r = computeModel({ ...base(), maintenance: maint, tariff: { mode: "stable", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } });
    expect(Math.abs((r.tariffBaseUnitPrice as number) - 1205.6620314)).toBeLessThan(1e-4);
    expect(r.operatingTotal).toBe(15937.50);
    expect(r.operatingLines[0].effectiveWindow).toEqual([36, 120]);
    expect(Math.abs(r.totalCost - 7865797.50)).toBeLessThan(0.01);
  });
});

describe("Task C: engine-emitted per-lift charges", () => {
  it("C-1 decompose first grid year: weight-2 charge is exactly twice the unit price", () => {
    const dec = computeModel({ ...base(), tariff: { mode: "decompose", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } });
    const y3 = dec.tariffYears[0];
    expect(Math.abs((y3.unitPrice as number) - 679.0130487)).toBeLessThan(1e-4);
    expect(Math.abs((y3.perRowCharges as Record<string, number>).r2 - 1358.0260974)).toBeLessThan(1e-4);
    expect(Math.abs((y3.perRowCharges as Record<string, number>).r2 - 2 * (y3.unitPrice as number))).toBeLessThan(1e-9);
  });

  it("C-2 manual-eq charges reproduce the STABLE collections byte-identically", () => {
    const st = computeModel({ ...base(), tariff: { mode: "stable", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } });
    const prices = st.tariffYears.map((y) => y.unitPrice as number);
    const man = computeModel({ ...base(), tariff: { mode: "manual", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: prices } });
    expect(JSON.stringify(man.monthly.map((m) => m.inflow))).toBe(JSON.stringify(st.monthly.map((m) => m.inflow)));
    expect(Math.abs((man.achievedIrr as number) - 0.12)).toBeLessThan(1e-6);
    expect(Math.abs(man.totalCollected - 13143208.01)).toBeLessThan(0.01);
    expect(Math.abs((man.paybackYears as number) - 6.95570)).toBeLessThan(1e-4);
    expect(Math.abs((man.mirr as number) - 0.08684428)).toBeLessThan(1e-6);
  });
});

describe("Task D: manual price validation", () => {
  it("D-1 MANUAL-EQ identity with the pinned prices of record", () => {
    const prices = [1204.2392789, 1228.3240645, 1252.8905458, 1277.9483567, 1303.5073239, 1329.5774703, 1356.1690197, 1383.2924001];
    const man = computeModel({ ...base(), tariff: { mode: "manual", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: prices } });
    expect(Math.abs((man.achievedIrr as number) - 0.12)).toBeLessThan(1e-6);
    expect(Math.abs(man.totalCollected - 13143208.01)).toBeLessThan(0.01);
    expect(Math.abs((man.paybackYears as number) - 6.95570)).toBeLessThan(1e-4);
    expect(Math.abs((man.mirr as number) - 0.08684428)).toBeLessThan(1e-6);
  });

  it("D-2 MANUAL-UP regression", () => {
    const prices = [1204.2392789, 1228.3240645 * 1.10, 1252.8905458, 1277.9483567, 1303.5073239, 1329.5774703, 1356.1690197, 1383.2924001];
    const up = computeModel({ ...base(), tariff: { mode: "manual", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: prices } });
    expect(Math.abs(up.tariffYears[1].revenue - 1891619.06)).toBeLessThan(0.01);
    expect(Math.abs((up.achievedIrr as number) - 0.12449345)).toBeLessThan(1e-6);
    expect(Math.abs(up.npvAtTarget - 115174.92)).toBeLessThan(0.01);
    expect(Math.abs(up.totalCollected - 13315173.38)).toBeLessThan(0.01);
  });

  it("D-3 validation: wrong length and negative entries surface, never zero silently", () => {
    expect(() => computeModel({ ...base(), tariff: { mode: "manual", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: [1, 2, 3] } }))
      .toThrowError(/must equal the grid column count/);
    const prices = [1204.2392789, -1, 1252.8905458, 1277.9483567, 1303.5073239, 1329.5774703, 1356.1690197, 1383.2924001];
    expect(() => computeModel({ ...base(), tariff: { mode: "manual", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: prices } }))
      .toThrowError(EngineInputError);
  });
});

describe("Task F: decompose NaN guard and collection-mode fields", () => {
  it("F-1 a degenerate decompose cell emits null, never NaN", () => {
    const idleRows: TariffRow[] = [
      { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [1, 1, 1, 1, 1, 1, 1, 0] },
      { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [1, 1, 1, 1, 1, 1, 1, 0] },
    ];
    const ppy1 = { ...base(), repayment: { ...base().repayment, paymentsPerYear: 1 } };
    const r = computeModel({ ...ppy1, tariff: { mode: "decompose", escalationPerYear: 2, rows: idleRows, fixedAnnualAmount: null, manualPrices: null } });
    const emptyYear = r.tariffYears.find((y) => y.weightedVolume === 0 && (y.required as number) === 0);
    expect(emptyYear).toBeTruthy();
    expect(emptyYear && emptyYear.unitPrice).toBeNull();
  });

  it("F-2 STABLE under the new field semantics; every other STABLE pin unchanged", () => {
    const r = computeModel({ ...base(), tariff: { mode: "stable", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } });
    expect(r.paymentCount).toBeNull();
    expect(r.lastPaymentMonth).toBe(120);
    expect(r.monthly.length).toBe(120);
    expect(Math.abs((r.achievedIrr as number) - 0.12)).toBeLessThan(1e-6);
    expect(Math.abs(r.totalCollected - 13143208.01)).toBeLessThan(0.01);
  });
});
