import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { EngineInputError } from "../src/validate.js";
import { appraisal, templateLike } from "./_shared.js";

describe("Chunk 1: appraisal metrics (template, defaults)", () => {
  it("npvAtTarget is the solver identity: |value| < 1e-6", () => {
    const r = computeModel({ ...templateLike(), appraisal: appraisal() });
    expect(Math.abs(r.npvAtTarget)).toBeLessThan(1e-6);
  });

  it("npvAtWacc, sides, and profitabilityIndex", () => {
    const r = computeModel({ ...templateLike(), appraisal: appraisal() });
    expect(Math.abs(r.npvAtWacc - 1252822.99465)).toBeLessThan(0.01);
    expect(Math.abs(r.npvCollectionsAtWacc - 8246890.76844)).toBeLessThan(0.01);
    expect(Math.abs(r.npvCostsAtWacc - 6994067.77379)).toBeLessThan(0.01);
    expect(Math.abs((r.profitabilityIndex as number) - 1.17913)).toBeLessThan(1e-4);
  });

  it("discountedPaybackYears, mirr, goalMet", () => {
    const r = computeModel({ ...templateLike(), appraisal: appraisal() });
    expect(Math.abs((r.discountedPaybackYears as number) - 8.47094)).toBeLessThan(1e-4);
    expect(Math.abs((r.mirr as number) - 0.08756864)).toBeLessThan(1e-6);
    expect(r.goalMet).toBe(true);
  });

  it("WACC 0: discounted payback equals nominal payback; npvAtWacc equals netGain", () => {
    const r = computeModel({ ...templateLike(), appraisal: appraisal(0) });
    expect(r.discountedPaybackYears).toBe(r.paybackYears);
    expect(Math.abs((r.paybackYears as number) - 6.95961)).toBeLessThan(1e-4);
    expect(Math.abs(r.npvAtWacc - 5458795.75409)).toBeLessThan(0.01);
    expect(Math.abs((r.profitabilityIndex as number) - 1.69540)).toBeLessThan(1e-4);
  });

  it("WACC 60: negative npvAtWacc, PI below 1, no discounted payback", () => {
    const r = computeModel({ ...templateLike(), appraisal: appraisal(60) });
    expect(Math.abs(r.npvAtWacc - -3131265.69562)).toBeLessThan(0.01);
    expect(Math.abs((r.profitabilityIndex as number) - 0.24348)).toBeLessThan(1e-4);
    expect(r.discountedPaybackYears).toBeNull();
  });

  it("finance 6, reinvest 12: mirr 0.11122421", () => {
    const r = computeModel({ ...templateLike(), appraisal: appraisal(8, 6, 12) });
    expect(Math.abs((r.mirr as number) - 0.11122421)).toBeLessThan(1e-6);
  });

  it("degenerate blank project: zeros and nulls, no crash", () => {
    const r = computeModel({ ...templateLike(), costs: [], appraisal: appraisal() });
    expect(r.npvAtWacc).toBe(0);
    expect(r.profitabilityIndex).toBeNull();
    expect(r.mirr).toBeNull();
    expect(r.discountedPaybackYears).toBeNull();
    expect(r.goalMet).toBe(false);
  });

  it("identity: npvAtWacc = npvCollectionsAtWacc - npvCostsAtWacc within 1e-6", () => {
    const cases = [
      appraisal(), appraisal(0), appraisal(60), appraisal(8, 6, 12),
      appraisal(8, 6, 6, 1000000, 10), appraisal(8, 6, 6, 2000000, 1),
    ];
    for (const a of cases) {
      const r = computeModel({ ...templateLike(), appraisal: a });
      expect(Math.abs(r.npvAtWacc - (r.npvCollectionsAtWacc - r.npvCostsAtWacc))).toBeLessThan(1e-6);
    }
  });

  it("absent appraisal block reproduces current behavior exactly (JSON equality with defaults block)", () => {
    const without = computeModel(templateLike());
    const withDefaults = computeModel({ ...templateLike(), appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } } });
    expect(JSON.stringify(without)).toBe(JSON.stringify(withDefaults));
  });

  it("validation: WACC, finance, reinvestment must exceed -100; residual rules; surfaced, not silent", () => {
    expect(() => computeModel({ ...templateLike(), appraisal: appraisal(-100) })).toThrowError(EngineInputError);
    expect(() => computeModel({ ...templateLike(), appraisal: appraisal(8, -100, 6) })).toThrowError(EngineInputError);
    expect(() => computeModel({ ...templateLike(), appraisal: appraisal(8, 6, -100) })).toThrowError(EngineInputError);
    expect(() => computeModel({ ...templateLike(), appraisal: appraisal(8, 6, 6, -1, 10) })).toThrowError(EngineInputError);
    expect(() => computeModel({ ...templateLike(), appraisal: appraisal(8, 6, 6, 1000000, 1.5) })).toThrowError(EngineInputError);
  });

  it("balloon whose discounted value reaches costNpv is a surfaced input error; 20,000,000 is not", () => {
    expect(() => computeModel({ ...templateLike(), repayment: { ...templateLike().repayment, balloon: 21000000 } })).toThrowError(EngineInputError);
    const ok = computeModel({ ...templateLike(), repayment: { ...templateLike().repayment, balloon: 20000000 } });
    expect(Math.abs((ok.paymentAmount as number) - 13840.43)).toBeLessThan(0.01);
  });
});
