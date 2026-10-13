import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { demoProject } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";

// v0.6.7 re-anchor: the load-demo button now loads the port fixture, whose collections mode is
// a multi-row tariff decompose; tariff collection modes and collections profiles are mutually
// exclusive, so the profile behaviors are re-pointed to the internal Alpha template via the
// project-file route.
async function openAlpha() {
  const text = serializeProject(demoProject(), { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  const file = new File([text], "project-alpha.calcvibes.json", { type: "application/json" });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Project Alpha")).toBeTruthy();
  });
}

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("Collections editor (Task B web)", () => {
  it("the editor adds and fills per-year rows; the spread fills the map", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("repayment"));
    const editor = document.querySelector('[data-testid="collections-editor"]') as HTMLElement;
    editor.querySelector("details")?.setAttribute("open", "true");
    const addBtn = editor.querySelector('[data-action="add-col-override"]') as HTMLElement;
    fireEvent.click(addBtn);
    const rows = editor.querySelectorAll("[data-override-year]");
    expect(rows.length).toBe(1);
    const total = editor.querySelector('[data-field="col-spread-total"]') as HTMLInputElement;
    const first = editor.querySelector('[data-field="col-spread-first"]') as HTMLInputElement;
    const count = editor.querySelector('[data-field="col-spread-count"]') as HTMLInputElement;
    fireEvent.change(total, { target: { value: "10000.001" } });
    fireEvent.change(first, { target: { value: "3" } });
    fireEvent.change(count, { target: { value: "3" } });
    fireEvent.click(editor.querySelector('[data-action="col-spread-fill"]') as HTMLElement);
    const filled = document.querySelectorAll('[data-testid="collections-rows"] [data-override-year]');
    expect(filled.length).toBe(3);
    const amounts = Array.from(document.querySelectorAll('[data-field="col-override-amount"]') as NodeListOf<HTMLInputElement>).map((i) => parseFloat(i.value));
    const sum = amounts.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(10000.001, 6);
  });

  it("the SCE-PROFILE note renders in place of the two payment-solve tables when a profile is present (re-pointed to the Alpha template via the project-file route)", async () => {
    render(<App />);
    await openAlpha();
    fireEvent.click(byNav("repayment"));
    const editor = document.querySelector('[data-testid="collections-editor"]') as HTMLElement;
    editor.querySelector("details")?.setAttribute("open", "true");
    fireEvent.click(editor.querySelector('[data-action="add-col-override"]') as HTMLElement);
    const amount = document.querySelector('[data-field="col-override-amount"]') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "1000000" } });
    fireEvent.click(byNav("scenarios"));
    const note = document.querySelector('[data-testid="sce-profile-note"]');
    expect(note && note.textContent).toContain("SCE-PROFILE");
  });
});

describe("Yearly detail section (Task D web)", () => {
  it("renders both grids with totals rows and the two tariff rows visible (v0.6.7 re-anchor: the port fixture presets a multi-row decompose tariff)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("detail"));
    const costGrid = document.querySelector('[data-testid="cost-grid"]') as HTMLElement;
    const colGrid = document.querySelector('[data-testid="collections-grid"]') as HTMLElement;
    expect(costGrid).toBeTruthy();
    expect(colGrid).toBeTruthy();
    expect(costGrid.querySelector('[data-grid-row="cost:c1"]')).toBeTruthy();
    expect(colGrid.querySelector('[data-grid-row="tariff:r1"]')).toBeTruthy();
    expect(colGrid.querySelector('[data-grid-row="tariff:r2"]')).toBeTruthy();
    expect(costGrid.querySelector('[data-grid-totals="true"]')).toBeTruthy();
    expect(colGrid.querySelector('[data-grid-totals="true"]')).toBeTruthy();
    const r1Row = colGrid.querySelector('[data-grid-row="tariff:r1"]') as HTMLElement;
    expect(r1Row.textContent).toContain("\u20ac303 574,46 k");
    const r2Row = colGrid.querySelector('[data-grid-row="tariff:r2"]') as HTMLElement;
    expect(r2Row.textContent).toContain("\u20ac86 718,97 k");
  });

  it("profile mode shows the profile row in the collections grid (re-pointed to the Alpha template via the project-file route)", async () => {
    render(<App />);
    await openAlpha();
    fireEvent.click(byNav("repayment"));
    const editor = document.querySelector('[data-testid="collections-editor"]') as HTMLElement;
    editor.querySelector("details")?.setAttribute("open", "true");
    fireEvent.click(editor.querySelector('[data-action="add-col-override"]') as HTMLElement);
    const amount = document.querySelector('[data-field="col-override-amount"]') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "1000000" } });
    fireEvent.click(byNav("detail"));
    const colGrid = document.querySelector('[data-testid="collections-grid"]') as HTMLElement;
    expect(colGrid.querySelector('[data-grid-row="profile:profile"]')).toBeTruthy();
  });
});
