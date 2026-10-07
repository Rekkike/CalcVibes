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

export function computeModel(inp: ModelInputsLike): import("./types.js").ModelResult {
  const issues = validateInputs(inp);
  if (issues.length > 0) throw new EngineInputError(issues);
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
  const totalMonths = Math.max(Math.ceil(lastCostYear * 12), repaymentStartYear * 12 + termMonths);
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
  let dfSumEsc = 0;
  slots.forEach((s) => { dfSumEsc += s.escFactor * df(s.monthIndex); });
  const payment = dfSumEsc > 0 ? (costNpv - inp.repayment.balloon * balloonDf) / dfSumEsc : 0;
  const inflowByMonth: Record<number, number> = {};
  slots.forEach((s) => {
    inflowByMonth[s.monthIndex] = (inflowByMonth[s.monthIndex] || 0) + payment * s.escFactor;
  });
  if (inp.repayment.balloon > 0 && balloonMonth <= totalMonths) {
    inflowByMonth[balloonMonth] = (inflowByMonth[balloonMonth] || 0) + inp.repayment.balloon;
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
  const signChanges = countSignChanges(monthly.map((mm2) => mm2.net));
  return {
    totalCost: totalCost, costNpv: costNpv, paymentAmount: payment,
    paymentCount: slots.length, totalCollected: totalCollected,
    netGain: totalCollected - totalCost, achievedIrr: achieved,
    paybackYears: paybackMonths === null ? null : paybackMonths / 12,
    lastCostYear: lastCostYear, repaymentStartYear: repaymentStartYear,
    monthly: monthly, yearly: yearly, lineTotals: lineTotals,
    signChanges: signChanges, irrAmbiguous: signChanges > 1,
  };
}

import { EngineInputError, validateInputs } from "./validate.js";

type ModelInputsLike = import("./types.js").ModelInputs;
