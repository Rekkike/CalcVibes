import type { ModelInputs } from "./types.js";

export class EngineInputError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super("Invalid model inputs: " + issues.join("; "));
    this.name = "EngineInputError";
    this.issues = issues;
  }
}

export function validateInputs(inp: ModelInputs): string[] {
  const issues: string[] = [];
  inp.costs.forEach((c) => {
    if (!c.name || c.name.trim() === "") {
      issues.push(`Cost line ${c.id} has an empty name.`);
    }
    if (!(c.amount > 0)) {
      issues.push(`Cost line ${c.id} (${c.name}) has a non-positive amount.`);
    }
    if (!Number.isInteger(c.startYear) || c.startYear < 1) {
      issues.push(`Cost line ${c.id} (${c.name}) has a start year that is not an integer of at least 1.`);
    }
    if (c.category === "recurring" && c.durationYears < 1) {
      issues.push(`Cost line ${c.id} (${c.name}) is recurring and must have a duration of at least 1 year.`);
    }
    if (!Number.isFinite(c.escalation)) {
      issues.push(`Cost line ${c.id} (${c.name}) has a non-finite escalation.`);
    }
  });
  const r = inp.repayment;
  if (!(r.termYears >= 0)) {
    issues.push("Repayment block has a term below 0 years.");
  }
  if (!(r.graceYears >= 0)) {
    issues.push("Repayment block has a grace period below 0 years.");
  }
  if ([1, 2, 4, 12].indexOf(r.paymentsPerYear) < 0) {
    issues.push("Repayment block has a payments-per-year that is not one of 1, 2, 4, 12.");
  }
  if (!Number.isFinite(r.paymentEscalation)) {
    issues.push("Repayment block has a non-finite payment escalation.");
  }
  if (!(r.balloon >= 0)) {
    issues.push("Repayment block has a balloon below 0.");
  }
  if (!(inp.targetIrr > -100)) {
    issues.push("Target IRR must be greater than -100.");
  }
  if (inp.appraisal) {
    const a = inp.appraisal;
    if (!(a.wacc > -100)) issues.push("WACC must be greater than -100.");
    if (!(a.financeRate > -100)) issues.push("Finance rate must be greater than -100.");
    if (!(a.reinvestmentRate > -100)) issues.push("Reinvestment rate must be greater than -100.");
    if (!(a.residual.amount >= 0)) issues.push("Residual amount must be at least 0.");
    if (a.residual.amount > 0 && (!Number.isInteger(a.residual.year) || a.residual.year < 1)) {
      issues.push("Residual year must be an integer of at least 1 when the residual amount is positive.");
    }
  }
  return issues;
}
