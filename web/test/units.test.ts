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

  it("the deck figures re-anchor at the template's thousands default through the deck display class", () => {
    expect(deck.slides[1].title).toBe("Executive summary");
    expect(deck.slides[2].title).toBe("The investment");
    expect(deck.slides[3].title).toBe("The recovery — solved payments");
    expect(deck.slides[2].body.find((f) => f.label === "Total cost (nominal)")!.value).toBe(deckMoneyForDisplay(result.totalCost, "SEK", "thousands"));
    // v0.6.8 Task B: the fee-class figures close at the ones formatter — the payment
    // reads as money, not as a scaled unit figure.
    expect(deck.slides[3].body.find((f) => f.label === "Payment per period")!.value).toBe(moneyForDisplay(result.paymentAmount as number, "SEK", "ones"));
    expect(deck.slides[6].tiles?.find((t) => t.label === "Total collected")?.value).toBe(deckMoneyForDisplay(result.totalCollected, "SEK", "thousands"));
  });

  it("the financing variant at thousands", () => {
    const finInputs = { ...demoProject(), financing: { enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0, serviceStartYear: null, amortization: "annuity" as const, leveragedSolve: false, perLineSharePct: {} } };
    const finResult = computeModel(finInputs);
    const finDeck = deckSlides(finInputs, finResult, { startYear: null, entryUnit: "thousands" });
    expect(finDeck.slides[6].title).toBe("The deal — equity view");
    expect(finDeck.slides[6].verdict).toContain(deckMoneyForDisplay(finResult.financing!.equity.outlay, "SEK", "thousands"));
  });

  it("the stable variant at thousands", () => {
    const rows = [
      { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] },
      { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] },
    ];
    const stInputs = { ...demoProject(), tariff: { mode: "stable" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } };
    const stResult = computeModel(stInputs);
    const stDeck = deckSlides(stInputs, stResult, { startYear: null, entryUnit: "thousands" });
    expect(stDeck.slides[3].title).toBe("The recovery — a stable tariff");
    // v0.6.8 Task B: the stable base price is a fee-class figure at the ones formatter.
    expect(stDeck.slides[3].body.find((f) => f.label === "Base price (first grid year terms)")!.value).toBe(moneyForDisplay(stResult.tariffBaseUnitPrice as number, "SEK", "ones"));
  });

  it("the profile branch title", () => {
    const pInputs = { ...demoProject(), repayment: { ...demoProject().repayment, collectionsOverrides: { 3: 1000000, 4: 2000000 } } };
    const pResult = computeModel(pInputs);
    const pDeck = deckSlides(pInputs, pResult, { startYear: null, entryUnit: "thousands" });
    expect(pDeck.slides[3].title).toBe("The recovery — evaluated, not solved");
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
