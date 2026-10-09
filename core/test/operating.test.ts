import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { EngineInputError } from "../src/validate.js";
import { appraisal, templateLike } from "./_shared.js";

const base = () => ({ ...templateLike(), appraisal: appraisal() });

describe("CP-0 byte identity", () => {
  it("empty operating lines, maintenance off, no override reproduce v0.3 outputs JSON-identically", () => {
    const a = computeModel(base());
    const b = computeModel({ ...base(), operatingLines: [], maintenance: { mode: "off" } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.signChanges).toBe(1);
    expect(a.firstPaymentMonth).toBe(36);
    expect(a.monthly.length).toBe(120);
  });
});

describe("CP-1 operating lines and maintenance", () => {
  it("MAINT (percent 0.5 of CAPEX): full pin set (headline re-anchored per v0.6.1 0.2: the yearly-aggregated root, the monthly flow non-conventional)", () => {
    const r = computeModel({ ...base(), maintenance: { mode: "percent", percentPerYear: 0.5 } });
    expect(Math.abs((r.paymentAmount as number) - 475857.58728)).toBeLessThan(0.01);
    expect(r.totalCost).toBe(7865235);
    expect(r.operatingTotal).toBe(15375);
    expect(Math.abs(r.totalCollected - 13324012.44394)).toBeLessThan(0.01);
    expect(Math.abs(r.netGain - 5458777.44394)).toBeLessThan(0.01);
    expect(Math.abs((r.paybackYears as number) - 6.95961)).toBeLessThan(1e-4);
    expect(Math.abs(r.npvAtWacc - 1252816.91198)).toBeLessThan(0.01);
    expect(Math.abs((r.profitabilityIndex as number) - 1.17888)).toBeLessThan(1e-4);
    expect(Math.abs((r.discountedPaybackYears as number) - 8.47095)).toBeLessThan(1e-4);
    expect(Math.abs((r.mirr as number) - 0.08754387)).toBeLessThan(1e-6);
    expect(Math.abs((r.achievedIrr as number) - 0.12190173489659561)).toBeLessThan(1e-9);
    expect(r.goalMet).toBe(true);
    expect(r.signChanges).toBe(55);
    expect(r.irrAmbiguous).toBe(true);
    expect(r.firstPaymentMonth).toBe(36);
    expect(r.monthly.length).toBe(120);
    expect(r.operatingLines[0].effectiveWindow).toEqual([36, 117]);
    expect(r.operatingLines[0].total).toBe(15375);
  });

  it("MAINT+RENT (rent 120,000/yr years 3-10): full pin set (headline re-anchored per v0.6.1 0.2)", () => {
    const r = computeModel({ ...base(), maintenance: { mode: "percent", percentPerYear: 0.5 }, operatingLines: [{ id: "o1", label: "Rent", amount: 120000, startYear: 3, yearCount: 8, escalation: 0 }] });
    expect(Math.abs((r.paymentAmount as number) - 505108.42510)).toBeLessThan(0.01);
    expect(r.totalCost).toBe(8685235);
    expect(r.operatingTotal).toBe(835375);
    expect(Math.abs(r.totalCollected - 14143035.90267)).toBeLessThan(0.01);
    expect(Math.abs(r.netGain - 5457800.90267)).toBeLessThan(0.01);
    expect(Math.abs((r.paybackYears as number) - 6.95996)).toBeLessThan(1e-4);
    expect(Math.abs(r.npvAtWacc - 1252492.50276)).toBeLessThan(0.01);
    expect(Math.abs((r.profitabilityIndex as number) - 1.16674)).toBeLessThan(1e-4);
    expect(Math.abs((r.discountedPaybackYears as number) - 8.47143)).toBeLessThan(1e-4);
    expect(Math.abs((r.mirr as number) - 0.08628425)).toBeLessThan(1e-6);
    expect(Math.abs((r.achievedIrr as number) - 0.12207423730225236)).toBeLessThan(1e-9);
    expect(r.signChanges).toBe(55);
    expect(r.firstPaymentMonth).toBe(36);
    const rent2 = r.operatingLines.find((o) => o.id === "o1");
    const maint2 = r.operatingLines.find((o) => o.id === "maintenance");
    expect(rent2 && rent2.nominalSpan).toEqual([25, 120]);
    expect(rent2 && rent2.effectiveWindow).toEqual([36, 117]);
    expect(rent2 && rent2.total).toBe(820000);
    expect(maint2 && maint2.total).toBe(15375);
  });

  it("MAINT-FIXED (5,000/yr): pins (headline re-anchored per v0.6.1 0.2)", () => {
    const r = computeModel({ ...base(), maintenance: { mode: "fixed", fixedAnnualAmount: 5000 } });
    expect(Math.abs((r.paymentAmount as number) - 476527.91898)).toBeLessThan(0.01);
    expect(Math.abs(r.totalCost - 7884026.66667)).toBeLessThan(0.01);
    expect(Math.abs(r.operatingTotal - 34166.66667)).toBeLessThan(0.01);
    expect(Math.abs((r.achievedIrr as number) - 0.12190568237532207)).toBeLessThan(1e-9);
    expect(r.signChanges).toBe(55);
    expect(r.irrAmbiguous).toBe(true);
  });

  it("directional: operating cost raises the solved payment; a further line raises it further; the start never moves", () => {
    const plain = computeModel(base()).paymentAmount as number;
    const maint = computeModel({ ...base(), maintenance: { mode: "percent", percentPerYear: 0.5 } });
    const rent = computeModel({ ...base(), maintenance: { mode: "percent", percentPerYear: 0.5 }, operatingLines: [{ id: "o1", label: "Rent", amount: 120000, startYear: 3, yearCount: 8, escalation: 0 }] });
    expect((maint.paymentAmount as number)).toBeGreaterThan(plain as number);
    expect((rent.paymentAmount as number)).toBeGreaterThan(maint.paymentAmount as number);
    expect(maint.firstPaymentMonth).toBe(36);
    expect(rent.firstPaymentMonth).toBe(36);
  });

  it("solver identity holds in every solved operating case", () => {
    const cases = [
      computeModel({ ...base(), maintenance: { mode: "percent", percentPerYear: 0.5 } }),
      computeModel({ ...base(), maintenance: { mode: "percent", percentPerYear: 0.5 }, operatingLines: [{ id: "o1", label: "Rent", amount: 120000, startYear: 3, yearCount: 8, escalation: 0 }] }),
      computeModel({ ...base(), maintenance: { mode: "fixed", fixedAnnualAmount: 5000 } }),
    ];
    for (const r of cases) expect(Math.abs(r.npvAtTarget)).toBeLessThan(1e-6);
  });
});

describe("CP-4 validation additions", () => {
  it("negative maintenance percent or fixed amount errors", () => {
    expect(() => computeModel({ ...base(), maintenance: { mode: "percent", percentPerYear: -1 } })).toThrowError(EngineInputError);
    expect(() => computeModel({ ...base(), maintenance: { mode: "fixed", fixedAnnualAmount: -1 } })).toThrowError(EngineInputError);
  });

  it("an operating line entirely outside the collection window errors, naming the line and the window", () => {
    expect(() => computeModel({ ...base(), operatingLines: [{ id: "o1", label: "Rent", amount: 120000, startYear: 1, yearCount: 2, escalation: 0 }] })).toThrowError(/o1.*window \[36, 117\]/);
  });

  it("operating line shape violations reuse the recurring-line rules", () => {
    expect(() => computeModel({ ...base(), operatingLines: [{ id: "o1", label: "", amount: 120000, startYear: 3, yearCount: 8, escalation: 0 }] })).toThrowError(EngineInputError);
    expect(() => computeModel({ ...base(), operatingLines: [{ id: "o1", label: "Rent", amount: 0, startYear: 3, yearCount: 8, escalation: 0 }] })).toThrowError(EngineInputError);
    expect(() => computeModel({ ...base(), operatingLines: [{ id: "o1", label: "Rent", amount: 120000, startYear: 1.5, yearCount: 8, escalation: 0 }] })).toThrowError(EngineInputError);
  });
});
