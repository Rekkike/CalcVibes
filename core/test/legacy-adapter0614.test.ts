import { describe, expect, it } from "vitest";
// the core workspace carries no Node type declarations; the test runner is Node
// @ts-ignore
import { createHash } from "node:crypto";
import { computeModel } from "../src/engine.js";
import { appraisal, templateLike } from "./_shared.js";
import type { FinancingConfig } from "../src/types.js";

// v0.6.14 — the legacy path of record: the per-line-share financing inputs reach the facility model
// through the adapter and produce the pre-unification figures byte for byte (the SHA-256 of the
// financing result, computed on the unmodified v0.6.13.5 engine, minus the additive facilities list).
// Only the funding-block note moves figures (the delta map of record; pinned in funding0610.test.ts).
const fin = (over: Partial<FinancingConfig>): FinancingConfig => ({
  enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0, serviceStartYear: null, amortization: "annuity", leveragedSolve: false, perLineSharePct: {}, ...over,
});
type Hasher = { update(s: string): { digest(enc: string): string } };
const hashOf = (over: Partial<FinancingConfig>): string => {
  const r = computeModel({ ...templateLike(), appraisal: appraisal(), financing: fin(over) });
  return (createHash as unknown as (a: string) => Hasher)("sha256").update(JSON.stringify({ ...r.financing, facilities: undefined })).digest("hex");
};

describe("the legacy adapter reproduces the pre-unification overlay byte for byte", () => {
  it("a share-sized annuity facility", () => expect(hashOf({})).toBe("7f428044e086cef79f88db18e59c39cfb05d8a4f36c73539bbc9c1b86524164d"));
  it("an equal-principal facility with grace", () => expect(hashOf({ amortization: "equal-principal", graceYears: 2, termYears: 9, sharePct: 45, debtRatePct: 4.5 })).toBe("edd3d43043e79ab3947f15408b00e1b9b0643897f52d202ed75a95b4efe7fabf"));
  it("per-line shares with a late service start", () => expect(hashOf({ sharePct: 20, perLineSharePct: { c1: 80, c3: 10 }, serviceStartYear: 4 })).toBe("034eadf41608a1e96d6a76d2e1945bc4f13c08ebd4a19ce56bdd36f911ed2df8"));
  it("the leveraged solve", () => expect(hashOf({ leveragedSolve: true })).toBe("385227a10d814ddef65a11c324c187a90dc75eb98c5f4fbd05beb2fa6974fe2a"));
  it("the facility list carries the one derived general facility with no drift", () => {
    const r = computeModel({ ...templateLike(), appraisal: appraisal(), financing: fin({}) });
    expect(r.financing!.facilities).toHaveLength(1);
    expect(r.financing!.facilities![0]).toMatchObject({ id: "financing", origin: "financing", scope: { kind: "general" }, drift: null });
    expect(r.financing!.facilities![0].amount).toBe(r.financing!.drawnTotal);
  });
});
