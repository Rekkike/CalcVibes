// v0.6.13.4: the milestone identifiability. Each milestone carries a composed ordinal (its rank in
// the chronological order of the FULL milestone set, never derived from the authored id); the
// timeline slide's text lines and the diamonds on both Gantt surfaces carry it. Colour is not varied.
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import type { DeckGantt } from "../src/deck.js";
import { buildDeckPdf } from "../src/pdf.js";
import { demoProject, landNewbuildProject, shorePowerProgram } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs, TimelineBlock } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const block = (over: Partial<TimelineBlock>): TimelineBlock => ({ projectScale: "full", activities: [], decisionPoints: [], milestones: [], ...over });
const project = (tl: TimelineBlock, years = 12): ModelInputs => ({ ...demoProject(), projectLengthYears: years, timeline: tl });
const slideOf = (inp: ModelInputs) => deckSlides(inp, computeModel(inp), { startYear: null }).slides.find((s) => s.name === "timeline")!;

// Authored out of chronological order, with ids that are NOT in rank order and two milestones in
// the same year; the activities bound the window to years 3-8, so the year-1 milestone is omitted.
const milestones = () => [
  { id: "m7", label: "Handover", year: 6 },
  { id: "m2", label: "Kickoff", year: 1 },
  { id: "m9", label: "Permit granted", year: 3 },
  { id: "m4", label: "Commissioning", year: 6 },
];
const model = () => project(block({
  activities: [{ id: "a1", label: "Build", startYear: 3, endYear: 8, phase: "production" }],
  milestones: milestones(),
}));

describe("v0.6.13.4 Tasks A and E: the ordinal of record", () => {
  it("ORDINAL: the ordinals run 1..n in chronological order over the full set; same-year milestones keep their authored order; the id plays no part", () => {
    const slide = slideOf(project(block({ activities: [{ id: "a1", label: "Build", startYear: 1, endYear: 8, phase: "production" }], milestones: milestones() })));
    const g = slide.gantt!;
    expect(g.milestones.map((m) => [m.ordinal, m.id, m.year])).toEqual([[1, "m2", 1], [2, "m9", 3], [3, "m7", 6], [4, "m4", 6]]);
  });

  it("ORDINAL-STABILITY: a window that omits the first milestone leaves the later ordinals unchanged", () => {
    const g = slideOf(model()).gantt!;
    expect(g.window).toEqual({ firstYear: 3, lastYear: 8 });
    expect(g.milestones.map((m) => [m.ordinal, m.id])).toEqual([[2, "m9"], [3, "m7"], [4, "m4"]]);
    expect(g.omittedMarkers).toBe(1);
  });

  it("ORDINAL-SAME-YEAR-ROWS: milestones sharing a year stack on distinct rows, composed once in the model", () => {
    const g = slideOf(model()).gantt!;
    expect(g.milestones.map((m) => [m.ordinal, m.row])).toEqual([[2, 0], [3, 0], [4, 1]]);
  });
});

describe("v0.6.13.4 Tasks B and E: the numbered text lines", () => {
  it("TEXT-LINES: the slide lists every milestone as 'Milestone N' in order, the value form unchanged, including the omitted one", () => {
    const body = slideOf(model()).body.filter((f) => f.label.startsWith("Milestone"));
    expect(body.map((f) => f.label)).toEqual(["Milestone 1", "Milestone 2", "Milestone 3", "Milestone 4"]);
    expect(body.map((f) => f.value)).toEqual(["Kickoff — Year 1", "Permit granted — Year 3", "Handover — Year 6", "Commissioning — Year 6"]);
    expect(body.map((f) => [f.kind, f.rawValue])).toEqual([["text", 1], ["text", 3], ["text", 6], ["text", 6]]);
  });

  it("OMISSION: an omitted marker stays counted and is named by its ordinal and label on the listing route", () => {
    const slide = slideOf(model());
    expect(slide.gantt!.omittedMarkers).toBe(1);
    expect(slide.gantt!.caption).toContain("1 marker falls outside this window");
    expect(slide.body.some((f) => f.label === "Milestone 1" && f.value.startsWith("Kickoff"))).toBe(true);
  });

  it("DEMOS: the demo decks number their milestones 1..n and the slide count is ten (v0.6.18: the operations slide)", () => {
    for (const make of [shorePowerProgram, landNewbuildProject]) {
      const inp = make();
      const deck = deckSlides(inp, computeModel(inp), { startYear: null, scenarioTargets: [4, 6, 8], scenarioTerms: [15, 20, 25], scenarioBalloons: [0, 8, 16] });
      expect(deck.slides).toHaveLength(10);
      const n = inp.timeline!.milestones.length;
      const labels = deck.slides.find((s) => s.name === "timeline")!.body.filter((f) => f.label.startsWith("Milestone")).map((f) => f.label);
      expect(labels).toEqual(Array.from({ length: n }, (_, i) => `Milestone ${i + 1}`));
    }
  });
});

describe("v0.6.13.4 Tasks C and E: the numbered diamonds on the Presentation SVG", () => {
  it("DIAMONDS-SVG: each diamond carries its ordinal as text beside it, the fill is unchanged, same-year diamonds never share a position", async () => {
    render(<App />);
    const text = serializeProject(model(), { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
    fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
    await waitFor(() => expect(screen.getByText("Project Alpha")).toBeTruthy());
    fireEvent.click(byAction("present"));
    const slide = document.querySelector('[data-slide-name="timeline"]') as HTMLElement;
    const marks = Array.from(slide.querySelectorAll("[data-gantt-milestone]"));
    expect(marks.map((m) => m.getAttribute("data-gantt-milestone"))).toEqual(["m9", "m7", "m4"]);
    expect(marks.map((m) => m.querySelector("[data-gantt-milestone-number]")!.textContent)).toEqual(["2", "3", "4"]);
    for (const m of marks) expect(m.querySelector("polygon")!.getAttribute("fill")).toBe("#34d399");
    const centers = marks.map((m) => {
      const pts = m.querySelector("polygon")!.getAttribute("points")!.split(" ").map((p) => p.split(",").map(Number));
      return [(Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2, (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2];
    });
    expect(new Set(centers.map((c) => c.join(","))).size).toBe(3);
    // the number sits under its own diamond, below the gate-code line, inside the plot
    const gateCodeY = Math.max(...Array.from(slide.querySelectorAll("[data-gantt-gate] text")).map((t) => +t.getAttribute("y")!), 0);
    marks.forEach((m, i) => {
      const num = m.querySelector("[data-gantt-milestone-number]")!;
      expect(+num.getAttribute("x")!).toBe(centers[i][0]);
      expect(+num.getAttribute("y")!).toBeGreaterThan(centers[i][1]);
      expect(+num.getAttribute("y")!).toBeGreaterThan(gateCodeY);
    });
    expect(marks[0].querySelector("title")!.textContent).toBe("Milestone 2: Permit granted");
    const viewHeight = +(slide.querySelector("svg")!.getAttribute("viewBox")!.split(" ")[3]);
    for (const c of centers) expect(c[1] + 24).toBeLessThanOrEqual(viewHeight);
  });
});

describe("v0.6.13.4 Tasks D and E: the numbered diamonds on the print route", () => {
  // The print route's drawn text is read from the document stream: the same deck is built with and
  // without its drawn milestones, and the difference is exactly the diamond numbers.
  const numberTokens = (g: DeckGantt | null, inp: ModelInputs): string[] => {
    const deck = deckSlides(inp, computeModel(inp), { startYear: null });
    if (g === null) deck.slides.find((s) => s.name === "timeline")!.gantt!.milestones = [];
    const out = buildDeckPdf(deck, "P").output();
    return (out.match(/\(\d{1,2}\) Tj/g) ?? []).sort();
  };

  it("DIAMONDS-PDF: the print Gantt draws each ordinal once beside its diamond", () => {
    const inp = model();
    const full = slideOf(inp).gantt!;
    const withNumbers = numberTokens(full, inp);
    const without = numberTokens(null, inp);
    const diff = [...withNumbers];
    for (const t of without) diff.splice(diff.indexOf(t), 1);
    expect(diff).toEqual(["(2) Tj", "(3) Tj", "(4) Tj"]);
  });

  it("DIAMONDS-PDF-DEMOS: the demo decks draw one number per drawn diamond", () => {
    for (const make of [shorePowerProgram, landNewbuildProject]) {
      const inp = make();
      const full = slideOf(inp).gantt!;
      const diff = [...numberTokens(full, inp)];
      for (const t of numberTokens(null, inp)) diff.splice(diff.indexOf(t), 1);
      expect(diff).toHaveLength(full.milestones.length);
    }
  });
});
