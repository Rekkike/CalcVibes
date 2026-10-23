import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { shorePowerProgram, yearHeader } from "../src/state.js";
import { computeModel, deckMoneyForDisplay } from "../src/engine.js";
import * as fs from "fs";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

// v0.6.10 re-anchor: the load-demo button loads the shore-power program fixture (Rotterdam).
// The deck renders at the App entry unit (the loader does not sync the unit) and the
// program currency is EUR, so the row values are regenerated from the engine fields
// through deckMoneyForDisplay(value, "EUR", "thousands"); the year labels are calendar
// years through the loader-preset start year 2026.
describe("Task C1/C2: COMPOSITION-ROWS / NO-VIEWBOX-TEXT / CHART-TRACE", () => {
  it("COMPOSITION-ROWS: one labeled row per cost line; the deck's circle charts live on the summary slide only (re-anchored per v0.6.5 Task C/W13; values per the v0.6.10 program fixture)", async () => {
    const demo = shorePowerProgram();
    const result = computeModel(demo);
    const unit = "thousands";
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    // v0.6.15 re-anchor: the composition rows retired from the investment slide; the ledger waterfall
    // carries one row per capital cost line (the full name, the value at the bar end) and the shares
    // move to the ONE full-outflow basis (the share of the total program cost, comma one-decimal).
    const rows = document.querySelector('[data-slide-name="investment"] [data-testid="ledger-waterfall"]') as HTMLElement;
    const rowEls = rows.querySelectorAll('[data-ledger-row][data-ledger-kind="capital"]');
    expect(rowEls.length).toBe(result.lineTotals.length);
    expect(rowEls.length).toBe(6);
    result.lineTotals.forEach((lt, i) => {
      const row = rowEls[i] as HTMLElement;
      expect(row.querySelector('[data-ledger-label="name"]')?.textContent).toBe(lt.name);
      expect(row.querySelector("[data-ledger-value]")?.textContent).toBe(deckMoneyForDisplay(lt.total, "EUR", unit));
    });
    const shares = Array.from(rowEls).map((r) => r.querySelector("[data-ledger-share]")?.textContent);
    // v0.6.18 re-anchor: the shares are of the capital program (the operating row retired); the six
    // one-decimal shares close at 100.1, the honest one-decimal residue, never smoothed
    expect(shares).toEqual(["16,5%", "24,5%", "22,3%", "27,8%", "4,5%", "4,5%"]);
    expect(rows.querySelector('[data-ledger-kind="operating"]')).toBeNull();
    const sum = shares.reduce((a, s) => a + Number((s as string).replace(",", ".").replace("%", "")), 0);
    expect(sum).toBeCloseTo(100.1, 6);
    expect(fs.readFileSync("src/index.css", "utf8")).toMatch(/\.ledger-bar\s*\{[^}]*background:\s*#38bdf8/);
    expect(document.querySelector('[data-slide-name="investment"] [data-testid="composition-donut"]')).toBeNull();
    const deckDonuts = document.querySelectorAll('[data-testid="presentation"] [data-testid="composition-donut"]');
    expect(deckDonuts.length).toBe(2);
    for (const d of Array.from(deckDonuts)) {
      expect((d.closest("[data-slide-name]") as HTMLElement).getAttribute("data-slide-name")).toBe("summary");
    }
  });

  it("NO-VIEWBOX-TEXT: no text element inside any chart SVG in the deck scope (v0.6.13.1 re-anchor: the Gantt SVG labels its rows with direct text and is excluded)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const svgs = document.querySelectorAll('[data-testid="presentation"] svg');
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of Array.from(svgs)) {
      if (svg.closest('[data-testid="gantt-chart"]') !== null) continue;
      expect(svg.querySelector("text")).toBeNull();
    }
    const kickers = document.querySelectorAll('[data-testid="presentation"] [data-testid="chart-kicker"]');
    expect(kickers.length).toBeGreaterThan(0);
    for (const k of Array.from(kickers)) {
      expect(k.tagName).toBe("P");
    }
  });

  it("CHART-TRACE: every drawn composition value equals its engine field; the recovery bars equal the bucketed yearly inflows", async () => {
    const demo = shorePowerProgram();
    const result = computeModel(demo);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const cols = document.querySelectorAll('[data-slide-name="recovery"] [data-recovery-column]');
    // v0.6.18 Task H1: the annual basis — one bar per program year (23 here), never bucketed; the labels thin
    // to every ceil(23 / 12) = 2nd bar (twelve visible, eleven thinned), the calendar years via the preset 2026.
    expect(cols.length).toBe(23);
    const years = result.yearly.length;
    expect(years).toBe(23);
    const thinStep = Math.ceil(cols.length / 12);
    expect(thinStep).toBe(2);
    expect(Array.from(cols).filter((c) => (c.querySelector('[data-testid="bar-year-label"]') as HTMLElement)?.getAttribute("data-thinned") !== "true").length).toBe(12);
    for (let k = 0; k < cols.length; k++) {
      const labelEl = cols[k].querySelector('[data-testid="bar-year-label"]') as HTMLElement;
      const expected = yearHeader(k + 1, 2026);
      if (k % thinStep === 0) {
        expect(labelEl.textContent).toBe(expected);
      } else {
        expect(labelEl.textContent).toBe("\u00a0");
        expect(labelEl.getAttribute("data-thinned")).toBe("true");
      }
    }
  });
});

describe("Task C3/C4: ACTION-TITLES / DECLUTTER", () => {
  it("ACTION-TITLES: every deck kicker states a message in words and carries no figures", async () => {
    // v0.6.10 re-anchor: the program fixture's kickers, regenerated from the delivered deck (scratch-verified; figure-free).
    const kickers: string[] = ["Market pillar — bulk & liquid berths dominates the cost base", "Per-lift prices set the yearly recovery"];
    for (const k of kickers) {
      expect(k).toMatch(/[a-z]/);
      expect(k).not.toMatch(/\d/);
    }
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const rendered = Array.from(document.querySelectorAll('[data-testid="presentation"] [data-testid="chart-kicker"]')).map((k) => k.textContent);
    expect(rendered).toContain("Market pillar — bulk & liquid berths dominates the cost base");
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
    // v0.6.18 Task H1: 23 annual bars (one per program year), not 12 bucketed bars.
    expect(barSvgs.length).toBe(23);
    for (const svg of Array.from(barSvgs)) {
      const rect = svg.querySelector("rect");
      expect(rect).toBeTruthy();
      expect(rect?.getAttribute("y")).toBe("0");
      const vb = (svg as SVGElement).getAttribute("viewBox") as string;
      const h = Number(vb.split(" ")[3]);
      expect(h).toBeGreaterThanOrEqual(1);
    }
    // v0.6.15 re-anchor: the ledger bars float on the shared left-baseline scale (the first bar and the
    // total start at zero; no bar leaves the 0 to 100 percent scale).
    const ledgerBars = Array.from(document.querySelectorAll('[data-slide-name="investment"] [data-ledger-bar]')) as HTMLElement[];
    expect(ledgerBars.filter((b) => b.getAttribute("data-ledger-kind") === "capital")).toHaveLength(6);
    expect(parseFloat(ledgerBars[0].style.left)).toBe(0);
    for (const b of ledgerBars) {
      expect(parseFloat(b.style.left)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(b.style.left) + parseFloat(b.style.width)).toBeLessThanOrEqual(100 + 1e-9);
    }
  });
});
