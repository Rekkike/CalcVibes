import { describe, expect, it, vi } from "vitest";
import { deckSlides } from "../src/deck.js";
import type { DeckFlow, DeckFlowBand, DeckModel } from "../src/deck.js";
import { computeModel } from "../src/engine.js";
import { demoProject, shorePowerProgram } from "../src/state.js";
import type { ModelInputs } from "../../core/src/types.js";
import { buildDeckPdf, PDF_CHART_LEFT, PDF_CHART_RIGHT, PDF_THEME_DARK, FLOW_PRINT_LABEL_MIN_H, FLOW_PRINT_LABEL_PT, FLOW_PRINT_LINE_H, FLOW_PRINT_PLOT_H } from "../src/pdf.js";
import type { DeckPdfTrace } from "../src/pdf.js";

// v0.6.22.1 Task C — the print-route pins: the same direct-label seating on paper within the W32
// geometry contract (every label text call bounded to 20..277 mm), each label's composed position
// read against its band rect through the same yAt/hAt mapping, the inside/beside admission rule at
// its boundary heights, the bad-tone signed label, no legend block on paper, one page per slide.
// The jsPDF class is wrapped to record the text and rect calls with their ink, size and line count.
const rec = vi.hoisted(() => ({
  texts: [] as { x: number; y: number; text: string; lines: number; opts: Record<string, unknown>; size: number; color: number[] }[],
  rects: [] as { x: number; y: number; w: number; h: number; fill: number[] }[],
  state: { size: 0, color: [0, 0, 0], fill: [0, 0, 0] },
}));
vi.mock("jspdf", async (orig) => {
  const m = (await orig()) as { jsPDF: new (...a: unknown[]) => Record<string, (...x: unknown[]) => unknown> };
  class Rec extends m.jsPDF {
    constructor(...a: unknown[]) {
      super(...a);
      const self = this as unknown as Record<string, (...x: unknown[]) => unknown>;
      const setFontSize = self.setFontSize.bind(this);
      const setTextColor = self.setTextColor.bind(this);
      const setFillColor = self.setFillColor.bind(this);
      const text = self.text.bind(this);
      const rect = self.rect.bind(this);
      self.setFontSize = (...x: unknown[]) => { rec.state.size = Number(x[0]); return setFontSize(...x); };
      self.setTextColor = (...x: unknown[]) => { rec.state.color = x.slice(0, 3).map(Number); return setTextColor(...x); };
      self.setFillColor = (...x: unknown[]) => { rec.state.fill = x.slice(0, 3).map(Number); return setFillColor(...x); };
      self.text = (...x: unknown[]) => {
        const raw = x[0];
        const textStr = Array.isArray(raw) ? (raw as unknown[]).join(" ") : String(raw);
        rec.texts.push({ x: Number(x[1]), y: Number(x[2]), text: textStr, lines: Array.isArray(raw) ? (raw as unknown[]).length : 1, opts: (x[3] ?? {}) as Record<string, unknown>, size: rec.state.size, color: [...rec.state.color] });
        return text(...x);
      };
      self.rect = (...x: unknown[]) => {
        rec.rects.push({ x: Number(x[0]), y: Number(x[1]), w: Number(x[2]), h: Number(x[3]), fill: [...rec.state.fill] });
        return rect(...x);
      };
    }
  }
  return { ...m, jsPDF: Rec };
});

const reset = () => { rec.texts = []; rec.rects = []; };
const norm = (s: string) => s.replace(/\s+/g, "");
const onlyFlow = (inputs: ModelInputs): DeckModel => {
  const deck = deckSlides(inputs, computeModel(inputs), { startYear: 2026 });
  const flow = deck.slides.find((s) => s.name === "flow")!;
  return { slides: [flow], currency: deck.currency, unit: deck.unit, provenance: deck.provenance ?? [] };
};
const band = (key: string, label: string, raw: number, value: string, signed: boolean, topPct: number, heightPct: number): DeckFlowBand =>
  ({ key, label, raw, value, count: 1, signed, topPct, heightPct });
const flowWith = (incomeBands: DeckFlowBand[], useBands: DeckFlowBand[]): DeckFlow => ({
  form: "bands",
  incomeBands,
  useBands,
  connectors: [],
  omittedConnectors: 0,
  scaleRaw: 100,
  caption: "synthetic caption",
  bridge: [],
  ledger: [],
  ledgerOmitted: 0,
  remainderNet: 0,
  remainderNetValue: "0",
  surplusRaw: 0,
  surplusValue: "0",
  shortfallRaw: 0,
  shortfallValue: "0",
  shortfallYears: 0,
  incomeNet: 100,
  incomeNetValue: "100",
  usesTotal: 100,
  usesTotalValue: "100",
});
const syntheticSlide = (flow: DeckFlow): DeckModel => {
  const slide = deckSlides(demoProject(), computeModel(demoProject()), { startYear: null }).slides.find((s) => s.name === "flow")!;
  return { slides: [{ ...slide, flow }], currency: "SEK", unit: "ones" };
};
// the band-label text calls (6 pt) whose normalized text matches a band's composed "label value"
const labelCallOf = (flow: DeckFlow, b: DeckFlowBand) =>
  rec.texts.find((t) => t.size === FLOW_PRINT_LABEL_PT && norm(t.text) === norm(`${b.label} ${b.value}`));
// the band rect for a label call, matched by the exact x-relations of the seating mapping and, among
// the same-side band rects, the one whose segment carries the label's vertical center
const bandRectOf = (t: { x: number; y: number; lines: number; opts: Record<string, unknown> }) => {
  const align = String(t.opts.align ?? "left");
  const blockMid = t.y - 1 + ((t.lines - 1) * FLOW_PRINT_LINE_H) / 2;
  const cands = rec.rects.filter((r) => {
    if (align === "center") return Math.abs(r.x + r.w / 2 - t.x) < 1e-6;
    if (align === "right") return Math.abs(r.x - (t.x + 2)) < 1e-6;
    return Math.abs(r.x + r.w - (t.x - 2)) < 1e-6;
  });
  return cands.sort((a, b) => Math.abs(a.y + a.h / 2 - blockMid) - Math.abs(b.y + b.h / 2 - blockMid))[0];
};

describe("v0.6.22.1 Task C — the print-route label seating within W32", () => {
  it("SEATING-W32: every band label text call is bounded to the chart body 20..277 mm, and every chart rect stays within it", () => {
    reset();
    const model = onlyFlow(shorePowerProgram());
    buildDeckPdf(model, "Program", undefined, "dark");
    const flow = model.slides[0].flow!;
    const bands = [...flow.incomeBands, ...flow.useBands];
    for (const b of bands) {
      const t = labelCallOf(flow, b);
      expect(t).toBeTruthy(); // every band label prints
      const maxW = Number(t!.opts.maxWidth ?? 0);
      const align = String(t!.opts.align ?? "left");
      const left = align === "right" ? t!.x - maxW : align === "center" ? t!.x - maxW / 2 : t!.x;
      const right = align === "right" ? t!.x : align === "center" ? t!.x + maxW / 2 : t!.x + maxW;
      expect(left).toBeGreaterThanOrEqual(PDF_CHART_LEFT - 1e-9);
      expect(right).toBeLessThanOrEqual(PDF_CHART_RIGHT + 1e-9);
    }
    // every chart rect (the page and header bands excluded, as in the v0.6.22 print pins) stays within W32
    for (const r of rec.rects.filter((r) => r.x > 0 && r.y >= 14)) {
      expect(r.x).toBeGreaterThanOrEqual(PDF_CHART_LEFT - 1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(PDF_CHART_RIGHT + 1e-9);
    }
  });

  it("ANCHOR: each label's composed position reads against its band rect through the same mapping (x relation, admission, vertical center)", () => {
    reset();
    const model = onlyFlow(shorePowerProgram());
    buildDeckPdf(model, "Program", undefined, "dark");
    const flow = model.slides[0].flow!;
    for (const side of ["income", "use"] as const) {
      for (const b of side === "income" ? flow.incomeBands : flow.useBands) {
        const t = labelCallOf(flow, b)!;
        expect(t).toBeTruthy();
        const rect = bandRectOf(t);
        expect(rect).toBeTruthy();
        const align = String(t.opts.align ?? "left");
        // the vertical alignment: the first line's baseline sits at the segment mid + 1 minus half the
        // line block; the segment mid comes from the model's pct through the same plot height (the rect
        // height carries the 0.4 mm floor on tiny segments, the mapping does not)
        const hAt = (b.heightPct / 100) * FLOW_PRINT_PLOT_H;
        const expectedFirstY = rect!.y + hAt / 2 + 1 - ((t.lines - 1) * FLOW_PRINT_LINE_H) / 2;
        expect(t.y).toBeCloseTo(expectedFirstY, 6);
        if (align === "center") {
          // inside the band rect, centered on the band; the rendered height admits the 6 pt line
          expect(t.x).toBeCloseTo(rect!.x + rect!.w / 2, 6);
          expect(rect!.h).toBeGreaterThanOrEqual(FLOW_PRINT_LABEL_MIN_H);
        } else if (side === "income") {
          // beside, in the label column directly left of the income band
          expect(align).toBe("right");
          expect(t.x).toBeCloseTo(rect!.x - 2, 6);
          expect(rect!.h).toBeLessThan(FLOW_PRINT_LABEL_MIN_H);
        } else {
          // beside, in the label column directly right of the use band
          expect(align).toBe("left");
          expect(t.x).toBeCloseTo(rect!.x + rect!.w + 2, 6);
          expect(rect!.h).toBeLessThan(FLOW_PRINT_LABEL_MIN_H);
        }
      }
    }
  });

  it("ADMISSION: at the boundary height the label seats inside the band rect, below it in the beside column — one rule for both bands", () => {
    reset();
    const pctIn = (FLOW_PRINT_LABEL_MIN_H / FLOW_PRINT_PLOT_H) * 100 * 1.001;
    const pctOut = (FLOW_PRINT_LABEL_MIN_H / FLOW_PRINT_PLOT_H) * 100 * 0.999;
    const flow = flowWith(
      [band("a", "Alpha source", 50, "50 kr", false, 0, pctIn), band("b", "Beta source", 50, "50 kr", false, pctIn, pctOut)],
      [band("X", "X use", 50, "50 kr", false, 0, pctIn), band("Y", "Y use", 50, "50 kr", false, pctIn, pctOut)],
    );
    buildDeckPdf(syntheticSlide(flow), "Synthetic", undefined, "dark");
    for (const side of ["income", "use"] as const) {
      const bands = side === "income" ? flow.incomeBands : flow.useBands;
      for (const b of bands) {
        const t = labelCallOf(flow, b)!;
        expect(t).toBeTruthy();
        const rect = bandRectOf(t)!;
        expect(rect).toBeTruthy();
        const inside = rect.h >= FLOW_PRINT_LABEL_MIN_H;
        expect(String(t.opts.align ?? "left")).toBe(inside ? "center" : side === "income" ? "right" : "left");
      }
    }
    // the boundary itself, read from the composed rects: the tall segments admit, the short ones do not
    for (const key of ["a", "X"]) {
      const b = [...flow.incomeBands, ...flow.useBands].find((x) => x.key === key)!;
      expect(bandRectOf(labelCallOf(flow, b)!)!.h).toBeGreaterThanOrEqual(FLOW_PRINT_LABEL_MIN_H);
    }
    for (const key of ["b", "Y"]) {
      const b = [...flow.incomeBands, ...flow.useBands].find((x) => x.key === key)!;
      expect(bandRectOf(labelCallOf(flow, b)!)!.h).toBeLessThan(FLOW_PRINT_LABEL_MIN_H);
    }
  });

  it("BAD-TONE: the signed negative equity label prints in the print-bad tone, seated beside its bad band", () => {
    reset();
    const pctOut = (FLOW_PRINT_LABEL_MIN_H / FLOW_PRINT_PLOT_H) * 100 * 0.5;
    const flow = flowWith(
      [band("payments", "Payment stream", 100, "100 kr", false, 0, 100)],
      [band("Capital", "Capital", 160, "160 kr", false, 0, 60), band("Equity remainder", "Equity remainder", -60, "-60 kr", true, 60, pctOut)],
    );
    buildDeckPdf(syntheticSlide(flow), "Synthetic", undefined, "dark");
    const bad = PDF_THEME_DARK.bad;
    const eq = [...flow.useBands].find((b) => b.key === "Equity remainder")!;
    const t = labelCallOf(flow, eq)!;
    expect(t).toBeTruthy();
    expect(t.color).toEqual(bad); // the label ink is the print-bad tone
    expect(norm(t.text)).toBe(norm("Equity remainder -60 kr")); // the signed value in the reading form
    const rect = bandRectOf(t)!;
    expect(rect.fill).toEqual(bad); // the band rect renders in the bad tone as well
    expect(String(t.opts.align)).toBe("left"); // beside, right of the use band
  });

  it("ONE-PAGE + NO-LEGEND: the single flow slide prints on one page and each band label appears exactly once in the drawn figures", () => {
    reset();
    const model = onlyFlow(shorePowerProgram());
    const trace: DeckPdfTrace = { drawnTitles: [], drawnFigures: [] };
    const doc = buildDeckPdf(model, "Program", trace, "dark");
    expect(doc.getNumberOfPages()).toBe(1); // one page per slide on the paper route
    const flat = trace.drawnFigures.flat();
    const flow = model.slides[0].flow!;
    for (const b of [...flow.incomeBands, ...flow.useBands]) {
      const needle = `${b.label} ${b.value}`;
      expect(flat.filter((f) => f === needle).length).toBe(1); // the label prints once — no separate legend block duplicates it
    }
  });
});
