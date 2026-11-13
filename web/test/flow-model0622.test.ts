import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { composeFlow, demoProject, flowOf, landNewbuildProject, shorePowerProgram, solarParkProject } from "../src/state.js";
import type { ModelInputs } from "../../core/src/types.js";
import { serializeProject, parseProject } from "../../core/src/fileio.js";

// v0.6.22 Task A/F — the composed allocation model (composeFlow in web/src/state.ts): the per-year
// chains and their order, the signed remainder, the shortfall year, the override caps and authored
// order, the cumulative satisfaction across years, the aggregation reconciling exactly to the grid
// totals, the named refusals, and the round-trip pins (Task D, the deckTitles pins verbatim). Every
// figure below was script-verified against the delivered engine (the harness run of record); nothing
// is hand-derived. The engine-blind wall: the flow field never reaches the engine.

const settings = { startYear: null, entryUnit: "ones" as const, scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null };
const withPairs = (pairs: { id: string; sourceId: string; useId: string; amount: number }[]): ModelInputs =>
  ({ ...shorePowerProgram(), flow: { pairs } }) as ModelInputs;

describe("v0.6.22 Task A — the composed allocation model", () => {
  it("TEMPLATE: the per-year chain, the signed remainder and the shortfall years (script-verified)", () => {
    const flow = composeFlow(demoProject(), computeModel(demoProject()));
    expect(flow.years.length).toBe(10);
    expect(flow.sources.map((s) => [s.key, s.total])).toEqual([["payments:payments", 13308655.754089093]]);
    expect(flow.useOrder).toEqual(["cost:c1", "cost:c2", "cost:c3"]); // no financing: capital rows in grid order
    // the shortfall years 1-3: no collections yet, the remainder is negative, never smoothed
    expect(flow.years.slice(0, 3).map((y) => y.remainder)).toEqual([-2850000, -2466000, -2058550.8659253896]);
    expect(flow.years[2].allocations).toEqual([{ sourceKey: "payments:payments", useKey: "cost:c1", year: 3, amount: 475309.1340746104 }]);
    expect(flow.shortfallYears).toBe(3);
    expect(flow.remainderShortfall).toBe(-7374550.865925389);
    expect(flow.remainderSurplus).toBe(12833346.620014483);
    expect(flow.remainderNet).toBe(5458795.754089092);
    expect(flow.connectors).toEqual([
      { sourceKey: "payments:payments", useKey: "cost:c1", amount: 475309.1340746104 },
      { sourceKey: "payments:payments", useKey: "equity:remainder", amount: 12833346.620014483 },
    ]);
  });

  it("IDENTITY: income total equals use total with the signed equity remainder, per year and aggregated", () => {
    for (const demo of [demoProject(), solarParkProject(), landNewbuildProject(), shorePowerProgram()]) {
      const flow = composeFlow(demo, computeModel(demo));
      for (const y of flow.years) {
        expect(y.income - y.uses).toBeCloseTo(y.remainder, 9);
        // every gross positive inflow of the year is allocated somewhere (uses or the equity remainder)
        expect(y.allocations.reduce((a, x) => a + x.amount, 0)).toBeCloseTo(y.grossIncome, 6);
      }
      const incomeTotal = flow.sources.reduce((a, s) => a + s.total, 0);
      const grossTotal = flow.sources.reduce((a, s) => a + s.gross, 0);
      const connectorTotal = flow.connectors.reduce((a, c) => a + c.amount, 0);
      expect(connectorTotal).toBeCloseTo(grossTotal, 6); // every positive inflow dollar is allocated somewhere
      expect(flow.remainderNet).toBeCloseTo(flow.remainderSurplus + flow.remainderShortfall, 6);
      const usesTotal = flow.uses.filter((u) => u.key !== "equity:remainder").reduce((a, u) => a + u.total, 0);
      expect(incomeTotal).toBeCloseTo(usesTotal + flow.remainderNet, 6); // the one reconciliation identity
    }
  });

  it("BOOK RECONCILIATION: the per-year income composes equal to the book view's collections column on every demo", () => {
    for (const demo of [demoProject(), solarParkProject(), landNewbuildProject(), shorePowerProgram()]) {
      const result = computeModel(demo);
      const flow = composeFlow(demo, result);
      expect(result.bookView).toBeDefined();
      for (const y of flow.years) {
        // the book view sums the monthly vector in its own order; the reconciliation holds at 1e-6
        expect(y.income).toBeCloseTo((result.bookView?.combined ?? []).find((r) => r.year === y.year)?.collections ?? 0, 6);
      }
    }
  });

  it("PROGRAM: the coverage order of record (debt service first), the year-1 grant/note capital, the year-3 overlap (script-verified)", () => {
    const flow = composeFlow(shorePowerProgram(), computeModel(shorePowerProgram()));
    expect(flow.useOrder[0]).toBe("financing:service");
    expect(flow.useOrder.slice(1, 3)).toEqual(["operating:o1", "operating:o2"]);
    expect(flow.useOrder.slice(3)).toEqual(["cost:p1", "cost:p2", "cost:p3", "cost:p4", "cost:p5", "cost:p6"]);
    expect(flow.sources.map((s) => s.key)).toEqual(["tariff:r1", "tariff:r2", "tariff:r3", "tariff:r4", "grant:g1", "grant:g2", "grant:g3", "funding-loan:l1"]);
    // year 1: the province grant and the note's advance pay the year's capital
    expect(flow.years[0].allocations).toEqual([
      { sourceKey: "grant:g3", useKey: "cost:p1", year: 1, amount: 3500000 },
      { sourceKey: "funding-loan:l1", useKey: "cost:p1", year: 1, amount: 10000000 },
    ]);
    expect(flow.years[0].remainder).toBe(-27500000);
    // year 3: the capital/collections overlap — tariff and grant rows pay the year's capital
    expect(flow.years[2].allocations).toEqual([
      { sourceKey: "tariff:r1", useKey: "cost:p2", year: 3, amount: 2843365.6055825967 },
      { sourceKey: "grant:g1", useKey: "cost:p2", year: 3, amount: 52156634.394417405 },
      { sourceKey: "grant:g1", useKey: "cost:p3", year: 3, amount: 17843365.605582595 },
    ]);
    expect(flow.remainderNet).toBe(84924579.31038983);
    expect(flow.remainderSurplus).toBe(392417531.91238636);
    expect(flow.remainderShortfall).toBe(-307492952.60199666);
    expect(flow.shortfallYears).toBe(4);
    const conn = (s: string, u: string) => flow.connectors.find((c) => c.sourceKey === s && c.useKey === u)?.amount;
    expect(conn("tariff:r1", "financing:service")).toBe(142733166.0294332);
    expect(conn("tariff:r1", "operating:o1")).toBe(119500000);
    expect(conn("tariff:r1", "operating:o2")).toBe(59750000);
    expect(conn("grant:g2", "equity:remainder")).toBe(85663681.79242073);
    // the interest-free note nets to zero over the horizon and never joins as a flow
    expect(flow.sources.find((s) => s.key === "funding-loan:l1")?.total).toBe(0);
  });

  it("SOLAR: the single payment-stream source against operating and capital; LAND: the contract sources and the residual", () => {
    const solar = composeFlow(solarParkProject(), computeModel(solarParkProject()));
    expect(solar.sources.map((s) => s.key)).toEqual(["payments:payments"]);
    expect(solar.useOrder[0]).toBe("operating:o1"); // no financing: operating first, then capital
    expect(solar.remainderNet).toBe(11063024.868051972);
    expect(solar.shortfallYears).toBe(4);
    const land = composeFlow(landNewbuildProject(), computeModel(landNewbuildProject()));
    expect(land.sources.map((s) => s.key)).toEqual(["contract:k1", "contract:k2", "residual:residual"]);
    expect(land.remainderShortfall).toBe(-420000000);
    expect(land.shortfallYears).toBe(2);
    expect(land.remainderNet).toBe(533498112.20214677);
  });

  it("OVERRIDES: authored pairings first in authored order, capped at the remaining amount, the year's source flow and use demand, cumulative across years (script-verified)", () => {
    const inputs = withPairs([
      { id: "f1", sourceId: "grant:g2", useId: "cost:p4", amount: 50000000 },
      { id: "f2", sourceId: "tariff:r1", useId: "financing:service", amount: 30000000 },
    ]);
    const flow = composeFlow(inputs, computeModel(inputs));
    const f1 = flow.pairings.find((p) => p.id === "f1");
    const f2 = flow.pairings.find((p) => p.id === "f2");
    // f1 caps at the year-5 remaining demand of cost:p4 (31,250,000); the rest stays unsatisfied
    expect(f1?.allocated).toBe(31250000);
    expect(f1?.remaining).toBe(18750000);
    expect(flow.years[4].allocations[0]).toEqual({ sourceKey: "grant:g2", useKey: "cost:p4", year: 5, amount: 31250000 });
    // f2 draws on tariff:r1 across years 4..9 until the 30,000,000 is satisfied; the default fills the rest of the year-9 service
    expect(f2?.allocated).toBe(30000000);
    expect(f2?.remaining).toBe(0);
    const y9service = flow.years[8].allocations.filter((a) => a.useKey === "financing:service");
    expect(y9service).toEqual([
      { sourceKey: "tariff:r1", useKey: "financing:service", year: 9, amount: 895995.3873802498 },
      { sourceKey: "tariff:r1", useKey: "financing:service", year: 9, amount: 7345948.707073979 },
    ]);
    // the remainder identity is invariant under overrides
    expect(flow.remainderNet).toBe(84924579.31038983);
  });

  it("REFUSALS: the collect-all named refusals; a refused pairing never allocates", () => {
    const inputs = withPairs([
      { id: "f2", sourceId: "tariff:r1", useId: "financing:service", amount: 30000000 },
      { id: "f3", sourceId: "tariff:r1", useId: "financing:service", amount: 1 }, // duplicate
      { id: "f4", sourceId: "nope:x", useId: "cost:p1", amount: 5 },
      { id: "f5", sourceId: "grant:g1", useId: "nope:y", amount: 5 },
      { id: "f6", sourceId: "grant:g1", useId: "cost:p1", amount: -3 },
      { id: "f7", sourceId: "funding-loan:l1", useId: "cost:p1", amount: 7 }, // dead source: warning
    ]);
    const flow = composeFlow(inputs, computeModel(inputs));
    expect(flow.refusals.map((r) => r.code)).toEqual(["FLOW-PAIRING-DUPLICATE", "FLOW-PAIRING-SOURCE", "FLOW-PAIRING-USE", "FLOW-PAIRING-AMOUNT", "FLOW-PAIRING-DEAD"]);
    expect(flow.refusals.find((r) => r.code === "FLOW-PAIRING-DEAD")?.warning).toBe(true);
    expect(flow.refusals.find((r) => r.code === "FLOW-PAIRING-DUPLICATE")?.message).toContain("f3 duplicates the pairing of tariff:r1 to financing:service");
    expect(flow.pairings.find((p) => p.id === "f3")?.allocated).toBe(0); // refused: never allocates
    const y9service = flow.years[8].allocations.filter((a) => a.useKey === "financing:service");
    expect(y9service).toEqual([
      { sourceKey: "tariff:r1", useKey: "financing:service", year: 9, amount: 895995.3873802498 },
      { sourceKey: "tariff:r1", useKey: "financing:service", year: 9, amount: 7345948.707073979 },
    ]);
  });

  it("ENGINE-BLIND: the flow field never reaches the engine — identical computeModel output with and without pairs", () => {
    const plain = shorePowerProgram();
    const withFlow = withPairs([{ id: "f1", sourceId: "grant:g2", useId: "cost:p4", amount: 50000000 }]);
    expect(JSON.stringify(computeModel(withFlow))).toBe(JSON.stringify(computeModel(plain)));
  });
});

describe("v0.6.22 Task D — the document field and the round-trip (the deckTitles pins verbatim)", () => {
  it("ROUND-TRIP: serialize then parse then serialize byte-identity with pairs present; FILE_VERSION stays 1", () => {
    const inputs = withPairs([
      { id: "f1", sourceId: "grant:g2", useId: "cost:p4", amount: 50000000 },
      { id: "f2", sourceId: "tariff:r1", useId: "financing:service", amount: 30000000 },
    ]);
    const text = serializeProject(inputs, settings);
    expect(JSON.parse(text).fileVersion).toBe(1);
    const loaded = parseProject(text);
    expect(serializeProject(loaded.inputs, settings)).toBe(text);
    expect(flowOf(loaded.inputs)).toEqual([
      { id: "f1", sourceId: "grant:g2", useId: "cost:p4", amount: 50000000 },
      { id: "f2", sourceId: "tariff:r1", useId: "financing:service", amount: 30000000 },
    ]);
    // the loaded document composes the same allocation
    const flow = composeFlow(loaded.inputs, computeModel(loaded.inputs));
    expect(flow.pairings.find((p) => p.id === "f2")?.allocated).toBe(30000000);
  });

  it("BACK-COMPAT: a version-1 file without the field parses as the empty behavior and computes identically", () => {
    const legacy = parseProject(serializeProject(shorePowerProgram(), settings));
    expect(flowOf(legacy.inputs)).toEqual([]);
    expect(JSON.stringify(legacy.inputs)).toBe(JSON.stringify(shorePowerProgram()));
    expect(JSON.stringify(computeModel(legacy.inputs))).toBe(JSON.stringify(computeModel(shorePowerProgram())));
  });
});
