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
  const flatInputs: [string, string | number | boolean | null][] = [
    ["projectName", inputs.projectName],
    ["currency", inputs.currency],
    ["targetIrr", inputs.targetIrr],
    ["repayment.graceYears", inputs.repayment.graceYears],
    ["repayment.termYears", inputs.repayment.termYears],
    ["repayment.paymentsPerYear", inputs.repayment.paymentsPerYear],
    ["repayment.paymentEscalation", inputs.repayment.paymentEscalation],
    ["repayment.balloon", inputs.repayment.balloon],
    ["repayment.firstCollectionYear", inputs.repayment.firstCollectionYear ?? null],
  ];
  if (inputs.appraisal) {
    flatInputs.push(
      ["appraisal.wacc", inputs.appraisal.wacc],
      ["appraisal.financeRate", inputs.appraisal.financeRate],
      ["appraisal.reinvestmentRate", inputs.appraisal.reinvestmentRate],
      ["appraisal.residual.amount", inputs.appraisal.residual.amount],
      ["appraisal.residual.year", inputs.appraisal.residual.year],
    );
  }
  if (inputs.maintenance) {
    flatInputs.push(["maintenance.mode", inputs.maintenance.mode]);
    if (inputs.maintenance.mode === "percent") flatInputs.push(["maintenance.percentPerYear", inputs.maintenance.percentPerYear ?? null]);
    if (inputs.maintenance.mode === "fixed") flatInputs.push(["maintenance.fixedAnnualAmount", inputs.maintenance.fixedAnnualAmount ?? null]);
  }
  flatInputs.push(["operatingLines.count", (inputs.operatingLines ?? []).length]);
  if (inputs.tariff) {
    flatInputs.push(
      ["tariff.mode", inputs.tariff.mode],
      ["tariff.escalationPerYear", inputs.tariff.escalationPerYear],
      ["tariff.rowCount", inputs.tariff.rows.length],
      ["tariff.fixedAnnualAmount", inputs.tariff.fixedAnnualAmount],
      ["tariff.manualPricesCount", inputs.tariff.manualPrices === null ? null : inputs.tariff.manualPrices.length],
    );
  }
  if (inputs.financing) {
    flatInputs.push(
      ["financing.enabled", inputs.financing.enabled],
      ["financing.sharePct", inputs.financing.sharePct],
      ["financing.debtRatePct", inputs.financing.debtRatePct],
      ["financing.termYears", inputs.financing.termYears],
      ["financing.graceYears", inputs.financing.graceYears],
      ["financing.serviceStartYear", inputs.financing.serviceStartYear],
      ["financing.amortization", inputs.financing.amortization],
      ["financing.leveragedSolve", inputs.financing.leveragedSolve],
    );
  }
  if (inputs.contracts && inputs.contracts.length > 0) {
    for (const c of inputs.contracts) {
      flatInputs.push(
        [`contract ${c.id} label`, c.label],
        [`contract ${c.id} startYear`, c.startYear],
        [`contract ${c.id} termYears`, c.termYears],
        [`contract ${c.id} paymentsPerYear`, c.paymentsPerYear],
        [`contract ${c.id} graceYears`, c.graceYears],
        [`contract ${c.id} escalationPerYear`, c.escalationPerYear],
        [`contract ${c.id} balloon`, c.balloon],
        [`contract ${c.id} mode`, c.mode],
      );
      if (c.mode === "evaluated" && c.evaluatedPayment !== null && c.evaluatedPayment !== undefined) {
        flatInputs.push([`contract ${c.id} evaluatedPayment`, c.evaluatedPayment]);
      }
    }
  }
  for (const [k, v] of flatInputs) inputsWs.addRow([k, v]);
  width(inputsWs, 30);

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
  const metrics: [string, number | string | null, string][] = [
    ["totalCost", result.totalCost, "money"],
    ["costNpv", result.costNpv, "money"],
    ["paymentAmount", result.paymentAmount, "money"],
    ["paymentCount", result.paymentCount, "count"],
    ["totalCollected", result.totalCollected, "money"],
    ["netGain", result.netGain, "money"],
    ["npvAtTarget", result.npvAtTarget, "money"],
    ["npvAtWacc", result.npvAtWacc, "money"],
    ["npvCollectionsAtWacc", result.npvCollectionsAtWacc, "money"],
    ["npvCostsAtWacc", result.npvCostsAtWacc, "money"],
    ["profitabilityIndex", result.profitabilityIndex, "ratio"],
    ["paybackYears", result.paybackYears, "years"],
    ["discountedPaybackYears", result.discountedPaybackYears, "years"],
    ["mirr", result.mirr, "rate"],
    ["achievedIrr", result.achievedIrr, "rate"],
    ["goalMet", result.goalMet ? "true" : "false", "flag"],
    ["signChanges", result.signChanges, "count"],
    ["irrAmbiguous", result.irrAmbiguous ? "true" : "false", "flag"],
    ["leveragedSolve", result.leveragedSolve ? "true" : "false", "flag"],
    ["lastCostYear", result.lastCostYear, "count"],
    ["repaymentStartYear", result.repaymentStartYear, "count"],
    ["firstPaymentMonth", result.firstPaymentMonth, "count"],
    ["lastPaymentMonth", result.lastPaymentMonth, "count"],
    ["operatingTotal", result.operatingTotal, "money"],
    ["tariffBaseUnitPrice", result.tariffBaseUnitPrice, "money"],
    ["residualAmountUsed", result.residualAmountUsed ?? null, "money"],
  ];
  if (result.financing !== null) {
    const f = result.financing;
    metrics.push(
      ["financing.drawnTotal", f.drawnTotal, "money"],
      ["financing.idc", f.idc, "money"],
      ["financing.serviceStartBalance", f.serviceStartBalance, "money"],
      ["financing.serviceStartMonth", f.serviceStartMonth, "count"],
      ["financing.totalInterest", f.totalInterest, "money"],
      ["financing.totalService", f.totalService, "money"],
      ["financing.termMonths", f.termMonths, "count"],
      ["financing.graceMonths", f.graceMonths, "count"],
      ["financing.annuityPayment", f.annuityPayment, "money"],
      ["financing.principalPayment", f.principalPayment, "money"],
      ["financing.amortizationType", f.amortizationType, "flag"],
      ["financing.minDscrValue", f.minDscr === null ? null : f.minDscr.value, "ratio"],
      ["financing.minDscrYear", f.minDscr === null ? null : f.minDscr.year, "count"],
      ["equity.outlay", f.equity.outlay, "money"],
      ["equity.npvAtWacc", f.equity.npvAtWacc, "money"],
      ["equity.npvAtTarget", f.equity.npvAtTarget, "money"],
      ["equity.payback", f.equity.payback, "years"],
      ["equity.signChanges", f.equity.signChanges, "count"],
      ["equity.irr", f.equity.irr, "rate"],
      ["equity.irrAmbiguous", f.equity.irrAmbiguous ? "true" : "false", "flag"],
      ["equity.zeroOutlay", f.equity.zeroOutlay ? "true" : "false", "flag"],
    );
  }
  for (const [name, value, unit] of metrics) {
    const row = metricsWs.addRow([name, value === null ? null : value, unit]);
    const fmt = unit === "money" ? "#,##0.00" : unit === "rate" ? "0.00%" : unit === "years" || unit === "ratio" ? "0.00" : undefined;
    if (fmt) row.getCell(2).numFmt = fmt;
  }
  width(metricsWs, 26);

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
    const chargesHeader: (string | number)[] = ["Row", ...result.tariffYears.map((ty) => yearHeader(ty.year, opts.startYear))];
    tarWs.addRow([]);
    tarWs.addRow(chargesHeader);
    chargesHeader.slice(1).forEach((_, i) => { const c = tarWs.getRow(tarWs.rowCount).getCell(i + 2); bold(c); });
    for (const row of inputs.tariff?.rows ?? []) {
      const chargesRow: (string | number | null)[] = [row.label];
      for (const ty of result.tariffYears) {
        chargesRow.push(ty.perRowCharges?.[row.id] ?? null);
      }
      const added = tarWs.addRow(chargesRow);
      for (let i = 1; i < chargesRow.length; i++) added.getCell(i + 1).numFmt = "#,##0.00";
    }
    tarWs.getColumn(3).numFmt = "#,##0.00";
    tarWs.getColumn(4).numFmt = "#,##0.00";
    width(tarWs, 20);
  }

  if (result.operatingLines.length > 0 || (inputs.maintenance && inputs.maintenance.mode !== "off")) {
    const opWs = wb.addWorksheet("Operating lines");
    opWs.addRow(["Label", "Amount", "Start year", "Count", "Escalation", "Nominal span start", "Nominal span end", "Effective window start", "Effective window end", "Total"]);
    opWs.getRow(1).eachCell(bold);
    for (const o of result.operatingLines) {
      const configLine = (inputs.operatingLines ?? []).find((l) => l.id === o.id);
      opWs.addRow([
        o.label,
        configLine?.amount ?? null,
        configLine?.startYear ?? null,
        configLine?.yearCount ?? null,
        configLine?.escalation ?? null,
        o.nominalSpan[0], o.nominalSpan[1],
        o.effectiveWindow[0], o.effectiveWindow[1],
        o.total,
      ] as (string | number | null)[]);
    }
    if (inputs.maintenance && inputs.maintenance.mode !== "off") {
      const basis = inputs.maintenance.mode === "percent"
        ? `${inputs.maintenance.percentPerYear}% of total CAPEX`
        : "fixed annual amount";
      opWs.addRow([]);
      opWs.addRow(["Maintenance basis", basis]);
      opWs.addRow(["Operating total", result.operatingTotal]);
    }
    opWs.getColumn(10).numFmt = "#,##0.00";
    width(opWs, 22);
  }

  if (inputs.contracts && inputs.contracts.length > 0 && result.contractsInfo !== undefined) {
    const ctrWs = wb.addWorksheet("Contracts");
    ctrWs.addRow(["Contract", "Mode", "Start year", "Term (years)", "Payments per year", "Payment count", "End month", "Last collection month", "Reinvestments"]);
    ctrWs.getRow(1).eachCell(bold);
    for (const ci of result.contractsInfo) {
      const c = inputs.contracts?.find((x) => x.id === ci.id);
      ctrWs.addRow([ci.label, ci.mode, ci.startYear, ci.termYears, ci.paymentsPerYear, ci.paymentCount, ci.endMonth, ci.lastCollectionMonth, (c?.reinvestments ?? []).length]);
    }
    for (const c of inputs.contracts) {
      const ris = c.reinvestments ?? [];
      if (ris.length > 0) {
        ctrWs.addRow([]);
        ctrWs.addRow([`Reinvestments — ${c.label}`, "Year", "Amount"]);
        for (const ri of ris) {
          const row = ctrWs.addRow([`Reinvestment (${c.label})`, ri.year, ri.amount]);
          row.getCell(3).numFmt = "#,##0.00";
        }
      }
    }
    width(ctrWs, 24);
  }

  if (result.termPositions !== undefined && result.termPositions.length > 0) {
    const tpWs = wb.addWorksheet("Term positions");
    tpWs.addRow(["Position", "End month", "Truncated IRR", "Ambiguous", "Cumulative net", "NPV at WACC", "NPV at target", "Payback so far"]);
    tpWs.getRow(1).eachCell(bold);
    for (const tp of result.termPositions) {
      tpWs.addRow([`Project position at the end of ${tp.label}`, tp.endMonth, tp.truncatedIrr, tp.truncatedIrrAmbiguous ? "true" : "false", tp.cumulativeNet, tp.npvAtWacc, tp.npvAtTarget, tp.paybackSoFar]);
    }
    tpWs.getColumn(3).numFmt = "0.00%";
    for (const c of [5, 6, 7, 8]) tpWs.getColumn(c).numFmt = "#,##0.00";
    width(tpWs, 30);
  }

  const depreciationConfigured = inputs.costs.some((c) => c.depreciation !== undefined) || inputs.depreciationDefault !== undefined && inputs.depreciationDefault !== null;
  if (result.bookView !== undefined && depreciationConfigured) {
    const bv = result.bookView;
    const bvWs = wb.addWorksheet("Book view");
    bvWs.addRow(["Year", "Beginning book value", "Depreciation charge", "Ending book value", "Collections", "Operating", "Book result"]);
    bvWs.getRow(1).eachCell(bold);
    for (const row of bv.combined) {
      bvWs.addRow([row.year, row.beginning, row.charge, row.ending, row.collections, row.operating, row.bookResult]);
    }
    for (const c of [2, 3, 4, 5, 6, 7]) bvWs.getColumn(c).numFmt = "#,##0.00";
    bvWs.addRow([]);
    bvWs.addRow(["Book view disclosure", "Depreciation is the book view; it never enters the cash flows."]);
    bvWs.addRow(["Residual mode", bv.residualMode]);
    bvWs.addRow(["Remaining book value at residual year", bv.remainingBookValueAtResidualYear]);
    bvWs.addRow(["Set amount", bv.setAmount]);
    bvWs.addRow(["Gain or loss on sale", bv.gainOrLossOnSale]);
    for (const r of [bvWs.rowCount - 1, bvWs.rowCount]) bvWs.getRow(r).getCell(2).numFmt = "#,##0.00";
    width(bvWs, 28);
  }

  return wb.xlsx.writeBuffer();
}

export async function readWorkbook(buffer: ExcelJS.Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}
