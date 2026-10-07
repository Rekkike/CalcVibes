export interface CostLine {
  id: string;
  name: string;
  category: "recurring" | "capex";
  amount: number;
  startYear: number;
  durationYears: number;
  escalation: number;
}

export interface RepaymentParams {
  graceYears: number;
  termYears: number;
  paymentsPerYear: number;
  paymentEscalation: number;
  balloon: number;
}

export interface ResidualParams {
  amount: number;
  year: number;
}

export interface AppraisalParams {
  wacc: number;
  financeRate: number;
  reinvestmentRate: number;
  residual: ResidualParams;
}

export interface ModelInputs {
  projectName: string;
  currency: string;
  targetIrr: number;
  costs: CostLine[];
  repayment: RepaymentParams;
  appraisal?: AppraisalParams;
}

export interface MonthlyRow {
  period: number;
  year: number;
  cost: number;
  inflow: number;
  net: number;
  cumulative: number;
}

export interface YearlyRow {
  name: string;
  year: number;
  cost: number;
  inflow: number;
  net: number;
  cumulative: number;
}

export interface LineTotal {
  id: string;
  name: string;
  total: number;
}

export interface ModelResult {
  totalCost: number;
  costNpv: number;
  paymentAmount: number;
  paymentCount: number;
  totalCollected: number;
  netGain: number;
  achievedIrr: number | null;
  paybackYears: number | null;
  lastCostYear: number;
  repaymentStartYear: number;
  monthly: MonthlyRow[];
  yearly: YearlyRow[];
  lineTotals: LineTotal[];
  signChanges: number;
  irrAmbiguous: boolean;
  npvAtTarget: number;
  npvAtWacc: number;
  npvCollectionsAtWacc: number;
  npvCostsAtWacc: number;
  profitabilityIndex: number | null;
  discountedPaybackYears: number | null;
  mirr: number | null;
  goalMet: boolean;
}
