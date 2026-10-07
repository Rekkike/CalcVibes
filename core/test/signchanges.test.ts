import { describe, expect, it } from "vitest";
import { computeModel, countSignChanges } from "../src/engine.js";
import type { CostLine, ModelInputs, RepaymentParams } from "../src/types.js";

const baselineCosts: CostLine[] = [
  { id: "c1", name: "Development team", category: "recurring", amount: 1800000, startYear: 1, durationYears: 3, escalation: 3 },
  { id: "c2", name: "Infrastructure & licences", category: "recurring", amount: 600000, startYear: 1, durationYears: 3, escalation: 2 },
  { id: "c3", name: "Initial CAPEX", category: "capex", amount: 450000, startYear: 1, durationYears: 0, escalation: 0 },
];

const baselineRepayment: RepaymentParams = { graceYears: 0, termYears: 7, paymentsPerYear: 4, paymentEscalation: 0, balloon: 0 };

const baselineInputs: ModelInputs = {
  projectName: "Project Alpha", currency: "EUR", targetIrr: 12, costs: baselineCosts, repayment: baselineRepayment,
};

describe("countSignChanges pins", () => {
  it("countSignChanges([-1, -2, 3, 4]) equals 1", () => {
    expect(countSignChanges([-1, -2, 3, 4])).toBe(1);
  });

  it("countSignChanges([-1, 2, -3]) equals 2", () => {
    expect(countSignChanges([-1, 2, -3])).toBe(2);
  });

  it("countSignChanges([0, 0, 0]) equals 0", () => {
    expect(countSignChanges([0, 0, 0])).toBe(0);
  });

  it("countSignChanges([0, -5, 3, 0, 2, -1]) equals 2", () => {
    expect(countSignChanges([0, -5, 3, 0, 2, -1])).toBe(2);
  });

  it("baseline CP-2 result has signChanges 1 and irrAmbiguous false", () => {
    const result = computeModel(baselineInputs);
    expect(result.signChanges).toBe(1);
    expect(result.irrAmbiguous).toBe(false);
  });
});
