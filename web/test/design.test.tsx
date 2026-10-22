import { describe, expect, it } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { demoProject } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import * as fs from "fs";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

// v0.6.7 re-anchor helper: the equity-ambiguity disclosure case of record lives on the internal
// Alpha template, which the demo buttons no longer load (the port fixture's equity flow has one
// sign change, so the ambiguity warning cannot arise from the demo button); open it through the
// project-file route.
async function openAlpha() {
  const text = serializeProject(demoProject(), { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "project-alpha.calcvibes.json", { type: "application/json" })] } });
  await waitFor(() => {
    expect((document.querySelector('[data-field="projectName"]') as HTMLInputElement).value).toBe("Project Alpha");
  });
}

describe("Task G: the deck design system (structural pins)", () => {
  it("the stylesheet defines the token custom properties", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/--font:\s*Inter/);
    expect(css).toMatch(/--accent:\s*#0074ba/);
    expect(css).toMatch(/--ink:/);
    expect(css).toMatch(/--mut:/);
    expect(css).toMatch(/--card:/);
    // v0.6.9 Task C/W24: the content width token split — the app shell widens, the deck stays.
    expect(css).toMatch(/--app-content-width:\s*110rem/);
    expect(css).toMatch(/--deck-content-width:\s*56rem/);
  });

  it("the deck carries its width breakpoints — the phone-deck block and the two-column wide-workspace rules (v0.6.9 Tasks B/C)", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    // The phone-deck block (the red proof: the deck carried only print media queries).
    expect(css).toMatch(/@media \(max-width: 480px\) \{\s*\[data-testid="presentation"\] \.deck-slide \{\s*padding: var\(--space-3\) var\(--space-2\);\s*min-height: auto;\s*\}/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.chart-kicker \{\s*font-size: 0\.85rem;\s*\}/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.donut-geometry \{\s*width: 132px;\s*height: 132px;/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.waterfall-track \{\s*height: 180px;\s*\}/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.stage-returns-svg \{\s*min-height: 120px;\s*\}/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.summary-tiles \{\s*grid-template-columns: repeat\(auto-fit, minmax\(120px, 1fr\)\);\s*\}/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.bar-year-label,\s*\[data-testid="presentation"\] \.peak-label \{\s*font-size: 10px;\s*\}/);
    // The two-column sections at the wide workspace breakpoint — the two source-verified shapes.
    expect(css).toMatch(/@media \(min-width: 80rem\) \{\s*\.app-root \[data-testid="overview-summary"\] \{\s*display: grid;\s*grid-template-columns: minmax\(28rem, 2fr\) minmax\(0, 3fr\);/);
    expect(css).toMatch(/\.app-root section\[data-testid="repayment"\] \{\s*display: grid;\s*grid-template-columns: minmax\(0, 3fr\) minmax\(22rem, 1fr\);/);
    expect(css).toMatch(/\.app-root section\[data-testid="repayment"\] > \[data-testid="repayment-summary"\] \{\s*grid-column: 2;\s*grid-row: 1;\s*\}/);
  });

  it("figure values are right-aligned via the alignment class", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.deck-figure-value\s*\{\s*[^}]*text-align:\s*right/);
  });

  it("the labeled composition rows are the investment slide's one composition figure (re-anchored per v0.6.5 Task C/W13: the donut lives on the summary slide only)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(document.querySelector('[data-slide-name="investment"] [data-testid="composition-donut"]')).toBeNull();
    expect(document.querySelectorAll('[data-slide-name="summary"] [data-testid="composition-donut"]').length).toBe(2);
    // v0.6.15 re-anchor: the composition rows retired; the ledger waterfall is the investment slide's one
    // composition figure (six capital cost lines on the program fixture).
    const rows = document.querySelector('[data-slide-name="investment"] [data-testid="ledger-waterfall"]') as HTMLElement;
    expect(rows.querySelectorAll('[data-ledger-row][data-ledger-kind="capital"]').length).toBe(6);
    expect(rows.querySelectorAll('[data-testid="donut-segment-label"]').length).toBe(0);
  });

  it("header and footer chrome render on every slide; disclosures are muted", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const slides = document.querySelectorAll('[data-testid="presentation"] .deck-slide');
    // v0.6.7 re-anchor: the port loader presets the scenario axes, so the deck carries the
    // scenarios slide as an eighth slide; v0.6.13.1: the authored demo timeline adds the Gantt slide, a ninth.
    expect(slides.length).toBe(9);
    for (const s of slides) {
      expect((s as HTMLElement).querySelector(".deck-slide-header")).toBeTruthy();
      expect((s as HTMLElement).querySelector(".deck-slide-footer")).toBeTruthy();
    }
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.deck-disclosure\s*\{[^}]*color:\s*var\(--mut\)/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.deck-slide-header\s*\{[^}]*color:\s*#e2e8f0/);
  });

  it("the financing variant renders its disclosures (the ambiguity warning stays distinct but calm)", async () => {
    render(<App />);
    // v0.6.7 re-anchor: the ambiguity warning is pinned on the internal Alpha template via the
    // project-file route; the port fixture's equity flow is unambiguous, so its deal slide carries
    // no ambiguity disclosure.
    await openAlpha();
    fireEvent.click(document.querySelector('[data-nav="financing"]') as HTMLElement);
    fireEvent.click(document.querySelector('[data-field="finEnabled"]') as HTMLElement);
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 4; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const deal = document.querySelector('[data-slide-name="deal"]') as HTMLElement;
    expect(deal.querySelector(".warning")).toBeTruthy();
  });
});
