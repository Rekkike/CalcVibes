import { describe, expect, it } from "vitest";
import { computeFinancingOverlay, computeFacilityOverlay, legacyFacilities, resolveFacilityLedger, validateFacilities, leveragedStreams } from "../src/financing.js";
import type { FinancingContext } from "../src/financing.js";
import type { CostLine, Facility, FinancingConfig, FundingRow } from "../src/types.js";

// v0.6.14 — the multi-facility core: the facility model, the draw order, the combined service
// stream and the note unification. Independent arithmetic is written out in each pin.
const costs = (): CostLine[] => [
  { id: "c1", name: "Quay", category: "capex", amount: 6000000, startYear: 1, durationYears: 1, escalation: 0 },
  { id: "c2", name: "Cabling", category: "capex", amount: 4000000, startYear: 2, durationYears: 1, escalation: 0 },
  { id: "c3", name: "Studies", category: "recurring", amount: 1200000, startYear: 1, durationYears: 2, escalation: 0 },
];
const TOTAL = 12400000; // 6M + 4M + 2.4M
const fac = (over: Partial<Facility> & { id: string }): Facility => ({
  label: over.id, amount: 1000000, ratePct: 0, termYears: 5, graceYears: 0, amortization: "equal-principal", serviceStartYear: 2, scope: { kind: "general" }, ...over,
});
const HORIZON = 120;
function ctxOf(over: Partial<FinancingContext> = {}): FinancingContext {
  const cs = costs();
  const costM = new Array<number>(HORIZON).fill(0);
  costM[11] += 6000000; costM[23] += 4000000;
  for (let m = 1; m <= 24; m++) costM[m - 1] += 100000;
  const inflows = new Array<number>(HORIZON).fill(0);
  for (let m = 25; m <= HORIZON; m++) inflows[m - 1] = 500000;
  return {
    costM, inflowsByMonth: inflows, netM: inflows.map((v, i) => v - costM[i]), horizon: HORIZON,
    targetMonthlyRate: Math.pow(1.08, 1 / 12) - 1, waccMonthlyRate: Math.pow(1.08, 1 / 12) - 1,
    firstCollectionYear: 2, lastCostMonth: 24, projectIrr: 0.08,
    costLineTotals: cs.map((c) => ({ id: c.id, total: c.category === "capex" ? c.amount : c.amount * c.durationYears })),
    costs: cs, fundingRows: [], ...over,
  };
}
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe("Task A: the facility model", () => {
  it("GENERAL: the amount spreads across every cost line by the incurred calendar; the shares derive; drift is zero", () => {
    const l = resolveFacilityLedger(costs(), [fac({ id: "g", amount: 6200000 })], HORIZON);
    for (const id of ["c1", "c2", "c3"]) near(l.shares.g[id], 0.5);
    near(l.drawn.g, 6200000);
    expect(Math.abs(l.drift.g as number)).toBeLessThan(1e-6);
    near(l.draws.g[11], 0.5 * 6000000 + 0.5 * 100000);
    near(l.draws.g[0], 0.5 * 100000);
    near(l.draws.g[23], 0.5 * 4000000 + 0.5 * 100000);
    near(sum(l.draws.g), 6200000);
  });

  it("GENERAL oversized: the draws never exceed the incurred costs; the drift is exposed, never silent", () => {
    const l = resolveFacilityLedger(costs(), [fac({ id: "g", amount: 20000000 })], HORIZON);
    near(l.drawn.g, TOTAL);
    near(l.drift.g as number, 20000000 - TOTAL);
    for (const id of ["c1", "c2", "c3"]) near(l.shares.g[id], 1);
  });

  it("ATTACHED: the draws follow the scoped lines alone; the cap binds at the scoped incurred cost", () => {
    const half = resolveFacilityLedger(costs(), [fac({ id: "a", amount: 3000000, scope: { kind: "attached", lineIds: ["c1"] } })], HORIZON);
    near(half.shares.a.c1, 0.5);
    expect(half.shares.a.c2).toBeUndefined();
    near(half.draws.a[11], 3000000);
    near(sum(half.draws.a), 3000000);
    expect(half.draws.a[23]).toBe(0);
    const capped = resolveFacilityLedger(costs(), [fac({ id: "a", amount: 9000000, scope: { kind: "attached", lineIds: ["c1"] } })], HORIZON);
    near(capped.drawn.a, 6000000);
    near(capped.drift.a as number, 3000000);
  });

  it("PARI PASSU: a general and an attached facility on the same line share its cost proportionally; no phantom draw", () => {
    const l = resolveFacilityLedger(costs(), [
      fac({ id: "g", amount: 6200000 }),
      fac({ id: "a", amount: 6000000, scope: { kind: "attached", lineIds: ["c1"] } }),
    ], HORIZON);
    // c1: general 0.5 + attached 1.0 = 1.5 > 1 -> scaled to 1/3 and 2/3
    near(l.shares.g.c1, 1 / 3);
    near(l.shares.a.c1, 2 / 3);
    near(l.shares.g.c2, 0.5);
    near(l.draws.a[11], 4000000);
    near(l.draws.g[11], 6000000 / 3 + 0.5 * 100000);
    near(l.draws.a[11] + l.draws.g[11] - 0.5 * 100000, 6000000);
    near(l.drawn.a, 4000000);
    near(l.drift.a as number, 2000000);
  });

  it("the legacy share path: explicit shares govern, the amount is derived, no drift", () => {
    const l = resolveFacilityLedger(costs(), [fac({ id: "s", amount: null, sharePct: 0, perLineSharePct: { c1: 50, c2: 25 } })], HORIZON);
    near(l.draws.s[11], 3000000);
    near(l.draws.s[23], 1000000);
    near(l.drawn.s, 4000000);
    expect(l.drift.s).toBeNull();
  });
});

describe("Task B: the service aggregation over the combined facility set", () => {
  const a = fac({ id: "A", amount: 6200000, termYears: 5, serviceStartYear: 2 });
  const b = fac({ id: "B", amount: 3000000, termYears: 3, graceYears: 1, serviceStartYear: 3, scope: { kind: "attached", lineIds: ["c1"] } });

  it("each facility services on its own term, grace and start; the combined stream is their sum", () => {
    const r = computeFacilityOverlay(ctxOf(), [a, b]);
    const [fa, fb] = r.facilities!;
    // A: S = 24, N = 60, no grace, rate 0: 6.2M / 60 per month over months 25..84
    near(fa.monthly.service[24], 6200000 / 60);
    near(fa.monthly.service[83], 6200000 / 60);
    expect(fa.monthly.service[84]).toBe(0);
    // B: S = 36, N = 36, grace 12: months 37..48 interest-only (zero), 49..72 principal 3M / 24
    expect(fb.monthly.service[40]).toBe(0);
    near(fb.monthly.service[48], 3000000 / 24);
    near(fb.monthly.service[71], 3000000 / 24);
    expect(fb.monthly.service[72]).toBe(0);
    for (let m = 1; m <= 120; m++) near(r.monthly.service[m - 1], fa.monthly.service[m - 1] + fb.monthly.service[m - 1]);
    near(r.totalService, 6200000 + 3000000);
    near(r.drawnTotal, 9200000);
    expect(r.facilities).toHaveLength(2);
  });

  it("the DSCR computes on the combined stream; the minimum DSCR is the minimum over the combined years", () => {
    const r = computeFacilityOverlay(ctxOf(), [a, b]);
    // inflows are 500000 per month from month 25: 6M per full year. Year 3 (months 25..36): A only.
    const y3 = r.dscr.find((d) => d.year === 3)!;
    near(y3.service, 12 * 6200000 / 60);
    near(y3.dscr as number, 6000000 / (12 * 6200000 / 60));
    // Year 5 (months 49..60): A plus B principal
    const y5 = r.dscr.find((d) => d.year === 5)!;
    near(y5.service, 12 * 6200000 / 60 + 12 * 3000000 / 24);
    near(y5.dscr as number, 6000000 / y5.service);
    let min = Infinity; let minYear = 0;
    for (const d of r.dscr) if (d.dscr !== null && d.dscr < min) { min = d.dscr; minYear = d.year; }
    expect(r.minDscr).toEqual({ year: minYear, value: min });
    expect(minYear).toBe(5);
    // a single-facility view would not have found the combined minimum
    const only = computeFacilityOverlay(ctxOf(), [a]);
    expect(only.minDscr!.value).toBeGreaterThan(r.minDscr!.value);
  });

  it("annual-payment facilities service at year ends", () => {
    const n = fac({ id: "N", amount: 1200000, termYears: 3, serviceStartYear: 2, paymentsPerYear: 1 });
    const r = computeFacilityOverlay(ctxOf(), [n]);
    const s = r.facilities![0].monthly.service;
    near(s[35], 400000); near(s[47], 400000); near(s[59], 400000);
    expect(s[24]).toBe(0);
    near(sum(s), 1200000);
  });

  it("the leveraged solve aggregates the debt PV streams across facilities (the sum of the per-facility streams)", () => {
    const rM = Math.pow(1.08, 1 / 12) - 1;
    const one = (f: Facility) => leveragedStreams(costs(), [f], rM, HORIZON, 2);
    const both = leveragedStreams(costs(), [a, b], rM, HORIZON, 2);
    near(both.pvDraws, one(a).pvDraws + one(b).pvDraws);
    near(both.pvService, one(a).pvService + one(b).pvService);
  });
});

describe("Task C: the note unification (the note is a zero-rate facility)", () => {
  const cfg: FinancingConfig = { enabled: true, sharePct: 50, debtRatePct: 6, termYears: 6, graceYears: 1, serviceStartYear: null, amortization: "annuity", leveragedSolve: false, perLineSharePct: {} };
  const note: FundingRow = { id: "l1", label: "Municipality note", kind: "interest-free-loan", amount: 2000000, year: 1, termYears: 4, repaymentStartYear: 3 };
  const grant: FundingRow = { id: "g1", label: "Grant", kind: "grant", amount: 1000000, year: 1 };

  it("the legacy adapter maps the shares to one general facility and the note to one zero-rate facility", () => {
    const list = legacyFacilities(cfg, [grant, note]);
    expect(list.map((f) => f.id)).toEqual(["financing", "l1"]);
    expect(list[0].origin).toBe("financing");
    expect(list[0].amount).toBeNull();
    expect(list[0].sharePct).toBe(50);
    expect(list[1]).toMatchObject({ origin: "funding-note", ratePct: 0, termYears: 4, graceYears: 0, paymentsPerYear: 1, amortization: "equal-principal", amount: 2000000, datedDraw: { year: 1 } });
    expect(legacyFacilities(cfg, [grant]).map((f) => f.id)).toEqual(["financing"]);
  });

  it("the installments leave the negative collections and enter the debt service; the DSCR is on the combined stream", () => {
    // the funding cash as the engine carries it in the project vector: grant and note receipts at year end,
    // the note installments as negative inflows at their months
    const rowsAll = [grant, note];
    const inflows = ctxOf().inflowsByMonth.slice();
    const legacyCash = new Array<number>(HORIZON).fill(0);
    for (const fr of rowsAll) {
      legacyCash[fr.year * 12 - 1] += fr.amount;
      if (fr.kind === "interest-free-loan") for (let k = 0; k < (fr.termYears ?? 1); k++) legacyCash[(fr.repaymentStartYear! + k) * 12 - 1] -= fr.amount / fr.termYears!;
    }
    const withCash = inflows.map((v, i) => v + legacyCash[i]);
    const r = computeFinancingOverlay(ctxOf({ inflowsByMonth: withCash, netM: withCash.map((v, i) => v - ctxOf().costM[i]), fundingRows: rowsAll }), cfg);
    const plain = computeFinancingOverlay(ctxOf({ inflowsByMonth: withCash, netM: withCash.map((v, i) => v - ctxOf().costM[i]), fundingRows: [grant] }), cfg);
    const noteF = r.facilities!.find((f) => f.id === "l1")!;
    // 4 annual installments of 500000 at months 36, 48, 60, 72 (years 3..6)
    for (const m of [36, 48, 60, 72]) near(noteF.monthly.service[m - 1], 500000);
    near(noteF.totalService, 2000000);
    near(noteF.drawnTotal, 2000000);
    near(noteF.monthly.draws[11], 2000000);
    // DSCR year 4: the numerator no longer carries the negative installment; the denominator gains it
    const y4 = r.dscr.find((d) => d.year === 4)!;
    const y4plain = plain.dscr.find((d) => d.year === 4)!;
    near(y4.inflows, 6000000);
    near(y4plain.inflows, 6000000 - 500000);
    near(y4.service, y4plain.service + 500000);
    // the equity vector is unchanged by the reclassification (the note cash is already in the net flow)
    near(r.equity.npvAtWacc, plain.equity.npvAtWacc);
    near(r.equity.npvAtTarget, plain.equity.npvAtTarget);
    expect(r.equity.irr).toEqual(plain.equity.irr);
    expect(r.equity.signChanges).toBe(plain.equity.signChanges);
  });
});

describe("the facility-list validation (collect-all, exact strings)", () => {
  const run = (fs: Facility[]) => {
    const issues: string[] = [];
    validateFacilities(fs, { costs: costs(), horizon: HORIZON, firstCollectionYear: 2 }, issues);
    return issues;
  };
  it("a clean list refuses nothing", () => expect(run([fac({ id: "ok" }), fac({ id: "ok2", scope: { kind: "attached", lineIds: ["c1"] } })])).toEqual([]));
  it("each defect refuses with its exact message, none suppressed", () => {
    expect(run([
      fac({ id: "x1", label: "Bad amount", amount: 0 }),
      fac({ id: "x2", label: "Bad term", termYears: 0 }),
      fac({ id: "x3", label: "Empty scope", scope: { kind: "attached", lineIds: [] } }),
      fac({ id: "x4", label: "Ghost line", scope: { kind: "attached", lineIds: ["c9"] } }),
      fac({ id: "x5", label: "Late start", serviceStartYear: 10 }),
      fac({ id: "x6", label: "Grace", graceYears: 5, termYears: 5 }),
    ])).toEqual([
      "Facility x1 (Bad amount) must carry a positive amount (FAC-AMOUNT).",
      "Facility x2 (Bad term) must carry a positive term (FAC-TERM).",
      "Facility x3 (Empty scope) is attached but names no cost line (FAC-SCOPE-EMPTY).",
      "Facility x4 (Ghost line) is attached to cost line c9, which does not exist (FAC-SCOPE-LINE).",
      "Facility x5 (Late start) has a service start year 10 whose month 120 is not below the model horizon 120 (FAC-SERVICE-START).",
      "Facility x6 (Grace) must carry a grace period strictly less than its term; got grace 5 against term 5 (FAC-GRACE).",
    ]);
  });
  it("a duplicate id and a non-positive rate floor refuse as well", () => {
    expect(run([fac({ id: "d" }), fac({ id: "d" })])).toEqual(["Facility d appears more than once in the facility list (FAC-ID)."]);
    expect(run([fac({ id: "r", label: "Rate", ratePct: -100 })])).toEqual(["Facility r (Rate) must carry a rate above -100 percent (FAC-RATE)."]);
  });
});
