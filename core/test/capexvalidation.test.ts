import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { validateInputs } from "../src/validate.js";
import { appraisal, templateLike } from "./_shared.js";
import type { CostLine } from "../src/types.js";

const base = () => ({ ...templateLike(), appraisal: appraisal() });

describe("Task F: CAPEX override lines and the inert base fields", () => {
  it("CAPEX-OVR-VALID: a CAPEX line with overrides and amount 0 computes with zero issues; the line total equals the override sum", () => {
    const capexLine: CostLine = { id: "cx", name: "Boat", category: "capex", amount: 0, startYear: 0, durationYears: 0, escalation: 0, yearOverrides: { 1: 3000000, 2: 5000000 } };
    const inputs = { ...base(), costs: [...base().costs, capexLine] };
    expect(validateInputs(inputs)).toEqual([]);
    const r = computeModel(inputs);
    const lt = r.lineTotals.find((l) => l.id === "cx");
    expect(lt && lt.total).toBe(8000000);
  });

  it("CAPEX-OVR-NEG: a non-positive override amount still surfaces its named error", () => {
    const capexLine: CostLine = { id: "cx", name: "Boat", category: "capex", amount: 0, startYear: 0, durationYears: 0, escalation: 0, yearOverrides: { 1: 3000000, 2: -5 } };
    const issues = validateInputs({ ...base(), costs: [...base().costs, capexLine] });
    expect(issues.some((i) => i.includes("non-positive or non-finite override amount at year 2"))).toBe(true);
  });

  it("RECUR-VALID-UNCHANGED: a recurring line with overrides and amount 0 still surfaces the non-positive amount error", () => {
    const issues = validateInputs({ ...base(), costs: base().costs.map((c) => (c.id === "c1" ? { ...c, amount: 0, yearOverrides: { 3: 2000000 } } : c)) });
    expect(issues.some((i) => i.includes("c1") && i.includes("non-positive amount"))).toBe(true);
  });
});
