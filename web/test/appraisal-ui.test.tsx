import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byStat = (v: string) => document.querySelector('[data-stat="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;

describe("chunk 6: appraisal section, residual, engine goalMet", () => {
  it("renders the appraisal summary from the engine with basis labels", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("appraisal"));
    expect(byStat("npvAtTarget").textContent).toBe("0");
    expect(byStat("npvAtWacc").textContent).toBe("1252822.99");
    expect(byStat("profitabilityIndex").textContent).toBe("1.17913");
    expect(byStat("discountedPaybackYears").textContent).toBe("8.47094");
    expect(byStat("mirr").textContent).toBe("8.75686%");
    expect(byStat("goalMet").textContent).toBe("Target achieved");
    const summary = document.querySelector('[data-testid="appraisal-summary"]') as HTMLElement;
    expect(summary.textContent).toContain("discounted at WACC");
    expect(summary.textContent).toContain("NPV collections at WACC / NPV costs at WACC");
  });

  it("residual input is visible, labeled as collections-side, and lowers the payment live", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("appraisal"));
    expect(document.body.textContent).toContain("terminal inflow on the collections side");
    expect((byField("residualAmount") as HTMLInputElement).value).toBe("0");
    fireEvent.change(byField("residualAmount"), { target: { value: "1000000" } });
    fireEvent.click(byNav("overview"));
    expect(byStat("paymentAmount").textContent).toBe("452235.7");
  });

  it("residual validation issues surface next to the fields", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("appraisal"));
    fireEvent.change(byField("residualAmount"), { target: { value: "1000000" } });
    fireEvent.change(byField("residualYear"), { target: { value: "1.5" } });
    expect(screen.getByTestId("issues-summary").textContent).toContain("The set-price disposition requires a sale year that is an integer of at least 1.");
  });

  it("results section displays the engine goalMet flag", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    expect(screen.getByTestId("goal-check").textContent).toContain("target achieved");
  });

  it("the real ambiguity case renders the warning from an engine result", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("appraisal"));
    fireEvent.change(byField("residualAmount"), { target: { value: "2000000" } });
    fireEvent.change(byField("residualYear"), { target: { value: "1" } });
    fireEvent.click(byNav("results"));
    const warning = screen.getByTestId("irr-ambiguity-warning");
    expect(warning.textContent).toContain("3 sign changes");
    expect(warning.textContent).toContain("may not be unique");
  });
});

describe("chunk 7: modes, scenarios, sensitivity in the UI", () => {
  it("mode selector surfaces the Mode B/C payment input", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("repayment"));
    expect(document.querySelector('[data-field="modePayment"]')).toBeNull();
    fireEvent.change(byField("mode"), { target: { value: "B" } });
    expect(document.querySelector('[data-field="modePayment"]')).toBeTruthy();
    expect((document.querySelector('[data-field="modePayment"]') as HTMLInputElement).value).toBe("400000");
    fireEvent.change(byField("mode"), { target: { value: "C" } });
    expect(document.querySelector('[data-field="modePayment"]')).toBeTruthy();
  });

  it("scenarios view renders the three named sets with engine figures", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    expect(byStat("basePayment").textContent).toBe("475309.13");
    expect(byStat("optPayment").textContent).toBe("356830.02");
    expect(byStat("pesPayment").textContent).toBe("629065.46");
  });

  it("sensitivity view renders the tornado and both two-way tables", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    expect(screen.getByTestId("tornado-table").querySelectorAll("tbody tr").length).toBe(4);
    expect(screen.getByTestId("term-target-table").textContent).toContain("525633.48");
    expect(screen.getByTestId("balloon-term-table").textContent).toContain("601755.85");
  });
});
