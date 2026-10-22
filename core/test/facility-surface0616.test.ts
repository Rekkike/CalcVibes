import { describe, expect, it } from "vitest";
// the core workspace carries no Node type declarations; the test runner is Node
// @ts-ignore
import { createHash } from "node:crypto";
import { computeModel } from "../src/engine.js";
import { migrateLegacyFinancing, restoreLegacyFinancing, resolveFacilityLedger } from "../src/financing.js";
import { parseProject, serializeProject } from "../src/fileio.js";
import type { ProjectFileSettings } from "../src/fileio.js";
import { EngineInputError } from "../src/validate.js";
import type { Facility, FinancingConfig, FundingRow, ModelInputs } from "../src/types.js";
import { appraisal, templateLike } from "./_shared.js";

// v0.6.16 — the facility input surface (core): the authored facilities field, the absence lock, the
// mixed-document refusal, the authored-path FAC-* validation and the migration twin (the Round 92
// net-flow byte-identity constraint: the legacy parse and the migrated twin compute byte-identically).
type Hasher = { update(s: string): { digest(enc: string): string } };
const sha = (o: unknown): string => (createHash as unknown as (a: string) => Hasher)("sha256").update(JSON.stringify(o)).digest("hex");
const settings: ProjectFileSettings = { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null, scenarioGrantScales: null };

const fin = (over: Partial<FinancingConfig> = {}): FinancingConfig => ({
  enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0, serviceStartYear: null, amortization: "annuity", leveragedSolve: false, perLineSharePct: {}, ...over,
});
const grant = (id: string, year = 1): FundingRow => ({ id, label: "Grant " + id, kind: "grant", amount: 300000, year });
const note = (id: string): FundingRow => ({ id, label: "Municipal note", kind: "interest-free-loan", amount: 400000, year: 1, termYears: 4, repaymentStartYear: 2 });
const legacy = (over: Partial<ModelInputs>): ModelInputs => ({ ...templateLike(), appraisal: appraisal(), ...over });

const LEGACY_CASES: [string, ModelInputs][] = [
  ["the share-sized facility", legacy({ financing: fin() })],
  ["per-line shares, late service start, equal principal with grace", legacy({ financing: fin({ sharePct: 20, perLineSharePct: { c1: 80, c3: 10 }, serviceStartYear: 3, amortization: "equal-principal", graceYears: 1, termYears: 9 }) })],
  ["the leveraged solve", legacy({ financing: fin({ leveragedSolve: true }) })],
  ["a note between two grants (the row order survives)", legacy({ financing: fin(), funding: { rows: [grant("g1"), note("l1"), grant("g2", 2)] } })],
  ["financing disabled with a note", legacy({ financing: fin({ enabled: false }), funding: { rows: [note("l1")] } })],
  ["a note with no financing block", legacy({ funding: { rows: [grant("g1"), note("l1")] } })],
  ["financing disabled, nothing else", legacy({ financing: fin({ enabled: false, sharePct: 33 }) })],
  ["financing with grants only", legacy({ financing: fin(), funding: { rows: [grant("g1")] } })],
  ["two notes", legacy({ financing: fin(), funding: { rows: [note("l1"), { ...note("l2"), amount: 200000, year: 2, repaymentStartYear: 3 }] } })],
  ["no financing, no funding (the golden shape)", legacy({})],
];

describe("Task A — the absence path is the lock", () => {
  it("an absent facilities field and an empty list compute byte-identically", () => {
    for (const [, inp] of LEGACY_CASES) {
      expect(sha(computeModel({ ...inp, facilities: [] }))).toBe(sha(computeModel(inp)));
    }
  });
});

describe("Task D — the migration twin (the Round 92 net-flow byte-identity constraint)", () => {
  for (const [name, inp] of LEGACY_CASES) {
    it(`${name}: the legacy parse and the migrated twin compute byte-identically, in both directions`, () => {
      const twin = migrateLegacyFinancing(inp);
      expect(sha(computeModel(twin))).toBe(sha(computeModel(inp)));
      // the other direction: the restored legacy shape equals the original and computes identically
      const back = restoreLegacyFinancing(twin);
      expect(back).toEqual(inp);
      expect(sha(computeModel(back))).toBe(sha(computeModel(inp)));
    });
  }

  it("the twin carries no legacy overlay and no funding-block note; the grants stay", () => {
    const twin = migrateLegacyFinancing(LEGACY_CASES[3][1]);
    expect(twin.financing).toBeUndefined();
    expect(twin.funding!.rows.map((r) => r.kind)).toEqual(["grant", "grant"]);
    expect(twin.facilities!.map((f) => f.id)).toEqual(["financing", "l1"]);
    expect(twin.facilities![0]).toMatchObject({ amount: null, sharePct: 60, scope: { kind: "general" } });
    expect(twin.facilities![1]).toMatchObject({ amount: 400000, ratePct: 0, datedDraw: { year: 1 }, paymentsPerYear: 1, termYears: 4, serviceStartYear: 1 });
  });

  it("a document that already carries facilities is not migrated again", () => {
    const twin = migrateLegacyFinancing(LEGACY_CASES[0][1]);
    expect(migrateLegacyFinancing(twin)).toBe(twin);
  });

  it("a legacy document with nothing to migrate is returned unchanged", () => {
    const { financing: _drop, ...bare } = legacy({});
    const g = bare as ModelInputs;
    expect(g.financing).toBeUndefined();
    expect(migrateLegacyFinancing(g)).toBe(g);
  });

  it("the migration is the one source: the twin's installment schedule is the note's (a mutated schedule moves the net flow)", () => {
    const inp = LEGACY_CASES[3][1];
    const twin = migrateLegacyFinancing(inp);
    const bent: ModelInputs = { ...twin, facilities: twin.facilities!.map((f) => (f.id === "l1" ? { ...f, termYears: 5 } : f)) };
    expect(sha(computeModel(bent))).not.toBe(sha(computeModel(inp)));
  });
});

describe("Task A — the authored path computes through the one facility ledger", () => {
  const base = (): ModelInputs => legacy({});
  const f1 = (over: Partial<Facility> = {}): Facility => ({
    id: "f1", label: "Bank", amount: 300000, ratePct: 5, termYears: 5, graceYears: 0, amortization: "annuity", serviceStartYear: null, scope: { kind: "general" }, ...over,
  });

  it("an amount-first GENERAL facility: the amount is the commitment, the draws spread by the incurred calendar, the drift is zero", () => {
    const r = computeModel({ ...base(), facilities: [f1()] });
    const fr = r.financing!.facilities![0];
    expect(fr.drawnTotal).toBeCloseTo(300000, 6);
    expect(Math.abs(fr.drift as number)).toBeLessThan(1e-6);
    const ledger = resolveFacilityLedger(base().costs, [f1()], r.financing!.monthly.service.length);
    expect(fr.drawnTotal).toBe(ledger.drawn.f1);
    expect(fr.shares).toEqual(ledger.shares.f1);
    expect(r.financing!.drawnTotal).toBeCloseTo(300000, 6);
  });

  it("an oversized amount exposes the drift and never draws past the incurred costs", () => {
    const r = computeModel({ ...base(), facilities: [f1({ amount: 99000000 })] });
    const fr = r.financing!.facilities![0];
    const totalCost = r.lineTotals.reduce((a, l) => a + l.total, 0);
    expect(fr.drawnTotal).toBeCloseTo(totalCost, 6);
    expect(fr.drift).toBeCloseTo(99000000 - totalCost, 6);
    for (const s of Object.values(fr.shares)) expect(s).toBeLessThanOrEqual(1);
  });

  it("an ATTACHED facility draws on its scoped lines alone", () => {
    const r = computeModel({ ...base(), facilities: [f1({ amount: 100000, scope: { kind: "attached", lineIds: ["c3"] } })] });
    const fr = r.financing!.facilities![0];
    expect(Object.keys(fr.shares)).toEqual(["c3"]);
    expect(fr.drawnTotal).toBeCloseTo(100000, 6);
  });

  it("the power-user path: authored shares reproduce the legacy drawdown arithmetic exactly", () => {
    const leg = computeModel(legacy({ financing: fin({ sharePct: 20, perLineSharePct: { c1: 80 }, serviceStartYear: 3 }) }));
    const authored = computeModel({
      ...base(),
      facilities: [{ id: "financing", label: "Financing facility", amount: null, ratePct: 6, termYears: 7, graceYears: 0, amortization: "annuity", serviceStartYear: 3, scope: { kind: "general" }, sharePct: 20, perLineSharePct: { c1: 80 }, origin: "financing" }],
    });
    expect(sha(authored.financing)).toBe(sha(leg.financing));
    expect(authored.financing!.facilities![0].drift).toBeNull();
  });

  it("two authored facilities compose pari passu on the combined service stream", () => {
    const r = computeModel({ ...base(), facilities: [f1({ amount: 200000 }), f1({ id: "f2", label: "Second", amount: 150000, termYears: 3, scope: { kind: "attached", lineIds: ["c3"] } })] });
    expect(r.financing!.facilities!.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(r.financing!.minDscr).not.toBeNull();
    const s = r.financing!.facilities!;
    for (let m = 0; m < r.financing!.monthly.service.length; m++) expect(r.financing!.monthly.service[m]).toBeCloseTo(s[0].monthly.service[m] + s[1].monthly.service[m], 6);
  });

  it("a disabled facility stays declared and leaves the computation", () => {
    const on = computeModel({ ...base(), facilities: [f1()] });
    const off = computeModel({ ...base(), facilities: [f1({ enabled: false })] });
    expect(off.financing).toBeNull();
    expect(on.financing).not.toBeNull();
    expect(sha(off)).toBe(sha(computeModel(base())));
  });

  it("the leveraged solve rides the authored options and aggregates across facilities", () => {
    const plain = computeModel({ ...base(), facilities: [f1(), f1({ id: "f2", label: "Second", amount: 100000 })] });
    const lev = computeModel({ ...base(), facilities: [f1(), f1({ id: "f2", label: "Second", amount: 100000 })], facilityOptions: { leveragedSolve: true } });
    expect(lev.paymentAmount).not.toBe(plain.paymentAmount);
    expect(lev.leveragedSolve).toBe(true);
  });
});

describe("Task A — the mixed-document refusal and the authored-path FAC-* refusals (collect-all)", () => {
  const MIXED = "The document carries the authored facilities together with the legacy financing overlay or a funding-block note; migrate the legacy entries into the facility list or remove them (FAC-MIXED).";
  const facility = (over: Partial<Facility> = {}): Facility => ({ id: "f1", label: "Bank", amount: 300000, ratePct: 5, termYears: 5, graceYears: 0, amortization: "annuity", serviceStartYear: null, scope: { kind: "general" }, ...over });
  const issuesOf = (inp: ModelInputs): string[] => {
    try { computeModel(inp); } catch (e) { if (e instanceof EngineInputError) return e.issues; throw e; }
    return [];
  };

  it("authored facilities with an enabled legacy overlay refuse with the one exact string", () => {
    expect(issuesOf(legacy({ facilities: [facility()], financing: fin() }))).toEqual([MIXED]);
  });

  it("authored facilities with a funding-block note refuse with the same string, once", () => {
    expect(issuesOf(legacy({ facilities: [facility()], funding: { rows: [grant("g1"), note("l1")] } }))).toEqual([MIXED]);
    expect(issuesOf(legacy({ facilities: [facility()], financing: fin(), funding: { rows: [note("l1")] } }))).toEqual([MIXED]);
  });

  it("grants coexist with authored facilities; a disabled legacy overlay is inert", () => {
    expect(issuesOf(legacy({ facilities: [facility()], funding: { rows: [grant("g1")] } }))).toEqual([]);
    expect(issuesOf(legacy({ facilities: [facility()], financing: fin({ enabled: false }) }))).toEqual([]);
  });

  it("each authored defect refuses with its exact FAC-* message, none suppressed", () => {
    const got = issuesOf(legacy({
      facilities: [
        facility({ id: "x1", label: "Bad amount", amount: 0 }),
        facility({ id: "x2", label: "Bad term", termYears: 0 }),
        facility({ id: "x3", label: "Empty scope", scope: { kind: "attached", lineIds: [] } }),
        facility({ id: "x4", label: "Ghost line", scope: { kind: "attached", lineIds: ["c9"] } }),
        facility({ id: "x5", label: "Late start", serviceStartYear: 50 }),
      ],
    }));
    expect(got).toEqual([
      "Facility x1 (Bad amount) must carry a positive amount (FAC-AMOUNT).",
      "Facility x2 (Bad term) must carry a positive term (FAC-TERM).",
      "Facility x3 (Empty scope) is attached but names no cost line (FAC-SCOPE-EMPTY).",
      "Facility x4 (Ghost line) is attached to cost line c9, which does not exist (FAC-SCOPE-LINE).",
      expect.stringContaining("Facility x5 (Late start) has a service start year 50"),
    ]);
  });

  it("a lump-draw facility must be interest-free; a duplicate id refuses", () => {
    expect(issuesOf(legacy({ facilities: [facility({ datedDraw: { year: 1 }, ratePct: 3, paymentsPerYear: 1, amortization: "equal-principal", termYears: 4, serviceStartYear: 1 })] }))).toEqual([
      "Facility f1 (Bank) lands as a dated lump and must be interest-free, a rate of 0 (FAC-DATED-RATE).",
    ]);
    expect(issuesOf(legacy({ facilities: [facility(), facility()] }))).toEqual(["Facility f1 appears more than once in the facility list (FAC-ID)."]);
  });
});

describe("the file layer — additive, fileVersion 1, no new refusal", () => {
  it("an authored document round-trips byte-identically; a document without the field is untouched", () => {
    const twin = migrateLegacyFinancing(LEGACY_CASES[3][1]);
    const text = serializeProject(twin, settings);
    expect(JSON.parse(text).fileVersion).toBe(1);
    const back = parseProject(text);
    expect(serializeProject(back.inputs, back.settings)).toBe(text);
    const plain = serializeProject(LEGACY_CASES[0][1], settings);
    expect(plain).not.toContain('"facilities"');
    const again = parseProject(plain);
    expect(serializeProject(again.inputs, again.settings)).toBe(plain);
  });

  it("a mixed document still opens (the engine's collect-all validation refuses it by name)", () => {
    const mixed: ModelInputs = { ...legacy({ financing: fin() }), facilities: [{ id: "f1", label: "Bank", amount: 1, ratePct: 1, termYears: 1, graceYears: 0, amortization: "annuity", serviceStartYear: null, scope: { kind: "general" } }] };
    expect(() => parseProject(serializeProject(mixed, settings))).not.toThrow();
  });
});
