export interface DepreciationConfig {
  mode: "straight-line" | "rate" | "retained";
  years?: number;
  yearlyRatePct?: number;
  startYear?: number;
}

export interface CostLine {
  id: string;
  name: string;
  category: "recurring" | "capex";
  amount: number;
  startYear: number;
  durationYears: number;
  escalation: number;
  yearOverrides?: Record<number, number>;
  depreciation?: DepreciationConfig;
}

export interface RepaymentParams {
  graceYears: number;
  termYears: number;
  paymentsPerYear: number;
  paymentEscalation: number;
  balloon: number;
  firstCollectionYear?: number | null;
  collectionsOverrides?: Record<number, number>;
  // v0.6.8 Task E (finding W21): the optional, user-authored basis note. Engine-blind by the
  // pinned check; it surfaces in the app, the deck, and the PDF only.
  basisNote?: string | null;
}

export interface Reinvestment {
  year: number;
  amount: number;
}

export interface ContractParams {
  id: string;
  label: string;
  startYear: number;
  termYears: number;
  paymentsPerYear: number;
  graceYears: number;
  escalationPerYear: number;
  balloon: number;
  mode: "solved" | "evaluated";
  evaluatedPayment?: number | null;
  evaluatedProfile?: Record<number, number> | null;
  reinvestments?: Reinvestment[];
}

export interface ResidualParams {
  mode?: "calculated" | "amount";
  posture?: "none" | "set-price" | "book-value";
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

export interface TariffSpan {
  startYear: number;
  termYears: number;
}

export interface TariffRow {
  id: string;
  label: string;
  weight: number;
  lifts: number[];
  // v0.6.10 Task C (W35): the optional per-row span; absent = inherit the common span
  // (or the repayment-derived grid when no common span is declared).
  span?: TariffSpan | null;
}

export interface TariffConfig {
  mode: "off" | "decompose" | "stable" | "manual" | "fixed";
  escalationPerYear: number;
  rows: TariffRow[];
  fixedAnnualAmount: number | null;
  manualPrices: number[] | null;
  // v0.6.10 Task C (W35): the tariff owns its span — an overall start and term; absent
  // derives the grid from the repayment shape exactly as before (the no-drift pin).
  span?: TariffSpan | null;
  // v0.6.10 Task E.3 (W20): the machine-labeled unit vocabulary — presentation-only,
  // engine-blind beyond carrying the fields (the volume grid header unit and the
  // per-segment surcharge unit with its divisor).
  volumeUnitLabel?: string | null;
  priceUnitLabel?: string | null;
  priceDisplayDivisor?: number | null;
  // v0.6.8 Task E (finding W21): the optional, user-authored basis note. Engine-blind by the
  // pinned check; it surfaces in the app, the deck, and the PDF only.
  basisNote?: string | null;
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
  // v0.6.12.2 (AUD-3): the maintenance entry carries the capex basis it used.
  basis?: number;
}

export interface AppraisalParams {
  wacc: number;
  financeRate: number;
  reinvestmentRate: number;
  residual: ResidualParams;
}

export interface FundingRow {
  id: string;
  label: string;
  kind: "grant" | "interest-free-loan";
  amount: number;                    // currency units, positive
  year: number;                      // model year the row lands (grant receipt; loan advance)
  termYears?: number | null;         // loan-kind: the repayment term, default 1
  repaymentStartYear?: number | null; // loan-kind: the first repayment year, default 1
}

export interface FundingConfig {
  rows: FundingRow[];
}

export interface FundingShare {
  lineId: string;
  lineName: string;
  capitalizedToDate: number;
  shareOfGrant: number;
  nettedAmount: number;
}

export interface FundingAllocation {
  grantId: string;
  label: string;
  year: number;
  amount: number;
  shares: FundingShare[];
}

export interface FundingView {
  rows: FundingRow[];
  grantsTotal: number;
  fundingNpv: number;
  allocation: FundingAllocation[];
}

// v0.6.13: the timeline block — a planning and presentation layer. The engine never reads it:
// computeModel is inert to the block (the byte-identity lock). Years are program years (1-based).
// v0.6.13.2: a phase is a plain string id into the block's own vocabulary (the curated defaults live in the
// web layer; the block may carry its own list plus per-lane visibility, both presentation-only).
export type TimelinePhase = string;
export type TimelineSource = "cost-program" | "contracts" | "funding" | "financing" | "operating" | "tariff";
export type TimelineOutcome = "continue" | "change" | "terminate";
export type TimelineEngineEvent = "construction-complete" | "first-collection-year" | "funding-received";

export interface TimelineActivity {
  id: string;
  label: string;
  startYear: number;
  endYear: number;
  phase: TimelinePhase;
  // v0.6.13.2: the source marker of a suggested activity; hand-authored activities carry none.
  derivedFrom?: TimelineSource;
}

export interface TimelineDecisionPoint {
  id: string;
  title: string;
  year: number;
  outcome?: TimelineOutcome;
  // The PPS-aligned decision-point code (BP1..BP8) the gate was seeded with; the deck renders it
  // with the title. Optional: a gate added beyond the scale's set carries none.
  code?: string;
}

export type TimelineTie = { kind: "activity"; activityId: string } | { kind: "engine-event"; event: TimelineEngineEvent };

export interface TimelineMilestone {
  id: string;
  label: string;
  year: number;
  tie?: TimelineTie;
}

export interface TimelineBlock {
  projectScale?: "mini" | "full";
  // v0.6.13.2: the carried phase vocabulary (absent reads as the curated defaults) and the
  // per-lane visibility (absent entry = automatic; true = render even when empty; false = hide).
  phases?: { id: string; label: string }[];
  laneVisibility?: Record<string, boolean>;
  activities: TimelineActivity[];
  decisionPoints: TimelineDecisionPoint[];
  milestones: TimelineMilestone[];
}

export interface ModelInputs {
  projectName: string;
  currency: string;
  entryUnit?: string;
  targetIrr: number;
  costs: CostLine[];
  repayment: RepaymentParams;
  contracts?: ContractParams[];
  depreciationDefault?: DepreciationConfig | null;
  appraisal?: AppraisalParams;
  operatingLines?: OperatingLine[];
  maintenance?: MaintenanceConfig;
  tariff?: TariffConfig;
  financing?: FinancingConfig;
  // v0.6.10 Task A: the funding block — grants and the interest-free public note.
  // Absent or null = the engine is byte-identical to the pre-funding behavior (the golden
  // no-drift pin).
  funding?: FundingConfig | null;
  projectLengthYears?: number | null;
  timeline?: TimelineBlock;
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
  // v0.6.11 Task D: the equity-view ambiguity classification (null when signChanges <= 1).
  ambiguityCause: "financing" | "operational" | null;
  ambiguityNote: string | null;
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

export interface HorizonConstituent {
  label: string;
  month: number;
}

export interface HorizonInfo {
  totalMonths: number;
  totalYears: number;
  constituents: HorizonConstituent[];
}

export interface BookViewRow {
  year: number;
  beginning: number;
  charge: number;
  ending: number;
  collections: number;
  operating: number;
  bookResult: number;
}

export interface BookView {
  lines: { id: string; name: string; isRetained: boolean; years: { year: number; beginning: number; charge: number; ending: number }[] }[];
  combined: BookViewRow[];
  totalCharge: number;
  remainingBookValueAtResidualYear: number;
  gainOrLossOnSale: number;
  residualMode: "calculated" | "amount";
  setAmount: number;
}

export interface TermPosition {
  contractId: string;
  label: string;
  endMonth: number;
  truncatedIrr: number | null;
  truncatedIrrAmbiguous: boolean;
  cumulativeNet: number;
  npvAtWacc: number;
  npvAtTarget: number;
  paybackSoFar: number | null;
}

export interface ContractInfo {
  id: string;
  label: string;
  mode: "solved" | "evaluated";
  startYear: number;
  termYears: number;
  paymentsPerYear: number;
  paymentCount: number;
  endMonth: number;
  lastCollectionMonth: number;
  reinvestments: Reinvestment[];
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
  costGrid: GridRow[];
  collectionsGrid: GridRow[];
  horizon?: HorizonInfo;
  bookView?: BookView;
  termPositions?: TermPosition[];
  contractsInfo?: ContractInfo[];
  // v0.6.10 Task A: the funding view — null when no funding rows are present.
  fundingView?: FundingView | null;
  residualAmountUsed?: number;
  solvedClamped?: boolean;
  headlineSource?: "monthly" | "yearly" | "ambiguous";
  // v0.6.11 Task D: the mechanically classified ambiguity cause and the engine-composed
  // note (both null when signChanges <= 1). Surfaces render the note verbatim.
  irrAmbiguityCause?: "financing" | "operational" | null;
  irrAmbiguityNote?: string | null;
  residualDisclosure?: string | null;
}

export interface GridRow {
  id: string;
  name: string;
  kind: string;
  amounts: number[];
}
