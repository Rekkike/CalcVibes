import { describe, expect, it } from "vitest";
import { moneyForDisplay, percentTwoForDisplay, yearsTwoForDisplay, dscrTwoForDisplay } from "../src/engine.js";

describe("EX-2 moneyForDisplay (script-verified exact strings)", () => {
  it("SEK conventions: space grouping, decimal comma, two decimals, kr suffix", () => {
    expect(moneyForDisplay(475309.13407)).toBe("475 309,13 kr");
    expect(moneyForDisplay(13308655.75)).toBe("13 308 655,75 kr");
    expect(moneyForDisplay(7849860)).toBe("7 849 860,00 kr");
    expect(moneyForDisplay(6632597.98344)).toBe("6 632 597,98 kr");
    expect(moneyForDisplay(1593384.30133)).toBe("1 593 384,30 kr");
    expect(moneyForDisplay(5163129.98445)).toBe("5 163 129,98 kr");
    expect(moneyForDisplay(4709916)).toBe("4 709 916,00 kr");
    expect(moneyForDisplay(3139944)).toBe("3 139 944,00 kr");
    expect(moneyForDisplay(75033.07966)).toBe("75 033,08 kr");
    expect(moneyForDisplay(1041.3509366)).toBe("1 041,35 kr");
    expect(moneyForDisplay(1204.2392789)).toBe("1 204,24 kr");
    expect(moneyForDisplay(11508494.51)).toBe("11 508 494,51 kr");
    expect(moneyForDisplay(-4151490.85)).toBe("-4 151 490,85 kr");
  });

  it("EUR prefix convention", () => {
    expect(moneyForDisplay(475309.13407, "EUR")).toBe("€475 309,13");
  });

  it("USD, GBP, NOK, DKK follow the rule", () => {
    expect(moneyForDisplay(1234.56, "USD")).toBe("$1 234,56");
    expect(moneyForDisplay(1234.56, "GBP")).toBe("£1 234,56");
    expect(moneyForDisplay(1234.56, "NOK")).toBe("NOK 1 234,56");
    expect(moneyForDisplay(1234.56, "DKK")).toBe("DKK 1 234,56");
  });
});

describe("EX-2 deck non-money formats (standing point convention)", () => {
  it("percent two decimals", () => {
    expect(percentTwoForDisplay(0.12)).toBe("12.00%");
    expect(percentTwoForDisplay(0.2000612172)).toBe("20.01%");
    expect(percentTwoForDisplay(0.08459148)).toBe("8.46%");
  });

  it("years and DSCR two decimals", () => {
    expect(yearsTwoForDisplay(5.7317471844)).toBe("5.73 years");
    expect(dscrTwoForDisplay(1.5836652855)).toBe("1.58");
  });
});
