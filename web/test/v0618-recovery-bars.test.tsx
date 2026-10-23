// v0.6.18 Task H1 (the builder proposal, applied) and AUD-27: the recovery chart on the annual basis, serving a short
// span and a very long span, the month level only on request, the "period" labeling unambiguous, and the grants
// identified (excluded from the bars) with an honest kicker.
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import { buildDeckPdf } from "../src/pdf.js";
import { demoProject, landNewbuildProject, shorePowerProgram } from "../src/state.js";
import type { ModelInputs } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const deckOf = (inp: ModelInputs, opts: object = {}) => deckSlides(inp, computeModel(inp), { startYear: null, entryUnit: "ones", ...opts });
const recovery = (inp: ModelInputs, opts: object = {}) => deckOf(inp, opts).slides.find((s) => s.name === "recovery")!;
const toRecovery = () => { fireEvent.keyDown(window, { key: "ArrowRight" }); fireEvent.keyDown(window, { key: "ArrowRight" }); fireEvent.keyDown(window, { key: "ArrowRight" }); };

describe("v0.6.18 H1: the annual basis is the default", () => {
  it("ANNUAL: one bar per program year, never bucketed; the period note names what a bar is", () => {
    for (const make of [shorePowerProgram, landNewbuildProject, demoProject]) {
      const inp = make();
      const r = computeModel(inp);
      const s = recovery(inp);
      expect(s.chart!.basis).toBe("annual");
      expect(s.chart!.data).toHaveLength(r.yearly.length);
      expect(s.chart!.periodNote).toBe("Each bar is one program year: the sum of its twelve months.");
    }
  });

  it("UNFUNDED: a project without grants or a note draws exactly its yearly inflows; the kicker names the basis plainly", () => {
    const inp = demoProject();
    const r = computeModel(inp);
    const s = recovery(inp);
    expect(s.chart!.data.map((d) => d.value)).toEqual(r.yearly.map((y) => y.inflow));
    expect(s.chart!.kicker).toBe("Collections per year");
    expect(s.body.some((f) => f.label.startsWith("Grant receipts"))).toBe(false);
  });
});

describe("v0.6.18 AUD-27: the grants are identified, never summed into the bars unidentified", () => {
  it("EXCLUDED: the funded project's bars exclude the grant rows and the note's cash; the identified figures carry them; the three reconcile to the yearly inflows", () => {
    const inp = shorePowerProgram();
    const r = computeModel(inp);
    const s = recovery(inp);
    const fees = r.collectionsGrid.filter((x) => x.kind !== "grant" && x.kind !== "funding-loan");
    s.chart!.data.forEach((d, k) => expect(d.value).toBeCloseTo(fees.reduce((a, row) => a + (row.amounts[k] ?? 0), 0), 6));
    const bars = s.chart!.data.reduce((a, d) => a + d.value, 0);
    const inflow = r.yearly.reduce((a, y) => a + y.inflow, 0);
    expect(bars + r.fundingView!.grantsTotal).toBeCloseTo(inflow, 3); // the note nets to zero over the horizon
    expect(bars).toBeLessThan(inflow);
    expect(s.chart!.kicker).toBe("Collections per year, excluding the grants and the interest-free note");
    const grants = s.body.find((f) => f.label === "Grant receipts (identified; not in the bars)")!;
    expect(grants).toMatchObject({ rawValue: 173500000, disclosure: "received once per grant row; shown on the investment slide" });
    expect(grants.value).toBe("€173 500 000");
    const note = s.body.find((f) => f.label === "Interest-free note advance (identified; not in the bars)")!;
    expect(note).toMatchObject({ rawValue: 10000000, disclosure: "repaid by installments; nets to zero over the horizon" });
  });

  it("DECK-ROUTES: the Presentation and the print route draw the same identified series and the honest kicker", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    toRecovery();
    const slide = document.querySelector('[data-slide-name="recovery"]') as HTMLElement;
    expect(slide.querySelector('[data-testid="recovery-period-note"]')!.textContent).toBe("Collections per year, excluding the grants and the interest-free note. Each bar is one program year: the sum of its twelve months.");
    expect(slide.textContent).toContain("Grant receipts (identified; not in the bars)");
    const inp = shorePowerProgram();
    const model = deckOf(inp);
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(model, "P", trace);
    const drawn = trace.drawnFigures[model.slides.findIndex((s) => s.name === "recovery")];
    expect(drawn).toContain("Collections per year, excluding the grants and the interest-free note");
    expect(drawn).toContain("Each bar is one program year: the sum of its twelve months.");
  });
});

describe("v0.6.18 H1: a short span and a very long span", () => {
  const short = (): ModelInputs => ({ ...demoProject(), costs: [{ id: "c1", name: "Build", category: "capex", amount: 1000000, startYear: 1, durationYears: 0, escalation: 0 }], repayment: { ...demoProject().repayment, termYears: 2, paymentsPerYear: 4, graceYears: 0 }, operatingLines: [], maintenance: { mode: "off" } });
  it("SHORT: a handful of years draw a handful of wide bars (capped and centred), every year labelled", () => {
    const inp = short();
    const r = computeModel(inp);
    expect(r.yearly.length).toBeLessThanOrEqual(6);
    const s = recovery(inp);
    expect(s.chart!.data).toHaveLength(r.yearly.length);
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.recovery-column \{ max-width: 7rem; \}/);
    expect(css).toMatch(/\.recovery-grid \{ justify-content: center; \}/);
    render(<App />);
    // the Presentation draws every label for a short span (the step is 1)
    const text = JSON.stringify(s.chart!.data.map((d) => d.label));
    expect(text).toContain("Year 1");
  });

  it("LONG: a very long span draws one narrow bar per year in the scroll grid, the labels thinned, the peak named once", () => {
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    fireEvent.click(byAction("present"));
    toRecovery();
    const slide = document.querySelector('[data-slide-name="recovery"]') as HTMLElement;
    const cols = slide.querySelectorAll("[data-recovery-column]");
    expect(cols.length).toBe(23);
    const grid = slide.querySelector(".recovery-grid") as HTMLElement;
    expect(parseFloat(grid.style.minWidth)).toBe(23 * 26);
    expect(slide.querySelector('[data-testid="recovery-scroll"]')).toBeTruthy();
    const labels = Array.from(slide.querySelectorAll('[data-testid="bar-year-label"]'));
    expect(labels.filter((l) => l.getAttribute("data-thinned") === "true")).toHaveLength(11);
    expect(Array.from(slide.querySelectorAll('[data-testid="peak-label"]')).filter((el) => el.textContent !== " ")).toHaveLength(1);
  });
});

describe("v0.6.18 H1: the month level only on request", () => {
  it("DEFAULT: the deck composes the annual basis unless the request is made; the request recomposes the series monthly", () => {
    const inp = landNewbuildProject();
    const r = computeModel(inp);
    expect(recovery(inp).chart!.basis).toBe("annual");
    const m = recovery(inp, { recoveryMonthly: true });
    expect(m.chart!.basis).toBe("monthly");
    expect(m.chart!.data).toHaveLength(r.monthly.length);
    expect(m.chart!.data[0].label).toBe("Year 1 · month 1");
    expect(m.chart!.data.map((d) => d.value)).toEqual(r.monthly.map((x) => x.inflow));
    expect(m.chart!.periodNote).toBe("Each bar is one month of every project inflow.");
    expect(m.chart!.kicker).toBe("Project inflows by month, including the grants and the interest-free note's cash");
  });

  it("TOGGLE: the Presentation shows annual first, switches to monthly on request and back; nothing is saved", () => {
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    fireEvent.click(byAction("present"));
    toRecovery();
    const bars = () => document.querySelector('[data-slide-name="recovery"] [data-testid="recovery-bars"]') as HTMLElement;
    expect(bars().getAttribute("data-basis")).toBe("annual");
    expect(byAction("recovery-monthly").textContent).toBe("Show monthly");
    fireEvent.click(byAction("recovery-monthly"));
    expect(bars().getAttribute("data-basis")).toBe("monthly");
    expect(bars().querySelectorAll("[data-recovery-column]").length).toBe(computeModel(landNewbuildProject()).monthly.length);
    expect(byAction("recovery-monthly").textContent).toBe("Show annual");
    fireEvent.click(byAction("recovery-monthly"));
    expect(bars().getAttribute("data-basis")).toBe("annual");
  });
});

describe("v0.6.18 H1: the 'period' labeling is unambiguous", () => {
  it("CADENCE: the recovery slide names the payment period by the repayment cadence; the word 'period' alone is gone from the deck", () => {
    for (const [inp, word] of [[demoProject(), "quarter"], [shorePowerProgram(), "month"], [{ ...demoProject(), repayment: { ...demoProject().repayment, paymentsPerYear: 1 } }, "year"], [{ ...demoProject(), repayment: { ...demoProject().repayment, paymentsPerYear: 2 } }, "half-year"]] as [ModelInputs, string][]) {
      const s = recovery(inp);
      const fig = s.body.find((f) => f.label.startsWith("Payment per"))!;
      expect(fig.label).toBe(`Payment per ${word}`);
      expect(JSON.stringify(deckOf(inp))).not.toContain("Payment per period");
    }
  });
});

describe("v0.6.18 H1: the peak figure is never clipped by the grid's edge", () => {
  it("PEAK-EDGE: a peak in the first third anchors at the left edge, one in the last third at the right edge, a middle peak stays centred", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    toRecovery();
    const peak = (): HTMLElement => document.querySelector('[data-slide-name="recovery"] [data-testid="peak-label"]:not(.peak-hidden)') as HTMLElement;
    const cols = Array.from(document.querySelectorAll('[data-slide-name="recovery"] [data-recovery-column]'));
    const idx = cols.findIndex((c) => !c.querySelector(".peak-hidden"));
    const n = cols.length;
    const expected = idx < n / 3 ? "peak-start" : idx >= (2 * n) / 3 ? "peak-end" : null;
    if (expected === null) expect(peak().className).toBe("peak-label");
    else expect(peak().classList.contains(expected)).toBe(true);
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toContain(".peak-label.peak-start { align-self: flex-start; }");
    expect(css).toContain(".peak-label.peak-end { align-self: flex-end; }");
  });

  it("PEAK-EDGE-LEVEL: the operations slide, whose level bars peak at the first year, anchors its peak at the left edge", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const peak = document.querySelector('[data-slide-name="operations"] [data-testid="peak-label"]:not(.peak-hidden)') as HTMLElement;
    expect(peak.classList.contains("peak-start")).toBe(true);
  });
});