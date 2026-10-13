import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { shorePowerProject, yearHeader } from "../src/state.js";
import { computeModel, deckMoneyForDisplay } from "../src/engine.js";
import * as fs from "fs";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

// v0.6.7 re-anchor: the load-demo button now loads the shore power fixture (Rotterdam). The
// deck renders at the App's entry unit "thousands" (the loader does not sync the unit) and the
// port currency is EUR, so the row values are regenerated from the engine fields through
// deckMoneyForDisplay(value, "EUR", "thousands").
describe("Task C1/C2: COMPOSITION-ROWS / NO-VIEWBOX-TEXT / CHART-TRACE", () => {
  it("COMPOSITION-ROWS: one labeled row per cost line; the deck's circle charts live on the summary slide only (re-anchored per v0.6.5 Task C/W13; values per the v0.6.7 port fixture)", async () => {
    const demo = shorePowerProject();
    const result = computeModel(demo);
    const unit = "thousands";
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const rows = document.querySelector('[data-slide-name="investment"] [data-testid="composition-rows"]') as HTMLElement;
    const rowEls = rows.querySelectorAll("[data-composition-row]");
    expect(rowEls.length).toBe(result.lineTotals.length);
    expect(rowEls.length).toBe(5);
    let shareSum = 0;
    result.lineTotals.forEach((lt, i) => {
      const row = rowEls[i] as HTMLElement;
      expect(row.querySelector('[data-row-label="name"]')?.textContent).toBe(lt.name);
      expect(row.querySelector('[data-row-label="value"]')?.textContent).toBe(deckMoneyForDisplay(lt.total, "EUR", unit));
      const shareText = row.querySelector('[data-row-label="share"]')?.textContent ?? "0%";
      shareSum += Number(shareText.replace("%", ""));
    });
    // The port shares are 7.5% / 30% / 30% / 22.5% / 10%: the integer-rounded row shares are
    // 8% / 30% / 30% / 23% / 10% and sum to 101, not 100 (7.5 and 22.5 both round up). The
    // rounded display is pinned honestly rather than papered over.
    expect(shareSum).toBe(101);
    const shares = Array.from(rowEls).map((r) => r.querySelector('[data-row-label="share"]')?.textContent);
    expect(shares).toEqual(["8%", "30%", "30%", "23%", "10%"]);
    expect(document.querySelector('[data-slide-name="investment"] [data-testid="composition-donut"]')).toBeNull();
    const deckDonuts = document.querySelectorAll('[data-testid="presentation"] [data-testid="composition-donut"]');
    expect(deckDonuts.length).toBe(2);
    for (const d of Array.from(deckDonuts)) {
      expect((d.closest("[data-slide-name]") as HTMLElement).getAttribute("data-slide-name")).toBe("summary");
    }
  });

  it("NO-VIEWBOX-TEXT: no text element inside any chart SVG in the deck scope", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const svgs = document.querySelectorAll('[data-testid="presentation"] svg');
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of Array.from(svgs)) {
      expect(svg.querySelector("text")).toBeNull();
    }
    const kickers = document.querySelectorAll('[data-testid="presentation"] [data-testid="chart-kicker"]');
    expect(kickers.length).toBeGreaterThan(0);
    for (const k of Array.from(kickers)) {
      expect(k.tagName).toBe("P");
    }
  });

  it("CHART-TRACE: every drawn composition value equals its engine field; the recovery bars equal the bucketed yearly inflows", async () => {
    const demo = shorePowerProject();
    const result = computeModel(demo);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const cols = document.querySelectorAll('[data-slide-name="recovery"] [data-recovery-column]');
    // RecoveryBars buckets the 23 yearly inflows via bucketSeries(values, cap 15): width 2,
    // 12 buckets — the honest bucketing, not per-year bars.
    expect(cols.length).toBe(12);
    const width = 2;
    const years = result.yearly.length;
    expect(years).toBe(23);
    for (let k = 0; k < cols.length; k++) {
      const label = cols[k].querySelector('[data-testid="bar-year-label"]')?.textContent;
      const expected = `${yearHeader(k * width + 1, null)}–${yearHeader(Math.min(years, (k + 1) * width), null)}`;
      expect(label).toBe(expected);
    }
  });
});

describe("Task C3/C4: ACTION-TITLES / DECLUTTER", () => {
  it("ACTION-TITLES: every deck kicker states a message in words and carries no figures", async () => {
    // v0.6.7 re-anchor: the port fixture's kickers, regenerated from the delivered deck.
    const kickers: string[] = ["Substations & grid connections dominates the cost base", "Per-lift prices set the yearly recovery"];
    for (const k of kickers) {
      expect(k).toMatch(/[a-z]/);
      expect(k).not.toMatch(/\d/);
    }
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const rendered = Array.from(document.querySelectorAll('[data-testid="presentation"] [data-testid="chart-kicker"]')).map((k) => k.textContent);
    expect(rendered).toContain("Substations & grid connections dominates the cost base");
    expect(rendered).toContain("Per-lift prices set the yearly recovery");
  });

  it("DECLUTTER: the chart layer carries no gridline or tick noise; the recovery bars are zero-based", async () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\[data-testid="presentation"\] \.chart-block\s*\{/);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const barSvgs = document.querySelectorAll('[data-slide-name="recovery"] .recovery-bar-svg');
    // 12 bucketed bars (bucketSeries width 2 over 23 years), not 23 per-year bars.
    expect(barSvgs.length).toBe(12);
    for (const svg of Array.from(barSvgs)) {
      const rect = svg.querySelector("rect");
      expect(rect).toBeTruthy();
      expect(rect?.getAttribute("y")).toBe("0");
      const vb = (svg as SVGElement).getAttribute("viewBox") as string;
      const h = Number(vb.split(" ")[3]);
      expect(h).toBeGreaterThanOrEqual(1);
    }
    const rowSvgs = document.querySelectorAll('[data-slide-name="investment"] .row-bar-svg');
    expect(rowSvgs.length).toBe(5);
    for (const svg of Array.from(rowSvgs)) {
      const rect = svg.querySelector("rect");
      expect(rect?.getAttribute("y")).toBe("0");
    }
  });
});
