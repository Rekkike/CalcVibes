import { describe, expect, it } from "vitest";
// the web workspace is typed without Node declarations here; the test runner is Node
// @ts-ignore
import { createHash } from "node:crypto";
import { computeModel } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import {
  blankProject, composeFacility, demoProject, landNewbuildProject, migrateOnLoad, moveFacility, multiLeaseProject, shorePowerProgram, shorePowerProject,
  solarParkProject, suggestActivitiesFromFinancing, suggestActivitiesFromFunding,
} from "../src/state.js";
import { restoreLegacyFinancing } from "../../core/src/financing.js";
import type { Facility, ModelInputs } from "../../core/src/types.js";

// v0.6.16 — the web side of the facility input surface: the Round 92 net-flow byte-identity pin on the
// load path (the golden template, every demo fixture, a synthetic note-bearing case), the presentation
// parity of the deck and the timeline suggestions, and the amount-first composition pins.
type Hasher = { update(s: string): { digest(enc: string): string } };
const sha = (o: unknown): string => (createHash as unknown as (a: string) => Hasher)("sha256").update(JSON.stringify(o)).digest("hex");
const outcome = (inp: ModelInputs): unknown => {
  try { return computeModel(inp); } catch (e) { return { refused: (e as { issues?: string[] }).issues ?? String(e) }; }
};

const withNote = (): ModelInputs => ({
  ...demoProject(),
  financing: { enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0, serviceStartYear: null, amortization: "annuity", leveragedSolve: false, perLineSharePct: {} },
  funding: { rows: [{ id: "g1", label: "Grant", kind: "grant", amount: 200000, year: 1 }, { id: "l1", label: "Note", kind: "interest-free-loan", amount: 300000, year: 1, termYears: 4, repaymentStartYear: 2 }] },
});
const FIXTURES: [string, () => ModelInputs][] = [
  ["the golden template (the base demo, composed from data/template-project.json)", demoProject],
  ["the multi-lease demo", multiLeaseProject],
  ["the solar park demo", solarParkProject],
  ["the shore power demo", shorePowerProject],
  ["the shore power program demo (the grants, the note and the per-line financing)", shorePowerProgram],
  ["the land newbuild demo", landNewbuildProject],
  ["a synthetic note-bearing case", withNote],
];

describe("Task D — the Round 92 net-flow byte-identity pin on the load path (hash-compared, both directions)", () => {
  for (const [name, make] of FIXTURES) {
    it(`${name}: the legacy parse and the migrated twin compute byte-identically`, () => {
      const legacy = make();
      const twin = migrateOnLoad(legacy);
      expect(sha(outcome(twin))).toBe(sha(outcome(legacy)));
      const back = restoreLegacyFinancing(twin);
      expect(back).toEqual(legacy);
      expect(sha(outcome(back))).toBe(sha(outcome(legacy)));
    });
  }

  it("the note-bearing fixtures actually migrate (the twin carries a zero-rate facility and a grants-only funding block)", () => {
    for (const make of [shorePowerProgram, withNote]) {
      const twin = migrateOnLoad(make());
      expect(twin.facilities!.some((f) => f.ratePct === 0 && f.datedDraw !== undefined)).toBe(true);
      expect(twin.funding!.rows.every((r) => r.kind === "grant")).toBe(true);
      expect(twin.financing).toBeUndefined();
    }
  });

  it("blankProject carries no facility, no financing block and no note", () => {
    const b = blankProject();
    expect(b.facilities).toBeUndefined();
    expect(b.financing).toBeUndefined();
    expect(b.funding).toBeUndefined();
    expect(migrateOnLoad(b)).toBe(b);
  });
});

describe("Task D — the named cross-surface parity (the deck and PDF funding story, the timeline suggestions)", () => {
  for (const [name, make] of FIXTURES.filter(([n]) => /program|synthetic|land/.test(n))) {
    it(`${name}: the deck model is byte-identical after migration (the note receipt with its terms renders as before)`, () => {
      const legacy = make();
      const twin = migrateOnLoad(legacy);
      expect(sha(deckSlides(twin, computeModel(twin)))).toBe(sha(deckSlides(legacy, computeModel(legacy))));
    });
    it(`${name}: the timeline suggestions compose from the facility list exactly as from the legacy blocks`, () => {
      const legacy = make();
      const twin = migrateOnLoad(legacy);
      const rl = computeModel(legacy);
      const rt = computeModel(twin);
      expect(suggestActivitiesFromFunding(twin)).toEqual(suggestActivitiesFromFunding(legacy));
      expect(suggestActivitiesFromFinancing(twin, rt)).toEqual(suggestActivitiesFromFinancing(legacy, rl));
    });
  }
});

describe("Task C — the amount-first composition (derived shares, cap, drift)", () => {
  const fac = (over: Partial<Facility> = {}): Facility => ({
    id: "f1", label: "Bank", amount: 50000000, ratePct: 4, termYears: 15, graceYears: 2, amortization: "annuity", serviceStartYear: null, scope: { kind: "general" }, ...over,
  });
  const base = (): ModelInputs => shorePowerProject();
  const comp = (f: Facility) => {
    const inp = { ...base(), facilities: [f] };
    const r = computeModel(inp);
    return { r, inp, c: composeFacility(inp, r, f.id)! };
  };
  const tenths = (display: string) => Math.round(parseFloat(display.replace(",", ".").replace("%", "")) * 10);

  it("the shares derive from the incurred calendar, display at one decimal and close to exactly 100.0", () => {
    for (const amount of [1, 7777777, 50000000, 123456789, 99000000000]) {
      const { c } = comp(fac({ amount }));
      expect(c.rows.length).toBeGreaterThan(1);
      expect(c.rows.reduce((a, r) => a + tenths(r.display), 0)).toBe(1000);
      expect(c.shareTotalDisplay).toBe("100,0%");
      for (const r of c.rows) expect(r.display).toMatch(/^\d+,\d%$/);
    }
  });

  it("the displayed shares compose from the engine's draw ledger (the rows' draws sum to the drawn total)", () => {
    const { c, r } = comp(fac());
    const f = r.financing!.facilities![0];
    expect(c.rows.reduce((a, x) => a + x.draw, 0)).toBeCloseTo(f.drawnTotal, 4);
    expect(c.drawn).toBe(f.drawnTotal);
    expect(c.rows.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 12);
  });

  it("an ATTACHED facility spreads across its scoped lines alone", () => {
    const ids = base().costs.map((x) => x.id);
    const { c } = comp(fac({ amount: 1000000, scope: { kind: "attached", lineIds: [ids[0], ids[1]] } }));
    expect(c.rows.map((x) => x.lineId).sort()).toEqual([ids[0], ids[1]].sort());
    expect(c.shareTotalDisplay).toBe("100,0%");
  });

  it("the cap: a facility is never drawn past its scoped lines' incurred costs", () => {
    const ids = base().costs.map((x) => x.id);
    const { r, c } = comp(fac({ amount: 99000000000, scope: { kind: "attached", lineIds: [ids[0]] } }));
    const line = r.lineTotals.find((l) => l.id === ids[0])!;
    expect(c.drawn).toBeLessThanOrEqual(line.total + 1e-6);
    expect(c.drawn).toBeCloseTo(line.total, 4);
  });

  it("the drift is the engine's, disclosed when the drawn total differs from the stated amount, absent when they agree", () => {
    const over = comp(fac({ amount: 99000000000 }));
    expect(over.c.drifts).toBe(true);
    expect(over.c.drift).toBe(over.r.financing!.facilities![0].drift);
    expect(over.c.drift).toBeGreaterThan(0);
    const exact = comp(fac({ amount: 1000000 }));
    expect(exact.c.drifts).toBe(false);
    expect(exact.c.drawn).toBeCloseTo(1000000, 4);
  });

  it("reorder swaps neighbours and leaves the edges alone", () => {
    const list = [fac({ id: "a" }), fac({ id: "b" }), fac({ id: "c" })];
    expect(moveFacility(list, "b", -1).map((f) => f.id)).toEqual(["b", "a", "c"]);
    expect(moveFacility(list, "b", 1).map((f) => f.id)).toEqual(["a", "c", "b"]);
    expect(moveFacility(list, "a", -1)).toBe(list);
    expect(moveFacility(list, "c", 1)).toBe(list);
  });
});
