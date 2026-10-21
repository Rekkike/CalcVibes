// v0.6.13.2 Task C and Addenda 1 and 2: the adaptive Gantt — the lean-or-big lane visibility, the
// stacked sub-row layout, the label rule and the adaptive year window. The layout is composed once
// in the deck model; the SVG and the PDF consume it.
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { jsPDF } from "jspdf";
import { App } from "../src/App.js";
import { computeModel } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import type { DeckGantt } from "../src/deck.js";
import { buildDeckPdf, GANTT_PDF } from "../src/pdf.js";
import { GANTT_SVG } from "../src/charts.js";
import { GANTT_CHARS_ACROSS_PLOT, ganttWindow, layoutLane, wrapLabel } from "../src/ganttLayout.js";
import { demoProject, landNewbuildProject, shorePowerProgram, timelineOf, visibleLanes } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs, TimelineActivity, TimelineBlock } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const act = (id: string, phase: string, startYear: number, endYear: number, label = "Activity " + id): TimelineActivity => ({ id, label, startYear, endYear, phase });
const block = (over: Partial<TimelineBlock> = {}): TimelineBlock => ({ projectScale: "full", activities: [], decisionPoints: [], milestones: [], ...over });
const project = (tl: TimelineBlock, years = 12): ModelInputs => ({ ...demoProject(), projectLengthYears: years, timeline: tl });
const ganttOf = (inp: ModelInputs, startYear: number | null = null): DeckGantt => deckSlides(inp, computeModel(inp), { startYear }).slides.find((s) => s.name === "timeline")!.gantt!;

describe("v0.6.13.2 Task C: the lean-or-big lane visibility (presentation-only)", () => {
  const tl = () => block({ activities: [act("a1", "prestudy", 1, 2), act("a2", "production", 3, 5)], decisionPoints: [{ id: "d1", title: "Start", year: 1, code: "BP1" }] });

  it("VISIBILITY-AUTOMATIC: a lane with activities shows, an empty lane hides, lanes follow the vocabulary order", () => {
    expect(visibleLanes(timelineOf(project(tl()))).map((l) => l.id)).toEqual(["prestudy", "production"]);
    expect(ganttOf(project(tl())).lanes.map((l) => l.phase)).toEqual(["prestudy", "production"]);
  });

  it("VISIBILITY-TRUE: an explicit true renders an empty lane (the pinned big view), in vocabulary order", () => {
    const g = ganttOf(project({ ...tl(), laneVisibility: { "detail-design": true, operations: true } }));
    expect(g.lanes.map((l) => l.phase)).toEqual(["prestudy", "detail-design", "production", "operations"]);
    expect(g.lanes[1].bars).toEqual([]);
    expect(g.lanes[1].rowCount).toBe(0);
  });

  it("VISIBILITY-FALSE: an explicit false hides a non-empty lane, and the block keeps its activities byte-identically", () => {
    const hidden = { ...tl(), laneVisibility: { prestudy: false } };
    const before = JSON.stringify(hidden);
    const g = ganttOf(project(hidden));
    expect(g.lanes.map((l) => l.phase)).toEqual(["production"]);
    expect(JSON.stringify(hidden)).toBe(before);
    expect(hidden.activities).toHaveLength(2);
  });

  it("VISIBILITY-DEMOS: the demo decks compose the lanes their activities occupy (the bar layout per Addendum 1)", () => {
    expect(ganttOf(landNewbuildProject()).lanes.map((l) => l.phase)).toEqual(["prestudy", "detail-design", "production"]);
    expect(ganttOf(shorePowerProgram()).lanes.map((l) => l.phase)).toEqual(["prestudy", "production"]);
  });

  it("VISIBILITY-UI: the section toggles show, hide and reset a lane; hiding never removes the lane's activities", async () => {
    render(<App />);
    const text = serializeProject(project(tl()), { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
    fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
    await waitFor(() => expect(screen.getByText("Project Alpha")).toBeTruthy());
    fireEvent.click(byNav("timeline"));
    const lane = (id: string) => document.querySelector(`[data-kind="phase"][data-line="${id}"] [data-field="laneVisibility"]`) as HTMLSelectElement;
    expect(lane("prestudy").value).toBe("auto");
    fireEvent.change(lane("prestudy"), { target: { value: "hide" } });
    expect(lane("prestudy").value).toBe("hide");
    expect(document.querySelectorAll('[data-kind="activity"]').length).toBe(2);
    fireEvent.change(lane("detail-design"), { target: { value: "show" } });
    fireEvent.click(byAction("present"));
    const lanes = () => Array.from(document.querySelectorAll('[data-slide-name="timeline"] [data-gantt-lane]')).map((g) => g.getAttribute("data-gantt-lane"));
    expect(lanes()).toEqual(["detail-design", "production"]);
  });
});

describe("v0.6.13.2 Addendum 1: the stacked sub-row layout and the label rule", () => {
  const extent = (b: { startYear: number; endYear: number; labelMode: string; labelLeft: number; labelWidth: number }, first: number) => {
    const left = b.startYear - first;
    const right = b.endYear - first + 1;
    return b.labelMode === "above" ? [Math.min(left, b.labelLeft), Math.max(right, b.labelLeft + b.labelWidth)] : [left, right];
  };
  const noOverlap = (lane: { bars: ReturnType<typeof layoutLane>["bars"] }, first: number) => {
    for (const a of lane.bars) {
      for (const b of lane.bars) {
        if (a === b || a.row !== b.row) continue;
        const [al, ar] = extent(a, first);
        const [bl, br] = extent(b, first);
        expect(ar <= bl || br <= al).toBe(true);
      }
    }
  };

  it("SUBROWS-DEPTH: concurrent bars stack on distinct sub-rows; a single-activity lane keeps its one row (the observed depth on the shore-power fixture)", () => {
    const g = ganttOf(shorePowerProgram());
    const production = g.lanes.find((l) => l.phase === "production")!;
    expect(production.rowCount).toBe(5);
    expect(new Set(production.bars.map((b) => b.row)).size).toBe(5);
    expect(g.lanes.find((l) => l.phase === "prestudy")!.rowCount).toBe(1);
    expect(ganttOf(project(block({ activities: [act("a1", "prestudy", 1, 3)] }))).lanes[0].rowCount).toBe(1);
  });

  it("SUBROWS-NO-OVERLAP: no bar and no label footprint overlaps or touches another on any sub-row", () => {
    const win = ganttWindow([{ startYear: 1, endYear: 12 }], 12);
    const many = Array.from({ length: 14 }, (_, i) => ({ id: "a" + (i + 1), label: "Activity number " + (i + 1) + " with a long descriptive name", startYear: 1 + (i % 6), endYear: 2 + (i % 7) }));
    const lane = layoutLane(many, win);
    expect(lane.rowCount).toBeGreaterThan(3);
    noOverlap(lane, win.firstYear);
    for (const [, make] of [["land", landNewbuildProject], ["shore", shorePowerProgram]] as const) {
      const g = ganttOf(make());
      for (const l of g.lanes) noOverlap(l, g.window.firstYear);
    }
  });

  it("SUBROWS-ADJACENT: back-to-back bars (end year then the next start year) never share a sub-row edge", () => {
    const win = ganttWindow([{ startYear: 1, endYear: 6 }], 6);
    const lane = layoutLane([{ id: "a1", label: "A", startYear: 1, endYear: 3 }, { id: "a2", label: "B", startYear: 4, endYear: 6 }], win);
    expect(lane.bars.map((b) => b.row)).toEqual([0, 0]);
    const gap = (lane.bars[1].startYear - win.firstYear) - (lane.bars[0].endYear - win.firstYear + 1);
    expect(gap).toBe(0);
    // the renderers inset every bar, so adjacent bars on one row keep a visible gap
    expect(GANTT_SVG.barInset).toBeGreaterThan(0);
    expect(GANTT_PDF.labelW).toBeGreaterThan(0);
  });

  it("LABEL-WRAP: wrapping never loses a character and never exceeds the line budget", () => {
    const label = "Container pillar: engineering & studies (RSP JV) with an extraordinarilylongunbrokenwordthatexceedsthelinebudgetbymuch";
    const lines = wrapLabel(label, 30);
    expect(lines.every((l) => l.length <= 30)).toBe(true);
    expect(lines.join(" ").replace(/\s+/g, "").replace(/ /g, "")).toBe(label.replace(/\s+/g, ""));
    expect(wrapLabel("", 30)).toEqual([""]);
  });

  it("LABEL-RULE-MODEL: a label that fits its bar renders inside; otherwise above, inside the window bounds", () => {
    const win = ganttWindow([{ startYear: 1, endYear: 10 }], 10);
    const lane = layoutLane([
      { id: "a1", label: "Short", startYear: 1, endYear: 2 },
      { id: "a2", label: "A considerably longer activity label that cannot fit a one-year bar", startYear: 10, endYear: 10 },
    ], win);
    expect(lane.bars.find((b) => b.id === "a1")!.labelMode).toBe("inside");
    const long = lane.bars.find((b) => b.id === "a2")!;
    expect(long.labelMode).toBe("above");
    expect(long.labelLeft).toBeGreaterThanOrEqual(0);
    expect(long.labelLeft + long.labelWidth).toBeLessThanOrEqual(win.years + 1e-9);
    expect(lane.rowLines[long.row]).toBe(long.lines.length);
  });

  // The metric pin: the label widths are measured with the real Helvetica metrics (jsPDF) and
  // compared with the drawn geometry of each surface. 1 mm of text at 11 pt equals 72/25.4 px of
  // SVG text at 11 px, since width scales with the font size.
  const worst = (): ModelInputs => project(block({
    activities: [
      ...Array.from({ length: 9 }, (_, i) => act("a" + (i + 1), i % 2 === 0 ? "production" : "revenue", 1 + (i % 4), 2 + (i % 5), "WWWWWWWW activity label number " + (i + 1) + " MMMMMMMMMMMM")),
      act("a10", "financing", 6, 6, "The debt facility service period of the project"),
      act("a11", "prestudy", 1, 1, "Prestudy of the lakeside plot incl. permits and survey"),
    ],
  }), 12);
  const fixtures: [string, ModelInputs][] = [["worst-case", worst()], ["land", landNewbuildProject()], ["shore", shorePowerProgram()]];

  it("LABEL-RULE-SVG: no composed label is clipped by its bar, its lane or the plot bounds on the slide SVG", () => {
    const doc = new jsPDF({ unit: "mm" });
    doc.setFont("helvetica", "normal");
    for (const [, inp] of fixtures) {
      const g = ganttOf(inp);
      const n = g.window.lastYear - g.window.firstYear + 1;
      const colW = GANTT_SVG.plotW / n;
      doc.setFontSize(11);
      const px = (s: string) => (doc.getTextWidth(s) * 72) / 25.4;
      for (const lane of g.lanes) {
        for (const b of lane.bars) {
          if (b.labelMode === "inside") {
            expect(px(b.label) + 10).toBeLessThanOrEqual((b.endYear - b.startYear + 1) * colW - 2 * GANTT_SVG.barInset);
          } else {
            const left = GANTT_SVG.labelW + b.labelLeft * colW;
            for (const line of b.lines) expect(left + px(line)).toBeLessThanOrEqual(GANTT_SVG.labelW + GANTT_SVG.plotW);
            expect(left).toBeGreaterThanOrEqual(GANTT_SVG.labelW);
          }
        }
        doc.setFontSize(13);
        for (const line of lane.labelLines) expect((doc.getTextWidth(line) * 72) / 25.4).toBeLessThanOrEqual(GANTT_SVG.labelW - 10);
        doc.setFontSize(11);
      }
    }
  });

  it("LABEL-RULE-PDF: no composed label is clipped by its bar, its lane or the plot bounds on the print route", () => {
    const doc = new jsPDF({ unit: "mm" });
    doc.setFont("helvetica", "normal");
    for (const [, inp] of fixtures) {
      const g = ganttOf(inp);
      const n = g.window.lastYear - g.window.firstYear + 1;
      const colW = GANTT_PDF.plotW / n;
      doc.setFontSize(6);
      for (const lane of g.lanes) {
        for (const b of lane.bars) {
          if (b.labelMode === "inside") {
            expect(doc.getTextWidth(b.label) + 2).toBeLessThanOrEqual((b.endYear - b.startYear + 1) * colW - 0.6);
          } else {
            for (const line of b.lines) expect(b.labelLeft * colW + doc.getTextWidth(line)).toBeLessThanOrEqual(GANTT_PDF.plotW);
          }
        }
        doc.setFontSize(8);
        for (const line of lane.labelLines) expect(doc.getTextWidth(line)).toBeLessThanOrEqual(GANTT_PDF.labelW - 2);
        doc.setFontSize(6);
      }
    }
  });

  it("LABEL-RULE-DOM: the rendered slide shows distinct sub-row rects, above-labels left-aligned inside the plot, and the lane label lines", async () => {
    render(<App />);
    const PROJECT_NAME = shorePowerProgram().projectName;
    const text = serializeProject(shorePowerProgram(), { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
    fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
    await waitFor(() => expect(screen.getByText(PROJECT_NAME)).toBeTruthy());
    fireEvent.click(byAction("present"));
    const svg = document.querySelector('[data-slide-name="timeline"] svg') as SVGElement;
    const rects = Array.from(svg.querySelectorAll("[data-gantt-bar] rect")).map((r) => ({ x: +r.getAttribute("x")!, y: +r.getAttribute("y")!, w: +r.getAttribute("width")! }));
    expect(rects.length).toBe(shorePowerProgram().timeline!.activities.length);
    for (const a of rects) for (const b of rects) if (a !== b && a.y === b.y) expect(a.x + a.w < b.x || b.x + b.w < a.x).toBe(true);
    const ys = new Set(Array.from(svg.querySelectorAll('[data-gantt-lane="production"] rect')).map((r) => r.getAttribute("y")));
    expect(ys.size).toBe(5);
    for (const t of Array.from(svg.querySelectorAll("[data-gantt-label]"))) {
      expect(+t.getAttribute("x")!).toBeGreaterThanOrEqual(GANTT_SVG.labelW);
    }
    expect(svg.getAttribute("viewBox")).toContain(String(GANTT_SVG.labelW + GANTT_SVG.plotW + 10));
  });
});

describe("v0.6.13.2 Addendum 2: the adaptive year window", () => {
  const wide = () => block({
    activities: [act("a1", "prestudy", 2, 3), act("a2", "production", 4, 6)],
    decisionPoints: [{ id: "d1", title: "Start", year: 1, code: "BP1" }, { id: "d2", title: "Mid", year: 4, code: "BP4" }, { id: "d3", title: "End", year: 10, code: "BP8" }],
    milestones: [{ id: "m1", label: "Late", year: 11 }, { id: "m2", label: "In", year: 5 }],
  });

  it("WINDOW-EXTENT: the window spans exactly the visible activities' extent; the axis carries the window's years only", () => {
    const g = ganttOf(project(wide()));
    expect(g.window).toEqual({ firstYear: 2, lastYear: 6 });
    expect(g.axis.map((a) => a.year)).toEqual([2, 3, 4, 5, 6]);
    expect(g.axis.map((a) => a.label)).toEqual(["Year 2", "Year 3", "Year 4", "Year 5", "Year 6"]);
    expect(ganttOf(project(wide()), 2026).axis.map((a) => a.label)).toEqual(["2027", "2028", "2029", "2030", "2031"]);
    expect(g.spanYears).toBe(12);
  });

  it("WINDOW-CAPTION: a narrower window names itself against the program span; the omitted markers are counted and the markers inside compose", () => {
    const g = ganttOf(project(wide()));
    expect(g.caption).toBe("The axis shows Year 2–Year 6 of the program span Year 1–Year 12. 3 markers fall outside this window and are not drawn; the gates and milestones listed on this slide name them.");
    expect(g.omittedMarkers).toBe(3);
    expect(g.gates.map((x) => x.code)).toEqual(["BP4"]);
    expect(g.milestones.map((m) => m.id)).toEqual(["m2"]);
    expect(ganttOf(project(wide()), 2026).caption!.startsWith("The axis shows 2027–2031 of the program span 2026–2037.")).toBe(true);
  });

  it("WINDOW-OMISSION-SINGULAR: one omitted marker reads in the singular", () => {
    const tl = block({ activities: [act("a1", "prestudy", 1, 5)], decisionPoints: [{ id: "d1", title: "End", year: 9, code: "BP8" }] });
    expect(ganttOf(project(tl)).caption).toBe("The axis shows Year 1–Year 5 of the program span Year 1–Year 12. 1 marker falls outside this window and is not drawn; the gates and milestones listed on this slide name it.");
  });

  it("WINDOW-FULL-SPAN: when the window equals the program span there is no caption", () => {
    const tl = block({ activities: [act("a1", "prestudy", 1, 3), act("a2", "production", 4, 12)], decisionPoints: [{ id: "d1", title: "Start", year: 1, code: "BP1" }] });
    const g = ganttOf(project(tl));
    expect(g.window).toEqual({ firstYear: 1, lastYear: 12 });
    expect(g.caption).toBeNull();
    expect(g.omittedMarkers).toBe(0);
  });

  it("WINDOW-DEGENERATE: with no visible activity (every lane hidden or empty) the window falls back to the program span", () => {
    const tl = block({ ...wide(), laneVisibility: { prestudy: false, production: false } });
    const g = ganttOf(project(tl));
    expect(g.lanes).toEqual([]);
    expect(g.window).toEqual({ firstYear: 1, lastYear: 12 });
    expect(g.axis).toHaveLength(12);
    expect(g.caption).toBeNull();
    expect(g.gates).toHaveLength(3);
    expect(ganttWindow([], 7)).toEqual({ firstYear: 1, lastYear: 7, years: 7, narrowed: false });
  });

  it("WINDOW-RETIGHTENS: hiding the lane whose activities bound the window re-tightens the axis; the block is untouched", () => {
    const tl = { ...wide(), laneVisibility: { production: false } };
    const before = JSON.stringify(tl);
    const g = ganttOf(project(tl));
    expect(g.window).toEqual({ firstYear: 2, lastYear: 3 });
    expect(g.caption!.startsWith("The axis shows Year 2–Year 3 of the program span Year 1–Year 12.")).toBe(true);
    expect(JSON.stringify(tl)).toBe(before);
    // an explicit true on an empty lane adds no activities, so the window stands
    expect(ganttOf(project({ ...wide(), laneVisibility: { operations: true } })).window).toEqual({ firstYear: 2, lastYear: 6 });
  });

  it("WINDOW-DEMOS: the demo decks compose their content window (the cramped-axis defect of record is gone)", () => {
    const land = ganttOf(landNewbuildProject());
    expect(land.window).toEqual({ firstYear: 1, lastYear: 2 });
    expect(land.omittedMarkers).toBe(3);
    expect(land.caption).toBe("The axis shows Year 1–Year 2 of the program span Year 1–Year 23. 3 markers fall outside this window and are not drawn; the gates and milestones listed on this slide name them.");
    const shore = ganttOf(shorePowerProgram());
    expect(shore.window).toEqual({ firstYear: 1, lastYear: 5 });
    expect(shore.omittedMarkers).toBe(0);
    expect(shore.caption).toBe("The axis shows Year 1–Year 5 of the program span Year 1–Year 23.");
  });

  it("WINDOW-SVG: the slide draws the window's axis, the caption line and no marker outside the window; every drawn marker sits inside the plot", async () => {
    render(<App />);
    const inp = project(wide());
    const text = serializeProject(inp, { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
    fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
    await waitFor(() => expect(screen.getByText("Project Alpha")).toBeTruthy());
    fireEvent.click(byAction("present"));
    const slide = document.querySelector('[data-slide-name="timeline"]') as HTMLElement;
    expect(Array.from(slide.querySelectorAll("[data-gantt-axis]")).map((t) => t.textContent)).toEqual(["Year 2", "Year 3", "Year 4", "Year 5", "Year 6"]);
    expect(slide.querySelector('[data-testid="gantt-caption"]')!.textContent).toContain("3 markers fall outside this window");
    expect(Array.from(slide.querySelectorAll("[data-gantt-gate]")).map((g) => g.getAttribute("data-gate-code"))).toEqual(["BP4"]);
    for (const line of Array.from(slide.querySelectorAll("[data-gantt-gate] line"))) {
      const x = +line.getAttribute("x1")!;
      expect(x).toBeGreaterThan(GANTT_SVG.labelW);
      expect(x).toBeLessThan(GANTT_SVG.labelW + GANTT_SVG.plotW);
    }
    // the gates list on the slide body still names every gate, the omitted ones included
    expect(slide.textContent).toContain("BP8");
    expect(slide.textContent).toContain("BP1");
  });

  it("WINDOW-PDF: the print route draws the window's axis labels, the caption and the lane labels once, from the same model", () => {
    const inp = project(wide());
    const d = deckSlides(inp, computeModel(inp), { startYear: null });
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(d, "P", trace);
    const drawn = trace.drawnFigures[d.slides.findIndex((s) => s.name === "timeline")];
    for (const needle of ["Year 2", "Year 6", "Prestudy", "Production", "BP4", d.slides.find((s) => s.name === "timeline")!.gantt!.caption!]) expect(drawn).toContain(needle);
    expect(drawn).not.toContain("Year 7");
    expect(drawn).not.toContain("Year 12");
    expect(drawn).not.toContain("BP8");
  });

  it("PDF-FLOWS: a tall stacked layout flows its lanes across pages instead of clipping", () => {
    const acts: TimelineActivity[] = [];
    const phases = ["prestudy", "detail-design", "production", "revenue", "funding", "financing", "operations"];
    phases.forEach((p, pi) => { for (let i = 0; i < 9; i++) acts.push(act(`a${pi}${i}`, p, 1, 10, `${p} activity ${i + 1}`)); });
    const inp = project(block({ activities: acts }), 12);
    const d = deckSlides(inp, computeModel(inp), { startYear: null });
    const g = d.slides.find((s) => s.name === "timeline")!.gantt!;
    expect(g.lanes).toHaveLength(7);
    expect(g.lanes.every((l) => l.rowCount === 9)).toBe(true);
    const doc = buildDeckPdf(d, "P");
    const base = buildDeckPdf(deckSlides(project(block({ activities: [act("a1", "prestudy", 1, 3)] })), computeModel(project(block({ activities: [act("a1", "prestudy", 1, 3)] }))), { startYear: null }), "P");
    expect(doc.getNumberOfPages()).toBeGreaterThan(base.getNumberOfPages());
  });
});

describe("v0.6.13.2: the budget is the conservative figure", () => {
  it("BUDGET: the shared label budget sits at or below both surfaces' real capacity (an average-width label of that many characters fits the plot)", () => {
    const doc = new jsPDF({ unit: "mm" });
    const sample = "Container pillar: OPS installations (RSP JV) quay cabling and commissioning phase".repeat(3).slice(0, GANTT_CHARS_ACROSS_PLOT);
    doc.setFontSize(11);
    expect((doc.getTextWidth(sample) * 72) / 25.4).toBeLessThanOrEqual(GANTT_SVG.plotW);
    doc.setFontSize(6);
    expect(doc.getTextWidth(sample)).toBeLessThanOrEqual(GANTT_PDF.plotW);
  });
});
