// v0.6.13.2 Task A (the phase vocabulary on the block) and Task B (the per-source suggestion
// buttons). The derivations are pure; the buttons commit through the existing setTimeline seam.
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel } from "../src/engine.js";
import {
  TIMELINE_PHASES, activitiesInPhase, demoProject, ensurePhases, financingSuggestionBlock, landNewbuildProject, phaseVocabularyIssues,
  replaceSourceActivities, shorePowerProgram, sourceHasActivities, suggestActivitiesFromContracts, suggestActivitiesFromCosts,
  suggestActivitiesFromFinancing, suggestActivitiesFromFunding, suggestActivitiesFromOperating, suggestActivitiesFromTariff,
  tariffSuggestionBlock, timelineOf, validateTimeline, visibleLanes,
} from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs, TimelineActivity, TimelineBlock } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const all = (sel: string) => Array.from(document.querySelectorAll(sel)) as HTMLElement[];
const without = (inp: ModelInputs): ModelInputs => {
  const { timeline: _drop, ...rest } = inp;
  return rest as ModelInputs;
};
const span = (a: TimelineActivity) => [a.startYear, a.endYear];
const act = (id: string, phase: string, startYear = 1, endYear = 2, extra: Partial<TimelineActivity> = {}): TimelineActivity => ({ id, label: "L" + id, startYear, endYear, phase, ...extra });
const block = (over: Partial<TimelineBlock> = {}): TimelineBlock => ({ activities: [], decisionPoints: [], milestones: [], ...over });

describe("v0.6.13.2 Task A: the phase vocabulary on the block", () => {
  it("VOCABULARY-DEFAULTS: the curated vocabulary is seven phases in definition order; an absent list reads as the defaults", () => {
    expect(TIMELINE_PHASES.map((p) => p.id)).toEqual(["prestudy", "detail-design", "production", "revenue", "funding", "financing", "operations"]);
    expect(TIMELINE_PHASES.map((p) => p.label)).toEqual(["Prestudy", "Detail design", "Production", "Revenue", "Funding", "Financing", "Operations"]);
    expect(timelineOf(demoProject()).phases).toEqual(TIMELINE_PHASES);
    const own = [{ id: "x", label: "X" }];
    expect(timelineOf({ ...demoProject(), timeline: block({ phases: own }) }).phases).toEqual(own);
  });

  it("VOCABULARY-DUPLICATES: a duplicate phase id is named at the section level, not as a timeline refusal code", () => {
    const issues = phaseVocabularyIssues(block({ phases: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "a", label: "A2" }] }));
    expect(issues).toEqual(['The phase id "a" appears more than once in the phase vocabulary: rename or delete the duplicate so every phase id is unique.']);
    expect(phaseVocabularyIssues(block())).toEqual([]);
  });

  it("PHASE-UNKNOWN: an activity whose phase is outside the block's vocabulary is refused by name with the code, regardless of source", () => {
    const inp = (tl: TimelineBlock): ModelInputs => ({ ...demoProject(), projectLengthYears: 12, timeline: tl });
    const refuse = (tl: TimelineBlock) => validateTimeline(inp(tl), computeModel(inp(tl)));
    expect(refuse(block({ activities: [act("a1", "prestudy")] }))).toEqual([]);
    const r = refuse(block({ activities: [act("a1", "nowhere"), act("a2", "revenue", 1, 2, { derivedFrom: "tariff" })], phases: [{ id: "prestudy", label: "Prestudy" }] }));
    expect(r.map((x) => x.code)).toEqual(["TIMELINE-PHASE-UNKNOWN", "TIMELINE-PHASE-UNKNOWN"]);
    expect(r[0].message).toBe('Activity a1 (La1) carries the phase "nowhere", which is not in the block\'s phase vocabulary (prestudy): choose one of those phases or add the phase to the vocabulary (TIMELINE-PHASE-UNKNOWN).');
  });

  it("PHASE-REFERENCES: activitiesInPhase names the referencing activities; ensurePhases re-adds a deleted curated phase", () => {
    const tl = timelineOf({ ...demoProject(), timeline: block({ activities: [act("a1", "production"), act("a2", "revenue")] }) });
    expect(activitiesInPhase(tl, "production").map((a) => a.id)).toEqual(["a1"]);
    const trimmed = { ...tl, phases: tl.phases!.filter((p) => p.id !== "revenue") };
    expect(ensurePhases(trimmed, [act("a9", "revenue")]).map((p) => p.id)).toEqual(["prestudy", "detail-design", "production", "funding", "financing", "operations", "revenue"]);
    expect(ensurePhases(tl, [act("a9", "revenue")]).length).toBe(7);
  });
});

describe("v0.6.13.2 Task B: the per-source derivations (the pure helpers)", () => {
  it("CONTRACTS: one activity per contract over startYear..startYear + termYears - 1 plus one short activity per reinvestment; phase revenue; the marker", () => {
    const inp = { ...demoProject(), contracts: [
      { id: "k1", label: "Lease A", startYear: 3, termYears: 10, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" as const, reinvestments: [{ year: 8, amount: 100 }, { year: 11, amount: 50 }] },
      { id: "k2", label: "Lease B", startYear: 4, termYears: 5, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" as const },
    ] };
    const acts = suggestActivitiesFromContracts(inp);
    expect(acts.map((a) => a.label)).toEqual(["Lease A", "Lease A — reinvestment", "Lease A — reinvestment", "Lease B"]);
    expect(acts.map(span)).toEqual([[3, 12], [8, 8], [11, 11], [4, 8]]);
    expect(new Set(acts.map((a) => a.phase))).toEqual(new Set(["revenue"]));
    expect(new Set(acts.map((a) => a.derivedFrom))).toEqual(new Set(["contracts"]));
    expect(acts.map((a) => a.id)).toEqual(["a1", "a2", "a3", "a4"]);
  });

  it("FUNDING: a grant is its lump year; an interest-free note spans the draw to the final repayment", () => {
    const rows = [
      { id: "f1", label: "Grant", kind: "grant" as const, amount: 1, year: 3 },
      { id: "f2", label: "Note", kind: "interest-free-loan" as const, amount: 1, year: 1, termYears: 10, repaymentStartYear: 4 },
      { id: "f3", label: "Bare note", kind: "interest-free-loan" as const, amount: 1, year: 2 },
      { id: "f4", label: "Early repay", kind: "interest-free-loan" as const, amount: 1, year: 6, termYears: 2, repaymentStartYear: 1 },
    ];
    const acts = suggestActivitiesFromFunding({ ...demoProject(), funding: { rows } });
    expect(acts.map(span)).toEqual([[3, 3], [1, 13], [2, 2], [6, 6]]);
    expect(new Set(acts.map((a) => a.phase))).toEqual(new Set(["funding"]));
    expect(new Set(acts.map((a) => a.derivedFrom))).toEqual(new Set(["funding"]));
  });

  it("FINANCING: one 'Debt facility'; a declared service start spans start..start + term - 1; an undeclared one reads the solved service start; off or unsolved derives nothing", () => {
    const fin = (over: object) => ({ enabled: true, sharePct: 50, debtRatePct: 5, termYears: 10, graceYears: 0, serviceStartYear: 4, amortization: "annuity" as const, leveragedSolve: false, perLineSharePct: {}, ...over });
    const declared = { ...demoProject(), financing: fin({}) };
    expect(suggestActivitiesFromFinancing(declared, null).map((a) => [a.label, ...span(a), a.phase, a.derivedFrom])).toEqual([["Debt facility", 4, 13, "financing", "financing"]]);
    const shore = shorePowerProgram();
    const solved = computeModel(shore);
    const start = Math.ceil(solved.financing!.serviceStartMonth / 12);
    expect(span(suggestActivitiesFromFinancing(shore, solved)[0])).toEqual([start, start + shore.financing!.termYears - 1]);
    expect(financingSuggestionBlock(shore, null)).toBe("The service start is derived from the solved model: resolve the model's input issues first, or set a service start year.");
    expect(suggestActivitiesFromFinancing(shore, null)).toEqual([]);
    expect(financingSuggestionBlock(demoProject(), null)).toBe("The debt facility is off: enable financing to derive its activity.");
    expect(financingSuggestionBlock(declared, null)).toBeNull();
  });

  it("OPERATING: one activity per operating line over startYear..startYear + yearCount - 1; phase operations", () => {
    const inp = { ...demoProject(), operatingLines: [{ id: "o1", label: "Ops", amount: 1, startYear: 3, yearCount: 4, escalation: 0 }] };
    const acts = suggestActivitiesFromOperating(inp);
    expect(acts.map((a) => [a.label, ...span(a), a.phase, a.derivedFrom])).toEqual([["Ops", 3, 6, "operations", "operating"]]);
  });

  it("TARIFF: a row span wins over the common span; rows with neither derive nothing; no span anywhere disables the source with the disclosed reason", () => {
    const rows = [
      { id: "t1", label: "Common", weight: 1, lifts: [] },
      { id: "t2", label: "Own", weight: 1, lifts: [], span: { startYear: 5, termYears: 19 } },
    ];
    const tariff = { mode: "decompose" as const, escalationPerYear: 0, rows, fixedAnnualAmount: null, manualPrices: null, span: { startYear: 3, termYears: 20 } };
    const acts = suggestActivitiesFromTariff({ ...demoProject(), tariff });
    expect(acts.map((a) => [a.label, ...span(a), a.phase, a.derivedFrom])).toEqual([["Common", 3, 22, "revenue", "tariff"], ["Own", 5, 23, "revenue", "tariff"]]);
    const bare = { ...demoProject(), tariff: { ...tariff, span: null } };
    expect(suggestActivitiesFromTariff(bare).map((a) => a.label)).toEqual(["Own"]);
    const none = { ...demoProject(), tariff: { ...tariff, span: null, rows: [rows[0]] } };
    expect(tariffSuggestionBlock(none)).toBe("No tariff span is declared: the tariff grid is repayment-shaped rather than year-pinned, so declare a tariff span (or a row span) to derive activities.");
    expect(suggestActivitiesFromTariff(none)).toEqual([]);
    expect(tariffSuggestionBlock({ ...demoProject(), tariff })).toBeNull();
  });

  it("REPLACE-IDEMPOTENT: a re-suggestion replaces only that source's entries; hand-authored and other-source entries are preserved; ids never collide", () => {
    const inp = { ...demoProject(), operatingLines: [{ id: "o1", label: "Ops", amount: 1, startYear: 3, yearCount: 4, escalation: 0 }] };
    const existing: TimelineActivity[] = [act("a1", "prestudy"), act("a2", "operations", 1, 1, { derivedFrom: "operating" }), act("a3", "production", 1, 1, { derivedFrom: "cost-program" })];
    const taken = existing.filter((a) => a.derivedFrom !== "operating").map((a) => a.id);
    const derived = suggestActivitiesFromOperating(inp, taken);
    const next = replaceSourceActivities(existing, "operating", derived);
    expect(next.map((a) => a.id)).toEqual(["a1", "a3", "a2"]);
    expect(next.find((a) => a.id === "a1")).toBe(existing[0]);
    expect(next.find((a) => a.id === "a3")).toBe(existing[2]);
    expect(span(next.find((a) => a.id === "a2")!)).toEqual([3, 6]);
    expect(new Set(next.map((a) => a.id)).size).toBe(next.length);
    expect(sourceHasActivities(block({ activities: next }), "operating")).toBe(true);
    expect(sourceHasActivities(block({ activities: [existing[0]] }), "operating")).toBe(false);
    expect(replaceSourceActivities(next, "operating", []).map((a) => a.id)).toEqual(["a1", "a3"]);
  });

  it("COST-PROGRAM-ID-AVOIDANCE: the cost-program derivation avoids the ids already taken", () => {
    expect(suggestActivitiesFromCosts(demoProject(), ["a1", "a2"]).map((a) => a.id)).toEqual(["a3", "a4", "a5"]);
  });
});

async function openFixture(inputs: ModelInputs, keepTimeline = false) {
  render(<App />);
  const text = serializeProject(keepTimeline ? inputs : without(inputs), { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
  await waitFor(() => {
    expect(screen.getByText(inputs.projectName)).toBeTruthy();
  });
  fireEvent.click(byNav("timeline"));
}
const rowsOf = () => all('[data-kind="activity"]').map((r) => [
  (r.querySelector('[data-field="activityLabel"]') as HTMLInputElement).value,
  (r.querySelector('[data-field="activityStart"]') as HTMLInputElement).value,
  (r.querySelector('[data-field="activityEnd"]') as HTMLInputElement).value,
  (r.querySelector('[data-field="activityPhase"]') as HTMLSelectElement).value,
]);
const btn = (a: string) => byAction(a) as HTMLButtonElement;

describe("v0.6.13.2 Task B: the per-source buttons in the Timeline section", () => {
  it("SHORE-POWER: each source button derives its own entries, independently, and its note names what was derived", async () => {
    await openFixture(shorePowerProgram());
    expect(["suggest-activities", "suggest-contracts", "suggest-funding", "suggest-financing", "suggest-operating", "suggest-tariff"].map((a) => btn(a).textContent)).toEqual([
      "Suggest activities from the cost program", "Suggest activities from the contracts", "Suggest activities from the funding",
      "Suggest the debt facility from the financing", "Suggest activities from the operating lines", "Suggest activities from the tariff rows",
    ]);
    fireEvent.click(btn("suggest-funding"));
    expect(rowsOf()).toEqual([["AFIF grant (EU)", "3", "3", "funding"], ["National shore-power grant", "5", "5", "funding"], ["Province & municipality grant", "1", "1", "funding"], ["Municipality interest-free note", "1", "13", "funding"]]);
    expect(btn("suggest-funding").disabled).toBe(true);
    expect(btn("suggest-operating").disabled).toBe(false);
    fireEvent.click(btn("suggest-operating"));
    fireEvent.click(btn("suggest-tariff"));
    fireEvent.click(btn("suggest-financing"));
    fireEvent.click(btn("suggest-activities"));
    const phases = rowsOf().map((r) => r[3]);
    expect(phases.filter((p) => p === "operations")).toHaveLength(2);
    expect(phases.filter((p) => p === "revenue")).toHaveLength(4);
    expect(phases.filter((p) => p === "financing")).toHaveLength(1);
    expect(phases.filter((p) => p === "funding")).toHaveLength(4);
    expect(new Set(all('[data-kind="activity"]').map((r) => r.getAttribute("data-line"))).size).toBe(rowsOf().length);
    expect(all('[data-testid="timeline-suggestion-note"]').map((n) => n.getAttribute("data-source"))).toEqual(["cost-program", "funding", "financing", "operating", "tariff"]);
    expect(document.querySelector('[data-testid="timeline-refusals"]')).toBeNull();
    expect(document.querySelector('[data-testid="timeline-suggestion-note"][data-source="funding"]')!.textContent).toBe("Suggested 4 activities from the funding: one per row, a grant at its receipt year and an interest-free note from the draw to the final repayment. They enter in the Funding phase; review the spans and adjust them.");
  });

  it("GATE-PER-SOURCE: removing one source's entries re-enables only that source's button; hand-authored work survives a suggestion", async () => {
    await openFixture(shorePowerProgram());
    fireEvent.click(byAction("add-activity"));
    fireEvent.click(btn("suggest-operating"));
    expect(all('[data-kind="activity"]').length).toBe(3);
    expect(btn("suggest-operating").title).toBe("The operating-lines suggestion is already in the grid: remove its activities to use it again. A suggestion replaces only its own source's entries and never touches hand-authored activities.");
    const removeButtons = all('[data-kind="activity"]').slice(1).map((r) => r.querySelector('[data-action="remove-activity"]') as HTMLElement);
    removeButtons.forEach((b) => fireEvent.click(b));
    expect(all('[data-kind="activity"]').length).toBe(1);
    expect(btn("suggest-operating").disabled).toBe(false);
    expect(document.querySelector('[data-testid="timeline-suggestion-note"]')).toBeNull();
  });

  it("DISABLED-STATES: financing off, tariff without declared spans and financing without a solved model disable their buttons with the disclosed titles", async () => {
    await openFixture(demoProject());
    expect(btn("suggest-financing").disabled).toBe(true);
    expect(btn("suggest-financing").title).toBe("The debt facility is off: enable financing to derive its activity.");
    expect(btn("suggest-tariff").disabled).toBe(true);
    expect(btn("suggest-tariff").title).toBe("No tariff span is declared: the tariff grid is repayment-shaped rather than year-pinned, so declare a tariff span (or a row span) to derive activities.");
    expect(btn("suggest-contracts").disabled).toBe(false);
    fireEvent.click(btn("suggest-contracts"));
    expect(screen.getByTestId("timeline-suggestion-note").textContent).toBe("The project has no contracts to derive activities from.");
    expect(document.querySelector('[data-testid="timeline-empty"]')).toBeTruthy();
  });

  it("LAND-NEWBUILD: the contracts and operating buttons derive the lease terms and the operating years", async () => {
    await openFixture(landNewbuildProject());
    fireEvent.click(btn("suggest-contracts"));
    fireEvent.click(btn("suggest-operating"));
    expect(rowsOf()).toEqual([
      ["Hotel lease (Wood Hotel)", "3", "22", "revenue"], ["Office & restaurant leases", "3", "12", "revenue"],
      ["Property management & maintenance", "3", "22", "operations"], ["Insurance, property tax & utilities", "3", "22", "operations"],
    ]);
    expect(document.querySelector('[data-testid="timeline-refusals"]')).toBeNull();
  });
});

describe("v0.6.13.2 Task A: the phase-management affordance", () => {
  it("PHASE-MANAGEMENT: add, rename and delete a phase; the activity select lists the vocabulary only; delete refuses while referenced and names the activities", async () => {
    await openFixture(demoProject());
    expect(all('[data-kind="phase"]').map((r) => r.getAttribute("data-line"))).toEqual(TIMELINE_PHASES.map((p) => p.id));
    // add
    fireEvent.change(document.querySelector('[data-field="newPhaseId"]') as HTMLInputElement, { target: { value: "Permitting" } });
    fireEvent.change(document.querySelector('[data-field="newPhaseLabel"]') as HTMLInputElement, { target: { value: "Permits and consents" } });
    fireEvent.click(byAction("add-phase"));
    expect(all('[data-kind="phase"]').map((r) => r.getAttribute("data-line"))).toContain("permitting");
    // a duplicate is refused inline
    fireEvent.change(document.querySelector('[data-field="newPhaseId"]') as HTMLInputElement, { target: { value: "permitting" } });
    fireEvent.change(document.querySelector('[data-field="newPhaseLabel"]') as HTMLInputElement, { target: { value: "Again" } });
    fireEvent.click(byAction("add-phase"));
    expect(screen.getByTestId("timeline-phase-refusal").textContent).toBe('The phase id "permitting" already exists in the vocabulary: choose a different id.');
    // rename
    const row = () => all('[data-kind="phase"]').find((r) => r.getAttribute("data-line") === "permitting")!;
    fireEvent.change(row().querySelector('[data-field="phaseLabel"]') as HTMLInputElement, { target: { value: "Consents" } });
    // the activity select lists the vocabulary only
    fireEvent.click(byAction("add-activity"));
    const select = document.querySelector('[data-field="activityPhase"]') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual([...TIMELINE_PHASES.map((p) => p.id), "permitting"]);
    expect(Array.from(select.options).map((o) => o.textContent)[7]).toBe("Consents");
    fireEvent.change(select, { target: { value: "permitting" } });
    // delete refuses while referenced
    fireEvent.click(row().querySelector('[data-action="remove-phase"]') as HTMLElement);
    expect(screen.getByTestId("timeline-phase-refusal").textContent).toBe('The phase "permitting" cannot be deleted while activities reference it: a1 (unnamed); move or remove them first.');
    expect(row()).toBeTruthy();
    // delete allowed once empty
    fireEvent.change(select, { target: { value: "prestudy" } });
    fireEvent.click(row().querySelector('[data-action="remove-phase"]') as HTMLElement);
    expect(all('[data-kind="phase"]').some((r) => r.getAttribute("data-line") === "permitting")).toBe(false);
    expect(document.querySelector('[data-testid="timeline-phase-refusal"]')).toBeNull();
  });

  it("STALE-PHASE-SURFACE: a hand-edited file with an unknown phase surfaces the refusal in the section and the deck omits the slide", async () => {
    const tl: TimelineBlock = block({ activities: [act("a1", "nowhere", 1, 2)] });
    await openFixture({ ...demoProject(), projectLengthYears: 12, timeline: tl }, true);
    expect(screen.getByTestId("timeline-refusals").textContent).toContain("TIMELINE-PHASE-UNKNOWN");
    expect(document.querySelector('[data-testid="issues-summary"]')).toBeNull();
    fireEvent.click(byAction("present"));
    expect(document.querySelector('[data-slide-name="timeline"]')).toBeNull();
    expect(visibleLanes(tl)).toEqual([]);
  });
});