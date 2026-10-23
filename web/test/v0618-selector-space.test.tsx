// v0.6.18 Task G: the selector space-effectiveness. The Timeline editors' year and month selectors shed their
// full-width lines; the label columns gain the room. The allocation (TIMELINE_SPACE) is composed once and the
// stylesheet reads it; the walkthrough judges it.
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { TIMELINE_SPACE } from "../src/sections/TimelineSection.js";

const css = fs.readFileSync("src/index.css", "utf8");
const rule = (selector: string): string => {
  const i = css.indexOf(selector + " {");
  expect(i, selector).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};
const base = ".app-root .editor-scroll table.timeline-table";

describe("v0.6.18 Task G: what gets what space", () => {
  it("ALLOCATION: each fixed column takes exactly its composed width; the label column grows and keeps a generous floor", () => {
    expect(TIMELINE_SPACE).toEqual({ label: "grow", year: "4.25rem", month: "6.75rem", phase: "9rem", lane: "9rem", outcome: "11rem", tie: "16rem", code: "3.5rem" });
    expect(rule(`${base} input.tl-year`)).toContain(`width: ${TIMELINE_SPACE.year}`);
    expect(rule(`${base} select.tl-month`)).toContain(`width: ${TIMELINE_SPACE.month}`);
    expect(rule(`${base} td.tl-pick-phase select`)).toContain(`width: ${TIMELINE_SPACE.phase}`);
    expect(rule(`${base} td.tl-pick-lane select`)).toContain(`width: ${TIMELINE_SPACE.lane}`);
    expect(rule(`${base} td.tl-pick-outcome select`)).toContain(`width: ${TIMELINE_SPACE.outcome}`);
    expect(rule(`${base} td.tl-pick-tie select`)).toContain(`width: ${TIMELINE_SPACE.tie}`);
    expect(rule(`${base} td.tl-code`)).toContain(`width: ${TIMELINE_SPACE.code}`);
    expect(rule(`${base} td.tl-grow`)).toContain("width: 100%");
    expect(rule(`${base} td.tl-grow input`)).toMatch(/width: 100%;\s*min-width: 15rem/);
  });

  it("SPECIFICITY: the allocation out-ranks the generic full-width editor input rule, which stays for the other editors", () => {
    expect(css).toMatch(/\.app-root \.editor-scroll input\[type="number"\],\s*\.app-root \.editor-scroll select \{\s*width: 100%/);
    const weight = (sel: string) => (sel.match(/\.[\w-]+|\[[^\]]+\]/g) ?? []).length * 10 + (sel.match(/(^|\s)[a-z]+/g) ?? []).length;
    expect(weight(`${base} input.tl-year`)).toBeGreaterThan(weight('.app-root .editor-scroll input[type="number"]'));
    expect(weight(`${base} select.tl-month`)).toBeGreaterThan(weight(".app-root .editor-scroll select"));
  });

  it("STRUCTURE: in every editor a year and its month sit side by side in one pair with the calendar note beneath; the label cell grows; the choices carry their allocation classes", () => {
    render(<App />);
    fireEvent.click(document.querySelector('[data-action="load-multi-lease-demo"]') as HTMLElement);
    fireEvent.click(document.querySelector('[data-nav="timeline"]') as HTMLElement);
    for (const [table, yearField, monthField] of [["timeline-activities", "activityStart", "activityStartMonth"], ["timeline-activities", "activityEnd", "activityEndMonth"], ["timeline-gates", "gateYear", "gateMonth"], ["timeline-milestones", "milestoneYear", "milestoneMonth"]] as const) {
      const t = document.querySelector(`[data-testid="${table}"]`) as HTMLElement;
      expect(t.className).toBe("timeline-table");
      const year = t.querySelector(`[data-field="${yearField}"]`) as HTMLElement;
      const month = t.querySelector(`[data-field="${monthField}"]`) as HTMLElement;
      expect(year.className).toBe("tl-year");
      expect(month.className).toBe("tl-month");
      const pair = year.parentElement as HTMLElement;
      expect(pair.className).toBe("tl-pair");
      expect(Array.from(pair.children)).toEqual([year, month]);
      const cell = pair.parentElement as HTMLElement;
      expect(cell.className).toBe("tl-when");
      expect(cell.querySelector(".tl-note")!.parentElement).toBe(cell);
      expect(pair.contains(cell.querySelector(".tl-note"))).toBe(false);
      const first = (t.querySelector("tbody tr td:first-child") as HTMLElement);
      expect(first.className).toBe("tl-grow");
    }
    expect((document.querySelector('[data-field="activityPhase"]') as HTMLElement).parentElement!.className).toBe("tl-pick-phase");
    expect((document.querySelector('[data-field="gateOutcome"]') as HTMLElement).parentElement!.className).toBe("tl-pick-outcome");
    expect((document.querySelector('[data-field="milestoneTie"]') as HTMLElement).parentElement!.className).toBe("tl-pick-tie");
    expect((document.querySelector('[data-field="laneVisibility"]') as HTMLElement).parentElement!.className).toBe("tl-pick-lane");
    expect((document.querySelector('[data-field="gateCode"]') as HTMLElement).className).toBe("tl-code");
  });

  it("NOTES: the calendar notes still read year and month, now without a leading gap", () => {
    render(<App />);
    fireEvent.click(document.querySelector('[data-action="load-multi-lease-demo"]') as HTMLElement);
    fireEvent.click(document.querySelector('[data-nav="timeline"]') as HTMLElement);
    expect(document.querySelector('[data-testid="timeline-milestones"] [data-span-note="milestone"]')!.textContent).toBe("Year 2, month 10");
  });
});
