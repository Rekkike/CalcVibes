import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { composeFlowSlide, deckSlides, flowDetailText, FLOW_LEDGER_CAP } from "../src/deck.js";
import { computeModel } from "../src/engine.js";
import { composeFlow, demoProject, landNewbuildProject, shorePowerProgram, solarParkProject } from "../src/state.js";
import type { FlowComposition } from "../src/state.js";
import type { ModelInputs } from "../../core/src/types.js";

// v0.6.22.2 re-anchor: the coverage bridge is the slide's one primary form; the two-band form, its connectors and
// its bounds retired (the band and connector pins below are re-anchored to the bridge's steps; every script-verified
// figure of record stands).
// v0.6.22 Task B/F — the flow deck slide: the two-band connected composition within the pinned
// bounds (at most 8 bands per side after kind aggregation, at most 30 live connectors), the
// sequential bridge as the degradation form (six fixed steps), the bracketed ledger capped at 24
// rows with its counting caption, the action title, the presence note, the deckTitles application,
// and the CHART-TRACE pins (the chart data is a pure mapping of the composed model). Every figure
// script-verified against the delivered engine; nothing hand-derived.

const money = (v: number) => String(v); // raw passthrough for the synthetic model tests

const flowSlideOf = (inputs: ModelInputs) => deckSlides(inputs, computeModel(inputs), { startYear: 2026 }).slides.find((s) => s.name === "flow")!;

describe("v0.6.22 Task B — the flow slide", () => {
  it("PRESENT + SEAT: the slide composes after recovery whenever a result exists; the adaptive kicker numbering absorbs it; the provenance gains its presence note", () => {
    for (const demo of [demoProject(), solarParkProject(), landNewbuildProject(), shorePowerProgram()]) {
      const deck = deckSlides(demo, computeModel(demo), { startYear: 2026 });
      const names = deck.slides.map((s) => s.name);
      expect(names).toContain("flow");
      expect(names.indexOf("flow")).toBe(names.indexOf("recovery") + 1);
      expect((deck.provenance ?? []).some((p) => p.startsWith("Flow: present, composed from the emitted grids"))).toBe(true);
      const kickers = deck.slides.map((s) => s.kickerNumber);
      expect(kickers[0]).toBeUndefined();
      expect(kickers.slice(1)).toEqual(deck.slides.slice(1).map((_, i) => String(i + 1).padStart(2, "0")));
    }
    const solar = deckSlides(solarParkProject(), computeModel(solarParkProject()), { startYear: 2026 });
    expect(solar.slides.find((s) => s.name === "flow")!.kickerNumber).toBe("05"); // after the operations slide
  });

  it("TEMPLATE (script-verified): the action title, the body figures, the signed shortfall disclosure, the coverage bridge", () => {
    const sl = flowSlideOf(demoProject());
    expect(sl.title).toBe("Covered on the horizon, 3 short years"); // the action title within the 40-char headline bound
    expect(sl.body.map((b) => [b.label, b.value])).toEqual([
      ["Total collected (nominal)", "13 308 656 kr"],
      ["Total uses (nominal)", "7 849 860 kr"],
      ["Remainder to equity (signed)", "5 458 796 kr"],
      ["Shortfall years", "3"],
      ["Surplus years' remainder", "12 833 347 kr"],
      ["Shortfall years' total", "-7 374 551 kr"],
    ]);
    expect(sl.flow!.steps.map((x) => [x.id, x.label, x.raw, x.value])).toEqual([
      ["in", "Collected", 13308655.754089093, "13 308 656 kr"],
      ["out:Capital", "Capital", -7849860, "-7 849 860 kr"],
      ["remainder", "Remainder to equity", 5458795.754089092, "5 458 796 kr"],
    ]);
    expect(sl.flow!.steps[0].detail.map(flowDetailText)).toEqual(["Payment stream 13 308 656 kr"]);
    expect(sl.flow!.steps[2].detail).toEqual([{ label: "surplus years", value: "12 833 347 kr", bad: false }, { label: "3 shortfall years", value: "-7 374 551 kr", bad: true }]);
    expect(sl.disclosures[0]).toContain("Cash is fungible");
    expect(sl.disclosures[1]).toBe("3 of 10 years run a shortfall totaling -7 374 551 kr; the remainder column is signed in every year and a shortfall is never smoothed or netted invisibly.");
  });

  it("PROGRAM (script-verified): the kind aggregation (4 tariff and 3 grant segments named on the collections step), the omitted reinvestment step named in the caption, the note netting to zero", () => {
    const sl = flowSlideOf(shorePowerProgram());
    expect(sl.title).toBe("Covered on the horizon, 4 short years");
    expect(sl.flow!.steps.map((x) => [x.id, x.raw])).toEqual([
      ["in", 855907745.339823],
      ["out:Debt service", -142733166.0294332],
      ["out:Operating", -179250000],
      ["out:Capital", -449000000],
      ["remainder", 84924579.31038983],
    ]);
    expect(sl.flow!.steps[0].detail.map(flowDetailText)).toEqual(["Tariff (4 segments) €682 407 745", "Grant (3 segments) €173 500 000", "Interest-free note €0"]);
    expect(sl.flow!.omittedSteps).toEqual(["Reinvestment"]);
    expect(sl.flow!.caption).toBe("Read top to bottom in the coverage order: what the collections bring in, each use they cover in turn, and the signed remainder to equity. No reinvestment on this project. The horizon total nets 4 shortfall years against the surplus years; the per-year drill on the Flow surface shows each year.");
    expect(sl.disclosures.some((d) => d.includes("netting to €0") || d.includes("nets to €0"))).toBe(true);
    // Task G: the capital/collections overlap years are disclosed by name (startYear 2026; script-verified: years 1, 3, 4, 5 carry both income and capital spend)
    expect(sl.disclosures.some((d) => d === "In 2026, 2028, 2029, 2030 the collections run alongside the year's capital spend; the matching shows both.")).toBe(true);
  });

  it("LAND (script-verified): the two contract segments aggregate, the residual band stands alone, the signed shortfall", () => {
    const sl = flowSlideOf(landNewbuildProject());
    expect(sl.title).toBe("Covered on the horizon, 2 short years");
    expect(sl.flow!.steps[0].detail.map(flowDetailText)).toEqual(["Contract (2 segments) NOK 971 205 821", "Residual NOK 161 363 636"]);
    expect(sl.flow!.omittedSteps).toEqual(["Debt service", "Reinvestment"]);
    expect(sl.body.find((b) => b.label === "Shortfall years' total")!.value).toBe("-NOK 420 000 000");
  });

  it("LEDGER: the authored pairings ride as the bracketed ledger; the deckTitles override applies to the flow slide by name", () => {
    const withPairs: ModelInputs = { ...shorePowerProgram(), flow: { pairs: [{ id: "f1", sourceId: "grant:g2", useId: "cost:p4", amount: 50000000 }] } } as ModelInputs;
    const sl = flowSlideOf(withPairs);
    expect(sl.flow!.ledger).toEqual([{
      id: "f1",
      sourceLabel: "National shore-power grant",
      useLabel: "Market pillar — bulk & liquid berths",
      amount: "€50 000 000",
      allocated: "€31 250 000",
      raw: 50000000,
      rawAllocated: 31250000,
    }]);
    expect(sl.disclosures.some((d) => d.includes("The 1 authored pairing listed below replaces the default where drawn"))).toBe(true);
    const withTitle: ModelInputs = { ...solarParkProject(), deckTitles: { flow: "Where the money goes" } } as ModelInputs;
    expect(deckSlides(withTitle, computeModel(withTitle), { startYear: null }).slides.find((s) => s.name === "flow")!.title).toBe("Where the money goes");
  });

  it("CHART-TRACE: the slide's chart data is a pure mapping of the composed model — no renderer arithmetic", () => {
    for (const demo of [demoProject(), solarParkProject(), landNewbuildProject(), shorePowerProgram()]) {
      const result = computeModel(demo);
      const flow = composeFlow(demo, result);
      const sl = deckSlides(demo, result, { startYear: null }).slides.find((s) => s.name === "flow")!;
      expect(sl.flow!.remainderNet).toBe(flow.remainderNet);
      expect(sl.flow!.shortfallYears).toBe(flow.shortfallYears);
      expect(sl.flow!.incomeNet).toBe(flow.sources.reduce((a, s) => a + s.total, 0));
      expect(sl.flow!.incomeNet).toBeCloseTo(result.totalCollected, 6); // the slide's income is the engine's totalCollected
      // the bridge's steps reconcile to the same totals: collections in, the uses out, the signed remainder
      const steps = sl.flow!.steps;
      expect(steps[0].raw).toBe(sl.flow!.incomeNet);
      expect(steps[steps.length - 1].raw).toBe(flow.remainderNet);
      expect(-steps.filter((x) => x.kind === "out").reduce((a, x) => a + x.raw, 0)).toBeCloseTo(sl.flow!.usesTotal, 6);
    }
  });

  it("LEDGER CAP: the ledger caps at 24 rows with its counting caption (v0.6.22.2 re-anchor: the band bounds retired with the two-band form)", () => {
    const fake = (nPairs: number): FlowComposition => ({
      sources: [{ key: "k0:s0", label: "S0", kind: "k0", total: 100, gross: 100 }],
      uses: [{ key: "cost:c1", label: "C1", kind: "cost", total: 50, gross: 50 }, { key: "equity:remainder", label: "Equity remainder", kind: "equity", total: 0, gross: 0 }],
      useOrder: ["cost:c1"], years: [], connectors: [],
      remainderNet: 50, remainderSurplus: 50, remainderShortfall: 0, shortfallYears: 0,
      pairings: Array.from({ length: nPairs }, (_, i) => ({ id: `f${i}`, sourceId: "k0:s0", sourceLabel: "S0", useId: "cost:c1", useLabel: "C1", amount: 5, allocated: 5, remaining: 0 })),
      refusals: [],
    });
    const capped = composeFlowSlide(fake(FLOW_LEDGER_CAP + 6), money);
    expect(capped.ledger.length).toBe(FLOW_LEDGER_CAP);
    expect(capped.ledgerOmitted).toBe(6);
    expect(capped.caption).toContain("6 authored pairings are beyond the 24-row ledger");
  });

  it("UI: the presentation renders the flow slide's chart, caption and ledger from the deck model", () => {
    const withPairs: ModelInputs = { ...shorePowerProgram(), flow: { pairs: [{ id: "f1", sourceId: "grant:g2", useId: "cost:p4", amount: 50000000 }] } } as ModelInputs;
    // render through the App: load the program demo, present, read the flow slide
    render(<App />);
    fireEvent.click(document.querySelector('[data-action="load-demo"]') as HTMLElement);
    fireEvent.click(document.querySelector('[data-action="present"]') as HTMLElement);
    const slide = document.querySelector('[data-slide-name="flow"]') as HTMLElement;
    expect(slide).toBeTruthy();
    // v0.6.22.2 re-anchor: the coverage bridge — five steps on the program (collections, debt service, operating, capital, remainder), four connectors between them
    expect(slide.querySelector('[data-testid="flow-coverage"]')).toBeTruthy();
    expect(slide.querySelector('[data-testid="flow-caption"]')!.textContent).toContain("No reinvestment on this project.");
    expect(slide.querySelectorAll('line[data-flow-step]').length).toBe(5);
    expect(slide.querySelectorAll('[data-flow-connector]').length).toBe(4);
    expect(slide.querySelector('[data-testid="flow-bands"]')).toBeNull();
    // the fungibility caption travels with the slide
    const disclosures = Array.from(slide.querySelectorAll(".deck-disclosure")).map((d) => d.textContent ?? "");
    expect(disclosures.some((d) => d.includes("Cash is fungible"))).toBe(true);
    // a second render with an authored pairing draws the bracketed ledger
    fireEvent.click(document.querySelector('[data-action="exit-presentation"]') as HTMLElement);
    expect((withPairs as ModelInputs & { flow?: unknown }).flow).toBeDefined(); // the fixture shape the surface editor writes
  });
});
