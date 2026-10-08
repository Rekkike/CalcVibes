import type { ModelInputs, ModelResult, TariffRow } from "../../core/src/types.js";
import { moneyForDisplay, percentTwoForDisplay, yearsTwoForDisplay, dscrTwoForDisplay } from "./engine.js";
import { yearHeader } from "./state.js";

export type FigureKind = "money" | "percent" | "years" | "dscr" | "count" | "text";

export interface DeckFigure {
  label: string;
  value: string;
  kind: FigureKind;
  rawValue: number | string | null;
  disclosure?: string;
}

export interface DeckSlide {
  name: string;
  title: string;
  body: DeckFigure[];
  disclosures: string[];
}

export interface DeckModel {
  slides: DeckSlide[];
}

export function deckSlides(
  inputs: ModelInputs,
  result: ModelResult,
  opts: { startYear: number | null } = { startYear: null },
): DeckModel {
  const currency = (inputs.currency as Parameters<typeof moneyForDisplay>[1]) ?? "SEK";
  const money = (v: number) => moneyForDisplay(v, currency);
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
  } else {
    recoveryTitle = "A fixed amount per year — evaluated, not solved";
    recoveryBody.push({ label: "Mode", value: "evaluated, not solved", kind: "text", rawValue: null });
    recoveryBody.push({ label: "Total collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
  }
  slides.push({ name: "recovery", title: recoveryTitle, body: recoveryBody, disclosures: leveraged ? ["Collections solved so the equity earns the target (leveraged solve)"] : [] });

  // Slide 3 — returns
  const returnsDisclosures: string[] = [];
  if (result.irrAmbiguous) {
    returnsDisclosures.push(`The net flow has ${result.signChanges} sign changes; the IRR may not be unique.`);
  }
  slides.push({
    name: "returns",
    title: `The project earns ${percentTwoForDisplay(result.achievedIrr ?? 0)} against the ${percentTwoForDisplay(inputs.targetIrr / 100)} target`,
    body: [
      { label: "Achieved IRR", value: percentTwoForDisplay(result.achievedIrr ?? 0), kind: "percent", rawValue: result.achievedIrr },
      { label: "Goal check", value: result.goalMet ? "target achieved" : "target not achieved", kind: "text", rawValue: null },
      { label: "NPV at WACC (discounted)", value: money(result.npvAtWacc), kind: "money", rawValue: result.npvAtWacc, disclosure: "discounted at the WACC" },
      { label: "Profitability index", value: result.profitabilityIndex === null ? "—" : dscrTwoForDisplay(result.profitabilityIndex), kind: "dscr", rawValue: result.profitabilityIndex },
      { label: "Payback (nominal)", value: result.paybackYears === null ? "—" : yearsTwoForDisplay(result.paybackYears), kind: "years", rawValue: result.paybackYears },
      { label: "Payback (discounted at WACC)", value: result.discountedPaybackYears === null ? "—" : yearsTwoForDisplay(result.discountedPaybackYears), kind: "years", rawValue: result.discountedPaybackYears },
      { label: "MIRR", value: result.mirr === null ? "—" : percentTwoForDisplay(result.mirr), kind: "percent", rawValue: result.mirr, disclosure: "finance and reinvestment rates as configured" },
    ],
    disclosures: returnsDisclosures,
  });

  // Slide 4 — deal
  let dealTitle: string;
  const dealBody: DeckFigure[] = [];
  const dealDisclosures: string[] = [];
  if (result.financing === null) {
    dealTitle = `The deal in one view — ${money(result.totalCost)} in, ${money(result.totalCollected)} back`;
    dealBody.push({ label: "Invested (nominal)", value: money(result.totalCost), kind: "money", rawValue: result.totalCost });
    dealBody.push({ label: "Collected (nominal)", value: money(result.totalCollected), kind: "money", rawValue: result.totalCollected });
    dealBody.push({ label: "Net gain (nominal)", value: money(result.netGain), kind: "money", rawValue: result.netGain });
    dealBody.push({ label: "Payback (nominal)", value: result.paybackYears === null ? "—" : yearsTwoForDisplay(result.paybackYears), kind: "years", rawValue: result.paybackYears });
  } else {
    const eq = result.financing.equity;
    const irrFigure: DeckFigure = eq.zeroOutlay
      ? { label: "Equity IRR", value: "Not applicable (zero equity outlay)", kind: "text", rawValue: null }
      : { label: "Equity IRR", value: eq.irr === null ? "—" : percentTwoForDisplay(eq.irr), kind: "percent", rawValue: eq.irr };
    if (eq.irrAmbiguous) {
      dealDisclosures.push(`The equity net flow has ${eq.signChanges} sign changes; the equity IRR may not be unique.`);
    }
    dealTitle = `Equity earns ${eq.zeroOutlay ? "nothing" : percentTwoForDisplay(eq.irr ?? 0)} on ${money(eq.outlay)} outlaid`;
    dealBody.push({ label: "Equity outlay", value: money(eq.outlay), kind: "money", rawValue: eq.outlay });
    dealBody.push({ label: "Equity NPV at WACC (discounted)", value: money(eq.npvAtWacc), kind: "money", rawValue: eq.npvAtWacc, disclosure: "discounted at the WACC" });
    dealBody.push(irrFigure);
    dealBody.push({ label: "Drawn (nominal)", value: money(result.financing.drawnTotal), kind: "money", rawValue: result.financing.drawnTotal });
    if (result.financing.minDscr !== null) {
      dealBody.push({ label: "Minimum DSCR", value: dscrTwoForDisplay(result.financing.minDscr.value), kind: "dscr", rawValue: result.financing.minDscr.value, disclosure: `in ${yearHeader(result.financing.minDscr.year, startYear)}` });
    }
  }
  slides.push({ name: "deal", title: dealTitle, body: dealBody, disclosures: dealDisclosures });

  return { slides };
}

export type { TariffRow };
