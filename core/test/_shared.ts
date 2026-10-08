import type { ModelInputs } from "../src/types.js";

export function templateLike(): ModelInputs {
  return {
    projectName: "Project Alpha",
    currency: "EUR",
    targetIrr: 12,
    costs: [
      { id: "c1", name: "Development team", category: "recurring", amount: 1800000, startYear: 1, durationYears: 3, escalation: 3 },
      { id: "c2", name: "Infrastructure & licences", category: "recurring", amount: 600000, startYear: 1, durationYears: 3, escalation: 2 },
      { id: "c3", name: "Initial CAPEX", category: "capex", amount: 450000, startYear: 1, durationYears: 0, escalation: 0 },
    ],
    repayment: { graceYears: 0, termYears: 7, paymentsPerYear: 4, paymentEscalation: 0, balloon: 0, firstCollectionYear: null },
    appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } },
    operatingLines: [],
    maintenance: { mode: "off" },
    tariff: { mode: "off", escalationPerYear: 2, rows: [], fixedAnnualAmount: null, manualPrices: null },
  };
}

export function appraisal(wacc = 8, financeRate = 6, reinvestmentRate = 6, amount = 0, year = 10) {
  return { wacc, financeRate, reinvestmentRate, residual: { amount, year } };
}
import templateFile from "../../data/template-project.json";

export function assertTemplateIdentity(): void {
  const inline = JSON.stringify(templateLike());
  const canonical = JSON.stringify({
    projectName: templateFile.projectName,
    currency: templateFile.currency,
    targetIrr: templateFile.targetIrr,
    costs: templateFile.costs,
    repayment: templateFile.repayment,
    appraisal: templateFile.appraisal,
    operatingLines: templateFile.operatingLines,
    maintenance: templateFile.maintenance,
    tariff: templateFile.tariff,
  });
  if (inline !== canonical) {
    throw new Error("The inline template copy in test/_shared.ts has drifted from data/template-project.json.");
  }
}
