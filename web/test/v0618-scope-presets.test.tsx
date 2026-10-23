// v0.6.18 Task E: the project-scale presets (Empty the default; Full populates the gates DP1-DP8; Mini the four
// of its set), the demo-honesty audit of the loader presets, and the one month-level demo project.
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import { scenarioResults } from "../../core/src/scenarios.js";
import {
  DECISION_POINT_SET, availableEngineEvents, demoProject, emptyTimeline, landNewbuildProject, migrateOnLoad, shorePowerProgram, solarParkProject,
  timelineOf, validateTimeline, withScalePreset,
} from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs, TimelineBlock } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const gateRows = () => Array.from(document.querySelectorAll('[data-kind="gate"]')) as HTMLElement[];
const codes = () => gateRows().map((r) => r.querySelector('[data-field="gateCode"]')!.textContent);
const scale = () => document.querySelector('[data-field="projectScale"]') as HTMLSelectElement;
const choose = (v: string) => fireEvent.change(scale(), { target: { value: v } });

describe("v0.6.18 Task E.1: the scale presets", () => {
  it("DEFAULT: the selector stands on Empty and no gate is populated; the empty block carries no scale", () => {
    render(<App />);
    fireEvent.click(byNav("timeline"));
    expect(scale().value).toBe("empty");
    expect(gateRows()).toHaveLength(0);
    expect(emptyTimeline()).toEqual({ activities: [], decisionPoints: [], milestones: [] });
    expect(timelineOf(demoProject()).projectScale).toBeUndefined();
  });

  it("POPULATION: Full = eight decision gates DP1-DP8 with their titles; Mini = four; Empty = none", () => {
    render(<App />);
    fireEvent.click(byNav("timeline"));
    choose("full");
    expect(codes()).toEqual(["DP1", "DP2", "DP3", "DP4", "DP5", "DP6", "DP7", "DP8"]);
    expect(gateRows().map((r) => (r.querySelector('[data-field="gateTitle"]') as HTMLInputElement).value)).toEqual(DECISION_POINT_SET.map((d) => d.title));
    document.body.innerHTML = "";
    render(<App />);
    fireEvent.click(byNav("timeline"));
    choose("mini");
    expect(codes()).toEqual(["DP1", "DP3", "DP4", "DP8"]);
    document.body.innerHTML = "";
    render(<App />);
    fireEvent.click(byNav("timeline"));
    choose("empty");
    expect(gateRows()).toHaveLength(0);
  });

  it("NEVER-DESTRUCTIVE: switching scale adds only the missing gates; an authored gate is never moved, renamed or removed", () => {
    render(<App />);
    fireEvent.click(byNav("timeline"));
    choose("full");
    fireEvent.change(gateRows()[1].querySelector('[data-field="gateYear"]') as HTMLInputElement, { target: { value: "5" } });
    choose("mini");
    expect(codes()).toHaveLength(8);
    choose("empty");
    expect(codes()).toHaveLength(8);
    expect((gateRows()[1].querySelector('[data-field="gateYear"]') as HTMLInputElement).value).toBe("5");
    choose("full");
    expect(codes()).toEqual(["DP1", "DP2", "DP3", "DP4", "DP5", "DP6", "DP7", "DP8"]);
    expect(scale().value).toBe("full");
  });

  it("PURE: withScalePreset adds the missing codes of the set at year 1 and keeps the rest byte-identical", () => {
    const tl: TimelineBlock = { activities: [], milestones: [], decisionPoints: [{ id: "d1", title: "Mine", year: 4, code: "DP3", outcome: "continue" }, { id: "d2", title: "Free", year: 2 }] };
    const out = withScalePreset(tl, "mini");
    expect(out.slice(0, 2)).toEqual(tl.decisionPoints);
    expect(out.slice(2).map((d) => [d.id, d.code, d.year])).toEqual([["d3", "DP1", 1], ["d4", "DP4", 1], ["d5", "DP8", 1]]);
    expect(withScalePreset({ ...tl, decisionPoints: out }, "mini")).toEqual(out);
    expect(withScalePreset(emptyTimeline(), "full")).toHaveLength(8);
  });

  it("DOCUMENT: Empty is the absent field; Full and Mini are the existing values; the file round-trips", async () => {
    render(<App />);
    fireEvent.click(byNav("timeline"));
    choose("full");
    const inp: ModelInputs = { ...demoProject(), timeline: { projectScale: "full", ...emptyTimeline(), decisionPoints: withScalePreset(emptyTimeline(), "full") } };
    expect(JSON.parse(serializeProject(inp, { startYear: null, entryUnit: "ones", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null })).project.timeline.projectScale).toBe("full");
    const emptyDoc = { ...inp, timeline: { ...inp.timeline!, projectScale: undefined } };
    expect(JSON.stringify(JSON.parse(serializeProject(emptyDoc as ModelInputs, { startYear: null, entryUnit: "ones", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null })).project.timeline)).not.toContain("projectScale");
    // an old document without the field opens as Empty, never re-populated
    document.body.innerHTML = "";
    render(<App />);
    const text = serializeProject(emptyDoc as ModelInputs, { startYear: null, entryUnit: "ones", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
    fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
    await waitFor(() => expect(screen.getByText("Project Alpha")).toBeTruthy());
    fireEvent.click(byNav("timeline"));
    expect(scale().value).toBe("empty");
    expect(gateRows()).toHaveLength(8);
  });

  it("DEGENERATE: an Empty-scale timeline with only a milestone composes a contentful axis (the program span), never a contentless one; a blank project is refused visibly", () => {
    const inp: ModelInputs = { ...demoProject(), projectLengthYears: 6, timeline: { activities: [], decisionPoints: [], milestones: [{ id: "m1", label: "Go", year: 2 }] } };
    const r = computeModel(inp);
    expect(validateTimeline(inp, r)).toEqual([]);
    const g = deckSlides(inp, r, { startYear: null }).slides.find((s) => s.name === "timeline")!.gantt!;
    expect(g.window).toEqual({ firstYear: 1, lastYear: 6 });
    expect(g.axis).toHaveLength(6);
    expect(g.lanes).toEqual([]);
    expect(g.milestones.map((m) => m.id)).toEqual(["m1"]);
    // a blank project computes or refuses visibly: either the input issues or the overview metrics render
    render(<App />);
    expect(document.querySelector('[data-testid="issues-summary"]') !== null || document.querySelector('[data-testid="overview"]') !== null).toBe(true);
    expect(document.querySelector('[data-testid="overview"]')).toBeTruthy();
  });
});

describe("v0.6.18 Task E.2: the demo-honesty audit — every loader preset carries only what the app can do", () => {
  const LOADERS: [string, () => ModelInputs, number[], number[] | null, number[] | null][] = [
    ["program", shorePowerProgram, [4, 6, 8], [15, 20, 25], [0, 8000000, 16000000]],
    ["land", landNewbuildProject, [6, 8, 10], null, null],
    ["solar", solarParkProject, [5, 7, 9], [15, 20, 25], [0, 1000000, 2000000]],
  ];
  // every key a preset fixture may carry has an authoring surface in the app (the sections of record)
  const SURFACE: Record<string, string> = {
    projectName: "Overview", currency: "Cost model", entryUnit: "the header", targetIrr: "Overview", costs: "Cost model", repayment: "Repayment",
    contracts: "Repayment", depreciationDefault: "Cost model", appraisal: "Appraisal", operatingLines: "Operating", maintenance: "Operating",
    tariff: "Tariff", financing: "Financing (the legacy shape migrates on load)", facilities: "Financing", facilityOptions: "Financing", funding: "Funding",
    projectLengthYears: "Overview", timeline: "Timeline",
  };

  it("SURFACES: every document key of every preset fixture maps to an authoring section", () => {
    for (const [, make] of LOADERS) for (const key of Object.keys(make())) expect(SURFACE[key], key).toBeDefined();
  });

  it("COMPUTE: each preset computes its base, every target and every balloon cell; the term cells compute or refuse with the engine's reason (the per-variant contract), never silently", () => {
    for (const [name, make, targets, terms, balloons] of LOADERS) {
      const inp = migrateOnLoad(make());
      const base = computeModel(inp);
      expect(base.paymentAmount, name).not.toBeNull();
      for (const g of targets) expect(computeModel({ ...inp, targetIrr: g }).paymentAmount, `${name} target ${g}`).not.toBeNull();
      for (const b of balloons ?? []) expect(computeModel({ ...inp, repayment: { ...inp.repayment, balloon: b } }).paymentAmount, `${name} balloon ${b}`).not.toBeNull();
      for (const x of terms ?? []) {
        let outcome: "computed" | "refused" = "computed";
        try { computeModel({ ...inp, repayment: { ...inp.repayment, termYears: x } }); } catch (e) { outcome = "refused"; expect((e as { issues?: string[] }).issues?.join(" ") ?? "", `${name} term ${x}`).toContain("declared tariff span"); }
        if (name === "program") expect(outcome).toBe(x === 25 ? "refused" : "computed");
        else expect(outcome, `${name} term ${x}`).toBe("computed");
      }
    }
  });

  it("NAMED-SCENARIOS: the program's optimistic scenario refuses by the engine's own reason (the disclosed honest refusal the Scenarios tab renders); the others compute", () => {
    const sc = scenarioResults(migrateOnLoad(shorePowerProgram()));
    expect(sc.base.refusal).toBeNull();
    expect(sc.pessimistic.refusal).toBeNull();
    expect(sc.optimistic.refusal).toContain("beyond the declared tariff span");
    for (const make of [landNewbuildProject, solarParkProject]) {
      const s = scenarioResults(migrateOnLoad(make()));
      expect([s.base.refusal, s.optimistic.refusal, s.pessimistic.refusal]).toEqual([null, null, null]);
    }
  });

  it("TIMELINES: every authored demo timeline is refusal-free against its own model", () => {
    for (const make of [shorePowerProgram, landNewbuildProject]) {
      const inp = make();
      expect(validateTimeline(inp, computeModel(inp))).toEqual([]);
    }
  });
});

describe("v0.6.18 Task E.3: the month-level demo project", () => {
  it("LAND: the land newbuild demo carries its activities, decision points and milestones at month granularity, in range and in order", () => {
    const inp = landNewbuildProject();
    const tl = inp.timeline!;
    expect(tl.activities.every((a) => a.startMonth !== undefined && a.endMonth !== undefined)).toBe(true);
    expect(tl.decisionPoints.every((d) => d.month !== undefined)).toBe(true);
    expect(tl.milestones.every((m) => m.month !== undefined)).toBe(true);
    for (const v of [...tl.activities.flatMap((a) => [a.startMonth!, a.endMonth!]), ...tl.decisionPoints.map((d) => d.month!), ...tl.milestones.map((m) => m.month!)]) {
      expect(Number.isInteger(v) && v >= 1 && v <= 12).toBe(true);
    }
    expect(validateTimeline(inp, computeModel(inp))).toEqual([]);
    // chronological authoring: gates and milestones ascend by (year, month)
    const key = (x: { year: number; month?: number }) => x.year * 100 + (x.month ?? 0);
    expect(tl.decisionPoints.map(key)).toEqual([...tl.decisionPoints.map(key)].sort((a, b) => a - b));
    expect(tl.milestones.map(key)).toEqual([...tl.milestones.map(key)].sort((a, b) => a - b));
    // the month ties: construction complete is the engine's own year; the first collection year is the engine's year
    const events = availableEngineEvents(inp, computeModel(inp));
    expect(events.find((e) => e.event === "construction-complete")!.year).toBe(tl.milestones[0].year);
    expect(events.find((e) => e.event === "first-collection-year")!.year).toBe(tl.milestones[2].year);
  });

  it("DECK: the sub-year positions are composed (bars start and end inside their years; gates and milestones sit off the year centre); a tied marker draws at its live position", () => {
    const inp = landNewbuildProject();
    const g = deckSlides(inp, computeModel(inp), { startYear: null }).slides.find((s) => s.name === "timeline")!.gantt!;
    const bars = g.lanes.flatMap((l) => l.bars);
    expect(bars.some((b) => !Number.isInteger(b.left) || !Number.isInteger(b.right))).toBe(true);
    expect(g.gates.every((x) => x.month !== null)).toBe(true);
    expect(g.gates.some((x) => x.pos !== x.year - g.window.firstYear + 0.5)).toBe(true);
    const first = g.milestones.find((m) => m.tie === "first-collection-year")!;
    // v0.6.19: a tied marker draws at the live position only: the engine's computed month 12 (the authored month 1 is the fallback)
    expect(first.month).toBe(12);
    expect(first.year).toBe(3);
    expect("computed" in first).toBe(false);
    // the year-level demo stays year-grained
    const shore = shorePowerProgram();
    expect(JSON.stringify(shore.timeline)).not.toMatch(/Month|"month"/);
  });

  it("LOADED: the demo loads through the app with its months riding in the Timeline section", () => {
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    fireEvent.click(byNav("timeline"));
    expect(document.querySelectorAll('[data-kind="activity"]').length).toBe(5);
    expect(document.querySelector('[data-testid="timeline-refusals"]')).toBeNull();
    expect((document.querySelector('[data-kind="activity"] [data-field="activityStartMonth"]') as HTMLInputElement | null)?.value).toBe("1");
  });
});
