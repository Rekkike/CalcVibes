import { describe, expect, it } from "vitest";
import { computeModel } from "../../core/src/engine.js";
import { parseProject, serializeProject } from "../../core/src/fileio.js";
import { deckSlides } from "../src/deck.js";
import { barPosition, layoutGateLabels, layoutLane, markerPosition, monthClosing, monthOpening, ganttWindow } from "../src/ganttLayout.js";
import { availableEngineEvents, demoProject, yearHeader, landNewbuildProject, shorePowerProgram, validateTimeline } from "../src/state.js";
import type { ModelInputs, TimelineBlock } from "../../core/src/types.js";

// v0.6.17 — the timeline month granularity: the opening/closing semantics and the composed sub-year
// positions, the month bounds in the validation, the gate-overlap retirement, the read-only month
// exposure and the year-grained default lock. Timeline layer only: no engine value moves.
const settings = { startYear: null, entryUnit: "thousands" as const, scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null, scenarioGrantScales: null };
const base = (tl?: TimelineBlock): ModelInputs => ({ ...demoProject(), projectLengthYears: 8, ...(tl !== undefined ? { timeline: tl } : {}) });
const tlOf = (over: Partial<TimelineBlock>): TimelineBlock => ({ projectScale: "full", activities: [], decisionPoints: [], milestones: [], ...over });
const gantt = (tl: TimelineBlock) => {
  const inp = base(tl);
  return deckSlides(inp, computeModel(inp), { startYear: null }).slides.find((s) => s.name === "timeline")!.gantt!;
};
const win = { firstYear: 1 };

describe("Task C — the position composition (the opening/closing semantics, composed once)", () => {
  it("a start bound opens at (month - 1) / 12 and an end bound closes at month / 12", () => {
    expect(monthOpening(1)).toBe(0);
    expect(monthOpening(7)).toBe(6 / 12);
    expect(monthOpening(12)).toBe(11 / 12);
    expect(monthClosing(1)).toBe(1 / 12);
    expect(monthClosing(6)).toBe(0.5);
    expect(monthClosing(12)).toBe(1);
  });

  it("an absent month composes at the year's edge: left 0 and right 1, so today's rendering survives", () => {
    expect(monthOpening(undefined)).toBe(0);
    expect(monthClosing(undefined)).toBe(1);
    expect(barPosition({ firstYear: 3 }, { startYear: 3, endYear: 5 })).toEqual({ left: 0, right: 3 });
  });

  it("the bar positions are deterministic: month 1 opening is the year's left edge, month 12 closing its right edge", () => {
    expect(barPosition(win, { startYear: 2, endYear: 4, startMonth: 1, endMonth: 12 })).toEqual(barPosition(win, { startYear: 2, endYear: 4 }));
    expect(barPosition(win, { startYear: 2, endYear: 2, startMonth: 7, endMonth: 7 })).toEqual({ left: 1 + 6 / 12, right: 1 + 7 / 12 });
    expect(barPosition(win, { startYear: 1, endYear: 3, startMonth: 4, endMonth: 9 })).toEqual({ left: 3 / 12, right: 2 + 9 / 12 });
  });

  it("a marker stands at its year band's centre, or at the centre of its month", () => {
    expect(markerPosition(win, 3)).toBe(2.5);
    expect(markerPosition(win, 3, 1)).toBe(2 + 0.5 / 12);
    expect(markerPosition(win, 3, 12)).toBe(2 + 11.5 / 12);
  });

  it("the stacked sub-row assignment consumes the month-accurate feet: two bars sharing a year separate onto one row when their months do not overlap", () => {
    const w = ganttWindow([{ startYear: 1, endYear: 1 }], 1);
    const sameRow = layoutLane([
      { id: "a", label: "a", startYear: 1, endYear: 1, startMonth: 1, endMonth: 5 },
      { id: "b", label: "b", startYear: 1, endYear: 1, startMonth: 7, endMonth: 12 },
    ], w);
    expect(sameRow.rowCount).toBe(1);
    const stacked = layoutLane([{ id: "a", label: "a", startYear: 1, endYear: 1 }, { id: "b", label: "b", startYear: 1, endYear: 1 }], w);
    expect(stacked.rowCount).toBe(2);
  });

  it("the deck model carries the composed edges and the axis stays year-labeled", () => {
    const g = gantt(tlOf({ activities: [{ id: "a1", label: "Build", startYear: 2, endYear: 3, startMonth: 7, endMonth: 3, phase: "production" }] }));
    const bar = g.lanes.flatMap((l) => l.bars)[0];
    expect(bar.left).toBe(g.window.firstYear === 2 ? 6 / 12 : 1 + 6 / 12);
    expect(bar.right).toBe((g.window.firstYear === 2 ? 1 : 2) + 3 / 12);
    expect(g.axis.map((a) => a.year)).toEqual(Array.from({ length: g.window.lastYear - g.window.firstYear + 1 }, (_, k) => g.window.firstYear + k));
    expect(g.axis.every((a) => a.label === yearHeader(a.year, null))).toBe(true);
  });
});

describe("Task D — the month bounds in the validation", () => {
  const codes = (tl: TimelineBlock) => validateTimeline(base(tl), computeModel(base(tl))).map((r) => r.message);
  const act = (over: object) => ({ id: "a1", label: "Build", startYear: 2, endYear: 2, phase: "production", ...over });

  it("TIMELINE-MONTH-DOMAIN refuses a month outside 1-12 with one exact string per entity kind", () => {
    expect(codes(tlOf({ activities: [act({ startMonth: 13 }) as never] }))).toEqual([
      "Activity a1 (Build) carries startMonth 13, which is not a whole month from 1 to 12: set a month from 1 to 12 or clear it (TIMELINE-MONTH-DOMAIN).",
    ]);
    expect(codes(tlOf({ activities: [act({ endMonth: 0 }) as never] }))).toEqual([
      "Activity a1 (Build) carries endMonth 0, which is not a whole month from 1 to 12: set a month from 1 to 12 or clear it (TIMELINE-MONTH-DOMAIN).",
    ]);
    expect(codes(tlOf({ decisionPoints: [{ id: "d1", title: "Start", year: 1, month: 2.5 }] }))).toEqual([
      "Decision point d1 (Start) carries month 2.5, which is not a whole month from 1 to 12: set a month from 1 to 12 or clear it (TIMELINE-MONTH-DOMAIN).",
    ]);
    expect(codes(tlOf({ milestones: [{ id: "m1", label: "Done", year: 1, month: 14 }] }))).toEqual([
      "Milestone m1 (Done) carries month 14, which is not a whole month from 1 to 12: set a month from 1 to 12 or clear it (TIMELINE-MONTH-DOMAIN).",
    ]);
  });

  it("the month-aware order: an end month before the start month in the same year refuses; the same month is a valid one-month span", () => {
    expect(codes(tlOf({ activities: [act({ startMonth: 7, endMonth: 6 }) as never] }))).toEqual([
      "Activity a1 (Build) starts in year 2 month 7, after it ends in year 2 month 6: set the start month at or before the end month (TIMELINE-ACTIVITY-ORDER).",
    ]);
    expect(codes(tlOf({ activities: [act({ startMonth: 6, endMonth: 6 }) as never] }))).toEqual([]);
    expect(codes(tlOf({ activities: [act({ startMonth: 7, endMonth: 7 }) as never] }))).toEqual([]);
    // across years the month order is free; one bound alone is always valid
    expect(codes(tlOf({ activities: [act({ endYear: 3, startMonth: 9, endMonth: 2 }) as never] }))).toEqual([]);
    expect(codes(tlOf({ activities: [act({ endMonth: 3 }) as never, act({ id: "a2", startMonth: 11 }) as never] }))).toEqual([]);
  });

  it("with the months absent today's rules stand: the year order refuses, equal years pass", () => {
    expect(codes(tlOf({ activities: [act({ startYear: 3, endYear: 2 }) as never] }))).toEqual([
      "Activity a1 (Build) starts in year 3, after it ends in year 2: set the start year at or before the end year (TIMELINE-ACTIVITY-ORDER).",
    ]);
    expect(codes(tlOf({ activities: [act({}) as never] }))).toEqual([]);
  });

  it("the span refusals stay year-based", () => {
    expect(codes(tlOf({ activities: [act({ startYear: 9, endYear: 9, startMonth: 1 }) as never] }))[0]).toContain("(TIMELINE-ACTIVITY-SPAN)");
  });
});

describe("Section 0.5 — the gate-overlap retirement", () => {
  it("two same-year gates differing by month render at distinct positions on one row", () => {
    const g = gantt(tlOf({ decisionPoints: [{ id: "d1", title: "A", year: 2, code: "DP1", month: 2 }, { id: "d2", title: "B", year: 2, code: "DP2", month: 10 }] }));
    expect(g.gates[0].pos).not.toBe(g.gates[1].pos);
    expect(g.gates.map((x) => x.row)).toEqual([0, 0]);
    expect(g.gateRows).toBe(1);
  });

  it("gates sharing the year and the month stack on successive label rows", () => {
    const g = gantt(tlOf({ decisionPoints: [{ id: "d1", title: "A", year: 2, code: "DP1", month: 5 }, { id: "d2", title: "B", year: 2, code: "DP2", month: 5 }] }));
    expect(g.gates[0].pos).toBe(g.gates[1].pos);
    expect(g.gates.map((x) => x.row)).toEqual([0, 1]);
    expect(g.gateRows).toBe(2);
  });

  it("a gate alone in its year keeps row 0 and its year-band centre; gates order within a year by month", () => {
    const g = gantt(tlOf({ decisionPoints: [{ id: "d1", title: "A", year: 2, code: "DP1" }, { id: "d3", title: "C", year: 4, code: "DP3" }, { id: "d2", title: "B", year: 4, code: "DP2", month: 1 }] }));
    expect(g.gates.map((x) => x.id)).toEqual(["d1", "d2", "d3"]);
    expect(g.gates[0].row).toBe(0);
    expect(layoutGateLabels([{ id: "x", code: "DP1", year: 2 }], ganttWindow([], 8))[0].pos).toBe(1.5);
  });
});

describe("Section 0.6 — the read-only month exposure", () => {
  it("the first-collection-year event carries the computed month of the live schedule where it falls in the event's year", () => {
    const inp = shorePowerProgram();
    const result = computeModel(inp);
    const ev = availableEngineEvents(inp, result).find((e) => e.event === "first-collection-year")!;
    if (ev.month !== undefined) {
      expect(ev.month).toBe(((result.firstPaymentMonth - 1) % 12) + 1);
      expect(Math.ceil(result.firstPaymentMonth / 12)).toBe(ev.year);
    } else {
      expect(Math.ceil(result.firstPaymentMonth / 12)).not.toBe(ev.year);
    }
    const others = availableEngineEvents(inp, result).filter((e) => e.event !== "first-collection-year");
    expect(others.every((e) => e.month === undefined)).toBe(true);
  });
});

describe("Task E — the year-grained default lock and the round trip", () => {
  const FIXTURES: [string, () => ModelInputs][] = [["shore power program", shorePowerProgram], ["land newbuild", landNewbuildProject], ["base demo", demoProject]];

  it("with the months absent every bar, gate and milestone composes at today's year positions", () => {
    for (const [, make] of FIXTURES) {
      const inp = make();
      const tl = inp.timeline;
      if (tl === undefined) continue;
      const result = computeModel(inp);
      const slide = deckSlides(inp, result, { startYear: null }).slides.find((s) => s.name === "timeline");
      if (slide === undefined) continue;
      const g = slide.gantt!;
      for (const b of g.lanes.flatMap((l) => l.bars)) {
        expect(b.left).toBe(b.startYear - g.window.firstYear);
        expect(b.right).toBe(b.endYear - g.window.firstYear + 1);
      }
      for (const x of g.gates) expect(x.pos).toBe(x.year - g.window.firstYear + 0.5);
      for (const x of g.milestones) expect(x.pos).toBe(x.year - g.window.firstYear + 0.5);
    }
  });

  it("a year-only document saves and loads byte-identically and carries no month key", () => {
    for (const [, make] of FIXTURES) {
      const text = serializeProject(make(), settings);
      expect(text).not.toMatch(/"(startMonth|endMonth|month)"/);
      const back = parseProject(text);
      expect(serializeProject(back.inputs, back.settings)).toBe(text);
    }
  });

  it("a document with months round-trips byte-identically with the fields riding inside the timeline block", () => {
    const inp = base(tlOf({
      activities: [{ id: "a1", label: "Build", startYear: 1, endYear: 2, startMonth: 4, endMonth: 9, phase: "production" }],
      decisionPoints: [{ id: "d1", title: "Start", year: 1, month: 3, code: "DP1" }],
      milestones: [{ id: "m1", label: "Done", year: 2, month: 9 }],
    }));
    const text = serializeProject(inp, settings);
    expect(JSON.parse(text).fileVersion).toBe(1);
    const back = parseProject(text);
    expect(back.inputs.timeline!.activities[0]).toMatchObject({ startMonth: 4, endMonth: 9 });
    expect(back.inputs.timeline!.decisionPoints[0].month).toBe(3);
    expect(back.inputs.timeline!.milestones[0].month).toBe(9);
    expect(serializeProject(back.inputs, back.settings)).toBe(text);
  });

  it("the engine never reads the months: every engine value is identical with and without them", () => {
    const plain = base(tlOf({ activities: [{ id: "a1", label: "Build", startYear: 1, endYear: 2, phase: "production" }] }));
    const monthed = base(tlOf({ activities: [{ id: "a1", label: "Build", startYear: 1, endYear: 2, startMonth: 4, endMonth: 9, phase: "production" }] }));
    expect(JSON.stringify(computeModel(monthed))).toBe(JSON.stringify(computeModel(plain)));
  });
});
