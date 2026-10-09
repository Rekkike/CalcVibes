import type { ContractParams, CostLine, MaintenanceConfig, ModelInputs, OperatingLine } from "../../core/src/types.js";
import templateFile from "../../data/template-project.json";

export const CURRENCIES = ["EUR", "USD", "GBP", "SEK", "NOK", "DKK"] as const;

export function blankProject(): ModelInputs {
  return {
    projectName: "",
    currency: "SEK",
    entryUnit: "thousands",
    targetIrr: 12,
    costs: [],
    repayment: { graceYears: 0, termYears: 7, paymentsPerYear: 1, paymentEscalation: 0, balloon: 0 },
  };
}

export interface ProjectSettings {
  startYear: number | null;
  currency?: string;
  scenarioTargets?: number[];
  scenarioTerms?: number[];
  scenarioBalloons?: number[];
}

export function spreadFill(total: number, firstYear: number, yearCount: number): Record<number, number> {
  const fill: Record<number, number> = {};
  if (yearCount <= 0) return fill;
  const base = total / yearCount;
  for (let k = 0; k < yearCount - 1; k++) {
    fill[firstYear + k] = base;
  }
  let assigned = 0;
  for (const v of Object.values(fill)) assigned += v;
  fill[firstYear + yearCount - 1] = total - assigned;
  return fill;
}

export function blankOperatingLine(id: string): OperatingLine {
  return { id, label: "", amount: 0, startYear: 1, yearCount: 1, escalation: 0 };
}

export function nextOperatingId(lines: OperatingLine[]): string {
  return "o" + (lines.length + 1);
}

export function yearHeader(k: number, startYear: number | null): string {
  return startYear === null ? "Year " + k : String(startYear + k - 1);
}

export function demoProject(): ModelInputs {
  return {
    projectName: templateFile.projectName,
    currency: ((templateFile as { settings?: { currency?: string } }).settings?.currency ?? (templateFile as { currency?: string }).currency ?? "SEK"),
    targetIrr: templateFile.targetIrr,
    costs: templateFile.costs.map((c) => ({
      ...c,
      category: c.category as CostLine["category"],
    })),
    repayment: { ...templateFile.repayment },
    operatingLines: templateFile.operatingLines ?? [],
    maintenance: ((m: { mode: string; percentPerYear?: number; fixedAnnualAmount?: number }): MaintenanceConfig =>
      m.mode === "percent" ? { mode: "percent", percentPerYear: m.percentPerYear } :
      m.mode === "fixed" ? { mode: "fixed", fixedAnnualAmount: m.fixedAnnualAmount } :
      { mode: "off" })(templateFile.maintenance ?? { mode: "off" }),
  };
}

export function multiLeaseProject(): ModelInputs {
  return {
    projectName: "Multi-lease example",
    currency: "SEK",
    entryUnit: "ones",
    targetIrr: 8,
    costs: [
      { id: "c1", name: "Depreciable assets", category: "capex", amount: 20000000, startYear: 1, durationYears: 1, escalation: 0, depreciation: { mode: "straight-line", years: 33 } },
      { id: "c2", name: "Retained assets (land and buildings)", category: "capex", amount: 80000000, startYear: 1, durationYears: 1, escalation: 0, depreciation: { mode: "retained" } },
      { id: "c3", name: "Build (3-year program)", category: "recurring", amount: 5000000, startYear: 1, durationYears: 3, escalation: 0 },
    ],
    repayment: { graceYears: 0, termYears: 15, paymentsPerYear: 1, paymentEscalation: 0, balloon: 0 },
    contracts: [
      { id: "k1", label: "Contract one", startYear: 4, termYears: 15, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved", reinvestments: [{ year: 4, amount: 3000000 }] },
      { id: "k2", label: "Contract two", startYear: 19, termYears: 15, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
      { id: "k3", label: "Lease three", startYear: 34, termYears: 20, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
    ],
    appraisal: { wacc: 6, financeRate: 5, reinvestmentRate: 5, residual: { mode: "calculated", amount: 0, year: 54 } },
  };
}

export function nextCostId(costs: CostLine[]): string {
  return "c" + (costs.length + 1);
}

export function blankContract(id: string, startYear: number): ContractParams {
  return {
    id,
    label: "Contract",
    startYear,
    termYears: 15,
    paymentsPerYear: 1,
    graceYears: 0,
    escalationPerYear: 0,
    balloon: 0,
    mode: "solved",
    reinvestments: [],
  };
}

export function nextContractId(contracts: ContractParams[]): string {
  return "k" + (contracts.length + 1);
}

export function blankCostLine(id: string): CostLine {
  return { id, name: "", category: "recurring", amount: 0, startYear: 1, durationYears: 1, escalation: 0 };
}
