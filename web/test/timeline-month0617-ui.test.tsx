import { describe, expect, it, vi } from "vitest";

// the print route draws through jsPDF instance methods: record the rect and line calls
const rec = vi.hoisted(() => ({ rects: [] as number[][], lines: [] as number[][], circles: [] as number[][] }));
vi.mock("jspdf", async (orig) => {
  const m = (await orig()) as { jsPDF: new (...a: unknown[]) => Record<string, (...x: unknown[]) => unknown> };
  class Rec extends m.jsPDF {
    constructor(...a: unknown[]) {
      super(...a);
      const rect = this.rect.bind(this);
      const line = this.line.bind(this);
      const circle = this.circle.bind(this);
      this.rect = (...x: unknown[]) => { rec.rects.push(x as number[]); return rect(...x); };
      this.line = (...x: unknown[]) => { rec.lines.push(x as number[]); return line(...x); };
      this.circle = (...x: unknown[]) => { rec.circles.push(x as number[]); return circle(...x); };
    }
  }
  return { ...m, jsPDF: Rec };
});
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { GanttChart, GANTT_SVG } from "../src/charts.js";
import { computeModel } from "../../core/src/engine.js";
import { deckSlides } from "../src/deck.js";
import { buildDeckPdf } from "../src/pdf.js";
import { demoProject, shorePowerProgram } from "../src/state.js";
import type { ModelInputs, TimelineBlock } from "../../core/src/types.js";

// v0.6.17 — the month authoring surface and the sub-year drawing in both renderers.
const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const row = (kind: string, id: string) => document.querySelector(`tr[data-kind="${kind}"][data-line="${id}"]`) as HTMLElement;
const sel = (kind: string, id: string, field: string) => row(kind, id).querySelector(`[data-field="${field}"]`) as HTMLSelectElement;

function openTimeline() {
  render(<App />);
  fireEvent.click(byAction("load-demo"));
  fireEvent.click(byNav("timeline"));
}

describe("Task B — the month authoring surface", () => {
  it("each activity, gate and milestone row carries its optional month selector; empty is the year-grained default", () => {
    openTimeline();
    fireEvent.click(byAction("add-activity"));
    fireEvent.click(byAction("add-gate"));
    fireEvent.click(byAction("add-milestone"));
    const a = document.querySelector('tr[data-kind="activity"]') as HTMLElement;
    const g = document.querySelector('tr[data-kind="gate"]') as HTMLElement;
    const m = document.querySelector('tr[data-kind="milestone"]') as HTMLElement;
    for (const [r, f] of [[a, "activityStartMonth"], [a, "activityEndMonth"], [g, "gateMonth"], [m, "milestoneMonth"]] as [HTMLElement, string][]) {
      const s = r.querySelector(`[data-field="${f}"]`) as HTMLSelectElement;
      expect(s).toBeTruthy();
      expect(s.value).toBe("");
    }
  });

  it("choosing a month composes immediately into the span note; clearing it returns the year reading", () => {
    openTimeline();
    fireEvent.click(byAction("add-milestone"));
    const id = (document.querySelector('tr[data-kind="milestone"]') as HTMLElement).getAttribute("data-line") as string;
    const note = () => row("milestone", id).querySelector('[data-span-note="milestone"]')!.textContent as string;
    const before = note();
    expect(before).not.toContain("month");
    fireEvent.change(sel("milestone", id, "milestoneMonth"), { target: { value: "7" } });
    expect(note()).toContain("month 7");
    fireEvent.change(sel("milestone", id, "milestoneMonth"), { target: { value: "" } });
    expect(note()).toBe(before);
  });

  it("a valid month leaves the section panel free of month refusals (the domain refusal itself is pinned in the model suite)", () => {
    openTimeline();
    fireEvent.click(byAction("add-gate"));
    const id = (document.querySelector('tr[data-kind="gate"]') as HTMLElement).getAttribute("data-line") as string;
    fireEvent.change(sel("gate", id, "gateMonth"), { target: { value: "5" } });
    expect(document.body.textContent).not.toContain("TIMELINE-MONTH-DOMAIN");
  });
});

describe("Task B — the tie select and the read-only computed month", () => {
  it("an activity tie sets the marker's month from the activity's end month; an engine-event tie never authors a month and displays the computed one read-only", () => {
    openTimeline();
    fireEvent.click(byAction("add-activity"));
    const aid = (document.querySelector('tr[data-kind="activity"]') as HTMLElement).getAttribute("data-line") as string;
    fireEvent.change(sel("activity", aid, "activityEndMonth"), { target: { value: "9" } });
    fireEvent.click(byAction("add-milestone"));
    const mid = (document.querySelector('tr[data-kind="milestone"]') as HTMLElement).getAttribute("data-line") as string;
    fireEvent.change(sel("milestone", mid, "milestoneTie"), { target: { value: "activity:" + aid } });
    expect(sel("milestone", mid, "milestoneMonth").value).toBe("9");
    // the engine-event tie: no authored month is written, and the computed month (where the engine carries one) is display only
    fireEvent.change(sel("milestone", mid, "milestoneMonth"), { target: { value: "" } });
    fireEvent.change(sel("milestone", mid, "milestoneTie"), { target: { value: "engine-event:first-collection-year" } });
    expect(sel("milestone", mid, "milestoneMonth").value).toBe("");
    // the program demo's live schedule lands its first payment at month 12 of year 3
    const shown = row("milestone", mid).querySelector('[data-testid="computed-month"]');
    expect(shown).not.toBeNull();
    expect(shown!.textContent).toContain("Computed month 12 of year 3");
    expect(shown!.textContent).toContain("read-only");
    // and it never authors: the saved milestone carries no month
    expect(sel("milestone", mid, "milestoneMonth").value).toBe("");
  });
});

describe("Task C — the sub-year positions in both renderers", () => {
  const tl = (): TimelineBlock => ({
    projectScale: "full",
    activities: [
      { id: "a1", label: "Year bar", startYear: 1, endYear: 2, phase: "prestudy" },
      { id: "a2", label: "Month bar", startYear: 3, endYear: 3, startMonth: 7, endMonth: 12, phase: "production" },
    ],
    decisionPoints: [{ id: "d1", title: "A", year: 2, code: "DP1", month: 2 }, { id: "d2", title: "B", year: 2, code: "DP2", month: 10 }],
    milestones: [{ id: "m1", label: "Done", year: 3, month: 12 }],
  });
  const inputs = (): ModelInputs => ({ ...demoProject(), projectLengthYears: 5, timeline: tl() });
  const gantt = () => deckSlides(inputs(), computeModel(inputs()), { startYear: null }).slides.find((s) => s.name === "timeline")!.gantt!;

  it("the Presentation SVG draws the bar feet, the gate lines and the milestone at the composed positions", () => {
    const g = gantt();
    const { container } = render(<GanttChart gantt={g} />);
    const { labelW, plotW, barInset } = GANTT_SVG;
    const colW = plotW / (g.window.lastYear - g.window.firstYear + 1);
    const bar = container.querySelector('[data-gantt-bar="a2"] rect') as SVGRectElement;
    const b = g.lanes.flatMap((l) => l.bars).find((x) => x.id === "a2")!;
    expect(parseFloat(bar.getAttribute("x") as string)).toBeCloseTo(labelW + b.left * colW + barInset, 6);
    expect(parseFloat(bar.getAttribute("width") as string)).toBeCloseTo((b.right - b.left) * colW - 2 * barInset, 6);
    expect(b.right - b.left).toBeCloseTo(0.5, 12);
    const xs = ["d1", "d2"].map((id) => parseFloat(container.querySelector(`[data-gantt-gate="${id}"] line`)!.getAttribute("x1") as string));
    expect(xs[0]).not.toBe(xs[1]);
    expect(xs[1] - xs[0]).toBeCloseTo((8 / 12) * colW, 6);
  });

  it("the PDF draws the same composed positions (the same model, never recomputed)", () => {
    rec.rects.length = 0;
    rec.lines.length = 0;
    const rects = rec.rects;
    const lines = rec.lines;
    {
      const model = deckSlides(inputs(), computeModel(inputs()), { startYear: null });
      buildDeckPdf(model, "Month test");
      const g = model.slides.find((s) => s.name === "timeline")!.gantt!;
      const colW = (257 - 32) / (g.window.lastYear - g.window.firstYear + 1);
      const x0 = 20 + 32;
      const b = g.lanes.flatMap((x) => x.bars).find((x) => x.id === "a2")!;
      const expectedX = x0 + b.left * colW + 0.3;
      expect(rects.some((q) => Math.abs(q[0] - expectedX) < 1e-9 && Math.abs(q[2] - ((b.right - b.left) * colW - 0.6)) < 1e-9)).toBe(true);
      const gateX = g.gates.map((x) => x0 + x.pos * colW);
      for (const gx of gateX) expect(lines.some((q) => Math.abs(q[0] - gx) < 1e-9 && Math.abs(q[2] - gx) < 1e-9)).toBe(true);
    }
  });

  it("a gate on a shared month stacks its label on a second row in the SVG", () => {
    const stack = { ...tl(), decisionPoints: [{ id: "d1", title: "A", year: 2, code: "DP1", month: 5 }, { id: "d2", title: "B", year: 2, code: "DP2", month: 5 }] };
    const inp = { ...demoProject(), projectLengthYears: 5, timeline: stack };
    const g = deckSlides(inp, computeModel(inp), { startYear: null }).slides.find((s) => s.name === "timeline")!.gantt!;
    const { container } = render(<GanttChart gantt={g} />);
    const ys = ["d1", "d2"].map((id) => parseFloat(container.querySelector(`[data-gantt-gate="${id}"] text`)!.getAttribute("y") as string));
    expect(ys[1] - ys[0]).toBe(14);
  });

  it("the shore-power demo's year-grained Gantt keeps every bar at its year positions", () => {
    const inp = shorePowerProgram();
    const g = deckSlides(inp, computeModel(inp), { startYear: null }).slides.find((s) => s.name === "timeline")?.gantt;
    if (g === undefined) return;
    for (const b of g.lanes.flatMap((l) => l.bars)) expect(b.right - b.left).toBe(b.endYear - b.startYear + 1);
  });

  it("the computed engine-event month draws as a muted ring in the SVG and the PDF (read-only, never authored)", () => {
    const tied: TimelineBlock = { projectScale: "full", activities: [{ id: "a1", label: "Build", startYear: 1, endYear: 5, phase: "production" }], decisionPoints: [], milestones: [{ id: "m1", label: "Collections", year: 3, tie: { kind: "engine-event", event: "first-collection-year" } }] };
    const inp = { ...demoProject(), projectLengthYears: 5, timeline: tied };
    rec.circles.length = 0;
    const model = deckSlides(inp, computeModel(inp), { startYear: null });
    const g = model.slides.find((s) => s.name === "timeline")!.gantt!;
    const m = g.milestones[0];
    expect(m.computed).not.toBeNull();
    const { container } = render(<GanttChart gantt={g} />);
    const ring = container.querySelector('[data-gantt-computed="m1"]') as SVGCircleElement;
    const { labelW, plotW } = GANTT_SVG;
    expect(parseFloat(ring.getAttribute("cx") as string)).toBeCloseTo(labelW + m.computed!.pos * (plotW / (g.window.lastYear - g.window.firstYear + 1)), 6);
    expect(ring.querySelector("title")!.textContent).toContain("read-only");
    expect(ring.getAttribute("fill")).toBe("none");
    buildDeckPdf(model, "Computed month");
    const colW = (257 - 32) / (g.window.lastYear - g.window.firstYear + 1);
    expect(rec.circles.some((c) => Math.abs(c[0] - (52 + m.computed!.pos * colW)) < 1e-9)).toBe(true);
  });
});
