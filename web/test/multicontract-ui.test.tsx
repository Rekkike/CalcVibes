import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel } from "../src/engine.js";
import { demoProject } from "../src/state.js";
import { buildWorkbook, readWorkbook } from "../src/xlsx.js";
import type { ModelInputs } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLInputElement;

const multiProject = (): ModelInputs => ({
  ...demoProject(),
  costs: [
    { id: "c1", name: "Depreciable assets", category: "capex", amount: 20000000, startYear: 1, durationYears: 1, escalation: 0, depreciation: { mode: "straight-line", years: 33 } },
    { id: "c2", name: "Retained assets", category: "capex", amount: 80000000, startYear: 1, durationYears: 1, escalation: 0, depreciation: { mode: "retained" } },
    { id: "c3", name: "Build", category: "recurring", amount: 5000000, startYear: 1, durationYears: 3, escalation: 0 },
  ],
  contracts: [
    { id: "k1", label: "Contract one", startYear: 4, termYears: 15, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved", reinvestments: [{ year: 4, amount: 3000000 }] },
    { id: "k2", label: "Contract two", startYear: 19, termYears: 15, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
    { id: "k3", label: "Lease three", startYear: 34, termYears: 20, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
  ],
  appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { mode: "calculated", amount: 0, year: 33 } },
});

type Ws = { getRow: (n: number) => { getCell: (n: number) => { value: unknown } }; rowCount: number; name: string };

async function sheetRows(inputs: ModelInputs): Promise<Map<string, Ws>> {
  const result = computeModel(inputs);
  const wb = await readWorkbook(await buildWorkbook(inputs, result));
  const map = new Map<string, Ws>();
  for (const ws of wb.worksheets) map.set(ws.name, ws as unknown as Ws);
  return map;
}

describe("v0.6 chunk 4 — the web surfaces", () => {
  it("CONTRACTS-EDITOR: the legacy single-contract project renders as one stream; adding a contract renders the editor", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("repayment"));
    expect(document.querySelector('[data-testid="legacy-contract-note"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="contracts-editor"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="contract-card"]').length).toBe(0);
  });

  it("CONTRACTS-EDITOR: every contract field renders and edits through the live model, reinvestments included", () => {
    render(<App />);
    fireEvent.click(byAction("new-project"));
    fireEvent.click(byNav("repayment"));
    const editor = document.querySelector('[data-testid="contracts-editor"]') as HTMLElement;
    expect(editor).toBeTruthy();
    fireEvent.click(editor.querySelector('[data-action="add-contract"]') as HTMLElement);
    const cards = editor.querySelectorAll('[data-testid="contract-card"]');
    expect(cards.length).toBe(1);
    fireEvent.change(cards[0].querySelector('[data-field="contract-label"]') as HTMLInputElement, { target: { value: "Deal one" } });
    fireEvent.change(cards[0].querySelector('[data-field="contract-startYear"]') as HTMLInputElement, { target: { value: "4" } });
    fireEvent.change(cards[0].querySelector('[data-field="contract-termYears"]') as HTMLInputElement, { target: { value: "15" } });
    fireEvent.change(cards[0].querySelector('[data-field="contract-paymentsPerYear"]') as HTMLSelectElement, { target: { value: "1" } });
    fireEvent.change(cards[0].querySelector('[data-field="contract-graceYears"]') as HTMLInputElement, { target: { value: "0" } });
    fireEvent.change(cards[0].querySelector('[data-field="contract-escalationPerYear"]') as HTMLInputElement, { target: { value: "0" } });
    fireEvent.change(cards[0].querySelector('[data-field="contract-balloon"]') as HTMLInputElement, { target: { value: "0" } });
    const rEditor = cards[0].querySelector('[data-testid="reinvestments-editor"]') as HTMLElement;
    rEditor.setAttribute("open", "true");
    fireEvent.click(rEditor.querySelector('[data-action="add-reinvestment"]') as HTMLElement);
    const riRows = rEditor.querySelectorAll("[data-reinvestment-year]");
    expect(riRows.length).toBe(1);
    fireEvent.change(rEditor.querySelector('[data-field="reinvestment-year"]') as HTMLInputElement, { target: { value: "4" } });
    fireEvent.change(rEditor.querySelector('[data-field="reinvestment-amount"]') as HTMLInputElement, { target: { value: "3000000" } });
    const modeSelect = cards[0].querySelector('[data-field="contract-mode"]') as unknown as HTMLSelectElement;
    fireEvent.change(modeSelect, { target: { value: "evaluated" } });
    expect(cards[0].querySelector('[data-field="contract-evaluatedPayment"]')).toBeTruthy();
    fireEvent.change(modeSelect, { target: { value: "solved" } });
    fireEvent.click(editor.querySelector('[data-action="add-contract"]') as HTMLElement);
    expect(editor.querySelectorAll('[data-testid="contract-card"]').length).toBe(2);
    fireEvent.click(editor.querySelectorAll('[data-testid="contract-card"]')[1].querySelector('[data-action="remove-contract"]') as HTMLElement);
    expect(editor.querySelectorAll('[data-testid="contract-card"]').length).toBe(1);
  });

  it("HORIZON-DISPLAY: the Overview shows the derived horizon with its constituents", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("overview"));
    const hint = document.querySelector('[data-testid="length-hint"]');
    expect(hint?.textContent).toContain("Derived horizon:");
    const derivation = document.querySelector('[data-testid="horizon-derivation"]') as HTMLElement;
    expect(derivation).toBeTruthy();
    const result = computeModel(demoProject());
    for (const hc of result.horizon!.constituents) {
      const el = derivation.querySelector('[data-constituent="' + hc.label + '"]');
      expect(el?.textContent).toContain("month " + hc.month);
    }
  });

  it("BOOK-VIEW and TERM-POSITIONS render through the engine on the Results surface", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const firstRow = document.querySelector('[data-kind="cost"]') as HTMLElement;
    fireEvent.change(firstRow.querySelector('[data-field="category"]') as unknown as HTMLSelectElement, { target: { value: "capex" } });
    fireEvent.change(firstRow.querySelector('[data-field="line-depreciation-mode"]') as unknown as HTMLSelectElement, { target: { value: "straight-line" } });
    fireEvent.click(byNav("repayment"));
    const editor = document.querySelector('[data-testid="contracts-editor"]') as HTMLElement;
    fireEvent.click(editor.querySelector('[data-action="add-contract"]') as HTMLElement);
    fireEvent.click(byNav("results"));
    const book = document.querySelector('[data-testid="book-schedule"]') as HTMLElement;
    expect(book).toBeTruthy();
    expect(document.querySelector('[data-testid="book-view-disclosure"]')?.textContent).toContain("never enters the cash flows");
    expect(document.querySelector('[data-testid="term-positions"]')).toBeTruthy();
  });

  it("RESIDUAL-CONFIG: calculated is offered as the first mode; the set amount renders under the amount mode", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("appraisal"));
    const modeSelect = byField("residualMode") as unknown as HTMLSelectElement;
    expect(modeSelect).toBeTruthy();
    expect((modeSelect.querySelector("option") as HTMLOptionElement).value).toBe("calculated");
    expect(byField("residualAmount")).toBeTruthy();
    fireEvent.change(modeSelect, { target: { value: "calculated" } });
    expect(byField("residualAmount")).toBe(null);
    expect(document.querySelector('[data-testid="residual-derivation"]')).toBeTruthy();
    fireEvent.change(modeSelect, { target: { value: "amount" } });
    expect(byField("residualAmount")).toBeTruthy();
  });

  it("DEPRECIATION-CONFIG: the cost lines carry the per-line schedule and the project default", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const block = document.querySelector('[data-testid="depreciation-config"]') as HTMLElement;
    expect(block).toBeTruthy();
    expect((block.querySelector('[data-field="depreciation-default-mode"]') as HTMLSelectElement)).toBeTruthy();
    const firstRow = document.querySelector('[data-kind="cost"]') as HTMLElement;
    expect(firstRow.querySelector('[data-field="line-depreciation-mode"]')).toBeTruthy();
  });

  it("XLSX-SCHEDULES: the contracts, term positions, and book view sheets carry the engine figures", async () => {
    const inputs = multiProject();
    const result = computeModel(inputs);
    const map = await sheetRows(inputs);
    const contracts = map.get("Contracts") as Ws;
    expect(contracts).toBeTruthy();
    const tp = map.get("Term positions") as Ws;
    expect(tp).toBeTruthy();
    const bv = map.get("Book view") as Ws;
    expect(bv).toBeTruthy();
    let foundReinvestment = false;
    let foundPosition = null as unknown as string;
    for (let r = 2; r <= tp.rowCount; r++) {
      const label = String(tp.getRow(r).getCell(1).value);
      if (label.includes("Contract one")) foundPosition = label;
    }
    for (let r = 2; r <= contracts.rowCount; r++) {
      const label = String(contracts.getRow(r).getCell(1).value);
      if (label.includes("Reinvestment (Contract one)")) foundReinvestment = true;
    }
    expect(foundReinvestment).toBe(true);
    expect(foundPosition).toBe("Project position at the end of Contract one");
    const tpFirst = result.termPositions![0];
    for (let r = 2; r <= tp.rowCount; r++) {
      if (tp.getRow(r).getCell(1).value === "Project position at the end of Contract one") {
        expect(tp.getRow(r).getCell(2).value).toBe(tpFirst.endMonth);
        expect(tp.getRow(r).getCell(5).value).toBe(tpFirst.cumulativeNet);
      }
    }
    const bvRows = bv.rowCount;
    expect(bvRows).toBeGreaterThan(result.bookView!.combined.length);
    expect(result.bookView!.residualMode).toBe("calculated");
    expect(result.residualAmountUsed).toBe(result.bookView!.remainingBookValueAtResidualYear);
  });

  it("XLSX-METRICS: the residualAmountUsed row carries the engine value", async () => {
    const map = await sheetRows(multiProject());
    const metrics = map.get("Metrics") as Ws;
    const result = computeModel(multiProject());
    for (let r = 2; r <= metrics.rowCount; r++) {
      if (metrics.getRow(r).getCell(1).value === "residualAmountUsed") {
        expect(metrics.getRow(r).getCell(2).value).toBe(result.residualAmountUsed);
        return;
      }
    }
    throw new Error("residualAmountUsed row missing from the Metrics sheet");
  });

  it("LEGACY-XLSX: the base demo workbook keeps the standing sheet inventory", async () => {
    const map = await sheetRows(demoProject());
    expect(Array.from(map.keys())).toEqual(["Inputs", "Cost lines", "Repayment", "Metrics"]);
  });
});

describe("v0.6 chunk 5 — the riding remediations and the multi-lease fixture", () => {
  it("DEFAULT-ANNUAL: the blank project starts at one payment per year", async () => {
    const { blankProject } = await import("../src/state.js");
    expect(blankProject().repayment.paymentsPerYear).toBe(1);
  });

  it("VERSION-CURRENT: the rendered label equals the constant equals v0.6", async () => {
    const { VERSION } = await import("../src/engine.js");
    expect(VERSION).toBe("v0.6R");
  });

  it("WATERFALL-FORM: the build-up is vertical floats to a solid cap with the labels outside the geometry", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const waterfall = document.querySelector('[data-testid="cost-waterfall"]') as HTMLElement;
    const segments = waterfall.querySelectorAll("[data-waterfall-segment]");
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of Array.from(segments) as HTMLElement[]) {
      expect(seg.style.bottom).not.toBe("");
      expect(seg.style.height).not.toBe("");
      expect(seg.querySelector('[data-testid="waterfall-label"]')).toBe(null);
    }
    const labels = waterfall.querySelectorAll('[data-testid="waterfall-label"]');
    expect(labels.length).toBe(segments.length);
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\[data-testid="presentation"\] \.waterfall-track\s*\{[^}]*height:\s*120px/);
  });

  it("HURDLE-SOLVED-DISCLOSURE: the solved-mode branch renders at equality; the evaluated case clears", async () => {
    const { computeModel } = await import("../src/engine.js");
    const { demoProject } = await import("../src/state.js");
    const result = computeModel(demoProject());
    expect(result.paymentAmount).not.toBeNull();
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    const margin = document.querySelector('[data-testid="hurdle-margin-label"]');
    expect(margin?.textContent).toContain("solved to the target");
    expect(margin?.getAttribute("data-hurdle-mode")).toBe("solved");
  });

  it("MULTI-LEASE-FIXTURE: the second demo loads and computes through the engine with the calculated residual", async () => {
    const { computeModel } = await import("../src/engine.js");
    const { multiLeaseProject } = await import("../src/state.js");
    const inputs = multiLeaseProject();
    const result = computeModel(inputs);
    expect(result.termPositions!.length).toBe(3);
    expect(result.contractsInfo!.length).toBe(3);
    expect(result.horizon!.totalMonths).toBeGreaterThan(0);
    expect(result.bookView!.residualMode).toBe("calculated");
    expect(result.residualAmountUsed).toBe(result.bookView!.remainingBookValueAtResidualYear);
    expect(result.paymentAmount).not.toBeNull();
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    fireEvent.click(byNav("results"));
    const termRows = document.querySelectorAll('[data-testid="term-positions"] tbody tr');
    expect(termRows.length).toBe(3);
    const firstLabel = (termRows[0] as HTMLElement).querySelector('[data-term-label]')?.textContent;
    expect(firstLabel).toContain("Project position at the end of Contract one");
  });
});
