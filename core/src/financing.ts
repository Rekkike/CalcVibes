import { composeAmbiguityNote, countSignChanges, npvMonthly } from "./engine.js";
import { lineIncurred } from "./depreciation.js";
import type { CostLine, DscrRow, EquityMetrics, Facility, FacilityResult, FinancingConfig, FinancingResult, FinancingYearlyRow, FundingRow, ModelInputs } from "./types.js";

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
  return drawsFromShares(costs, (c) => (config.perLineSharePct?.[c.id] ?? config.sharePct) / 100, horizon);
}

// v0.6.14: the draw schedule for an arbitrary per-line share (a fraction). fundableDraws is this with
// the legacy shares, term for term: the arithmetic below is the pre-existing arithmetic (the legacy
// path of record stays byte-identical).
export function drawsFromShares(costs: CostLine[], shareOf: (c: CostLine) => number, horizon: number): number[] {
  const draws = new Array<number>(horizon).fill(0);
  for (const c of costs) {
    if (c.category !== "recurring" && c.category !== "capex") continue;
    const share = shareOf(c);
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

// ---------------------------------------------------------------------------------------------
// v0.6.14 — the multi-facility core. The financing layer is a facility list; the legacy
// FinancingConfig and the funding-block note map to it through legacyFacilities.
// ---------------------------------------------------------------------------------------------

const isFundable = (c: CostLine): boolean => c.category === "recurring" || c.category === "capex";

export interface FacilityLedger {
  // facility id -> line id -> the effective draw share (a fraction of the line's incurred cost)
  shares: Record<string, Record<string, number>>;
  draws: Record<string, number[]>;
  drawn: Record<string, number>;
  // the stated amount less the drawn total (positive = an undrawn commitment); null when the
  // facility is sized by explicit shares (the amount is then the drawn total)
  drift: Record<string, number | null>;
}

// The draw ledger. The amount is the commitment; the draws never exceed the scoped lines' incurred
// costs (the share caps at 1); when facilities draw against the same line the draws compose pari
// passu (the shares on a line that sum beyond 1 scale proportionally, so no line is drawn beyond its
// cost); the facility list order governs the (deterministic) summation order.
export function resolveFacilityLedger(costs: CostLine[], facilities: Facility[], horizon: number): FacilityLedger {
  const fundable = costs.filter(isFundable);
  const incurredTotal: Record<string, number> = {};
  for (const c of fundable) {
    let t = 0;
    for (const [, amount] of lineIncurred(c)) t += amount;
    incurredTotal[c.id] = t;
  }
  const shares: Record<string, Record<string, number>> = {};
  for (const f of facilities) {
    const sh: Record<string, number> = {};
    if (f.datedDraw !== undefined) {
      // a dated lump is not tied to the cost calendar: no line shares
    } else if (f.sharePct !== undefined) {
      for (const c of fundable) sh[c.id] = (f.perLineSharePct?.[c.id] ?? f.sharePct) / 100;
    } else {
      const scoped = f.scope.kind === "general" ? fundable : fundable.filter((c) => (f.scope as { lineIds: string[] }).lineIds.includes(c.id));
      let scopedTotal = 0;
      for (const c of scoped) scopedTotal += incurredTotal[c.id];
      const share = scopedTotal > 0 ? Math.min(1, (f.amount ?? 0) / scopedTotal) : 0;
      for (const c of scoped) sh[c.id] = share;
    }
    shares[f.id] = sh;
  }
  for (const c of fundable) {
    let total = 0;
    for (const f of facilities) total += shares[f.id][c.id] ?? 0;
    if (total > 1) {
      for (const f of facilities) {
        if (shares[f.id][c.id] !== undefined) shares[f.id][c.id] = shares[f.id][c.id] / total;
      }
    }
  }
  const draws: Record<string, number[]> = {};
  const drawn: Record<string, number> = {};
  const drift: Record<string, number | null> = {};
  for (const f of facilities) {
    let arr: number[];
    if (f.datedDraw !== undefined) {
      arr = new Array<number>(horizon).fill(0);
      const m = Math.min(horizon, f.datedDraw.year * 12);
      if (m >= 1) arr[m - 1] += f.amount ?? 0;
    } else {
      arr = drawsFromShares(costs, (c) => shares[f.id][c.id] ?? 0, horizon);
    }
    let total = 0;
    for (let m = 1; m <= horizon; m++) total += arr[m - 1];
    draws[f.id] = arr;
    drawn[f.id] = total;
    drift[f.id] = f.amount !== null && f.sharePct === undefined ? f.amount - total : null;
  }
  return { shares, draws, drawn, drift };
}

// The legacy adapter of record: the per-line shares map to ONE derived general facility; each
// interest-free note in the funding block maps to ONE zero-rate facility (a dated lump draw at its
// receipt year, equal annual installments from its repayment start). The notes join the facility
// set only when the financing layer is enabled (the overlay exists only then); a disabled layer
// leaves the funding block exactly as before.
function noteFacility(fr: FundingRow): Facility {
  return {
    id: fr.id,
    label: fr.label,
    amount: fr.amount,
    ratePct: 0,
    termYears: fr.termYears ?? 1,
    graceYears: 0,
    amortization: "equal-principal",
    serviceStartYear: (fr.repaymentStartYear ?? 1) - 1,
    scope: { kind: "general" },
    paymentsPerYear: 1,
    datedDraw: { year: fr.year },
    origin: "funding-note",
  };
}

export function legacyFacilities(config: FinancingConfig | null | undefined, fundingRows: FundingRow[]): Facility[] {
  if (!config || !config.enabled) return [];
  const list: Facility[] = [{
    id: "financing",
    label: "Financing facility",
    amount: null,
    ratePct: config.debtRatePct,
    termYears: config.termYears,
    graceYears: config.graceYears,
    amortization: config.amortization,
    serviceStartYear: config.serviceStartYear,
    scope: { kind: "general" },
    sharePct: config.sharePct,
    perLineSharePct: config.perLineSharePct,
    origin: "financing",
  }];
  for (const fr of fundingRows) {
    if (fr.kind !== "interest-free-loan") continue;
    list.push(noteFacility(fr));
  }
  return list;
}

// The facility-list validation under the collect-all contract: every defect surfaces with its exact
// message; nothing is suppressed, clamped or silently dropped.
export function validateFacilities(
  facilities: Facility[],
  span: { costs: CostLine[]; horizon: number; firstCollectionYear: number },
  issues: string[],
  // v0.6.16: a facility sized by explicit shares (the migrated legacy overlay) keeps the legacy
  // financing refusal texts of record; the caller runs validateFinancing for it
  opts?: { legacySharesMessages?: boolean },
): void {
  const seen = new Set<string>();
  const dup = new Set<string>();
  const lineIds = new Set(span.costs.map((c) => c.id));
  for (const f of facilities) {
    if (seen.has(f.id) && !dup.has(f.id)) {
      dup.add(f.id);
      issues.push(`Facility ${f.id} appears more than once in the facility list (FAC-ID).`);
    }
    seen.add(f.id);
    const tag = `Facility ${f.id} (${f.label})`;
    const legacyText = opts?.legacySharesMessages === true && f.sharePct !== undefined;
    if (f.sharePct === undefined && !(f.amount !== null && f.amount > 0 && Number.isFinite(f.amount))) {
      issues.push(`${tag} must carry a positive amount (FAC-AMOUNT).`);
    }
    if (f.sharePct !== undefined && !legacyText) {
      if (f.sharePct < 0 || f.sharePct > 100) issues.push(`${tag} must carry a share within [0, 100]; got ${f.sharePct} (FAC-SHARE).`);
      for (const [id, share] of Object.entries(f.perLineSharePct ?? {})) {
        if (share < 0 || share > 100) issues.push(`${tag} must carry a per-line share within [0, 100] for line ${id}; got ${share} (FAC-SHARE).`);
      }
    }
    if (!legacyText && !(f.termYears > 0)) issues.push(`${tag} must carry a positive term (FAC-TERM).`);
    if (!legacyText && !(f.ratePct > -100)) issues.push(`${tag} must carry a rate above -100 percent (FAC-RATE).`);
    if (!legacyText && f.termYears > 0 && f.graceYears >= f.termYears) {
      issues.push(`${tag} must carry a grace period strictly less than its term; got grace ${f.graceYears} against term ${f.termYears} (FAC-GRACE).`);
    }
    if (f.datedDraw !== undefined) {
      if (f.ratePct !== 0) issues.push(`${tag} lands as a dated lump and must be interest-free, a rate of 0 (FAC-DATED-RATE).`);
      if (!Number.isInteger(f.datedDraw.year) || f.datedDraw.year < 1) {
        issues.push(`${tag} lands as a dated lump in a model year of at least 1 (FAC-DATED-YEAR).`);
      }
      if (!Number.isInteger(f.termYears) || (f.serviceStartYear !== null && (!Number.isInteger(f.serviceStartYear) || f.serviceStartYear < 0))) {
        issues.push(`${tag} lands as a dated lump and must carry a whole-year term and service start (FAC-DATED-TERM).`);
      }
    }
    const startYear = f.serviceStartYear ?? span.firstCollectionYear;
    // a dated lump repays under the funding horizon refusals (FND-LOAN-HORIZON, at the final horizon)
    if (!legacyText && f.datedDraw === undefined && startYear * 12 >= span.horizon) {
      issues.push(`${tag} has a service start year ${startYear} whose month ${startYear * 12} is not below the model horizon ${span.horizon} (FAC-SERVICE-START).`);
    }
    if (f.scope.kind === "attached") {
      if (f.scope.lineIds.length === 0) {
        issues.push(`${tag} is attached but names no cost line (FAC-SCOPE-EMPTY).`);
      }
      for (const id of f.scope.lineIds) {
        if (!lineIds.has(id)) issues.push(`${tag} is attached to cost line ${id}, which does not exist (FAC-SCOPE-LINE).`);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// v0.6.16 — the authored facility input. The facilities field is the authored list; absent or empty
// leaves every legacy composition untouched (the absence lock). The migration helper composes the
// authored twin of a legacy document ONCE here, and the web load path consumes it.
// ---------------------------------------------------------------------------------------------

export interface AuthoredContext {
  // the funding rows the engine sees: the document's rows with the dated-lump facilities (the retired
  // notes) restored at their original index, so the net-flow composition is the legacy composition
  fundingRows: FundingRow[];
  debt: Facility[];
  notes: Facility[];
  all: Facility[];
  leveraged: boolean;
}

const asNote = (f: Facility): boolean => f.datedDraw !== undefined;

export function authoredContext(inp: Pick<ModelInputs, "facilities" | "facilityOptions" | "funding">): AuthoredContext | null {
  const list = inp.facilities;
  if (!Array.isArray(list) || list.length === 0) return null;
  const active = list.filter((f) => f.enabled !== false);
  const debt = active.filter((f) => !asNote(f)).map((f) => (f.origin === "financing" ? f : { ...f, origin: "financing" as const }));
  const notes = active.filter(asNote).map((f) => (f.origin === "funding-note" ? f : { ...f, origin: "funding-note" as const }));
  return {
    fundingRows: fundingRowsFrom(inp.funding?.rows ?? [], notes),
    debt,
    notes,
    all: [...debt, ...notes],
    leveraged: inp.facilityOptions?.leveragedSolve === true,
  };
}

function fundingRowsFrom(base: FundingRow[], notes: Facility[]): FundingRow[] {
  if (notes.length === 0) return base;
  const rows = base.slice();
  const ordered = notes.map((f, i) => ({ f, i })).sort((a, b) => (a.f.fundingOrder ?? Infinity) - (b.f.fundingOrder ?? Infinity) || a.i - b.i);
  for (const { f } of ordered) {
    const row: FundingRow = {
      id: f.id,
      label: f.label,
      kind: "interest-free-loan",
      amount: f.amount ?? 0,
      year: (f.datedDraw as { year: number }).year,
      termYears: f.termYears,
      repaymentStartYear: (f.serviceStartYear ?? 0) + 1,
    };
    rows.splice(Math.min(f.fundingOrder ?? rows.length, rows.length), 0, row);
  }
  return rows;
}

// The funding rows of a document: the funding block's rows, with the authored dated-lump facilities
// (the notes) composed back in. With no authored facilities this is the funding block's own rows.
export function fundingRowsOf(inp: Pick<ModelInputs, "facilities" | "facilityOptions" | "funding">): FundingRow[] {
  const ctx = authoredContext(inp);
  return ctx ? ctx.fundingRows : (inp.funding?.rows ?? []);
}

// The saved-project migration (composed once, here). A legacy document's financing overlay becomes
// ONE facility in the authored-shares mode (GENERAL scope; kept declared but disabled when the legacy
// overlay was off), and each funding-block note becomes ONE zero-rate facility carrying its dated
// receipt, its installment schedule and its original funding-row index. The funding block keeps the
// grants. A document that already carries facilities, or has nothing to migrate, is returned as is.
export function migrateLegacyFinancing(inp: ModelInputs): ModelInputs {
  if (Array.isArray(inp.facilities) && inp.facilities.length > 0) return inp;
  const rows = inp.funding?.rows ?? [];
  const hasNote = rows.some((r) => r.kind === "interest-free-loan");
  if (!inp.financing && !hasNote) return inp;
  const facilities: Facility[] = [];
  if (inp.financing) {
    const f = legacyFacilities({ ...inp.financing, enabled: true }, [])[0];
    facilities.push(inp.financing.enabled ? f : { ...f, enabled: false });
  }
  rows.forEach((fr, i) => {
    if (fr.kind === "interest-free-loan") facilities.push({ ...noteFacility(fr), fundingOrder: i });
  });
  const { financing, ...rest } = inp;
  const twin: ModelInputs = { ...rest, facilities };
  if (financing) twin.facilityOptions = { leveragedSolve: financing.leveragedSolve };
  if (inp.funding) twin.funding = { ...inp.funding, rows: rows.filter((r) => r.kind !== "interest-free-loan") };
  return twin;
}

// The inverse of the migration (the other direction of the twin pin): the authored twin of a migrated
// document back to the legacy shape. A facility list that is not a migration product restores what it can.
export function restoreLegacyFinancing(twin: ModelInputs): ModelInputs {
  if (!Array.isArray(twin.facilities) || twin.facilities.length === 0) return twin;
  const { facilities, facilityOptions, ...rest } = twin;
  const out: ModelInputs = { ...rest };
  const eib = facilities.find((f) => f.datedDraw === undefined && f.sharePct !== undefined);
  if (eib) {
    out.financing = {
      enabled: eib.enabled !== false,
      sharePct: eib.sharePct as number,
      debtRatePct: eib.ratePct,
      termYears: eib.termYears,
      graceYears: eib.graceYears,
      serviceStartYear: eib.serviceStartYear,
      amortization: eib.amortization,
      leveragedSolve: facilityOptions?.leveragedSolve === true,
      perLineSharePct: eib.perLineSharePct ?? {},
    };
  }
  const notes = facilities.filter(asNote);
  if (twin.funding || notes.length > 0) out.funding = { ...(twin.funding ?? {}), rows: fundingRowsFrom(twin.funding?.rows ?? [], notes) };
  return out;
}

interface FacilitySchedule {
  S: number;
  N: number;
  G: number;
  ppy: number;
  balance: number;
  annuityPayment: number | null;
  principalPayment: number | null;
  interest: number[];
  principal: number[];
  service: number[];
  balanceArr: number[];
}

// One facility's monthly schedule: the balance accrued at the service start, then the service over
// the term. A monthly facility (the legacy shape) runs the pre-existing arithmetic term for term; a
// facility that pays less often accrues its interest monthly and settles it at its payment months.
function facilitySchedule(f: Facility, draws: number[], horizon: number, firstCollectionYear: number): FacilitySchedule {
  const rD = Math.pow(1 + f.ratePct / 100, 1 / 12) - 1;
  const S = (f.serviceStartYear ?? firstCollectionYear) * 12;
  const N = f.termYears * 12;
  const G = f.graceYears * 12;
  const ppy = f.paymentsPerYear ?? 12;
  const spacing = 12 / ppy;
  let balance = 0;
  if (f.datedDraw !== undefined) {
    balance = f.amount ?? 0;
  } else {
    for (let m = 1; m <= S; m++) balance = (balance + draws[m - 1]) * (1 + rD);
  }
  const interest = new Array<number>(horizon).fill(0);
  const principal = new Array<number>(horizon).fill(0);
  const service = new Array<number>(horizon).fill(0);
  const balanceArr = new Array<number>(horizon).fill(0);
  let annuityPayment: number | null = null;
  let principalPayment: number | null = null;
  let running = balance;
  if (spacing === 1) {
    const amortMonths = N - G;
    annuityPayment = f.amortization === "annuity" ? (rD === 0 ? balance / amortMonths : (balance * rD) / (1 - Math.pow(1 + rD, -amortMonths))) : null;
    principalPayment = f.amortization === "equal-principal" ? balance / amortMonths : null;
    for (let m = S + 1; m <= S + N; m++) {
      const idx = m - 1;
      const int = running * rD;
      let prin = 0;
      let pay = 0;
      if (m <= S + G) {
        pay = int;
      } else {
        prin = f.amortization === "annuity" ? (annuityPayment as number) - int : (principalPayment as number);
        pay = prin + int;
      }
      interest[idx] = int;
      principal[idx] = prin;
      service[idx] = pay;
      running -= prin;
      balanceArr[idx] = running;
    }
  } else {
    const rp = Math.pow(1 + rD, spacing) - 1;
    const nPay = N / spacing;
    const gracePay = G / spacing;
    const amortPay = nPay - gracePay;
    annuityPayment = f.amortization === "annuity" ? (rp === 0 ? balance / amortPay : (balance * rp) / (1 - Math.pow(1 + rp, -amortPay))) : null;
    principalPayment = f.amortization === "equal-principal" ? balance / amortPay : null;
    for (let j = 1; j <= nPay; j++) {
      const m = S + j * spacing;
      const idx = m - 1;
      const int = running * rp;
      let prin = 0;
      let pay = 0;
      if (j <= gracePay) {
        pay = int;
      } else {
        prin = f.amortization === "annuity" ? (annuityPayment as number) - int : (principalPayment as number);
        pay = prin + int;
      }
      interest[idx] = int;
      principal[idx] = prin;
      service[idx] = pay;
      running -= prin;
      balanceArr[idx] = running;
    }
  }
  return { S, N, G, ppy, balance, annuityPayment, principalPayment, interest, principal, service, balanceArr };
}

// The leveraged solve over the facility set: the present value of the draws up to each facility's
// service start and of its service, summed across the cost-following (financing) facilities in
// facility-list order. The funding-block note stays out: its subsidy is already in the funding NPV.
export function leveragedStreams(
  costs: CostLine[],
  facilities: Facility[],
  rM: number,
  horizon: number,
  firstCollectionYear: number,
): { pvDraws: number; pvService: number } {
  const debt = facilities.filter((f) => f.origin !== "funding-note");
  let pvDraws = 0;
  let pvService = 0;
  for (const f of debt) {
    const S = (f.serviceStartYear ?? firstCollectionYear) * 12;
    const N = f.termYears * 12;
    const h = Math.max(horizon, S + N);
    const ledger = resolveFacilityLedger(costs, [f], h);
    const sch = facilitySchedule(f, ledger.draws[f.id], h, firstCollectionYear);
    let draws = 0;
    for (let m = 1; m <= S; m++) draws += ledger.draws[f.id][m - 1] / Math.pow(1 + rM, m);
    let service = 0;
    for (let m = S + 1; m <= S + N; m++) service += sch.service[m - 1] / Math.pow(1 + rM, m);
    pvDraws += draws;
    pvService += service;
  }
  return { pvDraws, pvService };
}

export function computeFinancingOverlay(ctx: FinancingContext, config: FinancingConfig): FinancingResult {
  return computeFacilityOverlay(ctx, legacyFacilities(config, ctx.fundingRows));
}

export function computeFacilityOverlay(ctx: FinancingContext, facilities: Facility[]): FinancingResult {
  let horizon = ctx.horizon;
  for (const f of facilities) {
    const S = (f.serviceStartYear ?? ctx.firstCollectionYear) * 12;
    horizon = Math.max(horizon, S + f.termYears * 12);
  }
  const ledger = resolveFacilityLedger(ctx.costs, facilities, horizon);
  const schedules = facilities.map((f) => facilitySchedule(f, ledger.draws[f.id], horizon, ctx.firstCollectionYear));
  const isNote = (f: Facility) => f.origin === "funding-note";
  const sumArrays = (pick: (i: number) => number[], filter: (f: Facility) => boolean): number[] => {
    const out = new Array<number>(horizon).fill(0);
    facilities.forEach((f, i) => {
      if (!filter(f)) return;
      const a = pick(i);
      for (let m = 0; m < horizon; m++) out[m] += a[m];
    });
    return out;
  };
  const all = () => true;
  const draws = sumArrays((i) => ledger.draws[facilities[i].id], all);
  const interest = sumArrays((i) => schedules[i].interest, all);
  const principal = sumArrays((i) => schedules[i].principal, all);
  const service = sumArrays((i) => schedules[i].service, all);
  const balanceArr = sumArrays((i) => schedules[i].balanceArr, all);
  // the financing-layer facilities alone (the funding-block note's cash is already in the project
  // net flow, as its dated receipt and installments)
  const finDraws = sumArrays((i) => ledger.draws[facilities[i].id], (f) => !isNote(f));
  const finService = sumArrays((i) => schedules[i].service, (f) => !isNote(f));
  const noteDraws = sumArrays((i) => ledger.draws[facilities[i].id], isNote);
  const noteService = sumArrays((i) => schedules[i].service, isNote);
  const hasNote = facilities.some(isNote);
  let drawnTotal = 0;
  for (let m = 1; m <= horizon; m++) drawnTotal += draws[m - 1];
  const facilityResults: FacilityResult[] = facilities.map((f, i) => {
    const sch = schedules[i];
    let drawnF = ledger.drawn[f.id];
    let totalInterestF = 0;
    let totalServiceF = 0;
    for (let m = sch.S + 1; m <= sch.S + sch.N; m++) {
      totalInterestF += sch.interest[m - 1];
      totalServiceF += sch.service[m - 1];
    }
    return {
      id: f.id,
      label: f.label,
      origin: f.origin ?? "financing",
      scope: f.scope,
      amount: f.amount ?? drawnF,
      drawnTotal: drawnF,
      drift: ledger.drift[f.id],
      shares: ledger.shares[f.id],
      idc: f.datedDraw !== undefined ? 0 : sch.balance - drawnF,
      serviceStartBalance: sch.balance,
      serviceStartMonth: sch.S,
      termMonths: sch.N,
      graceMonths: sch.G,
      paymentsPerYear: sch.ppy,
      amortizationType: f.amortization,
      annuityPayment: sch.annuityPayment,
      principalPayment: sch.principalPayment,
      totalInterest: totalInterestF,
      totalService: totalServiceF,
      monthly: { draws: ledger.draws[f.id], interest: sch.interest, principal: sch.principal, service: sch.service, balance: sch.balanceArr },
    };
  });
  const primaryIdx = Math.max(0, facilities.findIndex((f) => !isNote(f)));
  const primary = facilityResults[primaryIdx];
  let idc = 0;
  let totalInterest = 0;
  let totalService = 0;
  for (const fr of facilityResults) {
    idc += fr.idc;
    totalInterest += fr.totalInterest;
    totalService += fr.totalService;
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
  // The DSCR computes on the COMBINED service stream. The note's receipt and installments leave the
  // collections-side inflows (they are debt cash) and enter the service.
  const dscr: DscrRow[] = [];
  let minDscr: { year: number; value: number } | null = null;
  for (let y = 1; y <= totalYears; y++) {
    let inflows = 0;
    let ys = 0;
    for (let m = (y - 1) * 12 + 1; m <= y * 12 && m <= horizon; m++) {
      const raw = ctx.inflowsByMonth[m - 1] ?? 0;
      inflows += hasNote ? raw - noteDraws[m - 1] + noteService[m - 1] : raw;
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
    equityVec[m - 1] = net + finDraws[m - 1] - finService[m - 1];
  }
  let outlay = 0;
  const costFollowing = facilities.filter((f) => f.datedDraw === undefined);
  if (costFollowing.length === 1 && costFollowing[0].sharePct !== undefined) {
    const config = { sharePct: costFollowing[0].sharePct as number, perLineSharePct: costFollowing[0].perLineSharePct };
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
  } else {
    // the facility-list outlay: each line's incurred cost less the combined effective share
    ctx.costs.forEach((c) => {
      if (!isFundable(c)) return;
      let covered = 0;
      for (const f of costFollowing) covered += ledger.shares[f.id][c.id] ?? 0;
      for (const [, amount] of lineIncurred(c)) outlay += (1 - covered) * amount;
    });
  }
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
    const withoutFinancing = equityVec.map((v, i) => v - fundingCash[i] - finDraws[i] + finService[i]);
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
    serviceStartBalance: primary.serviceStartBalance,
    serviceStartMonth: primary.serviceStartMonth,
    termMonths: primary.termMonths,
    graceMonths: primary.graceMonths,
    amortizationType: primary.amortizationType,
    annuityPayment: primary.annuityPayment,
    principalPayment: primary.principalPayment,
    totalInterest,
    totalService,
    monthly: { interest, principal, service, balance: balanceArr },
    yearly,
    dscr,
    minDscr,
    equity,
    draws,
    facilities: facilityResults,
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
