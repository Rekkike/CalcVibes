import { describe, expect, it } from "vitest";
import { buildWorkbook, readWorkbook } from "../src/xlsx.js";
import { computeModel } from "../src/engine.js";
import { demoProject } from "../src/state.js";
import type { FinancingConfig, ModelInputs, ModelResult, TariffRow } from "../../core/src/types.js";

const rows: TariffRow[] = [
  { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] },
  { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] },
];
const fin = (over: Partial<FinancingConfig> = {}): FinancingConfig => ({
  enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0,
  serviceStartYear: null, amortization: "annuity", leveragedSolve: false, perLineSharePct: {}, ...over,
});

type Ws = { getRow: (n: number) => { getCell: (n: number) => { value: unknown; numFmt?: string } }; rowCount: number; name: string };

async function sheetMap(buffer: Awaited<ReturnType<typeof buildWorkbook>>): Promise<Map<string, Ws>> {
  const wb = await readWorkbook(buffer);
  const map = new Map<string, Ws>();
  for (const ws of wb.worksheets) {
    map.set(ws.name, ws as unknown as Ws);
  }
  return map;
}

function rowValues(ws: Ws): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const key = ws.getRow(r).getCell(1).value;
    if (typeof key === "string") m.set(key, ws.getRow(r).getCell(2).value);
  }
  return m;
}

function scalarLeaves(obj: unknown, prefix = ""): Map<string, string | number | boolean | null> {
  const out = new Map<string, string | number | boolean | null>();
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) out.set(path, v === undefined ? null : v);
    else if (typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of scalarLeaves(v, path)) out.set(k2, v2);
    } else if (Array.isArray(v)) {
      // arrays summarized by count, except perLineSharePct/rows enumerated separately
      out.set(`${path}Count`, v.length);
    } else {
      out.set(path, v as string | number | boolean);
    }
  }
  return out;
}

describe("D-1: Inputs identity — one row per scalar leaf of the configured ModelInputs", () => {
  it("base demo", async () => {
    const inputs = demoProject();
    const result = computeModel(inputs);
    const map = await sheetMap(await buildWorkbook(inputs, result));
    const inputsRows = rowValues(map.get("Inputs") as Ws);
    for (const [key, value] of scalarLeaves(inputs, "")) {
      if (key === "costsCount" || key === "settings") continue;
      expect(inputsRows.has(key) || inputsRows.has(key.replace("Count", ".count"))).toBe(true);
      if (typeof value !== "object") {
        const actual = inputsRows.get(key) ?? inputsRows.get(key.replace("Count", ".count"));
        expect(actual).toBe(value);
      }
    }
    expect(inputsRows.get("repayment.firstCollectionYear")).toBe(null);
  });

  it("financing-on variant carries the financing block summary", async () => {
    const inputs = { ...demoProject(), financing: fin() };
    const result = computeModel(inputs);
    const map = await sheetMap(await buildWorkbook(inputs, result));
    const inputsRows = rowValues(map.get("Inputs") as Ws);
    expect(inputsRows.get("financing.enabled")).toBe(true);
    expect(inputsRows.get("financing.sharePct")).toBe(60);
    expect(inputsRows.get("financing.debtRatePct")).toBe(6);
    expect(inputsRows.get("financing.serviceStartYear")).toBe(null);
  });
});

describe("D-2: Metrics identity — one row per top-level scalar of ModelResult; financing and equity sets when on", () => {
  it("base demo", async () => {
    const inputs = demoProject();
    const result = computeModel(inputs);
    const map = await sheetMap(await buildWorkbook(inputs, result));
    const metricsRows = rowValues(map.get("Metrics") as Ws);
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
        expect(metricsRows.has(key)).toBe(true);
      }
      if (typeof value === "number") {
        expect(metricsRows.get(key)).toBe(value);
      }
    }
    // previously absent metrics now present
    for (const key of ["firstPaymentMonth", "lastPaymentMonth", "lastCostYear", "repaymentStartYear", "npvCollectionsAtWacc", "npvCostsAtWacc", "operatingTotal", "leveragedSolve", "irrAmbiguous"]) {
      expect(metricsRows.has(key)).toBe(true);
    }
    expect(metricsRows.get("tariffBaseUnitPrice")).toBe(null);
  });

  it("financing-on variant: financing scalars and the complete equity set", async () => {
    const inputs = { ...demoProject(), financing: fin() };
    const result = computeModel(inputs);
    const map = await sheetMap(await buildWorkbook(inputs, result));
    const metricsRows = rowValues(map.get("Metrics") as Ws);
    const f = result.financing as NonNullable<ModelResult["financing"]>;
    for (const [key, value] of [
      ["financing.drawnTotal", f.drawnTotal],
      ["financing.idc", f.idc],
      ["financing.serviceStartBalance", f.serviceStartBalance],
      ["financing.serviceStartMonth", f.serviceStartMonth],
      ["financing.totalInterest", f.totalInterest],
      ["financing.totalService", f.totalService],
      ["financing.amortizationType", f.amortizationType],
      ["financing.minDscrValue", f.minDscr?.value],
      ["financing.minDscrYear", f.minDscr?.year],
      ["equity.outlay", f.equity.outlay],
      ["equity.npvAtWacc", f.equity.npvAtWacc],
      ["equity.npvAtTarget", f.equity.npvAtTarget],
      ["equity.payback", f.equity.payback],
      ["equity.signChanges", f.equity.signChanges],
      ["equity.irr", f.equity.irr],
      ["equity.irrAmbiguous", "true"],
      ["equity.zeroOutlay", "false"],
    ] as [string, number | string][]) {
      expect(metricsRows.get(key)).toBe(value);
    }
  });
});

describe("D-3: number formats per unit", () => {
  it("rate rows carry 0.00%, money rows #,##0.00, ratio rows 0.00; cells unrounded", async () => {
    const inputs = demoProject();
    const result = computeModel(inputs);
    const map = await sheetMap(await buildWorkbook(inputs, result));
    const metrics = map.get("Metrics") as Ws;
    let fmtOf: string | undefined;
    for (let r = 2; r <= metrics.rowCount; r++) {
      const name = metrics.getRow(r).getCell(1).value;
      const fmt = metrics.getRow(r).getCell(2).numFmt;
      if (name === "achievedIrr" || name === "mirr") expect(fmt).toBe("0.00%");
      if (name === "totalCollected") { expect(fmt).toBe("#,##0.00"); fmtOf = fmt; }
      if (name === "paybackYears" || name === "profitabilityIndex") expect(fmt).toBe("0.00");
    }
    expect(fmtOf).toBe("#,##0.00");
  });
});

describe("D-4/D-5: tariff charges block and operating lines sheet", () => {
  it("the tariff charges block is rows-by-years with model-year labels", async () => {
    const inputs = { ...demoProject(), tariff: { mode: "stable" as const, escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null } } as ModelInputs;
    const result = computeModel(inputs);
    const map = await sheetMap(await buildWorkbook(inputs, result));
    const tar = map.get("Tariff") as Ws;
    let foundHeader = false;
    for (let r = 2; r <= tar.rowCount; r++) {
      if (tar.getRow(r).getCell(1).value === "Row") { foundHeader = true; }
    }
    expect(foundHeader).toBe(true);
    // the two data rows carry 8 year columns each
    let dataRows = 0;
    for (let r = 2; r <= tar.rowCount; r++) {
      const label = tar.getRow(r).getCell(1).value;
      if (label === "Loaded 20-ft" || label === "Loaded 40-ft") {
        dataRows++;
        expect(tar.getRow(r).getCell(9).value).not.toBeNull();
      }
    }
    expect(dataRows).toBe(2);
  });

  it("the Operating lines sheet renders with maintenance and operating lines configured", async () => {
    const inputs = { ...demoProject(), maintenance: { mode: "percent" as const, percentPerYear: 0.5 }, operatingLines: [{ id: "o1", label: "Rent", amount: 120000, startYear: 3, yearCount: 8, escalation: 0 }] } as ModelInputs;
    const result = computeModel(inputs);
    const map = await sheetMap(await buildWorkbook(inputs, result));
    const op = map.get("Operating lines") as Ws;
    expect(op).toBeTruthy();
    let foundWindow = false;
    for (let r = 2; r <= op.rowCount; r++) {
      if (op.getRow(r).getCell(8).value === 36) foundWindow = true;
    }
    expect(foundWindow).toBe(true);
    const rowsMap = rowValues(op);
    expect(rowsMap.get("Maintenance basis")).toBe("0.5% of total CAPEX");
    expect(rowsMap.get("Operating total")).toBe(result.operatingTotal);
  });
});
