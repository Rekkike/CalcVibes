// Directive v0.6.7 — the realistic demo rotation: pins of record (Task D); re-anchored to the
// v0.6.10 whole-program shore-power fixture for the loader and deck pins (Tasks E/F/G); the
// internal port and land fixtures keep their engine pins unchanged.
// Every figure below was script-verified against the delivered engine before this file was
// written. Exact double equality (toBe) is used wherever the engine returns the pinned double
// verbatim; toBeCloseTo is used only where the directive prints a rounded spelling of the
// engine scalar (the four operating-line totals and the land c2 remaining book value), with
// the precision noted. The achieved IRR values are asserted at the engine's exact float
// spellings (0.06000000000000005 and 0.07999999999999963), never the directive's 0.06/0.08
// roundings — assert what the engine returns.
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { shorePowerProgram, shorePowerProject, landNewbuildProject } from "../src/state.js";
import {
  computeModel,
  entryToValue,
} from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import type { ModelInputs, ModelResult } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function solvedPayment(inputs: ModelInputs): number {
  const r = computeModel(inputs);
  expect(r.paymentAmount).not.toBeNull();
  return r.paymentAmount as number;
}

function bodyFigureValue(slideName: string, label: string): string | null {
  const slide = document.querySelector('[data-slide-name="' + slideName + '"]') as HTMLElement;
  const figures = Array.from(slide.querySelectorAll(".deck-figure"));
  for (const f of figures) {
    if (f.querySelector(".deck-figure-label")?.textContent === label) {
      return f.querySelector(".deck-figure-value")?.textContent ?? null;
    }
  }
  return null;
}

function tileValue(label: string): string | null {
  const tile = document.querySelector('[data-testid="summary-tiles"] [data-tile="' + label + '"]');
  return tile?.querySelector(".stat-value")?.textContent ?? null;
}

function titleMetricValue(label: string): string | null {
  const m = document.querySelector('[data-testid="title-metrics"] [data-title-metric="' + label + '"]');
  return m?.querySelector(".metric-value")?.textContent ?? null;
}

function gridRow(result: ModelResult, id: string, kind: string) {
  return result.collectionsGrid.find((r) => r.id === id && r.kind === kind);
}

function gridRowSum(result: ModelResult, id: string, kind: string): number {
  const row = gridRow(result, id, kind);
  expect(row).toBeDefined();
  return sum((row as { amounts: number[] }).amounts);
}

function setEntryUnit(unit: string) {
  fireEvent.change(document.querySelector('[data-field="entryUnit"]') as HTMLSelectElement, { target: { value: unit } });
}

function scenarioAxisValues(axis: string): string[] {
  return Array.from(document.querySelectorAll('[data-field="scenario-' + axis + '"]')).map(
    (i) => (i as HTMLInputElement).value
  );
}

describe("v0.6.7 Task D: the realistic demo rotation — the port fixture (Rotterdam shore power)", () => {
  it("PORT-ENGINE: computeModel(shorePowerProject()) returns the pinned scalars", () => {
    const r = computeModel(shorePowerProject());
    expect(r.totalCost).toBe(269591641.24463195);
    expect(r.costNpv).toBe(193986917.11967131);
    expect(r.paymentAmount).toBe(1626222.633944825);
    expect(r.paymentCount).toBe(240);
    expect(r.totalCollected).toBe(390293432.14675796);
    expect(r.paybackYears).toBe(14.110973479529967);
    // The directive prints 0.06; the engine's exact double is asserted (disclosed in the report).
    expect(r.achievedIrr).toBe(0.06000000000000005);
    expect(r.goalMet).toBe(true);
    expect(r.signChanges).toBe(1);
    expect(r.irrAmbiguous).toBe(false);
    expect(r.headlineSource).toBe("monthly");
    expect(r.npvAtWacc).toBe(27497141.22492155);
    expect(r.mirr).toBe(0.04490275022718304);
    expect(r.profitabilityIndex).toBe(1.1288815565352854);
    expect(r.discountedPaybackYears).toBe(18.36849845472896);
    expect(r.netGain).toBe(120701790.90212601);
    expect(r.operatingTotal).toBe(109591641.24463195);
    expect(r.horizon).toBeDefined();
    expect(r.horizon?.totalMonths).toBe(276);
    expect(r.horizon?.totalYears).toBe(23);
    expect(r.firstPaymentMonth).toBe(36);
    expect(r.lastPaymentMonth).toBe(275);
    expect(r.lineTotals.map((l) => l.total)).toEqual([12000000, 48000000, 48000000, 36000000, 16000000]);
    expect(r.residualAmountUsed).toBe(0);
    const o1 = r.operatingLines.find((o) => o.id === "o1");
    const o2 = r.operatingLines.find((o) => o.id === "o2");
    expect(o1).toBeDefined();
    expect(o2).toBeDefined();
    // The directive prints 78905981.6961 / 30685659.5485; the engine scalars carry more digits.
    expect(o1?.total).toBeCloseTo(78905981.6961, 4);
    expect(o1?.effectiveWindow).toEqual([37, 275]);
    expect(o2?.total).toBeCloseTo(30685659.5485, 4);
    expect(o2?.effectiveWindow).toEqual([37, 275]);
  });

  it("PORT-BOOK: the charge schedule totals 160 000 000 with an 8 000 000 yearly charge from year 4 and a zero ending book", () => {
    const r = computeModel(shorePowerProject());
    const book = r.bookView;
    expect(book).toBeDefined();
    expect((book as NonNullable<ModelResult["bookView"]>).totalCharge).toBe(160000000);
    const combined = (book as NonNullable<ModelResult["bookView"]>).combined;
    for (let y = 4; y <= 23; y++) {
      expect(combined.find((row) => row.year === y)?.charge).toBe(8000000);
    }
    const chargesAt4: Record<string, number> = { c1: 600000, c2: 2400000, c3: 2400000, c4: 1800000, c5: 800000 };
    for (const line of (book as NonNullable<ModelResult["bookView"]>).lines) {
      const y4 = line.years.find((row) => row.year === 4);
      expect(y4).toBeDefined();
      expect(y4?.charge).toBe(chargesAt4[line.id]);
      const last = line.years[line.years.length - 1];
      expect(last.ending).toBe(0);
    }
  });

  it("PORT-TARIFF: 21 grid years (project years 3 through 23) with the pinned unit prices, required amounts, weighted volumes, and per-call prices", () => {
    const r = computeModel(shorePowerProject());
    const ts = r.tariffYears;
    expect(ts.length).toBe(21);
    ts.forEach((t, i) => expect(t.year).toBe(i + 3));
    expect(ts[0].unitPrice).toBe(5.807937978374375);
    expect(ts[1].unitPrice).toBe(9.034570188582359);
    expect(ts[2].unitPrice).toBe(7.227656150865887);
    expect(ts[3].unitPrice).toBe(6.377343662528724);
    for (let i = 4; i <= 19; i++) expect(ts[i].unitPrice).toBe(5.706044329630964);
    expect(ts[20].unitPrice).toBe(5.23054063549505);
    expect(ts[0].required).toBe(1626222.633944825);
    for (let i = 1; i <= 19; i++) expect(ts[i].required).toBe(19514671.607337896);
    expect(ts[20].required).toBe(17888448.97339307);
    // v0.6.8 Task D re-anchor: the lift volumes are rescaled by 1,000 to yearly vessel moves
    // (the composition-time miss of record); every solved figure is byte-identical, so only the
    // volume-derived spellings move (unit price and per-row charges divide by the same 1,000).
    expect(ts[0].weightedVolume).toBe(280000);
    expect(ts[1].weightedVolume).toBe(2160000);
    expect(ts[2].weightedVolume).toBe(2700000);
    expect(ts[3].weightedVolume).toBe(3060000);
    for (let i = 4; i < ts.length; i++) expect(ts[i].weightedVolume).toBe(3420000);
    // perRowCharges are per-lift prices (perRowCharges structure is untouched; the values rescale).
    expect(ts[0].perRowCharges?.["r1"]).toBe(11.61587595674875);
    expect(ts[0].perRowCharges?.["r2"]).toBe(5.807937978374375);
  });

  it("PORT-GRID: the collections grid carries the two tariff rows with the post-fix yearly revenues; the column identities hold", () => {
    const r = computeModel(shorePowerProject());
    expect(r.collectionsGrid.filter((row) => row.kind === "tariff").length).toBe(2);
    expect(gridRowSum(r, "r1", "tariff")).toBe(303574464.86520803);
    expect(gridRowSum(r, "r2", "tariff")).toBe(86718967.28154981);
    const both = gridRowSum(r, "r1", "tariff") + gridRowSum(r, "r2", "tariff");
    expect(Math.abs(both - r.totalCollected)).toBeLessThan(1e-6);
    // Task C post-fix: every grid year's column sums to that year's inflow within 1e-6.
    const rows = r.collectionsGrid.filter((row) => row.kind === "tariff");
    for (let k = 0; k < r.yearly.length; k++) {
      const column = sum(rows.map((row) => row.amounts[k] ?? 0));
      expect(Math.abs(column - r.yearly[k].inflow)).toBeLessThan(1e-6);
    }
  });

  it("PORT-SCENARIO: the preset axes' sensitivities return the pinned solved payments", () => {
    const base = shorePowerProject();
    const atTarget = (t: number) => solvedPayment({ ...base, targetIrr: t });
    expect(atTarget(4)).toBe(1440560.902541411);
    expect(atTarget(8)).toBe(1828351.5172141492);
    const atTerm = (y: number) => solvedPayment({ ...base, repayment: { ...base.repayment, termYears: y } });
    expect(atTerm(15)).toBe(1831394.2154840531);
    expect(atTerm(25)).toBe(1460126.4927575013);
    // The balloon axis entries are entry-unit values; at unit "millions" 8 and 16 scale to raw
    // 8 000 000 and 16 000 000 at compute (the v0.6.6 amendment lesson of record).
    const atBalloonEntry = (e: number) =>
      solvedPayment({ ...base, repayment: { ...base.repayment, balloon: entryToValue(e, (base.entryUnit ?? "ones") as Parameters<typeof entryToValue>[1]) } });
    expect(atBalloonEntry(0)).toBe(1626222.633944825);
    expect(atBalloonEntry(8)).toBe(1608665.1352002623);
    expect(atBalloonEntry(16)).toBe(1591107.6364556993);
  });

  it("PROGRAM-LOADER: the button relabeled, the data-action unchanged, the start year preset, and the axes surface in the Scenarios tab beside the honest refusal (v0.6.10 Task E)", async () => {
    render(<App />);
    const button = byAction("load-demo");
    expect(button).toBeTruthy();
    expect(button.textContent).toBe("Load shore-power program demo (Rotterdam)");
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText("Shore-power program (Rotterdam)")).toBeTruthy();
    });
    expect((document.querySelector('[data-field="startYear"]') as HTMLInputElement).value).toBe("2026");
    fireEvent.click(byNav("scenarios"));
    // The three preset axes surface; the grant-scale axis ships empty (Task E.5).
    expect(scenarioAxisValues("target")).toEqual(["4", "6", "8"]);
    expect(scenarioAxisValues("term")).toEqual(["15", "20", "25"]);
    expect(scenarioAxisValues("balloon")).toEqual(["0", "8", "16"]);
    expect(scenarioAxisValues("grant-scale")).toEqual([]);
    // v0.6.11 re-anchor (Task E): the per-variant contract — the optimistic variant refuses
    // under its own terms (the term-25 shift leaves the declared tariff span) and carries its
    // engine reason beside its row; the axis editors and the per-cell tables still render.
    expect(document.querySelector('[data-testid="scenarios-framing"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="scenario-refusal-optimistic"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="scenario-refusal-optimistic"]')?.textContent).toContain(
      "The required collections extend to year 24, beyond the declared tariff span (years 3-23)"
    );
    expect(document.querySelector('[data-testid="term-target-table"]')).toBeTruthy();
  });

  it("PROGRAM-DECK: the rendered deck at entry unit ones carries the pinned figures, the funding block, and the fees-and-grants donut (v0.6.10 Tasks E/G)", async () => {
    const inputs = shorePowerProgram();
    const result = computeModel(inputs);
    const deck = deckSlides(inputs, result, {
      startYear: 2026,
      entryUnit: "ones",
      scenarioTargets: [4, 6, 8],
      scenarioTerms: [15, 20, 25],
      scenarioBalloons: [0, 8, 16],
    });
    // Deck-model pins (exact doubles): the outflow donut segments (the six capital lines),
    // the inflow donut's two segments (fees and grants), the funding block raws, the
    // provenance funding grounding, and the targetChart points.
    const summary = deck.slides.find((s) => s.name === "summary");
    expect(summary).toBeDefined();
    const outflows = summary?.donuts?.find((d) => d.id === "outflows");
    const inflows = summary?.donuts?.find((d) => d.id === "inflows");
    expect(outflows?.segments.map((s) => s.value)).toEqual([74000000, 110000000, 100000000, 125000000, 20000000, 20000000]);
    expect(outflows?.disclosure).toBe("The outflow donut shows the capital program; operating lines and reinvestments are part of the total cost and are shown separately.");
    // The inflow donut: fees and grants of the totalCollected circle; the interest-free loan
    // nets to zero and never joins the donut (the loan-nets-zero disclosure).
    expect(inflows?.segments.map((s) => s.value)).toEqual([682407745.3398229, 173500000]);
    expect(sum(inflows?.segments.map((s) => s.value) ?? [])).toBeCloseTo(result.totalCollected, 6);
    expect(inflows?.disclosure).toBe("Fees are the collections-side tariff rows; the interest-free loan nets to zero over the horizon and never joins the donut.");
    // The investment slide's funding breakdown block: the raws and the rendered forms.
    const investment = deck.slides.find((s) => s.name === "investment");
    expect(investment?.funding).toBeDefined();
    expect(investment?.funding?.grossRaw).toBe(449000000);
    expect(investment?.funding?.grantsRaw).toBe(173500000);
    expect(investment?.funding?.netRaw).toBe(275500000);
    expect(investment?.funding?.intensity).toBe("38,6%");
    expect(investment?.funding?.rows.map((r) => r.value)).toEqual(["€70 000 000", "€100 000 000", "€3 500 000", "€10 000 000"]);
    expect(investment?.funding?.rows.map((r) => r.term ?? null)).toEqual([null, null, null, 10]);
    // The scenarios slide (v0.6.11 re-anchor, Task F): the optimistic variant refuses under
    // its own terms and carries its one-line disclosure; the pessimistic delta renders against
    // the base (the rawValue pin); the optimistic delta item is absent; the term chart keeps
    // its kicker; the target chart carries the pinned solved payments.
    const scenariosSlide = deck.slides.find((s) => s.name === "scenarios");
    expect(scenariosSlide?.disclosures).toContain("The optimistic scenario could not be computed for this project; see the Scenarios tab.");
    const pesDelta = scenariosSlide?.body.find((f) => f.label === "Named-set delta, pessimistic vs base");
    expect(pesDelta?.rawValue).toBe(865489.9467288586); // 3708855.5523114554 - 2843365.6055825967
    expect(scenariosSlide?.body.find((f) => f.label === "Named-set delta, optimistic vs base")).toBeUndefined();
    expect(scenariosSlide?.disclosures).toContain("Some term values were refused by the engine; the refused cells render inline on the Scenarios tab.");
    expect(scenariosSlide?.chart?.kicker).toBe("Longer terms lower the payment");
    expect(scenariosSlide?.targetChart?.mode).toBe("solved");
    expect(scenariosSlide?.targetChart?.kicker).toBe("The payment rises as the target IRR rises");
    expect(scenariosSlide?.targetChart?.points.map((p) => p.value)).toEqual([2489496.3612990044, 2843365.6055825967, 3233058.949475011]);
    scenariosSlide?.targetChart?.points.forEach((p) => expect(p.met).toBe(true));
    // The provenance disclosure carries the funding grounding verbatim.
    expect((deck.provenance ?? []).join(" ")).toContain(
      "Funding grounding: the grants (AFIF grant (EU); National shore-power grant; Province & municipality grant) ground in the national and municipal shore-power schemes and AFIF; the debt facility is grounded by the financing overlay; the interest-free note (Municipality interest-free note) nets to zero over the horizon.",
    );
    // Rendered deck at entry unit "ones", set through the existing unit select.
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    setEntryUnit("ones");
    fireEvent.click(byAction("present"));
    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid="presentation"] .deck-slide').length).toBe(9);
    });
    expect(titleMetricValue("Project cost")).toBe("€628 250 000");
    expect(titleMetricValue("Target IRR")).toBe("6.00%");
    expect(titleMetricValue("Investment term")).toBe("23 years");
    expect(tileValue("Cost NPV")).toBe("€479 231 370");
    expect(tileValue("Achieved IRR")).toBe("6.05%");
    expect(tileValue("Payback")).toBe("13.9 years");
    expect(tileValue("Solved payment")).toBe("€2 843 366");
    expect(tileValue("Collected vs cost")).toBe("€855 907 745 vs €628 250 000");
    expect(tileValue("Verdict")).toBe("Target met");
    expect(bodyFigureValue("investment", "Total cost (nominal)")).toBe("€628 250 000");
    expect(bodyFigureValue("investment", "Cost NPV at target (discounted)")).toBe("€479 231 370");
    expect(bodyFigureValue("investment", "Operating lines total")).toBe("€179 250 000");
    // The funding breakdown block renders beneath the waterfall.
    const fundingBlock = document.querySelector('[data-testid="deck-funding-block"]');
    expect(fundingBlock).toBeTruthy();
    expect(fundingBlock?.querySelector('[data-stat="funding-gross"]')?.textContent).toBe("Gross capital program: €449 000 000");
    expect(fundingBlock?.querySelector('[data-stat="funding-grants"]')?.textContent).toBe("Grants: -€173 500 000");
    expect(fundingBlock?.querySelector('[data-stat="funding-net"]')?.textContent).toBe("Net private capital: €275 500 000");
    expect(fundingBlock?.querySelector('[data-stat="funding-intensity"]')?.textContent).toBe("Grant intensity: 38,6%");
    const fundingRows = Array.from(fundingBlock?.querySelectorAll('[data-testid="deck-funding-rows"] li') ?? []);
    expect(fundingRows.map((li) => li.textContent)).toEqual([
      "AFIF grant (EU) (grant, year 3): €70 000 000",
      "National shore-power grant (grant, year 5): €100 000 000",
      "Province & municipality grant (grant, year 1): €3 500 000",
      "Municipality interest-free note (interest-free note, year 1, term 10 years): €10 000 000",
    ]);
    // The recovery slide: the declared-vocabulary title (v0.6.12 Task C re-anchor, Round 46
    // Supplement 12) with the unit-price exemption and the segment rates.
    const recovery = document.querySelector('[data-slide-name="recovery"] h2');
    expect(recovery?.textContent).toBe("The recovery — " + inputs.tariff?.priceUnitLabel + " prices");
    expect(bodyFigureValue("recovery", "Payments")).toBe("240");
    expect(bodyFigureValue("recovery", "Payment per period")).toBe("€2 843 366");
    expect(bodyFigureValue("recovery", "Total collected (nominal)")).toBe("€855 907 745");
    expect(bodyFigureValue("recovery", "Unit price 2028")).toBe("€7 108,41");
    expect(bodyFigureValue("recovery", "Segment rate — Deep-sea container berths (full ramp)")).toBe("5,83 €ct/kWh");
    expect(bodyFigureValue("recovery", "Segment rate — Cruise terminal berths (full ramp)")).toBe("4,37 €ct/kWh");
    expect(bodyFigureValue("recovery", "Segment rate — Bulk & liquid market berths (full ramp)")).toBe("2,92 €ct/kWh");
    expect(bodyFigureValue("recovery", "Segment rate — Inland & public berths (full ramp)")).toBe("1,46 €ct/kWh");
    // v0.6.10 Task F: the program fixture carries both basis notes, disclosed verbatim on the
    // recovery slide (the land fixture is the null-tolerance demo and gains none).
    const recoverySlideEl = document.querySelector('[data-slide-name="recovery"]') as HTMLElement;
    expect(recoverySlideEl.textContent).toContain("Tariff basis: Per-kWh infrastructure surcharge recovering the net private program cost after grants; each segment carries its own operating span.");
    expect(recoverySlideEl.textContent).toContain("Repayment basis: Monthly collections solved so the program earns the 6 percent target on the grant-netted private basis; sums vary by funding avenue.");
    // The coverage slide: the calendar break-even under the 2026 start year.
    expect(bodyFigureValue("coverage", "Break-even year")).toBe("2039");
    expect(bodyFigureValue("coverage", "Nominal payback")).toBe("13.9 years");
    expect(bodyFigureValue("coverage", "Discounted payback (at WACC)")).toBe("18.2 years");
    // The deal slide: the equity verdict on the financing overlay (the equity IRR derived).
    expect(document.querySelector('[data-slide-name="deal"] [data-testid="deck-verdict"]')?.textContent).toBe(
      "Target met — equity IRR 7.14% on €359 000 400 outlaid."
    );
    // The donuts: six outflow labels, the fees-and-grants inflow pair with the loan disclosure.
    const outflowDonut = document.querySelector('[data-donut="outflows"]');
    expect(outflowDonut).toBeTruthy();
    expect(outflowDonut?.querySelectorAll('[data-testid="donut-label"]').length).toBe(6);
    expect(outflowDonut?.textContent).toContain("The outflow donut shows the capital program; operating lines and reinvestments are part of the total cost and are shown separately.");
    const inflowDonut = document.querySelector('[data-donut="inflows"]');
    expect(inflowDonut).toBeTruthy();
    expect(inflowDonut?.querySelectorAll('[data-testid="donut-label"]').length).toBe(2);
    expect(inflowDonut?.textContent).toContain("Fees");
    expect(inflowDonut?.textContent).toContain("Grants");
    expect(inflowDonut?.textContent).toContain("the interest-free loan nets to zero over the horizon and never joins the donut.");
    // The target chart rows render the pinned solved payments at the ones unit.
    const targetChart = document.querySelector('[data-slide-name="scenarios"] [data-testid="scenario-target-chart"]');
    expect(targetChart).toBeTruthy();
    expect(targetChart?.getAttribute("data-mode")).toBe("solved");
    expect(targetChart?.querySelector('[data-testid="chart-kicker"]')?.textContent).toBe("The payment rises as the target IRR rises");
    expect(targetChart?.querySelector('[data-target-label="4%"] .row-value')?.textContent).toBe("€2 489 496");
    expect(targetChart?.querySelector('[data-target-label="6%"] .row-value')?.textContent).toBe("€2 843 366");
    expect(targetChart?.querySelector('[data-target-label="8%"] .row-value')?.textContent).toBe("€3 233 059");
  });
});

describe("v0.6.7 Task D: the realistic demo rotation — the land fixture (Mjøstårnet land newbuild)", () => {
  it("LAND-ENGINE: computeModel(landNewbuildProject()) returns the pinned scalars", () => {
    const r = computeModel(landNewbuildProject());
    expect(r.totalCost).toBe(599071344.7435848);
    expect(r.costNpv).toBe(456581761.2443387);
    expect(r.paymentAmount).toBe(2392623.66811084);
    expect(r.paymentCount).toBe(360);
    expect(r.totalCollected).toBe(1132569456.9457316);
    expect(r.paybackYears).toBe(10.995022730476373);
    // The directive prints 0.08; the engine's exact double is asserted (disclosed in the report).
    expect(r.achievedIrr).toBe(0.07999999999999963);
    expect(r.goalMet).toBe(true);
    expect(r.signChanges).toBe(1);
    expect(r.irrAmbiguous).toBe(false);
    expect(r.headlineSource).toBe("monthly");
    expect(r.npvAtWacc).toBe(124487464.96126679);
    expect(r.mirr).toBe(0.05696894496116012);
    expect(r.profitabilityIndex).toBe(1.2511982726552373);
    expect(r.discountedPaybackYears).toBe(16.092689255975813);
    expect(r.netGain).toBe(533498112.2021469);
    expect(r.operatingTotal).toBe(179071344.74358475);
    expect(r.residualAmountUsed).toBe(161363636.36363652);
    expect(r.horizon).toBeDefined();
    expect(r.horizon?.totalMonths).toBe(276);
    expect(r.horizon?.totalYears).toBe(23);
    expect(r.firstPaymentMonth).toBe(36);
    expect(r.lastPaymentMonth).toBe(275);
    expect(r.lineTotals.map((l) => l.total)).toEqual([45000000, 320000000, 55000000]);
    const o1 = r.operatingLines.find((o) => o.id === "o1");
    const o2 = r.operatingLines.find((o) => o.id === "o2");
    expect(o1).toBeDefined();
    expect(o2).toBeDefined();
    // The directive prints 105213164.0951 / 73858180.6485; the engine scalars carry more digits.
    expect(o1?.total).toBeCloseTo(105213164.0951, 4);
    expect(o1?.nominalSpan).toEqual([25, 264]);
    expect(o1?.effectiveWindow).toEqual([36, 264]);
    expect(o2?.total).toBeCloseTo(73858180.6485, 4);
    expect(o2?.nominalSpan).toEqual([25, 264]);
    expect(o2?.effectiveWindow).toEqual([36, 264]);
  });

  it("LAND-BOOK: the retained site, the charged construction and fit-out, and the book-value exit at year 23", () => {
    const r = computeModel(landNewbuildProject());
    const book = r.bookView;
    expect(book).toBeDefined();
    expect((book as NonNullable<ModelResult["bookView"]>).totalCharge).toBe(258636363.63636357);
    const lines = (book as NonNullable<ModelResult["bookView"]>).lines;
    const c1 = lines.find((l) => l.id === "c1");
    const c2 = lines.find((l) => l.id === "c2");
    const c3 = lines.find((l) => l.id === "c3");
    expect(c1?.isRetained).toBe(true);
    c1?.years.forEach((row) => expect(row.charge).toBe(0));
    expect(c1?.years[c1.years.length - 1].ending).toBe(45000000);
    for (let y = 3; y <= 23; y++) {
      expect(c2?.years.find((row) => row.year === y)?.charge).toBe(9696969.696969697);
    }
    // c3 depreciates over 20 years from year 3: charged 2 750 000 in years 3 through 22,
    // zero in year 23, ending exactly 0 at the close.
    for (let y = 3; y <= 22; y++) {
      expect(c3?.years.find((row) => row.year === y)?.charge).toBe(2750000);
    }
    expect(c3?.years.find((row) => row.year === 23)?.charge).toBe(0);
    // The directive prints 116363636.363637 for the c2 remaining at year 23 (rounded spelling).
    expect(c2?.years.find((row) => row.year === 23)?.ending).toBeCloseTo(116363636.363637, 5);
    expect(c3?.years[c3.years.length - 1].ending).toBe(0);
    expect((book as NonNullable<ModelResult["bookView"]>).remainingBookValueAtResidualYear).toBe(161363636.36363652);
    expect((book as NonNullable<ModelResult["bookView"]>).gainOrLossOnSale).toBe(0);
    expect(r.residualDisclosure).toBe("Assumes sale at remaining book value at year 23 for 161363636.36363652");
  });

  it("LAND-CONTRACTS: k1 runs 240 payments to month 276 and k2 120 payments to month 156", () => {
    const r = computeModel(landNewbuildProject());
    const k1 = r.contractsInfo?.find((c) => c.id === "k1");
    const k2 = r.contractsInfo?.find((c) => c.id === "k2");
    expect(k1?.paymentCount).toBe(240);
    expect(k1?.endMonth).toBe(276);
    expect(k2?.paymentCount).toBe(120);
    expect(k2?.endMonth).toBe(156);
  });

  it("LAND-GRID: the contract rows and the residual row sum to the collected total within 1e-6", () => {
    const r = computeModel(landNewbuildProject());
    expect(gridRowSum(r, "k1", "contract")).toBe(663914798.4595231);
    expect(gridRowSum(r, "k2", "contract")).toBe(307291022.122572);
    expect(gridRowSum(r, "residual", "residual")).toBe(161363636.36363652);
    const all = gridRowSum(r, "k1", "contract") + gridRowSum(r, "k2", "contract") + gridRowSum(r, "residual", "residual");
    expect(Math.abs(all - r.totalCollected)).toBeLessThan(1e-6);
  });

  it("LAND-TERMPOSITIONS: the two term positions carry the pinned truncated views", () => {
    const r = computeModel(landNewbuildProject());
    const t1 = r.termPositions?.find((t) => t.contractId === "k1");
    const t2 = r.termPositions?.find((t) => t.contractId === "k2");
    expect(t1?.label).toBe("Hotel lease (Wood Hotel)");
    expect(t1?.endMonth).toBe(276);
    expect(t1?.truncatedIrr).toBe(0.07999999999999963);
    expect(t1?.cumulativeNet).toBe(533498112.20214653);
    expect(t1?.npvAtWacc).toBe(124487464.96126679);
    expect(t1?.paybackSoFar).toBe(11);
    expect(t2?.label).toBe("Office & restaurant leases");
    expect(t2?.endMonth).toBe(156);
    expect(t2?.truncatedIrr).toBe(0.03464720297898438);
    expect(t2?.cumulativeNet).toBe(109448974.30258363);
    expect(t2?.npvAtWacc).toBe(-36797038.28508617);
    expect(t2?.paybackSoFar).toBe(11);
  });

  it("LAND-SCENARIO: the target axis is live; the term axis is inert in contracts mode (finding F1, pinned honestly)", () => {
    const base = landNewbuildProject();
    const atTarget = (t: number) => solvedPayment({ ...base, targetIrr: t });
    expect(atTarget(6)).toBe(2038046.5001234217);
    expect(atTarget(8)).toBe(2392623.66811084);
    expect(atTarget(10)).toBe(2767086.3813511045);
    // In contracts mode the repayment term does not drive the solved contract payments:
    // 15, 20, and 25 years all yield the base payment — the documented inert behavior (F1).
    const atTerm = (y: number) => solvedPayment({ ...base, repayment: { ...base.repayment, termYears: y } });
    expect(atTerm(15)).toBe(2392623.66811084);
    expect(atTerm(20)).toBe(2392623.66811084);
    expect(atTerm(25)).toBe(2392623.66811084);
  });

  it("LAND-LOADER: the button relabeled, the data-action unchanged, the target axis preset, and the term and balloon axes untouched", async () => {
    render(<App />);
    const button = byAction("load-multi-lease-demo");
    expect(button).toBeTruthy();
    expect(button.textContent).toBe("Load land newbuild demo (Mjøstårnet)");
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText("Mjøstårnet example")).toBeTruthy();
    });
    fireEvent.click(byNav("scenarios"));
    expect(scenarioAxisValues("target")).toEqual(["6", "8", "10"]);
    // The loader leaves the term and balloon axes untouched (inert in contracts mode, finding F1).
    expect(scenarioAxisValues("term")).toEqual([]);
    expect(scenarioAxisValues("balloon")).toEqual([]);
  });

  it("LAND-DECK: the rendered deck at entry unit thousands carries the pinned figures and donuts", async () => {
    const inputs = landNewbuildProject();
    const result = computeModel(inputs);
    const deck = deckSlides(inputs, result, {
      startYear: null,
      entryUnit: "thousands",
      scenarioTargets: [6, 8, 10],
      scenarioTerms: null,
      scenarioBalloons: null,
    });
    const summary = deck.slides.find((s) => s.name === "summary");
    expect(summary).toBeDefined();
    const outflows = summary?.donuts?.find((d) => d.id === "outflows");
    const inflows = summary?.donuts?.find((d) => d.id === "inflows");
    expect(outflows?.segments.map((s) => s.value)).toEqual([45000000, 320000000, 55000000]);
    // v0.6.8 Task A.4 re-anchor: the repaired disclosure (the arithmetic-honest wording).
    expect(outflows?.disclosure).toBe("The outflow donut shows the capital program; operating lines and reinvestments are part of the total cost and are shown separately.");
    expect(inflows?.segments.map((s) => s.value)).toEqual([663914798.4595231, 307291022.122572, 161363636.36363652]);
    expect(sum(inflows?.segments.map((s) => s.value) ?? [])).toBeCloseTo(result.totalCollected, 6);
    const scenariosSlide = deck.slides.find((s) => s.name === "scenarios");
    expect(scenariosSlide?.targetChart?.mode).toBe("solved");
    // v0.6.8 Task G.3 re-anchor: the target chart kicker names the rate basis.
    expect(scenariosSlide?.targetChart?.kicker).toBe("The payment rises as the target IRR rises");
    // v0.6.8 Task G.2 re-anchor: with only the target axis set, the chart is the named-set
    // fallback, and its kicker names the parameter it carries.
    expect(scenariosSlide?.chart?.kicker).toBe("The named scenarios set the payment range");
    expect(scenariosSlide?.targetChart?.points.map((p) => p.value)).toEqual([2038046.5001234217, 2392623.66811084, 2767086.3813511045]);
    scenariosSlide?.targetChart?.points.forEach((p) => expect(p.met).toBe(true));
    // Rendered deck at entry unit "thousands", set through the existing unit select.
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    setEntryUnit("thousands");
    fireEvent.click(byAction("present"));
    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid="presentation"] .deck-slide').length).toBe(9);
    });
    expect(titleMetricValue("Project cost")).toBe("NOK 599 071 k");
    expect(titleMetricValue("Target IRR")).toBe("8.00%");
    expect(titleMetricValue("Investment term")).toBe("23 years");
    expect(tileValue("Cost NPV")).toBe("NOK 456 582 k");
    expect(tileValue("Achieved IRR")).toBe("8.00%");
    expect(tileValue("Payback")).toBe("11.0 years");
    // v0.6.8 Task B re-anchor: the fee-class figures render at the ones unit (the fee closure).
    expect(tileValue("Solved payment")).toBe("NOK 2 393 k");
    expect(tileValue("Collected vs cost")).toBe("NOK 1 132 569 k vs NOK 599 071 k");
    expect(tileValue("Verdict")).toBe("Target met");
    expect(bodyFigureValue("investment", "Total cost (nominal)")).toBe("NOK 599 071 k");
    expect(bodyFigureValue("investment", "Cost NPV at target (discounted)")).toBe("NOK 456 582 k");
    expect(bodyFigureValue("investment", "Operating lines total")).toBe("NOK 179 071 k");
    const recovery = document.querySelector('[data-slide-name="recovery"] h2');
    expect(recovery?.textContent).toBe("The recovery — solved payments");
    expect(bodyFigureValue("recovery", "Payments")).toBe("360");
    expect(bodyFigureValue("recovery", "Payment per period")).toBe("NOK 2 393 k");
    expect(bodyFigureValue("recovery", "Total collected (nominal)")).toBe("NOK 1 132 569 k");
    // v0.6.8 Task E.5 pin: the land fixture carries neither basis note — the recovery slide
    // gains no note disclosures (the null-tolerance demo).
    const landRecoverySlide = document.querySelector('[data-slide-name="recovery"]') as HTMLElement;
    expect(landRecoverySlide.textContent).not.toContain("Tariff basis:");
    expect(landRecoverySlide.textContent).not.toContain("Repayment basis:");
    expect(bodyFigureValue("coverage", "Break-even year")).toBe("Year 11");
    expect(bodyFigureValue("coverage", "Nominal payback")).toBe("11.0 years");
    expect(bodyFigureValue("coverage", "Discounted payback (at WACC)")).toBe("16.1 years");
    expect(document.querySelector('[data-slide-name="deal"] [data-testid="deck-verdict"]')?.textContent).toBe(
      "Target met — net gain NOK 533 498 k."
    );
    const outflowDonut = document.querySelector('[data-donut="outflows"]');
    expect(outflowDonut).toBeTruthy();
    expect(outflowDonut?.querySelectorAll('[data-testid="donut-label"]').length).toBe(3);
    // v0.6.8 Task A: the pinned donut disclosure wording.
    expect(outflowDonut?.textContent).toContain("The outflow donut shows the capital program; operating lines and reinvestments are part of the total cost and are shown separately.");
    const inflowDonut = document.querySelector('[data-donut="inflows"]');
    expect(inflowDonut).toBeTruthy();
    expect(inflowDonut?.querySelectorAll('[data-testid="donut-label"]').length).toBe(3);
    expect(inflowDonut?.textContent).toContain("Hotel lease (Wood Hotel)");
    expect(inflowDonut?.textContent).toContain("Office & restaurant leases");
    expect(inflowDonut?.textContent).toContain("Residual");
    const targetChart = document.querySelector('[data-slide-name="scenarios"] [data-testid="scenario-target-chart"]');
    expect(targetChart).toBeTruthy();
    expect(targetChart?.getAttribute("data-mode")).toBe("solved");
    expect(targetChart?.querySelector('[data-testid="chart-kicker"]')?.textContent).toBe("The payment rises as the target IRR rises");
    expect(targetChart?.querySelector('[data-target-label="6%"] .row-value')?.textContent).toBe("NOK 2 038 k");
    expect(targetChart?.querySelector('[data-target-label="8%"] .row-value')?.textContent).toBe("NOK 2 393 k");
    expect(targetChart?.querySelector('[data-target-label="10%"] .row-value')?.textContent).toBe("NOK 2 767 k");
  });
});
