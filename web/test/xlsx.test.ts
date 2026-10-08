import { describe, expect, it } from "vitest";
import { buildWorkbook, readWorkbook } from "../src/xlsx.js";
import { computeModel } from "../src/engine.js";
import { demoProject } from "../src/state.js";
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
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Inputs", "Cost lines", "Repayment", "Metrics"]);
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
