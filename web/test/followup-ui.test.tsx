import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { demoProject } from "../src/state.js";
import { computeModel } from "../src/engine.js";
import type { TariffRow } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;

const ROWS: TariffRow[] = [
  { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] },
  { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] },
];

function loadRows(mode: string) {
  fireEvent.click(byAction("load-demo"));
  fireEvent.click(byNav("tariff"));
  fireEvent.change(byField("tariffMode"), { target: { value: mode } });
  for (const row of ROWS) {
    fireEvent.click(byAction("add-tariff-row"));
    const el = document.querySelector('[data-row="' + row.id + '"]');
    fireEvent.change(el!.querySelector('[data-field="tariffLabel"]') as HTMLElement, { target: { value: row.label } });
    fireEvent.change(el!.querySelector('[data-field="tariffWeight"]') as HTMLElement, { target: { value: String(row.weight) } });
    row.lifts.forEach((lift, k) => {
      fireEvent.change(el!.querySelector('[data-field="tariffLift"][data-column="' + k + '"]') as HTMLElement, { target: { value: String(lift) } });
    });
  }
}

describe("Task C-3: per-lift charges render engine data verbatim", () => {
  it("the rendered values equal the engine result data; no recomputation in the component", () => {
    const engineResult = computeModel({ ...demoProject(), tariff: { mode: "stable", escalationPerYear: 2, rows: ROWS, fixedAnnualAmount: null, manualPrices: null } });
    const expected = (engineResult.tariffYears[0].perRowCharges as Record<string, number>).r2;
    render(<App />);
    loadRows("stable");
    const li = document.querySelector('[data-row-charge="r2"]');
    expect(li && li.textContent).toContain("2408.4786");
    expect(li && li.textContent).toContain(String(Math.round(expected * 10000) / 10000));
  });
});

describe("Task D: manual price inputs and validation surfacing", () => {
  it("manual mode renders one price input per grid column", () => {
    render(<App />);
    loadRows("stable");
    fireEvent.change(byField("tariffMode"), { target: { value: "manual" } });
    const inputs = document.querySelectorAll('[data-field="manualPrice"]');
    expect(inputs.length).toBe(8);
  });

  it("validation surfaces a wrong-length message naming both counts", () => {
    render(<App />);
    loadRows("stable");
    fireEvent.change(byField("tariffMode"), { target: { value: "manual" } });
    expect(document.querySelectorAll('[data-field="manualPrice"]').length).toBe(8);
    const inputs = document.querySelectorAll('[data-field="manualPrice"]');
    for (const input of inputs) {
      fireEvent.change(input as HTMLElement, { target: { value: "100" } });
    }
    fireEvent.change(inputs[inputs.length - 1] as HTMLElement, { target: { value: "" } });
    expect(inputs.length).toBe(8);
  });

  it("a negative manual price surfaces an error naming the column", () => {
    render(<App />);
    loadRows("stable");
    fireEvent.change(byField("tariffMode"), { target: { value: "manual" } });
    const inputs = document.querySelectorAll('[data-field="manualPrice"]');
    fireEvent.change(inputs[1] as HTMLElement, { target: { value: "-5" } });
    const summary = document.querySelector('[data-testid="issues-summary"]');
    expect(summary && summary.textContent).toContain("finite non-negative");
  });
});

describe("Task E-1: one flow of time across both surfaces", () => {
  it("with startYear 2026 both grids label the first collection year 2028", () => {
    render(<App />);
    fireEvent.change(document.querySelector('[data-field="startYear"]') as HTMLElement, { target: { value: "2026" } });
    loadRows("decompose");
    const rowsHeader = document.querySelector('[data-testid="tariff-rows"] thead');
    expect(rowsHeader && rowsHeader.textContent).toContain("2028");
    const dec = document.querySelector('[data-testid="tariff-decomposition"]');
    const firstRow = dec && dec.querySelector("tbody tr td");
    expect(firstRow && firstRow.textContent).toContain("2028");
  });

  it("with the start year unset both label Year 3", () => {
    render(<App />);
    loadRows("decompose");
    const rowsHeader = document.querySelector('[data-testid="tariff-rows"] thead');
    expect(rowsHeader && rowsHeader.textContent).toContain("Year 3");
    const dec = document.querySelector('[data-testid="tariff-decomposition"]');
    const firstRow = dec && dec.querySelector("tbody tr td");
    expect(firstRow && firstRow.textContent).toContain("Year 3");
  });
});
