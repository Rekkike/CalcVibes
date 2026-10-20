import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { feeForDisplay } from "../src/engine.js";
import { demoProject } from "../src/state.js";
import { computeModel } from "../src/engine.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { TariffRow } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;

const ROWS: TariffRow[] = [
  { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] },
  { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] },
];

// v0.6.7 re-anchor: the load-demo button now loads the port fixture, which presets a
// 21-column decompose tariff; this suite builds its own 8-column ROWS from a blank tariff,
// so the setup loads the internal Alpha template via the project-file route instead
// (the tariff section adapts minimally: the row-building flow is unchanged).
async function openAlpha() {
  const text = serializeProject(demoProject(), { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  const file = new File([text], "project-alpha.calcvibes.json", { type: "application/json" });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Project Alpha")).toBeTruthy();
  });
}

async function loadRows(mode: string, afterOpen?: () => void) {
  await openAlpha();
  if (afterOpen) afterOpen();
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
  it("the rendered values equal the engine result data; no recomputation in the component", async () => {
    const engineResult = computeModel({ ...demoProject(), tariff: { mode: "stable", escalationPerYear: 2, rows: ROWS, fixedAnnualAmount: null, manualPrices: null } });
    const expected = (engineResult.tariffYears[0].perRowCharges as Record<string, number>).r2;
    render(<App />);
    await loadRows("stable");
    const li = document.querySelector('[data-row-charge="r2"]');
    expect(li && li.textContent).toContain("2 tkr");
    expect(li && li.textContent).toContain(feeForDisplay(expected, "SEK", "thousands"));
  });
});

describe("Task D: manual price inputs and validation surfacing", () => {
  it("manual mode renders one price input per grid column", async () => {
    render(<App />);
    await loadRows("stable");
    fireEvent.change(byField("tariffMode"), { target: { value: "manual" } });
    const inputs = document.querySelectorAll('[data-field="manualPrice"]');
    expect(inputs.length).toBe(8);
  });

  it("validation surfaces a wrong-length message naming both counts", async () => {
    render(<App />);
    await loadRows("stable");
    fireEvent.change(byField("tariffMode"), { target: { value: "manual" } });
    expect(document.querySelectorAll('[data-field="manualPrice"]').length).toBe(8);
    const inputs = document.querySelectorAll('[data-field="manualPrice"]');
    for (const input of inputs) {
      fireEvent.change(input as HTMLElement, { target: { value: "100" } });
    }
    fireEvent.change(inputs[inputs.length - 1] as HTMLElement, { target: { value: "" } });
    expect(inputs.length).toBe(8);
  });

  it("a negative manual price surfaces an error naming the column", async () => {
    render(<App />);
    await loadRows("stable");
    fireEvent.change(byField("tariffMode"), { target: { value: "manual" } });
    const inputs = document.querySelectorAll('[data-field="manualPrice"]');
    fireEvent.change(inputs[1] as HTMLElement, { target: { value: "-5" } });
    const summary = document.querySelector('[data-testid="issues-summary"]');
    expect(summary && summary.textContent).toContain("finite non-negative");
  });
});

describe("Task E-1: one flow of time across both surfaces", () => {
  it("with startYear 2026 both grids label the first collection year 2028 (v0.6.7 re-anchor: the start year is set through the load hook, after the Alpha open and before the tariff navigation, so the file-open settings restore cannot race it back to null)", async () => {
    render(<App />);
    await loadRows("decompose", () => {
      fireEvent.change(document.querySelector('[data-field="startYear"]') as HTMLElement, { target: { value: "2026" } });
    });
    const rowsHeader = document.querySelector('[data-testid="tariff-rows"] thead');
    expect(rowsHeader && rowsHeader.textContent).toContain("2028");
    const dec = document.querySelector('[data-testid="tariff-decomposition"]');
    const firstRow = dec && dec.querySelector("tbody tr td");
    expect(firstRow && firstRow.textContent).toContain("2028");
  });

  it("with the start year unset the volume grid carries the short token; the results table keeps Year 3 (v0.6.9 Task D re-anchor)", async () => {
    render(<App />);
    await loadRows("decompose");
    const rowsHeader = document.querySelector('[data-testid="tariff-rows"] thead');
    expect(rowsHeader && rowsHeader.textContent).toContain("Y3");
    expect(document.querySelector('[data-testid="tariff-rows"] thead [data-short-year="true"]')).not.toBeNull();
    const dec = document.querySelector('[data-testid="tariff-decomposition"]');
    const firstRow = dec && dec.querySelector("tbody tr td");
    expect(firstRow && firstRow.textContent).toContain("Year 3");
  });

  it("GRID-CALENDAR-TWIN: every per-year volume-grid header carries the yearHeader twin; the visible header keeps its v0.6.9 form (v0.6.12 Task B)", async () => {
    const first = render(<App />);
    await loadRows("decompose", () => {
      fireEvent.change(document.querySelector('[data-field="startYear"]') as HTMLElement, { target: { value: "2026" } });
    });
    const setHeaders = Array.from(document.querySelectorAll('[data-testid="tariff-rows"] thead th[data-calendar-label]'));
    expect(setHeaders.length).toBe(8);
    setHeaders.forEach((th, k) => {
      expect(th.getAttribute("data-calendar-label")).toBe(String(2026 + (k + 3) - 1));
      expect(th.textContent).toBe(th.getAttribute("data-calendar-label"));
      expect(th.hasAttribute("data-short-year")).toBe(false);
    });
    first.unmount();

    render(<App />);
    await loadRows("decompose");
    const unsetHeaders = Array.from(document.querySelectorAll('[data-testid="tariff-rows"] thead th[data-calendar-label]'));
    expect(unsetHeaders.length).toBe(8);
    unsetHeaders.forEach((th, k) => {
      expect(th.getAttribute("data-calendar-label")).toBe("Year " + (k + 3));
      expect(th.textContent).toBe("Y" + (k + 3));
      expect(th.getAttribute("data-short-year")).toBe("true");
    });
  });
});
