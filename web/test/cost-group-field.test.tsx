import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { blankCostLine, blankProject } from "../src/state.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

// v0.6.15 Task A — the cost line editor gains the optional group input; blankProject carries none.
describe("the group input in the cost editor", () => {
  it("every cost line row carries a group input; editing it writes the free text", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const rows = Array.from(document.querySelectorAll('[data-kind="cost"]')) as HTMLElement[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.querySelector('[data-field="group"]')).toBeTruthy();
    const input = rows[0].querySelector('[data-field="group"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  Quay works  " } });
    const again = (document.querySelectorAll('[data-kind="cost"]')[0] as HTMLElement).querySelector('[data-field="group"]') as HTMLInputElement;
    expect(again.value).toBe("  Quay works  ");
  });

  it("a cleared group input empties the field (the line then falls back to its category label)", () => {
    render(<App />);
    fireEvent.click(byAction("new-project"));
    fireEvent.click(byNav("costs"));
    fireEvent.click(byAction("add-cost"));
    const input = document.querySelector('[data-kind="cost"] [data-field="group"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Land" } });
    fireEvent.change(document.querySelector('[data-kind="cost"] [data-field="group"]') as HTMLInputElement, { target: { value: "" } });
    expect((document.querySelector('[data-kind="cost"] [data-field="group"]') as HTMLInputElement).value).toBe("");
  });

  it("blankProject and blankCostLine carry no group", () => {
    expect(blankProject().costs).toEqual([]);
    expect("group" in blankCostLine("c1")).toBe(false);
  });
});
