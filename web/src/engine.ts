import { computeModel, solveTerm } from "../../core/src/engine.js";
import type { ModelInputs } from "../../core/src/types.js";

export { computeModel, solveTerm };
export type { ModelInputs };

export function roundForDisplay(value: number, digits: number = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export function percentForDisplay(rate: number | null, digits: number = 5): string {
  if (rate === null || !Number.isFinite(rate)) return "—";
  return roundForDisplay(rate * 100, digits) + "%";
}

export const CURRENCIES_ENUM = ["SEK", "EUR", "USD", "GBP", "NOK", "DKK"] as const;
export type CurrencyCode = (typeof CURRENCIES_ENUM)[number];

export type EntryUnit = "ones" | "thousands" | "millions";
export const ENTRY_UNITS: EntryUnit[] = ["ones", "thousands", "millions"];

export function unitFactor(unit: EntryUnit): number {
  return unit === "thousands" ? 1000 : unit === "millions" ? 1000000 : 1;
}

function groupIntegerString(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1e21) return String(Math.round(value));
  const big = BigInt(Math.trunc(value));
  return big.toString();
}

function noSciFormat(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e21) {
    const grouped = groupIntegerString(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return grouped;
  }
  return value.toFixed(digits);
}

export function moneyForDisplay(value: number, currency: CurrencyCode = "SEK", unit: EntryUnit = "ones"): string {
  const negative = value < 0;
  const factor = unitFactor(unit);
  const scaled = Math.abs(value) / factor;
  const body0 = noSciFormat(scaled, 2);
  const [intPart, decPart] = body0.includes(".") ? body0.split(".") : [body0, "00"];
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const body = `${grouped},${decPart}`;
  let token = "";
  if (unit === "thousands") token = " k";
  else if (unit === "millions") token = " M";
  if (currency === "SEK") {
    const sekToken = unit === "thousands" ? " tkr" : unit === "millions" ? " Mkr" : " kr";
    return negative ? `-${body}${sekToken}` : `${body}${sekToken}`;
  }
  const prefix =
    currency === "EUR" ? "€" :
    currency === "USD" ? "$" :
    currency === "GBP" ? "£" :
    currency === "NOK" ? "NOK " :
    "DKK ";
  const withCurrency = `${prefix}${body}${token}`;
  return negative ? `-${withCurrency}` : withCurrency;
}

export function entryToValue(entry: number, unit: EntryUnit): number {
  return entry * unitFactor(unit);
}

export function valueToEntry(value: number, unit: EntryUnit): number {
  return value / unitFactor(unit);
}


export function deckMoneyForDisplay(value: number, currency: CurrencyCode = "SEK", unit: EntryUnit = "ones"): string {
  const factor = unitFactor(unit);
  const scaled = Math.abs(value) / factor;
  const negative = value < 0;
  const body = noSciFormat(scaled, 0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  let token = "";
  if (unit === "thousands") token = " k";
  else if (unit === "millions") token = " M";
  if (currency === "SEK") {
    const sekToken = unit === "thousands" ? " tkr" : unit === "millions" ? " Mkr" : " kr";
    return negative ? `-${body}${sekToken}` : `${body}${sekToken}`;
  }
  const prefix =
    currency === "EUR" ? "\u20ac" :
    currency === "USD" ? "$" :
    currency === "GBP" ? "\u00a3" :
    currency === "NOK" ? "NOK " :
    "DKK ";
  const withCurrency = `${prefix}${body}${token}`;
  return negative ? `-${withCurrency}` : withCurrency;
}

export function deckYearsForDisplay(years: number): string {
  return roundForDisplay(years, 1).toFixed(1) + " years";
}

// v0.6.9 Task F (finding W28): the magnitude-aware fee display — a small value shows its
// euros and cents despite the entry-unit setting (the fee-class exemption, |value| < 1000);
// a coarse value takes the entry unit's form. The boundary is pinned: 15000 at entry
// millions renders "€0,0 M" (the honest coarse form — the exemption covers only |value| < 1000).
export function feeForDisplay(value: number, currency: CurrencyCode = "SEK", entryUnit: EntryUnit = "ones"): string {
  if (Math.abs(value) < 1000) {
    return moneyForDisplay(value, currency, "ones");
  }
  if (entryUnit === "millions") {
    const scaled = Math.abs(value) / 1000000;
    const body = scaled.toFixed(1).replace(".", ",");
    const negative = value < 0 ? "-" : "";
    if (currency === "SEK") return `${negative}${body} Mkr`;
    const prefix =
      currency === "EUR" ? "\u20ac" :
      currency === "USD" ? "$" :
      currency === "GBP" ? "\u00a3" :
      currency === "NOK" ? "NOK " :
      "DKK ";
    return `${negative}${prefix}${body} M`;
  }
  if (entryUnit === "thousands") {
    return deckMoneyForDisplay(value, currency, "thousands");
  }
  return deckMoneyForDisplay(value, currency, "ones");
}

// v0.6.10 Task E.3 (W20): the unit-price exemption extends the fee class — a unit price
// renders at unit ones with the currency form (two decimals, grouped), never the entry-unit
// collapse. Pinned: 7108.4140139564915 renders "€7 108,41"; 40141.63207881312 "€40 141,63";
// 29162.724159821497 "€29 162,72".
export function unitPriceForDisplay(value: number, currency: CurrencyCode = "SEK"): string {
  return moneyForDisplay(value, currency, "ones");
}

// v0.6.10 Task G.1: the one-decimal comma percent (the grant intensity 38,6%); the standing
// percent forms keep the dot convention (disclosed in the completion report).
export function percentOneForDisplay(rate: number): string {
  return roundForDisplay(rate * 100, 1).toFixed(1).replace(".", ",") + "%";
}

export function percentTwoForDisplay(rate: number): string {
  return roundForDisplay(rate * 100, 2).toFixed(2) + "%";
}

export function yearsTwoForDisplay(years: number): string {
  return roundForDisplay(years, 2).toFixed(2) + " years";
}

export function dscrTwoForDisplay(value: number): string {
  return roundForDisplay(value, 2).toFixed(2);
}

export const VERSION = "v0.6.13.4";
