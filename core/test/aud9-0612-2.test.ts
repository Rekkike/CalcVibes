import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import type { ContractParams } from "../src/types.js";
import { capexLump, fixture } from "./_aud06122.js";

// v0.6.12.2 Task G (AUD-9) — a term position's paybackSoFar is crossing-based.
const contract = (over: Partial<ContractParams>): ContractParams => ({
  id: "k1", label: "K", startYear: 2, termYears: 20, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "evaluated", ...over,
});

describe("AUD-9: paybackSoFar is crossing-based", () => {
  it("never-crossing: null, the cumulative net stays at -8000000", () => {
    const r = computeModel(fixture([capexLump(10000000)], { repayment: { termYears: 10 }, contracts: [contract({ evaluatedPayment: 100000 })] }));
    expect(r.termPositions![0].paybackSoFar).toBeNull();
    expect(r.termPositions![0].cumulativeNet).toBe(-8000000);
  });

  it("past-crossing: the crossing year, with the headline payback", () => {
    const r = computeModel(fixture([capexLump(10000000)], { repayment: { termYears: 10 }, contracts: [contract({ termYears: 12, mode: "solved" })] }));
    expect(r.termPositions![0].paybackSoFar).toBe(9);
    expect(r.paybackYears).toBe(8.96133983474376);
  });
});
