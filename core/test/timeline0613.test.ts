import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { parseProject, serializeProject, ProjectFileError } from "../src/fileio.js";
import type { ProjectFileSettings } from "../src/fileio.js";
import type { ModelInputs, TimelineBlock } from "../src/types.js";
import { appraisal, templateLike } from "./_shared.js";

// v0.6.13 — the timeline block rides the project file additively and is inert to the engine.
const settings: ProjectFileSettings = { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null, scenarioGrantScales: null };
const timeline = (): TimelineBlock => ({
  projectScale: "full",
  activities: [{ id: "a1", label: "Study", startYear: 1, endYear: 2, phase: "prestudy" }],
  decisionPoints: [{ id: "d1", title: "BP1", year: 1, outcome: "continue" }, { id: "d2", title: "BP4", year: 3 }],
  milestones: [{ id: "m1", label: "Handover", year: 5, tie: { kind: "engine-event", event: "first-collection-year" } }, { id: "m2", label: "Done", year: 2, tie: { kind: "activity", activityId: "a1" } }],
});
const withTimeline = (): ModelInputs => ({ ...templateLike(), appraisal: appraisal(), timeline: timeline() });

describe("v0.6.13 timeline: the file seam and the engine lock", () => {
  it("TIMELINE-ROUNDTRIP: the block round-trips byte-identically", () => {
    const text = serializeProject(withTimeline(), settings);
    const back = parseProject(text);
    expect(back.inputs.timeline).toEqual(timeline());
    expect(serializeProject(back.inputs, back.settings)).toBe(text);
  });

  it("TIMELINE-INERT: computeModel is byte-identical with the block present and absent", () => {
    const absent = JSON.stringify(computeModel({ ...templateLike(), appraisal: appraisal() }));
    expect(JSON.stringify(computeModel(withTimeline()))).toBe(absent);
    const empty = JSON.stringify(computeModel({ ...templateLike(), appraisal: appraisal(), timeline: { activities: [], decisionPoints: [], milestones: [] } }));
    expect(empty).toBe(absent);
  });

  it("FILE-PROJECT: the timeline container types are refused by name; content is never judged", () => {
    const wrap = (tl: unknown) => JSON.stringify({ fileKind: "calcvibes-project", fileVersion: 1, project: { ...templateLike(), timeline: tl }, settings });
    expect(() => parseProject(wrap([]))).toThrowError(new ProjectFileError("FILE-PROJECT: the project's timeline entry is not an object and cannot be opened."));
    expect(() => parseProject(wrap("x"))).toThrowError(new ProjectFileError("FILE-PROJECT: the project's timeline entry is not an object and cannot be opened."));
    expect(() => parseProject(wrap({ activities: {} }))).toThrowError(new ProjectFileError("FILE-PROJECT: the project's timeline activities entry is not a list and cannot be opened."));
    expect(() => parseProject(wrap({ decisionPoints: 3 }))).toThrowError(new ProjectFileError("FILE-PROJECT: the project's timeline decisionPoints entry is not a list and cannot be opened."));
    expect(() => parseProject(wrap({ milestones: "m" }))).toThrowError(new ProjectFileError("FILE-PROJECT: the project's timeline milestones entry is not a list and cannot be opened."));
    // content is engine-blind at the file layer: an out-of-span or misordered activity still opens
    expect(() => parseProject(wrap({ activities: [{ id: "a", label: "x", startYear: 9, endYear: 1, phase: "production" }], decisionPoints: [], milestones: [] }))).not.toThrow();
    expect(() => parseProject(wrap(undefined))).not.toThrow();
  });
});

// v0.6.13.2 Task A: the carried phase vocabulary, lane visibility and source markers.
describe("v0.6.13.2 timeline: the carried fields", () => {
  const carried = (): ModelInputs => {
    const tl = timeline();
    tl.phases = [{ id: "prestudy", label: "Prestudy" }, { id: "custom", label: "Custom lane" }];
    tl.laneVisibility = { custom: true, prestudy: false };
    tl.activities[0].derivedFrom = "cost-program";
    return { ...templateLike(), appraisal: appraisal(), timeline: tl };
  };

  it("TIMELINE-CARRIED-ROUNDTRIP-INERT: phases, laneVisibility and derivedFrom round-trip byte-identically and the engine is inert to them", () => {
    const text = serializeProject(carried(), settings);
    const back = parseProject(text);
    expect(back.inputs.timeline).toEqual(carried().timeline);
    expect(serializeProject(back.inputs, back.settings)).toBe(text);
    const absent = JSON.stringify(computeModel({ ...templateLike(), appraisal: appraisal() }));
    expect(JSON.stringify(computeModel(carried()))).toBe(absent);
  });

  it("FILE-PROJECT-CARRIED: the carried container types are refused by name; their content is never judged", () => {
    const wrap = (tl: unknown) => JSON.stringify({ fileKind: "calcvibes-project", fileVersion: 1, project: { ...templateLike(), timeline: tl }, settings });
    expect(() => parseProject(wrap({ phases: {} }))).toThrowError(new ProjectFileError("FILE-PROJECT: the project's timeline phases entry is not a list and cannot be opened."));
    expect(() => parseProject(wrap({ laneVisibility: [] }))).toThrowError(new ProjectFileError("FILE-PROJECT: the project's timeline laneVisibility entry is not an object and cannot be opened."));
    expect(() => parseProject(wrap({ laneVisibility: "x" }))).toThrowError(new ProjectFileError("FILE-PROJECT: the project's timeline laneVisibility entry is not an object and cannot be opened."));
    expect(() => parseProject(wrap({ phases: [{ id: "a" }, { id: "a" }], laneVisibility: { nowhere: "maybe" } }))).not.toThrow();
  });
});
