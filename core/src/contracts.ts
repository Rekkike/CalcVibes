import type { ContractParams, ModelInputs, Reinvestment } from "./types.js";
import type { PaymentSlot } from "./slots.js";

export interface NormalizedContract {
  id: string;
  label: string;
  startMonth: number;
  termMonths: number;
  paymentsPerYear: number;
  spacing: number;
  graceYears: number;
  escalationPerYear: number;
  balloon: number;
  mode: "solved" | "evaluated";
  evaluatedPayment: number | null;
  evaluatedProfile: Record<number, number> | null;
  reinvestments: Reinvestment[];
  slots: PaymentSlot[];
  endMonth: number;
}

export function normalizeContracts(inp: ModelInputs, lastCostYear: number): NormalizedContract[] {
  const list = inp.contracts && inp.contracts.length > 0 ? inp.contracts : null;
  if (list === null) {
    // The legacy mapping: one solved contract from the repayment block.
    const r = inp.repayment;
    const startYear = r.firstCollectionYear ?? lastCostYear + r.graceYears;
    return [legacyContract(r, startYear)];
  }
  return list.map((c) => contractFromParams(c));
}

export function legacyContract(r: ModelInputs["repayment"], startYear: number): NormalizedContract {
  return contractFromParams({
    id: "legacy",
    label: "Payment stream",
    startYear,
    termYears: r.termYears,
    paymentsPerYear: r.paymentsPerYear,
    graceYears: 0,
    escalationPerYear: r.paymentEscalation,
    balloon: r.balloon,
    mode: "solved",
  });
}

export function contractFromParams(c: ContractParams): NormalizedContract {
  const ppy = [1, 2, 4, 12].indexOf(c.paymentsPerYear) >= 0 ? c.paymentsPerYear : 1;
  const spacing = 12 / ppy;
  const termMonths = Math.round(Math.max(0, c.termYears) * 12);
  const startMonth = (c.startYear + c.graceYears) * 12;
  const paymentCount = Math.max(0, Math.round((termMonths / 12) * ppy));
  const slots: PaymentSlot[] = [];
  for (let k = 0; k < paymentCount; k++) {
    const monthIndex = startMonth + k * spacing;
    const yearsIn = Math.floor(k / ppy);
    slots.push({ monthIndex, escFactor: Math.pow(1 + c.escalationPerYear / 100, yearsIn) });
  }
  return {
    id: c.id,
    label: c.label,
    startMonth,
    termMonths,
    paymentsPerYear: ppy,
    spacing,
    graceYears: c.graceYears,
    escalationPerYear: c.escalationPerYear,
    balloon: c.balloon,
    mode: c.mode,
    evaluatedPayment: c.evaluatedPayment ?? null,
    evaluatedProfile: c.evaluatedProfile ?? null,
    reinvestments: c.reinvestments ?? [],
    slots,
    endMonth: startMonth + termMonths,
  };
}

export function allReinvestments(contracts: NormalizedContract[]): Reinvestment[] {
  const out: Reinvestment[] = [];
  for (const c of contracts) for (const ri of c.reinvestments) out.push(ri);
  return out;
}

export function contractLastCollectionMonth(c: NormalizedContract): number {
  let last = c.slots.length > 0 ? c.slots[c.slots.length - 1].monthIndex : c.startMonth;
  if (c.evaluatedProfile !== null) {
    const years = Object.keys(c.evaluatedProfile).map(Number).sort((a, b) => a - b);
    if (years.length > 0) last = Math.max(last, years[years.length - 1] * 12);
  }
  if (c.balloon > 0) last = Math.max(last, c.endMonth);
  return last;
}
