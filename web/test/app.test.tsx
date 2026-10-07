import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";


const byAction = (v: string) => {
  const els = Array.from(document.querySelectorAll('[data-action="' + v + '"]'));
  if (els.length === 0) throw new Error("no element with data-action=" + v);
  return els[0] as HTMLElement;
};
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byStat = (v: string) => document.querySelector('[data-stat="' + v + '"]') as HTMLElement;
const allByField = (v: string) => Array.from(document.querySelectorAll('[data-field="' + v + '"]')) as HTMLElement[];

describe("chunk 2: shell, blank start, demo load, validation panel", () => {
  it("opens on a blank new project with no fabricated data", () => {
    render(<App />);
    expect(screen.getByText("Untitled project")).toBeTruthy();
    expect(screen.queryByText(/Development team/)).toBeNull();
    expect(byStat("totalCost").textContent).toBe("0");
    expect(screen.queryByTestId("issues-summary")).toBeNull();
  });

  it("loads the demo project labeled as a demo and renders the baseline headline statistics", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    expect(screen.getByText("Project Alpha")).toBeTruthy();
    expect(byStat("paymentAmount").textContent).toBe("475309.13");
    expect(byStat("totalCost").textContent).toBe("7849860");
    expect(screen.queryByTestId("issues-summary")).toBeNull();
  });

  it("shows the issues summary and per-line issues when a line is invalid, and retains the user's input", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const nameInput = allByField("name")[0] as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "" } });
    const amountInput = allByField("amount")[0] as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "0" } });
    expect(screen.getByTestId("issues-summary")).toBeTruthy();
    expect(screen.getByTestId("issues-summary").textContent).toContain("Cost line c1 has an empty name.");
    expect(screen.getByTestId("issues-summary").textContent).toContain("has a non-positive amount.");
    expect((allByField("amount")[0] as HTMLInputElement).value).toBe("0");
    expect(screen.getByTestId("line-issues").textContent).toContain("empty name");
  });
});
