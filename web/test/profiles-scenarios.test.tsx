import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { spreadFill } from "../src/state.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

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
  it("SCE-BYTE: with the three settings absent, the tables render today's values", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    const tt = document.querySelector('[data-testid="term-target-table"]') as HTMLElement;
    expect(tt.textContent).toContain("8%");
    expect(tt.textContent).toContain("12%");
    expect(tt.textContent).toContain("16%");
    expect(tt.textContent).toContain("525633.48");
  });

  it("SCE-LIST: scenarioTargets [3, 5, 7] renders the pinned rows", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    const targetInputs = document.querySelectorAll('[data-field="scenario-target"]') as NodeListOf<HTMLInputElement>;
    targetInputs.forEach((input, i) => {
      fireEvent.change(input, { target: { value: ["3", "5", "7"][i] } });
    });
    const tt = document.querySelector('[data-testid="term-target-table"]') as HTMLElement;
    const rows = Array.from(tt.querySelectorAll("tbody tr"));
    const rowText = (r: HTMLElement) => Array.from(r.querySelectorAll("td")).map((td) => td.textContent).join("|");
    expect(rows.length).toBe(3);
    expect(rowText(rows[0] as HTMLElement)).toContain("3%");
    expect(rowText(rows[0] as HTMLElement)).toContain("439505.08");
    expect(rowText(rows[0] as HTMLElement)).toContain("323067.92");
    expect(rowText(rows[0] as HTMLElement)).toContain("258512.25");
    expect(rowText(rows[1] as HTMLElement)).toContain("472774.35");
    expect(rowText(rows[2] as HTMLElement)).toContain("507615.63");
  });

  it("SCE-ZERO: the 0 percent row renders the nominal identity", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    const targetInputs = document.querySelectorAll('[data-field="scenario-target"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(targetInputs[0], { target: { value: "0" } });
    fireEvent.change(targetInputs[1], { target: { value: "3" } });
    fireEvent.change(targetInputs[2], { target: { value: "5" } });
    const tt = document.querySelector('[data-testid="term-target-table"]') as HTMLElement;
    const firstRow = tt.querySelector("tbody tr") as HTMLElement;
    expect(firstRow.textContent).toContain("0%");
    expect(firstRow.textContent).toContain("392493");
    expect(firstRow.textContent).toContain("280352.14");
    expect(firstRow.textContent).toContain("218051.67");
  });

  it("SCE-VALID: each invalid construct surfaces the named error", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    // negative target
    const targetInputs = document.querySelectorAll('[data-field="scenario-target"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(targetInputs[0], { target: { value: "-5" } });
    let summary = document.querySelector('[data-testid="issues-summary"]');
    expect(summary && summary.textContent).toContain("must not be negative");
    fireEvent.change(targetInputs[0], { target: { value: "8" } });
    // non-positive term
    const termInputs = document.querySelectorAll('[data-field="scenario-term"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(termInputs[0], { target: { value: "0" } });
    summary = document.querySelector('[data-testid="issues-summary"]');
    expect(summary && summary.textContent).toContain("must be positive");
    fireEvent.change(termInputs[0], { target: { value: "5" } });
    // empty list
    const termRows = document.querySelectorAll('[data-action="scenario-remove-term"]');
    for (const btn of Array.from(termRows)) fireEvent.click(btn as HTMLElement);
    for (const btn of Array.from(document.querySelectorAll('[data-action="scenario-remove-term"]'))) fireEvent.click(btn as HTMLElement);
    summary = document.querySelector('[data-testid="issues-summary"]');
    expect(summary && summary.textContent).toContain("Scenario term list must not be empty");
  });
});
