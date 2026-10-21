import type { CostLine, ModelInputs } from "../src/types.js";

// v0.6.12.2 — the shared fixtures of the directive (BASE, CAPEX-LUMP, CAPEX-PROFILE).
export const BASE = {
  projectName: "P",
  currency: "EUR",
  targetIrr: 8,
  repayment: { graceYears: 0, termYears: 5, paymentsPerYear: 1, paymentEscalation: 0, balloon: 0 },
};

export const capexLump = (amount: number): CostLine => ({ id: "c1", name: "Capex", category: "capex", amount, startYear: 1, durationYears: 1, escalation: 0 });
export const capexProfile = (overrides: Record<number, number>): CostLine => ({ id: "c1", name: "Capex", category: "capex", amount: 1, startYear: 1, durationYears: 1, escalation: 0, yearOverrides: overrides });

export function fixture(costs: CostLine[], extra: Partial<Omit<ModelInputs, "repayment">> & { repayment?: Partial<ModelInputs["repayment"]> } = {}): ModelInputs {
  const { repayment, ...rest } = extra;
  return { ...BASE, costs, ...rest, repayment: { ...BASE.repayment, ...(repayment ?? {}) } } as ModelInputs;
}
