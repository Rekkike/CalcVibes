import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const startField = () => document.querySelector('[data-testid="overview"] [data-field="startYear"]') as HTMLInputElement;
const error = () => document.querySelector('[data-testid="start-year-error"]')?.textContent ?? null;
const yearly = () => document.querySelector('[data-testid="yearly-table"]')?.textContent ?? "";

// v0.6.13 Task F (AUD-18): the writer refuses — an out-of-range start year never applies.
describe("AUD-18: the start-year writer refuses, symmetric with the file layer", () => {
  it("an out-of-range entry leaves the start year unchanged and shows the refusal", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.change(startField(), { target: { value: "1800" } });
    expect(error()).toBe("Project start year must be between 1900 and 2200.");
    fireEvent.click(byNav("results"));
    expect(yearly()).toContain("2026");
    expect(yearly()).not.toContain("1800");
  });

  it("a fractional entry refuses with the whole-year wording", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.change(startField(), { target: { value: "2030.5" } });
    expect(error()).toBe("Project start year must be a whole year between 1900 and 2200.");
    fireEvent.click(byNav("results"));
    expect(yearly()).toContain("2026");
  });

  it("a valid entry after a refusal applies and clears the refusal; an empty entry clears the year", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.change(startField(), { target: { value: "1800" } });
    fireEvent.change(startField(), { target: { value: "2030" } });
    expect(error()).toBeNull();
    fireEvent.click(byNav("results"));
    expect(yearly()).toContain("2030");
    fireEvent.click(byNav("overview"));
    fireEvent.change(startField(), { target: { value: "" } });
    expect(error()).toBeNull();
    fireEvent.click(byNav("results"));
    expect(yearly()).toContain("Year 1");
  });
});
