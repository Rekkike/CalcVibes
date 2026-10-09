import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { EngineInputError } from "../src/validate.js";
import { appraisal, templateLike } from "./_shared.js";
import type { TariffRow } from "../src/types.js";

const rows: TariffRow[] = [
  { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] },
  { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] },
];
const base = () => ({ ...templateLike(), appraisal: appraisal() });
const tariff = (mode: "decompose" | "stable" | "manual" | "fixed", extra: Partial<{ escalationPerYear: number; manualPrices: number[] | null; fixedAnnualAmount: number | null }> = {}) => ({
  mode, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null, ...extra,
});

describe("CP-2 decompose mode", () => {
  it("DEC: solved schedule untouched; required and unit prices pinned; exact per-year identity", () => {
    const r = computeModel({ ...base(), tariff: tariff("decompose") });
    expect(Math.abs((r.paymentAmount as number) - 475309.13407)).toBeLessThan(0.01);
    const t = r.tariffYears;
    expect(t.length).toBe(8);
    expect(Math.abs((t[0].required as number) - 475309.13)).toBeLessThan(0.01);
    expect(Math.abs((t[1].required as number) - 1901236.54)).toBeLessThan(0.01);
    expect(Math.abs((t[7].required as number) - 1425927.40)).toBeLessThan(0.01);
    expect(Math.abs((t[0].unitPrice as number) - 679.0130487)).toBeLessThan(1e-4);
    expect(Math.abs((t[1].unitPrice as number) - 1358.0260974)).toBeLessThan(1e-4);
    for (const y of t) {
      const identity = rows.reduce((acc, row) => acc + row.weight * (row.lifts[t.indexOf(y)] ?? 0) * (y.unitPrice as number), 0);
      expect(Math.abs(identity - (y.required as number))).toBeLessThan(1e-9);
    }
  });

  it("DEC-IDX: indexation composes; unit prices and the year-over-year ratios pinned", () => {
    const r = computeModel({ ...base(), repayment: { ...base().repayment, paymentEscalation: 2 }, tariff: tariff("decompose") });
    expect(Math.abs((r.paymentAmount as number) - 451546.01368)).toBeLessThan(0.01);
    const up = r.tariffYears.map((y) => y.unitPrice as number);
    const expected = [645.0657338, 1296.5821250, 1322.5137675, 1348.9640428, 1375.9433237, 1403.4621902, 1431.5314340, 1452.8975748];
    for (let i = 0; i < 8; i++) expect(Math.abs(up[i] - expected[i])).toBeLessThan(1e-4);
    for (let i = 2; i <= 6; i++) {
      expect(Math.abs(up[i] / up[i - 1] - 1.02)).toBeLessThan(1e-9);
    }
    expect(Math.abs(up[7] / up[6] - 1.01492537)).toBeLessThan(1e-6);
  });

  it("OVR-DEC: override composes; grid years 2-9", () => {
    const r = computeModel({ ...base(), repayment: { ...base().repayment, firstCollectionYear: 2 }, tariff: tariff("decompose") });
    expect(Math.abs((r.paymentAmount as number) - 424383.15542)).toBeLessThan(0.01);
    const t = r.tariffYears;
    expect(t.map((y) => y.year)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(Math.abs((t[0].required as number) - 424383.16)).toBeLessThan(0.01);
    expect(Math.abs((t[1].required as number) - 1697532.62)).toBeLessThan(0.01);
    expect(Math.abs((t[7].required as number) - 1273149.47)).toBeLessThan(0.01);
    expect(Math.abs((t[0].unitPrice as number) - 606.2616506)).toBeLessThan(1e-4);
    expect(Math.abs((t[1].unitPrice as number) - 1212.5233012)).toBeLessThan(1e-4);
  });

  it("validation: zero weighted volume against a positive required collection errors, naming the year; row shape violations surface", () => {
    const zeroRows: TariffRow[] = rows.map((row) => ({ ...row, lifts: [0, 0, 0, 0, 0, 0, 0, 0] }));
    expect(() => computeModel({ ...base(), tariff: { mode: "decompose", escalationPerYear: 2, rows: zeroRows, fixedAnnualAmount: null, manualPrices: null } }))
      .toThrowError(/zero weighted volume against a positive required collection/);
    expect(() => computeModel({ ...base(), tariff: { mode: "decompose", escalationPerYear: 2, rows: [{ id: "r1", label: "X", weight: 0, lifts: [1, 1, 1, 1, 1, 1, 1, 1] }], fixedAnnualAmount: null, manualPrices: null } }))
      .toThrowError(EngineInputError);
    expect(() => computeModel({ ...base(), tariff: { mode: "decompose", escalationPerYear: 2, rows: [{ id: "r1", label: "", weight: 1, lifts: [1, 1, 1, 1, 1, 1, 1, 1] }], fixedAnnualAmount: null, manualPrices: null } }))
      .toThrowError(EngineInputError);
    expect(() => computeModel({ ...base(), tariff: { mode: "decompose", escalationPerYear: 2, rows: [{ id: "r1", label: "X", weight: 1, lifts: [1.5, 1, 1, 1, 1, 1, 1, 1] }], fixedAnnualAmount: null, manualPrices: null } }))
      .toThrowError(EngineInputError);
  });
});

describe("CP-3 stable indexed tariff", () => {
  it("STABLE: full pin set", () => {
    const r = computeModel({ ...base(), tariff: tariff("stable") });
    expect(r.paymentAmount).toBeNull();
    expect(Math.abs((r.tariffBaseUnitPrice as number) - 1204.2392789)).toBeLessThan(1e-4);
    const up = r.tariffYears.map((y) => y.unitPrice as number);
    const expected = [1204.2392789, 1228.3240645, 1252.8905458, 1277.9483567, 1303.5073239, 1329.5774703, 1356.1690197, 1383.2924001];
    for (let i = 0; i < 8; i++) expect(Math.abs(up[i] - expected[i])).toBeLessThan(1e-4);
    const revs = r.tariffYears.map((y) => y.revenue);
    const expectedRev = [842967.50, 1719653.69, 1754046.76, 1789127.70, 1824910.25, 1861408.46, 1898636.63, 1452457.02];
    for (let i = 0; i < 8; i++) expect(Math.abs(revs[i] - expectedRev[i])).toBeLessThan(0.01);
    expect(Math.abs(r.npvAtTarget)).toBeLessThan(1e-6);
    expect(Math.abs((r.achievedIrr as number) - 0.12)).toBeLessThan(1e-9);
    expect(r.goalMet).toBe(true);
    expect(r.signChanges).toBe(1);
    expect(Math.abs(r.totalCollected - 13143208.01)).toBeLessThan(0.01);
    expect(Math.abs(r.netGain - 5293348.01)).toBeLessThan(0.01);
    expect(Math.abs((r.paybackYears as number) - 6.95570)).toBeLessThan(1e-4);
    expect(Math.abs((r.discountedPaybackYears as number) - 8.46268)).toBeLessThan(1e-4);
    expect(Math.abs(r.npvAtWacc - 1216532.50)).toBeLessThan(0.01);
    expect(Math.abs((r.profitabilityIndex as number) - 1.17394)).toBeLessThan(1e-4);
    expect(Math.abs((r.mirr as number) - 0.08684428)).toBeLessThan(1e-6);
    expect(r.monthly.length).toBe(120);
    const lastInflow = Math.max(...r.monthly.map((m, i) => (m.inflow > 0 ? i + 1 : 0)));
    expect(lastInflow).toBe(120);
    expect(r.totalCollected).not.toBeCloseTo(13308655.75, 2);
    expect(lastInflow).not.toBe(117);
  });

  it("STABLE-RES: residual subtracted from the requirement; never decomposed into prices", () => {
    const r = computeModel({ ...base(), appraisal: appraisal(8, 6, 6, 1000000, 10), tariff: tariff("stable") });
    expect(Math.abs((r.tariffBaseUnitPrice as number) - 1145.7806147)).toBeLessThan(1e-4);
    expect(Math.abs(r.npvAtTarget)).toBeLessThan(1e-6);
    expect(Math.abs((r.achievedIrr as number) - 0.12)).toBeLessThan(1e-9);
    expect(r.goalMet).toBe(true);
    expect(r.signChanges).toBe(1);
  });

  it("STABLE-MAINT: maintenance composes; window ends at the last tariff month", () => {
    const r = computeModel({ ...base(), maintenance: { mode: "percent", percentPerYear: 0.5 }, tariff: tariff("stable") });
    expect(Math.abs((r.tariffBaseUnitPrice as number) - 1205.6620314)).toBeLessThan(1e-4);
    expect(Math.abs((r.achievedIrr as number) - 0.12)).toBeLessThan(1e-6);
    expect(r.goalMet).toBe(true);
    expect(r.signChanges).toBe(1);
    expect(r.totalCost).toBe(7865797.50);
    expect(r.operatingTotal).toBe(15937.50);
    expect(r.operatingLines[0].effectiveWindow).toEqual([36, 120]);
  });

  it("STABLE-OVR: override composes; ambiguity disclosed (headline re-anchored per v0.6.1 0.2)", () => {
    const r = computeModel({ ...base(), repayment: { ...base().repayment, firstCollectionYear: 2 }, tariff: tariff("stable") });
    expect(r.tariffYears.map((y) => y.year)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(Math.abs((r.tariffBaseUnitPrice as number) - 1075.2136419)).toBeLessThan(1e-4);
    expect(Math.abs(r.npvAtTarget)).toBeLessThan(1e-6);
    expect(Math.abs((r.achievedIrr as number) - 0.12054147296513473)).toBeLessThan(1e-9);
    expect(r.goalMet).toBe(true);
    expect(r.signChanges).toBe(3);
    expect(r.irrAmbiguous).toBe(true);
    expect(Math.abs(r.totalCollected - 11735007.15)).toBeLessThan(0.01);
    expect(Math.abs((r.paybackYears as number) - 6.46263)).toBeLessThan(1e-4);
    expect(r.monthly.length).toBe(108);
  });

  it("validation: stable mode with all-zero weighted volumes is a surfaced infeasibility", () => {
    const zeroRows: TariffRow[] = rows.map((row) => ({ ...row, lifts: [0, 0, 0, 0, 0, 0, 0, 0] }));
    expect(() => computeModel({ ...base(), tariff: { mode: "stable", escalationPerYear: 2, rows: zeroRows, fixedAnnualAmount: null, manualPrices: null } }))
      .toThrowError(/Stable tariff infeasible/);
  });
});

describe("CP-4 manual and fixed modes", () => {
  it("MANUAL-EQ: manual prices equal to the stable unit prices reproduce the stable collections exactly", () => {
    const st = computeModel({ ...base(), tariff: tariff("stable") });
    const prices = st.tariffYears.map((y) => y.unitPrice as number);
    const man = computeModel({ ...base(), tariff: tariff("manual", { manualPrices: prices }) });
    expect(JSON.stringify(man.monthly.map((m) => m.inflow))).toBe(JSON.stringify(st.monthly.map((m) => m.inflow)));
    expect(Math.abs((man.achievedIrr as number) - 0.12)).toBeLessThan(1e-6);
    expect(Math.abs(man.totalCollected - 13143208.01)).toBeLessThan(0.01);
    expect(Math.abs((man.paybackYears as number) - 6.95570)).toBeLessThan(1e-4);
    expect(Math.abs((man.mirr as number) - 0.08684428)).toBeLessThan(1e-6);
  });

  it("MANUAL-UP: raising the year-4 price by 10 percent over-recovers", () => {
    const st = computeModel({ ...base(), tariff: tariff("stable") });
    const prices = st.tariffYears.map((y) => y.unitPrice as number);
    prices[1] = prices[1] * 1.10;
    const up = computeModel({ ...base(), tariff: tariff("manual", { manualPrices: prices }) });
    expect(Math.abs(up.tariffYears[1].revenue - 1891619.06)).toBeLessThan(0.01);
    expect(Math.abs((up.achievedIrr as number) - 0.12449345)).toBeLessThan(1e-6);
    expect(up.goalMet).toBe(true);
    expect(Math.abs(up.npvAtTarget - 115174.92)).toBeLessThan(0.01);
    expect(Math.abs(up.totalCollected - 13315173.38)).toBeLessThan(0.01);
  });

  it("FIXED: fixed required amount 600,000 per grid year", () => {
    const r = computeModel({ ...base(), tariff: tariff("fixed", { fixedAnnualAmount: 600000 }) });
    expect(Math.abs((r.achievedIrr as number) - -0.09762035)).toBeLessThan(1e-6);
    expect(r.goalMet).toBe(false);
    expect(Math.abs(r.npvAtTarget - -4151490.85)).toBeLessThan(0.01);
    expect(r.totalCollected).toBe(4800000);
    expect(r.netGain).toBe(-3049860);
    expect(r.paybackYears).toBeNull();
    expect(r.discountedPaybackYears).toBeNull();
    expect(Math.abs((r.profitabilityIndex as number) - 0.43548)).toBeLessThan(1e-4);
    expect(Math.abs((r.mirr as number) - -0.01952148)).toBeLessThan(1e-6);
    expect(r.signChanges).toBe(1);
    expect(Math.abs(r.npvAtWacc - -3948315.48)).toBeLessThan(0.01);
  });
});
