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

export function moneyForDisplay(value: number, currency: CurrencyCode = "SEK", unit: EntryUnit = "ones"): string {
  const negative = value < 0;
  const factor = unitFactor(unit);
  const scaled = Math.abs(value) / factor;
  const abs = roundForDisplay(scaled);
  const [intPart, decPart] = abs.toFixed(2).split(".");
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
  const rounded = roundForDisplay(scaled, 0);
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const body = grouped;
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

export function percentTwoForDisplay(rate: number): string {
  return roundForDisplay(rate * 100, 2).toFixed(2) + "%";
}

export function yearsTwoForDisplay(years: number): string {
  return roundForDisplay(years, 2).toFixed(2) + " years";
}

export function dscrTwoForDisplay(value: number): string {
  return roundForDisplay(value, 2).toFixed(2);
}

export const VERSION = "v0.6R";
