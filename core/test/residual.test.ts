import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { appraisal, templateLike } from "./_shared.js";

describe("Chunk 3: residual value on the collections side", () => {
  it("residual 1,000,000 at year 10: full pin set", () => {
    const r = computeModel({ ...templateLike(), appraisal: appraisal(8, 6, 6, 1000000, 10) });
    expect(Math.abs((r.paymentAmount as number) - 452235.69880)).toBeLessThan(0.01);
    expect(Math.abs(r.costNpv - 6632597.98344)).toBeLessThan(0.01);
    expect(r.totalCost).toBe(7849860);
    expect(Math.abs(r.totalCollected - 13662599.56638)).toBeLessThan(0.01);
    expect(Math.abs(r.netGain - 5812739.56638)).toBeLessThan(0.01);
    expect(Math.abs((r.paybackYears as number) - 7.19649)).toBeLessThan(1e-4);
    expect(Math.abs(r.npvAtWacc - 1315678.91981)).toBeLessThan(0.01);
    expect(Math.abs((r.profitabilityIndex as number) - 1.18811)).toBeLessThan(1e-4);
    expect(Math.abs((r.mirr as number) - 0.08887759)).toBeLessThan(1e-6);
    expect(Math.abs((r.discountedPaybackYears as number) - 8.92657)).toBeLessThan(1e-4);
    expect(Math.abs((r.achievedIrr as number) - 0.12)).toBeLessThan(1e-9);
    expect(r.goalMet).toBe(true);
    expect(r.monthly.length).toBe(120);
  });

  it("residual zero is JSON-identical to the absent block (schema backward compatibility)", () => {
    const withZero = computeModel({ ...templateLike(), appraisal: appraisal(8, 6, 6, 0, 10) });
    const absent = computeModel(templateLike());
    expect(JSON.stringify(withZero)).toBe(JSON.stringify(absent));
  });

  it("residual 2,000,000 at year 1: the constructed ambiguity case — payment 347,340.22763, signChanges 3, irrAmbiguous true, achievedIrr 0.12", () => {
    const r = computeModel({ ...templateLike(), appraisal: appraisal(8, 6, 6, 2000000, 1) });
    expect(Math.abs((r.paymentAmount as number) - 347340.22763)).toBeLessThan(0.01);
    expect(r.signChanges).toBe(3);
    expect(r.irrAmbiguous).toBe(true);
    expect(Math.abs((r.achievedIrr as number) - 0.12)).toBeLessThan(1e-9);
  });

  it("directional: a larger residual strictly lowers the solved payment at positive target rates", () => {
    const small = computeModel({ ...templateLike(), appraisal: appraisal(8, 6, 6, 1000000, 10) }).paymentAmount as number;
    const large = computeModel({ ...templateLike(), appraisal: appraisal(8, 6, 6, 2000000, 10) }).paymentAmount as number;
    expect(large).toBeLessThan(small);
  });
});
