// v0.6.18 Task I.2: the section density. The vertical rhythm of the app sections is a named allocation
// (SECTION_RHYTHM) that the stylesheet reads; the walkthrough judges it.
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { SECTION_RHYTHM } from "../src/rhythm.js";

const css = fs.readFileSync("src/index.css", "utf8");
const rule = (selector: string): string => {
  const i = css.indexOf(selector + " {");
  expect(i, selector).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};

describe("v0.6.18 I.2: the section rhythm names its allocation", () => {
  it("ALLOCATION: the stylesheet reads the constant — a heading breaks above and hugs below, prose and actions hug their blocks", () => {
    expect(SECTION_RHYTHM).toEqual({ headingAbove: "var(--space-4)", headingBelow: "var(--space-2)", subheadingAbove: "var(--space-3)", proseBelow: "var(--space-2)", tableBelow: "var(--space-2)", actionAbove: "var(--space-1)", controlRow: "var(--space-2)", proseLineHeight: "1.45" });
    expect(rule(".app-root section > h3")).toContain(`margin: ${SECTION_RHYTHM.headingAbove} 0 ${SECTION_RHYTHM.headingBelow}`);
    expect(rule(".app-root section > h4")).toContain(`margin: ${SECTION_RHYTHM.subheadingAbove} 0 ${SECTION_RHYTHM.headingBelow}`);
    expect(rule(".app-root section > p.muted, .app-root section > p.caveat")).toContain(`margin: 0 0 ${SECTION_RHYTHM.proseBelow}`);
    expect(rule(".app-root section > p.muted, .app-root section > p.caveat")).toContain(`line-height: ${SECTION_RHYTHM.proseLineHeight}`);
    expect(rule(".app-root section > .editor-scroll")).toContain(`margin-bottom: ${SECTION_RHYTHM.tableBelow}`);
    expect(rule('.app-root section > .editor-scroll + button[data-action^="add-"]')).toContain(`margin-top: ${SECTION_RHYTHM.actionAbove}`);
    expect(rule(".app-root section > label")).toContain(`margin-top: ${SECTION_RHYTHM.controlRow}`);
    expect(rule(".app-root section > h3:first-child, .app-root section > h4:first-child")).toContain("margin-top: 0");
  });

  it("EVERY-SECTION: each section of the app renders inside the rhythm's scope (a section element under the app root), headings as direct children", () => {
    render(<App />);
    fireEvent.click(document.querySelector('[data-action="load-demo"]') as HTMLElement);
    for (const nav of ["overview", "costs", "operating", "repayment", "tariff", "funding", "financing", "appraisal", "timeline", "results", "scenarios", "detail"]) {
      fireEvent.click(document.querySelector(`[data-nav="${nav}"]`) as HTMLElement);
      const section = document.querySelector(".app-root main section") as HTMLElement;
      expect(section, nav).toBeTruthy();
      expect(section.querySelector(":scope > h2"), nav).toBeTruthy();
    }
  });

  it("TIMELINE: the Timeline section's subsections are direct headings, so the rhythm applies to each block", () => {
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="timeline"]') as HTMLElement);
    const headings = Array.from(document.querySelectorAll('[data-testid="timeline"] > h3')).map((h) => h.textContent);
    expect(headings).toEqual(["Phases", "Activities", "Decision points", "Milestones"]);
  });
});
