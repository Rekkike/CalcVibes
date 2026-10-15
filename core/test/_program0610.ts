import type { ModelInputs } from "../src/types.js";

// v0.6.10 — the funding block, the book netting, the tariff spans, and the scenario axis.
// The whole-program port fixture per the directive's Task F (the same pinned fields the web
// demo of record carries); every asserted figure is a directive reproduction pin, verified
// against the engine at its own float spellings.
// v0.6.11: extracted to a shared module (the fixture values are byte-identical to the
// v0.6.10 delivered form) so other suites can import the fixture without re-registering
// this file's describe blocks under vitest.

export function programFixture0610(): ModelInputs {
  const liftsR1 = [200, 320, 380, ...new Array(18).fill(400)];
  const liftsR2 = [0, 0, 60, 90, 110, ...new Array(16).fill(120)];
  const liftsR3 = [0, 0, 0, 75, 112, 135, ...new Array(15).fill(150)];
  const liftsR4 = [0, 0, 0, 40, 60, 72, ...new Array(15).fill(80)];
  return {
    projectName: "Shore-power program (Rotterdam)",
    currency: "EUR",
    entryUnit: "millions",
    targetIrr: 6,
    costs: [
      { id: "p1", name: "Container shore power — engineering & studies (RSP JV)", category: "recurring", amount: 37000000, startYear: 1, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "p2", name: "Container shore power — OPS installations (RSP JV)", category: "recurring", amount: 55000000, startYear: 2, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "p3", name: "Container shore power — quay cabling & commissioning", category: "capex", amount: 100000000, startYear: 3, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "p4", name: "Market pillar — bulk & liquid berths", category: "recurring", amount: 31250000, startYear: 2, durationYears: 4, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 6 } },
      { id: "p5", name: "Cruise terminal shore power", category: "capex", amount: 20000000, startYear: 3, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "p6", name: "Inland & public berths", category: "recurring", amount: 4000000, startYear: 1, durationYears: 5, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 6 } },
    ],
    operatingLines: [
      { id: "o1", label: "Operations & maintenance", amount: 6000000, startYear: 4, yearCount: 20, escalation: 0 },
      { id: "o2", label: "Insurance, grid fees & platform", amount: 3000000, startYear: 4, yearCount: 20, escalation: 0 },
    ],
    repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 12, paymentEscalation: 0, balloon: 0, firstCollectionYear: 3, basisNote: "Monthly collections solved so the program earns the 6 percent target on the grant-netted private basis; sums vary by funding avenue." },
    appraisal: { wacc: 4, financeRate: 3.5, reinvestmentRate: 3.5, residual: { posture: "none", amount: 0, year: 24 } },
    maintenance: { mode: "off" },
    tariff: {
      mode: "decompose", escalationPerYear: 0,
      span: { startYear: 3, termYears: 20 },
      basisNote: "Per-kWh infrastructure surcharge recovering the net private program cost after grants; each segment carries its own operating span.",
      volumeUnitLabel: "GWh",
      priceUnitLabel: "€ct/kWh",
      priceDisplayDivisor: 10000,
      rows: [
        { id: "r1", label: "Deep-sea container berths", weight: 2, lifts: liftsR1 },
        { id: "r2", label: "Cruise terminal berths", weight: 1.5, lifts: liftsR2, span: { startYear: 5, termYears: 19 } },
        { id: "r3", label: "Bulk & liquid market berths", weight: 1, lifts: liftsR3, span: { startYear: 6, termYears: 18 } },
        { id: "r4", label: "Inland & public berths", weight: 0.5, lifts: liftsR4, span: { startYear: 6, termYears: 18 } },
      ],
      fixedAnnualAmount: null, manualPrices: null,
    },
    funding: { rows: [
      { id: "g1", label: "AFIF grant (EU)", kind: "grant", amount: 70000000, year: 3 },
      { id: "g2", label: "National shore-power grant", kind: "grant", amount: 100000000, year: 5 },
      { id: "g3", label: "Province & municipality grant", kind: "grant", amount: 3500000, year: 1 },
      { id: "l1", label: "Municipality interest-free note", kind: "interest-free-loan", amount: 10000000, year: 1, termYears: 10, repaymentStartYear: 4 },
    ] },
    financing: { enabled: true, sharePct: 0, perLineSharePct: { p1: 31.69, p2: 31.69, p3: 31.69 }, debtRatePct: 3.5, termYears: 20, graceYears: 3, serviceStartYear: null, amortization: "annuity", leveragedSolve: false },
  } as ModelInputs;
}
