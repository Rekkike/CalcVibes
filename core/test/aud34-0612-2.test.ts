import { describe, expect, it } from "vitest";
import { computeModel, solveTerm } from "../src/engine.js";
import { EngineInputError } from "../src/validate.js";
import type { OperatingLine } from "../src/types.js";
import { capexLump, capexProfile, fixture } from "./_aud06122.js";

// v0.6.12.2 Tasks A and B (AUD-3, AUD-4) — every figure is a directive pin at the engine's own float spelling.

describe("AUD-3: the maintenance basis honors per-year profiles", () => {
  const maint = { mode: "percent" as const, percentPerYear: 1 };
  const profile = () => fixture([capexProfile({ 1: 400000, 2: 600000 })], { maintenance: maint });
  const lump = () => fixture([capexLump(1000000)], { maintenance: maint });
  const maintenanceOf = (r: ReturnType<typeof computeModel>) => r.operatingLines.find((o) => o.id === "maintenance")!;

  it("profile fixture", () => {
    const r = computeModel(profile());
    const m = maintenanceOf(r);
    expect(m.total).toBe(40833.333333333336);
    expect(m.effectiveWindow).toEqual([24, 72]);
    expect(m.basis).toBe(1000000);
    expect(r.costNpv).toBe(914910.9861812554);
    expect(r.paymentAmount).toBe(247476.9907906614);
  });

  it("lump twin control", () => {
    const r = computeModel(lump());
    const m = maintenanceOf(r);
    expect(m.total).toBe(40833.333333333336);
    expect(m.effectiveWindow).toEqual([12, 60]);
    expect(m.basis).toBe(1000000);
    expect(r.costNpv).toBe(958474.235446126);
    expect(r.paymentAmount).toBe(240056.0588034959);
  });

  it("Mode B at the Mode A payment returns 5 payments", () => {
    const inp = profile();
    const a = computeModel(inp);
    expect(solveTerm(inp, a.paymentAmount as number).paymentCount).toBe(5);
  });
});

describe("AUD-4: the operating and maintenance window follows the actual collection span", () => {
  const op = (yearCount: number): OperatingLine => ({ id: "o1", label: "Op", amount: 1000, startYear: 1, yearCount, escalation: 0 });
  const profileFx = (o: OperatingLine) =>
    fixture([capexLump(1000000)], { repayment: { termYears: 1, collectionsOverrides: { 4: 100, 5: 100, 6: 100, 7: 100 } }, operatingLines: [o] });

  it("profile mode", () => {
    const r = computeModel(profileFx(op(10)));
    const o = r.operatingLines.find((x) => x.id === "o1")!;
    expect(o.effectiveWindow).toEqual([37, 84]);
    expect(o.total).toBe(4000.0000000000027);
  });

  it("contracts mode", () => {
    const inp = fixture([capexLump(10000000)], {
      repayment: { termYears: 3 },
      contracts: [{ id: "k1", label: "K", startYear: 2, termYears: 16, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" }],
      operatingLines: [{ ...op(20) }],
    });
    const r = computeModel(inp);
    const o = r.operatingLines.find((x) => x.id === "o1")!;
    expect(o.effectiveWindow).toEqual([24, 204]);
    expect(o.total).toBe(15083.333333333372);
    expect(r.paymentAmount).toBe(1130705.203884517);
  });

  it("the refusal names the true window", () => {
    const early: OperatingLine = { id: "o1", label: "Op", amount: 1000, startYear: 3, yearCount: 1, escalation: 0 };
    expect(() => computeModel(profileFx(early))).toThrow(EngineInputError);
    try {
      computeModel(profileFx(early));
    } catch (e) {
      expect((e as EngineInputError).issues).toEqual(["Operating line o1 (Op) falls entirely outside the collection window [37, 84]."]);
    }
  });
});
