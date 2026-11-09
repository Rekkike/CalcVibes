import { describe, expect, it } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { landNewbuildProject, shorePowerProgram } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs } from "../../core/src/types.js";

// v0.6.21 Task D — the four deferred model-year surfaces gain the calendar-year vocabulary of record
// (the yearHeader pattern: the calendar year when the project start year is set, the generic Year-k
// form when unset): (a) the manual-prices input labels, (b) the per-contract profile editor rows,
// (c) the reinvestments editor rows, (d) the volume-grid h3 caption. The delivered pins (the
// followup-ui 2028 test, COLL-LABELS, GRID-CALENDAR-TWIN, COLL-LABELS-VISIBLE) stand unmodified and
// stay green in the battery.

const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byTest = (v: string) => document.querySelector('[data-testid="' + v + '"]');

async function open(inputs: ModelInputs, startYear: number | null) {
  render(<App />);
  const text = serializeProject(inputs, { startYear, entryUnit: "ones" as const, scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
  await waitFor(() => {
    expect((document.querySelector('[data-field="projectName"]') as HTMLInputElement).value).toBe(inputs.projectName);
  });
}

const withContracts = (): ModelInputs => ({
  ...landNewbuildProject(),
  contracts: [
    { id: "k1", label: "Hotel lease", startYear: 3, termYears: 20, paymentsPerYear: 12, graceYears: 0, escalationPerYear: 1.5, balloon: 0, mode: "evaluated", evaluatedPayment: 1000000, evaluatedProfile: { 3: 500000, 4: 600000 }, reinvestments: [{ year: 5, amount: 200000 }] },
  ],
});

const manualTariff = (): ModelInputs => {
  const base = shorePowerProgram();
  return { ...base, tariff: { ...base.tariff!, mode: "manual" as const, manualPrices: null, span: { startYear: 3, termYears: 20 } } };
};

describe("v0.6.21 Task D — the four deferred model-year surfaces", () => {
  it("(a) the manual-prices labels read the calendar year when the start year is set, and Year-k when unset", async () => {
    await open(manualTariff(), 2026);
    fireEvent.click(byNav("tariff"));
    const labels = Array.from(document.querySelectorAll("label")).map((l) => l.textContent ?? "");
    expect(labels.some((t) => t.startsWith("Price for collection year 2028"))).toBe(true);
    expect(labels.some((t) => t.startsWith("Price for collection year 3"))).toBe(false);
  });

  it("(a-null) with no start year the manual-prices labels read the generic Year-k form", async () => {
    await open(manualTariff(), null);
    fireEvent.click(byNav("tariff"));
    const labels = Array.from(document.querySelectorAll("label")).map((l) => l.textContent ?? "");
    expect(labels.some((t) => t.startsWith("Price for collection year Year 3"))).toBe(true);
  });

  it("(d) the volume-grid h3 caption carries the calendar years (2028–2048 at start year 2026; Year 3–Year 23 when unset)", async () => {
    await open(manualTariff(), 2026);
    fireEvent.click(byNav("tariff"));
    expect(byTest("tariff-editor-scroll")!.parentElement!.querySelector("h3")!.textContent).toContain("collection years 2028–2048");
  });

  it("(d-null) the caption reads the generic form when no start year is set", async () => {
    await open(manualTariff(), null);
    fireEvent.click(byNav("tariff"));
    expect(byTest("tariff-editor-scroll")!.parentElement!.querySelector("h3")!.textContent).toContain("collection years Year 3–Year 23");
  });

  it("(b) the per-contract profile editor rows carry the calendar twin and the visible label", async () => {
    await open(withContracts(), 2026);
    fireEvent.click(byNav("repayment"));
    fireEvent.click(document.querySelector('[data-testid="contract-profile-editor"] summary')!);
    const rows = Array.from(document.querySelectorAll('[data-testid="contract-profile-rows"] tr[data-profile-year]')) as HTMLElement[];
    expect(rows.map((r) => r.getAttribute("data-profile-year"))).toEqual(["3", "4"]);
    expect(rows.map((r) => r.getAttribute("data-calendar-label"))).toEqual(["2028", "2029"]);
    const notes = Array.from(document.querySelectorAll('[data-testid="contract-profile-calendar-label"]')).map((n) => n.textContent);
    expect(notes).toEqual(["2028", "2029"]);
  });

  it("(c) the reinvestments editor rows carry the calendar twin and the visible label", async () => {
    await open(withContracts(), 2026);
    fireEvent.click(byNav("repayment"));
    fireEvent.click(document.querySelector('[data-testid="reinvestments-editor"] summary')!);
    const row = document.querySelector('tr[data-reinvestment-year="5"]') as HTMLElement;
    expect(row.getAttribute("data-calendar-label")).toBe("2030");
    expect(row.querySelector('[data-testid="reinvestment-calendar-label"]')!.textContent).toBe("2030");
  });

  it("(b/c-null) with no start year the editor rows read the generic Year-k form", async () => {
    await open(withContracts(), null);
    fireEvent.click(byNav("repayment"));
    fireEvent.click(document.querySelector('[data-testid="contract-profile-editor"] summary')!);
    fireEvent.click(document.querySelector('[data-testid="reinvestments-editor"] summary')!);
    const rows = Array.from(document.querySelectorAll('[data-testid="contract-profile-rows"] tr[data-profile-year]')) as HTMLElement[];
    expect(rows.map((r) => r.getAttribute("data-calendar-label"))).toEqual(["Year 3", "Year 4"]);
    expect((document.querySelector('tr[data-reinvestment-year="5"]') as HTMLElement).getAttribute("data-calendar-label")).toBe("Year 5");
  });
});
