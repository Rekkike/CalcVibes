import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook } from "../src/xlsx.js";
import { computeModel } from "../src/engine.js";
import { demoProject, migrateOnLoad, shorePowerProgram } from "../src/state.js";
import { restoreLegacyFinancing } from "../../core/src/financing.js";
import type { Facility, ModelInputs } from "../../core/src/types.js";

// v0.6.21 Task F (the Round 102 deviation-3 ruling) — the per-facility audit rows in the XLSX
// Inputs-sheet echo: the legacy-shaped echo stands, and the facility list is appended as audit rows
// (each facility's amount, rate, term, grace, and draw scope), so amount-first facilities appear in
// the echo honestly. The XLSX export otherwise stays raw.

const capexOf = (): string => demoProject().costs.find((c) => c.category === "capex")!.id;

const readWorkbook = async (buf: ExcelJS.Buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ArrayBuffer);
  return wb;
};

const inputsItems = (wb: ExcelJS.Workbook): Map<string, unknown> => {
  const items = new Map<string, unknown>();
  wb.getWorksheet("Inputs")!.eachRow((row) => items.set(String(row.getCell(1).value), row.getCell(2).value));
  return items;
};

const authored = (): ModelInputs => {
  const base = demoProject();
  const capex = base.costs.find((c) => c.category === "capex")!.id;
  const facilities: Facility[] = [
    { id: "fac1", label: "Bank loan", amount: 3000000, ratePct: 5, termYears: 8, graceYears: 1, amortization: "annuity", serviceStartYear: null, scope: { kind: "general" }, origin: "financing" },
    { id: "fac2", label: "Equipment loan", amount: 400000, ratePct: 4, termYears: 5, graceYears: 0, amortization: "equal-principal", serviceStartYear: null, scope: { kind: "attached", lineIds: [capex] }, origin: "financing" },
  ];
  return { ...base, facilities };
};

describe("v0.6.21 Task F — the per-facility audit rows in the XLSX Inputs-sheet echo", () => {
  it("AUDIT-ROWS: the amount-first two-facility project appends each facility's amount, rate, term, grace and draw scope as raw audit rows", async () => {
    const inp = authored();
    const r = computeModel(inp);
    const wb = await readWorkbook(await buildWorkbook(restoreLegacyFinancing(inp), r, { startYear: null, facilities: inp.facilities }));
    const items = inputsItems(wb);
    // the legacy-shaped echo stands
    expect(items.get("facility fac1 label")).toBe("Bank loan");
    expect(items.get("facility fac1 amount")).toBe(3000000);
    // the audit rows: the full facility list, raw values
    expect(items.get("facilityAudit fac1 label")).toBe("Bank loan");
    expect(items.get("facilityAudit fac1 amount")).toBe(3000000);
    expect(items.get("facilityAudit fac1 ratePct")).toBe(5);
    expect(items.get("facilityAudit fac1 termYears")).toBe(8);
    expect(items.get("facilityAudit fac1 graceYears")).toBe(1);
    expect(items.get("facilityAudit fac1 drawScope")).toBe("general");
    expect(items.get("facilityAudit fac2 label")).toBe("Equipment loan");
    expect(items.get("facilityAudit fac2 amount")).toBe(400000);
    expect(items.get("facilityAudit fac2 ratePct")).toBe(4);
    expect(items.get("facilityAudit fac2 termYears")).toBe(5);
    expect(items.get("facilityAudit fac2 graceYears")).toBe(0);
    expect(items.get("facilityAudit fac2 drawScope")).toBe(`attached: ${capexOf()}`);
    // raw: the audit cells are numbers, not formatted strings
    expect(typeof items.get("facilityAudit fac1 amount")).toBe("number");
  });

  it("AUDIT-ROWS-PROGRAM: the migrated program (the EIB facility plus the dated-draw interest-free note) appends audit rows for both, including the dated draw the legacy echo cannot express", async () => {
    const inp = migrateOnLoad(shorePowerProgram());
    const r = computeModel(inp);
    const wb = await readWorkbook(await buildWorkbook(restoreLegacyFinancing(inp), r, { startYear: null, facilities: inp.facilities }));
    const items = inputsItems(wb);
    const ids = (inp.facilities ?? []).map((f) => f.id);
    expect(ids.length).toBe(2);
    for (const f of inp.facilities ?? []) {
      expect(items.get(`facilityAudit ${f.id} label`)).toBe(f.label);
      expect(items.get(`facilityAudit ${f.id} amount`)).toBe(f.amount);
      expect(items.get(`facilityAudit ${f.id} ratePct`)).toBe(f.ratePct);
      expect(items.get(`facilityAudit ${f.id} termYears`)).toBe(f.termYears);
      expect(items.get(`facilityAudit ${f.id} graceYears`)).toBe(f.graceYears);
      expect(items.get(`facilityAudit ${f.id} drawScope`)).toBe(f.scope.kind === "general" ? "general" : `attached: ${f.scope.lineIds.join(", ")}`);
    }
  });

  it("LEGACY-SHAPED: a document with no facility list adds no audit rows (the echo stands as before)", async () => {
    const inp = demoProject();
    const r = computeModel(inp);
    const wb = await readWorkbook(await buildWorkbook(restoreLegacyFinancing(inp), r, { startYear: null }));
    const items = inputsItems(wb);
    expect([...items.keys()].some((k) => k.startsWith("facilityAudit"))).toBe(false);
    expect([...items.keys()].some((k) => k.startsWith("facility "))).toBe(false);
  });
});

