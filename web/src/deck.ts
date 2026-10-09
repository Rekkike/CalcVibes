import type { ModelInputs, ModelResult, TariffRow } from "../../core/src/types.js";
import { moneyForDisplay, percentTwoForDisplay, dscrTwoForDisplay, deckMoneyForDisplay, deckYearsForDisplay } from "./engine.js";
import type { EntryUnit } from "./engine.js";
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
}

export function deckSlides(
  inputs: ModelInputs,
  result: ModelResult,
  opts: { startYear: number | null; entryUnit?: EntryUnit } = { startYear: null },
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
    body: [
      { label: "Subtitle", value: `Target ${percentTwoForDisplay(inputs.targetIrr / 100)} IRR over a ${inputs.repayment.termYears}-year term`, kind: "text", rawValue: null },
    ],
    disclosures: [],
    titleMetrics: [
      { label: "Project cost", value: money(result.totalCost) },
      { label: "Target IRR", value: percentTwoForDisplay(inputs.targetIrr / 100) },
      { label: "Investment term", value: `${inputs.repayment.termYears} years` },
    ],
  });

  // Slide 1 — investment
  const lineCount = inputs.costs.length;
  const investmentBody: DeckFigure[] = [
    { label: "Total cost (nominal)", value: money(result.totalCost), kind: "money", rawValue: result.totalCost },
    { label: "Cost NPV at target (discounted)", value: money(result.costNpv), kind: "money", rawValue: result.costNpv, disclosure: "discounted at the target rate" },
  ];
  for (const lt of result.lineTotals) {
    investmentBody.push({ label: lt.name, value: money(lt.total), kind: "money", rawValue: lt.total });
  }
  if (result.operatingTotal > 0) {
    investmentBody.push({ label: "Operating lines total", value: money(result.operatingTotal), kind: "money", rawValue: result.operatingTotal, disclosure: "a separate consideration, not in the investment total" });
  }
  slides.push({
    name: "investment",
    title: `We invest ${money(result.totalCost)} nominal across ${lineCount} cost lines`,
    body: investmentBody,
    disclosures: [],
    chart: { kind: "rows", data: result.lineTotals.map((l) => ({ label: l.name, value: l.total })) },
  });

  // Slide 2 — recovery
  let recoveryTitle: string;
  const recoveryBody: DeckFigure[] = [];
  if (!tariffCollectionMode && result.paymentAmount !== null) {
    recoveryTitle = `${result.paymentCount} payments of ${money(result.paymentAmount)} recover the full requirement`;
    recoveryBody.push({ label: "Payments", value: String(result.paymentCount), kind: "count", rawValue: result.paymentCount });
    recoveryBody.push({ label: "Payment per period", value: money(result.paymentAmount), kind: "money", rawValue: result.paymentAmount });
    recoveryBody.push({ label: "First collection", value: yearHeader(result.repaymentStartYear, startYear), kind: "text", rawValue: null });
    recoveryBody.push({ label: "Last collection", value: yearHeader(Math.ceil(result.lastPaymentMonth / 12), startYear), kind: "text", rawValue: null });
    recoveryBody.push({ label: "Total collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
    if (inputs.tariff?.mode === "decompose") {
      recoveryTitle = "Per-lift prices recover the requirement year by year";
      for (const ty of result.tariffYears) {
        recoveryBody.push({ label: `Unit price ${yearHeader(ty.year, startYear)}`, value: ty.unitPrice === null ? "not applicable" : money(ty.unitPrice), kind: "money", rawValue: ty.unitPrice });
      }
      const firstYearCharges = result.tariffYears[0]?.perRowCharges;
      if (firstYearCharges) {
        for (const row of inputs.tariff?.rows ?? []) {
          recoveryBody.push({ label: `Per-lift charge, ${row.label}`, value: money(firstYearCharges[row.id]), kind: "money", rawValue: firstYearCharges[row.id] });
        }
      }
    }
  } else if (inputs.tariff?.mode === "stable") {
    const base = result.tariffBaseUnitPrice as number;
    const unitPrices = result.tariffYears.map((y) => y.unitPrice as number);
    const minPrice = Math.min(...unitPrices);
    const maxPrice = Math.max(...unitPrices);
    recoveryTitle = `A stable tariff of ${money(base)} per weighted lift recovers the full requirement`;
    recoveryBody.push({ label: "Base price (first grid year terms)", value: money(base), kind: "money", rawValue: base });
    recoveryBody.push({ label: "Tariff escalation per year", value: percentTwoForDisplay(inputs.tariff.escalationPerYear / 100), kind: "percent", rawValue: inputs.tariff.escalationPerYear / 100 });
    recoveryBody.push({ label: "Unit-price range", value: `${money(minPrice)} – ${money(maxPrice)}`, kind: "money", rawValue: null });
    recoveryBody.push({ label: "Total collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
  } else if (inputs.tariff?.mode === "manual") {
    recoveryTitle = "Manual per-year prices — evaluated, not solved";
    recoveryBody.push({ label: "Mode", value: "evaluated, not solved", kind: "text", rawValue: null });
    recoveryBody.push({ label: "Total collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
  } else if (inputs.repayment.collectionsOverrides && Object.keys(inputs.repayment.collectionsOverrides).length > 0) {
    recoveryTitle = "A per-year collections profile — evaluated, not solved";
    recoveryBody.push({ label: "Mode", value: "evaluated, not solved", kind: "text", rawValue: null });
    for (const gr of result.collectionsGrid) {
      if (gr.id === "profile") {
        for (let k = 0; k < gr.amounts.length; k++) {
          if (gr.amounts[k] > 0) {
            recoveryBody.push({ label: `Collections ${yearHeader(k + 1, startYear)}`, value: money(gr.amounts[k]), kind: "money", rawValue: gr.amounts[k] });
          }
        }
      }
    }
    recoveryBody.push({ label: "Total collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
  } else {
    recoveryTitle = "A fixed amount per year — evaluated, not solved";
    recoveryBody.push({ label: "Mode", value: "evaluated, not solved", kind: "text", rawValue: null });
    recoveryBody.push({ label: "Total collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
  }
  const yearsCount = result.yearly.length;
  const inflowByYear = new Array<number>(yearsCount).fill(0);
  for (const row of result.collectionsGrid) {
    for (let k = 0; k < Math.min(yearsCount, row.amounts.length); k++) inflowByYear[k] += row.amounts[k];
  }
  const insights: string[] = [];
  if (result.paybackYears !== null) {
    insights.push(`You start turning a profit in ${yearHeader(Math.ceil(result.paybackYears), startYear)} (nominal payback ${deckYearsForDisplay(result.paybackYears)}).`);
  } else {
    insights.push("The project does not turn a profit within the modeled horizon.");
  }
  if (result.discountedPaybackYears !== null) {
    insights.push(`On a discounted basis, break-even arrives in ${yearHeader(Math.ceil(result.discountedPaybackYears), startYear)} (${deckYearsForDisplay(result.discountedPaybackYears)}).`);
  }
  slides.push({
    name: "recovery",
    title: recoveryTitle,
    body: recoveryBody,
    disclosures: leveraged ? ["Collections solved so the equity earns the target (leveraged solve)"] : [],
    chart: { kind: "bars", data: inflowByYear.map((v, k) => ({ label: yearHeader(k + 1, startYear), value: v })) },
    insights,
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
    ? "The requirement is not covered within the horizon"
    : "The outlay is recovered and the project turns cash-positive";
  slides.push({
    name: "coverage",
    title: coverageTitle,
    body: coverageBody,
    disclosures: [],
    chart: { kind: "coverage", data: result.yearly.map((y) => ({ label: yearHeader(y.year, startYear), value: y.cumulative })) },
  });

  slides.push({
    name: "returns",
    title: `The project earns ${percentTwoForDisplay(result.achievedIrr ?? 0)} against the ${percentTwoForDisplay(inputs.targetIrr / 100)} target`,
    body: [
      { label: "Achieved IRR", value: percentTwoForDisplay(result.achievedIrr ?? 0), kind: "percent", rawValue: result.achievedIrr },
      { label: "Goal check", value: result.goalMet ? "target achieved" : "target not achieved", kind: "text", rawValue: null },
      { label: "NPV at WACC (discounted)", value: money(result.npvAtWacc), kind: "money", rawValue: result.npvAtWacc, disclosure: "discounted at the WACC" },
      { label: "Profitability index", value: result.profitabilityIndex === null ? "—" : dscrTwoForDisplay(result.profitabilityIndex), kind: "dscr", rawValue: result.profitabilityIndex },
      { label: "Payback (nominal)", value: result.paybackYears === null ? "—" : deckYearsForDisplay(result.paybackYears), kind: "years", rawValue: result.paybackYears },
      { label: "Payback (discounted at WACC)", value: result.discountedPaybackYears === null ? "—" : deckYearsForDisplay(result.discountedPaybackYears), kind: "years", rawValue: result.discountedPaybackYears },
      { label: "MIRR", value: result.mirr === null ? "—" : percentTwoForDisplay(result.mirr), kind: "percent", rawValue: result.mirr, disclosure: "finance and reinvestment rates as configured" },
    ],
    disclosures: returnsDisclosures,
  });

  // Slide 4 — deal
  let dealTitle: string;
  const dealDisclosures: string[] = [];
  if (result.financing === null) {
    dealTitle = `The deal in one view — ${money(result.totalCost)} in, ${money(result.totalCollected)} back`;
  } else {
    const eq = result.financing.equity;
    if (eq.irrAmbiguous) {
      dealDisclosures.push(`The equity net flow has ${eq.signChanges} sign changes; the equity IRR may not be unique.`);
    }
    dealTitle = `Equity earns ${eq.zeroOutlay ? "nothing" : percentTwoForDisplay(eq.irr ?? 0)} on ${money(eq.outlay)} outlaid`;
  }
  let verdict: string | undefined;
  if (result.financing === null) {
    verdict = result.goalMet
      ? `This is a good deal: it earns ${percentTwoForDisplay(result.achievedIrr ?? 0)} against the target, and the net gain is ${money(result.netGain)}.`
      : `This deal falls short: it earns ${percentTwoForDisplay(result.achievedIrr ?? 0)} against the target, and the net gain is ${money(result.netGain)}.`;
  } else {
    const eq = result.financing.equity;
    verdict = result.goalMet
      ? `This is a good deal: the equity earns ${eq.zeroOutlay ? "nothing" : percentTwoForDisplay(eq.irr ?? 0)} on ${money(eq.outlay)} outlaid, and the project meets its target.`
      : `This deal falls short: the project earns ${percentTwoForDisplay(result.achievedIrr ?? 0)} against the target, and the equity does not recover its outlay.`;
  }
  const tiles: DeckTile[] = [
    { label: "Total cost", value: money(result.totalCost) },
    { label: "Total collected", value: money(result.totalCollected) },
    { label: "Net gain", value: money(result.netGain), tone: result.netGain >= 0 ? "ok" : "bad" },
    { label: "Achieved IRR", value: `${percentTwoForDisplay(result.achievedIrr ?? 0)} vs ${percentTwoForDisplay(inputs.targetIrr / 100)} target`, tone: result.goalMet ? "ok" : "bad" },
    { label: "NPV at WACC", value: money(result.npvAtWacc), tone: result.npvAtWacc >= 0 ? "ok" : "bad" },
    { label: "Payback (nominal)", value: result.paybackYears === null ? "—" : deckYearsForDisplay(result.paybackYears) },
    { label: "Payback (discounted)", value: result.discountedPaybackYears === null ? "—" : deckYearsForDisplay(result.discountedPaybackYears) },
    { label: "Break-even year", value: result.paybackYears === null ? "not within the horizon" : yearHeader(Math.ceil(result.paybackYears), startYear) },
    { label: "MIRR", value: percentTwoForDisplay(result.mirr ?? 0) },
    { label: "Profitability index", value: dscrTwoForDisplay(result.profitabilityIndex ?? 0) },
  ];
  if (result.financing !== null) {
    const eq = result.financing.equity;
    tiles.push({ label: "Equity outlay", value: money(eq.outlay) });
    tiles.push({ label: "Equity IRR", value: eq.zeroOutlay ? "not applicable (zero equity outlay)" : (eq.irr === null ? "—" : percentTwoForDisplay(eq.irr)) });
    tiles.push({ label: "Equity NPV at WACC (discounted)", value: money(eq.npvAtWacc) });
    tiles.push({ label: "Drawn (nominal)", value: money(result.financing.drawnTotal) });
    if (result.financing.minDscr !== null) {
      tiles.push({ label: "Minimum DSCR", value: dscrTwoForDisplay(result.financing.minDscr.value), tone: result.financing.minDscr.value >= 1.0 ? "ok" : "bad", disclosure: `in ${yearHeader(result.financing.minDscr.year, startYear)}` });
    }
  }
  const summaryCharts: DeckChartSlot[] = [
    { kind: "hurdle", solved: result.paymentAmount !== null, data: [
      { label: "Target", value: inputs.targetIrr },
      { label: "Achieved", value: (result.achievedIrr ?? 0) * 100 },
    ] },
    { kind: "bars", data: result.yearly.map((y) => ({ label: yearHeader(y.year, startYear), value: y.inflow })) },
  ];
  slides.push({ name: "deal", title: dealTitle, body: [], disclosures: dealDisclosures, verdict, tiles, summaryCharts });

  const kickerNumbers = ["01", "02", "03", "04", "05"];
  let kickerIdx = 0;
  for (const sl of slides) {
    if (sl.name !== "title") {
      sl.kickerNumber = kickerNumbers[kickerIdx] ?? "";
      kickerIdx++;
    }
  }
  return { slides, glosses: TERM_GLOSSES, currency, unit };
}

export type { TariffRow };
