import ExcelJS from "exceljs";
import type { ModelInputs, ModelResult } from "../../core/src/types.js";
import { yearHeader } from "./state.js";

export async function buildWorkbook(
  inputs: ModelInputs,
  result: ModelResult,
  opts: { startYear: number | null } = { startYear: null },
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const bold = (cell: ExcelJS.Cell | undefined) => {
    if (cell && cell.font !== undefined) {
      (cell.font as { bold?: boolean }).bold = true;
    } else if (cell) {
      cell.font = { bold: true } as unknown as ExcelJS.Font;
    }
  };
  const width = (ws: ExcelJS.Worksheet, n: number) => { ws.columns.forEach((c) => { c.width = n; }); };

  const inputsWs = wb.addWorksheet("Inputs");
  inputsWs.addRow(["Item", "Value"]);
  bold(inputsWs.getRow(1).getCell(1));
  bold(inputsWs.getRow(1).getCell(2));
  inputsWs.addRow(["Project name", inputs.projectName]);
  inputsWs.addRow(["Currency", inputs.currency]);
  inputsWs.addRow(["Target IRR (%)", inputs.targetIrr]);
  inputsWs.addRow(["Payments per year", inputs.repayment.paymentsPerYear]);
  inputsWs.addRow(["Term (years)", inputs.repayment.termYears]);
  width(inputsWs, 24);

  const costsWs = wb.addWorksheet("Cost lines");
  costsWs.addRow(["Category", "Name", "Amount", "Start year", "Duration", "Escalation", "Nominal total"]);
  costsWs.getRow(1).eachCell(bold);
  for (const c of inputs.costs) {
    const total = result.lineTotals.find((l) => l.id === c.id)?.total ?? 0;
    costsWs.addRow([c.category, c.name, c.amount, c.startYear, c.durationYears, c.escalation, total]);
  }
  for (const c of [2, 3, 4, 5, 6, 7]) { (costsWs.getColumn(c) as { width?: number }).width = 16; }
  (costsWs.getColumn(3) as { width?: number }).width = 16;
  costsWs.getColumn(3).numFmt = "#,##0.00";
  costsWs.getColumn(7).numFmt = "#,##0.00";
  width(costsWs, 18);

  const repayWs = wb.addWorksheet("Repayment");
  repayWs.addRow(["Model year", "Calendar label", "Required collection", "Cumulative"]);
  repayWs.getRow(1).eachCell(bold);
  for (const y of result.yearly) {
    const cumulativeAtYearEnd = result.monthly.filter((m) => m.year === y.year)[result.monthly.filter((m) => m.year === y.year).length - 1]?.cumulative ?? 0;
    repayWs.addRow([y.year, yearHeader(y.year, opts.startYear), y.inflow, cumulativeAtYearEnd]);
  }
  repayWs.getColumn(3).numFmt = "#,##0.00";
  repayWs.getColumn(4).numFmt = "#,##0.00";
  width(repayWs, 20);

  const metricsWs = wb.addWorksheet("Metrics");
  metricsWs.addRow(["Metric", "Value", "Unit"]);
  metricsWs.getRow(1).eachCell(bold);
  const metrics: [string, number | string | null, string, string?][] = [
    ["paymentAmount", result.paymentAmount, "money"],
    ["totalCollected", result.totalCollected, "money"],
    ["totalCost", result.totalCost, "money"],
    ["netGain", result.netGain, "money"],
    ["costNpv", result.costNpv, "money"],
    ["npvAtWacc", result.npvAtWacc, "money"],
    ["npvAtTarget", result.npvAtTarget, "money"],
    ["achievedIrr", result.achievedIrr, "rate"],
    ["paybackYears", result.paybackYears, "years"],
    ["discountedPaybackYears", result.discountedPaybackYears, "years"],
    ["mirr", result.mirr, "rate"],
    ["profitabilityIndex", result.profitabilityIndex, "ratio"],
    ["signChanges", result.signChanges, "count"],
    ["goalMet", result.goalMet ? "true" : "false", "flag"],
    ["paymentCount", result.paymentCount, "count"],
  ];
  for (const [name, value, unit] of metrics) {
    metricsWs.addRow([name, value, unit]);
  }
  metricsWs.getColumn(2).numFmt = "#,##0.00";
  width(metricsWs, 24);

  if (result.financing !== null) {
    const finWs = wb.addWorksheet("Financing");
    finWs.addRow(["Year", "Interest", "Principal", "Service", "DSCR"]);
    finWs.getRow(1).eachCell(bold);
    for (const y of result.financing.yearly) {
      const dscrRow = result.financing?.dscr.find((d) => d.year === y.year);
      finWs.addRow([y.year, y.interest, y.principal, y.service, dscrRow?.dscr ?? null]);
    }
    finWs.addRow([]);
    finWs.addRow(["Equity outlay", result.financing.equity.outlay, "money"]);
    finWs.addRow(["Equity NPV at WACC", result.financing.equity.npvAtWacc, "money"]);
    finWs.addRow(["Equity IRR", result.financing.equity.irr, "rate"]);
    for (const c of [2, 3, 4]) finWs.getColumn(c).numFmt = "#,##0.00";
    finWs.getColumn(5).numFmt = "0.00";
    width(finWs, 20);
  }

  if (result.tariffYears.length > 0) {
    const tarWs = wb.addWorksheet("Tariff");
    tarWs.addRow(["Grid year", "Weighted volume", "Unit price", "Revenue"]);
    tarWs.getRow(1).eachCell(bold);
    for (const ty of result.tariffYears) {
      tarWs.addRow([ty.year, ty.weightedVolume, ty.unitPrice ?? null, ty.revenue]);
    }
    const firstCharges = result.tariffYears[0]?.perRowCharges;
    if (firstCharges) {
      tarWs.addRow([]);
      tarWs.addRow(["Per-row charges (first grid year)"]);
      for (const row of inputs.tariff?.rows ?? []) {
        tarWs.addRow([row.label, firstCharges[row.id]]);
      }
    }
    tarWs.getColumn(3).numFmt = "#,##0.00";
    tarWs.getColumn(4).numFmt = "#,##0.00";
    width(tarWs, 20);
  }

  return wb.xlsx.writeBuffer();
}

export async function readWorkbook(buffer: ExcelJS.Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}
