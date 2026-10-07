import { describe, expect, it } from "vitest";
import templateFile from "../../data/template-project.json";
import { computeModel } from "../src/engine.js";
import type { CostLine, ModelInputs } from "../src/types.js";

function fromFile(file: typeof templateFile): ModelInputs {
  return {
    projectName: file.projectName,
    currency: file.currency,
    targetIrr: file.targetIrr,
    costs: file.costs.map((c) => ({
      ...c,
      category: c.category as CostLine["category"],
    })),
    repayment: file.repayment,
    appraisal: {
      wacc: file.appraisal.wacc,
      financeRate: file.appraisal.financeRate,
      reinvestmentRate: file.appraisal.reinvestmentRate,
      residual: { amount: file.appraisal.residual.amount, year: file.appraisal.residual.year },
    },
  };
}

const fileInputs = fromFile(templateFile);
const result = computeModel(fileInputs);

const inlineBaseline: ModelInputs = {
  projectName: "Project Alpha",
  currency: "EUR",
  targetIrr: 12,
  costs: [
    { id: "c1", name: "Development team", category: "recurring", amount: 1800000, startYear: 1, durationYears: 3, escalation: 3 },
    { id: "c2", name: "Infrastructure & licences", category: "recurring", amount: 600000, startYear: 1, durationYears: 3, escalation: 2 },
    { id: "c3", name: "Initial CAPEX", category: "capex", amount: 450000, startYear: 1, durationYears: 0, escalation: 0 },
  ],
  repayment: { graceYears: 0, termYears: 7, paymentsPerYear: 4, paymentEscalation: 0, balloon: 0 },
  appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } },
};

describe("Chunk 0.5: template project golden fixture", () => {
  it("scalar pins (12)", () => {
    expect(result.totalCost).toBe(7849860);
    expect(Math.abs(result.costNpv - 6632597.98344)).toBeLessThan(0.01);
    expect(Math.abs(result.paymentAmount - 475309.13407)).toBeLessThan(0.01);
    expect(result.paymentCount).toBe(28);
    expect(Math.abs(result.totalCollected - 13308655.75409)).toBeLessThan(0.01);
    expect(Math.abs(result.netGain - 5458795.75409)).toBeLessThan(0.01);
    expect(Math.abs((result.achievedIrr as number) - 0.12)).toBeLessThan(1e-9);
    expect(Math.abs((result.paybackYears as number) - 6.95961)).toBeLessThan(1e-4);
    expect(result.lastCostYear).toBe(3);
    expect(result.repaymentStartYear).toBe(3);
    expect(result.monthly.length).toBe(120);
    expect(result.signChanges).toBe(1);
    expect(result.irrAmbiguous).toBe(false);
  });

  it("line total pins (exact)", () => {
    expect(result.lineTotals[0].total).toBe(5563620);
    expect(result.lineTotals[1].total).toBe(1836240);
    expect(result.lineTotals[2].total).toBe(450000);
  });

  it("yearly table pins (cost, inflow, cumulative; money within 0.01)", () => {
    const y = result.yearly;
    expect(y[0].cost).toBe(2850000);
    expect(y[0].inflow).toBe(0);
    expect(Math.abs(y[0].cumulative - -2850000)).toBeLessThan(0.01);

    expect(y[1].cost).toBe(2466000);
    expect(y[1].inflow).toBe(0);
    expect(Math.abs(y[1].cumulative - -5316000)).toBeLessThan(0.01);

    expect(y[2].cost).toBe(2533860);
    expect(Math.abs(y[2].inflow - 475309.13407)).toBeLessThan(0.01);
    expect(Math.abs(y[2].cumulative - -7374550.86593)).toBeLessThan(0.01);

    for (const idx of [3, 4, 5, 6, 7, 8]) {
      expect(y[idx].cost).toBe(0);
      expect(Math.abs(y[idx].inflow - 1901236.5363)).toBeLessThan(0.01);
    }
    expect(Math.abs(y[3].cumulative - -5473314.32963)).toBeLessThan(0.01);
    expect(Math.abs(y[4].cumulative - -3572077.79333)).toBeLessThan(0.01);
    expect(Math.abs(y[5].cumulative - -1670841.25703)).toBeLessThan(0.01);
    expect(Math.abs(y[6].cumulative - 230395.27927)).toBeLessThan(0.01);
    expect(Math.abs(y[7].cumulative - 2131631.81557)).toBeLessThan(0.01);
    expect(Math.abs(y[8].cumulative - 4032868.35187)).toBeLessThan(0.01);

    expect(y[9].cost).toBe(0);
    expect(Math.abs(y[9].inflow - 1425927.40222)).toBeLessThan(0.01);
    expect(Math.abs(y[9].cumulative - 5458795.75409)).toBeLessThan(0.01);
  });

  it("monthly checkpoint pins", () => {
    const m = result.monthly;
    expect(m[0].cost).toBe(200000);
    expect(m[11].cost).toBe(650000);
    expect(m[11].inflow).toBe(0);
    expect(m[35].cost).toBe(211155);
    expect(Math.abs(m[35].inflow - 475309.13407)).toBeLessThan(0.01);
    expect(m[36].inflow).toBe(0);
    expect(m[119].inflow).toBe(0);
    expect(Math.abs(m[119].cumulative - 5458795.75409)).toBeLessThan(0.01);
  });

  it("appraisal pins on the template file (schema v2)", () => {
    expect(Math.abs(result.npvAtWacc - 1252822.99465)).toBeLessThan(0.01);
    expect(Math.abs((result.profitabilityIndex as number) - 1.17913)).toBeLessThan(1e-4);
    expect(Math.abs((result.mirr as number) - 0.08756864)).toBeLessThan(1e-6);
    expect(Math.abs((result.discountedPaybackYears as number) - 8.47094)).toBeLessThan(1e-4);
    expect(result.goalMet).toBe(true);
  });

  it("file-model identity: the file and the inline anchor are the same model", () => {
    const inlineResult = computeModel(inlineBaseline);
    expect(JSON.stringify(result)).toBe(JSON.stringify(inlineResult));
  });
});
