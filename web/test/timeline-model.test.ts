import { describe, expect, it } from "vitest";
import { computeModel } from "../../core/src/engine.js";
import type { ModelInputs, TimelineBlock } from "../../core/src/types.js";
import {
  PPS_BP_SET, PPS_DISCLOSURE, PPS_SCALE_CODES, availableEngineEvents, demoProject, emptyTimeline, nextUnusedBp,
  programSpanYears, shorePowerProgram, timelineAuthored, timelineOf, validateTimeline,
} from "../src/state.js";

// v0.6.13 — the timeline vocabulary, the span, the engine-event ties and the section-local refusals.
const alpha = (tl?: TimelineBlock, projectLengthYears?: number): ModelInputs => ({ ...demoProject(), ...(tl !== undefined ? { timeline: tl } : {}), ...(projectLengthYears !== undefined ? { projectLengthYears } : {}) });
const block = (over: Partial<TimelineBlock> = {}): TimelineBlock => ({ ...emptyTimeline(), ...over });

describe("the PPS-aligned vocabulary of record", () => {
  it("BP1 through BP8 carry the sourced titles; the scales select the sets", () => {
    expect(PPS_BP_SET.map((b) => b.code)).toEqual(["BP1", "BP2", "BP3", "BP4", "BP5", "BP6", "BP7", "BP8"]);
    expect(PPS_BP_SET[0].title).toBe("Beslut om att starta projektet och initiera förberedelserna");
    expect(PPS_BP_SET[3].title).toBe("Beslut att starta genomförandet");
    expect(PPS_BP_SET[7].title).toBe("Beslut om att avsluta projektet");
    expect(PPS_SCALE_CODES.full).toHaveLength(8);
    expect(PPS_SCALE_CODES.mini).toEqual(["BP1", "BP3", "BP4", "BP8"]);
    expect(PPS_DISCLOSURE).toBe("The decision-point vocabulary is aligned with PPS (Praktisk Projektstyrning); this application does not implement or certify PPS.");
  });

  it("an added gate takes the next unused BP of the scale; the set exhausts to null", () => {
    expect(nextUnusedBp(block())?.code).toBe("BP1");
    expect(nextUnusedBp(block({ decisionPoints: [{ id: "d1", title: "x", year: 1, code: "BP1" }] }))?.code).toBe("BP2");
    expect(nextUnusedBp(block({ projectScale: "mini", decisionPoints: [{ id: "d1", title: "x", year: 1, code: "BP1" }] }))?.code).toBe("BP3");
    const all = PPS_SCALE_CODES.mini.map((code, i) => ({ id: "d" + i, title: "t", year: 1, code }));
    expect(nextUnusedBp(block({ projectScale: "mini", decisionPoints: all }))).toBeNull();
  });

  it("the empty block is not authored; the scale defaults to full", () => {
    expect(timelineAuthored(alpha())).toBe(false);
    expect(timelineAuthored(alpha(block()))).toBe(false);
    expect(timelineAuthored(alpha(block({ milestones: [{ id: "m1", label: "x", year: 1 }] })))).toBe(true);
    expect(timelineOf(alpha()).projectScale).toBe("full");
  });
});

describe("the program span and the engine-event ties", () => {
  it("the span is the declared project length when declared, else the derived horizon", () => {
    const r = computeModel(alpha());
    expect(programSpanYears(alpha(), r)).toBe(r.horizon!.totalYears);
    expect(programSpanYears(alpha(undefined, 12), computeModel(alpha(undefined, 12)))).toBe(12);
    expect(programSpanYears(alpha(), null)).toBeNull();
  });

  it("the events read the solved model's fields", () => {
    const inp = shorePowerProgram();
    const r = computeModel(inp);
    const ev = availableEngineEvents(inp, r);
    expect(ev.find((e) => e.event === "construction-complete")!.year).toBe(r.lastCostYear);
    expect(ev.find((e) => e.event === "first-collection-year")!.year).toBe(r.tariffYears[0].year);
    expect(ev.find((e) => e.event === "funding-received")!.year).toBe(Math.min(...r.fundingView!.rows.map((x) => x.year)));
    const plain = computeModel(alpha());
    expect(availableEngineEvents(alpha(), plain).map((e) => e.event)).toEqual(["construction-complete", "first-collection-year"]);
    expect(availableEngineEvents(alpha(), null)).toEqual([]);
  });
});

describe("the section-local refusals (never compute-blocking)", () => {
  const inp = (tl: TimelineBlock) => alpha(tl, 12);
  const refuse = (tl: TimelineBlock) => validateTimeline(inp(tl), computeModel(inp(tl)));

  it("a clean timeline is refusal-free", () => {
    expect(refuse(block({ activities: [{ id: "a1", label: "Study", startYear: 1, endYear: 3, phase: "prestudy" }], decisionPoints: [{ id: "d1", title: "BP1", year: 1 }], milestones: [{ id: "m1", label: "Go", year: 12 }] }))).toEqual([]);
  });

  it("TIMELINE-ACTIVITY-SPAN names the activity and carries the true span", () => {
    expect(refuse(block({ activities: [{ id: "a1", label: "Study", startYear: 0, endYear: 13, phase: "prestudy" }] })).map((r) => r.message)).toEqual([
      "Activity a1 (Study) runs years 0–13, outside the program span of years 1–12: set whole years inside the span or widen the project length (TIMELINE-ACTIVITY-SPAN).",
    ]);
  });

  it("TIMELINE-ACTIVITY-ORDER refuses a start after the end", () => {
    expect(refuse(block({ activities: [{ id: "a2", label: "Build", startYear: 5, endYear: 3, phase: "production" }] })).map((r) => r.message)).toEqual([
      "Activity a2 (Build) starts in year 5, after it ends in year 3: set the start year at or before the end year (TIMELINE-ACTIVITY-ORDER).",
    ]);
  });

  it("TIMELINE-GATE-SPAN and TIMELINE-MILESTONE-SPAN", () => {
    const r = refuse(block({ decisionPoints: [{ id: "d9", title: "BP4", year: 40 }], milestones: [{ id: "m9", label: "Done", year: -1 }] }));
    expect(r.map((x) => x.code)).toEqual(["TIMELINE-GATE-SPAN", "TIMELINE-MILESTONE-SPAN"]);
    expect(r[0].message).toBe("Decision point d9 (BP4) falls in year 40, outside the program span of years 1–12: set a whole year inside the span or widen the project length (TIMELINE-GATE-SPAN).");
    expect(r[1].message).toBe("Milestone m9 (Done) falls in year -1, outside the program span of years 1–12: set a whole year inside the span or widen the project length (TIMELINE-MILESTONE-SPAN).");
  });

  it("TIMELINE-MILESTONE-TIE: a missing activity names the activities present; an unavailable engine event names the events available", () => {
    const r = refuse(block({
      activities: [{ id: "a1", label: "Study", startYear: 1, endYear: 2, phase: "prestudy" }],
      milestones: [
        { id: "m1", label: "A", year: 2, tie: { kind: "activity", activityId: "a7" } },
        { id: "m2", label: "B", year: 2, tie: { kind: "engine-event", event: "funding-received" } },
        { id: "m3", label: "C", year: 2, tie: { kind: "activity", activityId: "a1" } },
      ],
    }));
    expect(r.map((x) => x.message)).toEqual([
      "Milestone m1 (A) is tied to activity a7, which does not exist; the activities present are a1: tie it to one of them or clear the tie (TIMELINE-MILESTONE-TIE).",
      "Milestone m2 (B) is tied to the engine event funding-received, which does not compose for this project; the events available are construction-complete, first-collection-year: tie it to one of them or clear the tie (TIMELINE-MILESTONE-TIE).",
    ]);
  });

  it("the mini scale validates as strictly as the full scale", () => {
    const tl = block({ projectScale: "mini", decisionPoints: [{ id: "d1", title: "BP8", year: 99, code: "BP8" }] });
    expect(refuse(tl).map((x) => x.code)).toEqual(["TIMELINE-GATE-SPAN"]);
  });

  it("the refusals stand down when the model has no result", () => {
    const tl = block({ activities: [{ id: "a1", label: "x", startYear: 9, endYear: 1, phase: "prestudy" }] });
    expect(validateTimeline(inp(tl), null)).toEqual([]);
  });

  it("the refusals never alter the model: compute-blocking issues stay empty and the result is identical", () => {
    const bad = block({ activities: [{ id: "a1", label: "x", startYear: 9, endYear: 1, phase: "prestudy" }] });
    expect(JSON.stringify(computeModel(inp(bad)))).toBe(JSON.stringify(computeModel(alpha(undefined, 12))));
  });
});
