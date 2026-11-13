import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
// the web workspace is typed without Node declarations here; the test runner is Node
// @ts-ignore
import { readFileSync } from "node:fs";
import { App } from "../src/App.js";
import { FlowCoverage, FLOW_COVERAGE_GEO, wholeFigure } from "../src/charts.js";
import { composeFlowSlide, deckSlides, flowDetailText, FLOW_COVERAGE_ORDER } from "../src/deck.js";
import type { DeckFlow, DeckModel } from "../src/deck.js";
import { computeModel } from "../src/engine.js";
import { buildDeckPdf, PDF_CHART_LEFT, PDF_CHART_RIGHT } from "../src/pdf.js";
import { composeFlow, demoProject, landNewbuildProject, shorePowerProgram, solarParkProject } from "../src/state.js";
import type { ModelInputs } from "../../core/src/types.js";

// v0.6.22.2 — the flow figure's primary form: the COVERAGE BRIDGE in the row form of the waterfall. The design
// pins: the reading order (one row per step, top to bottom: the collections in, the uses out in the coverage order
// of record, the signed remainder closing the chain); the closure (each use spans from the running level the
// previous row leaves to the level it leaves, the remainder lands on the last level); one zero-based horizontal
// axis shared by every row (a negative remainder left of the zero line, never clipped); no ribbons and no bands;
// SVG marks with HTML text (no text inside the chart SVG); direct labels, no legend; the honest asymmetry (the
// shortfall years named under the remainder in the bad tone; the outs in a neutral ink, never the bad tone); the
// authored pairings' invariance and disclosure; the omitted steps named; the print route within W32 on one page.
const rec = vi.hoisted(() => ({ texts: [] as { text: string; x: number; opts: { align?: string; maxWidth?: number } | undefined }[] }));
vi.mock("jspdf", async (orig) => {
  const m = (await orig()) as { jsPDF: new (...a: unknown[]) => Record<string, (...x: unknown[]) => unknown> };
  class Rec extends m.jsPDF {
    constructor(...a: unknown[]) {
      super(...a);
      const text = this.text.bind(this);
      this.save = () => undefined;
      this.text = (...x: unknown[]) => {
        const t = x[0];
        for (const line of Array.isArray(t) ? t : [t]) rec.texts.push({ text: String(line), x: Number(x[1]), opts: x[3] as { align?: string; maxWidth?: number } | undefined });
        return text(...x);
      };
    }
  }
  return { ...m, jsPDF: Rec };
});

const DEMOS: [string, () => ModelInputs][] = [["template", demoProject], ["solar", solarParkProject], ["land", landNewbuildProject], ["program", shorePowerProgram]];
const flowOf = (inp: ModelInputs): DeckFlow => deckSlides(inp, computeModel(inp), { startYear: null }).slides.find((s) => s.name === "flow")!.flow!;
const css = readFileSync("src/index.css", "utf8") as string;

// a synthetic horizon shortfall: the uses exceed the collections, so the chain crosses zero
const shortfallFlow = (): DeckFlow => composeFlowSlide({
  sources: [{ key: "payments:p", label: "P", kind: "payments", total: 100, gross: 100 }],
  uses: [{ key: "operating:o1", label: "O1", kind: "operating", total: 40, gross: 40 }, { key: "cost:c1", label: "C1", kind: "cost", total: 120, gross: 120 }, { key: "equity:remainder", label: "Equity remainder", kind: "equity", total: 0, gross: 0 }],
  useOrder: ["operating:o1", "cost:c1"], years: [], connectors: [],
  remainderNet: -60, remainderSurplus: 10, remainderShortfall: -70, shortfallYears: 2, pairings: [], refusals: [],
}, (v) => `${Math.round(v)} kr`);

describe("v0.6.22.2 — the composed coverage bridge", () => {
  it("ORDER: the collections in first, the uses out in the coverage order of record, the signed remainder last", () => {
    for (const [, make] of DEMOS) {
      const f = flowOf(make());
      expect(f.steps[0].kind).toBe("in");
      expect(f.steps[f.steps.length - 1].kind).toBe("remainder");
      const outs = f.steps.filter((s) => s.kind === "out").map((s) => s.label);
      expect(outs).toEqual(FLOW_COVERAGE_ORDER.filter((b) => outs.includes(b)));
      expect([...outs, ...f.omittedSteps].sort()).toEqual([...FLOW_COVERAGE_ORDER].sort());
    }
  });

  it("CLOSURE: each use spans from the level the previous row leaves to the level it leaves; the remainder lands on the last level; the figures close", () => {
    for (const [, make] of DEMOS) {
      const f = flowOf(make());
      for (let i = 1; i < f.steps.length - 1; i++) {
        const s = f.steps[i];
        expect(s.startPct + s.spanPct).toBeCloseTo(f.steps[i - 1].endPct, 9); // the out bar's right end is the incoming level
        expect(s.startPct).toBeCloseTo(s.endPct, 9); // and it leaves at its left end
      }
      const last = f.steps[f.steps.length - 1];
      expect(last.endPct).toBeCloseTo(f.steps[f.steps.length - 2].endPct, 9); // the chain closes on the remainder
      expect(f.steps.reduce((a, s) => a + (s.kind === "remainder" ? 0 : s.raw), 0)).toBeCloseTo(last.raw, 4);
    }
  });

  it("ZERO-BASED: the demos start at the zero line; a horizon shortfall reaches left of it, in the bad tone, never clipped", () => {
    for (const [, make] of DEMOS) expect(flowOf(make()).zeroPct).toBe(0);
    const f = shortfallFlow();
    expect(f.zeroPct).toBeCloseTo((60 / 160) * 100, 9);
    const rem = f.steps[f.steps.length - 1];
    expect(rem.bad).toBe(true);
    expect(rem.startPct).toBeCloseTo(0, 9);
    expect(rem.startPct + rem.spanPct).toBeCloseTo(f.zeroPct, 9);
    expect(Math.min(...f.steps.map((s) => s.startPct))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...f.steps.map((s) => s.startPct + s.spanPct))).toBeLessThanOrEqual(100 + 1e-9);
  });

  it("HONEST ASYMMETRY: the shortfall years ride under the remainder in the bad tone, the figure the body's own; the outs are never the bad tone", () => {
    for (const [, make] of DEMOS) {
      const inp = make();
      const sl = deckSlides(inp, computeModel(inp), { startYear: null }).slides.find((s) => s.name === "flow")!;
      const rem = sl.flow!.steps[sl.flow!.steps.length - 1];
      const shortLine = rem.detail.find((d) => d.bad)!;
      expect(shortLine.value).toBe(sl.body.find((b) => b.label === "Shortfall years' total")!.value);
      expect(shortLine.label).toBe(`${sl.flow!.shortfallYears} shortfall years`);
      for (const s of sl.flow!.steps.filter((x) => x.kind === "out")) expect(s.bad).toBe(false);
    }
  });

  it("PAIRINGS: an authored pairing changes which source covers which use, never the bridge — the steps are identical; the change is disclosed", () => {
    const base = shorePowerProgram();
    const paired = { ...base, flow: { pairs: [{ id: "f1", sourceId: "grant:g2", useId: "cost:p4", amount: 50000000 }] } } as ModelInputs;
    expect(JSON.stringify(flowOf(paired).steps)).toBe(JSON.stringify(flowOf(base).steps));
    expect(flowOf(paired).caption).toContain("The authored pairing changes which source covers which use, never these totals.");
    const sl = deckSlides(paired, computeModel(paired), { startYear: null }).slides.find((s) => s.name === "flow")!;
    expect(sl.disclosures.some((d) => d.endsWith("never the bridge's totals."))).toBe(true);
    expect(sl.flow!.ledger.length).toBe(1);
  });

  it("OMITTED: a use bucket with no flow is never drawn as a zero step and is named in the caption", () => {
    const f = flowOf(demoProject());
    expect(f.steps.map((s) => s.id)).toEqual(["in", "out:Capital", "remainder"]);
    expect(f.caption).toContain("No debt service, operating or reinvestment on this project.");
  });
});

describe("v0.6.22.2 — the renderer (DOM and CSS)", () => {
  const draw = (f: DeckFlow) => render(<FlowCoverage flow={f} />).container;

  it("ORDER ON SCREEN: one row per step, top to bottom in the composed order; no bands, no ribbons", () => {
    const f = flowOf(shorePowerProgram());
    const c = draw(f);
    expect(Array.from(c.querySelectorAll("[data-flow-row]")).map((r) => r.getAttribute("data-flow-row"))).toEqual(f.steps.map((s) => s.id));
    expect(c.querySelector('[data-testid="flow-bands"]')).toBeNull();
    expect(c.querySelectorAll("path")).toHaveLength(0);
  });

  it("GEOMETRY: each bar draws its composed percents on the shared axis; the connector stubs carry each running level into the next row; the zero line runs through every row", () => {
    const f = flowOf(shorePowerProgram());
    const c = draw(f);
    const pctOf = (el: Element, a: string) => parseFloat(el.getAttribute(a) as string);
    f.steps.forEach((s, i) => {
      const row = c.querySelector(`[data-flow-row="${s.id}"]`)!;
      const svg = row.querySelector("svg")!;
      expect(svg.getAttribute("viewBox")).toBe("0 0 100 100"); // the axis is the viewBox's 0..100, shared by every row
      const r = row.querySelector(`line[data-flow-step="${s.id}"]`)!;
      expect(pctOf(r, "x1")).toBeCloseTo(s.startPct, 9);
      expect(pctOf(r, "x2")).toBeCloseTo(s.startPct + s.spanPct, 9);
      expect(r.getAttribute("stroke-width")).toBe(String(FLOW_COVERAGE_GEO.barH));
      expect(r.getAttribute("vector-effect")).toBe("non-scaling-stroke");
      expect(pctOf(row.querySelector('[data-flow-zero="true"]')!, "x1")).toBeCloseTo(f.zeroPct, 9);
      const out = row.querySelector(`[data-flow-connector="${s.id}"]`);
      const inn = row.querySelector(`[data-flow-connector-in="${s.id}"]`);
      if (i < f.steps.length - 1) {
        expect(pctOf(out!, "x1")).toBeCloseTo(s.endPct, 9);
        expect(pctOf(out!, "x2")).toBeCloseTo(s.endPct, 9);
      } else expect(out).toBeNull();
      if (i > 0) expect(pctOf(inn!, "x1")).toBeCloseTo(f.steps[i - 1].endPct, 9);
      else expect(inn).toBeNull();
    });
  });

  it("DIRECT LABELS: every row carries its name, its value and its detail lines beside its bar; no text inside the SVG; no legend; the figures kept whole", () => {
    const f = flowOf(shorePowerProgram());
    const c = draw(f);
    expect(c.querySelectorAll("svg text")).toHaveLength(0);
    expect(c.querySelector(".legend, [data-legend], .flow-legend")).toBeNull();
    for (const s of f.steps) {
      const name = c.querySelector(`[data-flow-name="${s.id}"]`)!;
      expect(name.querySelector(".flow-coverage-label")!.textContent).toBe(s.label);
      expect(name.querySelector(`[data-flow-value="${s.id}"]`)!.textContent).toBe(wholeFigure(s.value));
      expect(Array.from(name.querySelectorAll("[data-flow-detail]")).map((d) => d.textContent)).toEqual(s.detail.map((d) => (d.value === "" ? d.label : `${d.label} ${wholeFigure(d.value)}`)));
    }
    expect(wholeFigure("-€307 492 953")).toBe("-\u2060€307\u00a0492\u00a0953"); // whole: the separators and the minus never break
  });

  it("BAD TONE: the shortfall line under the remainder carries the bad tone; a negative remainder draws in the bad tone left of the zero line", () => {
    const c = draw(flowOf(shorePowerProgram()));
    const bad = Array.from(c.querySelectorAll('[data-flow-detail="remainder"]')).filter((d) => d.getAttribute("data-flow-detail-bad") === "true");
    expect(bad).toHaveLength(1);
    expect(bad[0].className).toContain("tone-bad");
    const f = shortfallFlow();
    const neg = draw(f);
    const rect = neg.querySelector('line[data-flow-step="remainder"]')!;
    expect(rect.getAttribute("class")).toContain("flow-coverage-bad");
    expect(parseFloat(rect.getAttribute("x1") as string)).toBeLessThan(f.zeroPct); // left of the zero line
    const val = neg.querySelector('[data-flow-value="remainder"]') as HTMLElement;
    expect(val.className).toContain("tone-bad");
  });

  it("CSS: the outs read in a neutral ink (never the bad tone), the bad tone is reserved for a shortfall; the labels wrap within their slots (no silent overflow)", () => {
    expect(css).toContain(".flow-coverage .flow-coverage-out { stroke: #94a3b8; }");
    expect(css).toContain(".flow-coverage .flow-coverage-bad { stroke: #e11d48; }");
    expect(css).toMatch(/\.flow-coverage \.flow-coverage-text \{[^}]*overflow-wrap: anywhere;/);
    expect(css).toMatch(/\.flow-coverage \.flow-coverage-value \{[^}]*overflow-wrap: anywhere;/);
    expect(css).toMatch(/\.flow-coverage \.flow-coverage-detail \{[^}]*overflow-wrap: anywhere;/);
    expect(css).not.toMatch(/\.flow-coverage[^{]*\{[^}]*(text-overflow: ellipsis|white-space: nowrap)/);
  });

  it("SURFACES: the deck slide and the Plan flow surface render the same bridge; the surface names the pairings' effect and the drill reads From and To", () => {
    render(<App />);
    fireEvent.click(document.querySelector('[data-action="load-demo"]') as HTMLElement);
    fireEvent.click(document.querySelector('[data-nav="flow"]') as HTMLElement);
    const surface = document.querySelector('[data-testid="flow-surface"]') as HTMLElement;
    expect(surface.querySelectorAll("line[data-flow-step]")).toHaveLength(5);
    expect(Array.from(surface.querySelectorAll("[data-flow-row]")).map((r) => r.getAttribute("data-flow-row"))).toEqual(["in", "out:Debt service", "out:Operating", "out:Capital", "remainder"]);
    expect(surface.querySelector('[data-testid="flow-pairing-effect"]')!.textContent).toContain("never the coverage bridge");
    const drillNames = Array.from(surface.querySelectorAll('[data-flow-drill-row] td:first-child')).map((t) => t.textContent ?? "");
    expect(drillNames).toContain("From Tariff");
    expect(drillNames).toContain("To Debt service");
    fireEvent.click(document.querySelector('[data-action="present"]') as HTMLElement);
    const slide = document.querySelector('[data-slide-name="flow"]') as HTMLElement;
    expect(Array.from(slide.querySelectorAll("line[data-flow-step]")).map((r) => r.getAttribute("data-flow-step"))).toEqual(["in", "out:Debt service", "out:Operating", "out:Capital", "remainder"]);
  });
});

describe("v0.6.22.2 — the print route", () => {
  const onlyFlow = (inp: ModelInputs): DeckModel => {
    const d = deckSlides(inp, computeModel(inp), { startYear: null });
    return { ...d, slides: d.slides.filter((s) => s.name === "flow") };
  };
  it("W32 + ONE PAGE: every flow text call stays inside the chart body; the rows read top to bottom; the flow slide prints on one page on every demo and theme", () => {
    for (const [, make] of DEMOS) {
      for (const theme of ["dark", "light"] as const) {
        const model = onlyFlow(make());
        const f = model.slides[0].flow!;
        rec.texts = [];
        const doc = buildDeckPdf(model, "Flow", undefined, theme);
        expect(doc.getNumberOfPages()).toBe(1);
        const stepTexts = new Set(f.steps.flatMap((s) => [s.value, s.label, ...s.detail.map(flowDetailText)]));
        const calls = rec.texts.filter((t) => stepTexts.has(t.text));
        expect(calls.length).toBeGreaterThanOrEqual(f.steps.length * 3);
        for (const t of calls) {
          const w = t.opts?.maxWidth ?? 0;
          expect(w).toBeGreaterThan(0);
          if (t.opts?.align === "right") {
            expect(t.x).toBeLessThanOrEqual(PDF_CHART_RIGHT + 1e-9);
            expect(t.x - w).toBeGreaterThanOrEqual(PDF_CHART_LEFT - 1e-9);
          } else {
            expect(t.opts?.align).toBe("left");
            expect(t.x).toBeGreaterThanOrEqual(PDF_CHART_LEFT - 1e-9);
            expect(t.x + w).toBeLessThanOrEqual(PDF_CHART_RIGHT + 1e-9);
          }
        }
        // the step names print in the composed order, top to bottom
        const order = rec.texts.filter((t) => f.steps.some((s) => s.label === t.text)).map((t) => t.text);
        expect(order).toEqual(f.steps.map((s) => s.label));
      }
    }
  });
  it("ENGINE-BLIND: the composed flow is consumed, never recomputed — the slide's figures and geometry equal composeFlowSlide over composeFlow", () => {
    const shape = (f: DeckFlow) => f.steps.map((s) => [s.id, s.kind, s.raw, s.bad, s.startPct, s.spanPct, s.endPct]);
    for (const [, make] of DEMOS) {
      const inp = make();
      expect(shape(flowOf(inp))).toEqual(shape(composeFlowSlide(composeFlow(inp, computeModel(inp)), (v) => String(v))));
    }
  });
});
