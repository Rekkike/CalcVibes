import type { ModelInputs, ModelResult, TariffRow } from "../../core/src/types.js";
import { moneyForDisplay, percentTwoForDisplay, dscrTwoForDisplay, deckMoneyForDisplay, deckYearsForDisplay, computeModel, entryToValue } from "./engine.js";
import type { EntryUnit } from "./engine.js";
import { scenarioResults } from "../../core/src/scenarios.js";
import { yearHeader } from "./state.js";

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
}

export interface DeckTile {
  label: string;
  value: string;
  tone?: "ok" | "bad";
  disclosure?: string;
  rawValue?: number | null;
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
  titleMetrics?: { label: string; value: string }[];
  kickerNumber?: string;
  solverScenario?: { label: string; requiredPayment: string | null } | null;
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
  opts: { startYear: number | null; entryUnit?: EntryUnit; scenarioTargets?: number[] | null; scenarioTerms?: number[] | null; scenarioBalloons?: number[] | null } = { startYear: null },
): DeckModel {
  const currency = (inputs.currency as Parameters<typeof moneyForDisplay>[1]) ?? "SEK";
  const unit = opts.entryUnit ?? "ones";
  const money = (v: number) => deckMoneyForDisplay(v, currency, unit);
  const startYear = opts.startYear;
  const leveraged = result.leveragedSolve;
  const tariffCollectionMode = inputs.tariff !== undefined && inputs.tariff.mode !== "off" && inputs.tariff.mode !== "decompose";
  const slides: DeckSlide[] = [];

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

  // Slide 1 — executive summary (v0.6.4 Part B: the infographic block row — large figures, no paragraphs)
  slides.push({
    name: "summary",
    title: "Executive summary",
    body: [],
    disclosures: [],
    tiles: [
      { label: "Cost NPV", value: money(result.costNpv), rawValue: result.costNpv, disclosure: "at the target rate" },
      { label: "Achieved IRR", value: percentTwoForDisplay(result.achievedIrr ?? 0), rawValue: result.achievedIrr, tone: result.goalMet ? "ok" : "bad" },
      { label: "Payback", value: result.paybackYears === null ? "—" : deckYearsForDisplay(result.paybackYears), rawValue: result.paybackYears },
      { label: "Solved payment", value: result.paymentAmount === null ? "—" : money(result.paymentAmount), rawValue: result.paymentAmount },
      { label: "Collected vs cost", value: `${money(result.totalCollected)} vs ${money(result.totalCost)}`, rawValue: result.totalCollected },
      { label: "Verdict", value: result.goalMet ? "Target met" : "Target missed", tone: result.goalMet ? "ok" : "bad" },
    ],
  });

  // Slide 2 — investment
  const investmentBody: DeckFigure[] = [
    { label: "Total cost (nominal)", value: money(result.totalCost), kind: "money", rawValue: result.totalCost },
    { label: "Cost NPV at target (discounted)", value: money(result.costNpv), kind: "money", rawValue: result.costNpv, disclosure: "discounted at the target rate" },
  ];
  if (result.operatingTotal > 0) {
    investmentBody.push({ label: "Operating lines total", value: money(result.operatingTotal), kind: "money", rawValue: result.operatingTotal, disclosure: "a separate consideration, not in the investment total" });
  }
  slides.push({
    name: "investment",
    title: "The investment",
    body: investmentBody,
    disclosures: [],
    chart: { kind: "rows", data: result.lineTotals.map((l) => ({ label: l.name, value: l.total })) },
  });

  // Slide 3 — recovery
  let recoveryTitle: string;
  const recoveryBody: DeckFigure[] = [];
  if (!tariffCollectionMode && result.paymentAmount !== null) {
    recoveryTitle = "The recovery — solved payments";
    recoveryBody.push({ label: "Payments", value: String(result.paymentCount), kind: "count", rawValue: result.paymentCount });
    recoveryBody.push({ label: "Payment per period", value: money(result.paymentAmount), kind: "money", rawValue: result.paymentAmount });
    recoveryBody.push({ label: "Total collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
    if (inputs.tariff?.mode === "decompose") {
      recoveryTitle = "The recovery — per-lift prices";
      const firstPrice = result.tariffYears[0]?.unitPrice;
      recoveryBody.push({ label: `Unit price ${yearHeader(result.tariffYears[0]?.year ?? 1, startYear)}`, value: firstPrice === null || firstPrice === undefined ? "not applicable" : money(firstPrice), kind: "money", rawValue: firstPrice ?? null });
    }
  } else if (inputs.tariff?.mode === "stable") {
    const base = result.tariffBaseUnitPrice as number;
    recoveryTitle = "The recovery — a stable tariff";
    recoveryBody.push({ label: "Base price (first grid year terms)", value: money(base), kind: "money", rawValue: base });
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
  const yearsCount = result.yearly.length;
  const inflowByYear = new Array<number>(yearsCount).fill(0);
  for (const row of result.collectionsGrid) {
    for (let k = 0; k < Math.min(yearsCount, row.amounts.length); k++) inflowByYear[k] += row.amounts[k];
  }
  slides.push({
    name: "recovery",
    title: recoveryTitle,
    body: recoveryBody,
    disclosures: leveraged ? ["Collections solved so the equity earns the target (leveraged solve)"] : [],
    chart: { kind: "bars", data: inflowByYear.map((v, k) => ({ label: yearHeader(k + 1, startYear), value: v })) },
  });

  // Slide 3 — returns
  const returnsDisclosures: string[] = [];
  if (result.irrAmbiguous) {
    returnsDisclosures.push(`The net flow has ${result.signChanges} sign changes; the IRR may not be unique.`);
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
  slides.push({
    name: "coverage",
    title: coverageTitle,
    body: coverageBody,
    disclosures: [],
    chart: { kind: "coverage", data: result.yearly.map((y) => ({ label: yearHeader(y.year, startYear), value: y.cumulative })) },
  });

  slides.push({
    name: "returns",
    title: "The returns",
    body: [
      { label: "Achieved IRR", value: percentTwoForDisplay(result.achievedIrr ?? 0), kind: "percent", rawValue: result.achievedIrr },
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
    if (eq.irrAmbiguous) {
      dealDisclosures.push(`The equity net flow has ${eq.signChanges} sign changes; the equity IRR may not be unique.`);
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
      ? `Target met — equity IRR ${eq.zeroOutlay ? "not applicable" : percentTwoForDisplay(eq.irr ?? 0)} on ${money(eq.outlay)} outlaid.`
      : `Target missed — equity IRR ${eq.zeroOutlay ? "not applicable" : percentTwoForDisplay(eq.irr ?? 0)} on ${money(eq.outlay)} outlaid.`;
  }
  const tiles: DeckTile[] = [
    { label: "Total cost", value: money(result.totalCost), rawValue: result.totalCost },
    { label: "Total collected", value: money(result.totalCollected), rawValue: result.totalCollected },
    { label: "Net gain", value: money(result.netGain), tone: result.netGain >= 0 ? "ok" : "bad", rawValue: result.netGain },
    { label: "Achieved IRR", value: `${percentTwoForDisplay(result.achievedIrr ?? 0)} vs ${percentTwoForDisplay(inputs.targetIrr / 100)} target`, tone: result.goalMet ? "ok" : "bad", rawValue: result.achievedIrr },
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
  const summaryCharts: DeckChartSlot[] = [
    { kind: "hurdle", solved: result.paymentAmount !== null, data: [
      { label: "Target", value: inputs.targetIrr },
      { label: "Achieved", value: (result.achievedIrr ?? 0) * 100 },
    ] },
    { kind: "bars", data: result.yearly.map((y) => ({ label: yearHeader(y.year, startYear), value: y.inflow })) },
  ];
  if (result.residualDisclosure !== null && result.residualDisclosure !== undefined) {
    dealDisclosures.push(result.residualDisclosure);
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
    let sc: ReturnType<typeof scenarioResults> | null = null;
    try {
      sc = scenarioResults(inputs);
    } catch {
      sc = null;
    }
    if (sc !== null && sc.base.paymentAmount !== null) {
      const basePayment = sc.base.paymentAmount;
      if (sc.optimistic.paymentAmount !== null) {
        sceBody.push({ label: "Named-set delta, optimistic vs base", value: money(sc.optimistic.paymentAmount - basePayment), kind: "money", rawValue: sc.optimistic.paymentAmount - basePayment });
      }
      if (sc.pessimistic.paymentAmount !== null) {
        sceBody.push({ label: "Named-set delta, pessimistic vs base", value: money(sc.pessimistic.paymentAmount - basePayment), kind: "money", rawValue: sc.pessimistic.paymentAmount - basePayment });
      }
    } else {
      sceDisclosures.push("The named scenario sets could not be computed for this project; see the Scenarios tab.");
    }
    let chartData: { label: string; value: number }[] = [];
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
            sceBody.push({ label: `Verdict at target ${g}%`, value: r.goalMet ? `met — achieved ${percentTwoForDisplay(r.achievedIrr ?? 0)}` : `not met — achieved ${percentTwoForDisplay(r.achievedIrr ?? 0)}`, kind: "percent", rawValue: r.achievedIrr });
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
          }
        } else {
          sceDisclosures.push("The set balloon values were refused by the engine; see the Scenarios tab.");
        }
      }
    }
    if (chartData.length === 0 && sc !== null && sc.base.paymentAmount !== null) {
      chartData = [
        { label: "Base", value: sc.base.paymentAmount },
        ...(sc.optimistic.paymentAmount !== null ? [{ label: "Optimistic", value: sc.optimistic.paymentAmount }] : []),
        ...(sc.pessimistic.paymentAmount !== null ? [{ label: "Pessimistic", value: sc.pessimistic.paymentAmount }] : []),
      ];
    }
    slides.push({
      name: "scenarios",
      title: "The scenarios",
      body: sceBody,
      disclosures: sceDisclosures,
      ...(chartData.length > 0 ? { chart: { kind: "rows", data: chartData } } : {}),
    });
  }

  const kickerNumbers = ["01", "02", "03", "04", "05", "06", "07"];
  let kickerIdx = 0;
  for (const sl of slides) {
    if (sl.name !== "title") {
      sl.kickerNumber = kickerNumbers[kickerIdx] ?? "";
      kickerIdx++;
    }
  }
  const provenance: string[] = anyScenarioSet
    ? ["Scenarios summary: present, fed by the user-set Scenarios tab values."]
    : ["Scenarios summary: no scenarios set."];
  return { slides, glosses: TERM_GLOSSES, currency, unit, provenance };
}

export type { TariffRow };
