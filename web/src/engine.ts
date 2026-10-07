import { computeModel } from "../../core/src/engine.js";
import type { ModelInputs } from "../../core/src/types.js";

export { computeModel };
export type { ModelInputs };

export function roundForDisplay(value: number, digits: number = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}
