import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import * as fs from "fs";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("Task A: CONTRAST", () => {
  it("the presentation text tokens render near-white on the stage", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\[data-testid="presentation"\] \.deck-slide-header\s*\{[^}]*color:\s*#e2e8f0/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.deck-slide-footer\s*\{[^}]*color:\s*#e2e8f0/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.deck-disclosure\s*\{[^}]*color:\s*#e2e8f0/);
    expect(css).toMatch(/\.kicker\s*\{[^}]*color:\s*#cce9ff/);
  });
});

describe("Task B: CHART-LABEL / ONE-COMPOSITION / PEAK-LABEL", () => {
  it("the Cost section renders the composition rows with names, shares, and values (v0.6.10 re-anchor: the program cost base, EUR at entry thousands)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const rows = document.querySelector('[data-testid="composition-rows-wrap"] [data-testid="composition-rows"]') as HTMLElement;
    const rowEls = rows.querySelectorAll("[data-composition-row]");
    expect(rowEls.length).toBe(6);
    expect(rowEls[0].querySelector('[data-row-label="name"]')?.textContent).toContain("Container shore power — engineering & studies (RSP JV)");
    expect(rowEls[0].querySelector('[data-row-label="share"]')?.textContent).toContain("16.5%");
    expect(rowEls[0].querySelector('[data-row-label="value"]')?.textContent).toContain("74 000");
  });

  it("the deck investment slide carries exactly one composition figure (re-anchored per v0.6.5 Task C/W13: the donut lives on the summary slide only)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(document.querySelector('[data-slide-name="investment"] [data-testid="composition-donut"]')).toBeNull();
    expect(document.querySelectorAll('[data-slide-name="summary"] [data-testid="composition-donut"]').length).toBe(2);
    expect(document.querySelector('[data-slide-name="investment"] [data-testid="ledger-waterfall"]')).toBeTruthy(); // v0.6.15: the ledger waterfall replaces the composition rows
  });

  it("the recovery chart labels its peak value", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const peak = document.querySelector('[data-testid="peak-label"]');
    expect(peak && peak.textContent).toBeTruthy();
  });
});

describe("Task C: PRINT-DESIGN / PDF-DESIGN", () => {
  it("the print stylesheet carries the card rules and the chrome in ink", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/@media print[\s\S]*?\.deck-figure\s*\{[^}]*background:\s*#ffffff/);
    expect(css).toMatch(/@media print[\s\S]*?\.deck-slide-header\s*\{[^}]*background:\s*#103558/);
    expect(css).toMatch(/@media print[\s\S]*?\.deck-slide-footer\s*\{[^}]*color:\s*#717273/);
  });

  it("PDF-DESIGN: the drawn deck carries the header band, card rules, and the labeled charts", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const { buildDeckPdf } = await import("../src/pdf.js");
    const result = computeModel(demoProject());
    const model = deckSlides(demoProject(), result, { startYear: null });
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    const doc = buildDeckPdf(model, "Project Alpha", trace);
    expect(doc.getNumberOfPages()).toBe(7);
    expect(model.slides[2].waterfall?.rows.filter((r) => r.kind === "capital").length).toBe(3); // v0.6.18 Task J.1: the dead rows-chart field retired
    expect(model.slides[3].chart?.data.length).toBe(10);
  });
});

describe("Task D: INSIGHT-BREAKEVEN / INSIGHT-NULL / VERDICT / GLOSSES", () => {
  it("the coverage slide states the break-even composed from the engine payback", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const { deckYearsForDisplay } = await import("../src/engine.js");
    const result = computeModel(demoProject());
    const deck = deckSlides(demoProject(), result, { startYear: null });
    expect(deck.slides[4].title).toBe("Coverage");
    const coverage = deck.slides[4].body;
    const breakEven = coverage.find((f) => f.label === "Break-even year")!;
    const { yearHeader } = await import("../src/state.js");
    expect(breakEven.value).toBe(yearHeader(Math.ceil(result.paybackYears as number), null));
    const nominal = coverage.find((f) => f.label === "Nominal payback")!;
    expect(nominal.value).toBe(deckYearsForDisplay(result.paybackYears as number));
  });

  it("INSIGHT-NULL: a null payback renders the honest no-profit line", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const fixedInputs = { ...demoProject(), tariff: { mode: "fixed" as const, escalationPerYear: 2, rows: [], fixedAnnualAmount: 100000, manualPrices: null } };
    const fixedResult = computeModel(fixedInputs);
    expect(fixedResult.paybackYears).toBeNull();
    const deck = deckSlides(fixedInputs, fixedResult, { startYear: null });
    expect(deck.slides[4].title).toBe("Coverage — not within the horizon");
    expect(deck.slides[4].body.find((f) => f.label === "Break-even year")?.value).toBe("not within the horizon");
  });

  it("VERDICT-YES on the goal-met case; the glosses render on the deck", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const verdict = document.querySelector('[data-testid="deck-verdict"]');
    expect(verdict && verdict.textContent).toContain("Target met");
    const glosses = document.querySelectorAll('[data-testid="term-gloss"]');
    expect(glosses.length).toBe(6);
  });
});

describe("Task E: SINGLE-ROOT / NO-DANGLING / TOGGLE / THEME-DARK / VERSION", () => {
  it("SINGLE-ROOT: exactly one :root token block", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect((css.match(/:root\s*\{/g) || []).length).toBe(1);
  });

  it("NO-DANGLING: no var() reference to an undefined token", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    const defined = new Set(Array.from(css.matchAll(/--([\w-]+)\s*:/g)).map((m) => m[1]));
    const used = new Set(Array.from(css.matchAll(/var\(--([\w-]+)/g)).map((m) => m[1]));
    const dangling = Array.from(used).filter((u) => !defined.has(u));
    expect(dangling).toEqual([]);
  });

  it("TOGGLE (re-anchored per v0.6.5 Task G/W15: the theme follows the system with a dark fallback; the select remains the manual override)", () => {
    render(<App />);
    const root = document.querySelector(".app-root") as HTMLElement;
    expect(root.getAttribute("data-theme")).toBe("dark");
    fireEvent.change(document.querySelector('[data-field="theme"]') as HTMLElement, { target: { value: "light" } });
    expect(document.querySelector(".app-root")?.getAttribute("data-theme")).toBe("light");
    fireEvent.change(document.querySelector('[data-field="theme"]') as HTMLElement, { target: { value: "dark" } });
    expect(document.querySelector(".app-root")?.getAttribute("data-theme")).toBe("dark");
  });

  it("THEME-DARK: the dark override block exists with its pinned values", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root\[data-theme="dark"\]\s*\{[^}]*--bg:\s*#081c33/);
    expect(css).toMatch(/\.app-root\[data-theme="dark"\]\s*\{[^}]*--ink:\s*#e2e8f0/);
    expect(css).toMatch(/\.app-root\[data-theme="dark"\]\s*\{[^}]*--accent:\s*#0074ba|dark[\s\S]*?--mut:\s*#9db4cc/);
  });

  it("VERSION-CURRENT (v0.6): the rendered string equals the VERSION constant equals the current directive version", async () => {
    const { VERSION } = await import("../src/engine.js");
    expect(VERSION).toBe("v0.6.17");
    render(<App />);
    expect(document.querySelector('[data-testid="version"]')?.textContent).toBe(VERSION);
    expect(document.querySelector('[data-testid="version"]')?.textContent).toBe("v0.6.17");
  });
});

describe("Task G: SUMMARY-TILES / SUMMARY-CHARTS / SUMMARY-EDGES", () => {
  it("the enumerated tile set renders on the deal slide", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const deal = document.querySelector('[data-slide-name="deal"]') as HTMLElement;
    const tiles = deal.querySelectorAll('[data-testid="summary-tiles"] [data-tile]');
    const labels = Array.from(tiles).map((t) => (t as HTMLElement).getAttribute("data-tile"));
    expect(labels).toEqual([
      "Total cost", "Total collected", "Net gain", "Achieved IRR", "NPV at WACC",
      "Payback (nominal)", "Equity outlay", "Equity IRR", "Minimum DSCR",
    ]);
  });

  it("both mini charts render on the deal slide with their labels", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const summary = document.querySelector('[data-testid="summary-charts"]') as HTMLElement;
    expect(summary.querySelector('[data-summary-chart="hurdle"] [data-testid="hurdle-plot"]')).toBeTruthy();
    expect(summary.querySelector('[data-summary-chart="bars"] [data-testid="recovery-bars"]')).toBeTruthy();
    expect(summary.querySelectorAll('[data-testid="hurdle-plot"] [data-testid="hurdle-target-dot"]').length).toBe(1);
  });

  it("SUMMARY-EDGES: the blank project renders honest zeros and empty chart states, never fabricated figures", async () => {
    const { blankProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const result = computeModel(blankProject());
    const deck = deckSlides(blankProject(), result, { startYear: null });
    const tiles = deck.slides[6].tiles ?? [];
    expect(tiles.find((t) => t.label === "Total cost")?.value).toBe("0 kr");
    expect(deck.slides[4].body.find((f) => f.label === "Break-even year")?.value).toBe("not within the horizon");
  });
});
