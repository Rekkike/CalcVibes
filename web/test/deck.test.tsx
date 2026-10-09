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

  it("structural pins: six slides with the names of record (the coverage slide per v0.5.8)", () => {
    expect(deck.slides.length).toBe(6);
    expect(deck.slides.map((s) => s.name)).toEqual(["title", "investment", "recovery", "coverage", "returns", "deal"]);
  });

  it("exact title pins", () => {
    expect(deck.slides[1].title).toBe(`We invest ${deckMoneyForDisplay(result.totalCost, "SEK", "ones")} nominal across 3 cost lines`);
    expect(deck.slides[2].title).toBe(`${result.paymentCount} payments of ${deckMoneyForDisplay(result.paymentAmount as number, "SEK", "ones")} recover the full requirement`);
    expect(deck.slides[4].title).toBe("The project earns 12.00% against the 12.00% target");
    expect(deck.slides[5].title).toBe(`The deal in one view — ${deckMoneyForDisplay(result.totalCost, "SEK", "ones")} in, ${deckMoneyForDisplay(result.totalCollected, "SEK", "ones")} back`);
  });

  it("slide 0 subtitle chip removed per v0.6.1 2.3; the title carries the project name and the target", () => {
    expect(deck.slides[0].body).toEqual([]);
    expect(deck.slides[0].title).toBe(demoProject().projectName);
    const targetMetric = deck.slides[0].titleMetrics?.find((m) => m.label === "Target IRR");
    expect(targetMetric?.value).toBe("12.00%");
  });

  it("traceability: every money body figure equals its engine field (the anti-hardcode control)", () => {
    const investment = deck.slides[1].body;
    const totalCostFigure = investment.find((f) => f.label === "Total cost (nominal)")!;
    expect(totalCostFigure.rawValue).toBe(result.totalCost);
    const costNpvFigure = investment.find((f) => f.label === "Cost NPV at target (discounted)")!;
    expect(costNpvFigure.rawValue).toBe(result.costNpv);
    for (const lt of result.lineTotals) {
      const fig = investment.find((f) => f.label === lt.name)!;
      expect(fig.rawValue).toBe(lt.total);
    }
    const recovery = deck.slides[2].body;
    expect(recovery.find((f) => f.label === "Payment per period")!.rawValue).toBe(result.paymentAmount);
    expect(recovery.find((f) => f.label === "Total collected (nominal)")!.rawValue).toBe(result.totalCollected);
    const returns = deck.slides[4].body;
    expect(returns.find((f) => f.label === "Achieved IRR")!.rawValue).toBe(result.achievedIrr);
    expect(returns.find((f) => f.label === "NPV at WACC (discounted)")!.rawValue).toBe(result.npvAtWacc);
    expect(returns.find((f) => f.label === "Payback (nominal)")!.rawValue).toBe(result.paybackYears);
    const dealTiles = deck.slides[5].tiles ?? [];
    expect(dealTiles.length).toBe(10);
  });
});

describe("EX-1 financing-on variant (the FN-1 configuration)", () => {
  const inputs = { ...demoProject(), financing: fin() };
  const result = computeModel(inputs);
  const deck = deckSlides(inputs, result);

  it("slide 4 title and tile pins (the financing fold extends the grid to fifteen tiles)", () => {
    expect(deck.slides[5].title).toBe(`Equity earns ${(result.financing!.equity.irr! * 100).toFixed(2)}% on ${deckMoneyForDisplay(result.financing!.equity.outlay, "SEK", "ones")} outlaid`);
    const tiles = deck.slides[5].tiles ?? [];
    const byLabel = (label: string) => tiles.find((t) => t.label === label);
    expect(tiles.length).toBe(15);
    expect(byLabel("Total cost")?.value).toBe(deckMoneyForDisplay(result.totalCost, "SEK", "ones"));
    expect(byLabel("Net gain")?.value).toBe(deckMoneyForDisplay(result.netGain, "SEK", "ones"));
    expect(byLabel("NPV at WACC")?.value).toBe(deckMoneyForDisplay(result.npvAtWacc, "SEK", "ones"));
  });

  it("the financing variant keeps its DSCR among the deal disclosures and the equity metrics reach the tiles", () => {
    const tiles = deck.slides[5].tiles ?? [];
    expect(tiles.find((t) => t.label === "Payback (nominal)")?.value).toBe(deckYearsForDisplay(result.paybackYears as number));
    expect(deck.slides[5].disclosures.join(" ")).toContain("56 sign changes");
    expect(deck.slides[5].summaryCharts?.length).toBe(2);
  });

  it("the ambiguity disclosure carries the count 56", () => {
    expect(deck.slides[5].disclosures.join(" ")).toContain("56 sign changes");
  });

  it("traceability on the financing variant (the equity figures reach the verdict and the tile grid)", () => {
    expect(deck.slides[5].title).toContain(deckMoneyForDisplay(result.financing!.equity.outlay, "SEK", "ones"));
    expect(deck.slides[5].verdict).toContain("20.01%");
    expect(deck.slides[5].tiles?.find((t) => t.label === "NPV at WACC")?.value).toBe(deckMoneyForDisplay(result.npvAtWacc, "SEK", "ones"));
  });

  it("share-100 variant: the zero-outlay note replaces the equity IRR figure", () => {
    const inputs100 = { ...demoProject(), financing: fin({ sharePct: 100 }) };
    const result100 = computeModel(inputs100);
    const deck100 = deckSlides(inputs100, result100);
    expect(deck100.slides[5].title).toBe(`Equity earns nothing on ${deckMoneyForDisplay(0, "SEK", "ones")} outlaid`);
    expect(deck100.slides[5].verdict).toContain("This is a good deal");
  });
});

describe("EX-1 stable-tariff variant (the golden stable configuration)", () => {
  const inputs = { ...demoProject(), tariff: { mode: "stable" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } };
  const result = computeModel(inputs);
  const deck = deckSlides(inputs, result);

  it("slide 2 title pin", () => {
    expect(deck.slides[2].title).toBe(`A stable tariff of ${deckMoneyForDisplay(result.tariffBaseUnitPrice as number, "SEK", "ones")} per weighted lift recovers the full requirement`);
  });

  it("traceability on the stable variant", () => {
    expect(deck.slides[2].body.find((f) => f.label === "Base price (first grid year terms)")!.rawValue).toBe(result.tariffBaseUnitPrice);
  });
});

describe("EX-1 variant titles (structural)", () => {
  it("decompose, manual, fixed titles of record", () => {
    const decInputs = { ...demoProject(), tariff: { mode: "decompose" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } };
    expect(deckSlides(decInputs, computeModel(decInputs)).slides[2].title).toBe("Per-lift prices recover the requirement year by year");
    const prices = computeModel({ ...demoProject(), tariff: { mode: "stable" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } }).tariffYears.map((y) => y.unitPrice as number);
    const manInputs = { ...demoProject(), tariff: { mode: "manual" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: prices } };
    expect(deckSlides(manInputs, computeModel(manInputs)).slides[2].title).toBe("Manual per-year prices — evaluated, not solved");
    const fixInputs = { ...demoProject(), tariff: { mode: "fixed" as const, escalationPerYear: 2, rows, fixedAnnualAmount: 600000, manualPrices: null } };
    expect(deckSlides(fixInputs, computeModel(fixInputs)).slides[2].title).toBe("A fixed amount per year — evaluated, not solved");
  });
});

describe("EX-1 red proofs (input-level perturbations)", () => {
  it("a cost amount shift 1,800,000 -> 1,900,000 flips the slide-1 title", () => {
    const shifted = { ...demoProject(), costs: demoProject().costs.map((c) => (c.id === "c1" ? { ...c, amount: 1900000 } : c)) };
    const r = computeModel(shifted);
    const d = deckSlides(shifted, r);
    expect(d.slides[1].title).toBe(`We invest ${deckMoneyForDisplay(r.totalCost, "SEK", "ones")} nominal across 3 cost lines`);
  });

  it("the target 12 -> 13 flips the slide-0 subtitle and the slide-3 title", () => {
    const shifted = { ...demoProject(), targetIrr: 13 };
    const r = computeModel(shifted);
    const d = deckSlides(shifted, r);
    expect(d.slides[0].titleMetrics?.find((m) => m.label === "Target IRR")?.value).toBe("13.00%");
    expect(d.slides[4].title).toContain("13.00% target");
  });

  it("the debt share 60 -> 65 flips the slide-4 financing title", () => {
    const inputs = { ...demoProject(), financing: fin({ sharePct: 65 }) };
    const r = computeModel(inputs);
    const d = deckSlides(inputs, r);
    expect(d.slides[5].title).not.toBe(`Equity earns 20.01% on ${deckMoneyForDisplay(3139944, "SEK", "ones")} outlaid`);
  });

  it("the currency SEK -> EUR flips every money string", () => {
    const shifted = { ...demoProject(), currency: "EUR" };
    const r = computeModel(shifted);
    const d = deckSlides(shifted, r);
    expect(d.slides[1].title).toBe(`We invest ${deckMoneyForDisplay(r.totalCost, "EUR", "ones")} nominal across 3 cost lines`);
  });
});
