import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { CHART_COLORS, STAGE_CHART_COLORS, STAGE_GOLD } from "../src/charts.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

// WCAG 2.x relative luminance and contrast ratio, computed on the linear-light channel
// values — the pinned audit figures in this suite are derived from these formulas.
const luminance = (hex: string): number => {
  const h = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => {
    let v = parseInt(h.slice(i, i + 2), 16) / 255;
    v = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return v;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (a: string, b: string): number => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const STAGE_BG = "#081c33";
const PAPER = "#ffffff";

describe("v0.6.9 Task H (finding W30): the stage chart palette clears WCAG AA", () => {
  it("every stage text ink clears AA (4.5:1) against the always-dark stage", () => {
    expect(contrast("#ffffff", STAGE_BG)).toBeCloseTo(17.15, 2);
    expect(contrast("#e2e8f0", STAGE_BG)).toBeCloseTo(13.91, 2);
    expect(contrast(STAGE_GOLD, STAGE_BG)).toBeCloseTo(9.30, 2);
    expect(contrast("#cce9ff", STAGE_BG)).toBeCloseTo(13.61, 2);
    expect(contrast(STAGE_CHART_COLORS.accent, STAGE_BG)).toBeCloseTo(8.01, 2);
    for (const ink of ["#ffffff", "#e2e8f0", STAGE_GOLD, "#cce9ff", STAGE_CHART_COLORS.accent]) {
      expect(contrast(ink, STAGE_BG)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("every stage chart fill clears the graphics threshold (3:1) against the stage", () => {
    expect(contrast(CHART_COLORS.costBar, STAGE_BG)).toBeCloseTo(6.37, 2);
    expect(contrast(CHART_COLORS.inflowBar, STAGE_BG)).toBeCloseTo(8.92, 2);
    expect(contrast(STAGE_CHART_COLORS.accent, STAGE_BG)).toBeCloseTo(8.01, 2);
    for (const fill of [CHART_COLORS.costBar, CHART_COLORS.inflowBar, STAGE_CHART_COLORS.accent]) {
      expect(contrast(fill, STAGE_BG)).toBeGreaterThanOrEqual(3);
    }
  });

  it("the paper palette clears AA against white", () => {
    expect(contrast("#323232", PAPER)).toBeCloseTo(12.82, 2);
    expect(contrast("#92640e", PAPER)).toBeCloseTo(5.18, 2);
    expect(contrast("#323232", PAPER)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#92640e", PAPER)).toBeGreaterThanOrEqual(4.5);
  });

  it("red proof: the old app accent fails on the stage — the reason the stage accent exists", () => {
    expect(contrast("#0074ba", STAGE_BG)).toBeCloseTo(3.44, 2);
    expect(contrast("#0074ba", STAGE_BG)).toBeLessThan(4.5);
    // The kept app-surface references, pinned for the record: the old accent and the
    // muted ink hold on white, but neither holds on the stage background.
    expect(contrast("#0074ba", PAPER)).toBeCloseTo(4.99, 2);
    expect(contrast("#717273", PAPER)).toBeCloseTo(4.82, 2);
  });
});

describe("v0.6.9 Task B/H.4: the recovery chart structure on the recovery slide", () => {
  it("the recovery slide carries the scroll wrapper; the labels are HTML siblings of the bars, and no svg carries text (two ArrowRights on the port demo)", async () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const slide = document.querySelector('[data-slide-name="recovery"]') as HTMLElement;
    expect(slide).not.toBeNull();
    const scroll = slide.querySelector('[data-testid="recovery-scroll"]') as HTMLElement;
    expect(scroll).not.toBeNull();
    const columns = scroll.querySelectorAll("[data-recovery-column]");
    expect(columns.length).toBeGreaterThan(0);
    for (const col of Array.from(columns)) {
      const svg = col.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.querySelectorAll("text").length).toBe(0);
      // The peak and year labels are HTML siblings of the bar svg inside the column.
      expect(col.querySelector('[data-testid="peak-label"]')).not.toBeNull();
      expect(col.querySelector('[data-testid="bar-year-label"]')).not.toBeNull();
    }
  });
});
