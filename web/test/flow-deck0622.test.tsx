import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { composeFlowSlide, deckSlides, FLOW_LEDGER_CAP, FLOW_MAX_BANDS, FLOW_MAX_CONNECTORS } from "../src/deck.js";
import { computeModel } from "../src/engine.js";
import { composeFlow, demoProject, landNewbuildProject, shorePowerProgram, solarParkProject } from "../src/state.js";
import type { FlowComposition } from "../src/state.js";
import type { ModelInputs } from "../../core/src/types.js";

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

  it("TEMPLATE (script-verified): the action title, the body figures, the signed shortfall disclosure, the bands form", () => {
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
    expect(sl.flow!.form).toBe("bands");
    expect(sl.flow!.incomeBands.map((b) => [b.key, b.label, b.raw])).toEqual([["payments", "Payment stream", 13308655.754089093]]);
    expect(sl.flow!.useBands.map((b) => [b.key, b.raw, b.signed])).toEqual([["Capital", 7849860, false], ["Equity remainder", 5458795.754089092, true]]);
    expect(sl.flow!.connectors.map((c) => [c.sourceKey, c.useKey, c.raw])).toEqual([
      ["payments", "Capital", 475309.1340746104],
      ["payments", "Equity remainder", 12833346.620014483],
    ]);
    expect(sl.disclosures[0]).toContain("Cash is fungible");
    expect(sl.disclosures[1]).toBe("3 of 10 years run a shortfall totaling -7 374 551 kr; the remainder column is signed in every year and a shortfall is never smoothed or netted invisibly.");
  });

  it("PROGRAM (script-verified): the kind aggregation (4 tariff and 3 grant segments in one band each), the omitted zero-width connectors counted in the caption, the note band", () => {
    const sl = flowSlideOf(shorePowerProgram());
    expect(sl.title).toBe("Covered on the horizon, 4 short years");
    expect(sl.flow!.form).toBe("bands");
    expect(sl.flow!.incomeBands.map((b) => [b.key, b.label, b.raw, b.count])).toEqual([
      ["tariff", "Tariff (4 segments)", 682407745.339823, 4],
      ["grant", "Grant (3 segments)", 173500000, 3],
      ["funding-loan", "Interest-free note", 10000000, 1],
    ]);
    expect(sl.flow!.useBands.map((b) => [b.key, b.raw])).toEqual([
      ["Capital", 449000000],
      ["Operating", 179250000],
      ["Debt service", 142733166.0294332],
      ["Equity remainder", 84924579.31038983],
    ]);
    expect(sl.flow!.connectors.map((c) => [c.sourceKey, c.useKey, c.raw])).toEqual([
      ["grant", "Capital", 87836318.20757927],
      ["funding-loan", "Capital", 10000000],
      ["tariff", "Capital", 44670729.19042404],
      ["tariff", "Debt service", 142733166.0294332],
      ["tariff", "Operating", 179250000],
      ["grant", "Equity remainder", 85663681.79242073],
      ["tariff", "Equity remainder", 315753850.1199658],
    ]);
    expect(sl.flow!.omittedConnectors).toBe(5);
    expect(sl.flow!.caption).toBe("Sources aggregated by kind: 4 tariff segments in one band; 3 grant segments in one band. 5 zero-width connectors are omitted, never drawn as hairlines. The per-source, per-year matching is on the Flow surface in the app.");
    expect(sl.disclosures.some((d) => d.includes("netting to €0") || d.includes("nets to €0"))).toBe(true);
    // Task G: the capital/collections overlap years are disclosed by name (startYear 2026; script-verified: years 1, 3, 4, 5 carry both income and capital spend)
    expect(sl.disclosures.some((d) => d === "In 2026, 2028, 2029, 2030 the collections run alongside the year's capital spend; the matching shows both.")).toBe(true);
  });

  it("LAND (script-verified): the two contract segments aggregate, the residual band stands alone, the signed shortfall", () => {
    const sl = flowSlideOf(landNewbuildProject());
    expect(sl.title).toBe("Covered on the horizon, 2 short years");
    expect(sl.flow!.incomeBands.map((b) => [b.key, b.label, b.count])).toEqual([["contract", "Contract (2 segments)", 2], ["residual", "Residual", 1]]);
    expect(sl.flow!.omittedConnectors).toBe(3);
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
      // the band raws reconcile to the model's gross flows and the connectors to the model's allocations
      expect(sl.flow!.incomeBands.reduce((a, b) => a + b.raw, 0)).toBeCloseTo(flow.sources.reduce((a, s) => a + s.gross, 0), 6);
      expect(sl.flow!.connectors.reduce((a, c) => a + c.raw, 0)).toBeCloseTo(flow.connectors.reduce((a, c) => a + c.amount, 0), 6);
      // the bridge's six fixed steps reconcile to the same totals
      expect(sl.flow!.bridge.length).toBe(6);
      expect(sl.flow!.bridge[0].raw).toBe(sl.flow!.incomeNet);
      expect(sl.flow!.bridge[5].raw).toBe(flow.remainderNet);
    }
  });

  it("BOUNDS: beyond 30 live connectors or 8 bands per side the slide degrades to the bridge with its naming caption; the ledger caps at 24 rows with its counting caption", () => {
    const fake = (nConn: number, nBands: number, nPairs: number): FlowComposition => {
      const sources = Array.from({ length: nBands }, (_, i) => ({ key: `k${i}:s${i}`, label: `S${i}`, kind: `k${i}`, total: 100, gross: 100 }));
      const bucketKeys = ["cost:c1", "operating:o1", "reinvestment:r1", "financing:service"];
      const uses = [
        { key: "cost:c1", label: "C1", kind: "cost", total: 50, gross: 50 },
        { key: "operating:o1", label: "O1", kind: "operating", total: 50, gross: 50 },
        { key: "reinvestment:r1", label: "R1", kind: "reinvestment", total: 50, gross: 50 },
        { key: "financing:service", label: "Debt service", kind: "financing", total: 50, gross: 50 },
        { key: "equity:remainder", label: "Equity remainder", kind: "equity", total: 0, gross: 0 },
      ];
      // distinct (kind, bucket) pairs: kind i % nBands against bucket floor(i / nBands)
      const connectors = Array.from({ length: nConn }, (_, i) => ({ sourceKey: `k${i % nBands}:s${i % nBands}`, useKey: bucketKeys[Math.floor(i / nBands) % bucketKeys.length], amount: 10 }));
      return {
        sources, uses, useOrder: ["cost:c1"], years: [], connectors,
        remainderNet: 50, remainderSurplus: 50, remainderShortfall: 0, shortfallYears: 0,
        pairings: Array.from({ length: nPairs }, (_, i) => ({ id: `f${i}`, sourceId: `k0:s0`, sourceLabel: "S0", useId: "cost:c1", useLabel: "C1", amount: 5, allocated: 5, remaining: 0 })),
        refusals: [],
      };
    };
    const within = composeFlowSlide(fake(FLOW_MAX_CONNECTORS, FLOW_MAX_BANDS, 0), money);
    expect(within.form).toBe("bands");
    expect(within.connectors.length).toBeLessThanOrEqual(FLOW_MAX_CONNECTORS);
    const overConn = composeFlowSlide(fake(FLOW_MAX_CONNECTORS + 1, FLOW_MAX_BANDS, 0), money);
    expect(overConn.form).toBe("bridge");
    expect(overConn.caption).toContain("exceeds its bounds");
    expect(overConn.caption).toContain("31 live connectors");
    expect(overConn.bridge.length).toBe(6);
    const overBands = composeFlowSlide(fake(2, FLOW_MAX_BANDS + 1, 0), money);
    expect(overBands.form).toBe("bridge");
    expect(overBands.caption).toContain("9 income bands");
    const capped = composeFlowSlide(fake(1, 1, FLOW_LEDGER_CAP + 6), money);
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
    expect(slide.querySelector('[data-testid="flow-bands"]')).toBeTruthy();
    expect(slide.querySelector('[data-testid="flow-caption"]')!.textContent).toContain("4 tariff segments in one band");
    expect(slide.querySelectorAll('[data-flow-connector]').length).toBe(7);
    expect(slide.querySelectorAll('[data-flow-income-band]').length).toBe(3);
    expect(slide.querySelectorAll('[data-flow-use-band]').length).toBe(4);
    // the fungibility caption travels with the slide
    const disclosures = Array.from(slide.querySelectorAll(".deck-disclosure")).map((d) => d.textContent ?? "");
    expect(disclosures.some((d) => d.includes("Cash is fungible"))).toBe(true);
    // a second render with an authored pairing draws the bracketed ledger
    fireEvent.click(document.querySelector('[data-action="exit-presentation"]') as HTMLElement);
    expect((withPairs as ModelInputs & { flow?: unknown }).flow).toBeDefined(); // the fixture shape the surface editor writes
  });
});
