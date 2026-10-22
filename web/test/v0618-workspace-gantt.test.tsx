// v0.6.18 Task I.1: the inline workspace Gantt. The Timeline section renders THE deck's composed model (never a
// recomposition); the v0.6.17 month features ride; the month gridlines follow the deck's view-state toggle.
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel } from "../src/engine.js";
import { deckSlides, workspaceGantt } from "../src/deck.js";
import { GANTT_SVG } from "../src/charts.js";
import { labelEm, GANTT_PLOT_EM } from "../src/ganttLayout.js";
import { demoProject, landNewbuildProject, shorePowerProgram } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const deckGantt = (inp: ModelInputs, monthGrid = false) => deckSlides(inp, computeModel(inp), { startYear: null, monthGrid }).slides.find((s) => s.name === "timeline")!.gantt!;

describe("v0.6.18 I.1: the workspace Gantt is the deck's model", () => {
  it("ONE-MODEL: the workspace model equals the deck slide's model exactly, with and without the month gridlines", () => {
    for (const make of [landNewbuildProject, shorePowerProgram]) {
      const inp = make();
      const r = computeModel(inp);
      for (const grid of [false, true]) {
        expect(JSON.stringify(workspaceGantt(inp, r, null, grid))).toBe(JSON.stringify(deckGantt(inp, grid)));
        expect(JSON.stringify(workspaceGantt(inp, r, 2026, grid))).toBe(JSON.stringify(deckSlides(inp, r, { startYear: 2026, monthGrid: grid }).slides.find((s) => s.name === "timeline")!.gantt));
      }
    }
  });

  it("ABSENT: an unauthored or refused timeline composes no workspace Gantt (as the deck omits the slide)", () => {
    const blank = demoProject();
    expect(workspaceGantt(blank, computeModel(blank), null, false)).toBeNull();
    const bad: ModelInputs = { ...demoProject(), projectLengthYears: 6, timeline: { activities: [{ id: "a1", label: "X", startYear: 1, endYear: 99, phase: "production" }], decisionPoints: [], milestones: [] } };
    expect(workspaceGantt(bad, computeModel(bad), null, false)).toBeNull();
  });
});

describe("v0.6.18 I.1: the Timeline section renders it", () => {
  it("RENDER: the section shows the chart with the model's lanes, bars, gates, milestones and caption; the month features ride", () => {
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    fireEvent.click(byNav("timeline"));
    const panel = document.querySelector('[data-testid="workspace-gantt"]') as HTMLElement;
    expect(panel).toBeTruthy();
    const g = deckGantt(landNewbuildProject());
    expect(panel.querySelectorAll("[data-gantt-lane]")).toHaveLength(g.lanes.length);
    expect(panel.querySelectorAll("[data-gantt-bar]")).toHaveLength(g.lanes.reduce((a, l) => a + l.bars.length, 0));
    expect(panel.querySelectorAll("[data-gantt-gate]")).toHaveLength(g.gates.length);
    expect(panel.querySelectorAll("[data-gantt-milestone]")).toHaveLength(g.milestones.length);
    expect(panel.querySelector('[data-testid="gantt-caption"]')!.textContent).toBe(g.caption);
    expect(panel.querySelectorAll("[data-gantt-computed]").length).toBe(1);
    expect(panel.querySelector('[data-testid="workspace-gantt-note"]')).toBeNull();
    // the chart sits on its own stage panel (legible in both app themes)
    expect(panel.className).toBe("workspace-gantt");
  });

  it("NOTE: with no authored timeline the section says where the Gantt will appear; nothing is drawn", () => {
    render(<App />);
    fireEvent.click(byNav("timeline"));
    expect(document.querySelector('[data-testid="workspace-gantt"]')).toBeNull();
    expect(screen.getByTestId("workspace-gantt-note").textContent).toBe("The program Gantt appears here once the timeline is authored and refusal-free.");
  });

  it("MONTH-GRID: the month gridlines toggle (a view state, not a document field) draws the gridlines in the workspace chart and the deck alike", () => {
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    fireEvent.click(byNav("timeline"));
    const count = () => document.querySelectorAll('[data-testid="workspace-gantt"] [data-gantt-month-grid]').length;
    expect(count()).toBe(0);
    fireEvent.click(document.querySelector('[data-field="monthGrid"]') as HTMLElement);
    expect(count()).toBe(3 * 11);
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 9; i++) { if (document.querySelector('[data-slide-name="timeline"][data-slide-active="true"]')) break; fireEvent.keyDown(window, { key: "ArrowRight" }); }
    expect(document.querySelectorAll('[data-slide-name="timeline"] [data-gantt-month-grid]').length).toBe(3 * 11);
  });

  it("LIVE: editing the timeline re-renders the workspace chart from the same model", async () => {
    render(<App />);
    const inp: ModelInputs = { ...demoProject(), projectLengthYears: 12, timeline: { activities: [{ id: "a1", label: "Build", startYear: 3, endYear: 5, phase: "production" }], decisionPoints: [], milestones: [] } };
    fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([serializeProject(inp, { startYear: null, entryUnit: "ones", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null })], "p.calcvibes.json", { type: "application/json" })] } });
    await waitFor(() => expect(screen.getByText("Project Alpha")).toBeTruthy());
    fireEvent.click(byNav("timeline"));
    expect(document.querySelectorAll('[data-testid="workspace-gantt"] [data-gantt-bar]')).toHaveLength(1);
    fireEvent.click(byAction("add-activity"));
    expect(document.querySelectorAll('[data-testid="workspace-gantt"] [data-gantt-bar]')).toHaveLength(2);
  });
});

describe("v0.6.18 H2 (the edge): the ring's label never crosses the window edge", () => {
  it("LAND: the computed ring at month 12 of the last window year takes its label on the LEFT; the text stays inside the plot", () => {
    const g = deckGantt(landNewbuildProject());
    const m = g.milestones.find((x) => x.computed !== null)!;
    expect(m.computed!.side).toBe("left");
    const years = g.window.lastYear - g.window.firstYear + 1;
    const colW = GANTT_SVG.plotW / years;
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    fireEvent.click(byNav("timeline"));
    const label = document.querySelector('[data-testid="workspace-gantt"] [data-gantt-computed-label]') as SVGTextElement;
    expect(label.getAttribute("text-anchor")).toBe("end");
    const widthPx = labelEm(m.computed!.label) * 11;
    const rightEdge = GANTT_SVG.labelW + GANTT_SVG.plotW;
    const x = parseFloat(label.getAttribute("x") as string);
    expect(x).toBeLessThanOrEqual(rightEdge);
    expect(x - widthPx).toBeGreaterThanOrEqual(GANTT_SVG.labelW);
    expect(GANTT_PLOT_EM).toBeGreaterThan(0);
    expect(colW).toBeGreaterThan(0);
  });
});
