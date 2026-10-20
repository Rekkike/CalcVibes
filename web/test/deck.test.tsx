import { describe, expect, it } from "vitest";
import { deckSlides } from "../src/deck.js";
import { computeModel, deckMoneyForDisplay, deckYearsForDisplay } from "../src/engine.js";
import { demoProject } from "../src/state.js";
import type { FinancingConfig, TariffRow } from "../../core/src/types.js";

const fin = (over: Partial<FinancingConfig> = {}): FinancingConfig => ({
  enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0,
  serviceStartYear: null, amortization: "annuity", leveragedSolve: false, perLineSharePct: {}, ...over,
});
const rows: TariffRow[] = [
  { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] },
  { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] },
];

describe("EX-1 deck content model (base demo, tariff off, financing off, SEK)", () => {
  const result = computeModel(demoProject());
  const deck = deckSlides(demoProject(), result);

  it("structural pins: seven slides with the names of record (the summary slide per v0.6.4)", () => {
    expect(deck.slides.length).toBe(7);
    expect(deck.slides.map((s) => s.name)).toEqual(["title", "summary", "investment", "recovery", "coverage", "returns", "deal"]);
  });

  it("exact title pins (v0.6.4 board-room headlines)", () => {
    expect(deck.slides[1].title).toBe("Executive summary");
    expect(deck.slides[2].title).toBe("The investment");
    expect(deck.slides[3].title).toBe("The recovery — solved payments");
    expect(deck.slides[5].title).toBe("The returns");
    expect(deck.slides[6].title).toBe("The deal");
  });

  it("slide 0 subtitle chip removed per v0.6.1 2.3; the title carries the project name and the target", () => {
    expect(deck.slides[0].body).toEqual([]);
    expect(deck.slides[0].title).toBe(demoProject().projectName);
    const targetMetric = deck.slides[0].titleMetrics?.find((m) => m.label === "Target IRR");
    expect(targetMetric?.value).toBe("12.00%");
  });

  it("traceability: every money body figure equals its engine field (the anti-hardcode control)", () => {
    const investment = deck.slides[2].body;
    const totalCostFigure = investment.find((f) => f.label === "Total cost (nominal)")!;
    expect(totalCostFigure.rawValue).toBe(result.totalCost);
    const costNpvFigure = investment.find((f) => f.label === "Cost NPV at target (discounted)")!;
    expect(costNpvFigure.rawValue).toBe(result.costNpv);
    const chartData = deck.slides[2].chart?.data ?? [];
    expect(chartData.length).toBe(result.lineTotals.length);
    for (const lt of result.lineTotals) {
      const bar = chartData.find((d) => d.label === lt.name)!;
      expect(bar.value).toBe(lt.total);
    }
    const recovery = deck.slides[3].body;
    expect(recovery.find((f) => f.label === "Payment per period")!.rawValue).toBe(result.paymentAmount);
    expect(recovery.find((f) => f.label === "Total collected (nominal)")!.rawValue).toBe(result.totalCollected);
    const coverage = deck.slides[4].body;
    expect(coverage.find((f) => f.label === "Nominal payback")!.rawValue).toBe(result.paybackYears);
    const returns = deck.slides[5].body;
    expect(returns.find((f) => f.label === "Achieved IRR")!.rawValue).toBe(result.achievedIrr);
    expect(returns.find((f) => f.label === "NPV at WACC (discounted)")!.rawValue).toBe(result.npvAtWacc);
    const dealTiles = deck.slides[6].tiles ?? [];
    expect(dealTiles.length).toBe(6);
    expect(dealTiles.find((t) => t.label === "Payback (nominal)")!.rawValue).toBe(result.paybackYears);
  });
});

describe("EX-1 financing-on variant (the FN-1 configuration)", () => {
  const inputs = { ...demoProject(), financing: fin() };
  const result = computeModel(inputs);
  const deck = deckSlides(inputs, result);

  it("slide 6 title and tile pins (the financing fold extends the grid to nine tiles)", () => {
    expect(deck.slides[6].title).toBe("The deal — equity view");
    const tiles = deck.slides[6].tiles ?? [];
    const byLabel = (label: string) => tiles.find((t) => t.label === label);
    expect(tiles.length).toBe(9);
    expect(byLabel("Total cost")?.value).toBe(deckMoneyForDisplay(result.totalCost, "SEK", "ones"));
    expect(byLabel("Net gain")?.value).toBe(deckMoneyForDisplay(result.netGain, "SEK", "ones"));
    expect(byLabel("NPV at WACC")?.value).toBe(deckMoneyForDisplay(result.npvAtWacc, "SEK", "ones"));
  });

  it("the financing variant keeps its DSCR among the deal disclosures and the equity metrics reach the tiles", () => {
    const tiles = deck.slides[6].tiles ?? [];
    expect(tiles.find((t) => t.label === "Payback (nominal)")?.value).toBe(deckYearsForDisplay(result.paybackYears as number));
    expect(deck.slides[6].disclosures.join(" ")).toContain("56 sign changes");
    expect(deck.slides[6].summaryCharts?.length).toBe(2);
  });

  it("the ambiguity disclosure carries the count 56", () => {
    expect(deck.slides[6].disclosures.join(" ")).toContain("56 sign changes");
  });

  it("traceability on the financing variant (the equity figures reach the verdict and the tile grid)", () => {
    expect(deck.slides[6].title).toBe("The deal — equity view");
    expect(deck.slides[6].verdict).toContain("20.01%");
    expect(deck.slides[6].tiles?.find((t) => t.label === "NPV at WACC")?.value).toBe(deckMoneyForDisplay(result.npvAtWacc, "SEK", "ones"));
  });

  it("share-100 variant: the zero-outlay note replaces the equity IRR figure", () => {
    const inputs100 = { ...demoProject(), financing: fin({ sharePct: 100 }) };
    const result100 = computeModel(inputs100);
    const deck100 = deckSlides(inputs100, result100);
    expect(deck100.slides[6].title).toBe("The deal — equity view");
    expect(deck100.slides[6].verdict).toContain("not applicable");
    expect(deck100.slides[6].tiles?.find((t) => t.label === "Equity IRR")?.value).toBe("not applicable (zero equity outlay)");
  });
});

describe("EX-1 stable-tariff variant (the golden stable configuration)", () => {
  const inputs = { ...demoProject(), tariff: { mode: "stable" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } };
  const result = computeModel(inputs);
  const deck = deckSlides(inputs, result);

  it("recovery slide title pin", () => {
    expect(deck.slides[3].title).toBe("The recovery — a stable tariff");
  });

  it("traceability on the stable variant", () => {
    expect(deck.slides[3].body.find((f) => f.label === "Base price (first grid year terms)")!.rawValue).toBe(result.tariffBaseUnitPrice);
  });
});

describe("EX-1 variant titles (structural)", () => {
  it("decompose, manual, fixed titles of record", () => {
    const decInputs = { ...demoProject(), tariff: { mode: "decompose" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } };
    // v0.6.12 Task C re-anchor (Round 46 Supplement 12): no priceUnitLabel is declared, so the unit-free fallback.
    expect(deckSlides(decInputs, computeModel(decInputs)).slides[3].title).toBe("The recovery — the tariff");
    const prices = computeModel({ ...demoProject(), tariff: { mode: "stable" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } }).tariffYears.map((y) => y.unitPrice as number);
    const manInputs = { ...demoProject(), tariff: { mode: "manual" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: prices } };
    expect(deckSlides(manInputs, computeModel(manInputs)).slides[3].title).toBe("The recovery — evaluated, not solved");
    const fixInputs = { ...demoProject(), tariff: { mode: "fixed" as const, escalationPerYear: 2, rows, fixedAnnualAmount: 600000, manualPrices: null } };
    expect(deckSlides(fixInputs, computeModel(fixInputs)).slides[3].title).toBe("The recovery — evaluated, not solved");
  });
});

describe("EX-1 red proofs (input-level perturbations)", () => {
  it("a cost amount shift 1,800,000 -> 1,900,000 flips the investment body figure", () => {
    const shifted = { ...demoProject(), costs: demoProject().costs.map((c) => (c.id === "c1" ? { ...c, amount: 1900000 } : c)) };
    const r = computeModel(shifted);
    const d = deckSlides(shifted, r);
    const fig = d.slides[2].body.find((f) => f.label === "Total cost (nominal)")!;
    expect(fig.rawValue).toBe(r.totalCost);
    expect(fig.value).not.toBe(deckMoneyForDisplay(computeModel(demoProject()).totalCost, "SEK", "ones"));
    expect(fig.value).toBe(deckMoneyForDisplay(r.totalCost, "SEK", "ones"));
  });

  it("the target 12 -> 13 flips the title metric and the deal IRR tile", () => {
    const shifted = { ...demoProject(), targetIrr: 13 };
    const r = computeModel(shifted);
    const d = deckSlides(shifted, r);
    expect(d.slides[0].titleMetrics?.find((m) => m.label === "Target IRR")?.value).toBe("13.00%");
    expect(d.slides[5].body.find((f) => f.label === "Achieved IRR")!.value).toBe("13.00%");
    expect(d.slides[6].tiles?.find((t) => t.label === "Achieved IRR")?.value).toContain("13.00% target");
  });

  it("the debt share 60 -> 65 flips the deal equity IRR tile", () => {
    const inputs = { ...demoProject(), financing: fin({ sharePct: 65 }) };
    const r = computeModel(inputs);
    const d = deckSlides(inputs, r);
    const eqTile = d.slides[6].tiles?.find((t) => t.label === "Equity IRR");
    expect(eqTile?.rawValue).toBe(r.financing!.equity.irr);
    expect(eqTile?.value).not.toBe("20.01%");
  });

  it("the currency SEK -> EUR flips every money string", () => {
    const shifted = { ...demoProject(), currency: "EUR" };
    const r = computeModel(shifted);
    const d = deckSlides(shifted, r);
    expect(d.slides[2].body.find((f) => f.label === "Total cost (nominal)")!.value).toBe(deckMoneyForDisplay(r.totalCost, "EUR", "ones"));
  });
});
