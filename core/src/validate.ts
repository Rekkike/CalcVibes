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
  if (inp.repayment.firstCollectionYear !== null && inp.repayment.firstCollectionYear !== undefined) {
    if (!Number.isInteger(inp.repayment.firstCollectionYear) || (inp.repayment.firstCollectionYear as number) < 1) {
      issues.push("First collection year must be an integer of at least 1.");
    } else if (inp.repayment.graceYears > 0) {
      issues.push("The first-collection-year override replaces the derived start; grace must be zero when the override is set.");
    }
  }
  if (inp.operatingLines) {
    inp.operatingLines.forEach((o) => {
      if (!o.label || o.label.trim() === "") issues.push(`Operating line ${o.id} has an empty label.`);
      if (!(o.amount > 0)) issues.push(`Operating line ${o.id} (${o.label}) has a non-positive amount.`);
      if (!Number.isInteger(o.startYear) || o.startYear < 1) issues.push(`Operating line ${o.id} (${o.label}) has a start year that is not an integer of at least 1.`);
      if (!Number.isInteger(o.yearCount) || o.yearCount < 1) issues.push(`Operating line ${o.id} (${o.label}) has a year count that is not an integer of at least 1.`);
      if (!Number.isFinite(o.escalation)) issues.push(`Operating line ${o.id} (${o.label}) has a non-finite escalation.`);
    });
  }
  if (inp.maintenance && inp.maintenance.mode !== "off") {
    const m = inp.maintenance;
    if (m.mode === "percent" && (m.percentPerYear ?? 0) < 0) issues.push("Maintenance percent per year must be at least 0.");
    if (m.mode === "fixed" && (m.fixedAnnualAmount ?? 0) < 0) issues.push("Maintenance fixed annual amount must be at least 0.");
    if (m.mode !== "percent" && m.mode !== "fixed") {
      issues.push("Maintenance must have exactly one active mode: percent or fixed.");
    }
  }
  if (inp.tariff && inp.tariff.mode !== "off") {
    const t = inp.tariff;
    t.rows.forEach((row) => {
      if (!row.label || row.label.trim() === "") issues.push(`Tariff row ${row.id} has an empty descriptor.`);
      if (!(row.weight > 0)) issues.push(`Tariff row ${row.id} (${row.label}) has a weight at or below 0.`);
      row.lifts.forEach((l, i) => {
        if (!Number.isInteger(l) || l < 0) issues.push(`Tariff row ${row.id} (${row.label}) has a non-integer or negative lift count at column ${i + 1}.`);
      });
    });
    if (t.mode === "stable" && !Number.isFinite(t.escalationPerYear)) {
      issues.push("Tariff escalation per year must be finite.");
    }
    if (t.mode === "fixed" && (t.fixedAnnualAmount === null || t.fixedAnnualAmount < 0)) {
      issues.push("Fixed annual amount must be a non-negative number in fixed mode.");
    }
    if (t.mode === "manual") {
      if (t.manualPrices === null) {
        issues.push("Manual prices are required in manual mode.");
      } else {
        const gridCount = t.rows.length > 0 ? Math.max(...t.rows.map((r) => r.lifts.length)) : 0;
        if (t.manualPrices.length !== gridCount) {
          issues.push(`Manual prices count (${t.manualPrices.length}) must equal the grid column count (${gridCount}).`);
        }
        t.manualPrices.forEach((p, i) => {
          if (!Number.isFinite(p) || p < 0) {
            issues.push(`Manual price at column ${i + 1} must be a finite non-negative number.`);
          }
        });
      }
    }
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
