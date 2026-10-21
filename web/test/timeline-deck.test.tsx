import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel } from "../../core/src/engine.js";
import { deckSlides, ganttTitle } from "../src/deck.js";
import { buildDeckPdf } from "../src/pdf.js";
import { demoProject, landNewbuildProject, shorePowerProgram } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs, TimelineBlock } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

const timeline = (): TimelineBlock => ({
  projectScale: "full",
  activities: [
    { id: "a1", label: "Feasibility", startYear: 1, endYear: 2, phase: "prestudy" },
    { id: "a2", label: "Design", startYear: 3, endYear: 4, phase: "detail-design" },
    { id: "a3", label: "Build", startYear: 5, endYear: 8, phase: "production" },
  ],
  decisionPoints: [
    { id: "d1", title: "Beslut om att starta projektet och initiera förberedelserna", year: 1, code: "BP1", outcome: "continue" },
    { id: "d2", title: "Beslut om att fortsätta, avbryta eller göra om förberedelsearbete", year: 2, code: "BP2" },
    { id: "d3", title: "Beslut om att det finns tillräckligt bra underlag för att göra ett åtagande för resterande del av projektet", year: 3, code: "BP3" },
    { id: "d4", title: "Beslut att starta genomförandet", year: 4, code: "BP4" },
    { id: "d5", title: "Beslut om att avsluta projektet", year: 8, code: "BP8" },
  ],
  milestones: [{ id: "m1", label: "Handover", year: 8, tie: { kind: "activity", activityId: "a3" } }],
});
const withTl = (tl?: TimelineBlock): ModelInputs => ({ ...demoProject(), projectLengthYears: 8, ...(tl !== undefined ? { timeline: tl } : {}) });
const deckOf = (inp: ModelInputs, startYear: number | null = null, extra: object = {}) => deckSlides(inp, computeModel(inp), { startYear, ...extra });

describe("v0.6.13 the Gantt deck slide", () => {
  it("SEAT: one slide, immediately after the investment slide, with the composed action title", () => {
    const d = deckOf(withTl(timeline()));
    const names = d.slides.map((s) => s.name);
    const i = names.indexOf("investment");
    expect(i).toBeGreaterThan(0);
    expect(names[i + 1]).toBe("timeline");
    expect(names.filter((n) => n === "timeline")).toHaveLength(1);
    expect(d.slides[i + 1].title).toBe("The program runs years 1–8 with five decision gates");
    expect(ganttTitle(8, 1, null)).toBe("The program runs years 1–8 with one decision gate");
    expect(ganttTitle(8, 0, 2026)).toBe("The program runs years 2026–2033 with no decision gates");
    expect(ganttTitle(8, 12, null)).toBe("The program runs years 1–8 with 12 decision gates");
  });

  it("MODEL: the phases are lanes, the gates carry their codes, the axis rides yearHeader", () => {
    const g = deckOf(withTl(timeline()), 2026).slides.find((s) => s.name === "timeline")!.gantt!;
    expect(g.lanes.map((l) => l.label)).toEqual(["Prestudy", "Detail design", "Production"]);
    expect(g.lanes.map((l) => l.bars.map((b) => b.label))).toEqual([["Feasibility"], ["Design"], ["Build"]]);
    expect(g.gates.map((x) => x.code)).toEqual(["BP1", "BP2", "BP3", "BP4", "BP8"]);
    expect(g.axis.map((a) => a.label)).toEqual(["2026", "2027", "2028", "2029", "2030", "2031", "2032", "2033"]);
    expect(deckOf(withTl(timeline())).slides.find((s) => s.name === "timeline")!.gantt!.axis[0].label).toBe("Year 1");
    expect(g.milestones).toEqual([{ id: "m1", label: "Handover", year: 8, tie: "activity a3" }]);
    const body = deckOf(withTl(timeline())).slides.find((s) => s.name === "timeline")!.body.map((f) => f.label);
    expect(body).toContain("BP1");
  });

  it("VARIANT-INVARIANT: the slide is composed once and is identical under any scenario axes", () => {
    const a = deckOf(withTl(timeline())).slides.find((s) => s.name === "timeline");
    const b = deckOf(withTl(timeline()), null, { scenarioTargets: [4, 6, 8], scenarioTerms: [5, 7], scenarioBalloons: [0, 100] }).slides.find((s) => s.name === "timeline");
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("OMISSION: not authored and refused timelines omit the slide and the provenance says why", () => {
    for (const inp of [withTl(), withTl({ activities: [], decisionPoints: [], milestones: [] })]) {
      const d = deckOf(inp);
      expect(d.slides.some((s) => s.name === "timeline")).toBe(false);
      expect(d.provenance).toContain("Timeline: not authored.");
    }
    const bad = timeline();
    bad.decisionPoints[0].year = 40;
    const d = deckOf(withTl(bad));
    expect(d.slides.some((s) => s.name === "timeline")).toBe(false);
    expect(d.provenance).toContain("Timeline: refused — see the Timeline tab.");
    expect(deckOf(withTl(timeline())).provenance!.some((p) => p.startsWith("Timeline:"))).toBe(false);
  });

  it("KICKERS: the sequence re-composes for the new slide count, one number per slide, none empty", () => {
    const d = deckOf(withTl(timeline()));
    const kickers = d.slides.filter((s) => s.name !== "title").map((s) => s.kickerNumber);
    expect(kickers.every((k) => k !== undefined && k !== "")).toBe(true);
    expect(new Set(kickers).size).toBe(kickers.length);
    expect(kickers[kickers.length - 1]).toBe(String(kickers.length).padStart(2, "0"));
  });

  it("KICKERS (full deck): the eight non-title slides of the shore-power program with scenarios carry 01 through 08", () => {
    const inp = { ...shorePowerProgram(), timeline: timeline() };
    const d = deckSlides(inp, computeModel(inp), { startYear: null, scenarioTargets: [4, 6], scenarioTerms: [15, 20], scenarioBalloons: [0, 8] });
    expect(d.slides.map((s) => s.name)).toEqual(["title", "summary", "investment", "timeline", "recovery", "coverage", "returns", "deal", "scenarios"]);
    expect(d.slides.filter((s) => s.name !== "title").map((s) => s.kickerNumber)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08"]);
  });

  it("PDF: the print route draws the title, the lanes, the bars and the BP-coded gates", () => {
    const d = deckOf(withTl(timeline()), 2026);
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(d, "P", trace);
    expect(trace.drawnTitles).toContain("The program runs years 2026–2033 with five decision gates");
    const idx = d.slides.findIndex((s) => s.name === "timeline");
    const drawn = trace.drawnFigures[idx];
    for (const needle of ["Prestudy", "Detail design", "Production", "Build", "BP1", "BP8", "2026"]) expect(drawn).toContain(needle);
  });

  it("PRESENTATION: the slide renders the SVG Gantt with lanes, bars, gate lines and diamonds", async () => {
    render(<App />);
    const text = serializeProject(withTl(timeline()), { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
    fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
    await waitFor(() => expect(screen.getByText("Project Alpha")).toBeTruthy());
    fireEvent.click(byAction("present"));
    const slide = document.querySelector('[data-slide-name="timeline"]') as HTMLElement;
    expect(slide).toBeTruthy();
    expect(slide.querySelector("h2")!.textContent).toBe("The program runs years 1–8 with five decision gates");
    expect(slide.querySelectorAll("[data-gantt-lane]")).toHaveLength(3);
    expect(slide.querySelectorAll("[data-gantt-bar]")).toHaveLength(3);
    expect(Array.from(slide.querySelectorAll("[data-gantt-gate]")).map((g) => g.getAttribute("data-gate-code"))).toEqual(["BP1", "BP2", "BP3", "BP4", "BP8"]);
    expect(slide.querySelectorAll("[data-gantt-milestone] polygon")).toHaveLength(1);
    expect(slide.textContent).toContain("does not implement or certify PPS");
  });
});

describe("v0.6.13 the byte-identity lock: computeModel is inert to the timeline block", () => {
  const lock = (name: string, mk: () => ModelInputs) => {
    it(name, () => {
      const absent = JSON.stringify(computeModel(mk()));
      expect(JSON.stringify(computeModel({ ...mk(), timeline: timeline() }))).toBe(absent);
      expect(JSON.stringify(computeModel({ ...mk(), timeline: { activities: [], decisionPoints: [], milestones: [] } }))).toBe(absent);
      // an out-of-span timeline never reaches the engine either
      const bad = timeline();
      bad.activities[0].endYear = 999;
      expect(JSON.stringify(computeModel({ ...mk(), timeline: bad }))).toBe(absent);
    });
  };
  lock("the golden template (Alpha)", () => demoProject());
  lock("landNewbuildProject", landNewbuildProject);
  lock("shorePowerProgram", shorePowerProgram);

  it("the demo fixtures carry no timeline block", () => {
    expect(landNewbuildProject().timeline).toBeUndefined();
    expect(shorePowerProgram().timeline).toBeUndefined();
    expect(demoProject().timeline).toBeUndefined();
  });
});
