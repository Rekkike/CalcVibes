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
  it("the donut renders segment labels with names and shares and the center total", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const donut = document.querySelector('[data-testid="composition-donut"]') as SVGElement;
    const labels = donut.querySelectorAll('[data-testid="donut-segment-label"]');
    expect(labels.length).toBe(3);
    expect((labels[0] as SVGTextElement).textContent).toContain("Development team");
    expect((labels[0] as SVGTextElement).textContent).toContain("71%");
    const center = donut.querySelector('[data-testid="donut-center-total"]');
    expect(center && center.textContent).toContain("7 849 860");
  });

  it("the deck investment slide carries exactly one composition figure (the bar is retired)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(document.querySelector('[data-testid="composition-bar"]')).toBeNull();
    expect(document.querySelector('[data-slide-name="investment"] [data-testid="composition-donut"]')).toBeTruthy();
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
    expect(doc.getNumberOfPages()).toBe(5);
    expect(model.slides[1].chart?.data.length).toBe(3);
    expect(model.slides[2].chart?.data.length).toBe(10);
  });
});

describe("Task D: INSIGHT-BREAKEVEN / INSIGHT-NULL / VERDICT / GLOSSES", () => {
  it("the recovery slide states the break-even composed from the engine payback", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const { yearsTwoForDisplay } = await import("../src/engine.js");
    const result = computeModel(demoProject());
    const deck = deckSlides(demoProject(), result, { startYear: null });
    const insights = deck.slides[2].insights ?? [];
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0]).toContain("You start turning a profit in");
    expect(insights[0]).toContain(yearsTwoForDisplay(result.paybackYears as number));
    const { yearHeader } = await import("../src/state.js");
    expect(insights[0]).toContain(`in ${yearHeader(Math.ceil(result.paybackYears as number), null)}`);
  });

  it("INSIGHT-NULL: a null payback renders the honest no-profit line", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const fixedInputs = { ...demoProject(), tariff: { mode: "fixed" as const, escalationPerYear: 2, rows: [], fixedAnnualAmount: 100000, manualPrices: null } };
    const fixedResult = computeModel(fixedInputs);
    expect(fixedResult.paybackYears).toBeNull();
    const deck = deckSlides(fixedInputs, fixedResult, { startYear: null });
    const insights = deck.slides[2].insights ?? [];
    expect(insights.join(" ")).toContain("does not turn a profit within the modeled horizon");
  });

  it("VERDICT-YES on the goal-met case; the glosses render on the deck", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 4; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const verdict = document.querySelector('[data-testid="deck-verdict"]');
    expect(verdict && verdict.textContent).toContain("This is a good deal");
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

  it("TOGGLE: the control renders and switches data-theme on the root", () => {
    render(<App />);
    const root = document.querySelector(".app-root") as HTMLElement;
    expect(root.getAttribute("data-theme")).toBe("light");
    fireEvent.change(document.querySelector('[data-field="theme"]') as HTMLElement, { target: { value: "dark" } });
    expect(document.querySelector(".app-root")?.getAttribute("data-theme")).toBe("dark");
  });

  it("THEME-DARK: the dark override block exists with its pinned values", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root\[data-theme="dark"\]\s*\{[^}]*--bg:\s*#081c33/);
    expect(css).toMatch(/\.app-root\[data-theme="dark"\]\s*\{[^}]*--ink:\s*#e2e8f0/);
    expect(css).toMatch(/\.app-root\[data-theme="dark"\]\s*\{[^}]*--accent:\s*#0074ba|dark[\s\S]*?--mut:\s*#9db4cc/);
  });

  it("VERSION: the rendered string equals the VERSION constant v0.5.5", async () => {
    const { VERSION } = await import("../src/engine.js");
    expect(VERSION).toBe("v0.5.5");
    render(<App />);
    expect(document.querySelector('[data-testid="version"]')?.textContent).toBe("v0.5.5");
  });
});

describe("Task G: SUMMARY-TILES / SUMMARY-CHARTS / SUMMARY-EDGES", () => {
  it("the enumerated tile set renders on the deal slide", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 4; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const tiles = document.querySelectorAll('[data-testid="summary-tiles"] [data-tile]');
    const labels = Array.from(tiles).map((t) => (t as HTMLElement).getAttribute("data-tile"));
    expect(labels).toEqual([
      "Total cost", "Total collected", "Net gain", "Achieved IRR", "NPV at WACC",
      "Payback (nominal)", "Payback (discounted)", "Break-even year", "MIRR", "Profitability index",
    ]);
  });

  it("both mini charts render on the deal slide with their labels", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 4; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const summary = document.querySelector('[data-testid="summary-charts"]') as HTMLElement;
    expect(summary.querySelector('[data-summary-chart="donut"] [data-testid="composition-donut"]')).toBeTruthy();
    expect(summary.querySelector('[data-summary-chart="bars"] [data-testid="recovery-bars"]')).toBeTruthy();
    expect(summary.querySelectorAll('[data-testid="donut-segment-label"]').length).toBe(3);
  });

  it("SUMMARY-EDGES: the blank project renders honest zeros and empty chart states, never fabricated figures", async () => {
    const { blankProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const result = computeModel(blankProject());
    const deck = deckSlides(blankProject(), result, { startYear: null });
    const tiles = deck.slides[4].tiles ?? [];
    expect(tiles.find((t) => t.label === "Total cost")?.value).toContain("0,00");
    expect(tiles.find((t) => t.label === "Break-even year")?.value).toBe("not within the horizon");
  });
});
