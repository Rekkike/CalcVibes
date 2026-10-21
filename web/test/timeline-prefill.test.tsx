// v0.6.13.1 Task A: the cost-program suggestion affordance. The suggestion is NOT silent
// auto-population: the one click is the only route from the cost program into the timeline, and
// it commits through the existing setTimeline seam (the authored state flips).
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { demoProject, suggestActivitiesFromCosts, timelineAuthored } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { CostLine, ModelInputs } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const all = (sel: string) => Array.from(document.querySelectorAll(sel)) as HTMLElement[];

const recurring = (id: string, name: string, startYear: number, durationYears: number, extra: Partial<CostLine> = {}): CostLine =>
  ({ id, name, category: "recurring", amount: 100000, startYear, durationYears, escalation: 0, ...extra });
const capex = (id: string, name: string, startYear: number, extra: Partial<CostLine> = {}): CostLine =>
  ({ id, name, category: "capex", amount: 500000, startYear, durationYears: 0, escalation: 0, ...extra });
const withCosts = (costs: CostLine[], extra: Partial<ModelInputs> = {}): ModelInputs => ({ ...demoProject(), costs, ...extra });
const spans = (inp: ModelInputs) => suggestActivitiesFromCosts(inp).map((a) => [a.startYear, a.endYear]);

describe("v0.6.13.1 Task A: suggestActivitiesFromCosts (the pure derivation)", () => {
  it("RECURRING-SPAN: a recurring line spans startYear..startYear + ceil(duration) - 1; a fractional duration is charged as the next whole year", () => {
    expect(spans(withCosts([recurring("c1", "Burn", 2, 3)]))).toEqual([[2, 4]]);
    // the engine charges 2.5 years as three (the AUD-40 observation of record)
    expect(spans(withCosts([recurring("c1", "Burn", 1, 2.5)]))).toEqual([[1, 3]]);
    expect(spans(withCosts([recurring("c1", "Short", 4, 1)]))).toEqual([[4, 4]]);
  });

  it("CAPEX-LUMP: a capex line without overrides is the lump year; empty overrides read as none", () => {
    expect(spans(withCosts([capex("c1", "Lump", 3)]))).toEqual([[3, 3]]);
    expect(spans(withCosts([capex("c1", "Lump", 3, { yearOverrides: {} })]))).toEqual([[3, 3]]);
  });

  it("CAPEX-OVERRIDE-SPAN: a capex line with overrides spans min..max of the override-year keys; the inert startYear is ignored", () => {
    expect(spans(withCosts([capex("c1", "Profile", 9, { yearOverrides: { 5: 100000, 2: 200000, 4: 300000 } })]))).toEqual([[2, 5]]);
    expect(spans(withCosts([capex("c1", "Single", 9, { yearOverrides: { 3: 100000 } })]))).toEqual([[3, 3]]);
  });

  it("RECURRING-OVERRIDES-REFINE: a recurring line's overrides refine amounts inside the nominal span, never extend it", () => {
    expect(spans(withCosts([recurring("c1", "Burn", 2, 4, { yearOverrides: { 3: 50000 } })]))).toEqual([[2, 5]]);
  });

  it("LABELS-IDS-PHASE: the label is the cost line name; ids come from the shared nextId under the activity prefix; every phase is production; no gates or milestones", () => {
    const acts = suggestActivitiesFromCosts(withCosts([recurring("c1", "First", 1, 2), capex("c2", "Second", 2), recurring("c3", "Third", 3, 1)]));
    expect(acts.map((a) => a.label)).toEqual(["First", "Second", "Third"]);
    expect(acts.map((a) => a.id)).toEqual(["a1", "a2", "a3"]);
    expect(new Set(acts.map((a) => a.phase))).toEqual(new Set(["production"]));
    expect(Object.keys(acts[0]).sort()).toEqual(["endYear", "id", "label", "phase", "startYear"]);
  });

  it("OPERATING-EXCLUDED: operating lines derive no activity", () => {
    const base = withCosts([recurring("c1", "Burn", 1, 2)]);
    const withOps = { ...base, operatingLines: [{ id: "o1", label: "Ops", amount: 1000, startYear: 3, yearCount: 4, escalation: 0 }] };
    expect(suggestActivitiesFromCosts(withOps).map((a) => a.label)).toEqual(["Burn"]);
  });

  it("PURE: the derivation reads the inputs only and does not mutate them", () => {
    const inp = withCosts([capex("c1", "Profile", 9, { yearOverrides: { 2: 1, 4: 2 } })]);
    const before = JSON.stringify(inp);
    suggestActivitiesFromCosts(inp);
    expect(JSON.stringify(inp)).toBe(before);
  });
});

// A golden-template project (three cost lines: two recurring over years 1-3, one CAPEX lump in
// year 1) with one operating line, opened through the project file so no timeline block exists.
const project = (): ModelInputs => ({
  ...demoProject(),
  projectLengthYears: 12,
  operatingLines: [{ id: "o1", label: "Operations", amount: 100000, startYear: 4, yearCount: 5, escalation: 0 }],
});
async function openProject(inputs: ModelInputs) {
  render(<App />);
  const text = serializeProject(inputs, { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
  await waitFor(() => {
    expect(screen.getByText("Project Alpha")).toBeTruthy();
  });
  fireEvent.click(byNav("timeline"));
}

describe("v0.6.13.1 Task A: the suggest affordance in the Timeline section", () => {
  it("EMPTY-STATE: the re-anchored paragraph mentions the affordance; the button is seated and enabled while the grid is empty", async () => {
    await openProject(project());
    expect(screen.getByTestId("timeline-empty").textContent).toBe("No timeline authored yet. Add an activity, a decision gate or a milestone to start, or suggest activities from the cost program; the deck shows a program Gantt slide once the timeline is authored and refusal-free.");
    const btn = byAction("suggest-activities") as HTMLButtonElement;
    expect(btn.textContent).toBe("Suggest activities from the cost program");
    expect(btn.disabled).toBe(false);
  });

  it("NO-AUTO-POPULATE: opening a project never authors the timeline; the deck omits the slide until the user acts", async () => {
    await openProject(project());
    expect(all('[data-kind="activity"]').length).toBe(0);
    expect(timelineAuthored(project())).toBe(false);
    expect(document.querySelector('[data-testid="timeline-suggestion-note"]')).toBeNull();
  });

  it("CLICK: one click commits one activity per cost line, flips the authored state, and renders the review note", async () => {
    await openProject(project());
    fireEvent.click(byAction("suggest-activities"));
    const rows = all('[data-kind="activity"]');
    expect(rows.length).toBe(3);
    const read = (r: Element, f: string) => (r.querySelector('[data-field="' + f + '"]') as HTMLInputElement).value;
    expect(rows.map((r) => read(r, "activityLabel"))).toEqual(["Development team", "Infrastructure & licences", "Initial CAPEX"]);
    expect(rows.map((r) => [read(r, "activityStart"), read(r, "activityEnd")])).toEqual([["1", "3"], ["1", "3"], ["1", "1"]]);
    expect(rows.map((r) => read(r, "activityPhase"))).toEqual(["production", "production", "production"]);
    // the authored flip: the empty state is gone and the section shows no refusals
    expect(document.querySelector('[data-testid="timeline-empty"]')).toBeNull();
    expect(document.querySelector('[data-testid="timeline-refusals"]')).toBeNull();
    expect(screen.getByTestId("timeline-suggestion-note").textContent).toBe("Suggested 3 activities, one per cost line. Operating lines are excluded: they are a separate block, not program activities. Every activity enters in the Production phase because the phase cannot be derived from a cost line; review the spans and phases and adjust them.");
  });

  it("DECK: after the click the Gantt slide composes (authored and refusal-free)", async () => {
    await openProject(project());
    fireEvent.click(byAction("suggest-activities"));
    fireEvent.click(byAction("present"));
    expect(document.querySelector('[data-slide-name="timeline"]')).toBeTruthy();
  });

  it("GATING: once any activity exists the button is disabled with a reason; removing every activity re-enables it", async () => {
    await openProject(project());
    fireEvent.click(byAction("suggest-activities"));
    const btn = () => byAction("suggest-activities") as HTMLButtonElement;
    expect(btn().disabled).toBe(true);
    expect(btn().title).toBe("The suggestion is a starting draft and never merges into authored work: remove every activity to use it again.");
    fireEvent.click(btn());
    expect(all('[data-kind="activity"]').length).toBe(3);
    while (document.querySelector('[data-action="remove-activity"]') !== null) fireEvent.click(document.querySelector('[data-action="remove-activity"]') as HTMLElement);
    expect(btn().disabled).toBe(false);
  });

  it("GATING-AUTHORED: a hand-added activity disables the button too", async () => {
    await openProject(project());
    fireEvent.click(byAction("add-activity"));
    expect((byAction("suggest-activities") as HTMLButtonElement).disabled).toBe(true);
  });

  it("ZERO-LINES: with an empty cost program the click derives nothing, says so, and the timeline stays unauthored", () => {
    render(<App />);
    fireEvent.click(byNav("timeline"));
    fireEvent.click(byAction("suggest-activities"));
    expect(screen.getByTestId("timeline-suggestion-note").textContent).toBe("The cost program has no lines to derive activities from.");
    expect(screen.getByTestId("timeline-empty")).toBeTruthy();
    expect(all('[data-kind="activity"]').length).toBe(0);
  });

  it("NOTE-CLEARS: the review note disappears once the suggested activities are removed", async () => {
    await openProject(project());
    fireEvent.click(byAction("suggest-activities"));
    expect(document.querySelector('[data-testid="timeline-suggestion-note"]')).toBeTruthy();
    while (document.querySelector('[data-action="remove-activity"]') !== null) fireEvent.click(document.querySelector('[data-action="remove-activity"]') as HTMLElement);
    expect(document.querySelector('[data-testid="timeline-suggestion-note"]')).toBeNull();
  });

  it("KEEPS-AUTHORED-WORK: a suggestion keeps the gates and milestones already authored", async () => {
    await openProject(project());
    fireEvent.click(byAction("add-gate"));
    fireEvent.click(byAction("add-milestone"));
    fireEvent.click(byAction("suggest-activities"));
    expect(all('[data-kind="gate"]').length).toBe(1);
    expect(all('[data-kind="milestone"]').length).toBe(1);
    expect(all('[data-kind="activity"]').length).toBe(3);
  });
});
