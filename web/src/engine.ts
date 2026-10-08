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

export function moneyForDisplay(value: number, currency: CurrencyCode = "SEK"): string {
  const negative = value < 0;
  const abs = roundForDisplay(Math.abs(value));
  const [intPart, decPart] = abs.toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const body = `${grouped},${decPart}`;
  const withCurrency =
    currency === "SEK" ? `${body} kr` :
    currency === "EUR" ? `€${body}` :
    currency === "USD" ? `$${body}` :
    currency === "GBP" ? `£${body}` :
    currency === "NOK" ? `NOK ${body}` :
    `DKK ${body}`;
  return negative ? `-${withCurrency}` : withCurrency;
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
