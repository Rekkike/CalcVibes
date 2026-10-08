import { describe, expect, it } from "vitest";
import { solveTerm } from "../src/engine.js";
import { appraisal, templateLike } from "./_shared.js";

const base = () => ({ ...templateLike(), appraisal: appraisal() });

describe("CP-1 Mode B operating basis", () => {
  it("MB0 regression anchor: no operating lines, byte-identical v0.3 pins", () => {
    const b = solveTerm(base(), 400000);
    expect(b.paymentCount).toBe(38);
    expect(b.termYears).toBe(9.5);
    expect(b.lastPaymentMonth).toBe(147);
    expect(Math.abs((b.result.achievedIrr as number) - 0.12272649)).toBeLessThan(1e-6);
    expect(b.result.goalMet).toBe(true);
    const rM = Math.pow(1.12, 1 / 12) - 1;
    let dfSum = 0;
    for (let k = 0; k < 37; k++) dfSum += 400000 / Math.pow(1 + rM, 36 + k * 3);
    const shortfall = computeCostNpv(base()) - dfSum;
    expect(Math.abs(shortfall - 13199.65)).toBeLessThan(0.01);
  });

  it("MB-MINT: maintenance in the basis", () => {
    const b = solveTerm({ ...base(), maintenance: { mode: "percent", percentPerYear: 0.5 } }, 400000);
    expect(b.paymentCount).toBe(38);
    expect(b.termYears).toBe(9.5);
    expect(b.lastPaymentMonth).toBe(147);
    expect(Math.abs(b.result.costNpv - 6641866.07220)).toBeLessThan(0.01);
    expect(b.result.operatingTotal).toBe(21000);
    expect(b.result.operatingLines[0].effectiveWindow).toEqual([36, 147]);
    expect(Math.abs((b.result.achievedIrr as number) - 0.12243572)).toBeLessThan(1e-6);
    expect(b.result.goalMet).toBe(true);
    expect(b.result.signChanges).toBe(75);
    expect(b.result.irrAmbiguous).toBe(true);
    expect(b.result.firstPaymentMonth).toBe(36);
    const rM = Math.pow(1.12, 1 / 12) - 1;
    let dfSum = 0;
    for (let k = 0; k < 37; k++) dfSum += 400000 / Math.pow(1 + rM, 36 + k * 3);
    expect(Math.abs(b.result.costNpv - dfSum - 22467.74)).toBeLessThan(0.01);
  });

  it("MB-FLIP: the case that proves the basis matters", () => {
    const without = solveTerm(base(), 394900);
    expect(without.paymentCount).toBe(38);
    expect(without.termYears).toBe(9.5);
    expect(without.lastPaymentMonth).toBe(147);
    expect(Math.abs((without.result.achievedIrr as number) - 0.12002947)).toBeLessThan(1e-6);
    expect(without.result.goalMet).toBe(true);

    const withM = solveTerm({ ...base(), maintenance: { mode: "percent", percentPerYear: 0.5 } }, 394900);
    expect(withM.paymentCount).toBe(39);
    expect(withM.termYears).toBe(9.75);
    expect(withM.lastPaymentMonth).toBe(150);
    expect(withM.result.operatingLines[0].effectiveWindow).toEqual([36, 150]);
    expect(withM.result.operatingTotal).toBe(21562.50);
    expect(Math.abs(withM.result.costNpv - 6642003.79684)).toBeLessThan(0.01);
    expect(Math.abs((withM.result.achievedIrr as number) - 0.12270738)).toBeLessThan(1e-6);
    expect(withM.result.goalMet).toBe(true);
    expect(withM.result.signChanges).toBe(77);
    expect(withM.result.irrAmbiguous).toBe(true);
    const rM = Math.pow(1.12, 1 / 12) - 1;
    let dfSum = 0;
    for (let k = 0; k < 38; k++) dfSum += 394900 / Math.pow(1 + rM, 36 + k * 3);
    expect(Math.abs(withM.result.costNpv - dfSum - 8473.28)).toBeLessThan(0.01);
  });

  it("directional: the required count with maintenance exceeds the count without at the same price", () => {
    const withM = solveTerm({ ...base(), maintenance: { mode: "percent", percentPerYear: 0.5 } }, 394900);
    const without = solveTerm(base(), 394900);
    expect((withM.paymentCount as number)).toBeGreaterThan(without.paymentCount as number);
  });
});

function computeCostNpv(inp: { costs: { category: string; amount: number; startYear: number; durationYears: number; escalation: number }[] }): number {
  const rM = Math.pow(1.12, 1 / 12) - 1;
  let costNpv = 0;
  const totalMonths = 36;
  const costM = new Array<number>(totalMonths).fill(0);
  inp.costs.forEach((c) => {
    if (c.category === "capex") {
      costM[11] += c.amount;
    } else {
      const dur = Math.max(1, c.durationYears);
      for (let y = c.startYear; y < c.startYear + dur; y++) {
        const esc2 = Math.pow(1 + c.escalation / 100, y - c.startYear);
        const monthly = (c.amount * esc2) / 12;
        for (let mm = (y - 1) * 12 + 1; mm <= y * 12 && mm <= totalMonths; mm++) costM[mm - 1] += monthly;
      }
    }
  });
  for (let i = 0; i < totalMonths; i++) costNpv += costM[i] / Math.pow(1 + rM, i + 1);
  return costNpv;
}
