import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import type { ModelInputs } from "../src/engine.js";

const demo: ModelInputs = {
  projectName: "Project Alpha",
  currency: "EUR",
  targetIrr: 12,
  costs: [
    { id: "c1", name: "Development team", category: "recurring", amount: 1800000, startYear: 1, durationYears: 3, escalation: 3 },
    { id: "c2", name: "Infrastructure & licences", category: "recurring", amount: 600000, startYear: 1, durationYears: 3, escalation: 2 },
    { id: "c3", name: "Initial CAPEX", category: "capex", amount: 450000, startYear: 1, durationYears: 0, escalation: 0 },
  ],
  repayment: { graceYears: 0, termYears: 7, paymentsPerYear: 4, paymentEscalation: 0, balloon: 0 },
};

describe("smoke: UI consumes the identical engine", () => {
  it("baseline model through the UI import path pins paymentAmount 475,309.13407 within 0.01", () => {
    const result = computeModel(demo);
    expect(Math.abs(result.paymentAmount - 475309.13407)).toBeLessThan(0.01);
  });
});
