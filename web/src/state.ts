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

// Internal test template of record — the demo buttons no longer load this project (v0.6.7 rotation).
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

// Internal test template of record — the demo buttons no longer load this project (v0.6.7 rotation).
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

// v0.6.6 Task A: the third demo of record — a 2 MWp Swedish utility-scale solar park on a twenty-year
// PPA. Real-world grounding: parks above 500 kW cost roughly 6 000-9 000 kr per kW installed, so the
// 11.5 MSEK investment sits inside the benchmark band; the financing form of record is the fixed-price
// power purchase agreement per MWh over 10-20 year tenors, with real Swedish 20-year precedents, here
// settled monthly from project fulfillment; O&M benchmarks run at roughly $5-8 per kW-DC per year with
// land lease, insurance, and property costs of similar magnitude, so the two operating lines sum to
// roughly two percent of CAPEX per year; Swedish tax practice accepts a 20 percent straight-line
// book-corresponding depreciation basis, charged from commissioning in year 5.
export function solarParkProject(): ModelInputs {
  return {
    projectName: "Solar park example",
    currency: "SEK",
    entryUnit: "thousands",
    targetIrr: 7,
    costs: [
      { id: "c1", name: "Development & permitting", category: "recurring", amount: 300000, startYear: 1, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 5 } },
      { id: "c2", name: "Grid connection", category: "capex", amount: 1600000, startYear: 2, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 5 } },
      { id: "c3", name: "EPC - modules, inverters & mounting", category: "recurring", amount: 4000000, startYear: 3, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 5 } },
      { id: "c4", name: "Site works & fencing", category: "capex", amount: 1300000, startYear: 3, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 5 } },
    ],
    operatingLines: [
      { id: "o1", label: "O&M and monitoring", amount: 150000, startYear: 5, yearCount: 20, escalation: 1 },
      { id: "o2", label: "Land lease and insurance", amount: 180000, startYear: 5, yearCount: 20, escalation: 1 },
    ],
    repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 12, paymentEscalation: 0, balloon: 0 },
    appraisal: { wacc: 5, financeRate: 4, reinvestmentRate: 4, residual: { posture: "none", amount: 0, year: 24 } },
    maintenance: { mode: "off" },
  };
}


// v0.6.7 Task A: the port demo of record — shore power at a Rotterdam container terminal.
// Real-world grounding: the Port of Rotterdam Authority / Eneco shore power joint venture
// (ABB as installation partner; connection points along roughly 8 km of quay serving container
// vessels at APMT Maasvlakte II, ECT Delta, and ECT Euromax; an EIB loan of 90 M EUR inside a
// public co-funding package of roughly 160 M EUR, phased commissioning from 2028). The fixture
// models ONE terminal's share of the program and charges the full modeled cost base to the
// solved per-lift fee (the one-terminal full-recovery-fee assumption of record; the real program
// recovers across several terminals with public co-funding the app cannot model — finding F4).
export function shorePowerProject(): ModelInputs {
  return {
    projectName: "Shore power example (Rotterdam)",
    currency: "EUR",
    entryUnit: "millions",
    targetIrr: 6,
    costs: [
      { id: "c1", name: "Engineering, permits & studies", category: "recurring", amount: 6000000, startYear: 1, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "c2", name: "Substations & grid connections", category: "capex", amount: 48000000, startYear: 2, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "c3", name: "Shore power installations", category: "recurring", amount: 24000000, startYear: 2, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "c4", name: "Quay cabling & civil works", category: "capex", amount: 36000000, startYear: 3, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "c5", name: "Commissioning & ramp-up", category: "recurring", amount: 16000000, startYear: 3, durationYears: 1, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
    ],
    operatingLines: [
      { id: "o1", label: "Operations & maintenance", amount: 3600000, startYear: 4, yearCount: 20, escalation: 1 },
      { id: "o2", label: "Insurance, grid fees & platform", amount: 1400000, startYear: 4, yearCount: 20, escalation: 1 },
    ],
    repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 12, paymentEscalation: 0, balloon: 0 },
    appraisal: { wacc: 4, financeRate: 3.5, reinvestmentRate: 3.5, residual: { posture: "none", amount: 0, year: 24 } },
    maintenance: { mode: "off" },
    tariff: { mode: "decompose", escalationPerYear: 0, rows: [
      { id: "r1", label: "Deep-sea container vessel (8-24k TEU)", weight: 2, lifts: [110, 840, 1050, 1190, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330, 1330] },
      { id: "r2", label: "Feeder & medium vessel (3-8k TEU)", weight: 1, lifts: [60, 480, 600, 680, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760, 760] },
    ], fixedAnnualAmount: null, manualPrices: null },
  };
}

// v0.6.7 Task A: the land demo of record — a newbuild including the ground at Mjøstårnet, Brumunddal.
// Real-world grounding: the 18-storey, 85.4 m timber tower by AB Invest and HENT, a total-enterprise
// construction contract reported at roughly NOK 500 million excluding VAT, hosting the Wood Hotel,
// offices, apartments, and a restaurant. The fixture models the hotel and office/restaurant leases
// with the site acquisition retained and a book-value exit at year 23, and EXCLUDES the apartment
// sales (the apartments were sold, not leased; the app has no mid-project one-time disposal
// concept — finding F6); the remaining owner costs sit outside the model.
export function landNewbuildProject(): ModelInputs {
  return {
    projectName: "Mjøstårnet example",
    currency: "NOK",
    entryUnit: "millions",
    targetIrr: 8,
    costs: [
      { id: "c1", name: "Site acquisition (lakeside plot)", category: "capex", amount: 45000000, startYear: 1, durationYears: 0, escalation: 0, depreciation: { mode: "retained" } },
      { id: "c2", name: "Turnkey construction (18-storey timber tower)", category: "recurring", amount: 160000000, startYear: 1, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 33, startYear: 3 } },
      { id: "c3", name: "Interior & hotel fit-out", category: "capex", amount: 55000000, startYear: 2, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 3 } },
    ],
    operatingLines: [
      { id: "o1", label: "Property management & maintenance", amount: 4500000, startYear: 3, yearCount: 20, escalation: 2 },
      { id: "o2", label: "Insurance, property tax & utilities", amount: 3500000, startYear: 3, yearCount: 20, escalation: 1 },
    ],
    repayment: { graceYears: 1, termYears: 20, paymentsPerYear: 12, paymentEscalation: 0, balloon: 0 },
    contracts: [
      { id: "k1", label: "Hotel lease (Wood Hotel)", startYear: 3, termYears: 20, paymentsPerYear: 12, graceYears: 0, escalationPerYear: 1.5, balloon: 0, mode: "solved", reinvestments: [] },
      { id: "k2", label: "Office & restaurant leases", startYear: 3, termYears: 10, paymentsPerYear: 12, graceYears: 0, escalationPerYear: 1.5, balloon: 0, mode: "solved", reinvestments: [] },
    ],
    appraisal: { wacc: 5, financeRate: 4, reinvestmentRate: 4, residual: { mode: "calculated", amount: 0, year: 23 } },
    maintenance: { mode: "off" },
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
