import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { percentForDisplay, roundForDisplay } from "../src/engine.js";
import { yearHeader } from "../src/state.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;

describe("chunk 5: operating, maintenance, override, settings surfaces", () => {
  it("operating lines: add, edit, remove; effective windows display from engine data", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("operating"));
    fireEvent.click(byAction("add-operating"));
    const count = () => document.querySelectorAll('[data-kind="operating"]').length;
    expect(count()).toBe(1);
    expect(screen.getByTestId("issues-summary").textContent).toContain("Operating line o1");
    fireEvent.change(document.querySelector('[data-line="o1"] [data-field="opLabel"]') as HTMLElement, { target: { value: "Rent" } });
    fireEvent.change(document.querySelector('[data-line="o1"] [data-field="opAmount"]') as HTMLElement, { target: { value: "120000" } });
    fireEvent.change(document.querySelector('[data-line="o1"] [data-field="opStartYear"]') as HTMLElement, { target: { value: "3" } });
    fireEvent.change(document.querySelector('[data-line="o1"] [data-field="opYearCount"]') as HTMLElement, { target: { value: "8" } });
    expect(screen.queryByTestId("issues-summary")).toBeNull();
    const info = document.querySelector('[data-testid="operating-info"]');
    expect(info).toBeTruthy();
    expect(info && info.textContent).toContain("effective window 36–117");
    expect(info && info.textContent).toContain("total 820000");
  });

  it("maintenance: percent mode with the rule-of-thumb hint; the derived line renders with its basis", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("operating"));
    expect(document.body.textContent).toContain("Percent of CAPEX per year");
    fireEvent.change(byField("maintenanceMode"), { target: { value: "percent" } });
    expect(document.body.textContent).toContain("Percent per year");
    expect(document.body.textContent).toContain("rule of thumb: 0.5% of CAPEX per year");
    const derived = document.querySelector('[data-testid="maintenance-derived"]');
    expect(derived && derived.textContent).toContain("0.5% of total CAPEX");
    expect(derived && derived.textContent).toContain("36–117");
  });

  it("override: setting the first collection year disables grace and surfaces the message when grace is nonzero", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("repayment"));
    fireEvent.change(byField("firstCollectionYear"), { target: { value: "2" } });
    expect((byField("graceYears") as HTMLInputElement).disabled).toBe(true);
    expect((byField("graceYears") as HTMLInputElement).value).toBe("0");
    fireEvent.change(byField("graceYears"), { target: { value: "1" } });
    fireEvent.change(byField("firstCollectionYear"), { target: { value: "2" } });
    expect(screen.getByTestId("issues-summary").textContent).toContain("grace must be zero");
  });

  it("indexation is relabeled with the 2% hint", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("repayment"));
    expect(document.body.textContent).toContain("Indexation (CPI) % per year");
    expect(document.body.textContent).toContain("rule of thumb: 2%");
  });

  it("settings: start year input accepts a value and blanks cleanly", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.change(byField("startYear"), { target: { value: "2026" } });
    expect((byField("startYear") as HTMLInputElement).value).toBe("2026");
    fireEvent.change(byField("startYear"), { target: { value: "" } });
    expect((byField("startYear") as HTMLInputElement).value).toBe("");
  });
});

describe("chunk 6: calendar headers, mode results, MIRR helper", () => {
  it("header helper: calendar years when set; Year-k when unset", () => {
    expect(yearHeader(1, 2026)).toBe("2026");
    expect(yearHeader(2, 2026)).toBe("2027");
    expect(yearHeader(1, null)).toBe("Year 1");
    expect(yearHeader(2, null)).toBe("Year 2");
  });

  it("results table uses calendar headers when the start year is set", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.change(byField("startYear"), { target: { value: "2026" } });
    fireEvent.click(byNav("results"));
    expect(screen.getByTestId("yearly-table").textContent).toContain("2026");
    expect(screen.getByTestId("yearly-table").textContent).not.toContain("Year 1");
  });

  it("Mode B results render in the results panel", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("repayment"));
    fireEvent.change(byField("mode"), { target: { value: "B" } });
    fireEvent.click(byNav("results"));
    expect(screen.getByTestId("mode-results").textContent).toContain("Solved term: 9.5 years (38 payments; last payment month 147)");
  });

  it("Mode C results render in the results panel", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("repayment"));
    fireEvent.change(byField("mode"), { target: { value: "C" } });
    fireEvent.click(byNav("results"));
    expect(screen.getByTestId("mode-results").textContent).toContain("Mode C");
    expect(screen.getByTestId("mode-results").textContent).toContain("target not achieved");
  });

  it("MIRR display-helper pin: percentForDisplay(0.08756864460323888) is 8.75686%", () => {
    expect(percentForDisplay(0.08756864460323888)).toBe("8.75686%");
    expect(percentForDisplay(null)).toBe("—");
  });

  it("the ambiguity disclosure renders from the real engine result for the MAINT case (signChanges 55)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("operating"));
    fireEvent.change(byField("maintenanceMode"), { target: { value: "percent" } });
    fireEvent.click(byNav("results"));
    const warning = screen.getByTestId("irr-ambiguity-warning");
    expect(warning.textContent).toContain("55 sign changes");
    expect(warning.textContent).toContain("may not be unique");
  });

  it("display round pin retained", () => {
    expect(roundForDisplay(1234.567)).toBe(1234.57);
  });
});
