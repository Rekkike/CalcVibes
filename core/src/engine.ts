export function countSignChanges(flows: number[]): number {
  let changes = 0;
  let prevSign = 0;
  for (const f of flows) {
    if (f === 0) continue;
    const sign = f > 0 ? 1 : -1;
    if (prevSign !== 0 && sign !== prevSign) changes++;
    prevSign = sign;
  }
  return changes;
}

export function npvMonthly(rateM: number, flows: number[]): number {
  let acc = 0;
  for (let i = 0; i < flows.length; i++) acc += flows[i] / Math.pow(1 + rateM, i + 1);
  return acc;
}

export function irrAnnual(flows: number[]): number | null {
  let allZero = true;
  for (const f of flows) {
    if (f !== 0) { allZero = false; break; }
  }
  if (allZero) return null;
  const loBound = -0.9, hiBound = 6.0;
  const steps = 96;
  const width = (hiBound - loBound) / steps;
  let lo = loBound, hi = 0;
  let fLo = npvMonthly(loBound, flows);
  let bracket: [number, number] | null = null;
  let prevRate = loBound, prevVal = fLo;
  for (let i = 1; i <= steps; i++) {
    const r = loBound + i * width;
    const v = npvMonthly(r, flows);
    if (prevVal === 0) { bracket = [prevRate, prevRate]; break; }
    if (prevVal * v < 0) { bracket = [prevRate, r]; break; }
    prevRate = r; prevVal = v;
  }
  if (bracket === null) return null;
  lo = bracket[0]; hi = bracket[1];
  fLo = npvMonthly(lo, flows);
  let rM = lo;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvMonthly(mid, flows);
    rM = mid;
    if (Math.abs(fMid) < 1e-9) break;
    if (fLo * fMid < 0) { hi = mid; } else { lo = mid; fLo = fMid; }
  }
  return Math.pow(1 + rM, 12) - 1;
}

interface PaymentSlot {
  monthIndex: number;
  escFactor: number;
}

export function computeModel(inp: ModelInputsLike, opts?: { fixedPayment?: number }): import("./types.js").ModelResult {
  const issues = validateInputs(inp);
  if (issues.length > 0) throw new EngineInputError(issues);
  const appraisal = inp.appraisal ?? { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } };
  const residualAmount = appraisal.residual.amount;
  const residualYear = appraisal.residual.year;
  const target = inp.targetIrr;
  const rM = Math.pow(1 + target / 100, 1 / 12) - 1;
  const costs = inp.costs;
  let lastCostYear = 0;
  costs.forEach((c) => {
    const end = c.category === "capex" ? c.startYear : c.startYear + Math.max(1, c.durationYears) - 1;
    lastCostYear = Math.max(lastCostYear, end);
  });
  if (lastCostYear === 0) lastCostYear = 1;
  const repaymentStartYear = lastCostYear + inp.repayment.graceYears;
  const termMonths = Math.round(Math.max(0, inp.repayment.termYears) * 12);
  let totalMonths = Math.max(Math.ceil(lastCostYear * 12), repaymentStartYear * 12 + termMonths);
  if (residualAmount > 0) totalMonths = Math.max(totalMonths, residualYear * 12);
  const costM = new Array<number>(totalMonths).fill(0);
  costs.forEach((c) => {
    if (c.category === "capex") {
      const m = Math.min(totalMonths, c.startYear * 12);
      if (m >= 1) costM[m - 1] += c.amount;
    } else {
      const dur = Math.max(1, c.durationYears);
      for (let y = c.startYear; y < c.startYear + dur; y++) {
        const esc = Math.pow(1 + c.escalation / 100, y - c.startYear);
        const monthly = (c.amount * esc) / 12;
        for (let mm = (y - 1) * 12 + 1; mm <= y * 12 && mm <= totalMonths; mm++) costM[mm - 1] += monthly;
      }
    }
  });
  let costNpv = 0;
  for (let i = 0; i < totalMonths; i++) costNpv += costM[i] / Math.pow(1 + rM, i + 1);
  const ppy = [1, 2, 4, 12].indexOf(inp.repayment.paymentsPerYear) >= 0 ? inp.repayment.paymentsPerYear : 1;
  const spacing = 12 / ppy;
  const paymentCount = Math.max(0, Math.round((termMonths / 12) * ppy));
  const slots: PaymentSlot[] = [];
  for (let k = 0; k < paymentCount; k++) {
    const monthIndex = repaymentStartYear * 12 + k * spacing;
    if (monthIndex > totalMonths) break;
    const yearsIn = Math.floor(k / ppy);
    slots.push({ monthIndex: monthIndex, escFactor: Math.pow(1 + inp.repayment.paymentEscalation / 100, yearsIn) });
  }
  const balloonMonth = repaymentStartYear * 12 + termMonths;
  const df = (m: number) => 1 / Math.pow(1 + rM, m);
  const balloonDf = balloonMonth <= totalMonths ? df(balloonMonth) : 0;
  if (inp.repayment.balloon > 0 && inp.repayment.balloon * balloonDf >= costNpv) {
    throw new EngineInputError(["The balloon's discounted value at the target rate reaches the cost NPV; the solved payment would be non-positive."]);
  }
  const residualMonth = residualYear * 12;
  const residualDf = residualAmount > 0 && residualMonth <= totalMonths ? df(residualMonth) : 0;
  let dfSumEsc = 0;
  slots.forEach((s) => { dfSumEsc += s.escFactor * df(s.monthIndex); });
  const payment = opts && opts.fixedPayment !== undefined
    ? opts.fixedPayment
    : (dfSumEsc > 0 ? (costNpv - inp.repayment.balloon * balloonDf - residualAmount * residualDf) / dfSumEsc : 0);
  const inflowByMonth: Record<number, number> = {};
  slots.forEach((s) => {
    inflowByMonth[s.monthIndex] = (inflowByMonth[s.monthIndex] || 0) + payment * s.escFactor;
  });
  if (inp.repayment.balloon > 0 && balloonMonth <= totalMonths) {
    inflowByMonth[balloonMonth] = (inflowByMonth[balloonMonth] || 0) + inp.repayment.balloon;
  }
  if (residualAmount > 0 && residualMonth <= totalMonths) {
    inflowByMonth[residualMonth] = (inflowByMonth[residualMonth] || 0) + residualAmount;
  }
  const monthly: import("./types.js").MonthlyRow[] = [];
  let cumulative = 0;
  let paybackMonths: number | null = null;
  for (let m2 = 1; m2 <= totalMonths; m2++) {
    const inflow = inflowByMonth[m2] || 0;
    const cost = costM[m2 - 1];
    const net = inflow - cost;
    const prevCum = cumulative;
    cumulative += net;
    if (paybackMonths === null && cumulative >= 0 && prevCum < 0 && net > 0) {
      paybackMonths = (m2 - 1) + (0 - prevCum) / net;
    }
    monthly.push({ period: m2, year: Math.ceil(m2 / 12), cost: cost, inflow: inflow, net: net, cumulative: cumulative });
  }
  const achieved = irrAnnual(monthly.map((mm2) => mm2.net));
  const totalYears = Math.ceil(totalMonths / 12);
  const yearly: import("./types.js").YearlyRow[] = [];
  for (let yy = 1; yy <= totalYears; yy++) {
    const inYear = monthly.filter((row) => row.year === yy);
    if (inYear.length === 0) continue;
    let costSum = 0, inflowSum = 0;
    inYear.forEach((row) => { costSum += row.cost; inflowSum += row.inflow; });
    yearly.push({
      name: "Y" + yy, year: yy, cost: costSum, inflow: inflowSum,
      net: inflowSum - costSum, cumulative: inYear[inYear.length - 1].cumulative,
    });
  }
  const lineTotals = costs.map((c) => {
    let total = 0;
    if (c.category === "capex") total = c.amount;
    else {
      const dur2 = Math.max(1, c.durationYears);
      for (let j = 0; j < dur2; j++) total += c.amount * Math.pow(1 + c.escalation / 100, j);
    }
    return { id: c.id, name: c.name, total: total };
  });
  const totalCost = lineTotals.reduce((a, l) => a + l.total, 0);
  let totalCollected = 0;
  slots.forEach((s) => { totalCollected += payment * s.escFactor; });
  if (inp.repayment.balloon > 0) totalCollected += inp.repayment.balloon;
  if (residualAmount > 0) totalCollected += residualAmount;
  const signChanges = countSignChanges(monthly.map((mm2) => mm2.net));
  const netFlows = monthly.map((mm2) => mm2.net);
  const npvAtTarget = npvMonthly(rM, netFlows);
  const waccM = Math.pow(1 + appraisal.wacc / 100, 1 / 12) - 1;
  const npvCollectionsAtWacc = npvMonthly(waccM, monthly.map((mm2) => mm2.inflow));
  const npvCostsAtWacc = npvMonthly(waccM, costM);
  const npvAtWacc = npvMonthly(waccM, netFlows);
  const profitabilityIndex = npvCostsAtWacc > 0 ? npvCollectionsAtWacc / npvCostsAtWacc : null;
  let discountedCum = 0;
  let discountedPaybackMonths: number | null = null;
  for (let m2 = 1; m2 <= totalMonths; m2++) {
    const dNet = monthly[m2 - 1].net / Math.pow(1 + waccM, m2);
    const prev = discountedCum;
    discountedCum += dNet;
    if (discountedPaybackMonths === null && discountedCum >= 0 && prev < 0 && dNet > 0) {
      discountedPaybackMonths = (m2 - 1) + (0 - prev) / dNet;
    }
  }
  let pvNeg = 0, fvPos = 0;
  const N = netFlows.length;
  const finM = Math.pow(1 + appraisal.financeRate / 100, 1 / 12) - 1;
  const reinvM = Math.pow(1 + appraisal.reinvestmentRate / 100, 1 / 12) - 1;
  for (let i = 0; i < N; i++) {
    const f = netFlows[i];
    if (f < 0) pvNeg += -f / Math.pow(1 + finM, i + 1);
    if (f > 0) fvPos += f * Math.pow(1 + reinvM, N - (i + 1));
  }
  let mirr: number | null = null;
  if (pvNeg > 0 && fvPos > 0) {
    const ratio = fvPos / pvNeg;
    mirr = N > 0 ? Math.pow(ratio, 12 / N) - 1 : null;
  }
  const goalMet = achieved !== null && achieved >= target / 100 - 1e-9;
  return {
    totalCost: totalCost, costNpv: costNpv, paymentAmount: payment,
    paymentCount: slots.length, totalCollected: totalCollected,
    netGain: totalCollected - totalCost, achievedIrr: achieved,
    paybackYears: paybackMonths === null ? null : paybackMonths / 12,
    lastCostYear: lastCostYear, repaymentStartYear: repaymentStartYear,
    monthly: monthly, yearly: yearly, lineTotals: lineTotals,
    signChanges: signChanges, irrAmbiguous: signChanges > 1,
    npvAtTarget: npvAtTarget, npvAtWacc: npvAtWacc,
    npvCollectionsAtWacc: npvCollectionsAtWacc, npvCostsAtWacc: npvCostsAtWacc,
    profitabilityIndex: profitabilityIndex, discountedPaybackYears: discountedPaybackMonths === null ? null : discountedPaybackMonths / 12,
    mirr: mirr, goalMet: goalMet,
  };
}

import { EngineInputError, validateInputs } from "./validate.js";

type ModelInputsLike = import("./types.js").ModelInputs;

function lastCostYearOf(inp: ModelInputsLike): number {
  let last = 0;
  inp.costs.forEach((c) => {
    const end = c.category === "capex" ? c.startYear : c.startYear + Math.max(1, c.durationYears) - 1;
    last = Math.max(last, end);
  });
  return last === 0 ? 1 : last;
}

function costNpvOf(inp: ModelInputsLike, rM: number): number {
  const lastCostYear = lastCostYearOf(inp);
  const totalMonths = Math.max(Math.ceil(lastCostYear * 12), (lastCostYear + inp.repayment.graceYears) * 12 + Math.round(Math.max(0, inp.repayment.termYears) * 12));
  const costM = new Array<number>(totalMonths).fill(0);
  inp.costs.forEach((c) => {
    if (c.category === "capex") {
      const m = Math.min(totalMonths, c.startYear * 12);
      if (m >= 1) costM[m - 1] += c.amount;
    } else {
      const dur = Math.max(1, c.durationYears);
      for (let y = c.startYear; y < c.startYear + dur; y++) {
        const esc2 = Math.pow(1 + c.escalation / 100, y - c.startYear);
        const monthly = (c.amount * esc2) / 12;
        for (let mm = (y - 1) * 12 + 1; mm <= y * 12 && mm <= totalMonths; mm++) costM[mm - 1] += monthly;
      }
    }
  });
  let costNpv = 0;
  for (let i = 0; i < totalMonths; i++) costNpv += costM[i] / Math.pow(1 + rM, i + 1);
  return costNpv;
}


export interface SolveTermResult {
  paymentCount: number | null;
  termYears: number | null;
  lastPaymentMonth: number | null;
  shortfall: number | null;
  result: import("./types.js").ModelResult;
}

export function solveTerm(inp: ModelInputsLike, payment: number): SolveTermResult {
  const target = inp.targetIrr;
  const rM = Math.pow(1 + target / 100, 1 / 12) - 1;
  const ppy = [1, 2, 4, 12].indexOf(inp.repayment.paymentsPerYear) >= 0 ? inp.repayment.paymentsPerYear : 1;
  const spacing = 12 / ppy;
  const issues = validateInputs(inp);
  if (issues.length > 0) throw new EngineInputError(issues);
  const appraisal = inp.appraisal ?? { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } };
  const residualAmount = appraisal.residual.amount;
  const residualYear = appraisal.residual.year;
  const costNpvBase = costNpvOf(inp, rM);
  const startMonth = (lastCostYearOf(inp) + inp.repayment.graceYears) * 12;
  const residualMonth = residualYear * 12;
  const residualDf = residualAmount > 0 ? 1 / Math.pow(1 + rM, Math.max(residualMonth, startMonth + 1)) : 0;
  const balloonMonth = startMonth + Math.round(inp.repayment.termYears * 12);
  const balloonDf = inp.repayment.balloon > 0 ? 1 / Math.pow(1 + rM, balloonMonth) : 0;
  const targetNpv = costNpvBase - inp.repayment.balloon * balloonDf - residualAmount * residualDf;
  const esc = inp.repayment.paymentEscalation / 100;
  let dfSum = 0;
  let n = 0;
  let infeasible = false;
  if (payment <= 0 || targetNpv <= 0 && payment <= 0) {
    infeasible = payment <= 0;
  }
  for (let k = 0; !infeasible; k++) {
    const escFactor = Math.pow(1 + esc, Math.floor(k / ppy));
    const monthIndex = startMonth + k * spacing;
    const d = payment * escFactor / Math.pow(1 + rM, monthIndex);
    if (!isFinite(d) || d <= 0) { infeasible = true; break; }
    if (dfSum + d >= targetNpv) {
      dfSum += d;
      n = k + 1;
      break;
    }
    dfSum += d;
    if (targetNpv - dfSum < 1e-9 * targetNpv) { n = k + 1; break; }
    if (d < 1e-12 * dfSum) { infeasible = true; break; }
    n = k + 1;
  }
  if (infeasible) {
    const maxDf = dfSum;
    const result = computeModel({ ...inp, repayment: { ...inp.repayment, termYears: inp.repayment.termYears } });
    return { paymentCount: null, termYears: null, lastPaymentMonth: null, shortfall: targetNpv - maxDf, result };
  }
  const termYears = n / ppy;
  const lastPaymentMonth = startMonth + (n - 1) * spacing;
  const result = computeModel({ ...inp, repayment: { ...inp.repayment, termYears } }, { fixedPayment: payment });
  const shortfall = targetNpv - dfSum;
  return { paymentCount: n, termYears, lastPaymentMonth, shortfall, result };
}
