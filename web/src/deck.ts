import type { ModelInputs, ModelResult, TariffRow, TimelinePhase } from "../../core/src/types.js";
import { GANTT_LANE_LABEL_CHARS, layoutGateLabels, layoutLane, layoutMilestoneRows, markerPosition, wrapLabel } from "./ganttLayout.js";
import type { GanttBarLaid } from "./ganttLayout.js";
import { moneyForDisplay, percentTwoForDisplay, percentTwoOrDash, dscrTwoForDisplay, deckMoneyForDisplay, deckYearsForDisplay, computeModel, entryToValue, feeForDisplay, unitPriceForDisplay, percentOneForDisplay, roundForDisplay } from "./engine.js";
import type { EntryUnit } from "./engine.js";
import { scenarioResults } from "../../core/src/scenarios.js";
import { DECISION_DISCLOSURE, availableEngineEvents, composeInvestment, programSpanYears, timelineAuthored, timelineOf, timelineWindow, validateTimeline, visibleLanes, yearHeader, yearMonthHeader } from "./state.js";

export type FigureKind = "money" | "percent" | "years" | "dscr" | "count" | "text";

export interface DeckFigure {
  label: string;
  value: string;
  kind: FigureKind;
  rawValue: number | string | null;
  disclosure?: string;
}

export interface DeckChartSlot {
  kind: "donut" | "bars" | "rows" | "coverage" | "hurdle";
  data: { label: string; value: number }[];
  solved?: boolean;
  // v0.6.18 (AUD-10): a hurdle chart whose achieved IRR is null draws no achieved dot and reads "—"
  achievedMissing?: boolean;
  // v0.6.18 Task H1: the basis of a per-year bar series (annual by default; monthly only on request) and the one
  // line that names what one bar is, composed once with the series
  basis?: "annual" | "monthly";
  periodNote?: string;
  crossingX?: number | null;
  // v0.6.8 Task G: the deck model emits the chart's kicker (an action title naming the varied
  // parameter); the hard-coded Presentation line is gone.
  kicker?: string;
}

export interface DeckDonutSegment {
  id: string;
  label: string;
  value: number;
  // v0.6.18 Task B: the share of the ring's OWN total, one decimal (percentOneForDisplay), composed once here
  share?: string;
}

export interface DeckDonut {
  id: string;
  title: string;
  segments: DeckDonutSegment[];
  disclosure?: string;
}

export interface ScenarioTargetPoint {
  target: number;
  label: string;
  value: number;
  met: boolean;
}

export interface ScenarioTargetChart {
  mode: "solved" | "evaluated";
  points: ScenarioTargetPoint[];
  breakEvenTarget: number | null;
  kicker: string;
}

export interface DeckTile {
  label: string;
  value: string;
  tone?: "ok" | "bad";
  disclosure?: string;
  rawValue?: number | null;
}

// v0.6.10 Task G.1: the funding breakdown block — composed on the investment slide beneath
// the waterfall when the funding view carries grants. The figures render through the deck
// display formatters (feeForDisplay at the entry unit, one decimal — the honest halves; the
// intensity takes the pinned comma one-decimal form); the raws ride for the audit route.
export interface DeckFundingRow {
  label: string;
  kind: "grant" | "interest-free-loan";
  year: number;
  value: string;
  term?: number | null;
}

export interface DeckFundingBlock {
  grossLabel: string;
  gross: string;
  grants: string;
  net: string;
  intensity: string;
  grossRaw: number;
  grantsRaw: number;
  netRaw: number;
  rows: DeckFundingRow[];
}

// v0.6.13: the program Gantt — composed once by the deck model (variant-invariant): the three
// phases as lanes, the activities as bars, the decision points as full-height gate lines labeled
// with their DP codes, the milestones as diamond markers, the time axis in program years through
// the shared yearHeader labels. The Presentation and the PDF render it; neither recomputes.
// v0.6.13.2: the stacked sub-row layout, the label placement and the adaptive year window are composed
// here once (web/src/ganttLayout.ts); the renderers consume them and never recompute.
export type DeckGanttBar = GanttBarLaid;
export interface DeckGanttLane { phase: TimelinePhase; label: string; labelLines: string[]; rowCount: number; rowLines: number[]; bars: DeckGanttBar[] }
// v0.6.17: a gate and a milestone carry their optional month, the composed sub-year position (year
// columns from the window start, composed once) and, for a gate, its label row (the same-year stacking).
export interface DeckGanttGate { id: string; code: string | null; title: string; year: number; month: number | null; pos: number; row: number; outcome: string | null }
// v0.6.13.4: the ordinal is the milestone's rank in the chronological order of the FULL milestone set
// (composed once, stable under the year window, never derived from the authored id); the row is the
// stack position among the drawn milestones sharing a year (0 = the first).
// v0.6.17 supplement: a milestone tied to an engine event whose live schedule carries a month also carries the
// COMPUTED position (read-only exposure, never authored): drawn as a muted ring, composed once here.
// v0.6.18 Task H2 (the builder proposal, applied): the thin connector from the authored diamond to the ring is RETIRED —
// it carried no meaning to a reader (a line between two marks says nothing about what the second one is). The ring
// is NAMED instead: it carries its own short text label, composed once here ("computed: month 12"), set on the side
// of the ring away from the authored diamond so it never lands on it. The authored diamond never changes; the ring
// stays the read-only exposure of the live schedule (never authored).
export interface DeckGanttComputed { year: number; month: number; pos: number; label: string; side: "left" | "right" }
export interface DeckGanttMilestone { id: string; label: string; year: number; month: number | null; pos: number; tie: string | null; ordinal: number; row: number; computed: DeckGanttComputed | null }
export interface DeckGantt {
  // the program span; the axis and the plot cover the year window only
  spanYears: number;
  window: { firstYear: number; lastYear: number };
  axis: { year: number; label: string }[];
  lanes: DeckGanttLane[];
  // markers (gates and milestones) outside the window are omitted from the chart and counted
  omittedMarkers: number;
  caption: string | null;
  gates: DeckGanttGate[];
  // v0.6.17 supplement: the month gridline positions (year columns from the window start; the eleven
  // interior month boundaries of every year band), composed once and present ONLY while the view-state
  // toggle stands on; absent = the default rendering, untouched. Never a document field.
  monthGrid?: number[];
  // the number of gate-label rows the drawn gates stack on (0 with no gate drawn)
  gateRows: number;
  milestones: DeckGanttMilestone[];
}

// v0.6.15: the investment waterfall — composed once by the deck model and consumed by the
// Presentation and the print route (neither recomputes it). The upper section is the ledger at the
// individual-line level (percent left and width on the shared left-baseline scale, the shares on the
// full-outflow basis); the lower section is the stepped columns at group level (percent bottom and
// height, the total a ground-standing column).
export interface DeckLedgerRow {
  id: string;
  name: string;
  // v0.6.18 Task A: the waterfall composes the capital program only and closes at the Capital program step
  kind: "capital" | "total";
  raw: number;
  value: string;
  // the share of the capital program (the v0.6.18 basis), one decimal
  share: string;
  startPct: number;
  widthPct: number;
}
export interface DeckStepColumn {
  id: string;
  name: string;
  kind: "capital" | "total";
  raw: number;
  value: string;
  bottomPct: number;
  heightPct: number;
}
export interface DeckWaterfall {
  totalRaw: number;
  rows: DeckLedgerRow[];
  columns: DeckStepColumn[];
}

export interface DeckSlide {
  name: string;
  title: string;
  body: DeckFigure[];
  disclosures: string[];
  chart?: DeckChartSlot;
  insights?: string[];
  verdict?: string;
  tiles?: DeckTile[];
  summaryCharts?: DeckChartSlot[];
  donuts?: DeckDonut[];
  targetChart?: ScenarioTargetChart;
  titleMetrics?: { label: string; value: string }[];
  kickerNumber?: string;
  solverScenario?: { label: string; requiredPayment: string | null } | null;
  funding?: DeckFundingBlock;
  gantt?: DeckGantt;
  waterfall?: DeckWaterfall;
}

export const TERM_GLOSSES: { term: string; gloss: string }[] = [
  { term: "NPV", gloss: "Net present value: the value of all cash flows in today's money." },
  { term: "IRR", gloss: "Internal rate of return: the yearly return the project earns on invested money." },
  { term: "WACC", gloss: "Weighted average cost of capital: the minimum return investors require." },
  { term: "MIRR", gloss: "Modified internal rate of return: IRR adjusted for reinvestment of interim cash." },
  { term: "Payback", gloss: "Payback: how long until cumulative inflows cover the invested cost." },
  { term: "Profitability index", gloss: "Profitability index: the value created per unit of cost, at the benchmark rate." },
];

export interface DeckModel {
  slides: DeckSlide[];
  glosses?: { term: string; gloss: string }[];
  currency?: Parameters<typeof moneyForDisplay>[1];
  unit?: EntryUnit;
  provenance?: string[];
}

export function deckSlides(
  inputs: ModelInputs,
  result: ModelResult,
  opts: { startYear: number | null; entryUnit?: EntryUnit; scenarioTargets?: number[] | null; scenarioTerms?: number[] | null; scenarioBalloons?: number[] | null; monthGrid?: boolean; recoveryMonthly?: boolean } = { startYear: null },
): DeckModel {
  const currency = (inputs.currency as Parameters<typeof moneyForDisplay>[1]) ?? "SEK";
  const unit = opts.entryUnit ?? "ones";
  const money = (v: number) => deckMoneyForDisplay(v, currency, unit);
  // v0.6.8 Task B (finding W22): the fee closure — fee-class figures render at the ones unit
  // (two decimals, grouped, no unit token) instead of collapsing under the coarse global entry
  // unit (the witnessed "€0 M" unit price and "€2 M" payment). Program-scale figures keep the
  // entry unit; their semantics are unchanged.
  // v0.6.9 Task F (finding W28): the fee closure becomes the magnitude-aware feeForDisplay —
  // a small value shows its euros and cents despite the entry unit; a coarse value takes the
  // entry unit's form (the deck's fee-class figures and the scenario comparison values).
  const fee = (v: number) => feeForDisplay(v, currency, unit);
  const startYear = opts.startYear;
  const leveraged = result.leveragedSolve;
  const tariffCollectionMode = inputs.tariff !== undefined && inputs.tariff.mode !== "off" && inputs.tariff.mode !== "decompose";
  const slides: DeckSlide[] = [];
  // v0.6.10 Tasks G.1/G.2: the funding view drives the investment slide's funding breakdown
  // block and the inflow donut's grant segment; the loan row nets to zero and never joins.
  const fundingView = result.fundingView ?? null;
  const grantsTotal = fundingView?.grantsTotal ?? 0;

  // Slide 0 — title
  slides.push({
    name: "title",
    title: inputs.projectName || "Untitled project",
    body: [],
    disclosures: [],
    titleMetrics: [
      { label: "Project cost", value: money(result.totalCost) },
      { label: "Target IRR", value: percentTwoForDisplay(inputs.targetIrr / 100) },
      { label: "Investment term", value: `${result.horizon?.totalYears ?? result.yearly.length} years` },
    ],
  });

  // Slide 1 — executive summary (v0.6.4 Part B: the infographic block row — large figures, no paragraphs;
  // v0.6.5 Task C/W13: the paired composition donuts beneath the tiles — outflows and inflows)
  const outflowSegments: DeckDonutSegment[] = result.lineTotals.map((l) => ({ id: l.id, label: l.name, value: l.total }));
  const reinvestmentsTotal = (result.contractsInfo ?? []).reduce((a, c) => a + c.reinvestments.reduce((b, ri) => b + ri.amount, 0), 0);
  if (reinvestmentsTotal > 0) outflowSegments.push({ id: "reinvestments", label: "Reinvestments", value: reinvestmentsTotal });
  const inflowSegments: DeckDonutSegment[] = [];
  let inflowDisclosure: string | undefined;
  if (grantsTotal > 0) {
    // v0.6.10 Task G.2: the inflow donut gains the grant segment — fees (the collections-side
    // tariff rows) and grants of the totalCollected circle, at the one-decimal share
    // convention; the interest-free loan nets to zero and never joins the donut.
    inflowSegments.push({ id: "fees", label: "Fees", value: result.totalCollected - grantsTotal });
    inflowSegments.push({ id: "grants", label: "Grants", value: grantsTotal });
    inflowDisclosure = "Fees are the collections-side tariff rows; the interest-free loan nets to zero over the horizon and never joins the donut.";
  } else {
    for (const row of result.collectionsGrid) {
      const rowTotal = row.amounts.reduce((a, v) => a + v, 0);
      if (rowTotal > 0) inflowSegments.push({ id: row.id, label: row.name, value: rowTotal });
    }
  }
  // v0.6.18 Task B: the percentages are shares of each ring's OWN total (the geometry the arcs draw), one
  // decimal, composed here once; the one-decimal residue is disclosed, never smoothed. The outflow
  // disclosure names the ring's basis — the capital lines plus the reinvestments, the operating lines
  // excluded (the v0.6.8 "shown separately" wording retired with the v0.6.10 reinvestments segment) — and
  // the percentages' basis.
  const withShares = (segs: DeckDonutSegment[]): DeckDonutSegment[] => {
    const ringTotal = Math.max(1e-12, segs.reduce((a, s) => a + s.value, 0));
    return segs.map((s) => ({ ...s, share: percentOneForDisplay(s.value / ringTotal) }));
  };
  const SHARE_BASIS = "Percentages are shares of the ring's own total.";
  const outflowDisclosure = `The outflow ring shows the capital lines${reinvestmentsTotal > 0 ? " plus the reinvestments" : ""}${result.operatingTotal > 0 ? "; the operating lines are excluded (they are part of the total cost and appear on the operations slide)" : ""}. ${SHARE_BASIS}`;
  const summaryDonuts: DeckDonut[] = [
    { id: "outflows", title: "Outflows — the investment", segments: withShares(outflowSegments), disclosure: outflowDisclosure },
    { id: "inflows", title: "Inflows — the collections", segments: withShares(inflowSegments), disclosure: inflowDisclosure !== undefined ? `${inflowDisclosure} ${SHARE_BASIS}` : SHARE_BASIS },
  ];
  slides.push({
    name: "summary",
    title: "Executive summary",
    body: [],
    disclosures: [],
    tiles: [
      { label: "Cost NPV", value: money(result.costNpv), rawValue: result.costNpv, disclosure: "at the target rate" },
      { label: "Achieved IRR", value: percentTwoOrDash(result.achievedIrr), rawValue: result.achievedIrr, tone: result.goalMet ? "ok" : "bad" },
      { label: "Payback", value: result.paybackYears === null ? "—" : deckYearsForDisplay(result.paybackYears), rawValue: result.paybackYears },
      { label: "Solved payment", value: result.paymentAmount === null ? "—" : fee(result.paymentAmount), rawValue: result.paymentAmount },
      { label: "Collected vs cost", value: `${money(result.totalCollected)} vs ${money(result.totalCost)}`, rawValue: result.totalCollected },
      { label: "Verdict", value: result.goalMet ? "Target met" : "Target missed", tone: result.goalMet ? "ok" : "bad" },
    ],
    donuts: summaryDonuts,
  });

  // Slide 2 — investment
  const investmentBody: DeckFigure[] = [
    { label: "Total cost (nominal)", value: money(result.totalCost), kind: "money", rawValue: result.totalCost },
    { label: "Cost NPV at target (discounted)", value: money(result.costNpv), kind: "money", rawValue: result.costNpv, disclosure: "discounted at the target rate" },
  ];
  // v0.6.10 Task G.1: the funding breakdown block — gross capital program, grants, net private
  // capital (each at one decimal in the entry unit, the honest halves), the grant intensity,
  // and the funding rows listed with their kinds and years. The grants figure renders through
  // feeForDisplay (an ASCII hyphen); the directive's U+2212 is typographic (disclosed).
  let fundingBlock: DeckFundingBlock | undefined;
  if (fundingView !== null && grantsTotal > 0) {
    const grossCapital = result.lineTotals.reduce((a, l) => a + l.total, 0);
    fundingBlock = {
      grossLabel: "Gross capital program",
      gross: fee(grossCapital),
      grants: fee(-grantsTotal),
      net: fee(grossCapital - grantsTotal),
      intensity: percentOneForDisplay(grantsTotal / grossCapital),
      grossRaw: grossCapital,
      grantsRaw: grantsTotal,
      netRaw: grossCapital - grantsTotal,
      rows: fundingView.rows.map((r) => ({
        label: r.label,
        kind: r.kind,
        year: r.year,
        value: fee(r.amount),
        term: r.kind === "interest-free-loan" ? (r.termYears ?? 1) : null,
      })),
    };
  }
  slides.push({
    name: "investment",
    title: "The investment",
    body: investmentBody,
    // v0.6.8 Task A.4: the composition shares on this slide are of the capital program; the
    // disclosed 101 percent artifact (the port's five shares read 8/30/30/23/10) is named.
    // v0.6.9 Task E (finding W27): the one-decimal shares summed to exactly 100.0 then.
    // v0.6.10 (disclosed): on the shore-power program fixture the one-decimal shares sum to
    // 100.1 (16.5+24.5+22.3+27.8+4.5+4.5) — the honest one-decimal rounding residue, disclosed
    // in the completion report, never smoothed; the capital-program basis stays stated.
    // v0.6.15: the slide carries ONE basis — the shares are of the total program cost (the full outflow);
    // the capital-basis shares retired with the composition rows.
    // v0.6.18 Task A: the waterfall and its shares are of the capital program; the disclosure names the
    // segments of the total program cost that lie beyond it (only the segments that exist). v0.6.18 Task J.1:
    // the dead rows-chart field of the slide model retired (the waterfall is the investment chart).
    disclosures: [investmentDisclosure(result.operatingTotal > 0, reinvestmentsTotal > 0)],
    ...(fundingBlock !== undefined ? { funding: fundingBlock } : {}),
    waterfall: composeWaterfall(composeInvestment(inputs, result), money),
  });

  // v0.6.13: the timeline slide — ONE program-level slide, composed once (never per variant),
  // immediately after the investment slide, only when the timeline is authored AND refusal-free;
  // otherwise it is omitted and the provenance disclosure carries the reason.
  let timelineProvenance: string | null = null;
  if (!timelineAuthored(inputs)) {
    timelineProvenance = "Timeline: not authored.";
  } else if (validateTimeline(inputs, result).length > 0) {
    timelineProvenance = "Timeline: refused — see the Timeline tab.";
  } else {
    slides.push(ganttSlide(inputs, result, startYearOf(opts), opts.monthGrid === true));
  }

  // v0.6.18 Task A: the conditional operations slide — composed ONLY when operating lines exist. The
  // operating lines are running costs (what happens after the investment): the engine classification
  // stands (expensed as incurred, part of the total cost, never depreciated); this slide only seats them.
  // The yearly burn is the engine's own per-year operating series (the book view), shown from the first to
  // the last operating year. No income is attributable to the operating lines alone, so none is paired.
  if (result.operatingTotal > 0) slides.push(operationsSlide(result, money, startYear));

  // Slide 3 — recovery
  let recoveryTitle: string;
  const recoveryBody: DeckFigure[] = [];
  if (!tariffCollectionMode && result.paymentAmount !== null) {
    recoveryTitle = "The recovery — solved payments";
    recoveryBody.push({ label: "Payments", value: String(result.paymentCount), kind: "count", rawValue: result.paymentCount });
    // v0.6.18 Task H1: "period" named — the payment is per PAYMENT PERIOD of the repayment cadence, never confused
    // with the bars below (one bar is one program year)
    recoveryBody.push({ label: `Payment per ${CADENCE_WORD[inputs.repayment.paymentsPerYear] ?? "period"}`, value: fee(result.paymentAmount), kind: "money", rawValue: result.paymentAmount });
    recoveryBody.push({ label: "Total collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
    if (inputs.tariff?.mode === "decompose") {
      // v0.6.12 Task C (Round 46 Supplement 12): the title composes from the declared vocabulary;
      // the unit-free fallback when no price unit is declared.
      const priceUnit = typeof inputs.tariff.priceUnitLabel === "string" ? inputs.tariff.priceUnitLabel.trim() : "";
      recoveryTitle = priceUnit !== "" ? "The recovery — " + inputs.tariff.priceUnitLabel + " prices" : "The recovery — the tariff";
      const firstPrice = result.tariffYears[0]?.unitPrice;
      // v0.6.10 Task E.3/G.3 (W20): the unit-price exemption extends the fee class — a unit
      // price renders at unit ones with the currency form, never the entry-unit collapse
      // (the pinned "€7 108,41" class on the program fixture).
      recoveryBody.push({ label: `Unit price ${yearHeader(result.tariffYears[0]?.year ?? 1, startYear)}`, value: firstPrice === null || firstPrice === undefined ? "not applicable" : unitPriceForDisplay(firstPrice, currency), kind: "money", rawValue: firstPrice ?? null });
      // With the machine-labeled unit vocabulary declared, the per-row segment rates render
      // as body figures at the full-ramp year — the first grid year at the maximum weighted
      // volume (segment rate = charge / divisor, the pinned "5,83 €ct/kWh" class).
      if (inputs.tariff.priceUnitLabel && inputs.tariff.priceDisplayDivisor && result.tariffYears.length > 0) {
        const fullRamp = result.tariffYears.reduce((best, y) => (y.weightedVolume > best.weightedVolume ? y : best), result.tariffYears[0]);
        for (const row of inputs.tariff.rows) {
          if (fullRamp.perRowCharges === null) continue;
          const rate = fullRamp.perRowCharges[row.id] / inputs.tariff.priceDisplayDivisor;
          recoveryBody.push({ label: `Segment rate — ${row.label} (full ramp)`, value: `${roundForDisplay(rate, 2).toFixed(2).replace(".", ",")} ${inputs.tariff.priceUnitLabel}`, kind: "text", rawValue: rate });
        }
      }
    }
  } else if (inputs.tariff?.mode === "stable") {
    const base = result.tariffBaseUnitPrice as number;
    recoveryTitle = "The recovery — a stable tariff";
    // v0.6.10 Task E.3 (W20): the stable base price joins the unit-price exemption.
    recoveryBody.push({ label: "Base price (first grid year terms)", value: unitPriceForDisplay(base, currency), kind: "money", rawValue: base });
    recoveryBody.push({ label: "Total collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
  } else if (inputs.tariff?.mode === "manual") {
    recoveryTitle = "The recovery — evaluated, not solved";
    recoveryBody.push({ label: "Total collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
  } else if (inputs.repayment.collectionsOverrides && Object.keys(inputs.repayment.collectionsOverrides).length > 0) {
    recoveryTitle = "The recovery — evaluated, not solved";
    recoveryBody.push({ label: "Total collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
  } else {
    recoveryTitle = "The recovery — evaluated, not solved";
    recoveryBody.push({ label: "Total collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
  }
  // v0.6.18 Task H1 (and AUD-27): the recovery series is composed here ONCE — the annual basis by default, the month
  // level only on request; the grants and the interest-free note are identified in their own figures, never summed
  // into the bars unidentified.
  const recoverySeries = composeRecoverySeries(result, startYear, opts.recoveryMonthly === true);
  if (grantsTotal > 0 || recoverySeries.noteAdvance > 0) {
    if (grantsTotal > 0) recoveryBody.push({ label: "Grant receipts (identified; not in the bars)", value: fee(grantsTotal), kind: "money", rawValue: grantsTotal, disclosure: "received once per grant row; shown on the investment slide" });
    if (recoverySeries.noteAdvance > 0) recoveryBody.push({ label: "Interest-free note advance (identified; not in the bars)", value: fee(recoverySeries.noteAdvance), kind: "money", rawValue: recoverySeries.noteAdvance, disclosure: "repaid by installments; nets to zero over the horizon" });
  }
  // v0.6.8 Task E.4 (finding W21): the user basis notes surface here — disclosed verbatim when
  // non-empty, absent when empty (the land fixture is the null-tolerance demo and gains none).
  const recoveryDisclosures: string[] = leveraged ? ["Collections solved so the equity earns the target (leveraged solve)"] : [];
  if (typeof inputs.tariff?.basisNote === "string" && inputs.tariff.basisNote.trim() !== "") {
    recoveryDisclosures.push(`Tariff basis: ${inputs.tariff.basisNote}`);
  }
  if (typeof inputs.repayment?.basisNote === "string" && inputs.repayment.basisNote.trim() !== "") {
    recoveryDisclosures.push(`Repayment basis: ${inputs.repayment.basisNote}`);
  }
  slides.push({
    name: "recovery",
    title: recoveryTitle,
    body: recoveryBody,
    disclosures: recoveryDisclosures,
    chart: { kind: "bars", data: recoverySeries.data, kicker: recoverySeries.kicker, basis: recoverySeries.basis, periodNote: recoverySeries.periodNote },
  });

  // Slide 3 — returns
  const returnsDisclosures: string[] = [];
  // v0.6.11 Task D: the engine-composed ambiguity note, rendered verbatim (single source;
  // the retyped sentence of v0.6.8 is retired).
  const mainAmbiguityNote = result.irrAmbiguityNote ?? null;
  if (mainAmbiguityNote !== null) {
    returnsDisclosures.push(mainAmbiguityNote);
  }
  // Slide 3 — coverage
  const coverageBody: DeckFigure[] = [
    { label: "Break-even year", value: result.paybackYears === null ? "not within the horizon" : yearHeader(Math.ceil(result.paybackYears), startYear), kind: "text", rawValue: null },
    { label: "Nominal payback", value: result.paybackYears === null ? "not within the horizon" : deckYearsForDisplay(result.paybackYears), kind: "years", rawValue: result.paybackYears },
  ];
  if (result.discountedPaybackYears !== null) {
    coverageBody.push({ label: "Discounted payback (at WACC)", value: deckYearsForDisplay(result.discountedPaybackYears), kind: "years", rawValue: result.discountedPaybackYears });
  }
  const coverageTitle = result.paybackYears === null
    ? "Coverage — not within the horizon"
    : "Coverage";
  const coverageCum = result.yearly.map((y) => y.cumulative);
  const coverageCrossingIdx = coverageCum.findIndex((v, i) => i > 0 && coverageCum[i - 1] < 0 && v >= 0);
  const coverageCrossingX = coverageCrossingIdx > 0
    ? Math.min(85, Math.max(15, Math.round((coverageCrossingIdx / Math.max(1, result.yearly.length - 1)) * 1000) / 10))
    : null;
  slides.push({
    name: "coverage",
    title: coverageTitle,
    body: coverageBody,
    disclosures: [],
    chart: { kind: "coverage", data: result.yearly.map((y) => ({ label: yearHeader(y.year, startYear), value: y.cumulative })), crossingX: coverageCrossingX },
  });

  slides.push({
    name: "returns",
    title: "The returns",
    body: [
      { label: "Achieved IRR", value: percentTwoOrDash(result.achievedIrr), kind: "percent", rawValue: result.achievedIrr },
      { label: "Goal check", value: result.goalMet ? "target achieved" : "target not achieved", kind: "text", rawValue: null },
      { label: "NPV at WACC (discounted)", value: money(result.npvAtWacc), kind: "money", rawValue: result.npvAtWacc, disclosure: "discounted at the WACC" },
      { label: "Profitability index", value: result.profitabilityIndex === null ? "—" : dscrTwoForDisplay(result.profitabilityIndex), kind: "dscr", rawValue: result.profitabilityIndex },
      { label: "MIRR", value: result.mirr === null ? "—" : percentTwoForDisplay(result.mirr), kind: "percent", rawValue: result.mirr, disclosure: "finance and reinvestment rates as configured" },
    ],
    disclosures: returnsDisclosures,
  });

  // Slide 4 — deal
  let dealTitle: string;
  const dealDisclosures: string[] = [];
  if (result.financing === null) {
    dealTitle = "The deal";
  } else {
    const eq = result.financing.equity;
    // v0.6.11 Task D: the engine-composed equity ambiguity note, rendered verbatim.
    if (eq.ambiguityNote !== null) {
      dealDisclosures.push(eq.ambiguityNote);
    }
    dealTitle = "The deal — equity view";
  }
  let verdict: string | undefined;
  if (result.financing === null) {
    verdict = result.goalMet
      ? `Target met — net gain ${money(result.netGain)}.`
      : `Target missed — net gain ${money(result.netGain)}.`;
  } else {
    const eq = result.financing.equity;
    verdict = result.goalMet
      ? `Target met — equity IRR ${eq.zeroOutlay ? "not applicable" : percentTwoOrDash(eq.irr)} on ${money(eq.outlay)} outlaid.`
      : `Target missed — equity IRR ${eq.zeroOutlay ? "not applicable" : percentTwoOrDash(eq.irr)} on ${money(eq.outlay)} outlaid.`;
  }
  const tiles: DeckTile[] = [
    { label: "Total cost", value: money(result.totalCost), rawValue: result.totalCost },
    { label: "Total collected", value: money(result.totalCollected), rawValue: result.totalCollected },
    { label: "Net gain", value: money(result.netGain), tone: result.netGain >= 0 ? "ok" : "bad", rawValue: result.netGain },
    { label: "Achieved IRR", value: `${percentTwoOrDash(result.achievedIrr)} vs ${percentTwoForDisplay(inputs.targetIrr / 100)} target`, tone: result.goalMet ? "ok" : "bad", rawValue: result.achievedIrr },
    { label: "NPV at WACC", value: money(result.npvAtWacc), tone: result.npvAtWacc >= 0 ? "ok" : "bad", rawValue: result.npvAtWacc },
    { label: "Payback (nominal)", value: result.paybackYears === null ? "—" : deckYearsForDisplay(result.paybackYears), rawValue: result.paybackYears },
  ];
  if (result.financing !== null) {
    const eq = result.financing.equity;
    tiles.push({ label: "Equity outlay", value: money(eq.outlay), rawValue: eq.outlay });
    tiles.push({ label: "Equity IRR", value: eq.zeroOutlay ? "not applicable (zero equity outlay)" : (eq.irr === null ? "—" : percentTwoForDisplay(eq.irr)), rawValue: eq.irr });
    if (result.financing.minDscr !== null) {
      tiles.push({ label: "Minimum DSCR", value: dscrTwoForDisplay(result.financing.minDscr.value), tone: result.financing.minDscr.value >= 1.0 ? "ok" : "bad", disclosure: `in ${yearHeader(result.financing.minDscr.year, startYear)}`, rawValue: result.financing.minDscr.value });
    }
  }
  // the deal slide's inflow bars are always the annual basis (the monthly request applies to the recovery slide)
  const annualRecovery = composeRecoverySeries(result, startYear, false);
  const summaryCharts: DeckChartSlot[] = [
    { kind: "hurdle", solved: result.paymentAmount !== null, ...(result.achievedIrr === null ? { achievedMissing: true } : {}), data: [
      { label: "Target", value: inputs.targetIrr },
      { label: "Achieved", value: (result.achievedIrr ?? 0) * 100 },
    ] },
    { kind: "bars", data: annualRecovery.data, kicker: annualRecovery.kicker, basis: "annual", periodNote: annualRecovery.periodNote },
  ];
  if (result.residualDisclosure !== null && result.residualDisclosure !== undefined) {
    // v0.6.5 Task A (W8): the deck composes its sale disclosure from structured fields through the
    // deck display formatters; the engine's residualDisclosure strings stay verbatim and immutable
    // (the XLSX export keeps consuming the raw engine string — the audit route).
    const res = inputs.appraisal?.residual;
    const posture = res?.posture ?? ((res?.mode ?? "amount") === "amount" && (res?.amount ?? 0) > 0 ? "set-price" : res?.mode === "calculated" ? "book-value" : "none");
    const residualYear = res?.year ?? 10;
    if (posture === "book-value") {
      dealDisclosures.push(`Assumes sale at remaining book value at year ${residualYear} for ${money(result.residualAmountUsed ?? 0)}`);
    } else {
      dealDisclosures.push(`Assumes sale at year ${residualYear} for ${money(res?.amount ?? 0)}`);
    }
  }
  const solverScenario = result.goalMet ? null : {
    label: "To reach the target",
    requiredPayment: result.paymentAmount === null ? null : money(result.paymentAmount),
  };
  slides.push({ name: "deal", title: dealTitle, body: [], disclosures: dealDisclosures, verdict, tiles, summaryCharts, solverScenario });

  // Slide 6 — scenarios summary (v0.6.2 Round 23 supplement ruling; renders only when the user has set at least one axis value)
  const sceTargets = opts.scenarioTargets ?? [];
  const sceTerms = opts.scenarioTerms ?? [];
  const sceBalloonsRaw = opts.scenarioBalloons ?? [];
  const anyScenarioSet = sceTargets.length > 0 || sceTerms.length > 0 || sceBalloonsRaw.length > 0;
  if (anyScenarioSet) {
    const sceBody: DeckFigure[] = [];
    const sceDisclosures: string[] = ["One source: every figure here is computed exactly as the Scenarios tab computes it."];
    const profileActive = inputs.repayment.collectionsOverrides !== undefined && Object.keys(inputs.repayment.collectionsOverrides).length > 0;
    const tryCompute = (patch: Partial<ModelInputs>): ModelResult | null => {
      try {
        return computeModel({ ...inputs, ...patch });
      } catch {
        return null;
      }
    };
    // v0.6.11 Task F: the deck consumes the per-variant outcomes individually — a variant
    // that computes renders its delta item; a variant that refuses under its own terms
    // renders its one-line per-variant disclosure, naming the variant. The wholesale
    // disclosure is retired.
    const sc = scenarioResults(inputs);
    const basePayment = sc.base.result !== null ? sc.base.result.paymentAmount : null;
    if (basePayment !== null) {
      if (sc.optimistic.result !== null && sc.optimistic.result.paymentAmount !== null) {
        sceBody.push({ label: "Named-set delta, optimistic vs base", value: money(sc.optimistic.result.paymentAmount - basePayment), kind: "money", rawValue: sc.optimistic.result.paymentAmount - basePayment });
      } else if (sc.optimistic.refusal !== null) {
        sceDisclosures.push("The optimistic scenario could not be computed for this project; see the Scenarios tab.");
      }
      if (sc.pessimistic.result !== null && sc.pessimistic.result.paymentAmount !== null) {
        sceBody.push({ label: "Named-set delta, pessimistic vs base", value: money(sc.pessimistic.result.paymentAmount - basePayment), kind: "money", rawValue: sc.pessimistic.result.paymentAmount - basePayment });
      } else if (sc.pessimistic.refusal !== null) {
        sceDisclosures.push("The pessimistic scenario could not be computed for this project; see the Scenarios tab.");
      }
    } else if (sc.base.refusal !== null) {
      sceDisclosures.push("The base scenario could not be computed for this project; see the Scenarios tab.");
    }
    let chartData: { label: string; value: number }[] = [];
    let chartKicker: string | undefined;
    if (profileActive) {
      sceDisclosures.push("The payment sensitivity figures do not apply while a collections profile is present (SCE-PROFILE).");
    } else {
      if (sceTerms.length > 0) {
        const termPayments = sceTerms.map((t) => {
          const r = tryCompute({ repayment: { ...inputs.repayment, termYears: t } });
          return { label: `${t} years`, payment: r === null ? null : r.paymentAmount };
        });
        const okTerms = termPayments.filter((x): x is { label: string; payment: number } => x.payment !== null);
        if (okTerms.length > 0) {
          const minP = Math.min(...okTerms.map((x) => x.payment));
          const maxP = Math.max(...okTerms.map((x) => x.payment));
          sceBody.push({ label: "Payment range across the set terms", value: `${money(minP)} – ${money(maxP)}`, kind: "money", rawValue: null, disclosure: `${okTerms.length} of ${sceTerms.length} term values computed` });
          chartData = okTerms.map((x) => ({ label: x.label, value: x.payment }));
          // v0.6.8 Task G: the kicker is emitted by the deck model and names the varied parameter.
          chartKicker = "Longer terms lower the payment";
        } else {
          sceDisclosures.push("The set term values were refused by the engine; see the Scenarios tab.");
        }
        if (termPayments.some((x) => x.payment === null)) {
          sceDisclosures.push("Some term values were refused by the engine; the refused cells render inline on the Scenarios tab.");
        }
      }
      if (sceTargets.length > 0) {
        for (const g of sceTargets) {
          const r = tryCompute({ targetIrr: g });
          if (r === null) {
            sceDisclosures.push(`The target value ${g} was refused by the engine; see the Scenarios tab.`);
            continue;
          }
          if (r.paymentAmount !== null) {
            sceBody.push({ label: `Payment at target ${g}%`, value: money(r.paymentAmount), kind: "money", rawValue: r.paymentAmount });
          } else {
            sceBody.push({ label: `Verdict at target ${g}%`, value: r.goalMet ? `met — achieved ${percentTwoOrDash(r.achievedIrr)}` : `not met — achieved ${percentTwoOrDash(r.achievedIrr)}`, kind: "percent", rawValue: r.achievedIrr });
          }
        }
      }
      if (sceBalloonsRaw.length > 0) {
        const balloonPayments = sceBalloonsRaw.map((b) => {
          const balloonValue = entryToValue(b, unit);
          const r = tryCompute({ repayment: { ...inputs.repayment, termYears: inputs.repayment.termYears, balloon: balloonValue } });
          return { label: `Balloon ${money(balloonValue)}`, payment: r === null ? null : r.paymentAmount };
        });
        const okBalloons = balloonPayments.filter((x): x is { label: string; payment: number } => x.payment !== null);
        if (okBalloons.length > 0) {
          const minB = Math.min(...okBalloons.map((x) => x.payment));
          const maxB = Math.max(...okBalloons.map((x) => x.payment));
          sceBody.push({ label: "Payment range across the set balloons", value: `${money(minB)} – ${money(maxB)}`, kind: "money", rawValue: null, disclosure: `at the ${inputs.repayment.termYears}-year term` });
          if (chartData.length === 0) {
            chartData = okBalloons.map((x) => ({ label: x.label, value: x.payment }));
            chartKicker = "Larger balloons lower the payment";
          }
        } else {
          sceDisclosures.push("The set balloon values were refused by the engine; see the Scenarios tab.");
        }
      }
    }
    if (chartData.length === 0 && sc.base.result !== null && sc.base.result.paymentAmount !== null) {
      chartData = [
        { label: "Base", value: sc.base.result.paymentAmount },
        ...(sc.optimistic.result !== null && sc.optimistic.result.paymentAmount !== null ? [{ label: "Optimistic", value: sc.optimistic.result.paymentAmount }] : []),
        ...(sc.pessimistic.result !== null && sc.pessimistic.result.paymentAmount !== null ? [{ label: "Pessimistic", value: sc.pessimistic.result.paymentAmount }] : []),
      ];
      chartKicker = "The named scenarios set the payment range";
    }
    let targetChart: ScenarioTargetChart | undefined;
    if (!profileActive && sceTargets.length >= 2) {
      if (result.paymentAmount !== null) {
        const pts: ScenarioTargetPoint[] = [];
        for (const g of sceTargets) {
          const r = tryCompute({ targetIrr: g });
          if (r !== null && r.paymentAmount !== null) pts.push({ target: g, label: `${g}%`, value: r.paymentAmount, met: true });
        }
        if (pts.length >= 2) {
          pts.sort((a, b) => a.target - b.target);
          targetChart = { mode: "solved", points: pts, breakEvenTarget: null, kicker: "The payment rises as the target IRR rises" };
        }
      } else {
        const pts: ScenarioTargetPoint[] = [];
        for (const g of sceTargets) {
          const r = tryCompute({ targetIrr: g });
          if (r !== null && r.achievedIrr !== null) pts.push({ target: g, label: `${g}%`, value: r.achievedIrr, met: r.goalMet });
        }
        if (pts.length >= 2) {
          pts.sort((a, b) => a.target - b.target);
          targetChart = { mode: "evaluated", points: pts, breakEvenTarget: result.achievedIrr, kicker: "The collections are fixed; only the verdict moves" };
        }
      }
    }
    slides.push({
      name: "scenarios",
      title: "The scenarios",
      body: sceBody,
      disclosures: sceDisclosures,
      ...(chartData.length > 0 ? { chart: { kind: "rows", data: chartData, ...(chartKicker !== undefined ? { kicker: chartKicker } : {}) } } : {}),
      ...(targetChart !== undefined ? { targetChart } : {}),
    });
  }

  // v0.6.18 Task A: the numbering adapts to the slide count (the conditional timeline, operations and
  // scenarios slides): two digits, no fixed array.
  let kickerIdx = 0;
  for (const sl of slides) {
    if (sl.name !== "title") {
      kickerIdx++;
      sl.kickerNumber = String(kickerIdx).padStart(2, "0");
    }
  }
  const provenance: string[] = anyScenarioSet
    ? ["Scenarios summary: present, fed by the user-set Scenarios tab values."]
    : ["Scenarios summary: no scenarios set."];
  // v0.6.10 Task G.1: the provenance disclosure carries the funding grounding — composed from
  // the funding row labels (the national and municipal schemes, AFIF) with the financing
  // clause (the EIB facility grounds the debt). The composition choice is disclosed in the
  // completion report.
  if (fundingView !== null && grantsTotal > 0) {
    const grantLabels = fundingView.rows.filter((r) => r.kind === "grant").map((r) => r.label).join("; ");
    const loanLabels = fundingView.rows.filter((r) => r.kind === "interest-free-loan").map((r) => r.label).join("; ");
    provenance.push(
      `Funding grounding: the grants (${grantLabels}) ground in the national and municipal shore-power schemes and AFIF; the debt facility is grounded by the financing overlay${loanLabels !== "" ? `; the interest-free note (${loanLabels}) nets to zero over the horizon` : ""}.`,
    );
  }
  if (timelineProvenance !== null) provenance.push(timelineProvenance);
  return { slides, glosses: TERM_GLOSSES, currency, unit, provenance };
}

// v0.6.18 Task A: the waterfall composes the capital program only — the capital lines (the ledger) and
// the capital groups (the stepped columns) — and closes at the Capital program step; the shares are of
// the capital program. The operating lines and the reinvestments no longer draw as steps: the total
// program cost stays a labeled figure of the slide, and its disclosure names the segments beyond.

const CADENCE_WORD: Record<number, string> = { 1: "year", 2: "half-year", 4: "quarter", 12: "month" };

// v0.6.18 Task H1: the recovery bars. The annual basis is the default: one bar per program year, the sum of its
// collections EXCLUDING the grant receipts and the interest-free note's cash (those are identified in their own
// figures). The month level composes only on request (the view toggle), as the monthly project inflows: every
// project inflow in the month it falls, the grants and the note's cash included — the kicker says so. The series
// is the single source the Presentation and the print route draw.
function composeRecoverySeries(result: ModelResult, startYear: number | null, monthly: boolean): { basis: "annual" | "monthly"; data: { label: string; value: number }[]; kicker: string; periodNote: string; noteAdvance: number } {
  const noteAdvance = (result.fundingView?.rows ?? []).filter((r) => r.kind === "interest-free-loan").reduce((a, r) => a + r.amount, 0);
  if (monthly) {
    return {
      basis: "monthly",
      data: result.monthly.map((m) => ({ label: `${yearHeader(m.year, startYear)} · month ${((m.period - 1) % 12) + 1}`, value: m.inflow })),
      kicker: "Project inflows by month, including the grants and the interest-free note's cash",
      periodNote: "Each bar is one month of every project inflow.",
      noteAdvance,
    };
  }
  const years = result.yearly.length;
  const byYear = new Array<number>(years).fill(0);
  for (const row of result.collectionsGrid) {
    if (row.kind === "grant" || row.kind === "funding-loan") continue;
    for (let k = 0; k < Math.min(years, row.amounts.length); k++) byYear[k] += row.amounts[k];
  }
  const funded = result.collectionsGrid.some((r) => r.kind === "grant" || r.kind === "funding-loan");
  return {
    basis: "annual",
    data: byYear.map((v, k) => ({ label: yearHeader(k + 1, startYear), value: v })),
    kicker: funded ? "Collections per year, excluding the grants and the interest-free note" : "Collections per year",
    periodNote: "Each bar is one program year: the sum of its twelve months.",
    noteAdvance,
  };
}
function composeWaterfall(c: ReturnType<typeof composeInvestment>, money: (v: number) => string): DeckWaterfall {
  const cap = Math.max(1e-12, c.capitalSubtotal);
  const share = (v: number) => percentOneForDisplay(v / cap);
  const rows: DeckLedgerRow[] = [];
  let acc = 0;
  for (const l of c.lines) {
    rows.push({ id: l.id, name: l.name, kind: "capital", raw: l.total, value: money(l.total), share: share(l.total), startPct: (acc / cap) * 100, widthPct: (l.total / cap) * 100 });
    acc += l.total;
  }
  rows.push({ id: "total", name: "Capital program", kind: "total", raw: c.capitalSubtotal, value: money(c.capitalSubtotal), share: share(c.capitalSubtotal), startPct: 0, widthPct: 100 });
  const columns: DeckStepColumn[] = [];
  let colAcc = 0;
  for (const g of c.groups) {
    columns.push({ id: g.id, name: g.name, kind: "capital", raw: g.total, value: money(g.total), bottomPct: (colAcc / cap) * 100, heightPct: (g.total / cap) * 100 });
    colAcc += g.total;
  }
  columns.push({ id: "total", name: "Capital program", kind: "total", raw: c.capitalSubtotal, value: money(c.capitalSubtotal), bottomPct: 0, heightPct: 100 });
  return { totalRaw: c.capitalSubtotal, rows, columns };
}

function investmentDisclosure(hasOperating: boolean, hasReinvestments: boolean): string {
  const beyond = [hasOperating ? "the operating lines" : null, hasReinvestments ? "the reinvestments" : null].filter((x): x is string => x !== null);
  const tail = beyond.length === 0 ? "" : ` The total program cost also includes ${beyond.join(" and ")}${hasOperating ? " (the operations slide shows the operating lines)" : ""}.`;
  return `Shares are of the capital program: the capital lines, closing at the Capital program step.${tail}`;
}

function operationsSlide(result: ModelResult, money: (v: number) => string, startYear: number | null): DeckSlide {
  const series = (result.bookView?.combined ?? []).map((r) => ({ year: r.year, value: r.operating }));
  const active = series.filter((s) => s.value > 0);
  const firstYear = active.length > 0 ? active[0].year : 1;
  const lastYear = active.length > 0 ? active[active.length - 1].year : 1;
  const burn = series.filter((s) => s.year >= firstYear && s.year <= lastYear).map((s) => ({ label: yearHeader(s.year, startYear), value: s.value }));
  const years = lastYear - firstYear + 1;
  const body: DeckFigure[] = [
    { label: "Operating lines total", value: money(result.operatingTotal), kind: "money", rawValue: result.operatingTotal, disclosure: "expensed as incurred; part of the total cost, not depreciated" },
    { label: "Share of the total program cost", value: percentOneForDisplay(result.operatingTotal / Math.max(1e-12, result.totalCost)), kind: "percent", rawValue: result.operatingTotal / Math.max(1e-12, result.totalCost) },
    ...result.operatingLines.map((o) => ({ label: `Operating line — ${o.label}`, value: money(o.total), kind: "money" as const, rawValue: o.total })),
  ];
  return {
    name: "operations",
    title: `The operating lines add ${money(result.operatingTotal)} of running cost over ${years} ${years === 1 ? "year" : "years"}`,
    body,
    disclosures: ["The tariff recovers the total program cost, capital and operating together; no income is attributable to the operating lines alone, so no income is paired with them on this slide."],
    chart: { kind: "bars", data: burn, kicker: "The operating cost per year" },
  };
}
const startYearOf = (opts: { startYear: number | null }): number | null => opts.startYear;

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

// The engine-composed action title: the program span and the gate count.
export function ganttTitle(spanYears: number, gateCount: number, startYear: number | null): string {
  const first = startYear === null ? "1" : String(startYear);
  const last = startYear === null ? String(spanYears) : String(startYear + spanYears - 1);
  const count = gateCount <= 10 ? NUMBER_WORDS[gateCount] : String(gateCount);
  return `The program runs years ${first}–${last} with ${count} decision ${gateCount === 1 ? "gate" : "gates"}`;
}

function ganttSlide(inputs: ModelInputs, result: ModelResult, startYear: number | null, monthGrid: boolean): DeckSlide {
  const tl = timelineOf(inputs);
  const spanYears = programSpanYears(inputs, result) as number;
  // v0.6.17: within a year the gates order by their month (a gate without a month keeps its authored place
  // at the year's centre); the sort is stable, so the year-grained order is exactly today's
  const gates = [...tl.decisionPoints].sort((a, b) => a.year - b.year || markerPosition({ firstYear: 0 }, 0, a.month) - markerPosition({ firstYear: 0 }, 0, b.month)).map((d) => ({
    id: d.id, code: d.code ?? null, title: d.title, year: d.year, month: d.month ?? null, outcome: d.outcome ?? null,
  }));
  // v0.6.13.2: the lanes are the visible vocabulary lanes; the year window is the extent of their
  // activities (the program span when none); the bars stack on sub-rows; markers outside the window
  // are omitted and counted. All of it composes here, once.
  const lanes = visibleLanes(tl);
  const win = timelineWindow(tl, spanYears);
  // v0.6.13.4: the ordinal composes here, once, over the FULL set after the chronological sort (stable,
  // so same-year milestones keep their authored order) and BEFORE the window filter: a milestone the
  // window omits never renumbers the others, and the authored id plays no part.
  const allMilestones = [...tl.milestones].sort((a, b) => a.year - b.year).map((m, i) => ({
    id: m.id, label: m.label, year: m.year, month: m.month ?? null,
    tie: m.tie === undefined ? null : m.tie.kind === "activity" ? `activity ${m.tie.activityId}` : m.tie.event,
    ordinal: i + 1,
  }));
  const inWindow = (y: number) => y >= win.firstYear && y <= win.lastYear;
  const omittedMarkers = gates.filter((g) => !inWindow(g.year)).length + allMilestones.filter((m) => !inWindow(m.year)).length;
  const captionParts: string[] = [];
  if (win.narrowed) {
    captionParts.push(`The axis shows ${yearHeader(win.firstYear, startYear)}–${yearHeader(win.lastYear, startYear)} of the program span ${yearHeader(1, startYear)}–${yearHeader(spanYears, startYear)}.`);
  }
  if (omittedMarkers > 0) {
    captionParts.push(`${omittedMarkers} ${omittedMarkers === 1 ? "marker falls" : "markers fall"} outside this window and ${omittedMarkers === 1 ? "is" : "are"} not drawn; the gates and milestones listed on this slide name ${omittedMarkers === 1 ? "it" : "them"}.`);
  }
  // The drawn milestones stack on rows within a shared year by proximity (the ordinal breaks ties), so two
  // diamonds never share a position; the computed engine-event month rides read-only beside the authored one.
  const events = availableEngineEvents(inputs, result);
  const drawn = allMilestones.filter((m) => inWindow(m.year));
  const stacked = layoutMilestoneRows(drawn.map((m) => ({ id: m.id, year: m.year, month: m.month ?? undefined, ordinal: m.ordinal })), win);
  const tieOf = new Map(tl.milestones.map((m) => [m.id, m.tie]));
  const drawnMilestones: DeckGanttMilestone[] = drawn.map((m, i) => {
    const tie = tieOf.get(m.id);
    const ev = tie !== undefined && tie.kind === "engine-event" ? events.find((e) => e.event === tie.event) : undefined;
    const computed = ev !== undefined && ev.month !== undefined && inWindow(ev.year)
      ? { year: ev.year, month: ev.month, pos: markerPosition(win, ev.year, ev.month), label: `computed: month ${ev.month}`, side: markerPosition(win, ev.year, ev.month) >= stacked[i].pos ? "right" as const : "left" as const }
      : null;
    return { ...m, pos: stacked[i].pos, row: stacked[i].row, computed };
  });
  const drawnGates = gates.filter((g) => inWindow(g.year));
  const gateLabels = layoutGateLabels(drawnGates.map((g) => ({ id: g.id, code: g.code, year: g.year, month: g.month ?? undefined })), win);
  const gantt: DeckGantt = {
    spanYears,
    window: { firstYear: win.firstYear, lastYear: win.lastYear },
    axis: Array.from({ length: win.years }, (_, k) => ({ year: win.firstYear + k, label: yearHeader(win.firstYear + k, startYear) })),
    lanes: lanes.map((l) => {
      const laid = layoutLane(l.activities.map((a) => ({ id: a.id, label: a.label, startYear: a.startYear, endYear: a.endYear, ...(a.startMonth !== undefined ? { startMonth: a.startMonth } : {}), ...(a.endMonth !== undefined ? { endMonth: a.endMonth } : {}) })), win);
      return { phase: l.id, label: l.label, labelLines: wrapLabel(l.label, GANTT_LANE_LABEL_CHARS), rowCount: laid.rowCount, rowLines: laid.rowLines, bars: laid.bars };
    }),
    gates: drawnGates.map((g, i) => ({ ...g, pos: gateLabels[i].pos, row: gateLabels[i].row })),
    gateRows: gateLabels.reduce((a, g) => Math.max(a, g.row + 1), 0),
    ...(monthGrid ? { monthGrid: Array.from({ length: win.years }, (_, k) => Array.from({ length: 11 }, (_, m) => k + (m + 1) / 12)).flat() } : {}),
    milestones: drawnMilestones,
    omittedMarkers,
    caption: captionParts.length > 0 ? captionParts.join(" ") : null,
  };
  const body: DeckFigure[] = [
    { label: "Program span", value: `${yearHeader(1, startYear)}–${yearHeader(spanYears, startYear)}`, kind: "text", rawValue: spanYears },
    { label: "Activities", value: String(tl.activities.length), kind: "count", rawValue: tl.activities.length },
    ...gates.map((g) => ({
      label: g.code ?? "Gate",
      value: `${g.title} — ${yearMonthHeader(g.year, g.month ?? undefined, startYear)}${g.outcome !== null ? ` (${g.outcome})` : ""}`,
      kind: "text" as const,
      rawValue: g.year,
    })),
    ...allMilestones.map((m) => ({ label: `Milestone ${m.ordinal}`, value: `${m.label} — ${yearMonthHeader(m.year, m.month ?? undefined, startYear)}`, kind: "text" as const, rawValue: m.year })),
  ];
  return {
    name: "timeline",
    title: ganttTitle(spanYears, gates.length, startYear),
    body,
    disclosures: [DECISION_DISCLOSURE],
    gantt,
  };
}

export type { TariffRow };
