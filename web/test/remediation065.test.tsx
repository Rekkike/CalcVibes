import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import * as fs from "fs";
import { App } from "../src/App.js";
import { deckSlides } from "../src/deck.js";
import { computeModel, deckMoneyForDisplay, percentTwoForDisplay } from "../src/engine.js";
import { demoProject, multiLeaseProject } from "../src/state.js";
import { buildDeckPdf } from "../src/pdf.js";
import type { ModelInputs } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;

describe("v0.6.5 Task A: the formatted sale disclosure (W8)", () => {
  it("A-BOOK-VALUE: the multi-lease deal disclosure composes from structured fields through the deck formatters; the raw engine number reaches no rendered deck string", () => {
    const ml = multiLeaseProject();
    const mlr = computeModel(ml);
    const deck = deckSlides(ml, mlr, { startYear: null, entryUnit: "thousands" });
    const deal = deck.slides[6];
    const disclosure = deal.disclosures.find((d) => d.includes("Assumes sale"));
    expect(disclosure).toBe("Assumes sale at remaining book value at year 54 for 98 000 tkr");
    // the raw engine number is model data only (tile.rawValue, donut segment values); it never
    // reaches a rendered string (titles, figure values, tiles, disclosures, verdict, metrics)
    const strings: string[] = [];
    for (const sl of deck.slides) {
      strings.push(sl.title);
      for (const f of sl.body) strings.push(`${f.label} ${f.value}`);
      for (const d of sl.disclosures) strings.push(d);
      if (sl.verdict !== undefined) strings.push(sl.verdict);
      for (const t of sl.tiles ?? []) strings.push(`${t.label} ${t.value} ${t.disclosure ?? ""}`);
      for (const m of sl.titleMetrics ?? []) strings.push(`${m.label} ${m.value}`);
      for (const d of sl.donuts ?? []) {
        strings.push(d.title);
        if (d.disclosure !== undefined) strings.push(d.disclosure);
      }
    }
    expect(strings.some((s) => s.includes("98000000.00000001"))).toBe(false);
  });

  it("A-SET-PRICE: the set-price posture composes its disclosure through the formatters as well", () => {
    const sp: ModelInputs = {
      ...demoProject(),
      appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { mode: "amount", amount: 1234567, year: 9 } },
    } as ModelInputs;
    const deck = deckSlides(sp, computeModel(sp), { startYear: null, entryUnit: "thousands" });
    const disclosure = deck.slides[6].disclosures.find((d) => d.includes("Assumes sale"));
    expect(disclosure).toBe("Assumes sale at year 9 for 1 235 tkr");
  });
});

describe("v0.6.5 Task B: the scenarios target infographic (W11)", () => {
  it("B-SOLVED-TEMPLATE: the solved-mode payment-vs-target curve carries the script-verified values and rises monotonically", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: "ones", scenarioTargets: [5, 8, 10, 12, 15, 25] });
    expect(deck.slides.length).toBe(8);
    const sce = deck.slides[7];
    expect(sce.targetChart).toBeDefined();
    const chart = sce.targetChart!;
    expect(chart.mode).toBe("solved");
    expect(chart.breakEvenTarget).toBeNull();
    expect(chart.points.map((p) => p.target)).toEqual([5, 8, 10, 12, 15, 25]);
    expect(chart.points[0].value).toBe(353738.9256476774);
    expect(chart.points[1].value).toBe(403102.7438778404);
    expect(chart.points[2].value).toBe(438284.5605554922);
    expect(chart.points[3].value).toBe(475309.1340746104);
    expect(chart.points[4].value).toBe(534342.241488671);
    expect(chart.points[5].value).toBe(762056.3308796786);
    for (let i = 1; i < chart.points.length; i++) {
      expect(chart.points[i].value).toBeGreaterThan(chart.points[i - 1].value);
    }
    expect(chart.kicker).not.toMatch(/\d/);
  });

  it("B-SOLVED-MULTILEASE: the multi-lease curve carries its live figures of record through the thousands display", () => {
    const ml = multiLeaseProject();
    const mlr = computeModel(ml);
    const deck = deckSlides(ml, mlr, { startYear: null, entryUnit: "thousands", scenarioTargets: [5, 8, 10, 12, 15, 25] });
    const chart = deck.slides[7].targetChart!;
    expect(chart.mode).toBe("solved");
    const at5 = chart.points.find((p) => p.target === 5)!;
    const at25 = chart.points.find((p) => p.target === 25)!;
    expect(at5.value).toBe(6632842.06237012);
    expect(at25.value).toBe(44952565.7041264);
    expect(deckMoneyForDisplay(at5.value, "SEK", "thousands")).toBe("6 633 tkr");
    expect(deckMoneyForDisplay(at25.value, "SEK", "thousands")).toBe("44 953 tkr");
    for (let i = 1; i < chart.points.length; i++) {
      expect(chart.points[i].value).toBeGreaterThan(chart.points[i - 1].value);
    }
  });

  it("B-EVALUATED: the fixed-tariff verdict chart holds the achieved constant, marks the break-even at the achieved, and never fakes a met verdict", () => {
    const fixed: ModelInputs = {
      ...demoProject(),
      tariff: { mode: "fixed", escalationPerYear: 2, rows: [], fixedAnnualAmount: 100000, manualPrices: null },
    } as ModelInputs;
    const fr = computeModel(fixed);
    const deck = deckSlides(fixed, fr, { startYear: null, entryUnit: "ones", scenarioTargets: [5, 8, 10, 12, 15, 25] });
    const chart = deck.slides[7].targetChart!;
    expect(chart.mode).toBe("evaluated");
    expect(chart.points.length).toBe(6);
    for (const p of chart.points) {
      expect(p.value).toBe(-0.34454236846935526);
      expect(p.met).toBe(false);
    }
    expect(chart.breakEvenTarget).toBe(fr.achievedIrr);
    expect(chart.breakEvenTarget).toBe(-0.34454236846935526);
    expect(percentTwoForDisplay(chart.breakEvenTarget!)).toBe("-34.45%");
    expect(`break-even at ${percentTwoForDisplay(chart.breakEvenTarget!)}`).toBe("break-even at -34.45%");
  });

  it("B-DEGENERATE: an axis with fewer than two set values renders no chart; a collections profile renders none either, with the SCE-PROFILE disclosure standing", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    const one = deckSlides(demo, result, { startYear: null, entryUnit: "ones", scenarioTargets: [12] });
    expect(one.slides[7].targetChart).toBeUndefined();
    const profile: ModelInputs = {
      ...demo,
      repayment: { ...demo.repayment, collectionsOverrides: { 1: 400000 } },
    } as ModelInputs;
    const profileDeck = deckSlides(profile, computeModel(profile), { startYear: null, entryUnit: "ones", scenarioTargets: [5, 12] });
    const sce = profileDeck.slides[7];
    expect(sce.targetChart).toBeUndefined();
    expect(sce.disclosures.some((d) => d.includes("(SCE-PROFILE)"))).toBe(true);
  });
});

describe("v0.6.5 Task C: the paired composition donuts (W13)", () => {
  it("C-TEMPLATE: the outflow donut carries the line composition with the reinvestment segment when nonzero; the inflow donut carries the grid streams; the sums are exact", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    const donuts = deck.slides[1].donuts ?? [];
    expect(donuts.length).toBe(2);
    const out = donuts.find((d) => d.id === "outflows")!;
    const infl = donuts.find((d) => d.id === "inflows")!;
    expect(out.segments.map((s) => s.value)).toEqual([5563620, 1836240, 450000]);
    expect(out.segments.every((s) => !s.label.includes("Reinvestments"))).toBe(true);
    // v0.6.18 Task B re-anchor: every ring carries the share-basis disclosure; this fixture has neither operating lines nor reinvestments
    expect(out.disclosure).toBe("The outflow ring shows the capital lines. Percentages are shares of the ring's own total.");
    const sum = out.segments.reduce((a, s) => a + s.value, 0);
    expect(sum).toBe(7849860);
    expect(sum).toBe(result.totalCost);
    expect(out.segments.map((s) => Math.round((s.value / sum) * 10000) / 100)).toEqual([70.88, 23.39, 5.73]);
    expect(infl.segments.map((s) => s.value)).toEqual([13308655.754089093]);
    expect(infl.segments[0].id).toBe("payments");
  });

  it("C-MULTILEASE: the contract streams and the residual compose the inflows after the Task D grid fix; the reinvestments join the outflows", () => {
    const ml = multiLeaseProject();
    const mlr = computeModel(ml);
    const deck = deckSlides(ml, mlr, { startYear: null, entryUnit: "thousands" });
    const donuts = deck.slides[1].donuts ?? [];
    const out = donuts.find((d) => d.id === "outflows")!;
    const infl = donuts.find((d) => d.id === "inflows")!;
    const reinvest = out.segments.find((s) => s.label === "Reinvestments")!;
    expect(reinvest.value).toBe(3000000);
    expect(out.segments.reduce((a, s) => a + s.value, 0)).toBe(118000000);
    expect(out.segments.reduce((a, s) => a + s.value, 0)).toBe(mlr.totalCost);
    const contract = infl.segments.filter((s) => s.id.startsWith("k"));
    expect(contract.length).toBe(3);
    const residual = infl.segments.find((s) => s.id === "residual")!;
    expect(residual.value).toBeCloseTo(98000000.00000001, 8);
    expect(infl.segments.reduce((a, s) => a + s.value, 0)).toBeCloseTo(646911374.8169572, 6);
    expect(infl.segments.reduce((a, s) => a + s.value, 0)).toBeCloseTo(mlr.totalCollected, 6);
  });

  it("C-RENDER: the rendered summary carries the two donuts with labels outside the geometry, no viewbox text (v0.6.10 re-anchor: the program inflow carries the fees and grants segments — 2 segments in, 6 out — so the single-segment full-circle case no longer arises from the demo button)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const summary = document.querySelector('[data-slide-name="summary"]') as HTMLElement;
    const wrap = summary.querySelector('[data-testid="summary-donuts"]') as HTMLElement;
    expect(wrap).toBeTruthy();
    expect(wrap.querySelectorAll('[data-testid="composition-donut"]').length).toBe(2);
    const inflow = wrap.querySelector('[data-donut="inflows"]') as HTMLElement;
    expect(inflow.querySelectorAll("[data-donut-segment]").length).toBe(2);
    expect(inflow.querySelector("svg text")).toBeNull();
    for (const label of Array.from(inflow.querySelectorAll('[data-testid="donut-label"]'))) {
      expect((inflow.querySelector("svg") as SVGSVGElement).contains(label)).toBe(false);
    }
    expect(inflow.querySelector('[data-testid="donut-center-total"]')?.textContent).toBe("€855 908 k");
    expect(inflow.querySelector('[data-donut-label="fees"]')?.textContent).toContain("Fees €682 408 k");
    expect(inflow.querySelector('[data-donut-label="grants"]')?.textContent).toContain("Grants €173 500 k");
    const outflow = wrap.querySelector('[data-donut="outflows"]') as HTMLElement;
    expect(outflow.querySelectorAll("[data-donut-segment]").length).toBe(6);
    expect(outflow.querySelector("svg text")).toBeNull();
  });
});

describe("v0.6.5 Task E: the scale-adaptive chart labels (W12)", () => {
  it("E-CROSSING: the deck model clamps the crossing x to both anchors, nulls it without a crossing, and the stage positions the label at the crossing", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    expect(deck.slides[4].chart?.crossingX).toBe(66.7);
    const ml = multiLeaseProject();
    const mlDeck = deckSlides(ml, computeModel(ml), { startYear: null, entryUnit: "thousands" });
    expect(mlDeck.slides[4].chart?.crossingX).toBe(24.5);
    const fixed: ModelInputs = {
      ...demo,
      tariff: { mode: "fixed", escalationPerYear: 2, rows: [], fixedAnnualAmount: 100000, manualPrices: null },
    } as ModelInputs;
    const fixedDeck = deckSlides(fixed, computeModel(fixed), { startYear: null, entryUnit: "ones" });
    expect(fixedDeck.slides[4].chart?.crossingX).toBeNull();
    // the clamp is bounded [15, 85] in the model
    const deckSrc = fs.readFileSync("src/deck.ts", "utf8");
    expect(deckSrc).toContain("Math.min(85, Math.max(15");
    // rendered: the coverage slot carries the crossing x and the label rule reads it (v0.6.10 re-anchor: the program crossing)
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const slot = document.querySelector('[data-slide-name="coverage"] [data-slide-chart="coverage"]') as HTMLElement;
    expect(slot.style.getPropertyValue("--deck-crossing-x")).toBe("59.1%");
    expect(document.querySelector('[data-testid="stage-returns-crossing"]')).toBeTruthy();
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\[data-testid="presentation"\] \.line-years\s*\{/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.column-year-label\s*\{/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.row-name\s*\{/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.row-share\s*\{/);
    expect(css).toMatch(/\[data-testid="presentation"\] \.row-value\s*\{/);
    expect(css).toMatch(/--deck-crossing-x:\s*50%/);
    expect(css).toMatch(/var\(--deck-crossing-x, 50%\)/);
  });
});

describe("v0.6.5 Task F: the static navigation chrome (W14)", () => {
  it("F-CHROME-RENDER: the chrome is fixed at the bottom with the counter on screen; the arrows dim at the ends, never disappear; the action names and dots stand (v0.6.7 re-anchor: the port preset axes mount the eighth scenarios slide)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const nav = document.querySelector('[data-testid="presentation"] footer.stage-nav') as HTMLElement;
    expect(nav).toBeTruthy();
    expect(nav.className).toContain("stage-nav-chrome");
    const prev = nav.querySelector('[data-action="prev-slide"]') as HTMLElement;
    const next = nav.querySelector('[data-action="next-slide"]') as HTMLElement;
    expect(prev.className).toContain("stage-nav-button");
    expect(next.className).toContain("stage-nav-button");
    expect(prev.getAttribute("aria-disabled")).toBe("true");
    expect(prev.className).toContain("stage-nav-button-disabled");
    expect(prev.textContent).toBe("‹");
    expect(next.textContent).toBe("›");
    expect(nav.querySelector(".stage-nav-counter")?.textContent).toBe("1 / 10");
    expect(nav.querySelectorAll("[data-dot]").length).toBe(10); // v0.6.18 re-anchor: the operations slide
    expect(next.getAttribute("aria-disabled")).toBe("false");
    for (let i = 0; i < 9; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(nav.querySelector(".stage-nav-counter")?.textContent).toBe("10 / 10");
    expect(next.getAttribute("aria-disabled")).toBe("true");
    expect(next.className).toContain("stage-nav-button-disabled");
    expect(prev.getAttribute("aria-disabled")).toBe("false");
    expect(document.querySelectorAll('[data-dot="9"].stage-dot-active').length).toBe(1);
  });

  it("F-SWIPE-SOURCE: the swipe handlers attach with a threshold and the dominant-axis test; the chrome reserves the safe area", () => {
    const src = fs.readFileSync("src/presentation/Presentation.tsx", "utf8");
    expect(src).toContain('addEventListener("touchstart"');
    expect(src).toContain('addEventListener("touchend"');
    expect(src).toContain("Math.abs(dx) < 48");
    expect(src).toContain("Math.abs(dx) < Math.abs(dy) * 1.5");
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/footer\.stage-nav\s*\{[^}]*position:\s*fixed/);
    expect(css).toContain("env(safe-area-inset-bottom, 0px)");
    expect(css).toMatch(/\[data-testid="presentation"\] \.stage-nav \.stage-nav-button\[aria-disabled="true"\]\s*\{[^}]*opacity/);
  });
});

describe("v0.6.5 Task G: the theme posture and the color once-over (W15)", () => {
  it("G-THEME-DARK-DEFAULT: with no system preference the app mounts dark (the guarded matchMedia fallback); the select remains the manual override", () => {
    const src = fs.readFileSync("src/App.tsx", "utf8");
    expect(src).toContain('matchMedia("(prefers-color-scheme: light)")');
    expect(src).toContain("typeof window.matchMedia === \"function\"");
    expect(src).toContain('return "dark"');
    render(<App />);
    const root = document.querySelector(".app-root") as HTMLElement;
    expect(root.getAttribute("data-theme")).toBe("dark");
    fireEvent.change(document.querySelector('[data-field="theme"]') as HTMLElement, { target: { value: "light" } });
    expect(root.getAttribute("data-theme")).toBe("light");
  });

  it("G-CONTRAST-AUDIT: the documented token audit — the inks and muted inks clear 4.5:1 and the semantic tones clear 3:1 on light and dark surfaces alike", () => {
    const css = fs.readFileSync("src/index.css", "utf8");
    const rootStart = css.indexOf(":root");
    const rootBlock = css.slice(rootStart, css.indexOf("}", rootStart));
    const darkStart = css.indexOf('.app-root[data-theme="dark"]');
    const darkBlock = css.slice(darkStart, css.indexOf("}", darkStart));
    const tokens = (block: string): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
      return out;
    };
    const light = tokens(rootBlock);
    const dark = tokens(darkBlock);
    const lin = (c: number) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const lum = (hex: string) => {
      const h = hex.slice(1);
      return 0.2126 * lin(parseInt(h.slice(0, 2), 16)) + 0.7152 * lin(parseInt(h.slice(2, 4), 16)) + 0.0722 * lin(parseInt(h.slice(4, 6), 16));
    };
    const ratio = (fg: string, bg: string) => {
      const a = lum(fg);
      const b = lum(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    // the audit of record: body inks and muted inks clear the 4.5:1 text bar on bg and card
    for (const theme of [light, dark]) {
      for (const ink of ["ink", "mut"]) {
        expect(ratio(theme[ink], theme.bg)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(theme[ink], theme.card)).toBeGreaterThanOrEqual(4.5);
      }
      // the semantic tones carry their meaning at the 3:1 large-text bar on the card surface
      for (const sem of ["ok", "bad", "warn"]) {
        expect(ratio(theme[sem], theme.card)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("v0.6.5 Task H: the PDF quality sweep (W10/W16)", () => {
  it("H-PRINT-PALETTE: no stage color appears on the paper route; the print inks and the print donut palette stand; the base demo stays seven pages", () => {
    const src = fs.readFileSync("src/pdf.ts", "utf8");
    for (const banned of ["52, 211, 153", "251, 113, 133", "204, 233, 255", "232, 184, 75", "#34d399", "#fb7185"]) {
      expect(src.includes(banned)).toBe(false);
    }
    expect(src).toContain("[4, 120, 87]");
    expect(src).toContain("[190, 18, 60]");
    expect(src).toContain("[146, 100, 14]");
    expect(src).toContain('"#0074ba", "#047857", "#b45309", "#6d28d9", "#be123c", "#103558"');
    const demo = demoProject();
    const result = computeModel(demo);
    const model = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    const doc = buildDeckPdf(model, "Project Alpha");
    expect(doc.getNumberOfPages()).toBe(7);
  });

  it("H-PRINT-SURFACES: the summary donuts and the scenario target charts join the drawn trace with their formatted figures", () => {
    const demo = demoProject();
    const result = computeModel(demo);
    const model = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(model, "Project Alpha", trace);
    const summary = trace.drawnFigures[1].join("|");
    expect(summary).toContain("Outflows — the investment");
    expect(summary).toContain("Inflows — the collections");
    expect(summary).toContain("7 849 860 kr");
    expect(summary).toContain("Development team 5 563 620 kr");
    const axesDeck = deckSlides(demo, result, { startYear: null, entryUnit: "ones", scenarioTargets: [5, 8, 10, 12, 15, 25] });
    const trace2 = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(axesDeck, "Project Alpha", trace2);
    const sce = trace2.drawnFigures[7].join("|");
    expect(sce).toContain("353 739 kr");
    expect(sce).toContain("762 056 kr");
    const fixed: ModelInputs = {
      ...demo,
      tariff: { mode: "fixed", escalationPerYear: 2, rows: [], fixedAnnualAmount: 100000, manualPrices: null },
    } as ModelInputs;
    const fixedDeck = deckSlides(fixed, computeModel(fixed), { startYear: null, entryUnit: "ones", scenarioTargets: [5, 8, 10, 12, 15, 25] });
    const trace3 = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(fixedDeck, "Project Alpha", trace3);
    const sce3 = trace3.drawnFigures[7].join("|");
    expect(sce3).toContain("break-even at -34.45%");
    expect(sce3).toContain("not met");
  });
});

describe("v0.6.5 Task I: the verdict-led closing slide", () => {
  it("I-VERDICT-LEAD: the deal slide renders the verdict first with the lead emphasis, before the tiles, and the PDF draws it first on the deal page", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const deal = document.querySelector('[data-slide-name="deal"]') as HTMLElement;
    const verdict = deal.querySelector('[data-testid="deck-verdict"]') as HTMLElement;
    const tiles = deal.querySelector('[data-testid="summary-tiles"]') as HTMLElement;
    expect(verdict).toBeTruthy();
    expect(verdict.className).toContain("deck-verdict-lead");
    expect(verdict.className).toContain("insight");
    expect(verdict.textContent).toContain("Target met");
    expect(tiles).toBeTruthy();
    expect(verdict.compareDocumentPosition(tiles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const demo = demoProject();
    const result = computeModel(demo);
    const model = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(model, "Project Alpha", trace);
    expect(trace.drawnFigures[6][0]).toBe(model.slides[6].verdict);
  });
});
