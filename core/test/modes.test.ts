import { describe, expect, it } from "vitest";
import { computeModel, solveTerm } from "../src/engine.js";
import { templateLike } from "./_shared.js";

describe("Chunk 2: Modes B and C", () => {
  it("Mode B, P = 400,000: 38 payments, term 9.5, last payment month 147, horizon 150", () => {
    const b = solveTerm(templateLike(), 400000);
    expect(b.paymentCount).toBe(38);
    expect(b.termYears).toBe(9.5);
    expect(b.lastPaymentMonth).toBe(147);
    expect(b.result.monthly.length).toBe(150);
  });

  it("Mode B, P = 400,000: over-solve npvAtTarget 86,602.34032; achievedIrr 0.12272650; goalMet true", () => {
    const b = solveTerm(templateLike(), 400000);
    expect(Math.abs(b.result.npvAtTarget - 86602.34032)).toBeLessThan(0.01);
    expect(Math.abs((b.result.achievedIrr as number) - 0.12272650)).toBeLessThan(1e-6);
    expect(b.result.goalMet).toBe(true);
  });

  it("Mode B minimality: 37 payments leave the stream short of costNpv by 13,199.65259", () => {
    const target = 12;
    const rM = Math.pow(1 + target / 100, 1 / 12) - 1;
    let dfSum = 0;
    for (let k = 0; k < 37; k++) dfSum += 400000 / Math.pow(1 + rM, 36 + k * 3);
    const costNpv = computeModel(templateLike()).costNpv;
    const shortfall = costNpv - dfSum;
    expect(shortfall).toBeGreaterThan(0);
    expect(Math.abs(shortfall - 13199.65259)).toBeLessThan(0.01);
  });

  it("Mode B, P = 1,000: infeasible, null with surfaced explanation (max discounted value 25,480.26)", () => {
    const b = solveTerm(templateLike(), 1000);
    expect(b.paymentCount).toBeNull();
    expect(b.termYears).toBeNull();
    expect(b.lastPaymentMonth).toBeNull();
    expect(b.shortfall).not.toBeNull();
    expect((b.shortfall as number) > 0).toBe(true);
    const maxStream = 6632597.98343582 - (b.shortfall as number);
    expect(Math.abs(maxStream - 25480.26)).toBeLessThan(0.01);
  });

  it("Mode C, P = 400,000, term 7: npvAtTarget -1,050,884.93990; achievedIrr 0.07818471; goalMet false", () => {
    const c = computeModel(templateLike(), { fixedPayment: 400000 });
    expect(c.paymentCount).toBe(28);
    expect(Math.abs(c.npvAtTarget - -1050884.93990)).toBeLessThan(0.01);
    expect(Math.abs((c.achievedIrr as number) - 0.07818471)).toBeLessThan(1e-6);
    expect(c.goalMet).toBe(false);
  });

  it("directional: below the Mode A payment, Mode C IRR is strictly below target; Mode B IRR is at least the target", () => {
    const modeA = computeModel(templateLike()).paymentAmount;
    const c = computeModel(templateLike(), { fixedPayment: modeA * 0.9 });
    expect((c.achievedIrr as number)).toBeLessThan(0.12);
    const b = solveTerm(templateLike(), modeA * 0.9);
    expect((b.result.achievedIrr as number)).toBeGreaterThanOrEqual(0.12 - 1e-9);
  });
});
