import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { parseProject, serializeProject } from "../src/fileio.js";
import type { ProjectFileSettings } from "../src/fileio.js";
import type { ModelInputs } from "../src/types.js";
import { appraisal, templateLike } from "./_shared.js";

// v0.6.15 Task A — the group field on a cost line is engine-blind and rides the project file
// additively (fileVersion 1 preserved; a document without the field round-trips byte-identically).
const settings: ProjectFileSettings = { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null, scenarioGrantScales: null };
const grouped = (): ModelInputs => {
  const t = templateLike();
  return { ...t, appraisal: appraisal(), costs: t.costs.map((c, i) => ({ ...c, group: i === 0 ? "Build" : i === 1 ? "  Build  " : "" })) };
};
const stripped = (): ModelInputs => {
  const g = grouped();
  return { ...g, costs: g.costs.map((c) => { const { group: _g, ...rest } = c; return rest; }) };
};

describe("the group field", () => {
  it("is engine-blind: computeModel is byte-identical with and without the field", () => {
    expect(JSON.stringify(computeModel(grouped()))).toBe(JSON.stringify(computeModel(stripped())));
  });

  it("round-trips through the project file; fileVersion stays 1", () => {
    const text = serializeProject(grouped(), settings);
    const back = parseProject(text);
    expect(back.inputs.costs.map((c) => c.group)).toEqual(["Build", "  Build  ", ""]);
    expect(serializeProject(back.inputs, back.settings)).toBe(text);
    expect(JSON.parse(text).fileVersion).toBe(1);
  });

  it("a document without the field round-trips byte-identically and opens without any refusal", () => {
    const text = serializeProject(stripped(), settings);
    expect(text).not.toContain('"group"');
    const back = parseProject(text);
    expect(serializeProject(back.inputs, back.settings)).toBe(text);
  });
});
