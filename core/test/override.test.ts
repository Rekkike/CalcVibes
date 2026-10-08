import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { EngineInputError } from "../src/validate.js";
import { appraisal, templateLike } from "./_shared.js";

const base = () => ({ ...templateLike(), appraisal: appraisal() });

describe("CP-2 repayment start override", () => {
  it("OVR2 (firstCollectionYear 2): full pin set", () => {
    const r = computeModel({ ...base(), repayment: { ...base().repayment, firstCollectionYear: 2 } });
    expect(Math.abs((r.paymentAmount as number) - 424383.15542)).toBeLessThan(0.01);
    expect(Math.abs(r.npvAtTarget)).toBeLessThan(1e-6);
    expect(Math.abs(r.totalCollected - 11882728.35187)).toBeLessThan(0.01);
    expect(Math.abs(r.netGain - 4032868.35187)).toBeLessThan(0.01);
    expect(Math.abs((r.paybackYears as number) - 6.45809)).toBeLessThan(1e-4);
    expect(Math.abs(r.npvAtWacc - 958291.18149)).toBeLessThan(0.01);
    expect(Math.abs((r.profitabilityIndex as number) - 1.13701)).toBeLessThan(1e-4);
    expect(Math.abs((r.discountedPaybackYears as number) - 7.72609)).toBeLessThan(1e-4);
    expect(Math.abs((r.mirr as number) - 0.08641195)).toBeLessThan(1e-6);
    expect(Math.abs((r.achievedIrr as number) - 0.12)).toBeLessThan(1e-6);
    expect(r.goalMet).toBe(true);
    expect(r.signChanges).toBe(9);
    expect(r.irrAmbiguous).toBe(true);
    expect(r.firstPaymentMonth).toBe(24);
    expect(r.lastPaymentMonth).toBe(105);
    expect(r.monthly.length).toBe(108);
  });

  it("OVR2+MAINT: full pin set; the maintenance window recomputes to the actual start", () => {
    const r = computeModel({ ...base(), repayment: { ...base().repayment, firstCollectionYear: 2 }, maintenance: { mode: "percent", percentPerYear: 0.5 } });
    expect(Math.abs((r.paymentAmount as number) - 424931.60863)).toBeLessThan(0.01);
    expect(r.totalCost).toBe(7865235);
    expect(r.operatingTotal).toBe(15375);
    expect(Math.abs(r.totalCollected - 11898085.04172)).toBeLessThan(0.01);
    expect(Math.abs(r.netGain - 4032850.04172)).toBeLessThan(0.01);
    expect(Math.abs((r.paybackYears as number) - 6.45811)).toBeLessThan(1e-4);
    expect(Math.abs(r.npvAtWacc - 958284.61221)).toBeLessThan(0.01);
    expect(Math.abs((r.profitabilityIndex as number) - 1.13681)).toBeLessThan(1e-4);
    expect(Math.abs((r.discountedPaybackYears as number) - 7.72610)).toBeLessThan(1e-4);
    expect(Math.abs((r.mirr as number) - 0.08638338)).toBeLessThan(1e-6);
    expect(Math.abs((r.achievedIrr as number) - 0.12)).toBeLessThan(1e-6);
    expect(r.signChanges).toBe(55);
    expect(r.firstPaymentMonth).toBe(24);
    expect(r.operatingLines[0].effectiveWindow).toEqual([24, 105]);
  });

  it("directional: an earlier start lowers the solved payment", () => {
    const ovr = computeModel({ ...base(), repayment: { ...base().repayment, firstCollectionYear: 2 } }).paymentAmount as number;
    const derived = computeModel(base()).paymentAmount as number;
    expect(ovr).toBeLessThan(derived);
  });

  it("validation: override with grace > 0 errors; non-integer or < 1 errors", () => {
    expect(() => computeModel({ ...base(), repayment: { ...base().repayment, firstCollectionYear: 2, graceYears: 1 } })).toThrowError(/grace must be zero/);
    expect(() => computeModel({ ...base(), repayment: { ...base().repayment, firstCollectionYear: 1.5 } })).toThrowError(EngineInputError);
    expect(() => computeModel({ ...base(), repayment: { ...base().repayment, firstCollectionYear: 0 } })).toThrowError(EngineInputError);
  });
});
