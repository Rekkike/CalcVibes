import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import fs from "node:fs";
import { App } from "../src/App.js";
import { computeModel, deckMoneyForDisplay, percentForDisplay, deckYearsForDisplay } from "../src/engine.js";
import { demoProject } from "../src/state.js";
import { deckSlides } from "../src/deck.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("v0.6R — the prototype-pinned infographic layer", () => {
  it("SIGNED-CASHFLOW: the merged chart renders costs strictly below the zero baseline and inflows above, one currency axis", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const chart = document.querySelector('[data-testid="signed-cashflow"]') as HTMLElement;
    expect(chart).toBeTruthy();
    const z = Number(chart.querySelector('[data-testid="zero-baseline"]')?.getAttribute("y1"));
    for (const bar of Array.from(chart.querySelectorAll('[data-chart-bar="cost"]'))) {
      const pts = (bar.getAttribute("points") as string).split(" ").map((xy) => Number(xy.split(",")[1]));
      expect(Math.min(...pts)).toBeCloseTo(z, 1);
      expect(Math.max(...pts)).toBeGreaterThan(z - 1);
      expect(bar.getAttribute("data-signed")).toBe("below");
    }
    for (const bar of Array.from(chart.querySelectorAll('[data-chart-bar="inflow"]'))) {
      const pts = (bar.getAttribute("points") as string).split(" ").map((xy) => Number(xy.split(",")[1]));
      expect(Math.max(...pts)).toBeCloseTo(z, 1);
      expect(Math.min(...pts)).toBeLessThan(z + 1);
      expect(bar.getAttribute("data-signed")).toBe("above");
    }
    expect(chart.querySelector('[data-chart-line="cumulative"]')).toBeTruthy();
    expect(chart.querySelectorAll('[data-testid="zero-baseline"]').length).toBe(1);
  });

  it("COVERAGE-INLINE: the cumulative line renders within the same scale as the bars with the break-even crossing labeled; the standalone Results coverage entity is gone", async () => {
    const result = computeModel(demoProject());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const chart = document.querySelector('[data-testid="signed-cashflow"]') as HTMLElement;
    expect(chart.querySelector('[data-chart-line="cumulative"]')).toBeTruthy();
    const crossing = chart.querySelector('[data-testid="line-zero-crossing"]');
    const values = result.yearly.map((y) => y.cumulative);
    const zeroIdx = values.findIndex((v, i) => i > 0 && values[i - 1] < 0 && v >= 0);
    expect(zeroIdx).toBeGreaterThan(0);
    expect(crossing?.textContent).toContain("zero at");
    expect(document.querySelector('[data-testid="cumulative-line"]')).toBeNull();
    expect(document.querySelector('[data-testid="cost-inflow-columns"]')).toBeNull();
  });

  it("OVERVIEW-SUMMARY: the Overview metric cards and summary chart bind to engine fields through the formatters", () => {
    const result = computeModel(demoProject());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("overview"));
    const cards = document.querySelector('[data-testid="metric-cards"]') as HTMLElement;
    expect(cards).toBeTruthy();
    expect(cards.querySelector('[data-metric="totalCost"] .metric-value')?.textContent).toBe(deckMoneyForDisplay(result.totalCost, "SEK"));
    expect(cards.querySelector('[data-metric="requiredPayment"] .metric-value')?.textContent).toBe(deckMoneyForDisplay(result.paymentAmount as number, "SEK"));
    expect(cards.querySelector('[data-metric="achievedIrr"] .metric-value')?.textContent).toBe(percentForDisplay(result.achievedIrr, 2));
    expect(cards.querySelector('[data-metric="payback"] .metric-value')?.textContent).toBe(deckYearsForDisplay(result.paybackYears as number));
    expect(cards.querySelector(".metric-label")?.textContent).toBeTruthy();
    expect(document.querySelector('[data-testid="overview-cashflow-chart"] [data-testid="signed-cashflow"]')).toBeTruthy();
  });

  it("OVERVIEW-SUMMARY-EMPTY: an invalid project renders the honest empty branch, never a broken chart", () => {
    render(<App />);
    fireEvent.click(byAction("new-project"));
    fireEvent.click(byNav("costs"));
    fireEvent.click(document.querySelector('[data-action="add-cost"]') as HTMLElement);
    fireEvent.click(byNav("overview"));
    expect(document.querySelector('[data-testid="issues-summary"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="overview-summary-empty"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="overview-cashflow-chart"]')).toBeNull();
    expect(document.querySelector('[data-testid="overview-summary"]')).toBeNull();
  });

  it("SLIDE-COMPOSE and GOLD-LINE: the coverage slide carries the signed bars with the gold line, the caption in plain language, and honest proportions", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 3; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const slide = document.querySelector('[data-slide-name="coverage"]') as HTMLElement;
    const stage = slide.querySelector('[data-testid="stage-returns"]') as HTMLElement;
    expect(stage).toBeTruthy();
    expect(stage.querySelector('[data-testid="stage-gold-line"]')?.getAttribute("stroke")).toBe("#e8b84b");
    expect(slide.querySelector('[data-testid="crossing-caption"]')).toBeTruthy();
    const caption = slide.querySelector('[data-testid="crossing-caption"]')?.textContent ?? "";
    expect(caption).not.toMatch(/\d/);
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\[data-testid="presentation"\] \.stage-returns-svg\s*\{[^}]*height:\s*150px/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.deck-slide\b[^{]*\{[^}]*min-height/);
  });

  it("DECK-CHROME and NUMBERED-KICKERS: every non-title slide carries its numbered kicker; the title slide carries the three-metric row", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay, percentTwoForDisplay } = await import("../src/engine.js");
    const result = computeModel(demoProject());
    const deck = deckSlides(demoProject(), result, { startYear: null, entryUnit: "ones" });
    expect(deck.slides[0].titleMetrics?.map((m) => m.label)).toEqual(["Project cost", "Target IRR", "Investment term"]);
    expect(deck.slides[0].titleMetrics?.[0].value).toBe(deckMoneyForDisplay(result.totalCost, "SEK", "ones"));
    expect(deck.slides[0].titleMetrics?.[1].value).toBe(percentTwoForDisplay(demoProject().targetIrr / 100));
    for (let i = 1; i < deck.slides.length; i++) {
      expect(deck.slides[i].kickerNumber).toBe("0" + i);
    }
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const kickers = document.querySelectorAll('[data-testid="slide-kicker"]');
    expect(kickers.length).toBe(5);
    expect(kickers[0].textContent).toMatch(/^01 — /);
    const titleMetrics = document.querySelector('[data-testid="title-metrics"]') as HTMLElement;
    expect(titleMetrics).toBeTruthy();
    expect(titleMetrics.querySelectorAll('[data-title-metric]').length).toBe(3);
    const navButton = document.querySelector('[data-action="prev-slide"]') as HTMLElement;
    expect(navButton.className).toContain("stage-nav-button");
    expect(document.querySelector('[data-dot="1"]')?.className).toContain("stage-dot");
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\[data-testid="presentation"\] \.stage-nav-button\s*\{[^}]*border-radius:\s*999px/);
  });

  it("DONUT-WORKING: the whole-and-labeled contract holds; a clipped circle or an inside-geometry label goes red by the pins in design-overhaul", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const donut = document.querySelector('[data-testid="composition-donut"]') as HTMLElement;
    expect(donut).toBeTruthy();
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root \.donut-svg\s*\{[^}]*max-width:\s*100%/);
    expect(css).toMatch(/\.app-root \.donut-svg\s*\{[^}]*width:\s*160px/);
    for (const label of Array.from(donut.querySelectorAll('[data-testid="donut-label"]'))) {
      expect((donut.querySelector("svg") as SVGSVGElement).contains(label)).toBe(false);
    }
    expect(donut.querySelector('[data-testid="donut-center-total"]')).toBeTruthy();
    const deckScope = document.querySelectorAll('[data-testid="presentation"] [data-testid="composition-donut"]');
    expect(deckScope.length).toBe(0);
  });

  it("EDITOR-BOUNDS: the cost editor scrolls within its card with the sticky first column; the pinned overflow cannot return", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const scroll = document.querySelector('[data-testid="cost-editor-scroll"]') as HTMLElement;
    expect(scroll).toBeTruthy();
    expect(scroll.className).toContain("editor-scroll");
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.app-root \.editor-scroll\s*\{[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/\.app-root \.editor-scroll table th:first-child,\s*\.app-root \.editor-scroll table td:first-child\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/\.app-root \.editor-scroll input\[type="number"\],\s*\.app-root \.editor-scroll select\s*\{[^}]*width:\s*100%/);
    expect(css).toMatch(/@media[^{]*360px[^{]*\{[\s\S]*?\.app-root \.editor-scroll/);
  });

  it("VERSION-CURRENT: the rendered label equals the constant equals v0.6R", async () => {
    const { VERSION } = await import("../src/engine.js");
    expect(VERSION).toBe("v0.6R");
    render(<App />);
    expect(document.querySelector('[data-testid="version"]')?.textContent).toBe(VERSION);
    expect(document.querySelector('[data-testid="version"]')?.textContent).toBe("v0.6R");
  });

  it("CHART-TRACE and ACTION-TITLES stand: the signed chart values equal the engine yearly rows; the deck titles carry no figures on the coverage slide", () => {
    const result = computeModel(demoProject());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const chart = document.querySelector('[data-testid="signed-cashflow"]') as HTMLElement;
    const bars = chart.querySelectorAll('[data-chart-bar="cost"]');
    expect(bars.length).toBe(result.yearly.length);
    for (const bar of Array.from(bars)) {
      const year = Number(bar.getAttribute("data-bar-year"));
      const row = result.yearly.find((y) => y.year === year);
      expect(row).toBeTruthy();
    }
    const deck = deckSlides(demoProject(), result, { startYear: null, entryUnit: "ones" });
    expect(deck.slides[3].title).not.toMatch(/\d/);
  });
});
