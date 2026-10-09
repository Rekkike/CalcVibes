import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("Task A: NAV-PRESERVED / CONTROLS-PRESERVED / START-YEAR-RELOCATED", () => {
  it("NAV-PRESERVED: all ten views render inside their three groups and each navigates on one click", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    const groups = document.querySelectorAll(".nav-group");
    expect(groups.length).toBe(3);
    const model = document.querySelector('[data-nav-group="model"]') as HTMLElement;
    const finance = document.querySelector('[data-nav-group="finance"]') as HTMLElement;
    const read = document.querySelector('[data-nav-group="read"]') as HTMLElement;
    expect(Array.from(model.querySelectorAll("[data-nav]")).map((b) => b.getAttribute("data-nav")))
      .toEqual(["overview", "costs", "operating", "repayment", "tariff"]);
    expect(Array.from(finance.querySelectorAll("[data-nav]")).map((b) => b.getAttribute("data-nav")))
      .toEqual(["financing", "appraisal"]);
    expect(Array.from(read.querySelectorAll("[data-nav]")).map((b) => b.getAttribute("data-nav")))
      .toEqual(["results", "scenarios", "detail"]);
    expect(model.querySelector('[data-nav="costs"]')?.textContent).toBe("Cost model");
    for (const v of ["overview", "costs", "operating", "repayment", "tariff", "financing", "appraisal", "results", "scenarios", "detail"]) {
      fireEvent.click(byNav(v));
      expect(byNav(v).className).toContain("active");
    }
  });

  it("CONTROLS-PRESERVED: every header control of record renders with its identifier", () => {
    render(<App />);
    const header = document.querySelector("header.app-header") as HTMLElement;
    expect(header.querySelector('[data-action="new-project"]')).toBeTruthy();
    expect(header.querySelector('[data-action="load-demo"]')).toBeTruthy();
    expect(header.querySelector('[data-action="present"]')).toBeTruthy();
    expect(header.querySelector('[data-action="download-pdf"]')).toBeTruthy();
    expect(header.querySelector('[data-action="print-deck"]')).toBeTruthy();
    expect(header.querySelector('[data-action="export-xlsx"]')).toBeTruthy();
    expect(header.querySelector('[data-field="entryUnit"]')).toBeTruthy();
    expect(header.querySelector('[data-field="theme"]')).toBeTruthy();
    expect(header.querySelector('[data-testid="version"]')).toBeTruthy();
    expect(header.querySelector("h1")).toBeTruthy();
  });

  it("START-YEAR-RELOCATED: the field renders inside the overview section; the header carries none", () => {
    render(<App />);
    const header = document.querySelector("header.app-header") as HTMLElement;
    expect(header.querySelector('[data-field="startYear"]')).toBeNull();
    expect(document.querySelector('[data-testid="overview"] [data-field="startYear"]')).toBeTruthy();
    const field = document.querySelector('[data-testid="overview"] [data-field="startYear"]') as HTMLInputElement;
    fireEvent.change(field, { target: { value: "1899" } });
    expect(document.querySelector('[data-testid="start-year-error"]')?.textContent).toBe("Project start year must be between 1900 and 2200.");
    fireEvent.change(field, { target: { value: "2024" } });
    expect(document.querySelector('[data-testid="start-year-error"]')).toBeNull();
  });
});

describe("Task B: ANSWER-BAND / KPI-ROW / FIGURE-BAND / COVERAGE-BOTTOM", () => {
  it("ANSWER-BAND: the statement equals its computed branch for the met case, tone-coded", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, percentForDisplay, roundForDisplay } = await import("../src/engine.js");
    const demo = demoProject();
    const result = computeModel(demo);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const band = document.querySelector('[data-testid="answer-band"]') as HTMLElement;
    expect(band.className).toContain("tone-ok");
    const statement = document.querySelector('[data-testid="goal-check"]')?.textContent ?? "";
    expect(statement).toContain(`achieves an IRR of ${percentForDisplay(result.achievedIrr, 2)} against a target of ${roundForDisplay(demo.targetIrr, 2)}%`);
    expect(statement).toContain("target achieved");
  });

  it("KPI-ROW: each card value equals its engine field through the display formatters; the absent-financing branch is honest", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, percentForDisplay, roundForDisplay, deckMoneyForDisplay, deckYearsForDisplay } = await import("../src/engine.js");
    const demo = demoProject();
    const result = computeModel(demo);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const cards = Array.from(document.querySelectorAll('[data-testid="kpi-row"] .kpi-card'));
    expect(cards.length).toBe(4);
    const byLabel = (l: string) => cards.find((c) => c.querySelector(".kpi-label")?.textContent === l) as HTMLElement;
    expect(byLabel("Achieved IRR").querySelector(".kpi-value")?.textContent).toBe(percentForDisplay(result.achievedIrr, 2));
    expect(byLabel("Achieved IRR").querySelector(".kpi-chip")?.textContent).toBe(`vs ${roundForDisplay(demo.targetIrr, 2)}% target`);
    expect(byLabel("Achieved IRR").className).toContain("tone-ok");
    expect(byLabel("NPV at WACC").querySelector(".kpi-value")?.textContent).toBe(deckMoneyForDisplay(result.npvAtWacc, "SEK", "ones"));
    expect(byLabel("Payback (nominal)").querySelector(".kpi-value")?.textContent).toBe(deckYearsForDisplay(result.paybackYears as number));
    expect(byLabel("Min DSCR").querySelector(".kpi-value")?.textContent).toBe("not applicable");
  });

  it("FIGURE-BAND: the three figures equal their engine fields through the deck money variant; the note renders verbatim", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const result = computeModel(demoProject());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const band = document.querySelector('[data-testid="figure-band"]') as HTMLElement;
    expect(band.querySelectorAll(".figure-item").length).toBe(3);
    expect(band.querySelector('[data-testid="figure-band"] .figure-value') === null ? null : Array.from(band.querySelectorAll(".figure-value")).map((e) => e.textContent))
      .toEqual([deckMoneyForDisplay(result.totalCost, "SEK", "ones"), deckMoneyForDisplay(result.totalCollected, "SEK", "ones"), deckMoneyForDisplay(result.netGain, "SEK", "ones")]);
    expect(band.querySelector(".caveat")?.textContent).toBe("Nominal figures are undiscounted; the cost NPV and achieved IRR are discounted.");
  });

  it("COVERAGE-BOTTOM: the coverage chart renders after the working surface in the DOM order", async () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const section = document.querySelector('[data-testid="results"]') as HTMLElement;
    const children = Array.from(section.children);
    const tableIdx = children.findIndex((c) => c.getAttribute("data-testid") === "yearly-table");
    const coverageIdx = children.findIndex((c) => c.getAttribute("data-testid") === "coverage-chart");
    expect(tableIdx).toBeGreaterThan(-1);
    expect(coverageIdx).toBeGreaterThan(tableIdx);
    const coverage = document.querySelector('[data-testid="coverage-chart"]') as HTMLElement;
    expect(coverage.querySelector('[data-testid="signed-cashflow"]')).toBeTruthy();
  });
});

describe("Task B (continued): the not-met answer branch", () => {
  it("ANSWER-BAND not-met: a below-target configuration renders the falls-short branch with the bad tone", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("tariff"));
    fireEvent.change(document.querySelector('[data-field="tariffMode"]') as HTMLElement, { target: { value: "fixed" } });
    fireEvent.change(document.querySelector('[data-field="tariffFixed"]') as HTMLElement, { target: { value: "100000" } });
    fireEvent.click(byNav("results"));
    const band = document.querySelector('[data-testid="answer-band"]') as HTMLElement;
    expect(band.className).toContain("tone-bad");
    const statement = document.querySelector('[data-testid="goal-check"]')?.textContent ?? "";
    expect(statement).toContain("The project falls short");
    expect(statement).toContain("target not achieved");
    const cards = Array.from(document.querySelectorAll('[data-testid="kpi-row"] .kpi-card'));
    const irrCard = cards.find((c) => c.querySelector(".kpi-label")?.textContent === "Achieved IRR") as HTMLElement;
    expect(irrCard.className).toContain("tone-bad");
  });
});

describe("Task C: COVERAGE-SLIDE / WATERFALL-BUILD / HURDLE-TRACE / TONE-SEMANTICS / TAKEAWAY-KICKERS", () => {
  it("COVERAGE-SLIDE: the deck counts six slides; the coverage slide sits between recovery and returns with the engine cumulative curve", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, deckYearsForDisplay } = await import("../src/engine.js");
    const { deckSlides } = await import("../src/deck.js");
    const result = computeModel(demoProject());
    const deck = deckSlides(demoProject(), result, { startYear: null });
    expect(deck.slides.length).toBe(6);
    expect(deck.slides.map((s) => s.name)).toEqual(["title", "investment", "recovery", "coverage", "returns", "deal"]);
    const coverage = deck.slides[3];
    expect(coverage.title).toBe("The outlay is recovered and the project turns cash-positive");
    expect(coverage.chart?.kind).toBe("coverage");
    expect(coverage.chart?.data.length).toBe(result.yearly.length);
    for (let k = 0; k < (coverage.chart?.data.length ?? 0); k++) {
      expect(coverage.chart?.data[k].value).toBe(result.yearly[k].cumulative);
    }
    const nominalPayback = coverage.body.find((f) => f.label === "Nominal payback");
    expect(nominalPayback?.value).toBe(deckYearsForDisplay(result.paybackYears as number));
  });

  it("COVERAGE-SLIDE rendered (re-anchored per v0.6R): the signed stage chart mounts with the gold cumulative line, the zero baseline, the break-even label, and the crossing caption", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 3; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const stage = document.querySelector('[data-slide-name="coverage"] [data-testid="stage-returns"]') as HTMLElement;
    expect(stage).toBeTruthy();
    expect(stage.querySelector('[data-testid="stage-returns-zero"]')).toBeTruthy();
    expect(stage.querySelector('[data-testid="stage-gold-line"]')?.getAttribute("stroke")).toBe("#e8b84b");
    expect(stage.querySelectorAll('[data-stage-bar="cost"]').length).toBeGreaterThan(0);
    expect(stage.querySelectorAll('[data-stage-bar="inflow"]').length).toBeGreaterThan(0);
    expect(stage.querySelector('[data-testid="stage-returns-crossing"]')?.textContent).toContain("break-even");
    const caption = document.querySelector('[data-slide-name="coverage"] [data-testid="crossing-caption"]');
    expect(caption?.textContent).not.toMatch(/\d/);
  });

  it("WATERFALL-BUILD: one segment per cost line; the labels flow through the deck money variant", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const result = computeModel(demoProject());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const slide = document.querySelector('[data-slide-name="investment"]') as HTMLElement;
    const waterfall = slide.querySelector('[data-testid="cost-waterfall"]') as HTMLElement;
    const segments = waterfall.querySelectorAll("[data-waterfall-segment]");
    expect(segments.length).toBe(result.lineTotals.length);
    const cap = Math.max(1e-12, result.totalCost);
    let accShare = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i] as HTMLElement;
      const frac = result.lineTotals[i].total / cap;
      expect(parseFloat(seg.style.height)).toBeCloseTo(frac * 100, 0);
      expect(parseFloat(seg.style.bottom)).toBeCloseTo(accShare * 100, 0);
      accShare += frac;
    }
    const capEl = waterfall.querySelector('[data-testid="waterfall-cap"]') as HTMLElement;
    expect(parseFloat(capEl.style.bottom)).toBeCloseTo(100, 0);
    for (const seg of Array.from(segments)) {
      expect((seg as HTMLElement).querySelector('[data-testid="waterfall-label"]')).toBe(null);
    }
    const labels = waterfall.querySelectorAll('[data-testid="waterfall-label"]');
    expect(labels.length).toBe(result.lineTotals.length);
    for (let i = 0; i < labels.length; i++) {
      expect(labels[i].textContent).toContain(result.lineTotals[i].name);
      expect(labels[i].textContent).toContain(deckMoneyForDisplay(result.lineTotals[i].total, "SEK", "thousands"));
    }
    expect(slide.querySelectorAll('[data-testid="composition-rows"]').length).toBe(1);
  });

  it("HURDLE-TRACE: the two dots map the engine achieved IRR and the input target on one zero-based scale; the tone flips with goalMet", async () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const plot = document.querySelector('[data-testid="hurdle-plot"]') as HTMLElement;
    const targetDot = plot.querySelector('[data-testid="hurdle-target-dot"]') as HTMLElement;
    const achievedDot = plot.querySelector('[data-testid="hurdle-achieved-dot"]') as HTMLElement;
    const { demoProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const demo = demoProject();
    const res = computeModel(demo);
    const target = demo.targetIrr;
    const achieved = (res.achievedIrr ?? 0) * 100;
    const scale = Math.max(target, achieved) * 1.15;
    expect(parseFloat(targetDot.style.left)).toBeCloseTo((target / scale) * 100, 0);
    expect(parseFloat(achievedDot.style.left)).toBeCloseTo((achieved / scale) * 100, 0);
    expect(achievedDot.className).toContain("tone-ok");
    expect(plot.querySelector('[data-testid="hurdle-margin-label"]')?.textContent).toContain("solved to the target");
    expect(plot.querySelector('[data-testid="hurdle-margin-label"]')?.getAttribute("data-hurdle-mode")).toBe("solved");
  });

  it("TONE-SEMANTICS: the met case tones the tiles; the not-met case renders the bad tones", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const npvTile = document.querySelector('[data-tile="NPV at WACC"]') as HTMLElement;
    expect(npvTile.className).toContain("tone-ok");
    const netGainTile = document.querySelector('[data-tile="Net gain"]') as HTMLElement;
    expect(netGainTile.className).toContain("tone-ok");
    fireEvent.click(byAction("exit-presentation"));
    fireEvent.click(byNav("tariff"));
    fireEvent.change(document.querySelector('[data-field="tariffMode"]') as HTMLElement, { target: { value: "fixed" } });
    fireEvent.change(document.querySelector('[data-field="tariffFixed"]') as HTMLElement, { target: { value: "100000" } });
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const npvTileBad = document.querySelector('[data-tile="NPV at WACC"]') as HTMLElement;
    expect(npvTileBad.className).toContain("tone-bad");
    const irrTileBad = document.querySelector('[data-tile="Achieved IRR"]') as HTMLElement;
    expect(irrTileBad.className).toContain("tone-bad");
  });

  it("TAKEAWAY-KICKERS: the investment kicker names the dominant line from the argmax over the engine lineTotals", async () => {
    const { demoProject } = await import("../src/state.js");
    const { computeModel } = await import("../src/engine.js");
    const result = computeModel(demoProject());
    const dominant = result.lineTotals.reduce((b, l) => (l.total > b.total ? l : b), result.lineTotals[0]);
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const kicker = document.querySelector('[data-slide-name="investment"] [data-testid="chart-kicker"]')?.textContent;
    expect(kicker).toBe(`${dominant.name} dominates the cost base`);
    expect(kicker).not.toMatch(/\d/);
  });
});
