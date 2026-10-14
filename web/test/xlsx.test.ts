import { describe, expect, it } from "vitest";
import { buildWorkbook, readWorkbook } from "../src/xlsx.js";
import { computeModel } from "../src/engine.js";
import { demoProject, shorePowerProgram } from "../src/state.js";
import type { FinancingConfig, TariffRow } from "../../core/src/types.js";

const rows: TariffRow[] = [
  { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] },
  { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] },
];
const fin = (over: Partial<FinancingConfig> = {}): FinancingConfig => ({
  enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0,
  serviceStartYear: null, amortization: "annuity", leveragedSolve: false, perLineSharePct: {}, ...over,
});

describe("EX-3 XLSX round-trip (base demo)", () => {
  const result = computeModel(demoProject());

  it("sheet inventory and Repayment row count", async () => {
    const buffer = await buildWorkbook(demoProject(), result);
    const wb = await readWorkbook(buffer);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Inputs", "Cost lines", "Repayment", "Collections schedule", "Metrics"]);
    const repay = wb.getWorksheet("Repayment") as { rowCount: number };
    expect(repay.rowCount).toBe(11);
  });

  it("cells carry the unrounded engine values exactly (equality, not tolerance)", async () => {
    const buffer = await buildWorkbook(demoProject(), result);
    const wb = await readWorkbook(buffer);
    const metrics = wb.getWorksheet("Metrics") as { getRow: (n: number) => { getCell: (n: number) => { value: unknown } } };
    const findMetric = (name: string): unknown => {
      for (let r = 2; r <= 16; r++) {
        const row = metrics.getRow(r);
        if (row.getCell(1).value === name) return row.getCell(2).value;
      }
      return undefined;
    };
    expect(findMetric("paymentAmount")).toBe(result.paymentAmount);
    expect(findMetric("totalCollected")).toBe(result.totalCollected);
    expect(findMetric("achievedIrr")).toBe(result.achievedIrr);
    expect(findMetric("costNpv")).toBe(result.costNpv);
    expect(findMetric("paybackYears")).toBe(result.paybackYears);
  });
});

describe("EX-3 financing-on adds the Financing sheet", () => {
  it("the sheet exists with the equity outlay and DSCR rows", async () => {
    const inputs = { ...demoProject(), financing: fin() };
    const result = computeModel(inputs);
    const buffer = await buildWorkbook(inputs, result);
    const wb = await readWorkbook(buffer);
    const names = wb.worksheets.map((ws) => ws.name);
    expect(names).toContain("Financing");
    const finWs = wb.getWorksheet("Financing") as { getRow: (n: number) => { getCell: (n: number) => { value: unknown } }; rowCount: number };
    let foundOutlay = false;
    let foundDscr = false;
    for (let r = 2; r <= finWs.rowCount; r++) {
      const label = finWs.getRow(r).getCell(1).value;
      if (label === "Equity outlay") {
        foundOutlay = true;
        expect(finWs.getRow(r).getCell(2).value).toBe(result.financing?.equity.outlay);
      }
      if (r <= 8) {
        const dscrVal = finWs.getRow(r).getCell(5).value;
        if (typeof dscrVal === "number") foundDscr = true;
      }
    }
    expect(foundOutlay).toBe(true);
    expect(foundDscr).toBe(true);
  });
});

describe("EX-3 stable tariff adds the Tariff sheet", () => {
  it("the sheet exists with grid-year rows", async () => {
    const inputs = { ...demoProject(), tariff: { mode: "stable" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } };
    const result = computeModel(inputs);
    const buffer = await buildWorkbook(inputs, result);
    const wb = await readWorkbook(buffer);
    expect(wb.worksheets.map((ws) => ws.name)).toContain("Tariff");
    const tarWs = wb.getWorksheet("Tariff") as { getRow: (n: number) => { getCell: (n: number) => { value: unknown } } };
    expect(tarWs.getRow(2).getCell(1).value).toBe(3);
    expect(tarWs.getRow(2).getCell(2).value).toBe(700);
  });
});

describe("EX-3 v0.6.10 funding block adds the Funding sheet and the funding metrics (program fixture, raw audit route)", () => {
  it("the Funding sheet carries the kinds, years, and loan terms raw (Task G.4)", async () => {
    const inputs = shorePowerProgram();
    const result = computeModel(inputs);
    const buffer = await buildWorkbook(inputs, result);
    const wb = await readWorkbook(buffer);
    expect(wb.worksheets.map((ws) => ws.name)).toContain("Funding");
    const fWs = wb.getWorksheet("Funding") as { getRow: (n: number) => { getCell: (n: number) => { value: unknown } }; rowCount: number };
    // header + the four funding rows (g1, g2, g3, l1 — scratch-verified against the workbook).
    expect(fWs.rowCount).toBe(5);
    expect(fWs.getRow(1).getCell(1).value).toBe("Label");
    expect(fWs.getRow(1).getCell(2).value).toBe("Kind");
    expect(fWs.getRow(1).getCell(3).value).toBe("Amount");
    expect(fWs.getRow(1).getCell(4).value).toBe("Year");
    expect(fWs.getRow(1).getCell(5).value).toBe("Term years");
    expect(fWs.getRow(1).getCell(6).value).toBe("Repayment start");
    expect(fWs.getRow(2).getCell(1).value).toBe("AFIF grant (EU)");
    expect(fWs.getRow(2).getCell(2).value).toBe("grant");
    expect(fWs.getRow(2).getCell(3).value).toBe(70000000);
    expect(fWs.getRow(2).getCell(4).value).toBe(3);
    expect(fWs.getRow(2).getCell(5).value).toBeNull();
    expect(fWs.getRow(2).getCell(6).value).toBeNull();
    expect(fWs.getRow(3).getCell(1).value).toBe("National shore-power grant");
    expect(fWs.getRow(3).getCell(2).value).toBe("grant");
    expect(fWs.getRow(3).getCell(3).value).toBe(100000000);
    expect(fWs.getRow(3).getCell(4).value).toBe(5);
    expect(fWs.getRow(4).getCell(1).value).toBe("Province & municipality grant");
    expect(fWs.getRow(4).getCell(2).value).toBe("grant");
    expect(fWs.getRow(4).getCell(3).value).toBe(3500000);
    expect(fWs.getRow(4).getCell(4).value).toBe(1);
    expect(fWs.getRow(5).getCell(1).value).toBe("Municipality interest-free note");
    expect(fWs.getRow(5).getCell(2).value).toBe("interest-free-loan");
    expect(fWs.getRow(5).getCell(3).value).toBe(10000000);
    expect(fWs.getRow(5).getCell(4).value).toBe(1);
    expect(fWs.getRow(5).getCell(5).value).toBe(10);
    expect(fWs.getRow(5).getCell(6).value).toBe(4);
  });

  it("the Metrics sheet gains grantsTotal and fundingNpv raw cells (Task G.4)", async () => {
    const inputs = shorePowerProgram();
    const result = computeModel(inputs);
    const buffer = await buildWorkbook(inputs, result);
    const wb = await readWorkbook(buffer);
    const metrics = wb.getWorksheet("Metrics") as { getRow: (n: number) => { getCell: (n: number) => { value: unknown } }; rowCount: number };
    const findMetric = (name: string): { row: number; value: unknown } | null => {
      for (let r = 2; r <= metrics.rowCount; r++) {
        if (metrics.getRow(r).getCell(1).value === name) return { row: r, value: metrics.getRow(r).getCell(2).value };
      }
      return null;
    };
    expect(result.fundingView).not.toBeNull();
    const grants = findMetric("funding.grantsTotal");
    const npv = findMetric("funding.fundingNpv");
    expect(grants).not.toBeNull();
    expect(npv).not.toBeNull();
    expect(grants?.value).toBe(result.fundingView?.grantsTotal);
    expect(npv?.value).toBe(result.fundingView?.fundingNpv);
    // the verified pins of record (equality, not tolerance)
    expect(grants?.value).toBe(173500000);
    expect(npv?.value).toBe(140055345.14230645);
    // the funding rows precede the financing rows (the push order of the metrics array)
    const fin = findMetric("financing.drawnTotal");
    expect(fin).not.toBeNull();
    expect((grants?.row ?? 0) < (fin?.row ?? 0)).toBe(true);
    expect((npv?.row ?? 0) < (fin?.row ?? 0)).toBe(true);
  });

  it("the Collections schedule sheet carries the new grid kinds (tariff, grant, funding-loan)", async () => {
    const inputs = shorePowerProgram();
    const result = computeModel(inputs);
    const buffer = await buildWorkbook(inputs, result);
    const wb = await readWorkbook(buffer);
    const cgWs = wb.getWorksheet("Collections schedule") as { getRow: (n: number) => { getCell: (n: number) => { value: unknown } }; rowCount: number };
    expect(cgWs.rowCount).toBe(9); // header + eight grid rows (scratch-verified)
    const kinds: unknown[] = [];
    for (let r = 2; r <= cgWs.rowCount; r++) kinds.push(cgWs.getRow(r).getCell(3).value);
    expect(kinds).toEqual(["tariff", "tariff", "tariff", "tariff", "grant", "grant", "grant", "funding-loan"]);
    // the interest-free loan row nets to zero (the honest net-zero loan row of record)
    expect(cgWs.getRow(9).getCell(1).value).toBe("l1");
    expect(cgWs.getRow(9).getCell(4).value).toBe(0);
    // the grant rows carry their raw amounts
    expect(cgWs.getRow(6).getCell(4).value).toBe(70000000);
    expect(cgWs.getRow(7).getCell(4).value).toBe(100000000);
    expect(cgWs.getRow(8).getCell(4).value).toBe(3500000);
  });
});
