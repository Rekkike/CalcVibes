import { describe, expect, it } from "vitest";
import { computeModel } from "../../core/src/engine.js";
import type { ModelInputs } from "../../core/src/types.js";
import { demoProject, landNewbuildProject, multiLeaseProject, shorePowerProject, shorePowerProgram, solarParkProject } from "../src/state.js";

// v0.6.15 Task E — the authored demo group labels are additive-only: each fixture as shipped equals
// the fixture with the field stripped, and its engine output is byte-identical (the group field is
// engine-blind). The golden template and the other fixtures carry none.
const strip = (inp: ModelInputs): ModelInputs => ({ ...inp, costs: inp.costs.map((c) => { const { group: _g, ...rest } = c; return rest; }) });

describe("the authored demo group sets", () => {
  it("shorePowerProgram: Container shore power (p1, p2, p3), Market pillar (p4), Cruise terminal (p5), Inland & public berths (p6)", () => {
    expect(shorePowerProgram().costs.map((c) => [c.id, c.group])).toEqual([
      ["p1", "Container shore power"], ["p2", "Container shore power"], ["p3", "Container shore power"],
      ["p4", "Market pillar"], ["p5", "Cruise terminal"], ["p6", "Inland & public berths"],
    ]);
  });
  it("landNewbuildProject: Site (c1), Building (c2, c3)", () => {
    expect(landNewbuildProject().costs.map((c) => [c.id, c.group])).toEqual([["c1", "Site"], ["c2", "Building"], ["c3", "Building"]]);
  });
  it("the golden template and the other fixtures carry no group", () => {
    for (const mk of [demoProject, multiLeaseProject, solarParkProject, shorePowerProject]) {
      expect(mk().costs.some((c) => c.group !== undefined)).toBe(false);
    }
  });
  it("the shipped fixtures equal themselves with the field stripped, field aside, and compute byte-identically", () => {
    for (const mk of [shorePowerProgram, landNewbuildProject]) {
      const shipped = mk();
      const bare = strip(shipped);
      expect(JSON.stringify(computeModel(shipped))).toBe(JSON.stringify(computeModel(bare)));
      expect(JSON.stringify(strip(shipped))).toBe(JSON.stringify(bare));
      expect(shipped.costs.every((c) => c.group !== undefined)).toBe(true);
      expect(bare.costs.some((c) => "group" in c)).toBe(false);
    }
  });
});
