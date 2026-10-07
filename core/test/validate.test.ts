import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { EngineInputError, validateInputs } from "../src/validate.js";
import type { CostLine, ModelInputs, RepaymentParams } from "../src/types.js";

const validCosts: CostLine[] = [
  { id: "c1", name: "Development team", category: "recurring", amount: 1800000, startYear: 1, durationYears: 3, escalation: 3 },
  { id: "c2", name: "Infrastructure & licences", category: "recurring", amount: 600000, startYear: 1, durationYears: 3, escalation: 2 },
  { id: "c3", name: "Initial CAPEX", category: "capex", amount: 450000, startYear: 1, durationYears: 0, escalation: 0 },
];

const validRepayment: RepaymentParams = { graceYears: 0, termYears: 7, paymentsPerYear: 4, paymentEscalation: 0, balloon: 0 };

function makeInputs(overrides: {
  costs?: CostLine[];
  repayment?: Partial<RepaymentParams>;
  targetIrr?: number;
} = {}): ModelInputs {
  return {
    projectName: "Project Alpha",
    currency: "EUR",
    targetIrr: overrides.targetIrr ?? 12,
    costs: overrides.costs ?? validCosts,
    repayment: { ...validRepayment, ...overrides.repayment },
  };
}

describe("validateInputs rules", () => {
  it("valid baseline inputs produce no issues", () => {
    expect(validateInputs(makeInputs())).toEqual([]);
  });

  it("an empty cost list is valid", () => {
    expect(validateInputs(makeInputs({ costs: [] }))).toEqual([]);
  });

  it("rule: cost line must have a non-empty name", () => {
    const inp = makeInputs({ costs: [{ ...validCosts[0], name: "" }] });
    expect(validateInputs(inp)[0]).toBe("Cost line c1 has an empty name.");
    expect(() => computeModel(inp)).toThrowError(EngineInputError);
  });

  it("rule: cost line amount must be greater than 0", () => {
    const inp = makeInputs({ costs: [{ ...validCosts[0], amount: 0 }] });
    expect(validateInputs(inp)[0]).toBe("Cost line c1 (Development team) has a non-positive amount.");
    expect(() => computeModel(inp)).toThrowError(EngineInputError);
  });

  it("rule: start year must be an integer of at least 1", () => {
    const inp = makeInputs({ costs: [{ ...validCosts[0], startYear: 1.5 }] });
    expect(validateInputs(inp)[0]).toBe("Cost line c1 (Development team) has a start year that is not an integer of at least 1.");
    const inp2 = makeInputs({ costs: [{ ...validCosts[0], startYear: 0 }] });
    expect(validateInputs(inp2)[0]).toBe("Cost line c1 (Development team) has a start year that is not an integer of at least 1.");
  });

  it("rule: recurring lines must have durationYears of at least 1", () => {
    const inp = makeInputs({ costs: [{ ...validCosts[0], durationYears: 0 }] });
    expect(validateInputs(inp)[0]).toBe("Cost line c1 (Development team) is recurring and must have a duration of at least 1 year.");
  });

  it("rule: escalation must be finite", () => {
    const inp = makeInputs({ costs: [{ ...validCosts[0], escalation: Number.NaN }] });
    expect(validateInputs(inp)[0]).toBe("Cost line c1 (Development team) has a non-finite escalation.");
  });

  it("rule: termYears must be at least 0", () => {
    const inp = makeInputs({ repayment: { termYears: -1 } });
    expect(validateInputs(inp)[0]).toBe("Repayment block has a term below 0 years.");
  });

  it("rule: graceYears must be at least 0", () => {
    const inp = makeInputs({ repayment: { graceYears: -1 } });
    expect(validateInputs(inp)[0]).toBe("Repayment block has a grace period below 0 years.");
  });

  it("rule: paymentsPerYear must be one of 1, 2, 4, 12", () => {
    const inp = makeInputs({ repayment: { paymentsPerYear: 3 } });
    expect(validateInputs(inp)[0]).toBe("Repayment block has a payments-per-year that is not one of 1, 2, 4, 12.");
  });

  it("rule: paymentEscalation must be finite", () => {
    const inp = makeInputs({ repayment: { paymentEscalation: Number.POSITIVE_INFINITY } });
    expect(validateInputs(inp)[0]).toBe("Repayment block has a non-finite payment escalation.");
  });

  it("rule: balloon must be at least 0", () => {
    const inp = makeInputs({ repayment: { balloon: -1 } });
    expect(validateInputs(inp)[0]).toBe("Repayment block has a balloon below 0.");
  });

  it("rule: targetIrr must be greater than -100", () => {
    const inp = makeInputs({ targetIrr: -100 });
    expect(validateInputs(inp)[0]).toBe("Target IRR must be greater than -100.");
  });

  it("EngineInputError carries the issues array", () => {
    const inp = makeInputs({ costs: [{ ...validCosts[0], name: "", amount: 0 }] });
    try {
      computeModel(inp);
      throw new Error("expected EngineInputError");
    } catch (e) {
      expect(e).toBeInstanceOf(EngineInputError);
      const err = e as EngineInputError;
      expect(err.issues.length).toBe(2);
      expect(err.issues[0]).toBe("Cost line c1 has an empty name.");
      expect(err.issues[1]).toBe("Cost line c1 () has a non-positive amount.");
    }
  });

  it("CP-4 empty-costs case still computes without throwing", () => {
    const result = computeModel(makeInputs({ costs: [] }));
    expect(result.totalCost).toBe(0);
    expect(result.achievedIrr).toBeNull();
  });
});
