import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

describe("EX-5 edges", () => {
  it("blank project: the presentation renders without crashing; an invalid model disables the actions with a visible reason", () => {
    render(<App />);
    fireEvent.click(byAction("present"));
    expect(document.querySelector('[data-slide-name="title"]')).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });

    // make the result invalid: a cost line with an empty name
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const nameInput = document.querySelector('[data-line="c1"] [data-field="name"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "" } });
    const xlsx = byAction("export-xlsx") as HTMLButtonElement;
    const pdfBtn = byAction("download-pdf") as HTMLButtonElement;
    expect(xlsx.disabled).toBe(true);
    expect(pdfBtn.disabled).toBe(true);
    const reason = document.querySelector('[data-testid="export-disabled-reason"]');
    expect(reason && reason.textContent).toContain("XLSX and PDF export are disabled until the input issues are resolved");
    // Print deck intentionally opens the placeholder deck on an invalid model (v0.5.2 Task C, observation 2)
    expect((byAction("print-deck") as HTMLButtonElement).disabled).toBe(false);
  });

  it("an unrecognized legacy currency string surfaces as an issue, collect-all", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const currencySelect = document.querySelector('[data-field="currency"]') as HTMLSelectElement;
    const foreign = document.createElement("option");
    foreign.value = "XYZ";
    foreign.text = "XYZ";
    currencySelect.add(foreign);
    fireEvent.change(currencySelect, { target: { value: "XYZ" } });
    const summary = document.querySelector('[data-testid="issues-summary"]');
    expect(summary && summary.textContent).toContain("not a recognized currency");
  });

  it("the demo and golden template load green after the schema v6 migration", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    expect(document.querySelector('[data-testid="issues-summary"]')).toBeNull();
  });
});

describe("EX-4 route A: print stylesheet", () => {
  it("the print action exists and the stylesheet carries the print rules", async () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    expect(byAction("print-deck")).toBeTruthy();
    const fs = await import("fs");
    const css = fs.readFileSync("src/index.css", "utf8");
    expect(css).toContain("@media print");
    expect(css).toContain("page-break-after: always");
  });
});

describe("Task F: template legacy currency field removed", () => {
  it("demoProject().currency is SEK before and after (behavior unchanged)", async () => {
    const { demoProject } = await import("../src/state.js");
    expect(demoProject().currency).toBe("SEK");
    const fs = await import("fs");
    const raw = JSON.parse(fs.readFileSync("../data/template-project.json", "utf8"));
    expect(raw.currency).toBeUndefined();
    expect(raw.settings.currency).toBe("SEK");
    expect(raw.schemaVersion).toBe(8);
  });
});
