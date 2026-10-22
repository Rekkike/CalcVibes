// v0.6.18 Task F: the out-of-scope milestone guard. A milestone authored outside the chart window is asked about:
// the user either extends the window so it shows or keeps the window (the milestone stays authored and the deck
// caption keeps counting it as omitted). Nothing extends silently.
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import { ganttWindow } from "../src/ganttLayout.js";
import { demoProject, timelineOf, timelineWindow } from "../src/state.js";
import { parseProject, serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs, TimelineBlock } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const SETTINGS = { startYear: null, entryUnit: "ones" as const, scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null };

const base = (activities: TimelineBlock["activities"] = [{ id: "a1", label: "Build", startYear: 3, endYear: 5, phase: "production" }]): ModelInputs => ({
  ...demoProject(), projectLengthYears: 12, timeline: { activities, decisionPoints: [], milestones: [] },
});
async function open(inputs: ModelInputs) {
  render(<App />);
  const text = serializeProject(inputs, SETTINGS);
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
  await waitFor(() => expect(screen.getByText("Project Alpha")).toBeTruthy());
  fireEvent.click(byNav("timeline"));
}
const milestoneYear = () => document.querySelector('[data-kind="milestone"] [data-field="milestoneYear"]') as HTMLInputElement;
const guard = () => document.querySelector('[data-testid="milestone-window-guard"]');
const present = () => {
  fireEvent.click(byAction("present"));
  return document.querySelector('[data-slide-name="timeline"]') as HTMLElement;
};

describe("v0.6.18 Task F: the milestone window guard", () => {
  it("INSIDE: a milestone inside the window asks nothing", async () => {
    await open(base());
    fireEvent.click(byAction("add-milestone"));
    expect(guard()).not.toBeNull(); // the added milestone defaults to year 1, outside the window of years 3-5
    fireEvent.change(milestoneYear(), { target: { value: "4" } });
    expect(guard()).toBeNull();
  });

  it("SURFACES: an out-of-window milestone raises the visible confirmation naming it and the window; the window and the caption stand until the user answers", async () => {
    await open(base());
    fireEvent.click(byAction("add-milestone"));
    fireEvent.change(milestoneYear(), { target: { value: "9" } });
    const g = guard() as HTMLElement;
    expect(g).not.toBeNull();
    expect(g.querySelector('[data-testid="milestone-window-guard-message"]')!.textContent).toBe("Milestone m1 (unnamed) falls in Year 9, outside the chart window of Year 3–Year 5. Extend the window to show it, or keep the window: the milestone then stays authored and the chart caption counts it as omitted.");
    // nothing auto-extends: the deck window and caption are today's
    const slide = (() => { fireEvent.click(byAction("present")); return document.querySelector('[data-slide-name="timeline"]') as HTMLElement; })();
    expect(slide.querySelector('[data-testid="gantt-caption"]')!.textContent).toBe("The axis shows Year 3–Year 5 of the program span Year 1–Year 12. 1 marker falls outside this window and is not drawn; the gates and milestones listed on this slide name it.");
  });

  it("EXTEND: 'Extend the window' widens the chart window to the milestone, which then draws; the extension rides in the block", async () => {
    await open(base());
    fireEvent.click(byAction("add-milestone"));
    fireEvent.change(milestoneYear(), { target: { value: "9" } });
    fireEvent.click(byAction("window-extend"));
    expect(guard()).toBeNull();
    const s = present();
    expect(s.querySelector('[data-testid="gantt-caption"]')!.textContent).toBe("The axis shows Year 3–Year 9 of the program span Year 1–Year 12.");
    expect(s.querySelectorAll("[data-gantt-milestone]")).toHaveLength(1);
  });

  it("EXTEND-BEFORE: a milestone before the window extends the first year", async () => {
    await open(base());
    fireEvent.click(byAction("add-milestone"));
    fireEvent.change(milestoneYear(), { target: { value: "2" } });
    expect(guard()).not.toBeNull();
    fireEvent.click(byAction("window-extend"));
    const s = present();
    expect(s.querySelector('[data-testid="gantt-caption"]')!.textContent).toBe("The axis shows Year 2–Year 5 of the program span Year 1–Year 12.");
  });

  it("KEEP: 'Keep the window' dismisses the guard, leaves the window and the omission-counted caption as today, and never extends", async () => {
    await open(base());
    fireEvent.click(byAction("add-milestone"));
    fireEvent.change(milestoneYear(), { target: { value: "9" } });
    fireEvent.click(byAction("window-keep"));
    expect(guard()).toBeNull();
    const s = present();
    expect(s.querySelector('[data-testid="gantt-caption"]')!.textContent).toContain("1 marker falls outside this window and is not drawn");
    expect(s.querySelectorAll("[data-gantt-milestone]")).toHaveLength(0);
    expect(s.textContent).toContain("Milestone 1");
  });

  it("RE-ASK: a new out-of-window position raises the guard again; moving back inside clears it", async () => {
    await open(base());
    fireEvent.click(byAction("add-milestone"));
    fireEvent.change(milestoneYear(), { target: { value: "9" } });
    fireEvent.click(byAction("window-keep"));
    fireEvent.change(milestoneYear(), { target: { value: "10" } });
    expect(guard()).not.toBeNull();
    fireEvent.change(milestoneYear(), { target: { value: "4" } });
    expect(guard()).toBeNull();
  });

  it("DISCIPLINE: a year-only window with no visible activity never raises the guard (the window is the whole program)", async () => {
    await open({ ...base([]), projectLengthYears: 12 });
    fireEvent.click(byAction("add-milestone"));
    fireEvent.change(milestoneYear(), { target: { value: "9" } });
    expect(guard()).toBeNull();
  });
});

describe("v0.6.18 Task F: the window extension (pure)", () => {
  const acts = [{ startYear: 3, endYear: 5 }];
  it("WIDENS-NEVER-NARROWS: an extension widens either side, is clamped to the program span, and never narrows the activities' extent", () => {
    expect(ganttWindow(acts, 12)).toMatchObject({ firstYear: 3, lastYear: 5, years: 3, narrowed: true });
    expect(ganttWindow(acts, 12, { lastYear: 9 })).toMatchObject({ firstYear: 3, lastYear: 9, years: 7 });
    expect(ganttWindow(acts, 12, { firstYear: 1 })).toMatchObject({ firstYear: 1, lastYear: 5 });
    expect(ganttWindow(acts, 12, { firstYear: 4, lastYear: 4 })).toMatchObject({ firstYear: 3, lastYear: 5 });
    expect(ganttWindow(acts, 12, { lastYear: 99 })).toMatchObject({ firstYear: 3, lastYear: 12, narrowed: true, years: 10 });
    expect(ganttWindow([], 12, { lastYear: 9 })).toEqual({ firstYear: 1, lastYear: 12, years: 12, narrowed: false });
  });

  it("ONE-SOURCE: the deck and the guard read the same timelineWindow; the extension is engine-blind and rides the project file", () => {
    const inp: ModelInputs = { ...base(), timeline: { ...base().timeline!, windowExtension: { lastYear: 9 } } as TimelineBlock };
    const r = computeModel(inp);
    expect(timelineWindow(timelineOf(inp), 12)).toMatchObject({ firstYear: 3, lastYear: 9 });
    const g = deckSlides({ ...inp, timeline: { ...inp.timeline!, milestones: [{ id: "m1", label: "Far", year: 9 }] } }, r, { startYear: null }).slides.find((s) => s.name === "timeline")!.gantt!;
    expect(g.window).toEqual({ firstYear: 3, lastYear: 9 });
    expect(g.omittedMarkers).toBe(0);
    expect(JSON.stringify(computeModel(inp))).toBe(JSON.stringify(computeModel(base())));
    const back = parseProject(serializeProject(inp, SETTINGS));
    expect((back.inputs.timeline as unknown as { windowExtension: unknown }).windowExtension).toEqual({ lastYear: 9 });
    expect(JSON.parse(serializeProject(back.inputs, back.settings)).project.timeline.windowExtension).toEqual({ lastYear: 9 });
  });
});
