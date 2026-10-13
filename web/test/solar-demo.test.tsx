import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { solarParkProject } from "../src/state.js";
import { computeModel, entryToValue } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import type { ModelInputs } from "../../core/src/types.js";

// v0.6.6 Task C: the third demo project — a Swedish solar park on a twenty-year PPA.
// Every figure below is a directive reproduction pin (halt on non-reproduction).

const byAction = (v: string) => {
  const els = Array.from(document.querySelectorAll('[data-action="' + v + '"]'));
  if (els.length === 0) throw new Error("no element with data-action=" + v);
  return els[0] as HTMLElement;
};
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const axisValues = (field: string) =>
  Array.from(document.querySelectorAll('[data-field="' + field + '"]')).map((el) => (el as HTMLInputElement).value);

describe("v0.6.6: the solar park demo", () => {
  it("SOLAR-ENGINE: the fixture of record reproduces every engine pin exactly", () => {
    const m = solarParkProject();
    const r = computeModel(m);
    expect(r.totalCost).toBe(18733048.32214572);
    expect(r.costNpv).toBe(12492603.29776891);
    expect(r.paymentAmount).toBe(124150.30495915706);
    expect(r.paymentCount).toBe(240);
    expect(r.paybackYears).toBe(13.938296100998945);
    expect(r.achievedIrr).toBe(0.06999999999999718);
    expect(r.goalMet).toBe(true);
    expect(r.signChanges).toBe(1);
    expect(r.irrAmbiguous).toBe(false);
    expect(r.headlineSource).toBe("monthly");
    expect(r.totalCollected).toBe(29796073.190197587);
    expect(r.npvAtWacc).toBe(1902023.5841815644);
    expect(r.horizon!.totalMonths).toBe(288);
    expect(r.horizon!.totalYears).toBe(24);
    expect(r.firstPaymentMonth).toBe(48);
    expect(r.lastPaymentMonth).toBe(287);
    expect(r.operatingTotal).toBe(7233048.322145719);
    expect(r.lineTotals.map((l) => l.total)).toEqual([600000, 1600000, 8000000, 1300000]);
    expect(r.residualAmountUsed ?? 0).toBe(0);
    expect(r.residualDisclosure ?? null).toBeNull();
  });

  it("SOLAR-BOOK: twenty straight-line charges of 575000 from year 5, ending at exactly zero in year 24", () => {
    const r = computeModel(solarParkProject());
    const bv = r.bookView!;
    const y5 = bv.combined.find((row) => row.year === 5);
    expect(y5?.beginning).toBe(11500000);
    expect(y5?.charge).toBe(575000);
    expect(y5?.ending).toBe(10925000);
    const chargeYears = bv.combined.filter((row) => row.charge > 0).map((row) => row.year);
    expect(chargeYears).toHaveLength(20);
    expect(chargeYears[0]).toBe(5);
    expect(chargeYears[chargeYears.length - 1]).toBe(24);
    expect(bv.combined.find((row) => row.year === 24)?.ending).toBe(0);
    expect(bv.totalCharge).toBe(11500000);
  });

  it("SOLAR-SCENARIO: the preset axes reproduce the solved payments (one source: the computeModel seam the Scenarios tab uses)", () => {
    const m = solarParkProject();
    const at = (patch: Partial<ModelInputs>) => computeModel({ ...m, ...patch }).paymentAmount;
    // the target axis, at the project's own twenty-year term
    expect(at({ targetIrr: 5 })).toBe(109095.45410129367);
    expect(at({ targetIrr: 7 })).toBe(124150.30495915706);
    expect(at({ targetIrr: 9 })).toBe(140617.60988926986);
    // the term axis, at the project's own seven percent target
    expect(at({ repayment: { ...m.repayment, termYears: 15 } })).toBe(139104.47565592927);
    expect(at({ repayment: { ...m.repayment, termYears: 25 } })).toBe(112921.46435965675);
    // the balloon axis — entry-unit values per the amendment of record: at unit thousands the entries
    // 1000 and 2000 scale to raw balloons of 1000000 and 2000000 at compute
    expect(entryToValue(1000, "thousands")).toBe(1000000);
    expect(entryToValue(2000, "thousands")).toBe(2000000);
    expect(at({ repayment: { ...m.repayment, balloon: entryToValue(1000, "thousands") } })).toBe(122191.08057614304);
    expect(at({ repayment: { ...m.repayment, balloon: entryToValue(2000, "thousands") } })).toBe(120231.85619312902);
  });

  it("SOLAR-LOADER: the third demo button loads the solar park and presets the three scenario axes in the Scenarios tab inputs", () => {
    render(<App />);
    expect(byAction("load-solar-demo").textContent).toBe("Load solar park demo");
    fireEvent.click(byAction("load-solar-demo"));
    expect(screen.getByText("Solar park example")).toBeTruthy();
    fireEvent.click(byNav("scenarios"));
    expect(axisValues("scenario-target")).toEqual(["5", "7", "9"]);
    expect(axisValues("scenario-term")).toEqual(["15", "20", "25"]);
    expect(axisValues("scenario-balloon")).toEqual(["0", "1000", "2000"]);
  });

  it("SOLAR-DECK: the deck renders the preset target chart, the honest donuts, the deal verdict, and the coverage break-even", () => {
    const m = solarParkProject();
    const r = computeModel(m);
    const deck = deckSlides(m, r, { startYear: null, entryUnit: "thousands", scenarioTargets: [5, 7, 9], scenarioTerms: [15, 20, 25], scenarioBalloons: [0, 1000, 2000] });
    const sce = deck.slides.find((s) => s.name === "scenarios");
    expect(sce?.targetChart).toBeDefined();
    expect(sce?.targetChart?.mode).toBe("solved");
    expect(sce?.targetChart?.points.map((p) => p.value)).toEqual([109095.45410129367, 124150.30495915706, 140617.60988926986]);
    // v0.6.8 Task G: the solved-mode target kicker names the target IRR.
    expect(sce?.targetChart?.kicker).toBe("The payment rises as the target IRR rises");
    const summary = deck.slides.find((s) => s.name === "summary");
    const outflows = summary?.donuts?.find((d) => d.id === "outflows");
    expect(outflows?.segments).toHaveLength(4);
    expect(outflows?.segments.reduce((a, s) => a + s.value, 0)).toBe(11500000);
    // v0.6.8 Task A: the donut disclosure states the capital-program scope honestly.
    expect(outflows?.disclosure).toBe("The outflow donut shows the capital program; operating lines and reinvestments are part of the total cost and are shown separately.");
    const inflows = summary?.donuts?.find((d) => d.id === "inflows");
    expect(inflows?.segments).toHaveLength(1);
    expect(inflows?.segments[0].value).toBeCloseTo(29796073.19, 2);
    const deal = deck.slides.find((s) => s.verdict !== undefined);
    expect(deal?.verdict).toBe("Target met — net gain 11 063 tkr.");
    const coverage = deck.slides.find((s) => s.name === "coverage");
    const be = coverage?.body.find((f) => f.label === "Break-even year");
    expect(`${be?.label}: ${be?.value}`).toBe("Break-even year: Year 14");
  });
});
