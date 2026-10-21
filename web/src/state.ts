import type {
  ContractParams, CostLine, MaintenanceConfig, ModelInputs, ModelResult, OperatingLine,
  TimelineBlock, TimelineEngineEvent, TimelinePhase,
} from "../../core/src/types.js";
import templateFile from "../../data/template-project.json";

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
      { id: "c1", name: "Site acquisition (lakeside plot)", category: "capex", amount: 45000000, startYear: 1, durationYears: 0, escalation: 0, depreciation: { mode: "retained" } },
      { id: "c2", name: "Turnkey construction (18-storey timber tower)", category: "recurring", amount: 160000000, startYear: 1, durationYears: 2, escalation: 0, depreciation: { mode: "straight-line", years: 33, startYear: 3 } },
      { id: "c3", name: "Interior & hotel fit-out", category: "capex", amount: 55000000, startYear: 2, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 3 } },
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
// v0.6.13 — the timeline (the PPS-aligned planning layer). Pure helpers; the engine never reads
// the block. Years are program years (1-based, the engine's indexing).
// ---------------------------------------------------------------------------------------------

export const TIMELINE_PHASES: { id: TimelinePhase; label: string }[] = [
  { id: "prestudy", label: "Prestudy" },
  { id: "detail-design", label: "Detail design" },
  { id: "production", label: "Production" },
];

// The PPS-aligned decision-point vocabulary of record (Praktisk Projektstyrning BP set). The
// default titles are user-overridable labels.
export const PPS_BP_SET: { code: string; title: string }[] = [
  { code: "BP1", title: "Beslut om att starta projektet och initiera förberedelserna" },
  { code: "BP2", title: "Beslut om att fortsätta, avbryta eller göra om förberedelsearbete" },
  { code: "BP3", title: "Beslut om att det finns tillräckligt bra underlag för att göra ett åtagande för resterande del av projektet" },
  { code: "BP4", title: "Beslut att starta genomförandet" },
  { code: "BP5", title: "Beslut om att fortsätta eller förändra projektåtagandet" },
  { code: "BP6", title: "Beslut om att godkänna leverans av projektets delresultat eller slutresultat" },
  { code: "BP7", title: "Beslut om att godkänna överlämning av ansvaret för projektets resultat till förvaltningen" },
  { code: "BP8", title: "Beslut om att avsluta projektet" },
];

// The full scale carries BP1 through BP8; the mini scale the condensed four-point set.
export const PPS_SCALE_CODES: Record<"mini" | "full", string[]> = {
  full: ["BP1", "BP2", "BP3", "BP4", "BP5", "BP6", "BP7", "BP8"],
  mini: ["BP1", "BP3", "BP4", "BP8"],
};

export const PPS_DISCLOSURE = "The decision-point vocabulary is aligned with PPS (Praktisk Projektstyrning); this application does not implement or certify PPS.";

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
export function timelineOf(inputs: ModelInputs): TimelineBlock {
  const t = inputs.timeline;
  return {
    projectScale: t?.projectScale ?? "full",
    activities: t?.activities ?? [],
    decisionPoints: t?.decisionPoints ?? [],
    milestones: t?.milestones ?? [],
  };
}

// A timeline is authored when the block carries at least one object; an empty block is the
// empty state and the deck omits the slide.
export function timelineAuthored(inputs: ModelInputs): boolean {
  const t = timelineOf(inputs);
  return t.activities.length + t.decisionPoints.length + t.milestones.length > 0;
}

// The next unused BP of the scale's set (the default for an added gate), or null when the set
// is exhausted.
export function nextUnusedBp(tl: TimelineBlock): { code: string; title: string } | null {
  const used = new Set(tl.decisionPoints.map((d) => d.code).filter((c): c is string => c !== undefined));
  for (const code of PPS_SCALE_CODES[tl.projectScale ?? "full"]) {
    if (!used.has(code)) {
      const bp = PPS_BP_SET.find((b) => b.code === code);
      if (bp !== undefined) return bp;
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
  code: "TIMELINE-ACTIVITY-SPAN" | "TIMELINE-ACTIVITY-ORDER" | "TIMELINE-GATE-SPAN" | "TIMELINE-MILESTONE-SPAN" | "TIMELINE-MILESTONE-TIE";
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
