import { describe, expect, it } from "vitest";
import { moneyForDisplay, entryToValue, valueToEntry, deckMoneyForDisplay, type EntryUnit } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import { computeModel } from "../src/engine.js";
import { demoProject } from "../src/state.js";

describe("UNIT-ONES (regression: every existing EX-2 string byte-unchanged)", () => {
  it("ones renders the standing strings", () => {
    expect(moneyForDisplay(475309.13407)).toBe("475 309,13 kr");
    expect(moneyForDisplay(475309.13407, "EUR")).toBe("€475 309,13");
    expect(moneyForDisplay(7849860)).toBe("7 849 860,00 kr");
    expect(moneyForDisplay(-4151490.85)).toBe("-4 151 490,85 kr");
  });
});

describe("UNIT-SEK-T (thousands)", () => {
  it("the tkr tokens pinned", () => {
    expect(moneyForDisplay(475309.13407, "SEK", "thousands")).toBe("475,31 tkr");
    expect(moneyForDisplay(7849860, "SEK", "thousands")).toBe("7 849,86 tkr");
    expect(moneyForDisplay(13308655.75, "SEK", "thousands")).toBe("13 308,66 tkr");
    expect(moneyForDisplay(6632597.98344, "SEK", "thousands")).toBe("6 632,60 tkr");
    expect(moneyForDisplay(1204.2392789, "SEK", "thousands")).toBe("1,20 tkr");
    expect(moneyForDisplay(-4151490.85, "SEK", "thousands")).toBe("-4 151,49 tkr");
  });
});

describe("UNIT-SEK-M (millions)", () => {
  it("the Mkr tokens pinned", () => {
    expect(moneyForDisplay(7849860, "SEK", "millions")).toBe("7,85 Mkr");
    expect(moneyForDisplay(475309.13407, "SEK", "millions")).toBe("0,48 Mkr");
  });
});

describe("UNIT-CROSS", () => {
  it("EUR/USD/GBP/NOK/DKK thousands and millions pinned", () => {
    expect(moneyForDisplay(475309.13407, "EUR", "thousands")).toBe("€475,31 k");
    expect(moneyForDisplay(475309.13407, "USD", "thousands")).toBe("$475,31 k");
    expect(moneyForDisplay(475309.13407, "GBP", "thousands")).toBe("£475,31 k");
    expect(moneyForDisplay(475309.13407, "NOK", "thousands")).toBe("NOK 475,31 k");
    expect(moneyForDisplay(475309.13407, "DKK", "thousands")).toBe("DKK 475,31 k");
    expect(moneyForDisplay(475309.13407, "EUR", "millions")).toBe("€0,48 M");
  });
});

describe("UNIT-DECK (the template demo at thousands — the authorized re-anchor)", () => {
  const result = computeModel(demoProject());
  const deck = deckSlides(demoProject(), result, { startYear: null, entryUnit: "thousands" });

  it("the deck titles re-anchor at the template's thousands default through the deck display class", () => {
    expect(deck.slides[1].title).toBe(`We invest ${deckMoneyForDisplay(result.totalCost, "SEK", "thousands")} nominal across 3 cost lines`);
    expect(deck.slides[2].title).toBe(`${result.paymentCount} payments of ${deckMoneyForDisplay(result.paymentAmount as number, "SEK", "thousands")} recover the full requirement`);
    expect(deck.slides[4].title).toBe(`The deal in one view — ${deckMoneyForDisplay(result.totalCost, "SEK", "thousands")} in, ${deckMoneyForDisplay(result.totalCollected, "SEK", "thousands")} back`);
  });

  it("the financing variant at thousands", () => {
    const finInputs = { ...demoProject(), financing: { enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0, serviceStartYear: null, amortization: "annuity" as const, leveragedSolve: false, perLineSharePct: {} } };
    const finResult = computeModel(finInputs);
    const finDeck = deckSlides(finInputs, finResult, { startYear: null, entryUnit: "thousands" });
    expect(finDeck.slides[4].title).toBe(`Equity earns 20.01% on ${deckMoneyForDisplay(finResult.financing!.equity.outlay, "SEK", "thousands")} outlaid`);
  });

  it("the stable variant at thousands", () => {
    const rows = [
      { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] },
      { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] },
    ];
    const stInputs = { ...demoProject(), tariff: { mode: "stable" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } };
    const stResult = computeModel(stInputs);
    const stDeck = deckSlides(stInputs, stResult, { startYear: null, entryUnit: "thousands" });
    expect(stDeck.slides[2].title).toBe(`A stable tariff of ${deckMoneyForDisplay(stResult.tariffBaseUnitPrice as number, "SEK", "thousands")} per weighted lift recovers the full requirement`);
  });

  it("the profile branch title", () => {
    const pInputs = { ...demoProject(), repayment: { ...demoProject().repayment, collectionsOverrides: { 3: 1000000, 4: 2000000 } } };
    const pResult = computeModel(pInputs);
    const pDeck = deckSlides(pInputs, pResult, { startYear: null, entryUnit: "thousands" });
    expect(pDeck.slides[2].title).toBe("A per-year collections profile — evaluated, not solved");
  });
});

describe("UNIT-ENTRY (the conversion identity at full precision)", () => {
  it("value -> entry display -> state == value, and the reverse", () => {
    for (const unit of ["ones", "thousands", "millions"] as EntryUnit[]) {
      for (const v of [475309.13407, 7849860, 1234.5]) {
        const entry = valueToEntry(v, unit);
        const back = entryToValue(entry, unit);
        expect(Math.abs(back - v)).toBeLessThan(1e-9);
      }
    }
  });
});
