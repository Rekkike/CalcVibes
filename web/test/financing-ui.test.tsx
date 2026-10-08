import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { demoProject } from "../src/state.js";
import { computeModel } from "../src/engine.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;
const byStat = (v: string) => document.querySelector('[data-stat="' + v + '"]') as HTMLElement;

function enableFinancing() {
  fireEvent.click(byAction("load-demo"));
  fireEvent.click(byNav("financing"));
  fireEvent.click(byField("finEnabled"));
}

describe("chunk 5 web task 1: financing section", () => {
  it("renders the full configuration surface when enabled", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("financing"));
    expect(document.querySelector('[data-field="finShare"]')).toBeNull();
    fireEvent.click(byField("finEnabled"));
    expect(document.querySelector('[data-field="finShare"]')).toBeTruthy();
    expect(document.querySelector('[data-field="finRate"]')).toBeTruthy();
    expect(document.querySelector('[data-field="finTerm"]')).toBeTruthy();
    expect(document.querySelector('[data-field="finGrace"]')).toBeTruthy();
    expect(document.querySelector('[data-field="finStart"]')).toBeTruthy();
    expect(document.querySelector('[data-field="finAmortization"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-field="finLineShare"]').length).toBe(3);
    expect(document.querySelector('[data-field="finLeveraged"]')).toBeTruthy();
  });

  it("per-line overrides default to the project share and are editable", () => {
    render(<App />);
    enableFinancing();
    const c1 = document.querySelector('[data-field="finLineShare"][data-line="c1"]') as HTMLInputElement;
    expect(c1.value).toBe("60");
    fireEvent.change(c1, { target: { value: "80" } });
    expect(c1.value).toBe("80");
  });
});

describe("chunk 5 web tasks 2-3: results panels and disclosures", () => {
  it("the equity panel renders engine-emitted data with the ambiguity disclosure (FN-1 class, 56 sign changes)", () => {
    render(<App />);
    enableFinancing();
    fireEvent.click(byNav("results"));
    expect(byStat("equityOutlay").textContent).toBe("3139944");
    expect(byStat("equityNpvAtWacc").textContent).toBe("1593384.3");
    const warning = document.querySelector('[data-testid="equity-ambiguity-warning"]');
    expect(warning && warning.textContent).toContain("56 sign changes");
    expect(warning && warning.textContent).toContain("may not be unique");
    expect(byStat("equityIrr").textContent).toContain("20.00612%");
  });

  it("the debt schedule and DSCR tables render engine data; the minimum DSCR is highlighted", () => {
    render(<App />);
    enableFinancing();
    fireEvent.click(byNav("results"));
    const debt = document.querySelector('[data-testid="debt-schedule"]');
    expect(debt && debt.textContent).toContain("285287.37");
    expect(debt && debt.textContent).toContain("615109.58");
    const dscr = document.querySelector('[data-testid="dscr-table"]');
    expect(dscr && dscr.textContent).toContain("1.5837");
    const minRow = dscr && dscr.querySelector('[data-dscr-min="true"]');
    expect(minRow).toBeTruthy();
    expect(document.querySelector('[data-testid="min-dscr"]')?.textContent).toContain("1.5837");
  });

  it("the zero-outlay note renders in place of the null equity IRR (FN-5 class)", () => {
    render(<App />);
    fireEvent.click(byNav("financing"));
    fireEvent.click(byField("finEnabled"));
    fireEvent.change(byField("finShare"), { target: { value: "100" } });
    fireEvent.click(byNav("results"));
    expect(byStat("equityIrr").textContent).toContain("Not applicable (zero equity outlay)");
  });

  it("engine basis: the FN-1 figures flow through the UI import path", () => {
    const r = computeModel({ ...demoProject(), financing: { enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0, serviceStartYear: null, amortization: "annuity", leveragedSolve: false, perLineSharePct: {} } });
    expect(Math.abs((r.financing as { drawnTotal: number }).drawnTotal - 4709916)).toBeLessThan(0.01);
    expect(Math.abs(((r.financing as { equity: { irr: number | null } }).equity.irr as number) - 0.2000612172)).toBeLessThan(1e-6);
  });
});

describe("chunk 5 web task 4: leveraged toggle behavior", () => {
  it("with the toggle on (Mode A), the displayed payment is the leveraged figure P_L", () => {
    render(<App />);
    enableFinancing();
    fireEvent.click(byField("finLeveraged"));
    fireEvent.click(byNav("overview"));
    expect(byStat("paymentAmount").textContent).toBe("411017.66");
  });

  it("FIN-LEVERAGED-MODE surfaces for fixed tariff mode", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("tariff"));
    fireEvent.change(byField("tariffMode"), { target: { value: "fixed" } });
    fireEvent.change(document.querySelector('[data-field="tariffFixed"]') as HTMLElement, { target: { value: "600000" } });
    fireEvent.click(byNav("financing"));
    fireEvent.click(byField("finEnabled"));
    fireEvent.click(byField("finLeveraged"));
    const summary = document.querySelector('[data-testid="issues-summary"]');
    expect(summary && summary.textContent).toContain("FIN-LEVERAGED-MODE");
  });
});
