import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import * as fs from "fs";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("Task B: TOKEN-SET / surfaces / typography (structural)", () => {
  it("TOKEN-SET: every named token present with its exact value", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/--bg:\s*#f7f7fa/);
    expect(css).toMatch(/--card:\s*#ffffff/);
    expect(css).toMatch(/--tint:\s*#f2f2f5/);
    expect(css).toMatch(/--line:\s*#e5e5ea/);
    expect(css).toMatch(/--ink:\s*#343434/);
    expect(css).toMatch(/--mut:\s*#717273/);
    expect(css).toMatch(/--navy:\s*#103558/);
    expect(css).toMatch(/--accent:\s*#0074ba/);
    expect(css).toMatch(/--accent-tint:\s*#cce9ff/);
    expect(css).toMatch(/--ok:\s*#059669/);
    expect(css).toMatch(/--bad:\s*#e11d48/);
    expect(css).toMatch(/--warn:\s*#b45309/);
  });

  it("CARD-SURFACE / BADGE-PILL / BUTTON-PRIMARY / TOPBAR-BLUR / TYPO-SCALE", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root section\s*\{[^}]*border-radius:\s*14px/);
    expect(css).toMatch(/\.app-root section\s*\{[^}]*box-shadow:\s*0 1px 2px rgba\(16, 53, 88, 0\.05\)/);
    expect(css).toMatch(/\.app-root \.badge\s*\{[^}]*border-radius:\s*999px/);
    expect(css).toMatch(/\.app-root button\.btn-primary\s*\{[^}]*background:\s*var\(--accent\)/);
    expect(css).toMatch(/\.app-root header\.app-header\s*\{[^}]*backdrop-filter:\s*blur\(6px\)/);
    expect(css).toMatch(/\.app-root h2\s*\{[^}]*font-size:\s*17px/);
    expect(css).toMatch(/\.stat-value|font-size:\s*21px/);
    expect(css).toMatch(/letter-spacing:\s*0\.08em/);
    expect(css).toMatch(/\.app-root \.lead\s*\{[^}]*font-size:\s*13px/);
    expect(css).toMatch(/font-size:\s*11px/);
  });

  it("GRID-STICKY: the sticky name-column and horizontal-scroll rules exist", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root \.yearly-grid \.sticky-col\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/\.app-root \.yearly-grid \.grid-scroll\s*\{[^}]*overflow-x:\s*auto/);
  });

  it("LENGTH-HINT: the derived value renders", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    const hint = document.querySelector('[data-testid="length-hint"]');
    expect(hint && hint.textContent).toContain("120 months (10 years)");
  });

  it("COLL-LABELS: the collections editor rows carry calendar-year labels via the shared helper", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.change(document.querySelector('[data-field="startYear"]') as HTMLElement, { target: { value: "2026" } });
    fireEvent.click(byNav("repayment"));
    const editor = document.querySelector('[data-testid="collections-editor"]') as HTMLElement;
    editor.querySelector("details")?.setAttribute("open", "true");
    fireEvent.click(editor.querySelector('[data-action="add-col-override"]') as HTMLElement);
    const row = document.querySelector('[data-override-year]') as HTMLElement;
    expect(row.getAttribute("data-calendar-label")).toBe("2028");
  });
});

describe("Task C: STAGE-BG / GLOWS / FADE / DISPLAY-TYPE / CHROME (structural)", () => {
  it("STAGE-BG: the stage token exact", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/--stage:\s*#081c33/);
  });

  it("GLOWS: both radial gradients at the pinned positions and alphas", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/radial-gradient\(ellipse 80% 60% at 70% -10%, rgba\(0, 116, 186, 0\.20\)/);
    expect(css).toMatch(/radial-gradient\(ellipse 60% 50% at 10% 110%, rgba\(204, 233, 255, 0\.06\)/);
  });

  it("FADE and DISPLAY-TYPE and CHROME", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/animation:\s*deckfade 0\.35s ease-out/);
    expect(css).toMatch(/@keyframes deckfade/);
    expect(css).toMatch(/translateY\(16px\)/);
    expect(css).toMatch(/\[data-testid="presentation"\] h1\s*\{[^}]*font-size:\s*52px/);
    expect(css).toMatch(/letter-spacing:\s*-0\.02em/);
    expect(css).toMatch(/\[data-testid="presentation"\] h2\s*\{[^}]*font-size:\s*30px/);
    expect(css).toMatch(/letter-spacing:\s*0\.3em/);
    expect(css).toMatch(/\.deck-slide-header\s*\{[^}]*letter-spacing:\s*0\.2em/);
    expect(css).toMatch(/\.dot\.active\s*\{[^}]*width:\s*24px/);
  });
});

describe("Task D: charts (structural, engine-traceable)", () => {
  it("CHART-APP: the yearly chart renders with bar count equal to the yearly row count", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const chart = document.querySelector('[data-testid="yearly-chart"]') as SVGElement;
    expect(chart).toBeTruthy();
    const costBars = chart.querySelectorAll('[data-chart-bar="cost"]');
    const inflowBars = chart.querySelectorAll('[data-chart-bar="inflow"]');
    expect(costBars.length).toBe(10);
    expect(inflowBars.length).toBe(10);
    expect((costBars[0] as SVGRectElement).getAttribute("fill")).toBe("#fb7185");
    expect((inflowBars[0] as SVGRectElement).getAttribute("fill")).toBe("#34d399");
    expect(chart.querySelector('[data-chart-line="cumulative"]')?.getAttribute("stroke")).toBe("#0074ba");
  });

  it("DONUT-APP: the composition donut segments equal the cost line count", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const donut = document.querySelector('[data-testid="composition-donut"]') as SVGElement;
    expect(donut.querySelectorAll("[data-donut-segment]").length).toBe(3);
  });

  it("CHART-DECK: the investment donut and recovery bars render on the stage", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const investmentSlot = document.querySelector('[data-slide-chart="investment"]') as HTMLElement;
    const recoverySlot = document.querySelector('[data-slide-chart="recovery"]') as HTMLElement;
    expect(investmentSlot.querySelector('[data-testid="composition-rows"]')).toBeTruthy();
    expect(recoverySlot.querySelector('[data-testid="recovery-bars"]')).toBeTruthy();
    const bars = recoverySlot.querySelectorAll('[data-recovery-column]');
    expect(bars.length).toBe(10);
  });

  it("CHART-TRACE: the mapped values equal the engine fields (perturb the mapping and this fails)", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const result = computeModel(demoProject());
    const deck = deckSlides(demoProject(), result, { startYear: null });
    const donutData = deck.slides[1].chart?.data;
    expect(donutData?.length).toBe(result.lineTotals.length);
    for (let i = 0; i < (donutData?.length ?? 0); i++) {
      expect(donutData?.[i].value).toBe(result.lineTotals[i].total);
    }
    const barsData = deck.slides[2].chart?.data;
    expect(barsData?.length).toBe(result.yearly.length);
    for (let k = 0; k < (barsData?.length ?? 0); k++) {
      expect(barsData?.[k].value).toBe(result.yearly[k].inflow);
    }
  });

  it("PDF-CHART: the PDF pages carry the rect equivalents", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const { buildDeckPdf } = await import("../src/pdf.js");
    const result = computeModel(demoProject());
    const model = deckSlides(demoProject(), result, { startYear: null });
    expect(model.slides[1].chart?.kind).toBe("rows");
    expect(model.slides[2].chart?.kind).toBe("bars");
    const doc = buildDeckPdf(model, "Project Alpha");
    expect(doc.getNumberOfPages()).toBe(5);
    const bytes = doc.output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});

describe("Task E: semantic states", () => {
  it("SEMANTIC-GOAL: tone classes render on the goal-met surfaces", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root \.tone-ok\s*\{[^}]*var\(--ok\)/);
    expect(css).toMatch(/\.app-root \.tone-bad\s*\{[^}]*var\(--bad\)/);
  });

  it("SEMANTIC-WARN: the warning tint is distinct from the disclosure style", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root \.warning\s*\{[^}]*var\(--bad\)/);
    expect(css).toMatch(/\.app-root \.warning\s*\{[^}]*color-mix\(in srgb, var\(--bad\) 8%/);
    expect(css).toMatch(/\.app-root \.muted\s*\{[^}]*var\(--mut\)/);
  });
});
