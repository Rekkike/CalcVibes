// v0.6.12 Task C: the titles-vs-vocabulary regression (Round 46 Supplement 12). No deck title
// and no action header (the chart kickers) may contradict the declared unit vocabulary.
import { describe, expect, it } from "vitest";
import { deckSlides } from "../src/deck.js";
import { computeModel } from "../src/engine.js";
import { demoProject, shorePowerProgram } from "../src/state.js";
import type { ModelInputs, TariffRow } from "../../core/src/types.js";

const rows: TariffRow[] = [
  { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] },
  { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] },
];

// The hardcoded domain descriptors of record that no title or kicker may carry.
const HARDCODED = [/per-lift/i, /\blifts?\b/i];
// A unit-bearing token: a slash unit (€ct/kWh) or a per-descriptor (per-kWh).
const UNIT_TOKEN = /\S*\/\S+|\bper-\S+/g;

function deckText(inputs: ModelInputs, settings?: Parameters<typeof deckSlides>[2]) {
  const deck = deckSlides(inputs, computeModel(inputs), settings);
  const titles = deck.slides.map((s) => s.title);
  const kickers = deck.slides.flatMap((s) => [
    s.chart?.kicker,
    s.targetChart?.kicker,
    ...(s.summaryCharts ?? []).map((c) => c.kicker),
  ]).filter((k): k is string => typeof k === "string");
  return { deck, titles, kickers };
}

function expectVocabularyHonest(strings: string[], declared: string[]) {
  for (const s of strings) {
    for (const re of HARDCODED) expect(s, s).not.toMatch(re);
    for (const token of s.match(UNIT_TOKEN) ?? []) expect(declared, s).toContain(token);
  }
}

describe("v0.6.12 Task C: titles versus the declared vocabulary", () => {
  it("TITLES-PROGRAM: the program fixture's recovery title composes from the declared priceUnitLabel; no title or kicker contradicts the vocabulary", () => {
    const inputs = shorePowerProgram();
    const priceUnit = inputs.tariff?.priceUnitLabel as string;
    const volumeUnit = inputs.tariff?.volumeUnitLabel as string;
    expect(priceUnit.trim()).not.toBe("");
    const { deck, titles, kickers } = deckText(inputs, { startYear: 2026, entryUnit: "ones", scenarioTargets: [4, 6, 8], scenarioTerms: [15, 20, 25], scenarioBalloons: [0, 8, 16] });
    expect(deck.slides.find((s) => s.name === "recovery")?.title).toBe("The recovery — " + priceUnit + " prices");
    expect(kickers.length).toBeGreaterThan(0);
    expectVocabularyHonest([...titles, ...kickers], [priceUnit, volumeUnit]);
  });

  it("TITLES-TEMPLATE: the canonical template renders its branch title with no unit descriptor on any title or kicker", () => {
    const inputs = demoProject();
    const { deck, titles, kickers } = deckText(inputs);
    expect(deck.slides.find((s) => s.name === "recovery")?.title).toBe("The recovery — solved payments");
    expectVocabularyHonest([...titles, ...kickers], []);
  });

  it("TITLES-FALLBACK: a decompose fixture declaring no priceUnitLabel takes the unit-free fallback", () => {
    const inputs: ModelInputs = { ...demoProject(), tariff: { mode: "decompose", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } };
    const { deck, titles, kickers } = deckText(inputs);
    expect(deck.slides.find((s) => s.name === "recovery")?.title).toBe("The recovery — the tariff");
    expectVocabularyHonest([...titles, ...kickers], []);
  });
});
