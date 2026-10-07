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
