import { describe, expect, it } from "vitest";
// the web workspace carries no Node declarations here; the test runner is Node
// @ts-ignore
import { createHash } from "node:crypto";
import { computeModel } from "../../core/src/engine.js";
import { parseProject, serializeProject } from "../../core/src/fileio.js";
import { deckSlides, milestoneTooltip } from "../src/deck.js";
import { markerPosition } from "../src/ganttLayout.js";
import { availableEngineEvents, demoProject, landNewbuildProject, resolveMilestone, shorePowerProgram, validateTimeline } from "../src/state.js";
import type { ModelInputs, TimelineActivity, TimelineBlock, TimelineMilestone } from "../../core/src/types.js";

// v0.6.19 — the milestone ties: the live tie (a reference, never a copy), the start tie, the computed-position
// drawing (the ring retired), the fallback contract, the no-write contract and the demo pins. Timeline layer only.
type Hasher = { update(s: string): { digest(enc: string): string } };
const sha = (o: unknown): string => (createHash as unknown as (a: string) => Hasher)("sha256").update(JSON.stringify(o)).digest("hex");
const settings = { startYear: null, entryUnit: "thousands" as const, scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null, scenarioGrantScales: null };
const act = (over: Partial<TimelineActivity> = {}): TimelineActivity => ({ id: "a1", label: "Build", startYear: 2, endYear: 4, startMonth: 3, endMonth: 9, phase: "production", ...over });
const tlOf = (activities: TimelineActivity[], milestones: TimelineMilestone[]): TimelineBlock => ({ projectScale: "full", activities, decisionPoints: [], milestones });
const base = (tl: TimelineBlock): ModelInputs => ({ ...demoProject(), projectLengthYears: 8, timeline: tl });
const gantt = (tl: TimelineBlock) => {
  const inp = base(tl);
  return deckSlides(inp, computeModel(inp), { startYear: null }).slides.find((s) => s.name === "timeline")!.gantt!;
};
const ms = (over: Partial<TimelineMilestone> = {}): TimelineMilestone => ({ id: "m1", label: "Done", year: 1, ...over });

describe("Task A — the live tie (the resolver, composed once)", () => {
  const tl = { activities: [act()] };
  it("the finish tie composes from the activity's current end year and month; the start tie from its start", () => {
    expect(resolveMilestone(tl, ms({ tie: { kind: "activity", activityId: "a1" } }), [])).toEqual({ year: 4, month: 9, source: "activity-finish" });
    expect(resolveMilestone(tl, ms({ tie: { kind: "activity", activityId: "a1", anchor: "start" } }), [])).toEqual({ year: 2, month: 3, source: "activity-start" });
  });
  it("an activity without months resolves year-grained (month undefined)", () => {
    expect(resolveMilestone({ activities: [act({ startMonth: undefined, endMonth: undefined })] }, ms({ tie: { kind: "activity", activityId: "a1" } }), [])).toEqual({ year: 4, month: undefined, source: "activity-finish" });
  });
  it("the engine-event tie composes from the event's live year and, where it carries one, its computed month", () => {
    const events = [{ event: "first-collection-year" as const, year: 3, month: 12 }, { event: "construction-complete" as const, year: 2 }];
    expect(resolveMilestone(tl, ms({ tie: { kind: "engine-event", event: "first-collection-year" } }), events)).toEqual({ year: 3, month: 12, source: "engine-event" });
    expect(resolveMilestone(tl, ms({ tie: { kind: "engine-event", event: "construction-complete" } }), events)).toEqual({ year: 2, month: undefined, source: "engine-event" });
  });
  it("the fallback: the authored year and month serve only when the tie is absent or unresolvable", () => {
    const authored = ms({ year: 5, month: 6 });
    expect(resolveMilestone(tl, authored, [])).toEqual({ year: 5, month: 6, source: "authored" });
    // an engine-event tie with the model unsolved (the events unavailable)
    expect(resolveMilestone(tl, { ...authored, tie: { kind: "engine-event", event: "first-collection-year" } }, [])).toEqual({ year: 5, month: 6, source: "authored" });
    // a tie whose target no longer exists (the TIMELINE-MILESTONE-TIE refusal's case)
    expect(resolveMilestone(tl, { ...authored, tie: { kind: "activity", activityId: "a9" } }, [])).toEqual({ year: 5, month: 6, source: "authored" });
  });
  it("the unsolved model exposes no events", () => {
    expect(availableEngineEvents(demoProject(), null)).toEqual([]);
  });
});

describe("Task A — the deck follows the tie live while the document stays byte-identical", () => {
  // the authored position (year 3 month 1) sits inside the window the activity opens, so it can draw as the fallback
  const milestone = () => ms({ year: 3, month: 1, tie: { kind: "activity", activityId: "a1" } });
  const drawn = (activity: Partial<TimelineActivity>, m: TimelineMilestone = milestone()) => gantt(tlOf([act(activity)], [m])).milestones[0];

  it("moving the tied activity moves the tied milestone's drawn position; the authored fields do not change", () => {
    const before = drawn({});
    expect(before.year).toBe(4);
    expect(before.month).toBe(9);
    const win = gantt(tlOf([act()], [milestone()])).window;
    expect(before.pos).toBe(markerPosition(win, 4, 9));
    const moved = drawn({ endYear: 5, endMonth: 2 });
    expect([moved.year, moved.month]).toEqual([5, 2]);
    expect(moved.pos).not.toBe(before.pos);
    // the JSON-identity pin: the milestone object in the document is untouched by either move
    const doc = (a: Partial<TimelineActivity>) => JSON.stringify(base(tlOf([act(a)], [milestone()])).timeline!.milestones);
    expect(doc({ endYear: 5, endMonth: 2 })).toBe(doc({}));
  });

  it("the composition writes nothing: the saved milestone is identical before and after the deck is composed", () => {
    const inp = base(tlOf([act()], [milestone()]));
    const text = serializeProject(inp, settings);
    deckSlides(inp, computeModel(inp), { startYear: null });
    expect(serializeProject(inp, settings)).toBe(text);
    expect(JSON.parse(text).project.timeline.milestones[0]).toEqual({ id: "m1", label: "Done", year: 3, month: 1, tie: { kind: "activity", activityId: "a1" } });
  });

  it("removing the tie restores the authored position", () => {
    const tied = drawn({});
    const { tie: _t, ...untied } = milestone();
    const free = drawn({}, untied as TimelineMilestone);
    expect([free.year, free.month]).toEqual([3, 1]);
    expect(free.pos).not.toBe(tied.pos);
  });

  it("the start tie follows the activity's start", () => {
    const m = drawn({}, ms({ year: 1, tie: { kind: "activity", activityId: "a1", anchor: "start" } }));
    expect([m.year, m.month]).toEqual([2, 3]);
    expect(m.tie).toBe("activity start a1");
    const moved = drawn({ startYear: 3, startMonth: 11 }, ms({ year: 1, tie: { kind: "activity", activityId: "a1", anchor: "start" } }));
    expect([moved.year, moved.month]).toEqual([3, 11]);
  });

  it("the engine-event tie draws at the live computed month; the year-grained events at the year position", () => {
    const first = gantt(tlOf([act({ startYear: 1, endYear: 5 })], [ms({ year: 1, month: 1, tie: { kind: "engine-event", event: "first-collection-year" } })])).milestones[0];
    expect([first.year, first.month]).toEqual([3, 12]);
    const done = gantt(tlOf([act({ startYear: 1, endYear: 5 })], [ms({ year: 1, month: 1, tie: { kind: "engine-event", event: "construction-complete" } })])).milestones[0];
    expect(done.month).toBeNull();
    expect(done.pos).toBe(done.year - gantt(tlOf([act({ startYear: 1, endYear: 5 })], [])).window.firstYear + 0.5);
  });

  it("the authored year stays the span validation's subject: a tied milestone's authored year outside the span still refuses", () => {
    const inp = base(tlOf([act()], [ms({ year: 99, tie: { kind: "activity", activityId: "a1" } })]));
    expect(validateTimeline(inp, computeModel(inp)).map((r) => r.code)).toContain("TIMELINE-MILESTONE-SPAN");
  });

  it("the ordinals compose in chronological order over the DRAWN positions", () => {
    // authored order m1 (tied, lives in year 4) then m2 (manual, year 2): the live order puts m2 first
    const g = gantt(tlOf([act()], [ms({ id: "m1", year: 1, tie: { kind: "activity", activityId: "a1" } }), ms({ id: "m2", year: 2 })]));
    const byId = Object.fromEntries(g.milestones.map((m) => [m.id, m.ordinal]));
    expect(byId).toEqual({ m2: 1, m1: 2 });
  });

  it("the proximity stacking composes over the drawn positions: tied milestones that land apart share a row, ones that land together stack", () => {
    const apart = gantt(tlOf([act(), act({ id: "a2", startYear: 2, endYear: 4, startMonth: 3, endMonth: 3 })], [
      ms({ id: "m1", year: 1, tie: { kind: "activity", activityId: "a1" } }), ms({ id: "m2", year: 1, tie: { kind: "activity", activityId: "a2" } }),
    ])).milestones;
    expect(apart.map((m) => m.row)).toEqual([0, 0]);
    const together = gantt(tlOf([act(), act({ id: "a2" })], [
      ms({ id: "m1", year: 1, tie: { kind: "activity", activityId: "a1" } }), ms({ id: "m2", year: 1, tie: { kind: "activity", activityId: "a2" } }),
    ])).milestones;
    expect(together.map((m) => m.row).sort()).toEqual([0, 1]);
  });

  it("a manual monthless milestone keeps today's rank rows and its year-centre position", () => {
    const g = gantt(tlOf([act()], [ms({ id: "m1", year: 2 }), ms({ id: "m2", year: 2 }), ms({ id: "m3", year: 2 })]));
    expect(g.milestones.map((m) => m.row)).toEqual([0, 1, 2]);
    for (const m of g.milestones) expect(m.pos).toBe(m.year - g.window.firstYear + 0.5);
  });
});

describe("Task B — the activity-start tie (types only, additive)", () => {
  const file = (tie: object) => base(tlOf([act()], [ms({ tie: tie as never })]));
  it("a finish tie carries no anchor key and a document without the anchor round-trips byte-identically", () => {
    const text = serializeProject(file({ kind: "activity", activityId: "a1" }), settings);
    expect(text).not.toContain("anchor");
    const back = parseProject(text);
    expect(serializeProject(back.inputs, back.settings)).toBe(text);
  });
  it("a start tie persists its anchor and round-trips byte-identically", () => {
    const text = serializeProject(file({ kind: "activity", activityId: "a1", anchor: "start" }), settings);
    expect(JSON.parse(text).project.timeline.milestones[0].tie).toEqual({ kind: "activity", activityId: "a1", anchor: "start" });
    const back = parseProject(text);
    expect(serializeProject(back.inputs, back.settings)).toBe(text);
  });
  it("the TIMELINE-MILESTONE-TIE guard covers the start tie identically: the deleted target refuses naming the activity", () => {
    const inp = base(tlOf([act()], [ms({ tie: { kind: "activity", activityId: "a9", anchor: "start" } })]));
    expect(validateTimeline(inp, computeModel(inp)).map((r) => r.message)).toEqual([
      "Milestone m1 (Done) is tied to activity a9, which does not exist; the activities present are a1: tie it to one of them or clear the tie (TIMELINE-MILESTONE-TIE).",
    ]);
  });
  it("the year-only document stays free of month keys and anchors", () => {
    expect(serializeProject(shorePowerProgram(), settings)).not.toContain("anchor");
  });
});

describe("Task C — the computed-position drawing (the ring retired)", () => {
  it("no milestone in the deck model carries a computed ring any more", () => {
    for (const make of [landNewbuildProject, shorePowerProgram]) {
      const inp = make();
      const g = deckSlides(inp, computeModel(inp), { startYear: null }).slides.find((s) => s.name === "timeline")!.gantt!;
      for (const m of g.milestones) expect("computed" in m).toBe(false);
    }
  });

  it("the land demo's first-collection milestone draws at the computed month 12 of year 3; its authored month 1 is the fallback only", () => {
    const inp = landNewbuildProject();
    const g = deckSlides(inp, computeModel(inp), { startYear: null }).slides.find((s) => s.name === "timeline")!.gantt!;
    const m = g.milestones.find((x) => x.tie === "first-collection-year")!;
    expect([m.year, m.month]).toEqual([3, 12]);
    expect(m.pos).toBe(markerPosition(g.window, 3, 12));
    expect(inp.timeline!.milestones.find((x) => x.id === "m3")).toMatchObject({ year: 3, month: 1 });
  });

  it("the activity-tied demo milestone draws at its activity's finish and the year-grained event at the year position", () => {
    const inp = landNewbuildProject();
    const g = deckSlides(inp, computeModel(inp), { startYear: null }).slides.find((s) => s.name === "timeline")!.gantt!;
    const fit = g.milestones.find((x) => x.tie === "activity a4")!;
    expect([fit.year, fit.month]).toEqual([2, 12]);
    const done = g.milestones.find((x) => x.tie === "construction-complete")!;
    expect(done.month).toBeNull();
    expect(done.pos).toBe(done.year - g.window.firstYear + 0.5);
  });

  it("an untied (manual) milestone draws exactly as before: the authored year and month", () => {
    const g = gantt(tlOf([act()], [ms({ year: 3, month: 6 })]));
    expect([g.milestones[0].year, g.milestones[0].month]).toEqual([3, 6]);
    expect(g.milestones[0].pos).toBe(markerPosition(g.window, 3, 6));
  });
});

describe("Task C — the demo wall: the timeline blocks stay byte-identical (the comment-only re-anchor)", () => {
  it("the land and shore-power timeline blocks hash to their v0.6.18 bytes", () => {
    expect(sha(landNewbuildProject().timeline)).toBe("d12b41cb8fce9cc1cefca64061f68313ce1c4d192d0ccd390f6876b19cb219c7");
    expect(sha(shorePowerProgram().timeline)).toBe("0d7156f2d7b080ec19b6aa6027e6c90be76dd98b3aae9b253839a1531367783f");
  });
});

describe("the tooltip names the tie (composed once in the deck model)", () => {
  const acts = { activities: [{ id: "a1", label: "Interior fit-out" }, { id: "a2", label: "" }] };
  it("an untied marker's tooltip is the plain milestone line, exactly as before", () => {
    expect(milestoneTooltip(acts, { label: "Done" }, "authored", 3)).toBe("Milestone 3: Done");
  });
  it("a tied marker names what it follows: the finish or the start of the activity, or the engine event", () => {
    expect(milestoneTooltip(acts, { label: "Done", tie: { kind: "activity", activityId: "a1" } }, "activity-finish", 1)).toBe("Milestone 1: Done — tied to the finish of activity a1 (Interior fit-out)");
    expect(milestoneTooltip(acts, { label: "Done", tie: { kind: "activity", activityId: "a1", anchor: "start" } }, "activity-start", 1)).toBe("Milestone 1: Done — tied to the start of activity a1 (Interior fit-out)");
    expect(milestoneTooltip(acts, { label: "Done", tie: { kind: "activity", activityId: "a2" } }, "activity-finish", 2)).toContain("(unnamed)");
    expect(milestoneTooltip(acts, { label: "Done", tie: { kind: "engine-event", event: "first-collection-year" } }, "engine-event", 4)).toBe("Milestone 4: Done — tied to the engine event First collection year");
  });
  it("a tie that does not resolve says so", () => {
    expect(milestoneTooltip(acts, { label: "Done", tie: { kind: "engine-event", event: "first-collection-year" } }, "authored", 1)).toBe("Milestone 1: Done — tied to the engine event First collection year (does not resolve: drawn at the authored position)");
  });
  it("the deck model carries the composed tooltip on every drawn milestone", () => {
    const g = gantt(tlOf([act()], [ms({ id: "m1", year: 3 }), ms({ id: "m2", year: 3, tie: { kind: "activity", activityId: "a1", anchor: "start" } })]));
    expect(Object.fromEntries(g.milestones.map((m) => [m.id, m.tooltip]))).toEqual({
      m1: "Milestone 2: Done",
      m2: "Milestone 1: Done — tied to the start of activity a1 (Build)",
    });
  });
});
