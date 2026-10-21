// v0.6.13.1 Chunk 0: the byte-identity lock. The timeline block is engine-blind: computeModel's
// output is byte-identical (JSON.stringify equality) with the block present and absent, on the
// golden template and both demo fixtures. Asserted before any work and re-asserted at completion
// (after the demo fixtures gain their authored timelines, the as-shipped fixtures are compared
// with the block stripped).
import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { demoProject, landNewbuildProject, shorePowerProgram } from "../src/state.js";
import type { ModelInputs, TimelineBlock } from "../../core/src/types.js";

const synthetic = (): TimelineBlock => ({
  projectScale: "full",
  // v0.6.13.2: the carried fields (phase vocabulary, lane visibility, source markers) are inert too.
  phases: [{ id: "prestudy", label: "Prestudy" }, { id: "production", label: "Production" }, { id: "extra", label: "Extra" }],
  laneVisibility: { extra: true, prestudy: false },
  activities: [
    { id: "a1", label: "Study", startYear: 1, endYear: 2, phase: "prestudy" },
    { id: "a2", label: "Build", startYear: 2, endYear: 4, phase: "production", derivedFrom: "cost-program" },
  ],
  decisionPoints: [{ id: "d1", title: "Start", year: 1, code: "BP1", outcome: "continue" }],
  milestones: [{ id: "m1", label: "Done", year: 4, tie: { kind: "engine-event", event: "construction-complete" } }],
});
const without = (inp: ModelInputs): ModelInputs => {
  const { timeline: _drop, ...rest } = inp;
  return rest as ModelInputs;
};
const fixtures: [string, () => ModelInputs][] = [
  ["golden template (demoProject)", demoProject],
  ["landNewbuildProject", landNewbuildProject],
  ["shorePowerProgram", shorePowerProgram],
];

describe("v0.6.13.1 Chunk 0: computeModel is inert to the timeline block", () => {
  for (const [name, make] of fixtures) {
    it(`LOCK ${name}: the block present equals the block absent, byte for byte`, () => {
      const absent = JSON.stringify(computeModel(without(make())));
      const present = JSON.stringify(computeModel({ ...without(make()), timeline: synthetic() }));
      expect(present).toBe(absent);
      // the fixture as shipped (with or without its own authored block) equals the stripped model
      expect(JSON.stringify(computeModel(make()))).toBe(absent);
    });
  }
});
