import { describe, expect, it } from "vitest";
import { paymentVsBalloonTermTable, paymentVsTermTargetTable, scenarioResults, tornado } from "../src/scenarios.js";
import { templateLike } from "./_shared.js";

describe("Chunk 4: scenarios and sensitivity", () => {
  it("scenario payments and headline figures; strict ordering", () => {
    const sc = scenarioResults(templateLike());
    expect(Math.abs((sc.base.paymentAmount as number) - 475309.13407)).toBeLessThan(0.01);
    expect(Math.abs((sc.optimistic.paymentAmount as number) - 356830.01861)).toBeLessThan(0.01);
    expect(Math.abs((sc.pessimistic.paymentAmount as number) - 629065.46336)).toBeLessThan(0.01);
    expect(sc.optimistic.totalCost).toBe(6999102);
    expect(sc.optimistic.paymentCount).toBe(32);
    expect(Math.abs(sc.pessimistic.totalCost - 8715762)).toBeLessThan(0.01);
    expect(sc.pessimistic.paymentCount).toBe(24);
    expect((sc.optimistic.paymentAmount as number)).toBeLessThan(sc.base.paymentAmount as number);
    expect((sc.base.paymentAmount as number)).toBeLessThan(sc.pessimistic.paymentAmount as number);
  });

  it("tornado pins", () => {
    const t = tornado(templateLike());
    const byFactor = Object.fromEntries(t.map((row) => [row.factor, row]));
    expect(Math.abs((byFactor.burn.low as number) - 427778.22067)).toBeLessThan(0.01);
    expect(Math.abs((byFactor.burn.high as number) - 522840.04748)).toBeLessThan(0.01);
    expect(Math.abs((byFactor.targetIrr.low as number) - 438284.56056)).toBeLessThan(0.01);
    expect(Math.abs((byFactor.targetIrr.high as number) - 514195.45493)).toBeLessThan(0.01);
    expect(Math.abs((byFactor.term.low as number) - 527604.05329)).toBeLessThan(0.01);
    expect(Math.abs((byFactor.term.high as number) - 436665.15094)).toBeLessThan(0.01);
    expect(Math.abs((byFactor.escalation.low as number) - 471225.82359)).toBeLessThan(0.01);
    expect(Math.abs((byFactor.escalation.high as number) - 479418.24747)).toBeLessThan(0.01);
  });

  it("two-way table: payment vs term at each target IRR (rows targets 8/12/16, cols terms 5/7/9)", () => {
    const table = paymentVsTermTargetTable(templateLike(), [5, 7, 9], [8, 12, 16]);
    expect(Math.abs((table[0][0] as number) - 525633.47627)).toBeLessThan(0.01);
    expect(Math.abs((table[2][0] as number) - 684497.45300)).toBeLessThan(0.01);
    expect(Math.abs((table[0][2] as number) - 335959.61485)).toBeLessThan(0.01);
    expect(Math.abs((table[2][2] as number) - 486535.18280)).toBeLessThan(0.01);
    expect(Math.abs((table[1][1] as number) - 475309.13407)).toBeLessThan(0.01);
  });

  it("balloon x term corners; the (1M, term 7) corner equals the chunk 3 residual pin by construction", () => {
    const table = paymentVsBalloonTermTable(templateLike(), [0, 1000000, 2000000], [5, 7, 9]);
    expect(Math.abs((table[0][0] as number) - 601755.85025)).toBeLessThan(0.01);
    expect(Math.abs((table[0][2] as number) - 528469.60680)).toBeLessThan(0.01);
    expect(Math.abs((table[2][0] as number) - 407112.13876)).toBeLessThan(0.01);
    expect(Math.abs((table[2][2] as number) - 375602.45091)).toBeLessThan(0.01);
    expect(Math.abs((table[1][1] as number) - 452235.69880)).toBeLessThan(0.01);
  });
});
