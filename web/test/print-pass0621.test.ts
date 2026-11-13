import { describe, expect, it, vi } from "vitest";
import { deckSlides } from "../src/deck.js";
import { computeModel } from "../src/engine.js";
import { demoProject, shorePowerProgram } from "../src/state.js";
import { buildDeckPdf, chartSlots, PDF_CHART_LEFT, PDF_CHART_RIGHT, PDF_CHART_WIDTH, PDF_CONTENT_LEFT, PDF_CONTENT_RIGHT, PDF_THEME_DARK, PDF_THEME_LIGHT } from "../src/pdf.js";
import type { DeckModel } from "../src/deck.js";

// v0.6.21 Task A — the print pass (W32, W33, W34). The pins: the print-chart geometry contract
// (W32), the theme mapping with the dark stage as the PDF export's default and the light
// paper-and-toner route as the explicit option (W33/W34), and the W30-audited contrast set of
// record recomputed against the stage. The jsPDF class is wrapped to record the drawing calls,
// so both routes are pinned at the call level.
const rec = vi.hoisted(() => ({ fills: [] as unknown[][], rects: [] as unknown[][], textColors: [] as unknown[][], texts: [] as unknown[][] }));
vi.mock("jspdf", async (orig) => {
  const m = (await orig()) as { jsPDF: new (...a: unknown[]) => Record<string, (...x: unknown[]) => unknown> };
  class Rec extends m.jsPDF {
    constructor(...a: unknown[]) {
      super(...a);
      const fill = this.setFillColor.bind(this);
      const rect = this.rect.bind(this);
      const tc = this.setTextColor.bind(this);
      const text = this.text.bind(this);
      this.setFillColor = (...x: unknown[]) => { rec.fills.push(x); return fill(...x); };
      this.rect = (...x: unknown[]) => { rec.rects.push(x); return rect(...x); };
      this.setTextColor = (...x: unknown[]) => { rec.textColors.push(x); return tc(...x); };
      this.text = (...x: unknown[]) => { rec.texts.push(x); return text(...x); };
    }
  }
  return { ...m, jsPDF: Rec };
});

const barsModel = (n: number): DeckModel => ({
  slides: [{ name: "operations", title: "Operations", body: [], disclosures: [], chart: { kind: "bars", data: Array.from({ length: n }, (_, i) => ({ label: `Y${i + 1}`, value: (i % 5) + 1 })) } }],
  currency: "SEK",
  unit: "ones",
});

const coverageModel = (n: number): DeckModel => ({
  slides: [{ name: "coverage", title: "Coverage", body: [], disclosures: [], chart: { kind: "coverage", data: Array.from({ length: n }, (_, i) => ({ label: `Y${i + 1}`, value: i < 5 ? -(5 - i) : i - 4 })) } }],
  currency: "SEK",
  unit: "ones",
});

const reset = () => { rec.fills = []; rec.rects = []; rec.textColors = []; rec.texts = []; };

// WCAG relative luminance and contrast ratio, as the chart-ink battery computes them.
const lum = (hex: string): number => {
  const c = [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255].map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string): number => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

describe("v0.6.21 W32 — the print-chart geometry contract", () => {
  it("the content band is 14..283 mm and every chart body is bounded to 20..277 mm, centered in it", () => {
    expect(PDF_CONTENT_LEFT).toBe(14);
    expect(PDF_CONTENT_RIGHT).toBe(283);
    expect(PDF_CHART_LEFT).toBe(20);
    expect(PDF_CHART_RIGHT).toBe(277);
    expect(PDF_CHART_WIDTH).toBe(257);
    // centered: both bands share the midpoint 148.5 mm
    expect((PDF_CONTENT_LEFT + PDF_CONTENT_RIGHT) / 2).toBe((PDF_CHART_LEFT + PDF_CHART_RIGHT) / 2);
  });

  it("no chart can reach the page edge at any fixture: for every slot count 1..80 the bars stay inside 20..277 and the group is centered", () => {
    for (let n = 1; n <= 80; n++) {
      const g = chartSlots(n);
      const lastEnd = g.x(n - 1) + g.barW;
      expect(g.barW).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        expect(g.x(i)).toBeGreaterThanOrEqual(PDF_CHART_LEFT);
        expect(g.x(i) + g.barW).toBeLessThanOrEqual(PDF_CHART_RIGHT + 1e-9);
      }
      // the group is centered: the margin at each end is the same half-gap
      expect(g.x(0) - PDF_CHART_LEFT).toBeCloseTo(PDF_CHART_RIGHT - lastEnd, 9);
      expect(g.x(0) - PDF_CHART_LEFT).toBeCloseTo(g.gap / 2, 9);
      // the inter-bar gap is proportional (20 percent of the slot)
      expect(g.gap).toBeCloseTo(g.slot * 0.2, 9);
    }
  });

  it("the main-bars path draws inside the contract at a 30-slot fixture (the old unbounded path reached past 283 mm)", () => {
    reset();
    buildDeckPdf(barsModel(30), "geom");
    const barRects = rec.rects.filter((r) => (r[0] as number) >= PDF_CHART_LEFT && (r[0] as number) <= PDF_CHART_RIGHT && typeof r[3] === "number" && (r[3] as number) > 1 && (r[3] as number) <= 40 && (r[2] as number) > 0.5);
    expect(barRects.length).toBe(30);
    for (const r of barRects) {
      const x = r[0] as number;
      const w = r[2] as number;
      expect(x).toBeGreaterThanOrEqual(PDF_CHART_LEFT);
      expect(x + w).toBeLessThanOrEqual(PDF_CHART_RIGHT + 1e-9);
    }
    const g = chartSlots(30);
    expect(Math.min(...barRects.map((r) => r[0] as number))).toBeCloseTo(g.x(0), 6);
    expect(Math.max(...barRects.map((r) => (r[0] as number) + (r[2] as number)))).toBeCloseTo(g.x(29) + g.barW, 6);
  });

  it("the recovery (coverage) axis labels compose thinned like the deck's model: a 30-year span draws every ceil(30/12)=3rd label", () => {
    reset();
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(coverageModel(30), "cov", trace);
    const labels = trace.drawnFigures[0].filter((f) => /^Y\d+$/.test(f));
    expect(labels).toEqual(["Y1", "Y4", "Y7", "Y10", "Y13", "Y16", "Y19", "Y22", "Y25", "Y28"]);
    // a short span (8 years) draws every label
    const trace2 = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(coverageModel(8), "cov8", trace2);
    expect(trace2.drawnFigures[0].filter((f) => /^Y\d+$/.test(f)).length).toBe(8);
  });
});

describe("v0.6.21 W33/W34 — the theme mapping, dark default, light paper-and-toner option", () => {
  const model = (): DeckModel => deckSlides(shorePowerProgram(), computeModel(shorePowerProgram()), { startYear: 2026, entryUnit: "thousands" });

  it("W34: the PDF export's DEFAULT is the dark stage — the #081c33 page, the stage header band, the stage chart colors", () => {
    reset();
    buildDeckPdf(model(), "Project"); // no theme argument
    const pageFill = rec.rects.find((r) => r[0] === 0 && r[1] === 0 && r[2] === 297 && r[3] === 210);
    expect(pageFill).toBeTruthy();
    const pageIdx = rec.rects.indexOf(pageFill as unknown[]);
    expect(rec.fills[pageIdx]).toEqual([8, 28, 51]); // #081c33
    // the header band on the dark route
    const band = rec.rects.find((r) => r[0] === 0 && r[1] === 0 && r[2] === 297 && r[3] === 14);
    expect(rec.fills[rec.rects.indexOf(band as unknown[])]).toEqual([21, 36, 56]);
    // the stage chart colors are drawn (the recovery bars: #34d399 inflow / #fb7185 cost)
    expect(rec.fills.some((f) => f[0] === 52 && f[1] === 211 && f[2] === 153)).toBe(true);
    expect(rec.fills.some((f) => f[0] === 251 && f[1] === 113 && f[2] === 133)).toBe(true);
    // the crossing gold #e8b84b
    expect(rec.fills.some((f) => f[0] === 232 && f[1] === 184 && f[2] === 75) || rec.textColors.some((f) => f[0] === 232 && f[1] === 184 && f[2] === 75)).toBe(true);
  });

  it("W33: the light route is the explicit paper-and-toner option — the PRINT_* vocabulary of record, white page", () => {
    reset();
    buildDeckPdf(model(), "Project", undefined, "light");
    const pageFill = rec.rects.find((r) => r[0] === 0 && r[1] === 0 && r[2] === 297 && r[3] === 210);
    expect(rec.fills[rec.rects.indexOf(pageFill as unknown[])]).toEqual([255, 255, 255]);
    const band = rec.rects.find((r) => r[0] === 0 && r[1] === 0 && r[2] === 297 && r[3] === 14);
    expect(rec.fills[rec.rects.indexOf(band as unknown[])]).toEqual([16, 53, 88]); // the print navy band
    // the print inks: PRINT_OK #047857 bars, PRINT_MUT captions
    expect(rec.fills.some((f) => f[0] === 4 && f[1] === 120 && f[2] === 87)).toBe(true);
    expect(rec.textColors.some((f) => f[0] === 50 && f[1] === 50 && f[2] === 50)).toBe(true);
    // the dark stage never appears on the light route
    expect(rec.fills.some((f) => f[0] === 8 && f[1] === 28 && f[2] === 51)).toBe(false);
  });

  it("both routes build the full deck (page count identical, titles traced identically)", () => {
    const traceD = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    const docD = buildDeckPdf(model(), "Project", traceD);
    const traceL = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    const docL = buildDeckPdf(model(), "Project", traceL, "light");
    expect(docD.getNumberOfPages()).toBe(docL.getNumberOfPages());
    expect(traceD.drawnTitles).toEqual(traceL.drawnTitles);
    expect(traceD.drawnTitles.length).toBeGreaterThan(5);
  });

  it("the W30-audited contrast set of record, recomputed against the stage #081c33", () => {
    const stage = "#081c33";
    expect(ratio("#ffffff", stage).toFixed(2)).toBe("17.15"); // the peak label
    expect(ratio("#e2e8f0", stage).toFixed(2)).toBe("13.91"); // the axis labels
    expect(ratio("#cce9ff", stage).toFixed(2)).toBe("13.61"); // the caption
    expect(ratio("#e8b84b", stage).toFixed(2)).toBe("9.30"); // the crossing gold
    expect(ratio("#fb7185", stage).toFixed(2)).toBe("6.37"); // the stage cost bars
    expect(ratio("#34d399", stage).toFixed(2)).toBe("8.92"); // the stage inflow bars
    // the palette tables carry exactly these inks
    expect(PDF_THEME_DARK.page).toEqual([8, 28, 51]);
    expect(PDF_THEME_DARK.peak).toEqual([255, 255, 255]);
    expect(PDF_THEME_DARK.mut).toEqual([226, 232, 240]);
    expect(PDF_THEME_DARK.caption).toEqual([204, 233, 255]);
    expect(PDF_THEME_DARK.gold).toEqual([232, 184, 75]);
    expect(PDF_THEME_DARK.barNeg).toEqual([251, 113, 133]);
    expect(PDF_THEME_DARK.barPos).toEqual([52, 211, 153]);
    expect(PDF_THEME_LIGHT.page).toEqual([255, 255, 255]);
  });

  it("the demo deck builds on both routes without error and the light route keeps the W16 honest-presentation contract (no stage color on paper)", () => {
    reset();
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    const doc = buildDeckPdf(deckSlides(demoProject(), computeModel(demoProject()), { startYear: null }), "Alpha", trace, "light");
    expect(doc.getNumberOfPages()).toBe(8); // v0.6.22 re-anchor: the flow slide prints a page
    expect(trace.drawnTitles[0]).toBe("Project Alpha");
    const stageInk = (f: unknown[]) => f[0] === 8 && f[1] === 28 && f[2] === 51;
    expect(rec.fills.some(stageInk)).toBe(false);
    expect(rec.textColors.some(stageInk)).toBe(false);
  });
});
