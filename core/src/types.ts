export interface CostLine {
  id: string;
  name: string;
  category: "recurring" | "capex";
  amount: number;
  startYear: number;
  durationYears: number;
  escalation: number;
  yearOverrides?: Record<number, number>;
}

export interface RepaymentParams {
  graceYears: number;
  termYears: number;
  paymentsPerYear: number;
  paymentEscalation: number;
  balloon: number;
  firstCollectionYear?: number | null;
}

export interface ResidualParams {
  amount: number;
  year: number;
}

export interface OperatingLine {
  id: string;
  label: string;
  amount: number;
  startYear: number;
  yearCount: number;
  escalation: number;
}

export interface FinancingConfig {
  enabled: boolean;
  sharePct: number;
  debtRatePct: number;
  termYears: number;
  graceYears: number;
  serviceStartYear: number | null;
  amortization: "annuity" | "equal-principal";
  leveragedSolve: boolean;
  perLineSharePct: Record<string, number>;
}

export interface TariffRow {
  id: string;
  label: string;
  weight: number;
  lifts: number[];
}

export interface TariffConfig {
  mode: "off" | "decompose" | "stable" | "manual" | "fixed";
  escalationPerYear: number;
  rows: TariffRow[];
  fixedAnnualAmount: number | null;
  manualPrices: number[] | null;
}

export interface TariffYearInfo {
  year: number;
  required: number | null;
  weightedVolume: number;
  unitPrice: number | null;
  revenue: number;
  perRowCharges: Record<string, number> | null;
}

export interface MaintenanceConfig {
  mode: "off" | "percent" | "fixed";
  percentPerYear?: number;
  fixedAnnualAmount?: number;
}

export interface OperatingLineInfo {
  id: string;
  label: string;
  nominalSpan: [number, number];
  effectiveWindow: [number, number];
  total: number;
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
  operatingLines?: OperatingLine[];
  maintenance?: MaintenanceConfig;
  tariff?: TariffConfig;
  financing?: FinancingConfig;
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

export interface FinancingYearlyRow {
  year: number;
  interest: number;
  principal: number;
  service: number;
}

export interface DscrRow {
  year: number;
  inflows: number;
  service: number;
  dscr: number | null;
}

export interface EquityMetrics {
  outlay: number;
  npvAtWacc: number;
  npvAtTarget: number;
  payback: number | null;
  signChanges: number;
  irr: number | null;
  irrAmbiguous: boolean;
  zeroOutlay: boolean;
}

export interface FinancingResult {
  drawnTotal: number;
  idc: number;
  serviceStartBalance: number;
  serviceStartMonth: number;
  termMonths: number;
  graceMonths: number;
  amortizationType: "annuity" | "equal-principal";
  annuityPayment: number | null;
  principalPayment: number | null;
  totalInterest: number;
  totalService: number;
  monthly: { interest: number[]; principal: number[]; service: number[]; balance: number[] };
  yearly: FinancingYearlyRow[];
  dscr: DscrRow[];
  minDscr: { year: number; value: number } | null;
  equity: EquityMetrics;
  draws: number[];
}

export interface ModelResult {
  totalCost: number;
  costNpv: number;
  paymentAmount: number | null;
  paymentCount: number | null;
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
  firstPaymentMonth: number;
  lastPaymentMonth: number;
  operatingLines: OperatingLineInfo[];
  operatingTotal: number;
  tariffYears: TariffYearInfo[];
  tariffBaseUnitPrice: number | null;
  financing: FinancingResult | null;
  leveragedSolve: boolean;
}
