import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import * as fs from "fs";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("Task R4: VERDICT-NO / TOGGLE-POSITION / NO-DEAD-RULE", () => {
  it("VERDICT-NO: a not-met configuration renders the falls-short verdict honestly", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("tariff"));
    fireEvent.change(document.querySelector('[data-field="tariffMode"]') as HTMLElement, { target: { value: "fixed" } });
    fireEvent.change(document.querySelector('[data-field="tariffFixed"]') as HTMLElement, { target: { value: "100" } });
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const verdict = document.querySelector('[data-testid="deck-verdict"]');
    expect(verdict && verdict.textContent).toContain("Target missed");
  });

  it("TOGGLE-POSITION: the theme toggle and the version render at the top right of the header", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.header-controls\s*\{[^}]*margin-left:\s*auto/);
    render(<App />);
    const header = document.querySelector("header.app-header") as HTMLElement;
    expect(header).toBeTruthy();
    const controls = header.querySelector('[data-testid="header-controls"]') as HTMLElement;
    expect(controls).toBeTruthy();
    expect(controls.querySelector('[data-field="theme"]')).toBeTruthy();
    expect(controls.querySelector('[data-testid="version"]')).toBeTruthy();
    expect(controls.lastElementChild?.getAttribute("data-testid")).toBe("version");
    const headerRect = header.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();
    expect(controlsRect.right).toBeGreaterThanOrEqual(headerRect.right - 2);
  });

  it("NO-DEAD-RULE: the .deck-sub rule is removed from the stylesheet", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).not.toMatch(/\.deck-sub/);
  });
});

describe("Task R3: FIN-TILES / NO-DEAD-BODY", () => {
  it("FIN-TILES: the financing variant renders exactly nine tiles, enumerated, the DSCR tile carrying the calendar-labeled year", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, percentTwoForDisplay, dscrTwoForDisplay, deckMoneyForDisplay } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const { yearHeader } = await import("../src/state.js");
    const inputs = { ...demoProject(), financing: { enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0, serviceStartYear: null, amortization: "annuity" as const, leveragedSolve: false, perLineSharePct: {} } };
    const result = computeModel(inputs);
    const deck = deckSlides(inputs, result, { startYear: null });
    const tiles = deck.slides[6].tiles ?? [];
    expect(tiles.length).toBe(9);
    const labels = tiles.map((t) => t.label);
    expect(labels).toEqual([
      "Total cost", "Total collected", "Net gain", "Achieved IRR", "NPV at WACC",
      "Payback (nominal)", "Equity outlay", "Equity IRR", "Minimum DSCR",
    ]);
    const fin = result.financing;
    expect(fin).not.toBeNull();
    const byLabel = (l: string) => tiles.find((t) => t.label === l);
    expect(byLabel("Equity outlay")?.value).toBe(deckMoneyForDisplay(fin!.equity.outlay, "SEK", "ones"));
    expect(byLabel("Equity IRR")?.value).toBe(percentTwoForDisplay(fin!.equity.irr as number));
    expect(byLabel("Minimum DSCR")?.value).toBe(dscrTwoForDisplay(fin!.minDscr!.value));
    expect(byLabel("Minimum DSCR")?.disclosure).toBe(`in ${yearHeader(fin!.minDscr!.year, null)}`);
  });

  it("NO-DEAD-BODY: deck.ts contains no built-and-discarded deal body", () => {
    const src = fs.readFileSync("src/deck.ts", "utf8");
    expect(src).not.toMatch(/dealBody/);
  });
});

describe("Task R2: PDF-TILES / PDF-SUMMARY-CHARTS / TILE-TRACE", () => {
  it("PDF-TILES: every deal tile label and value appears in the drawn trace; a tile removal fails", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const { buildDeckPdf } = await import("../src/pdf.js");
    const result = computeModel(demoProject());
    const model = deckSlides(demoProject(), result, { startYear: null });
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    const doc = buildDeckPdf(model, "Project Alpha", trace);
    const tracedDeal = trace.drawnFigures[6].join("|");
    const tiles = model.slides[6].tiles ?? [];
    expect(tiles.length).toBe(6);
    for (const t of tiles) {
      expect(tracedDeal).toContain(t.value);
    }
    expect(doc.getNumberOfPages()).toBe(7);
  });

  it("PDF-SUMMARY-CHARTS: both mini charts are drawn with their labels and the peak", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const { buildDeckPdf } = await import("../src/pdf.js");
    const result = computeModel(demoProject());
    const model = deckSlides(demoProject(), result, { startYear: null });
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(model, "Project Alpha", trace);
    const tracedDeal = trace.drawnFigures[6].join("|");
    const hurdle = model.slides[6].summaryCharts?.[0];
    const bars = model.slides[6].summaryCharts?.[1];
    expect(hurdle?.kind).toBe("hurdle");
    expect(bars?.kind).toBe("bars");
    expect(bars?.data.length).toBe(result.yearly.length);
    for (const d of bars?.data ?? []) {
      expect(tracedDeal).toContain(d.label);
    }
    expect(tracedDeal).toContain(`Target ${hurdle?.data[0].value.toFixed(2)}%`);
    expect(tracedDeal).toContain(`Achieved ${hurdle?.data[1].value.toFixed(2)}%`);
  });

  it("TILE-TRACE (the EX-1 repair): every base-demo deal tile value equals its engine field through the display formatters", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, percentTwoForDisplay, deckMoneyForDisplay, deckYearsForDisplay } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null });
    const tiles = deck.slides[6].tiles ?? [];
    const byLabel = (l: string) => tiles.find((t) => t.label === l);
    const unit = "ones";
    expect(byLabel("Total cost")?.value).toBe(deckMoneyForDisplay(result.totalCost, "SEK", unit));
    expect(byLabel("Total collected")?.value).toBe(deckMoneyForDisplay(result.totalCollected, "SEK", unit));
    expect(byLabel("Net gain")?.value).toBe(deckMoneyForDisplay(result.netGain, "SEK", unit));
    expect(byLabel("Achieved IRR")?.value).toBe(`${percentTwoForDisplay(result.achievedIrr ?? 0)} vs ${percentTwoForDisplay(demo.targetIrr / 100)} target`);
    expect(byLabel("NPV at WACC")?.value).toBe(deckMoneyForDisplay(result.npvAtWacc, "SEK", unit));
    expect(byLabel("Payback (nominal)")?.value).toBe(deckYearsForDisplay(result.paybackYears as number));
  });
});

describe("Task R1: TILE-GRID / TONE-RENDER / STAGE-CHART-LEGIBILITY / RESPONSIVE", () => {
  it("TILE-GRID: the presentation scope styles the tile grid and the deck tiles as cards", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\[data-testid="presentation"\] \.summary-tiles\s*\{[^}]*display:\s*grid/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.summary-tiles\s*\{[^}]*grid-template-columns/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.deck-tile\s*\{[^}]*border-radius:\s*12px/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.deck-tile\s*\{[^}]*background:\s*rgba\(30, 41, 59, 0\.6\)/);
  });

  it("TONE-RENDER: the achieved-IRR tile carries the ok tone when the goal is met and the bad tone when it is not", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const okTile = document.querySelector('[data-tile="Achieved IRR"]') as HTMLElement;
    expect(okTile.className).toContain("tone-ok");

    fireEvent.click(byAction("exit-presentation"));
    fireEvent.click(byNav("tariff"));
    fireEvent.change(document.querySelector('[data-field="tariffMode"]') as HTMLElement, { target: { value: "fixed" } });
    fireEvent.change(document.querySelector('[data-field="tariffFixed"]') as HTMLElement, { target: { value: "100" } });
    fireEvent.click(byAction("present"));
    const badTile = document.querySelector('[data-tile="Achieved IRR"]') as HTMLElement;
    expect(badTile.className).toContain("tone-bad");
  });

  it("STAGE-CHART-LEGIBILITY (re-anchored to the composition rows per v0.5.6): the row names and shares render near-white", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const rows = document.querySelector('[data-slide-name="investment"] [data-testid="composition-rows"]') as HTMLElement;
    const name = rows.querySelector('[data-row-label="name"]') as HTMLElement;
    expect(name.className).toContain("row-name");
    const share = rows.querySelector('[data-row-label="share"]') as HTMLElement;
    expect(share.textContent).toMatch(/%$/);
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\[data-testid="presentation"\] \.composition-row \.row-name\s*\{[^}]*color:\s*#e2e8f0/);
  });

  it("RESPONSIVE: the charts are width-constrained and the donut labels sit inside the SVG bounds", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\[data-testid="presentation"\] svg\s*\{[^}]*max-width:\s*100%/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.summary-charts svg\s*\{[^}]*width:\s*100%/);
    for (const m of css.matchAll(/\[data-testid="presentation"\][^{]*svg[^{]*\{[^}]*width:\s*(\d+)px/g)) {
      expect(Number(m[1])).toBeLessThanOrEqual(360);
    }
    for (const m of css.matchAll(/svg\s*\{[^}]*width:\s*(\d+)px/g)) {
      expect(Number(m[1])).toBeLessThanOrEqual(360);
    }
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const rows = document.querySelector('[data-slide-name="investment"] [data-testid="composition-rows"]') as HTMLElement;
    expect(rows.querySelectorAll("[data-composition-row]").length).toBeGreaterThan(0);
    for (const svg of Array.from(document.querySelectorAll('[data-testid="presentation"] svg'))) {
      expect(svg.getAttribute("width")).toBeNull();
      expect(svg.querySelector("text")).toBeNull();
    }
  });
});

describe("Task R5: CHART-WHOLE / CHART-PURPOSE", () => {
  it("CHART-WHOLE: every deck chart SVG is viewBox-governed with no fixed pixel width, and the year labels render whole", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const svgs = document.querySelectorAll('[data-testid="presentation"] section[data-slide-name] svg');
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of Array.from(svgs)) {
      expect(svg.getAttribute("viewBox")).toBeTruthy();
      expect(svg.getAttribute("width")).toBeNull();
      expect(svg.getAttribute("height")).toBeNull();
    }
  });

  it("CHART-WHOLE: the recovery bars carry complete year labels equal to the year headers (v0.6.7 re-anchor: the port recovery buckets at width 2)", async () => {
    const { shorePowerProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const { yearHeader } = await import("../src/state.js");
    const { bucketSeries } = await import("../src/charts.js");
    const result = computeModel(shorePowerProject());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const bars = document.querySelector('[data-slide-name="recovery"] [data-testid="recovery-bars"]') as SVGElement;
    const yearLabels = bars.querySelectorAll('[data-testid="bar-year-label"]');
    const { width } = bucketSeries(new Array<number>(result.yearly.length).fill(0), 15);
    expect(yearLabels.length).toBe(Math.ceil(result.yearly.length / width));
    for (let k = 0; k < yearLabels.length; k++) {
      expect((yearLabels[k] as SVGTextElement).textContent).toBe(width === 1
        ? yearHeader(k + 1, null)
        : `${yearHeader(k * width + 1, null)}–${yearHeader(Math.min(result.yearly.length, (k + 1) * width), null)}`);
    }
  });

  it("CHART-PURPOSE: every deck chart carries its kicker title, its labels, and its total (v0.6.7 re-anchor: the port cost base and per-lift recovery, EUR at entry thousands)", async () => {
    const { shorePowerProject } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const { bucketSeries } = await import("../src/charts.js");
    const demo = shorePowerProject();
    const result = computeModel(demo);
    const unit = "thousands";
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const investmentRows = document.querySelector('[data-slide-name="investment"] [data-testid="composition-rows"]');
    expect(investmentRows?.querySelector('[data-testid="chart-kicker"]')?.textContent).toBe("Substations & grid connections dominates the cost base");
    expect(investmentRows?.querySelectorAll("[data-composition-row]").length).toBe(5);
    const firstRow = investmentRows?.querySelector("[data-composition-row]");
    expect(firstRow?.querySelector('[data-row-label="name"]')?.textContent).toBe(result.lineTotals[0].name);
    expect(firstRow?.querySelector('[data-row-label="value"]')?.textContent).toBe(deckMoneyForDisplay(result.lineTotals[0].total, "EUR", unit));

    fireEvent.keyDown(window, { key: "ArrowRight" });
    const recoveryBars = document.querySelector('[data-slide-name="recovery"] [data-testid="recovery-bars"]');
    expect(recoveryBars?.querySelector('[data-testid="chart-kicker"]')?.textContent).toBe("Per-lift prices set the yearly recovery");
    const { width } = bucketSeries(new Array<number>(result.yearly.length).fill(0), 15);
    expect(recoveryBars?.querySelectorAll('[data-testid="bar-year-label"]').length).toBe(Math.ceil(result.yearly.length / width));
    expect(recoveryBars?.querySelector('[data-testid="peak-label"]')).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const summaryHurdle = document.querySelector('[data-summary-chart="hurdle"]');
    const summaryBars = document.querySelector('[data-summary-chart="bars"]');
    expect(summaryHurdle?.querySelector('[data-testid="hurdle-target-dot"]')).toBeTruthy();
    expect(summaryBars?.querySelector('[data-testid="chart-kicker"]')?.textContent).toBe("Per-lift prices set the yearly recovery");
  });

  it("PEAK-FORMAT: the peak label equals the display formatter output of the engine peak at the unit in force (v0.6.7 re-anchor: the port peak is a recovery bucket sum at width 2)", async () => {
    const { shorePowerProject } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const { yearHeader } = await import("../src/state.js");
    const { bucketSeries } = await import("../src/charts.js");
    const demo = shorePowerProject();
    const result = computeModel(demo);
    const unit = "thousands";
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const peak = Array.from(document.querySelectorAll('[data-testid="peak-label"]')).find((el) => el.textContent !== "\u00a0") as HTMLElement;
    const rawInflows = result.collectionsGrid.reduce((acc, row) => {
      for (let k = 0; k < Math.min(result.yearly.length, row.amounts.length); k++) acc[k] = (acc[k] ?? 0) + row.amounts[k];
      return acc;
    }, new Array<number>(result.yearly.length).fill(0));
    const { buckets, width } = bucketSeries(rawInflows, 15);
    const peakIdx = buckets.indexOf(Math.max(...buckets));
    expect(peak.textContent).toBe(`${deckMoneyForDisplay(buckets[peakIdx], "EUR", unit)} in ${yearHeader(peakIdx * width + 1, null)}`);
  });

  it("PEAK-PRINT: the print stylesheet carries the peak-label ink variant", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/@media print[\s\S]*?\[data-testid="presentation"\] \.peak-label\s*\{[^}]*color:\s*#343434/);
  });
});
