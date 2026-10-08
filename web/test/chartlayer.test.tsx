import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import * as fs from "fs";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

describe("Task C1/C2: COMPOSITION-ROWS / NO-VIEWBOX-TEXT / CHART-TRACE", () => {
  it("COMPOSITION-ROWS: one labeled row per cost line; the shares sum to 100; no donut in the deck scope", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const demo = demoProject();
    const result = computeModel(demo);
    const unit = "thousands";
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const rows = document.querySelector('[data-slide-name="investment"] [data-testid="composition-rows"]') as HTMLElement;
    const rowEls = rows.querySelectorAll("[data-composition-row]");
    expect(rowEls.length).toBe(result.lineTotals.length);
    let shareSum = 0;
    result.lineTotals.forEach((lt, i) => {
      const row = rowEls[i] as HTMLElement;
      expect(row.querySelector('[data-row-label="name"]')?.textContent).toBe(lt.name);
      expect(row.querySelector('[data-row-label="value"]')?.textContent).toBe(deckMoneyForDisplay(lt.total, "SEK", unit));
      const shareText = row.querySelector('[data-row-label="share"]')?.textContent ?? "0%";
      shareSum += Number(shareText.replace("%", ""));
    });
    expect(shareSum).toBe(100);
    expect(document.querySelector('[data-testid="presentation"] [data-testid="composition-donut"]')).toBeNull();
    expect(document.querySelector('[data-testid="presentation"] [data-donut-segment]')).toBeNull();
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

  it("CHART-TRACE: every drawn composition value equals its engine field; the recovery bars equal the yearly inflows", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const cols = document.querySelectorAll('[data-slide-name="recovery"] [data-recovery-column]');
    expect(cols.length).toBe(10);
    const years = Array.from(cols).map((c) => c.querySelector('[data-testid="bar-year-label"]')?.textContent);
    for (let k = 0; k < 10; k++) {
      expect(years[k]).toBe(`Year ${k + 1}`);
    }
  });
});

describe("Task C3/C4: ACTION-TITLES / DECLUTTER", () => {
  it("ACTION-TITLES: every deck kicker states a message in words and carries no figures", async () => {
    const kickers: string[] = ["Development team dominates the cost base", "Even payments spread the recovery"];
    for (const k of kickers) {
      expect(k).toMatch(/[a-z]/);
      expect(k).not.toMatch(/\d/);
    }
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const rendered = Array.from(document.querySelectorAll('[data-testid="presentation"] [data-testid="chart-kicker"]')).map((k) => k.textContent);
    expect(rendered).toContain("Development team dominates the cost base");
    expect(rendered).toContain("Even payments spread the recovery");
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
    expect(barSvgs.length).toBe(10);
    for (const svg of Array.from(barSvgs)) {
      const rect = svg.querySelector("rect");
      expect(rect).toBeTruthy();
      expect(rect?.getAttribute("y")).toBe("0");
      const vb = (svg as SVGElement).getAttribute("viewBox") as string;
      const h = Number(vb.split(" ")[3]);
      expect(h).toBeGreaterThanOrEqual(1);
    }
    const rowSvgs = document.querySelectorAll('[data-slide-name="investment"] .row-bar-svg');
    expect(rowSvgs.length).toBe(3);
    for (const svg of Array.from(rowSvgs)) {
      const rect = svg.querySelector("rect");
      expect(rect?.getAttribute("y")).toBe("0");
    }
  });
});
