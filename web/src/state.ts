import type {
  ContractParams, CostLine, Facility, MaintenanceConfig, ModelInputs, ModelResult, OperatingLine,
  TariffRow, TimelineActivity, TimelineBlock, TimelineDecisionPoint, TimelineEngineEvent, TimelinePhase, TimelineSource,
} from "../../core/src/types.js";
import templateFile from "../../data/template-project.json";
import { authoredContext, fundingRowsOf, legacyFacilities, migrateLegacyFinancing } from "../../core/src/financing.js";
import { percentOneForDisplay } from "./engine.js";

export const CURRENCIES = ["EUR", "USD", "GBP", "SEK", "NOK", "DKK"] as const;

export function blankProject(): ModelInputs {
  return {
    projectName: "",
    currency: "SEK",
    entryUnit: "thousands",
    targetIrr: 12,
    costs: [],
    repayment: { graceYears: 0, termYears: 7, paymentsPerYear: 1, paymentEscalation: 0, balloon: 0 },
  };
}

export interface ProjectSettings {
  startYear: number | null;
  currency?: string;
  scenarioTargets?: number[];
  scenarioTerms?: number[];
  scenarioBalloons?: number[];
  scenarioGrantScales?: number[];
}

export function spreadFill(total: number, firstYear: number, yearCount: number): Record<number, number> {
  const fill: Record<number, number> = {};
  if (yearCount <= 0) return fill;
  const base = total / yearCount;
  for (let k = 0; k < yearCount - 1; k++) {
    fill[firstYear + k] = base;
  }
  let assigned = 0;
  for (const v of Object.values(fill)) assigned += v;
  fill[firstYear + yearCount - 1] = total - assigned;
  return fill;
}

export function blankOperatingLine(id: string): OperatingLine {
  return { id, label: "", amount: 0, startYear: 1, yearCount: 1, escalation: 0 };
}

// v0.6.13 Task E (AUD-15): the one collision-proof id helper — the smallest unused positive
// integer under the prefix. A length-plus-one id collides after a deletion; this never does.
export function nextId(prefix: string, existing: string[]): string {
  const taken = new Set(existing);
  let n = 1;
  while (taken.has(prefix + n)) n++;
  return prefix + n;
}

export function nextOperatingId(lines: OperatingLine[]): string {
  return nextId("o", lines.map((l) => l.id));
}

export function yearHeader(k: number, startYear: number | null): string {
  return startYear === null ? "Year " + k : String(startYear + k - 1);
}

// Internal test template of record — the demo buttons no longer load this project (v0.6.7 rotation).
export function demoProject(): ModelInputs {
  return {
    projectName: templateFile.projectName,
    currency: ((templateFile as { settings?: { currency?: string } }).settings?.currency ?? (templateFile as { currency?: string }).currency ?? "SEK"),
    targetIrr: templateFile.targetIrr,
    costs: templateFile.costs.map((c) => ({
      ...c,
      category: c.category as CostLine["category"],
    })),
    repayment: { ...templateFile.repayment },
    operatingLines: templateFile.operatingLines ?? [],
    maintenance: ((m: { mode: string; percentPerYear?: number; fixedAnnualAmount?: number }): MaintenanceConfig =>
      m.mode === "percent" ? { mode: "percent", percentPerYear: m.percentPerYear } :
      m.mode === "fixed" ? { mode: "fixed", fixedAnnualAmount: m.fixedAnnualAmount } :
      { mode: "off" })(templateFile.maintenance ?? { mode: "off" }),
  };
}

// Internal test template of record — the demo buttons no longer load this project (v0.6.7 rotation).
export function multiLeaseProject(): ModelInputs {
  return {
    projectName: "Multi-lease example",
    currency: "SEK",
    entryUnit: "ones",
    targetIrr: 8,
    costs: [
      { id: "c1", name: "Depreciable assets", category: "capex", amount: 20000000, startYear: 1, durationYears: 1, escalation: 0, depreciation: { mode: "straight-line", years: 33 } },
      { id: "c2", name: "Retained assets (land and buildings)", category: "capex", amount: 80000000, startYear: 1, durationYears: 1, escalation: 0, depreciation: { mode: "retained" } },
      { id: "c3", name: "Build (3-year program)", category: "recurring", amount: 5000000, startYear: 1, durationYears: 3, escalation: 0 },
    ],
    repayment: { graceYears: 0, termYears: 15, paymentsPerYear: 1, paymentEscalation: 0, balloon: 0 },
    contracts: [
      { id: "k1", label: "Contract one", startYear: 4, termYears: 15, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved", reinvestments: [{ year: 4, amount: 3000000 }] },
      { id: "k2", label: "Contract two", startYear: 19, termYears: 15, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
      { id: "k3", label: "Lease three", startYear: 34, termYears: 20, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
    ],
    appraisal: { wacc: 6, financeRate: 5, reinvestmentRate: 5, residual: { mode: "calculated", amount: 0, year: 54 } },
  };
}

// v0.6.6 Task A: the third demo of record — a 2 MWp Swedish utility-scale solar park on a twenty-year
// PPA. Real-world grounding: parks above 500 kW cost roughly 6 000-9 000 kr per kW installed, so the
// 11.5 MSEK investment sits inside the benchmark band; the financing form of record is the fixed-price
// power purchase agreement per MWh over 10-20 year tenors, with real Swedish 20-year precedents, here
// settled monthly from project fulfillment; O&M benchmarks run at roughly $5-8 per kW-DC per year with
// land lease, insurance, and property costs of similar magnitude, so the two operating lines sum to
// roughly two percent of CAPEX per year; Swedish tax practice accepts a 20 percent straight-line
// book-corresponding depreciation basis, charged from commissioning in year 5.
export function solarParkProject(): ModelInputs {
  return {
    projectName: "Solar park example",
    currency: "SEK",
    entryUnit: "thousands",
    targetIrr: 7,
    costs: [
      { id: "c1", name: "Development & permitting", category: "recurring", amount: 300000, startYear: 1, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 5 } },
      { id: "c2", name: "Grid connection", category: "capex", amount: 1600000, startYear: 2, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 5 } },
      { id: "c3", name: "EPC - modules, inverters & mounting", category: "recurring", amount: 4000000, startYear: 3, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 5 } },
      { id: "c4", name: "Site works & fencing", category: "capex", amount: 1300000, startYear: 3, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 5 } },
    ],
    operatingLines: [
      { id: "o1", label: "O&M and monitoring", amount: 150000, startYear: 5, yearCount: 20, escalation: 1 },
      { id: "o2", label: "Land lease and insurance", amount: 180000, startYear: 5, yearCount: 20, escalation: 1 },
    ],
    repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 12, paymentEscalation: 0, balloon: 0 },
    appraisal: { wacc: 5, financeRate: 4, reinvestmentRate: 4, residual: { posture: "none", amount: 0, year: 24 } },
    maintenance: { mode: "off" },
  };
}


// v0.6.7 Task A: the port demo of record — shore power at a Rotterdam container terminal.
// Real-world grounding: the Port of Rotterdam Authority / Eneco shore power joint venture
// (ABB as installation partner; connection points along roughly 8 km of quay serving container
// vessels at APMT Maasvlakte II, ECT Delta, and ECT Euromax; an EIB loan of 90 M EUR inside a
// public co-funding package of roughly 160 M EUR, phased commissioning from 2028). The fixture
// models ONE terminal's share of the program and charges the full modeled cost base to the
// solved per-lift fee (the one-terminal full-recovery-fee assumption of record; the real program
// recovers across several terminals with public co-funding the app cannot model — finding F4).
// v0.6.8 Task D (finding W19): the yearly lift volumes are rescaled by 1,000 to yearly vessel
// moves at a terminal of this class — hundreds of thousands of container moves per year is the
// sourced order of magnitude (a deep-sea berth alone handles on the order of half a million to
// a million moves per year; the feeder share is comparable at smaller vessels). The per-call-sized
// 1,330/760 numbers were the composition-time miss of record; the rescale is harness-verified
// to leave every solved figure byte-identical, dividing only the unit price (€5.81 per lift).
export function shorePowerProject(): ModelInputs {
  return {
    projectName: "Shore power example (Rotterdam)",
    currency: "EUR",
    entryUnit: "millions",
    targetIrr: 6,
    costs: [
      { id: "c1", name: "Engineering, permits & studies", category: "recurring", amount: 6000000, startYear: 1, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "c2", name: "Substations & grid connections", category: "capex", amount: 48000000, startYear: 2, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "c3", name: "Shore power installations", category: "recurring", amount: 24000000, startYear: 2, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "c4", name: "Quay cabling & civil works", category: "capex", amount: 36000000, startYear: 3, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "c5", name: "Commissioning & ramp-up", category: "recurring", amount: 16000000, startYear: 3, durationYears: 1, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
    ],
    operatingLines: [
      { id: "o1", label: "Operations & maintenance", amount: 3600000, startYear: 4, yearCount: 20, escalation: 1 },
      { id: "o2", label: "Insurance, grid fees & platform", amount: 1400000, startYear: 4, yearCount: 20, escalation: 1 },
    ],
    repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 12, paymentEscalation: 0, balloon: 0, basisNote: "Monthly payments solved so the project earns the 6 percent target over 20 years; volumes are yearly vessel calls times lifts." },
    appraisal: { wacc: 4, financeRate: 3.5, reinvestmentRate: 3.5, residual: { posture: "none", amount: 0, year: 24 } },
    maintenance: { mode: "off" },
    tariff: { mode: "decompose", escalationPerYear: 0, basisNote: "Per-lift infrastructure surcharge recovering the full modeled program cost, including 20 years of operations and maintenance.", rows: [
      { id: "r1", label: "Deep-sea container vessel (8-24k TEU)", weight: 2, lifts: [110000, 840000, 1050000, 1190000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000, 1330000] },
      { id: "r2", label: "Feeder & medium vessel (3-8k TEU)", weight: 1, lifts: [60000, 480000, 600000, 680000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000, 760000] },
    ], fixedAnnualAmount: null, manualPrices: null },
  };
}

// v0.6.10 Task F: the whole-program port fixture — the new demo of record. Real-world grounding
// (the directive's grounding of record): the Port of Rotterdam shore-power strategy 2025–2035
// (€220M national subsidies available, €10M interest-free loans from the Municipality of
// Rotterdam, more than €20M invested by the Port Authority and Rotterdam Shore Power B.V.,
// €3.5M from the Province of South Holland and the municipality, 750 GWh annual demand); the
// EIB project page 20230181 (the container RSP JV pillar €284M real, EIB €90M signed
// 2026-03-11, AFIF roughly €70M); the RVO national scheme 2024–2026 (€170M for the AFIR
// categories across the Dutch seaports). The market pillar €125M is mirrored-historical; the
// cruise terminal €20M and the inland/public berths €20M are invented (the fixture
// architecture of record). The fields are identical to the core test fixture of record
// (programFixture0610) — every solved figure is a directive reproduction pin.
// v0.6.13.1: a decision gate of the decision-point set at a program year, seeded with the set's default title
// (the demo timelines record no outcomes: no decision is held yet).
function decisionGate(id: string, code: string, year: number): TimelineDecisionPoint {
  const dp = DECISION_POINT_SET.find((d) => d.code === code);
  return { id, title: dp?.title ?? "", year, code };
}

export function shorePowerProgram(): ModelInputs {
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
      { id: "p1", name: "Container shore power — engineering & studies (RSP JV)", group: "Container shore power", category: "recurring", amount: 37000000, startYear: 1, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "p2", name: "Container shore power — OPS installations (RSP JV)", group: "Container shore power", category: "recurring", amount: 55000000, startYear: 2, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "p3", name: "Container shore power — quay cabling & commissioning", group: "Container shore power", category: "capex", amount: 100000000, startYear: 3, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "p4", name: "Market pillar — bulk & liquid berths", group: "Market pillar", category: "recurring", amount: 31250000, startYear: 2, durationYears: 4, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 6 } },
      { id: "p5", name: "Cruise terminal shore power", group: "Cruise terminal", category: "capex", amount: 20000000, startYear: 3, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } },
      { id: "p6", name: "Inland & public berths", group: "Inland & public berths", category: "recurring", amount: 4000000, startYear: 1, durationYears: 5, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 6 } },
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
    // v0.6.13.1 Task B: the authored timeline of the demo (the full DP scale). Every span is read
    // from the program's own cost spans: the engineering and studies line runs years 1-2 (the
    // preparation, concluding at DP3); the OPS installations, the market pillar, the cruise and
    // inland segments and the quay cabling follow their cost lines; the detail-design lane is
    // left empty (no cost line is a separate design activity). The gates sit where the program's
    // facts put the decisions: preparation in years 1-2, execution from year 2 (the first
    // installation and market-pillar spend), the first commissioning and first collections in
    // year 3, delivery in year 4 (operations begin), construction complete, handover and closure
    // in year 5 (the last cost year). No gate outcome is recorded (no decision is held yet). The
    // engine-event milestones tie to the funding, the first collection year and construction
    // complete; two activity ties mark the container-pillar and cruise segments.
    timeline: {
      projectScale: "full",
      activities: [
        { id: "a1", label: "Container pillar: engineering & studies (RSP JV)", startYear: 1, endYear: 2, phase: "prestudy" },
        { id: "a2", label: "Container pillar: OPS installations (RSP JV)", startYear: 2, endYear: 3, phase: "production" },
        { id: "a3", label: "Container pillar: quay cabling & commissioning", startYear: 3, endYear: 3, phase: "production" },
        { id: "a4", label: "Market pillar: bulk & liquid berths", startYear: 2, endYear: 5, phase: "production" },
        { id: "a5", label: "Cruise terminal shore power", startYear: 3, endYear: 3, phase: "production" },
        { id: "a6", label: "Inland & public berths", startYear: 1, endYear: 5, phase: "production" },
      ],
      decisionPoints: [
        decisionGate("d1", "DP1", 1), decisionGate("d2", "DP2", 1), decisionGate("d3", "DP3", 2), decisionGate("d4", "DP4", 2),
        decisionGate("d5", "DP5", 3), decisionGate("d6", "DP6", 4), decisionGate("d7", "DP7", 5), decisionGate("d8", "DP8", 5),
      ],
      milestones: [
        { id: "m1", label: "Funding received (the province grant and the public note)", year: 1, tie: { kind: "engine-event", event: "funding-received" } },
        { id: "m2", label: "Container pillar OPS installations complete", year: 3, tie: { kind: "activity", activityId: "a2" } },
        { id: "m3", label: "Cruise terminal commissioned", year: 3, tie: { kind: "activity", activityId: "a5" } },
        { id: "m4", label: "First collection year: phased commissioning", year: 3, tie: { kind: "engine-event", event: "first-collection-year" } },
        { id: "m5", label: "Construction complete", year: 5, tie: { kind: "engine-event", event: "construction-complete" } },
      ],
    },
  } as ModelInputs;
}

// v0.6.7 Task A: the land demo of record — a newbuild including the ground at Mjøstårnet, Brumunddal.
// Real-world grounding: the 18-storey, 85.4 m timber tower by AB Invest and HENT, a total-enterprise
// construction contract reported at roughly NOK 500 million excluding VAT, hosting the Wood Hotel,
// offices, apartments, and a restaurant. The fixture models the hotel and office/restaurant leases
// with the site acquisition retained and a book-value exit at year 23, and EXCLUDES the apartment
// sales (the apartments were sold, not leased; the app has no mid-project one-time disposal
// concept — finding F6); the remaining owner costs sit outside the model.
export function landNewbuildProject(): ModelInputs {
  return {
    projectName: "Mjøstårnet example",
    currency: "NOK",
    entryUnit: "millions",
    targetIrr: 8,
    costs: [
      { id: "c1", name: "Site acquisition (lakeside plot)", group: "Site", category: "capex", amount: 45000000, startYear: 1, durationYears: 0, escalation: 0, depreciation: { mode: "retained" } },
      { id: "c2", name: "Turnkey construction (18-storey timber tower)", group: "Building", category: "recurring", amount: 160000000, startYear: 1, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 33, startYear: 3 } },
      { id: "c3", name: "Interior & hotel fit-out", group: "Building", category: "capex", amount: 55000000, startYear: 2, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 3 } },
    ],
    operatingLines: [
      { id: "o1", label: "Property management & maintenance", amount: 4500000, startYear: 3, yearCount: 20, escalation: 2 },
      { id: "o2", label: "Insurance, property tax & utilities", amount: 3500000, startYear: 3, yearCount: 20, escalation: 1 },
    ],
    repayment: { graceYears: 1, termYears: 20, paymentsPerYear: 12, paymentEscalation: 0, balloon: 0 },
    contracts: [
      { id: "k1", label: "Hotel lease (Wood Hotel)", startYear: 3, termYears: 20, paymentsPerYear: 12, graceYears: 0, escalationPerYear: 1.5, balloon: 0, mode: "solved", reinvestments: [] },
      { id: "k2", label: "Office & restaurant leases", startYear: 3, termYears: 10, paymentsPerYear: 12, graceYears: 0, escalationPerYear: 1.5, balloon: 0, mode: "solved", reinvestments: [] },
    ],
    appraisal: { wacc: 5, financeRate: 4, reinvestmentRate: 4, residual: { mode: "calculated", amount: 0, year: 23 } },
    maintenance: { mode: "off" },
    // v0.6.13.1 Task B: the authored timeline of the demo (the full DP scale). Program years are
    // 1-based and the turnkey cost starts in year 1, so the prestudy-and-design lanes open in
    // year 1 alongside the construction (they cannot precede it): the site acquisition is the
    // prestudy (its cost line, year 1), the design sits inside the total-enterprise contract (the
    // fixture's own contract form), and the turnkey construction and the fit-out follow their cost
    // spans. The preparation gates fall in year 1, execution starts in year 1 (the turnkey cost),
    // the mid-construction review and the delivery approval in year 2 (construction complete),
    // handover and closure in year 3 (the leases and operations begin). No gate outcome is
    // recorded; the engine-event milestones tie to construction complete and the first collection
    // year (the project has no funding block).
    timeline: {
      projectScale: "full",
      activities: [
        { id: "a1", label: "Site acquisition and prestudy (lakeside plot)", startYear: 1, endYear: 1, phase: "prestudy" },
        { id: "a2", label: "Design within the total-enterprise contract", startYear: 1, endYear: 1, phase: "detail-design" },
        { id: "a3", label: "Turnkey construction (18-storey timber tower)", startYear: 1, endYear: 2, phase: "production" },
        { id: "a4", label: "Interior & hotel fit-out", startYear: 2, endYear: 2, phase: "production" },
      ],
      decisionPoints: [
        decisionGate("d1", "DP1", 1), decisionGate("d2", "DP2", 1), decisionGate("d3", "DP3", 1), decisionGate("d4", "DP4", 1),
        decisionGate("d5", "DP5", 2), decisionGate("d6", "DP6", 2), decisionGate("d7", "DP7", 3), decisionGate("d8", "DP8", 3),
      ],
      milestones: [
        { id: "m1", label: "Hotel fit-out complete", year: 2, tie: { kind: "activity", activityId: "a4" } },
        { id: "m2", label: "Construction complete", year: 2, tie: { kind: "engine-event", event: "construction-complete" } },
        { id: "m3", label: "First collection year: the leases begin", year: 3, tie: { kind: "engine-event", event: "first-collection-year" } },
      ],
    },
  };
}

export function nextCostId(costs: CostLine[]): string {
  return nextId("c", costs.map((c) => c.id));
}

export function blankContract(id: string, startYear: number): ContractParams {
  return {
    id,
    label: "Contract",
    startYear,
    termYears: 15,
    paymentsPerYear: 1,
    graceYears: 0,
    escalationPerYear: 0,
    balloon: 0,
    mode: "solved",
    reinvestments: [],
  };
}

export function nextContractId(contracts: ContractParams[]): string {
  return nextId("k", contracts.map((c) => c.id));
}

export function blankCostLine(id: string): CostLine {
  return { id, name: "", category: "recurring", amount: 0, startYear: 1, durationYears: 1, escalation: 0 };
}


// ---------------------------------------------------------------------------------------------
// v0.6.13 — the timeline (the decision-point planning layer). Pure helpers; the engine never reads
// the block. Years are program years (1-based, the engine's indexing).
// ---------------------------------------------------------------------------------------------

// v0.6.13.2: the curated default phase vocabulary of record, seven phases in definition order. A
// block without its own phases list reads these (timelineOf); the block may carry additions.
export const TIMELINE_PHASES: { id: TimelinePhase; label: string }[] = [
  { id: "prestudy", label: "Prestudy" },
  { id: "detail-design", label: "Detail design" },
  { id: "production", label: "Production" },
  { id: "revenue", label: "Revenue" },
  { id: "funding", label: "Funding" },
  { id: "financing", label: "Financing" },
  { id: "operations", label: "Operations" },
];

// The decision-point vocabulary of record: eight English-titled decision points, DP1 through DP8.
// The default titles are user-overridable labels.
export const DECISION_POINT_SET: { code: string; title: string }[] = [
  { code: "DP1", title: "Decision to start the project and initiate preparations" },
  { code: "DP2", title: "Decision to continue, abort, or redo preparation work" },
  { code: "DP3", title: "Decision that the basis is sufficient to commit to the remaining part of the project" },
  { code: "DP4", title: "Decision to start execution" },
  { code: "DP5", title: "Decision to continue or change the project commitment" },
  { code: "DP6", title: "Decision to approve delivery of the project's partial or final results" },
  { code: "DP7", title: "Decision to approve handover of responsibility for the project's results to operations" },
  { code: "DP8", title: "Decision to close the project" },
];

// The full scale carries DP1 through DP8; the mini scale the condensed four-point set.
export const DECISION_SCALE_CODES: Record<"mini" | "full", string[]> = {
  full: ["DP1", "DP2", "DP3", "DP4", "DP5", "DP6", "DP7", "DP8"],
  mini: ["DP1", "DP3", "DP4", "DP8"],
};

export const DECISION_DISCLOSURE = "The decision points follow the DP1–DP8 decision-point scale; this application does not implement or certify any external project-management methodology.";

export const TIMELINE_EVENT_LABELS: Record<TimelineEngineEvent, string> = {
  "construction-complete": "Construction complete",
  "first-collection-year": "First collection year",
  "funding-received": "Funding received",
};

export function emptyTimeline(): TimelineBlock {
  return { projectScale: "full", activities: [], decisionPoints: [], milestones: [] };
}

// A normalized view of the (possibly partial) block: absent collections read as empty and the
// scale defaults to "full".
// v0.6.13.2: an absent phases list reads as the curated defaults; the lane visibility rides through
// untouched (an absent map stays absent: every lane is automatic).
export function timelineOf(inputs: ModelInputs): TimelineBlock {
  const t = inputs.timeline;
  return {
    projectScale: t?.projectScale ?? "full",
    phases: t?.phases ?? TIMELINE_PHASES.map((p) => ({ ...p })),
    ...(t?.laneVisibility !== undefined ? { laneVisibility: t.laneVisibility } : {}),
    activities: t?.activities ?? [],
    decisionPoints: t?.decisionPoints ?? [],
    milestones: t?.milestones ?? [],
  };
}

// The phase vocabulary the block reads (always populated by timelineOf).
export const phasesOf = (tl: TimelineBlock): { id: string; label: string }[] => tl.phases ?? TIMELINE_PHASES;

// The vocabulary issues, section-level (not timeline refusal codes): a duplicate id in a
// hand-edited file is named here and refused at the add-phase affordance.
export function phaseVocabularyIssues(tl: TimelineBlock): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const p of phasesOf(tl)) {
    if (seen.has(p.id)) dup.add(p.id);
    seen.add(p.id);
  }
  return [...dup].map((id) => `The phase id "${id}" appears more than once in the phase vocabulary: rename or delete the duplicate so every phase id is unique.`);
}

// The activities that reference a phase (the delete guard names them).
export const activitiesInPhase = (tl: TimelineBlock, phaseId: string): TimelineActivity[] => tl.activities.filter((a) => a.phase === phaseId);

// The lanes the Gantt composes, in vocabulary order: an explicit true renders the lane even when
// empty, an explicit false hides it, an absent entry renders it when it carries at least one
// activity (presentation-only; the block is never altered).
export function visibleLanes(tl: TimelineBlock): { id: string; label: string; activities: TimelineActivity[] }[] {
  return phasesOf(tl)
    .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
    .map((p) => ({ id: p.id, label: p.label, activities: activitiesInPhase(tl, p.id) }))
    .filter((l) => {
      const v = tl.laneVisibility?.[l.id];
      return v === undefined ? l.activities.length > 0 : v;
    });
}

// A timeline is authored when the block carries at least one object; an empty block is the
// empty state and the deck omits the slide.
export function timelineAuthored(inputs: ModelInputs): boolean {
  const t = timelineOf(inputs);
  return t.activities.length + t.decisionPoints.length + t.milestones.length > 0;
}

// v0.6.13.1: the cost-program suggestion — a pure derivation of one activity per cost line (the
// one-click starting draft; never silent auto-population, never a merge into authored work).
// Operating lines are excluded (a separate block, an operating cost). The span follows the
// engine's own conventions: a recurring line runs startYear..startYear + ceil(duration) - 1 (a
// 2.5-year duration is charged as three years); a CAPEX lump is its start year; a CAPEX line
// with per-year overrides spans min..max of the override-year keys (the profile IS its program,
// the inert startYear ignored); a recurring line's overrides refine amounts inside the nominal
// span and never extend it (the engine refuses an override outside the span). The phase is not
// derivable from a cost line, so every entry enters as production; no gates and no milestones
// are derived.
// v0.6.13.2: every suggestion helper is pure and takes the ids already taken by the activities that
// stay (the hand-authored and the other sources' entries), so the shared nextId never collides; the
// entries carry their source marker.
export function suggestActivitiesFromCosts(inputs: ModelInputs, takenIds: string[] = []): TimelineActivity[] {
  const out: TimelineActivity[] = [];
  const nid = () => nextId("a", [...takenIds, ...out.map((a) => a.id)]);
  for (const c of inputs.costs) {
    let startYear: number;
    let endYear: number;
    const overrideYears = c.yearOverrides === undefined ? [] : Object.keys(c.yearOverrides).map(Number);
    if (c.category === "capex") {
      if (overrideYears.length > 0) {
        startYear = Math.min(...overrideYears);
        endYear = Math.max(...overrideYears);
      } else {
        startYear = c.startYear;
        endYear = c.startYear;
      }
    } else {
      startYear = c.startYear;
      endYear = c.startYear + Math.max(1, Math.ceil(c.durationYears)) - 1;
    }
    out.push({ id: nid(), label: c.name, startYear, endYear, phase: "production", derivedFrom: "cost-program" });
  }
  return out;
}

const wholeYears = (n: number): number => Math.max(1, Math.ceil(n));

// v0.6.13.2 Task B.2: one activity per contract (startYear..startYear + termYears - 1) plus one
// short activity per reinvestment (year..year, "<contract label> — reinvestment"); phase revenue.
export function suggestActivitiesFromContracts(inputs: ModelInputs, takenIds: string[] = []): TimelineActivity[] {
  const out: TimelineActivity[] = [];
  const nid = () => nextId("a", [...takenIds, ...out.map((a) => a.id)]);
  for (const k of inputs.contracts ?? []) {
    out.push({ id: nid(), label: k.label, startYear: k.startYear, endYear: k.startYear + wholeYears(k.termYears) - 1, phase: "revenue", derivedFrom: "contracts" });
    for (const r of k.reinvestments ?? []) {
      out.push({ id: nid(), label: `${k.label} — reinvestment`, startYear: r.year, endYear: r.year, phase: "revenue", derivedFrom: "contracts" });
    }
  }
  return out;
}

// v0.6.13.2 Task B.3: one activity per funding row — a grant is its lump year; an interest-free
// note spans the draw to the final repayment, year..(repaymentStartYear ?? year) + (termYears ?? 1)
// - 1 (the end never falls before the draw year); phase funding.
export function suggestActivitiesFromFunding(inputs: ModelInputs, takenIds: string[] = []): TimelineActivity[] {
  const out: TimelineActivity[] = [];
  const nid = () => nextId("a", [...takenIds, ...out.map((a) => a.id)]);
  for (const r of fundingRowsOf(inputs)) {
    const endYear = r.kind === "grant" ? r.year : Math.max(r.year, (r.repaymentStartYear ?? r.year) + wholeYears(r.termYears ?? 1) - 1);
    out.push({ id: nid(), label: r.label, startYear: r.year, endYear, phase: "funding", derivedFrom: "funding" });
  }
  return out;
}

// v0.6.13.2 Task B.4: one activity "Debt facility". A declared serviceStartYear spans
// serviceStartYear..serviceStartYear + termYears - 1; an undeclared one reads the solved model's
// service start, ceil(serviceStartMonth / 12). Returns null while the facility is off or the start
// needs a solved model that is not available (the caller disables the button with the reason).
// v0.6.16: the debt facilities the suggestion reads — the authored list when the document carries
// one (the migrated shape), else the legacy financing block through the adapter.
const debtFacilitiesOf = (inputs: ModelInputs): Facility[] => {
  const ctx = authoredContext(inputs);
  if (ctx !== null) return ctx.debt;
  return inputs.financing !== undefined && inputs.financing.enabled ? legacyFacilities(inputs.financing, []) : [];
};
export function financingSuggestionBlock(inputs: ModelInputs, result: ModelResult | null): string | null {
  const debt = debtFacilitiesOf(inputs);
  if (debt.length === 0) return "The debt facility is off: enable financing to derive its activity.";
  if (debt.some((f) => f.serviceStartYear === null) && (result === null || result.financing === null)) {
    return "The service start is derived from the solved model: resolve the model's input issues first, or set a service start year.";
  }
  return null;
}
export function suggestActivitiesFromFinancing(inputs: ModelInputs, result: ModelResult | null, takenIds: string[] = []): TimelineActivity[] {
  if (financingSuggestionBlock(inputs, result) !== null) return [];
  const debt = debtFacilitiesOf(inputs);
  const out: TimelineActivity[] = [];
  for (const f of debt) {
    const fr = result?.financing?.facilities?.find((x) => x.id === f.id);
    const start = f.serviceStartYear !== null ? f.serviceStartYear : Math.ceil((fr !== undefined ? fr.serviceStartMonth : (result as ModelResult).financing!.serviceStartMonth) / 12);
    out.push({ id: nextId("a", [...takenIds, ...out.map((a) => a.id)]), label: debt.length === 1 ? "Debt facility" : f.label, startYear: start, endYear: start + wholeYears(f.termYears) - 1, phase: "financing", derivedFrom: "financing" });
  }
  return out;
}

// v0.6.13.2 Task B.5: one activity per operating line (startYear..startYear + yearCount - 1);
// phase operations.
export function suggestActivitiesFromOperating(inputs: ModelInputs, takenIds: string[] = []): TimelineActivity[] {
  const out: TimelineActivity[] = [];
  const nid = () => nextId("a", [...takenIds, ...out.map((a) => a.id)]);
  for (const l of inputs.operatingLines ?? []) {
    out.push({ id: nid(), label: l.label, startYear: l.startYear, endYear: l.startYear + wholeYears(l.yearCount) - 1, phase: "operations", derivedFrom: "operating" });
  }
  return out;
}

// v0.6.13.2 Task B.6: one activity per tariff row carrying an explicit span (row.span, else the
// common tariff.span), startYear..startYear + termYears - 1; phase revenue. With no span declared
// anywhere the grid is repayment-shaped, not year-pinned at the input level, so nothing derives.
const tariffRowSpan = (inputs: ModelInputs, row: TariffRow) => row.span ?? inputs.tariff?.span ?? null;
export function tariffSuggestionBlock(inputs: ModelInputs): string | null {
  const t = inputs.tariff;
  if (t === undefined || t.rows.length === 0 || !t.rows.some((r) => tariffRowSpan(inputs, r) !== null)) {
    return "No tariff span is declared: the tariff grid is repayment-shaped rather than year-pinned, so declare a tariff span (or a row span) to derive activities.";
  }
  return null;
}
export function suggestActivitiesFromTariff(inputs: ModelInputs, takenIds: string[] = []): TimelineActivity[] {
  const out: TimelineActivity[] = [];
  const nid = () => nextId("a", [...takenIds, ...out.map((a) => a.id)]);
  for (const row of inputs.tariff?.rows ?? []) {
    const s = tariffRowSpan(inputs, row);
    if (s === null) continue;
    out.push({ id: nid(), label: row.label, startYear: s.startYear, endYear: s.startYear + wholeYears(s.termYears) - 1, phase: "revenue", derivedFrom: "tariff" });
  }
  return out;
}

// The per-source replace: exactly the activities carrying the source marker are replaced by the
// derived entries; hand-authored activities and the other sources' entries are preserved in place.
export function replaceSourceActivities(existing: TimelineActivity[], source: TimelineSource, derived: TimelineActivity[]): TimelineActivity[] {
  return [...existing.filter((a) => a.derivedFrom !== source), ...derived];
}
export const sourceHasActivities = (tl: TimelineBlock, source: TimelineSource): boolean => tl.activities.some((a) => a.derivedFrom === source);

// A suggestion may reference a default phase the user deleted from the vocabulary: the commit
// re-adds the curated phase so the entries never go stale.
export function ensurePhases(tl: TimelineBlock, derived: TimelineActivity[]): { id: string; label: string }[] {
  const have = phasesOf(tl);
  const add = TIMELINE_PHASES.filter((p) => derived.some((a) => a.phase === p.id) && !have.some((h) => h.id === p.id));
  return [...have, ...add];
}

// The next unused decision point of the scale's set (the default for an added gate), or null when the set
// is exhausted.
export function nextUnusedDecisionPoint(tl: TimelineBlock): { code: string; title: string } | null {
  const used = new Set(tl.decisionPoints.map((d) => d.code).filter((c): c is string => c !== undefined));
  for (const code of DECISION_SCALE_CODES[tl.projectScale ?? "full"]) {
    if (!used.has(code)) {
      const dp = DECISION_POINT_SET.find((d) => d.code === code);
      if (dp !== undefined) return dp;
    }
  }
  return null;
}

// The program span in years: the declared project length when declared, else the derived
// horizon — the span the engine composes. Null while the model has no result.
export function programSpanYears(inputs: ModelInputs, result: ModelResult | null): number | null {
  if (result === null) return null;
  if (inputs.projectLengthYears !== undefined && inputs.projectLengthYears !== null) return inputs.projectLengthYears;
  return result.horizon?.totalYears ?? Math.ceil(result.monthly.length / 12);
}

// The engine events that compose for this project, with their program years, read from the solved
// model (read-only; the ties never alter the model):
//   construction-complete -> result.lastCostYear (the last year any cost line burns);
//   first-collection-year -> the first collection year: the first profile year (firstPaymentMonth)
//     in a collections profile, the earliest contract start (contractsInfo[].startYear) in
//     contracts mode, the first grid year (tariffYears[0].year) in a tariff mode, else
//     result.repaymentStartYear;
//   funding-received -> the earliest funding row year (fundingView.rows[].year), only when the
//     project carries a funding block.
export function availableEngineEvents(inputs: ModelInputs, result: ModelResult | null): { event: TimelineEngineEvent; year: number }[] {
  if (result === null) return [];
  const out: { event: TimelineEngineEvent; year: number }[] = [{ event: "construction-complete", year: result.lastCostYear }];
  const profile = inputs.repayment.collectionsOverrides !== undefined && Object.keys(inputs.repayment.collectionsOverrides).length > 0;
  let firstCollection = result.repaymentStartYear;
  if (profile) firstCollection = Math.ceil(result.firstPaymentMonth / 12);
  else if ((inputs.contracts ?? []).length > 0 && (result.contractsInfo ?? []).length > 0) firstCollection = Math.min(...(result.contractsInfo ?? []).map((c) => c.startYear));
  else if (result.tariffYears.length > 0) firstCollection = result.tariffYears[0].year;
  out.push({ event: "first-collection-year", year: firstCollection });
  const fundingRows = result.fundingView?.rows ?? [];
  if (fundingRows.length > 0) out.push({ event: "funding-received", year: Math.min(...fundingRows.map((r) => r.year)) });
  return out;
}

export interface TimelineRefusal {
  code: "TIMELINE-ACTIVITY-SPAN" | "TIMELINE-ACTIVITY-ORDER" | "TIMELINE-GATE-SPAN" | "TIMELINE-MILESTONE-SPAN" | "TIMELINE-MILESTONE-TIE" | "TIMELINE-PHASE-UNKNOWN";
  message: string;
}

// The section-local refusals (never compute-blocking): data-driven, cause and check in one
// sentence, the true span carried. With no solved model the span is unknown and the refusals
// stand down (the input-issues panel governs).
export function validateTimeline(inputs: ModelInputs, result: ModelResult | null): TimelineRefusal[] {
  const span = programSpanYears(inputs, result);
  if (span === null) return [];
  const tl = timelineOf(inputs);
  const out: TimelineRefusal[] = [];
  // v0.6.13.2: the stale-phase guard — an activity whose phase is not in the block's vocabulary (a
  // hand-edited project file) is refused by name, regardless of source.
  const vocabulary = new Set(phasesOf(tl).map((p) => p.id));
  for (const a of tl.activities) {
    if (!vocabulary.has(a.phase)) {
      out.push({ code: "TIMELINE-PHASE-UNKNOWN", message: `Activity ${a.id} (${a.label}) carries the phase "${a.phase}", which is not in the block's phase vocabulary (${phasesOf(tl).map((p) => p.id).join(", ") || "none"}): choose one of those phases or add the phase to the vocabulary (TIMELINE-PHASE-UNKNOWN).` });
    }
  }
  const inSpan = (y: number) => Number.isInteger(y) && y >= 1 && y <= span;
  const spanText = `the program span of years 1–${span}`;
  for (const a of tl.activities) {
    if (!inSpan(a.startYear) || !inSpan(a.endYear)) {
      out.push({ code: "TIMELINE-ACTIVITY-SPAN", message: `Activity ${a.id} (${a.label}) runs years ${a.startYear}–${a.endYear}, outside ${spanText}: set whole years inside the span or widen the project length (TIMELINE-ACTIVITY-SPAN).` });
    }
    if (a.startYear > a.endYear) {
      out.push({ code: "TIMELINE-ACTIVITY-ORDER", message: `Activity ${a.id} (${a.label}) starts in year ${a.startYear}, after it ends in year ${a.endYear}: set the start year at or before the end year (TIMELINE-ACTIVITY-ORDER).` });
    }
  }
  for (const d of tl.decisionPoints) {
    if (!inSpan(d.year)) {
      out.push({ code: "TIMELINE-GATE-SPAN", message: `Decision point ${d.id} (${d.title}) falls in year ${d.year}, outside ${spanText}: set a whole year inside the span or widen the project length (TIMELINE-GATE-SPAN).` });
    }
  }
  const events = availableEngineEvents(inputs, result);
  for (const m of tl.milestones) {
    if (!inSpan(m.year)) {
      out.push({ code: "TIMELINE-MILESTONE-SPAN", message: `Milestone ${m.id} (${m.label}) falls in year ${m.year}, outside ${spanText}: set a whole year inside the span or widen the project length (TIMELINE-MILESTONE-SPAN).` });
    }
    if (m.tie !== undefined && m.tie.kind === "activity") {
      const aid = m.tie.activityId;
      if (!tl.activities.some((a) => a.id === aid)) {
        const present = tl.activities.map((a) => a.id).join(", ");
        out.push({ code: "TIMELINE-MILESTONE-TIE", message: `Milestone ${m.id} (${m.label}) is tied to activity ${aid}, which does not exist; the activities present are ${present === "" ? "none" : present}: tie it to one of them or clear the tie (TIMELINE-MILESTONE-TIE).` });
      }
    } else if (m.tie !== undefined && m.tie.kind === "engine-event") {
      const ev = m.tie.event;
      if (!events.some((e) => e.event === ev)) {
        const present = events.map((e) => e.event).join(", ");
        out.push({ code: "TIMELINE-MILESTONE-TIE", message: `Milestone ${m.id} (${m.label}) is tied to the engine event ${ev}, which does not compose for this project; the events available are ${present === "" ? "none" : present}: tie it to one of them or clear the tie (TIMELINE-MILESTONE-TIE).` });
      }
    }
  }
  return out;
}


// ---------------------------------------------------------------------------------------------
// v0.6.15 — the investment composition. The group aggregation composes ONCE here; the deck model
// (and through it the Presentation and the print route) consumes it and never recomputes it.
// ---------------------------------------------------------------------------------------------

const CATEGORY_LABELS: Record<CostLine["category"], string> = { recurring: "Recurring", capex: "CAPEX" };

// A cost line's group: the trimmed free-text label, or the category label when the label is empty
// or whitespace-only.
export function groupLabelOf(c: CostLine): string {
  const g = (c.group ?? "").trim();
  return g === "" ? CATEGORY_LABELS[c.category] : g;
}

export interface InvestmentSegment {
  id: string;
  name: string;
  kind: "capital" | "operating" | "reinvestments";
  total: number;
  // capital lines only: the group the line belongs to
  group?: string;
}

export interface InvestmentComposition {
  // every capital cost line in the delivered composition order
  lines: InvestmentSegment[];
  // the capital lines aggregated by group, in first-appearance order
  groups: InvestmentSegment[];
  operating: InvestmentSegment | null;
  reinvestments: InvestmentSegment | null;
  // the gross capital program: the sum of the capital lines (the figure the funding block emits)
  capitalSubtotal: number;
  totalCost: number;
}

export function composeInvestment(inputs: ModelInputs, result: ModelResult): InvestmentComposition {
  const lines: InvestmentSegment[] = result.lineTotals.map((l) => {
    const cost = inputs.costs.find((c) => c.id === l.id);
    return { id: l.id, name: l.name, kind: "capital" as const, total: l.total, group: cost !== undefined ? groupLabelOf(cost) : "Recurring" };
  });
  const groups: InvestmentSegment[] = [];
  for (const line of lines) {
    const existing = groups.find((g) => g.name === line.group);
    if (existing !== undefined) existing.total += line.total;
    else groups.push({ id: "group:" + groups.length, name: line.group as string, kind: "capital", total: line.total });
  }
  const reinvestmentsTotal = (result.contractsInfo ?? []).reduce((a, c) => a + c.reinvestments.reduce((b, ri) => b + ri.amount, 0), 0);
  return {
    lines,
    groups,
    operating: result.operatingTotal > 0 ? { id: "operating", name: "Operating lines", kind: "operating", total: result.operatingTotal } : null,
    reinvestments: reinvestmentsTotal > 0 ? { id: "reinvestments", name: "Reinvestments", kind: "reinvestments", total: reinvestmentsTotal } : null,
    capitalSubtotal: result.lineTotals.reduce((a, l) => a + l.total, 0),
    totalCost: result.totalCost,
  };
}

// ---------------------------------------------------------------------------------------------
// v0.6.16 — the facility input surface: the load migration, the authoring seams and the amount-first
// composition (the derived shares, the drawn total, the engine-exposed drift).
// ---------------------------------------------------------------------------------------------

// The web load path consumes the migration composed once in the core: a legacy document migrates in
// memory to the authored shape (the files on disk stay legacy-shaped).
export const migrateOnLoad = (inputs: ModelInputs): ModelInputs => migrateLegacyFinancing(inputs);

export const facilitiesOf = (inputs: ModelInputs): Facility[] => inputs.facilities ?? [];

export function blankFacility(existing: Facility[]): Facility {
  return {
    id: nextId("fac", existing.map((f) => f.id)),
    label: "",
    amount: 0,
    ratePct: 6,
    termYears: 7,
    graceYears: 0,
    amortization: "annuity",
    serviceStartYear: null,
    scope: { kind: "general" },
  };
}

// An interest-free note is a facility at rate zero that lands as one dated lump.
export function blankNoteFacility(existing: Facility[]): Facility {
  return {
    id: nextId("fac", existing.map((f) => f.id)),
    label: "",
    amount: 0,
    ratePct: 0,
    termYears: 1,
    graceYears: 0,
    amortization: "equal-principal",
    serviceStartYear: 0,
    scope: { kind: "general" },
    paymentsPerYear: 1,
    datedDraw: { year: 1 },
  };
}

export function moveFacility(list: Facility[], id: string, delta: -1 | 1): Facility[] {
  const i = list.findIndex((f) => f.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const out = list.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export interface FacilityShareRow {
  lineId: string;
  name: string;
  draw: number;
  share: number;
  display: string;
}
export interface FacilityComposition {
  id: string;
  rows: FacilityShareRow[];
  shareTotalDisplay: string;
  stated: number | null;
  drawn: number;
  drift: number | null;
  drifts: boolean;
}

// The derived shares of one facility, from engine output only: each scoped line's draw (the engine's
// share of the line's incurred cost times the line's total) over the facility's drawn total. The
// one-decimal display uses the largest-remainder allocation in tenths so the displayed shares close
// to exactly 100.0 (the percentOneForDisplay precedent for the form). Null while the facility has
// no engine position (the model is refused, or the facility is switched off).
export function composeFacility(inputs: ModelInputs, result: ModelResult | null, facilityId: string): FacilityComposition | null {
  const fr = result?.financing?.facilities?.find((x) => x.id === facilityId);
  if (result === null || fr === undefined) return null;
  const draws: { lineId: string; name: string; draw: number }[] = [];
  for (const l of result.lineTotals) {
    const s = fr.shares[l.id];
    if (s !== undefined && s > 0) draws.push({ lineId: l.id, name: l.name, draw: s * l.total });
  }
  const total = draws.reduce((a, d) => a + d.draw, 0);
  const tenths = draws.map((d) => (total > 0 ? (d.draw / total) * 1000 : 0));
  const floors = tenths.map((t) => Math.floor(t));
  let short = (total > 0 ? 1000 : 0) - floors.reduce((a, b) => a + b, 0);
  const order = tenths.map((t, i) => ({ i, rem: t - floors[i] })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const o of order) {
    if (short <= 0) break;
    floors[o.i] += 1;
    short -= 1;
  }
  const rows = draws.map((d, i) => ({ lineId: d.lineId, name: d.name, draw: d.draw, share: total > 0 ? d.draw / total : 0, display: percentOneForDisplay(floors[i] / 1000) }));
  const drift = fr.drift;
  return {
    id: facilityId,
    rows,
    shareTotalDisplay: percentOneForDisplay(floors.reduce((a, b) => a + b, 0) / 1000),
    stated: inputs.facilities?.find((f) => f.id === facilityId)?.amount ?? null,
    drawn: fr.drawnTotal,
    drift,
    drifts: drift !== null && Math.abs(drift) > 1e-6 + 1e-9 * Math.abs(fr.amount),
  };
}
