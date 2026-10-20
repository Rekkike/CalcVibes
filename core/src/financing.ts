import { composeAmbiguityNote, countSignChanges, npvMonthly } from "./engine.js";
import { lineIncurred } from "./depreciation.js";
import type { CostLine, DscrRow, EquityMetrics, FinancingConfig, FinancingResult, FinancingYearlyRow, FundingRow } from "./types.js";

// v0.6.12.1 (AUD-2): the fundable-cost draw schedule on the profile-honoring incurred basis —
// the same lineIncurred amounts the book view consumes. A CAPEX year lands as a lump at that
// year's month 12 x year; a recurring year spreads over its twelve months. Every draw is the
// applicable share times the cost at the cost's own month. For a line without per-year
// profiles the arithmetic is the pre-existing arithmetic term for term (the byte-identity lock).
export function fundableDraws(
  costs: CostLine[],
  config: { sharePct: number; perLineSharePct?: Record<string, number> },
  horizon: number,
): number[] {
  const draws = new Array<number>(horizon).fill(0);
  for (const c of costs) {
    if (c.category !== "recurring" && c.category !== "capex") continue;
    const share = (config.perLineSharePct?.[c.id] ?? config.sharePct) / 100;
    for (const [y, amount] of lineIncurred(c)) {
      if (c.category === "capex") {
        const m = Math.min(horizon, y * 12);
        if (m >= 1) draws[m - 1] += share * amount;
      } else {
        const monthly = amount / 12;
        for (let mm = (y - 1) * 12 + 1; mm <= y * 12 && mm <= horizon; mm++) draws[mm - 1] += share * monthly;
      }
    }
  }
  return draws;
}

export interface FinancingContext {
  costM: number[];
  inflowsByMonth: number[];
  netM: number[];
  horizon: number;
  targetMonthlyRate: number;
  waccMonthlyRate: number;
  firstCollectionYear: number;
  lastCostMonth: number;
  projectIrr: number | null;
  costLineTotals: { id: string; total: number }[];
  costs: CostLine[];
  // v0.6.11 Task D: the funding rows ride the context for the equity-view classifier.
  fundingRows: FundingRow[];
}

export function validateFinancing(inp: { financing?: FinancingConfig; horizon: number; lastCostMonth: number; mode?: string; leveraged?: boolean }, issues: string[]): void {
  const f = inp.financing;
  if (!f || !f.enabled) return;
  if (f.sharePct < 0 || f.sharePct > 100) {
    issues.push(`Financing sharePct must be within [0, 100]; got ${f.sharePct}.`);
  }
  for (const [id, share] of Object.entries(f.perLineSharePct ?? {})) {
    if (share < 0 || share > 100) {
      issues.push(`Financing per-line share for line ${id} must be within [0, 100]; got ${share}.`);
    }
  }
  if (f.debtRatePct <= -100) {
    issues.push(`Financing debtRatePct must exceed -100; got ${f.debtRatePct}.`);
  }
  if (f.termYears < 1) {
    issues.push(`Financing termYears must be at least 1; got ${f.termYears}.`);
  }
  if (f.graceYears >= f.termYears) {
    issues.push(`Financing graceYears must be strictly less than termYears; got grace ${f.graceYears} against term ${f.termYears}.`);
  }
  if (f.serviceStartYear !== null) {
    if (f.serviceStartYear * 12 >= inp.horizon) {
      issues.push(`Financing serviceStartYear ${f.serviceStartYear} times 12 must be below the model horizon ${inp.horizon}.`);
    }
  }
}

export function computeFinancingOverlay(ctx: FinancingContext, config: FinancingConfig): FinancingResult {
  const rD = Math.pow(1 + config.debtRatePct / 100, 1 / 12) - 1;
  const serviceStartYear = config.serviceStartYear ?? ctx.firstCollectionYear;
  const S = serviceStartYear * 12;
  const N = config.termYears * 12;
  const G = config.graceYears * 12;
  const horizon = Math.max(ctx.horizon, S + N);
  const draws = fundableDraws(ctx.costs, config, horizon);
  let drawnTotal = 0;
  for (let m = 1; m <= horizon; m++) drawnTotal += draws[m - 1];
  let balance = 0;
  for (let m = 1; m <= S; m++) {
    balance = (balance + draws[m - 1]) * (1 + rD);
  }
  const idc = balance - drawnTotal;
  const amortMonths = N - G;
  const annuityPayment = config.amortization === "annuity" ? (rD === 0 ? balance / amortMonths : (balance * rD) / (1 - Math.pow(1 + rD, -amortMonths))) : null;
  const principalPayment = config.amortization === "equal-principal" ? balance / amortMonths : null;
  const interest: number[] = new Array(horizon).fill(0);
  const principal: number[] = new Array(horizon).fill(0);
  const service: number[] = new Array(horizon).fill(0);
  const balanceArr: number[] = new Array(horizon).fill(0);
  let running = balance;
  for (let m = S + 1; m <= S + N; m++) {
    const idx = m - 1;
    const int = running * rD;
    let prin = 0;
    let pay = 0;
    if (m <= S + G) {
      pay = int;
    } else {
      prin = config.amortization === "annuity" ? (annuityPayment as number) - int : (principalPayment as number);
      pay = prin + int;
    }
    interest[idx] = int;
    principal[idx] = prin;
    service[idx] = pay;
    running -= prin;
    balanceArr[idx] = running;
  }
  let totalInterest = 0;
  let totalService = 0;
  for (let m = S + 1; m <= S + N; m++) {
    totalInterest += interest[m - 1];
    totalService += service[m - 1];
  }
  const totalYears = Math.ceil(horizon / 12);
  const yearly: FinancingYearlyRow[] = [];
  for (let y = 1; y <= totalYears; y++) {
    let yi = 0, yp = 0, ys = 0;
    for (let m = (y - 1) * 12 + 1; m <= y * 12 && m <= horizon; m++) {
      yi += interest[m - 1];
      yp += principal[m - 1];
      ys += service[m - 1];
    }
    if (yi === 0 && yp === 0 && ys === 0) continue;
    yearly.push({ year: y, interest: yi, principal: yp, service: ys });
  }
  const dscr: DscrRow[] = [];
  let minDscr: { year: number; value: number } | null = null;
  for (let y = 1; y <= totalYears; y++) {
    let inflows = 0;
    let ys = 0;
    for (let m = (y - 1) * 12 + 1; m <= y * 12 && m <= horizon; m++) {
      inflows += ctx.inflowsByMonth[m - 1] ?? 0;
      ys += service[m - 1];
    }
    const value = ys > 0 ? inflows / ys : null;
    dscr.push({ year: y, inflows, service: ys, dscr: value });
    if (value !== null) {
      if (minDscr === null || value < minDscr.value) {
        minDscr = { year: y, value };
      }
    }
  }
  const equityVec: number[] = new Array(horizon).fill(0);
  for (let m = 1; m <= horizon; m++) {
    const net = m <= ctx.netM.length ? ctx.netM[m - 1] : 0;
    equityVec[m - 1] = net + draws[m - 1] - service[m - 1];
  }
  let outlay = 0;
  ctx.costs.forEach((c) => {
    if (c.category !== "recurring" && c.category !== "capex") return;
    const share = (config.perLineSharePct?.[c.id] ?? config.sharePct) / 100;
    // v0.6.12.1 (AUD-2): the equity outlay follows the same incurred basis as the draws for a
    // line carrying per-year profiles. A profile-free line keeps its pre-existing association
    // order, ((1 - share) * amount) * growth, term for term: the multiplication order is part of
    // the byte-identity lock (the incurred form (1 - share) * (amount * growth) differs in the
    // last digit on some inputs).
    if (c.yearOverrides !== undefined && Object.keys(c.yearOverrides).length > 0) {
      for (const [, amount] of lineIncurred(c)) outlay += (1 - share) * amount;
    } else if (c.category === "capex") {
      outlay += (1 - share) * c.amount;
    } else {
      const dur = Math.max(1, c.durationYears);
      for (let j = 0; j < dur; j++) outlay += (1 - share) * c.amount * Math.pow(1 + c.escalation / 100, j);
    }
  });
  const equityNpvAtWacc = npvMonthly(ctx.waccMonthlyRate, equityVec);
  const equityNpvAtTarget = npvMonthly(ctx.targetMonthlyRate, equityVec);
  let cum = 0;
  let paybackMonths: number | null = null;
  for (let m = 1; m <= horizon; m++) {
    const prev = cum;
    cum += equityVec[m - 1];
    if (paybackMonths === null && cum > 0 && prev <= 0 && equityVec[m - 1] > 0) {
      paybackMonths = (m - 1) + (0 - prev) / equityVec[m - 1];
    }
  }
  const signChanges = countSignChanges(equityVec);
  // v0.6.11 Task D: the equity-view ambiguity classifier — the same mechanical rule as
  // the main view: re-count on the equity flow with the financing cash removed (the
  // funding receipts and interest-free installments as on the main view, and the draws
  // and debt service with them — they are themselves financing).
  let ambiguityCause: "financing" | "operational" | null = null;
  let ambiguityNote: string | null = null;
  if (signChanges > 1) {
    const fundingCash = new Array<number>(horizon).fill(0);
    for (const fr of ctx.fundingRows) {
      const rm = fr.year * 12;
      if (rm >= 1 && rm <= horizon) fundingCash[rm - 1] += fr.amount;
      if (fr.kind === "interest-free-loan") {
        const loanTerm = fr.termYears ?? 1;
        const loanStart = fr.repaymentStartYear ?? 1;
        const installment = fr.amount / loanTerm;
        for (let k = 0; k < loanTerm; k++) {
          const im = (loanStart + k) * 12;
          if (im >= 1 && im <= horizon) fundingCash[im - 1] -= installment;
        }
      }
    }
    const withoutFinancing = equityVec.map((v, i) => v - fundingCash[i] - draws[i] + service[i]);
    ambiguityCause = countSignChanges(withoutFinancing) <= 1 ? "financing" : "operational";
    ambiguityNote = composeAmbiguityNote(ambiguityCause, "equity", signChanges, null);
  }
  const zeroOutlay = outlay === 0;
  let equityIrr: number | null = null;
  if (!zeroOutlay) {
    equityIrr = solveEquityIrr(equityVec);
  }
  const equity: EquityMetrics = {
    outlay,
    npvAtWacc: equityNpvAtWacc,
    npvAtTarget: equityNpvAtTarget,
    payback: paybackMonths === null ? null : paybackMonths / 12,
    signChanges,
    irr: equityIrr,
    irrAmbiguous: signChanges > 1,
    ambiguityCause,
    ambiguityNote,
    zeroOutlay,
  };
  return {
    drawnTotal,
    idc,
    serviceStartBalance: balance,
    serviceStartMonth: S,
    termMonths: N,
    graceMonths: G,
    amortizationType: config.amortization,
    annuityPayment,
    principalPayment,
    totalInterest,
    totalService,
    monthly: { interest, principal, service, balance: balanceArr },
    yearly,
    dscr,
    minDscr,
    equity,
    draws,
  };
}

export function solveEquityIrr(equityVec: number[]): number | null {
  const loBound = 0, hiBound = 6.0;
  const steps = 96;
  const width = (hiBound - loBound) / steps;
  let prevRate = loBound;
  let prevVal = npvMonthly(loBound, equityVec);
  let bracket: [number, number] | null = null;
  if (prevVal === 0) return Math.pow(1 + loBound, 12) - 1;
  for (let i = 1; i <= steps; i++) {
    const r = loBound + i * width;
    const v = npvMonthly(r, equityVec);
    if (v === 0) return Math.pow(1 + r, 12) - 1;
    if (prevVal * v < 0) { bracket = [prevRate, r]; break; }
    prevRate = r;
    prevVal = v;
  }
  if (bracket === null) return null;
  let lo = bracket[0], hi = bracket[1];
  let fLo = npvMonthly(lo, equityVec);
  let rM = lo;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvMonthly(mid, equityVec);
    rM = mid;
    if (Math.abs(fMid) < 1e-9) break;
    if (fLo * fMid < 0) { hi = mid; } else { lo = mid; fLo = fMid; }
  }
  return Math.pow(1 + rM, 12) - 1;
}
