import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { spreadFill } from "../src/state.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

// v0.6.7 re-anchor: the port loader presets the scenario axes (targets [4, 6, 8], terms [15, 20, 25],
// balloons [0, 8, 16]); the SCE battery enters its own axes, so it clears the presets first.
// Each Remove click re-renders and reindexes the buttons, so the first button is clicked until the axis is empty.
const clearPresetAxes = () => {
  for (const label of ["target", "term", "balloon"]) {
    let btn = document.querySelector('[data-action="scenario-remove-' + label + '"]');
    while (btn) {
      fireEvent.click(btn as HTMLElement);
      btn = document.querySelector('[data-action="scenario-remove-' + label + '"]');
    }
  }
};

describe("SPREAD-FILL (amendment)", () => {
  it("an exact total fills equal amounts", () => {
    expect(spreadFill(338000000, 1, 4)).toEqual({ 1: 84500000, 2: 84500000, 3: 84500000, 4: 84500000 });
  });

  it("a non-divisible total fills amounts summing exactly, remainder on the final year", () => {
    const fill = spreadFill(100, 1, 3);
    const values = Object.values(fill);
    expect(values.slice(0, 2)).toEqual([100 / 3, 100 / 3]);
    const sum = values.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 10);
    expect(values[values.length - 1]).not.toBe(values[0]);
  });
});

describe("Profile editor (Task B UI)", () => {
  it("the CAPEX line gains the per-year editor; spread fills it; labels correct", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const capexRow = document.querySelector('[data-kind="cost"][data-line="c3"]') as HTMLElement;
    expect(capexRow).toBeTruthy();
    const editorRow = document.querySelector('[data-kind="year-editor"][data-line="c3"]') as HTMLElement;
    const toggle = editorRow.querySelector('[data-testid="year-editor-toggle"]') as HTMLElement;
    expect(toggle).toBeTruthy();
    const editorDetails = editorRow.querySelector("details") as HTMLDetailsElement;
    editorDetails.open = true;
    const total = editorRow.querySelector('[data-field="spread-total"]') as HTMLInputElement;
    const first = editorRow.querySelector('[data-field="spread-first"]') as HTMLInputElement;
    const count = editorRow.querySelector('[data-field="spread-count"]') as HTMLInputElement;
    fireEvent.change(total, { target: { value: "338000000" } });
    fireEvent.change(first, { target: { value: "1" } });
    fireEvent.change(count, { target: { value: "4" } });
    fireEvent.click(editorRow.querySelector('[data-action="spread-fill"]') as HTMLElement);
    const editor = document.querySelector('[data-kind="year-editor"][data-line="c3"] [data-testid="year-editor"]') as HTMLElement;
    expect(editor.querySelectorAll("[data-override-year]").length).toBe(4);
    const amounts = Array.from(editor.querySelectorAll('[data-field="override-amount"]') as NodeListOf<HTMLInputElement>).map((i) => parseFloat(i.value));
    expect(amounts).toEqual([84500000, 84500000, 84500000, 84500000]);
  });

  it("the amount field is inert for a CAPEX profile with overrides; the duration note explains why", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const amount = document.querySelector('[data-line="c3"] [data-field="amount"]') as HTMLInputElement;
    expect(amount.disabled).toBe(false);
    expect(document.body.textContent).toContain("CAPEX duration is set by the year profile");
  });
});

describe("SCE battery (Task D)", () => {
  it("SCE-EMPTY (re-anchored per AXES-1): the axes are empty by default and the tables render the honest empty state (v0.6.7 re-anchor: the port presets are cleared first)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    clearPresetAxes();
    expect(document.querySelectorAll('[data-field="scenario-target"]').length).toBe(0);
    expect(document.querySelectorAll('[data-field="scenario-term"]').length).toBe(0);
    expect(document.querySelectorAll('[data-field="scenario-balloon"]').length).toBe(0);
    expect(document.querySelector('[data-testid="scenarios-empty-state"]')?.textContent).toContain("Enter values to compute the tables.");
    expect(document.querySelector('[data-testid="term-target-table"]')).toBeNull();
    expect(document.querySelector('[data-testid="balloon-term-table"]')).toBeNull();
  });
  it("SCE-LIST: entering targets [3, 5, 7] and terms [5, 7, 9] renders the pinned rows (v0.6.7 re-anchor: the port base, term-5 column, entry unit thousands, EUR)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    clearPresetAxes();
    for (const v of ["3", "5", "7"]) {
      fireEvent.click(document.querySelector('[data-action="scenario-add-target"]') as HTMLElement);
      const inputs = document.querySelectorAll('[data-field="scenario-target"]');
      fireEvent.change(inputs[inputs.length - 1], { target: { value: v } });
    }
    for (const v of ["5", "7", "9"]) {
      fireEvent.click(document.querySelector('[data-action="scenario-add-term"]') as HTMLElement);
      const inputs = document.querySelectorAll('[data-field="scenario-term"]');
      fireEvent.change(inputs[inputs.length - 1], { target: { value: v } });
    }
    const tt = document.querySelector('[data-testid="term-target-table"]') as HTMLElement;
    const rows = Array.from(tt.querySelectorAll("tbody tr"));
    const rowText = (r: HTMLElement) => Array.from(r.querySelectorAll("td")).map((td) => td.textContent).join("|");
    expect(rows.length).toBe(3);
    expect(rowText(rows[0] as HTMLElement)).toContain("3%");
    expect(rowText(rows[0] as HTMLElement)).toContain("€3 349,51 k");
    expect(rowText(rows[1] as HTMLElement)).toContain("€3 533,51 k");
    expect(rowText(rows[2] as HTMLElement)).toContain("€3 723,35 k");
  });
  it("SCE-ZERO: the 0 percent row renders the nominal identity (v0.6.7 re-anchor: the port base)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    clearPresetAxes();
    for (const v of ["0", "3", "5"]) {
      fireEvent.click(document.querySelector('[data-action="scenario-add-target"]') as HTMLElement);
      const inputs = document.querySelectorAll('[data-field="scenario-target"]');
      fireEvent.change(inputs[inputs.length - 1], { target: { value: v } });
    }
    for (const v of ["5", "7", "9"]) {
      fireEvent.click(document.querySelector('[data-action="scenario-add-term"]') as HTMLElement);
      const inputs = document.querySelectorAll('[data-field="scenario-term"]');
      fireEvent.change(inputs[inputs.length - 1], { target: { value: v } });
    }
    const tt = document.querySelector('[data-testid="term-target-table"]') as HTMLElement;
    const firstRow = tt.querySelector("tbody tr") as HTMLElement;
    expect(firstRow.textContent).toContain("0%");
    expect(firstRow.textContent).toContain("€3 084,52 k");
  });
  it("SCE-VALID: each invalid construct surfaces the named error (v0.6.7 re-anchor: the port presets are cleared first)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    clearPresetAxes();
    fireEvent.click(document.querySelector('[data-action="scenario-add-target"]') as HTMLElement);
    const targetInputs = document.querySelectorAll('[data-field="scenario-target"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(targetInputs[0], { target: { value: "-5" } });
    let summary = document.querySelector('[data-testid="issues-summary"]');
    expect(summary && summary.textContent).toContain("must not be negative");
    fireEvent.change(targetInputs[0], { target: { value: "8" } });
    fireEvent.click(document.querySelector('[data-action="scenario-add-term"]') as HTMLElement);
    const termInputs = document.querySelectorAll('[data-field="scenario-term"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(termInputs[0], { target: { value: "0" } });
    summary = document.querySelector('[data-testid="issues-summary"]');
    expect(summary && summary.textContent).toContain("must be positive");
    fireEvent.change(termInputs[0], { target: { value: "5" } });
    const termRows = document.querySelectorAll('[data-action="scenario-remove-term"]');
    for (const btn of Array.from(termRows)) fireEvent.click(btn as HTMLElement);
    for (const btn of Array.from(document.querySelectorAll('[data-action="scenario-remove-term"]'))) fireEvent.click(btn as HTMLElement);
    summary = document.querySelector('[data-testid="issues-summary"]');
    expect(summary && summary.textContent).toContain("Scenario term list must not be empty");
  });
});
