import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { applyScenario, tornado } from "../src/scenarios.js";
import { EngineInputError } from "../src/validate.js";
import { capexLump, capexProfile, fixture } from "./_aud06122.js";

// v0.6.12.2 Tasks C and D (AUD-5, AUD-6) — every figure is a directive pin at the engine's own float spelling.

describe("AUD-5: scenario burn multipliers scale per-year profiles", () => {
  const inp = () => fixture([capexProfile({ 1: 1000000 })]);
  const burn = (m: number) => ({ burnMultiplier: m, escalationShift: 0, targetShift: 0, termShift: 0 });

  it("burn x1.1 scales the profile", () => {
    expect(computeModel(inp()).paymentAmount).toBe(231904.12459892264);
    const high = computeModel(applyScenario(inp(), burn(1.1)));
    expect(high.totalCost).toBe(1000000 * 1.1);
    expect(Math.abs(high.totalCost - 1100000)).toBeLessThan(1e-6);
    expect(high.paymentAmount).toBe(255094.53705881492);
  });

  it("the tornado burn row moves", () => {
    const row = tornado(inp()).find((r) => r.factor === "burn")!;
    expect(row.low).toBe(208713.7121390304);
    expect(row.high).toBe(255094.53705881492);
  });

  it("the multiplier leaves an un-profiled line shape untouched", () => {
    const scaled = applyScenario(fixture([capexLump(1000000)]), burn(1.1));
    expect("yearOverrides" in scaled.costs[0]).toBe(false);
  });
});

describe("AUD-6: override years are validated, both categories", () => {
  const issuesOf = (inp: ReturnType<typeof fixture>): string[] => {
    try {
      computeModel(inp);
    } catch (e) {
      if (e instanceof EngineInputError) return e.issues;
      throw e;
    }
    return [];
  };

  it("capex: every offending year is named", () => {
    const inp = fixture([{ ...capexLump(1000000), yearOverrides: { 0: 100000, 2.5: 100000, "-3": 100000 } as Record<number, number> }]);
    expect(issuesOf(inp)).toEqual([
      "Cost line c1 (Capex) has an override year 0 that is not an integer of at least 1.",
      "Cost line c1 (Capex) has an override year 2.5 that is not an integer of at least 1.",
      "Cost line c1 (Capex) has an override year -3 that is not an integer of at least 1.",
    ]);
  });

  it("recurring: an in-span fractional override year refuses the same way", () => {
    const inp = fixture([{ id: "r1", name: "Run", category: "recurring", amount: 100000, startYear: 1, durationYears: 3, escalation: 0, yearOverrides: { 2.5: 100000 } as Record<number, number> }]);
    expect(issuesOf(inp)).toContain("Cost line r1 (Run) has an override year 2.5 that is not an integer of at least 1.");
  });

  it("control: a whole override year computes byte-identically to the lump", () => {
    const lump = computeModel(fixture([capexLump(100000)]));
    const prof = computeModel(fixture([{ ...capexLump(1000000), yearOverrides: { 1: 100000 } }]));
    expect(prof.totalCost).toBe(100000);
    expect(prof.totalCost).toBe(lump.totalCost);
    expect(prof.paymentAmount).toBe(lump.paymentAmount);
  });
});
