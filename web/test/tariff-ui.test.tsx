import { describe, expect, it } from "vitest";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { App } from "../src/App.js";
import { demoProject } from "../src/state.js";
import { computeModel } from "../src/engine.js";
import { serializeProject } from "../../core/src/fileio.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;

const ROWS = [
  { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] },
  { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] },
];

// v0.6.7 re-anchor: the port loader presets a 21-column decompose tariff; this suite builds its own
// eight-column stable tariff from a blank slate, so it opens the internal Alpha template via the
// project-file route — the same project the old demo button loaded.
async function loadStable() {
  const text = serializeProject(demoProject(), { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  const file = new File([text], "project-alpha.calcvibes.json", { type: "application/json" });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Project Alpha")).toBeTruthy();
  });
  fireEvent.click(byNav("tariff"));
  fireEvent.change(byField("tariffMode"), { target: { value: "stable" } });
  // add the two rows of record
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

describe("chunk 6: tariff section and results", () => {
  it("renders the mode selector and the volume grid derived from the model span (v0.6.7 re-anchor: the Alpha template via the project-file route)", async () => {
    render(<App />);
    await loadStable();
    const header = document.querySelector('[data-testid="tariff-rows"] thead');
    expect(header && header.textContent).toContain("3");
    expect(header && header.textContent).toContain("10");
  });

  it("engine-emitted decomposition displays: unit price, revenue, weighted volume; null payment renders as not applicable (v0.6.7 re-anchor: the Alpha template via the project-file route)", async () => {
    render(<App />);
    await loadStable();
    const dec = document.querySelector('[data-testid="tariff-decomposition"]');
    expect(dec).toBeTruthy();
    expect(dec && dec.textContent).toContain("842,97 tkr");
    expect(dec && dec.textContent).toContain("1 tkr");
    expect(document.querySelector('[data-testid="payment-na"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="payment-na"]')!.textContent).toContain("not applicable");
  });

  it("per-lift charges display from engine-emitted data (v0.6.7 re-anchor: the Alpha template via the project-file route)", async () => {
    render(<App />);
    await loadStable();
    const charges = document.querySelector('[data-testid="per-lift-charges"]');
    expect(charges && charges.textContent).toContain("Loaded 20-ft: 1 tkr");
    expect(charges && charges.textContent).toContain("Loaded 40-ft: 2 tkr");
  });

  it("decompose mode keeps the solved payment and shows the required per year (v0.6.7 re-anchor: the Alpha template via the project-file route)", async () => {
    render(<App />);
    await loadStable();
    fireEvent.change(byField("tariffMode"), { target: { value: "decompose" } });
    const dec = document.querySelector('[data-testid="tariff-decomposition"]');
    // v0.6.9 Task F: the per-lift charges and unit prices close at the fee formatter.
    expect(dec && dec.textContent).toContain("475,31 tkr");
    expect(dec && dec.textContent).toContain("679,01 kr");
    expect(document.querySelector('[data-testid="payment-na"]')).toBeNull();
  });

  it("engine basis: the stable result matches the pinned figures through the UI import path", () => {
    const r = computeModel({ ...demoProject(), tariff: { mode: "stable", escalationPerYear: 2, rows: ROWS, fixedAnnualAmount: null, manualPrices: null } });
    expect(r.paymentAmount).toBeNull();
    expect(Math.abs((r.tariffBaseUnitPrice as number) - 1204.2392789)).toBeLessThan(1e-4);
    expect(Math.abs(r.totalCollected - 13143208.01)).toBeLessThan(0.01);
  });
});

describe("chunk 7: carried fixes", () => {
  it("the presentation deck renders calendar-year labels when the start year is set", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.change(document.querySelector('[data-field="startYear"]') as HTMLElement, { target: { value: "2026" } });
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(document.querySelector('[data-slide-name="recovery"]')!.textContent).toContain("2028");
  });

  it("the results table uses the shared helper (covered in v0.3.1) and the deck does too; unset start gives Year-k", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(document.querySelector('[data-slide-name="recovery"]')!.textContent).toContain("Year 3");
  });

  it("an out-of-range start year surfaces a validation message", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.change(document.querySelector('[data-field="startYear"]') as HTMLElement, { target: { value: "1800" } });
    const err = document.querySelector('[data-testid="start-year-error"]');
    expect(err && err.textContent).toContain("between 1900 and 2200");
    fireEvent.change(document.querySelector('[data-field="startYear"]') as HTMLElement, { target: { value: "2026" } });
    expect(document.querySelector('[data-testid="start-year-error"]')).toBeNull();
  });
});
