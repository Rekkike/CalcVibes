import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { demoProject } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs, TimelineBlock } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const all = (sel: string) => Array.from(document.querySelectorAll(sel)) as HTMLElement[];
const field = (row: Element, f: string) => row.querySelector('[data-field="' + f + '"]') as HTMLInputElement;

async function openProject(inputs: ModelInputs) {
  render(<App />);
  const text = serializeProject(inputs, { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  const file = new File([text], "p.calcvibes.json", { type: "application/json" });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Project Alpha")).toBeTruthy();
  });
}

const alpha = (timeline?: TimelineBlock): ModelInputs => ({ ...demoProject(), projectLengthYears: 12, ...(timeline !== undefined ? { timeline } : {}) });

describe("v0.6.13 the Timeline section", () => {
  it("SEAT: the plan group sits between finance and read (v0.6.13.1 re-anchor: the blank project, since the demo now carries a timeline); the empty state offers the three affordances with no refusals", () => {
    render(<App />);
    expect(all(".nav-group").map((g) => g.getAttribute("data-nav-group"))).toEqual(["model", "finance", "plan", "read"]);
    fireEvent.click(byNav("timeline"));
    expect(screen.getByTestId("timeline-empty")).toBeTruthy();
    expect(byAction("add-activity")).toBeTruthy();
    expect(byAction("add-gate")).toBeTruthy();
    expect(byAction("add-milestone")).toBeTruthy();
    expect(document.querySelector('[data-testid="timeline-refusals"]')).toBeNull();
    expect(screen.getByTestId("decision-disclosure").textContent).toBe("The decision points follow the DP1–DP8 decision-point scale; this application does not implement or certify any external project-management methodology.");
    expect(document.querySelector('[data-testid="timeline-activities-scroll"]')?.className).toContain("editor-scroll");
  });

  it("GATES: (v0.6.13.1 re-anchor: the blank project, since the demo now carries its gates) added gates take the DP defaults of the scale in order; the mini scale takes its condensed set", () => {
    render(<App />);
    fireEvent.click(byNav("timeline"));
    fireEvent.click(byAction("add-gate"));
    fireEvent.click(byAction("add-gate"));
    const codes = () => all('[data-kind="gate"]').map((r) => r.querySelector('[data-field="gateCode"]')!.textContent);
    expect(codes()).toEqual(["DP1", "DP2"]);
    expect(field(all('[data-kind="gate"]')[0], "gateTitle").value).toBe("Decision to start the project and initiate preparations");
    fireEvent.change(document.querySelector('[data-field="projectScale"]') as HTMLElement, { target: { value: "mini" } });
    fireEvent.click(byAction("add-gate"));
    expect(codes()).toEqual(["DP1", "DP2", "DP3"]);
  });

  it("EDIT: activities, ids stay unique after a removal, and an out-of-span activity refuses in the section panel only", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("timeline"));
    fireEvent.click(byAction("add-activity"));
    fireEvent.click(byAction("add-activity"));
    fireEvent.click(document.querySelector('[data-action="remove-activity"]') as HTMLElement);
    fireEvent.click(byAction("add-activity"));
    const ids = all('[data-kind="activity"]').map((r) => r.getAttribute("data-line"));
    expect(new Set(ids).size).toBe(ids.length);
    const row = all('[data-kind="activity"]')[0];
    fireEvent.change(field(row, "activityEnd"), { target: { value: "99" } });
    const panel = screen.getByTestId("timeline-refusals");
    expect(panel.textContent).toContain("TIMELINE-ACTIVITY-SPAN");
    expect(panel.textContent).toContain("outside the program span of years 1–");
    // the model keeps solving: no compute-blocking issues panel
    expect(document.querySelector('[data-testid="issues-summary"]')).toBeNull();
    fireEvent.click(byNav("results"));
    expect(document.querySelector('[data-testid="issues-summary"]')).toBeNull();
    expect(document.querySelector('[data-stat="paymentAmount"], [data-testid="results"]')).toBeTruthy();
  });

  it("TIES: engine-event options compose from the solved model; a tied milestone takes the tied year; a funding tie refuses without a funding block", async () => {
    await openProject(alpha({ projectScale: "full", activities: [{ id: "a1", label: "Study", startYear: 1, endYear: 2, phase: "prestudy" }], decisionPoints: [], milestones: [{ id: "m1", label: "Go", year: 1 }] }));
    fireEvent.click(byNav("timeline"));
    const sel = field(all('[data-kind="milestone"]')[0], "milestoneTie") as unknown as HTMLSelectElement;
    const values = Array.from(sel.options).map((o) => o.value);
    expect(values).toContain("activity:a1");
    expect(values).toContain("engine-event:construction-complete");
    expect(values).toContain("engine-event:first-collection-year");
    expect(values).not.toContain("engine-event:funding-received");
    fireEvent.change(sel, { target: { value: "activity:a1" } });
    expect(field(all('[data-kind="milestone"]')[0], "milestoneYear").value).toBe("2");
    expect(document.querySelector('[data-testid="timeline-refusals"]')).toBeNull();
  });

  it("TIE REFUSAL: a loaded tie to a missing activity refuses by name", async () => {
    await openProject(alpha({ activities: [], decisionPoints: [], milestones: [{ id: "m1", label: "Go", year: 1, tie: { kind: "activity", activityId: "a9" } }] }));
    fireEvent.click(byNav("timeline"));
    expect(screen.getByTestId("timeline-refusals").textContent).toContain("is tied to activity a9, which does not exist; the activities present are none");
  });

  it("STAND-DOWN: with the model refused under its own issues the span refusals stand down", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("timeline"));
    fireEvent.click(byAction("add-activity"));
    fireEvent.change(field(all('[data-kind="activity"]')[0], "activityEnd"), { target: { value: "99" } });
    expect(document.querySelector('[data-testid="timeline-refusals"]')).toBeTruthy();
    fireEvent.click(byNav("overview"));
    fireEvent.change(document.querySelector('[data-testid="overview"] [data-field="targetIrr"]') as HTMLElement, { target: { value: "-150" } });
    fireEvent.click(byNav("timeline"));
    expect(document.querySelector('[data-testid="timeline-refusals"]')).toBeNull();
    expect(screen.getByTestId("timeline-standdown")).toBeTruthy();
  });
});
