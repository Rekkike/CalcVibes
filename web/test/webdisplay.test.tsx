import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import * as fs from "fs";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("Task A2: YEARLY-HONEST", () => {
  it("(v0.6.18 AUD-17 re-anchor: the app cashflow chart carries the entry unit in force, thousands on a fresh app) the paired columns carry direct peak labels through the formatters and the year labels in HTML (v0.6.10 re-anchor: the shore-power program, EUR)", async () => {
    const { shorePowerProgram } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const { yearHeader } = await import("../src/state.js");
    const demo = shorePowerProgram();
    const result = computeModel(demo);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const chart = document.querySelector('[data-testid="signed-cashflow"]') as HTMLElement;
    const costPeak = Array.from(chart.querySelectorAll('[data-testid="column-peak-cost"]')).find((el) => !el.className.includes("hidden-peak")) as HTMLElement;
    const peakCost = Math.max(...result.yearly.map((y) => y.cost));
    expect(costPeak.textContent).toBe(`Cost peak ${deckMoneyForDisplay(peakCost, "EUR", "thousands")}`);
    const inflowPeak = Array.from(chart.querySelectorAll('[data-testid="column-peak-inflow"]')).find((el) => !el.className.includes("hidden-peak")) as HTMLElement;
    const peakInflow = Math.max(...result.yearly.map((y) => y.inflow));
    expect(inflowPeak.textContent).toBe(`Inflow peak ${deckMoneyForDisplay(peakInflow, "EUR", "thousands")}`);
    expect(chart.querySelector('[data-testid="column-year-label-first"]')?.textContent).toBe(yearHeader(1, 2026));
  });

  it("the cumulative line carries its endpoints and zero crossing through the formatters, on its own chart (v0.6.10 re-anchor: the shore-power program, EUR)", async () => {
    const { shorePowerProgram } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const { yearHeader } = await import("../src/state.js"); // v0.6.10: the loader presets the calendar start year 2026, so the rendered crossing label is a calendar year.
    const result = computeModel(shorePowerProgram());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const line = document.querySelector('[data-testid="signed-cashflow"]') as HTMLElement;
    expect(line.querySelector('[data-testid="line-start-value"]')?.textContent).toBe(deckMoneyForDisplay(result.yearly[0].cumulative, "EUR", "thousands"));
    expect(line.querySelector('[data-testid="line-end-value"]')?.textContent).toBe(deckMoneyForDisplay(result.yearly[result.yearly.length - 1].cumulative, "EUR", "thousands"));
    expect(line.querySelector('[data-testid="zero-baseline"]')).toBeTruthy();
    const crossing = line.querySelector('[data-testid="line-zero-crossing"]');
    const values = result.yearly.map((y) => y.cumulative);
    const zeroIdx = values.findIndex((v, i) => i > 0 && values[i - 1] < 0 && v >= 0);
    if (zeroIdx > 0) {
      expect(crossing?.textContent).toContain(yearHeader(zeroIdx + 1, 2026));
    } else {
      expect(crossing).toBeNull();
    }
    expect(line.querySelector('[data-chart-line="cumulative"]')).toBeTruthy();
    expect(line.querySelectorAll('[data-chart-bar]').length).toBe(result.yearly.length * 2);
  });
});

describe("Task A3: NO-LEGEND / Task A4: consistency", () => {
  it("NO-LEGEND: no legend element or legend-class block in any chart in either suite", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).not.toMatch(/\.legend\s*\{/);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    fireEvent.click(byNav("costs"));
    fireEvent.click(byAction("present"));
    expect(document.querySelector('[data-testid="presentation"] .legend')).toBeNull();
    expect(document.querySelector(".app-root .legend")).toBeNull();
    for (const svg of Array.from(document.querySelectorAll('[data-testid="presentation"] svg'))) {
      if (svg.closest('[data-testid="gantt-chart"]') !== null) continue; // v0.6.13.1 re-anchor: the Gantt SVG labels with direct text
      expect(svg.querySelector("text")).toBeNull();
    }
    for (const svg of Array.from(document.querySelectorAll(".app-root svg"))) {
      expect(svg.querySelector("text")).toBeNull();
    }
  });

  it("APP-FORMAT-UNCHANGED: the app money display keeps its standing full-precision format", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, moneyForDisplay } = await import("../src/engine.js");
    const result = computeModel(demoProject());
    const appString = moneyForDisplay(result.lineTotals[0].total, "SEK", "ones");
    expect(appString).toMatch(/\d \d{3},\d{2} kr$/);
    expect(appString).not.toMatch(/ tkr| Mkr|kr\/|NaN/);

  });
});

describe("Task F1/F2: DECK-MONEY-CLASS / DECK-YEARS-CLASS", () => {
  it("DECK-MONEY-CLASS: every deck money string carries no decimal separator and equals the deck formatter output", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const demo = demoProject();
    const result = computeModel(demo);
    const unit = "thousands";
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: unit as never });
    const moneyTiles = deck.slides[6].tiles ?? [];
    for (const t of moneyTiles) {
      if (t.label.includes("IRR") || t.label.includes("MIRR") || t.label.includes("index") || t.label.includes("Break-even")) continue;
      expect(t.value).not.toMatch(/,\d/);
    }
    expect(moneyTiles.find((t) => t.label === "Total cost")?.value).toBe(deckMoneyForDisplay(result.totalCost, "SEK", unit as never));
    expect(deck.slides[1].tiles?.find((t) => t.label === "Cost NPV")?.value).toBe(deckMoneyForDisplay(result.costNpv, "SEK", unit as never));
  });

  it("DECK-YEARS-CLASS: every deck year-count string equals the deck years formatter output (one decimal)", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, deckYearsForDisplay } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null });
    const tiles = deck.slides[6].tiles ?? [];
    expect(tiles.find((t) => t.label === "Payback (nominal)")?.value).toBe(deckYearsForDisplay(result.paybackYears as number));
    expect(deck.slides[4].body.find((f) => f.label === "Discounted payback (at WACC)")?.value).toBe(result.discountedPaybackYears === null ? undefined : deckYearsForDisplay(result.discountedPaybackYears));
    expect(tiles.find((t) => t.label === "Payback (nominal)")?.value).toMatch(/\.1 years$|\.0 years$|\.\d years$/);
    expect(result.paybackYears as number).not.toBe(Math.round(result.paybackYears as number));
  });

  it("the years edge of record: 8.47 renders at one decimal, never truncated to 8", async () => {
    const { deckYearsForDisplay } = await import("../src/engine.js");
    expect(deckYearsForDisplay(8.47)).toBe("8.5 years");
    expect(deckYearsForDisplay(8.47)).not.toBe("8 years");
    expect(deckYearsForDisplay(6.96)).toBe("7.0 years");
  });
});

describe("Task R1/R2/R3 (v0.5.7R): the rendered reading class and the named peaks", () => {
  it("DECK-MONEY-CLASS (rendered scope): no decimal separator in any rendered presentation-scope chart money string (v0.6.10 re-anchor: the shore-power program, EUR)", async () => {
    const { shorePowerProgram } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const result = computeModel(shorePowerProgram());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    // v0.6.15 re-anchor: the ledger waterfall replaces the composition rows (the values are the money strings).
    const rows = document.querySelector('[data-slide-name="investment"] [data-testid="ledger-waterfall"]') as HTMLElement;
    for (const rowEl of Array.from(rows.querySelectorAll("[data-ledger-row]"))) {
      const value = rowEl.querySelector("[data-ledger-value]")?.textContent ?? "";
      expect(value).not.toMatch(/,\d/);
      expect(value).not.toBe("");
    }
    const firstTotal = result.lineTotals[0].total;
    expect(rows.querySelector("[data-ledger-row]")?.querySelector("[data-ledger-value]")?.textContent).toBe(deckMoneyForDisplay(firstTotal, "EUR", "thousands"));
  });

  it("APP-CHART-READING-CLASS: every app chart label renders through the reading class; the tables keep the standing format (v0.6.10 re-anchor: the shore-power program, EUR)", async () => {
    const { shorePowerProgram } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const result = computeModel(shorePowerProgram());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const columns = document.querySelector('[data-testid="signed-cashflow"]') as HTMLElement;
    const costPeak = Array.from(columns.querySelectorAll('[data-testid="column-peak-cost"]')).find((el) => !el.className.includes("hidden-peak")) as HTMLElement;
    const peakCost = Math.max(...result.yearly.map((y) => y.cost));
    expect(costPeak.textContent).toBe(`Cost peak ${deckMoneyForDisplay(peakCost, "EUR", "thousands")}`);
    const line = columns;
    expect(line.querySelector('[data-testid="line-start-value"]')?.textContent).toBe(deckMoneyForDisplay(result.yearly[0].cumulative, "EUR", "thousands"));
    expect(line.querySelector('[data-testid="line-end-value"]')?.textContent).not.toMatch(/,\d{2}/);
    fireEvent.click(byNav("detail"));
    const detailCell = Array.from(document.querySelectorAll("td.table-value-cell")).find((td) => (td.textContent ?? "").includes(","))?.textContent ?? "";
    expect(detailCell).toMatch(/,\d{2}/);
  });

  it("PEAK-NAMED: every peak label names its series; the deck recovery peak carries its year range (v0.6.10 re-anchor: the program peak is a recovery bucket sum at width 2 and names its calendar range through the loader-preset 2026)", async () => {
    const { shorePowerProgram } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const { yearHeader } = await import("../src/state.js");
    const result = computeModel(shorePowerProgram());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const peak = Array.from(document.querySelectorAll('[data-slide-name="recovery"] [data-testid="peak-label"]')).find((el) => el.textContent !== "\u00a0") as HTMLElement;
    // v0.6.18 Task H1 / AUD-27: the annual basis; the grants and the interest-free note are not in the bars
    const inflows = result.collectionsGrid.filter((r) => r.kind !== "grant" && r.kind !== "funding-loan").reduce((acc, row) => {
      for (let k = 0; k < Math.min(result.yearly.length, row.amounts.length); k++) acc[k] = (acc[k] ?? 0) + row.amounts[k];
      return acc;
    }, new Array<number>(result.yearly.length).fill(0));
    const peakIdx = inflows.reduce((bi, v, i) => (v > inflows[bi] ? i : bi), 0);
    expect(peak.textContent).toBe(`${deckMoneyForDisplay(inflows[peakIdx], "EUR", "thousands")} in ${yearHeader(peakIdx + 1, 2026)}`);
    fireEvent.click(byAction("exit-presentation"));
    fireEvent.click(byNav("results"));
    const columns = document.querySelector('[data-testid="signed-cashflow"]') as HTMLElement;
    const costPeak = Array.from(columns.querySelectorAll('[data-testid="column-peak-cost"]')).find((el) => !el.className.includes("hidden-peak")) as HTMLElement;
    expect(costPeak.textContent).toMatch(/^Cost peak /);
    const inflowPeak = Array.from(columns.querySelectorAll('[data-testid="column-peak-inflow"]')).find((el) => !el.className.includes("hidden-peak")) as HTMLElement;
    expect(inflowPeak.textContent).toMatch(/^Inflow peak /);
  });
});
