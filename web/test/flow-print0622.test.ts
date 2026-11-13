import { describe, expect, it, vi } from "vitest";
import { deckSlides } from "../src/deck.js";
import { computeModel } from "../src/engine.js";
import { demoProject, shorePowerProgram } from "../src/state.js";
import type { ModelInputs } from "../../core/src/types.js";
import { buildDeckPdf, PDF_CHART_LEFT, PDF_CHART_RIGHT, PDF_THEME_DARK } from "../src/pdf.js";
import type { DeckModel, DeckSlide } from "../src/deck.js";
import type { DeckPdfTrace } from "../src/pdf.js";

// v0.6.22 Task E/F — the flow slide on the print route: the rect-based equivalent drawn from the same
// composed slot, bounded per the W32 geometry contract (every chart rect within 20..277 mm), the
// caption and the bracketed ledger in the trace, the signed shortfall in the print-bad tone on the
// degraded bridge. The jsPDF class is wrapped to record the drawing calls.
const rec = vi.hoisted(() => ({ fills: [] as unknown[][], rects: [] as unknown[][] }));
vi.mock("jspdf", async (orig) => {
  const m = (await orig()) as { jsPDF: new (...a: unknown[]) => Record<string, (...x: unknown[]) => unknown> };
  class Rec extends m.jsPDF {
    constructor(...a: unknown[]) {
      super(...a);
      const fill = this.setFillColor.bind(this);
      const rect = this.rect.bind(this);
      this.setFillColor = (...x: unknown[]) => { rec.fills.push(x); return fill(...x); };
      this.rect = (...x: unknown[]) => { rec.rects.push(x); return rect(...x); };
    }
  }
  return { ...m, jsPDF: Rec };
});

const reset = () => { rec.fills = []; rec.rects = []; };
const onlyFlow = (inputs: ModelInputs): DeckModel => {
  const deck = deckSlides(inputs, computeModel(inputs), { startYear: 2026 });
  const flow = deck.slides.find((s) => s.name === "flow")!;
  return { slides: [flow], currency: deck.currency, unit: deck.unit, provenance: deck.provenance ?? [] };
};

describe("v0.6.22 Task E — the flow slide on the print route", () => {
  it("PROGRAM: the flow slide prints its primary chart (v0.6.22.2: the coverage bridge) from the composed slot, every rect bounded to the chart body", () => {
    reset();
    const model = onlyFlow(shorePowerProgram());
    const doc = buildDeckPdf(model, "Program", undefined, "dark");
    const out = doc.output("datauristring");
    expect(out.length).toBeGreaterThan(1000);
    // W32: every chart rect on the flow page is bounded to 20..277 mm (the page and header bands excluded)
    const chartRects = rec.rects.filter((r) => Number(r[0]) > 0 && Number(r[1]) >= 14);
    expect(chartRects.length).toBeGreaterThanOrEqual(5); // the five program steps (and the page's other chart blocks)
    for (const r of chartRects) {
      expect(Number(r[0])).toBeGreaterThanOrEqual(PDF_CHART_LEFT - 1e-9);
      expect(Number(r[0]) + Number(r[2])).toBeLessThanOrEqual(PDF_CHART_RIGHT + 1e-9);
    }
  });

  it("PROGRAM: the step figures render through the deck formatters in the drawn texts (v0.6.22.2 re-anchor: the step values and detail lines replace the band and connector texts)", () => {
    reset();
    const model = onlyFlow(shorePowerProgram());
    const trace: DeckPdfTrace = { drawnTitles: [], drawnFigures: [] };
    buildDeckPdf(model, "Program", trace, "dark");
    const flat = trace!.drawnFigures.flat();
    expect(trace!.drawnTitles).toContain("Covered on the horizon, 4 short years");
    expect(flat.some((f) => f.includes("Tariff (4 segments) €682 407 745"))).toBe(true);
    expect(flat.some((f) => f.includes("Grant (3 segments) €173 500 000"))).toBe(true);
    expect(flat).toContain("-€142 733 166");
    expect(flat).toContain("Debt service");
    expect(flat.some((f) => f.includes("No reinvestment on this project."))).toBe(true);
    expect(flat.some((f) => f.includes("Cash is fungible"))).toBe(true);
    expect(flat.some((f) => f.includes("4 of 23 years run a shortfall totaling -€307 492 953"))).toBe(true);
  });

  it("LEDGER: the authored pairings print as bracketed ledger lines; TEMPLATE: the shortfall figures print signed", () => {
    const withPairs: ModelInputs = { ...shorePowerProgram(), flow: { pairs: [{ id: "f1", sourceId: "grant:g2", useId: "cost:p4", amount: 50000000 }] } } as ModelInputs;
    const trace: DeckPdfTrace = { drawnTitles: [], drawnFigures: [] };
    buildDeckPdf(onlyFlow(withPairs), "Program", trace, "dark");
    const flat = trace.drawnFigures.flat();
    expect(flat.some((f) => f.includes("National shore-power grant -> Market pillar — bulk & liquid berths: €50 000 000 (allocated €31 250 000)"))).toBe(true);
    const trace2: DeckPdfTrace = { drawnTitles: [], drawnFigures: [] };
    buildDeckPdf(onlyFlow(demoProject()), "Alpha", trace2, "dark");
    const flat2 = trace2.drawnFigures.flat();
    expect(flat2.some((f) => f.includes("-7 374 551 kr"))).toBe(true); // the signed shortfall total prints
    expect(flat2.some((f) => f.includes("3 of 10 years run a shortfall"))).toBe(true);
  });

  it("NEGATIVE REMAINDER ON PAPER: a negative net remainder draws left of the zero line in the print-bad tone, bounded to the chart body (v0.6.22.2 re-anchor of the degraded-bridge pin)", () => {
    reset();
    const flowSlide = deckSlides(demoProject(), computeModel(demoProject()), { startYear: null }).slides.find((s) => s.name === "flow")!;
    const synthetic: DeckSlide = {
      ...flowSlide,
      flow: {
        ...flowSlide.flow!,
        zeroPct: 100 * 60 / 160,
        steps: [
          { id: "in", label: "Collected", kind: "in", raw: 100, value: "100 kr", detail: [], bad: false, startPct: 37.5, spanPct: 62.5, endPct: 100 },
          { id: "out:Capital", label: "Capital", kind: "out", raw: -160, value: "-160 kr", detail: [], bad: false, startPct: 0, spanPct: 100, endPct: 0 },
          { id: "remainder", label: "Remainder to equity", kind: "remainder", raw: -60, value: "-60 kr", detail: [], bad: true, startPct: 0, spanPct: 37.5, endPct: 0 },
        ],
      },
    };
    const model: DeckModel = { slides: [synthetic], currency: "SEK", unit: "ones" };
    buildDeckPdf(model, "Synthetic", undefined, "dark");
    const bad = PDF_THEME_DARK.bad;
    const badFills = rec.fills.filter((f) => Number(f[0]) === bad[0] && Number(f[1]) === bad[1] && Number(f[2]) === bad[2]);
    expect(badFills.length).toBeGreaterThan(0); // the negative remainder step renders in the print-bad tone
    const chartRects = rec.rects.filter((r) => Number(r[0]) > 0 && Number(r[1]) >= 14);
    for (const r of chartRects) {
      expect(Number(r[0])).toBeGreaterThanOrEqual(PDF_CHART_LEFT - 1e-9);
      expect(Number(r[0]) + Number(r[2])).toBeLessThanOrEqual(PDF_CHART_RIGHT + 1e-9);
    }
  });
});
