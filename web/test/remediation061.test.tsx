import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel, moneyForDisplay } from "../src/engine.js";
import { demoProject, multiLeaseProject } from "../src/state.js";
import { bucketSeries, bucketWidthFor } from "../src/charts.js";
import type { ModelInputs } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("v0.6.1 chunk 1 — the worksuite surfaces", () => {
  it("SCENARIOS-REFUSAL: an engine refusal inside the scenario set renders the readable card and the page stays mounted", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("repayment"));
    const editor = document.querySelector('[data-testid="collections-editor"]') as HTMLElement;
    editor.setAttribute("open", "true");
    const addBtn = editor.querySelector('[data-action="add-col-override"]') as HTMLElement;
    fireEvent.click(addBtn);
    fireEvent.click(byNav("scenarios"));
    const refusal = document.querySelector('[data-testid="scenarios-refusal"]') as HTMLElement;
    expect(refusal).toBeTruthy();
    expect(refusal.textContent).toContain("The engine refused to compute the scenario set");
    expect(refusal.textContent).toContain("COL-PROFILE-AMOUNT");
    expect(document.querySelector('[data-testid="scenarios"]')).toBeTruthy();
  });

  it("ENTRY-UNIT: the Results stats and the yearly table render unit-scaled figures consistent with the deck", async () => {
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const result = computeModel(demoProject());
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.change(document.querySelector('[data-field="entryUnit"]') as HTMLSelectElement, { target: { value: "millions" } });
    fireEvent.click(byNav("results"));
    expect(document.querySelector('[data-stat="totalCost"]')?.textContent).toBe(deckMoneyForDisplay(result.totalCost, "SEK", "millions"));
    expect(document.querySelector('[data-stat="yearly-cost"]')?.textContent).toBe(deckMoneyForDisplay(result.yearly[0].cost, "SEK", "millions"));
    const cumCells = document.querySelectorAll('[data-stat="yearly-cumulative"]'); expect(cumCells[cumCells.length - 1]?.textContent).toBe(deckMoneyForDisplay(result.yearly[result.yearly.length - 1].cumulative, "SEK", "millions"));
    fireEvent.click(byNav("detail"));
    expect(document.querySelector('[data-testid="cost-grid"] td.table-value-cell')?.textContent).toBe(moneyForDisplay(result.costGrid[0].amounts[0], "SEK", "millions"));
  });

  it("ADAPTIVE-BINNING: a 54-year horizon yields at most 20 columns; the widths are 1/2/5/10", () => {
    expect(bucketWidthFor(10, 20)).toBe(1);
    expect(bucketWidthFor(21, 20)).toBe(2);
    expect(bucketWidthFor(54, 20)).toBe(5);
    expect(bucketWidthFor(200, 20)).toBe(10);
    const { buckets, width } = bucketSeries(new Array(54).fill(1), 20);
    expect(buckets.length).toBeLessThanOrEqual(20);
    expect(width).toBe(5);
    const { buckets: many } = bucketSeries(new Array(300).fill(1), 20);
    expect(many.length).toBeLessThanOrEqual(20);
  });

  it("DEGENERATE-SKEW: the multi-lease demo (a 54-year horizon, skewed composition) renders the recovery bars capped and the app stays mounted", () => {
    const result = computeModel(multiLeaseProject() as ModelInputs);
    expect(result.yearly.length).toBeGreaterThan(20);
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 2; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const bars = document.querySelectorAll('[data-slide-name="recovery"] [data-recovery-column]');
    expect(bars.length).toBeLessThanOrEqual(15);
    fireEvent.click(document.querySelector('[data-action="exit-presentation"]') as HTMLElement);
    expect(document.querySelector('[data-testid="app-root"], .app-root')).toBeTruthy();
  });

  it("DEAD-CODE: CostInflowColumns, CumulativeLine, and CoverageCurve are gone from the source", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/charts.tsx", "utf8");
    expect(src).not.toContain("CostInflowColumns");
    expect(src).not.toContain("CumulativeLine");
    expect(src).not.toContain("CoverageCurve");
  });
});

describe("v0.6.1 chunk 2 — the deck as the presentation of the worksuite", () => {
  const fixCPortfolio = (): ModelInputs => {
    const demo = demoProject();
    return {
      ...demo,
      repayment: { ...demo.repayment, termYears: 7, paymentsPerYear: 1 },
      contracts: [
        { id: "k1", label: "Anchor tenant", startYear: 4, termYears: 29, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "evaluated", evaluatedPayment: 1000000 },
        { id: "k2", label: "Top-up", startYear: 4, termYears: 3, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
      ],
    } as ModelInputs;
  };

  it("ONE-SOURCE: the deal slide reports the worksuite figures — achieved IRR, NPV at WACC, net gain, and the verdict; no second calculation", async () => {
    const { deckSlides } = await import("../src/deck.js");
    const { percentTwoForDisplay, deckMoneyForDisplay } = await import("../src/engine.js");
    const result = computeModel(fixCPortfolio());
    const deck = deckSlides(fixCPortfolio(), result, { startYear: null, entryUnit: "ones" });
    const deal = deck.slides[5];
    const irrTile = deal.tiles?.find((t) => t.label === "Achieved IRR");
    expect(irrTile?.value).toContain(percentTwoForDisplay(result.achievedIrr ?? 0));
    const npvTile = deal.tiles?.find((t) => t.label === "NPV at WACC");
    expect(npvTile?.value).toBe(deckMoneyForDisplay(result.npvAtWacc, "SEK", "ones"));
    const netTile = deal.tiles?.find((t) => t.label === "Net gain");
    expect(netTile?.value).toBe(deckMoneyForDisplay(result.netGain, "SEK", "ones"));
    expect(deal.verdict).toContain(result.goalMet ? "good deal" : "falls short");
    expect(result.achievedIrr).toBeCloseTo(0.120000000000001, 12);
  });

  it("SOLVER-ELEMENT: no solver element when the target is met (including solvedClamped); the element appears only when goalMet is false", async () => {
    const { deckSlides } = await import("../src/deck.js");
    const met = deckSlides(fixCPortfolio(), computeModel(fixCPortfolio()), { startYear: null, entryUnit: "ones" });
    expect(met.slides[5].solverScenario).toBeNull();
    const demo = demoProject();
    const below: ModelInputs = {
      ...demo,
      costs: [{ id: "c1", name: "Operations", category: "recurring", amount: 2000000, startYear: 1, durationYears: 10, escalation: 0 }],
      contracts: [{ id: "k1", label: "Anchor tenant", startYear: 2, termYears: 8, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "evaluated", evaluatedPayment: 1000000 }],
      targetIrr: 40,
    };
    const belowResult = computeModel(below);
    expect(belowResult.goalMet).toBe(false);
    const notMet = deckSlides(below, belowResult, { startYear: null, entryUnit: "ones" });
    expect(notMet.slides[5].solverScenario).not.toBeNull();
    expect(notMet.slides[5].solverScenario?.label).toBe("Scenario: what would we need to reach our target");
  });

  it("CLAMP-VERDICT: the solvedClamped target-exceeded case renders no solver element and the verdict is the honest one", async () => {
    const { deckSlides } = await import("../src/deck.js");
    const demo = demoProject();
    const clamped = { ...demo, appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { mode: "amount", amount: 100000000, year: 10 } } } as ModelInputs;
    const result = computeModel(clamped);
    expect(result.solvedClamped).toBe(true);
    expect(result.goalMet).toBe(true);
    const deck = deckSlides(clamped, result, { startYear: null, entryUnit: "ones" });
    expect(deck.slides[5].solverScenario).toBeNull();
  });

  it("TITLE-TERM: the Investment term metric reads the real horizon, not the dormant repayment block", async () => {
    const { deckSlides } = await import("../src/deck.js");
    const result = computeModel(fixCPortfolio());
    expect(result.horizon?.totalYears).toBeGreaterThan(7);
    const deck = deckSlides(fixCPortfolio(), result, { startYear: null, entryUnit: "ones" });
    const termMetric = deck.slides[0].titleMetrics?.find((m) => m.label === "Investment term");
    expect(termMetric?.value).toBe(`${result.horizon?.totalYears} years`);
  });

  it("DECK-CHART-CAP: the deck recovery bars cap at 15; the disposition disclosure joins the deal disclosures", async () => {
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 2; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const bars = document.querySelectorAll('[data-slide-name="recovery"] [data-recovery-column]');
    expect(bars.length).toBeLessThanOrEqual(15);
    for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const disclosure = Array.from(document.querySelectorAll('[data-slide-name="deal"] .warning')).map((el) => el.textContent);
    expect(disclosure.some((t) => t?.includes("Assumes sale at remaining book value"))).toBe(true);
  });

  it("NONE-NO-DISCLOSURE: the none posture renders no disclosure on any deck surface", async () => {
    const { deckSlides } = await import("../src/deck.js");
    const demo = demoProject();
    const noneCase = { ...demo, appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "none" as const, amount: 0, year: 10 } } } as ModelInputs;
    const result = computeModel(noneCase);
    expect(result.residualDisclosure).toBeNull();
    const deck = deckSlides(noneCase, result, { startYear: null, entryUnit: "ones" });
    const allDisclosures = deck.slides.flatMap((sl) => sl.disclosures);
    expect(allDisclosures.some((d) => d.includes("Assumes sale"))).toBe(false);
  });
});
