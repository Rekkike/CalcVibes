import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { appraisal, templateLike } from "./_shared.js";

const base = () => ({ ...templateLike(), appraisal: appraisal() });

describe("CP-3 indexation (existing paymentEscalation math under its new label)", () => {
  it("IDXP1 (1%): payment 463,304.87437; achievedIrr 0.12; signChanges 1", () => {
    const r = computeModel({ ...base(), repayment: { ...base().repayment, paymentEscalation: 1 } });
    expect(Math.abs(r.paymentAmount - 463304.87437)).toBeLessThan(0.01);
    expect(Math.abs((r.achievedIrr as number) - 0.12)).toBeLessThan(1e-6);
    expect(r.goalMet).toBe(true);
    expect(r.signChanges).toBe(1);
  });

  it("IDXP2 (2%): full pin set", () => {
    const r = computeModel({ ...base(), repayment: { ...base().repayment, paymentEscalation: 2 } });
    expect(Math.abs(r.paymentAmount - 451546.01368)).toBeLessThan(0.01);
    expect(Math.abs(r.totalCollected - 13427684.10357)).toBeLessThan(0.01);
    expect(Math.abs((r.paybackYears as number) - 6.98580)).toBeLessThan(1e-4);
    expect(Math.abs(r.npvAtWacc - 1276179.49235)).toBeLessThan(0.01);
    expect(Math.abs((r.profitabilityIndex as number) - 1.18247)).toBeLessThan(1e-4);
    expect(Math.abs((r.discountedPaybackYears as number) - 8.48935)).toBeLessThan(1e-4);
    expect(Math.abs((r.mirr as number) - 0.08804512)).toBeLessThan(1e-6);
    expect(Math.abs((r.achievedIrr as number) - 0.12)).toBeLessThan(1e-6);
    expect(r.goalMet).toBe(true);
    expect(r.signChanges).toBe(1);
    expect(Math.abs(r.npvAtTarget)).toBeLessThan(1e-6);
  });

  it("directional: higher indexation lowers the initial payment", () => {
    const p0 = computeModel(base()).paymentAmount;
    const p1 = computeModel({ ...base(), repayment: { ...base().repayment, paymentEscalation: 1 } }).paymentAmount;
    const p2 = computeModel({ ...base(), repayment: { ...base().repayment, paymentEscalation: 2 } }).paymentAmount;
    expect(p0).toBeGreaterThan(p1);
    expect(p1).toBeGreaterThan(p2);
  });
});
