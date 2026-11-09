import { describe, expect, it } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel, deckMoneyForDisplay, moneyForDisplay } from "../src/engine.js";
import { demoProject, shorePowerProgram } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs } from "../../core/src/types.js";

// v0.6.21 Task B (Round 46 Supplement 6) — the reading-form discipline on every READ surface: every
// money figure renders in the established reading form (the entry-unit scaling per the project's
// setting, space-separated thousands, display-rounded decimals, the currency form per the unit
// vocabulary), across the overview tiles, the book view, the debt schedule (yearly and per-facility),
// the DSCR rows, and the collections grid. Years, percentages and ratios keep their standing forms;
// the fee-class unit-price exemption at unit ones stands; the XLSX export stays raw.

const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const stat = (v: string) => document.querySelector(`[data-stat="${v}"]`)?.textContent;

async function openProject(inputs: ModelInputs, entryUnit: "ones" | "thousands" = "ones") {
  render(<App />);
  const text = serializeProject(inputs, { startYear: null, entryUnit, scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
  await waitFor(() => {
    expect((document.querySelector('[data-field="projectName"]') as HTMLInputElement).value).toBe(inputs.projectName);
  });
}

describe("v0.6.21 Task B — the reading form on the READ surfaces", () => {
  it("RESULTS: the metrics, equity panel, debt schedule, facility schedules, DSCR rows and book view render money in the reading form (Alpha, SEK, unit thousands)", async () => {
    const inputs = { ...demoProject(), depreciationDefault: { mode: "straight-line" as const, years: 40 }, appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "none" as const, amount: 0, year: 5 } } };
    const result = computeModel(inputs);
    await openProject(inputs, "thousands");
    fireEvent.click(byNav("results"));
    const money = (v: number) => deckMoneyForDisplay(v, "SEK", "thousands");
    // the metrics: the cost NPV carries the currency form and the unit scaling
    expect(stat("costNpv")).toBe(money(result.costNpv));
    expect(stat("costNpv")).toContain("tkr");
    expect(stat("totalCost")).toBe(money(result.totalCost));
    // years, percentages and ratios keep their standing forms
    expect(stat("paybackYears")).toBe(result.paybackYears === null ? "—" : String(Math.round(result.paybackYears * 1e5) / 1e5));
    expect(stat("achievedIrr")).toContain("%");
    // the book view's money columns render in the reading form
    const bookRow = document.querySelector('[data-testid="book-schedule"] tbody tr');
    expect(bookRow).toBeTruthy();
    const bookCells = Array.from(bookRow!.querySelectorAll("td")).map((td) => td.textContent);
    expect(bookCells[1]).toBe(money(result.bookView!.combined[0].beginning));
    expect(bookCells[2]).toBe(money(result.bookView!.combined[0].charge));
    // the residual reconciliation
    expect(stat("residualUsed")).toBe(money(result.residualAmountUsed ?? 0));
  });

  it("RESULTS-FUNDED: the debt schedule, the facility schedules and the DSCR rows render money in the reading form; the DSCR ratio keeps its standing form (program demo, EUR, unit thousands)", async () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    const r = computeModel(shorePowerProgram());
    const money = (v: number) => deckMoneyForDisplay(v, "EUR", "thousands");
    const debt = document.querySelector('[data-testid="debt-schedule"]')!;
    expect(debt.textContent).toContain(money(r.financing!.yearly[0].interest));
    expect(debt.textContent).toContain(money(r.financing!.yearly[0].service));
    const dscr = document.querySelector('[data-testid="dscr-table"]')!;
    const firstDscrRow = dscr.querySelector("tbody tr")!;
    const cells = Array.from(firstDscrRow.querySelectorAll("td")).map((td) => td.textContent);
    const d0 = r.financing!.dscr.find((d) => d.dscr !== null)!;
    expect(cells[1]).toBe(money(d0.inflows));
    expect(cells[2]).toBe(money(d0.service));
    expect(cells[3]).toBe(String(Math.round(d0.dscr! * 1e4) / 1e4)); // the ratio, not money
    const fac = document.querySelector('[data-testid="facility-schedules"]')!;
    const fac0 = r.financing!.facilities![0]!;
    const facServiceTotal = fac0.monthly.service.reduce((a: number, b: number) => a + b, 0);
    expect(fac.textContent).toContain(money(facServiceTotal));
  });

  it("OVERVIEW TILES: the metric cards render in the reading form (program demo, EUR, unit thousands)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    const r = computeModel(shorePowerProgram());
    const money = (v: number) => deckMoneyForDisplay(v, "EUR", "thousands");
    expect(document.querySelector('[data-metric="totalCost"] .metric-value')!.textContent).toBe(money(r.totalCost));
    expect(document.querySelector('[data-metric="requiredPayment"] .metric-value')!.textContent).toBe(money(r.paymentAmount ?? 0));
  });

  it("DETAIL: the collections grid (and the cost grid) render in the reading form already (moneyForDisplay)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("detail"));
    const r = computeModel(shorePowerProgram());
    const grid = document.querySelector('[data-testid="collections-grid"]')!;
    const firstRow = grid.querySelector("tbody tr")!;
    const cells = Array.from(firstRow.querySelectorAll("td")).map((td) => td.textContent);
    const amounts = r.collectionsGrid[0].amounts;
    const a0 = amounts[0] ?? 0;
    expect(cells[1]).toBe(a0 === 0 ? "—" : moneyForDisplay(a0, "EUR", "thousands"));
  });

  it("XLSX STAYS RAW: the export's money cells remain unrounded engine numbers (the deliberate audit route)", async () => {
    const { buildWorkbook } = await import("../src/xlsx.js");
    const inputs = demoProject();
    const result = computeModel(inputs);
    const buf = await buildWorkbook(inputs, result, { startYear: null });
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as ArrayBuffer);
    const metrics = wb.getWorksheet("Metrics")!;
    const found = metrics.getColumn(2).values as unknown[];
    const idx = (metrics.getColumn(1).values as unknown[]).indexOf("costNpv");
    expect(typeof found[idx]).toBe("number");
    expect(found[idx]).toBe(result.costNpv); // the raw engine value, unrounded
  });
});
