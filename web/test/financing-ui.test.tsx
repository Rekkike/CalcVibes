import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { demoProject } from "../src/state.js";
import { computeModel } from "../src/engine.js";
import { serializeProject } from "../../core/src/fileio.js";

// v0.6.7 re-anchor: the load-demo button now loads the port fixture, whose leveraged-solve
// cash flow has a single sign change, so the FN-1 ambiguity case (56 sign changes) is
// re-pointed to the internal Alpha template via the project-file route.
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
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;
const byStat = (v: string) => document.querySelector('[data-stat="' + v + '"]') as HTMLElement;

// v0.6.10 re-anchor: the program fixture arrives with financing enabled (share 0 with the
// per-line 31.69% overrides on the three container lines, 3.5% rate, term 20, grace 3), so
// the tests load the financing block instead of toggling it on from a disabled state.
function loadFinancing() {
  fireEvent.click(byAction("load-demo"));
  fireEvent.click(byNav("financing"));
}

describe("chunk 5 web task 1: financing section", () => {
  it("renders the full configuration surface when enabled (v0.6.10 re-anchor: the program fixture arrives enabled with its preset values)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("financing"));
    // Enabled on arrival: the surface and the preset values render without any toggle.
    expect((document.querySelector('[data-field="finEnabled"]') as HTMLInputElement).checked).toBe(true);
    expect((document.querySelector('[data-field="finShare"]') as HTMLInputElement).value).toBe("0");
    expect((document.querySelector('[data-field="finRate"]') as HTMLInputElement).value).toBe("3.5");
    expect((document.querySelector('[data-field="finTerm"]') as HTMLInputElement).value).toBe("20");
    expect((document.querySelector('[data-field="finGrace"]') as HTMLInputElement).value).toBe("3");
    expect(document.querySelector('[data-field="finStart"]')).toBeTruthy();
    expect(document.querySelector('[data-field="finAmortization"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-field="finLineShare"]').length).toBe(6);
    expect(document.querySelector('[data-field="finLeveraged"]')).toBeTruthy();
    // Toggling off removes the surface; toggling on restores it.
    fireEvent.click(byField("finEnabled"));
    expect(document.querySelector('[data-field="finShare"]')).toBeNull();
    fireEvent.click(byField("finEnabled"));
    expect(document.querySelector('[data-field="finShare"]')).toBeTruthy();
  });

  it("per-line overrides default to the project share and are editable (v0.6.10 re-anchor: the fixture presets 31.69 on p1)", () => {
    render(<App />);
    loadFinancing();
    const p1 = document.querySelector('[data-field="finLineShare"][data-line="p1"]') as HTMLInputElement;
    expect(p1.value).toBe("31.69");
    fireEvent.change(p1, { target: { value: "80" } });
    expect(p1.value).toBe("80");
  });
});

describe("chunk 5 web tasks 2-3: results panels and disclosures", () => {
  it("the equity panel renders engine-emitted data with the ambiguity disclosure (FN-1 class, 56 sign changes; re-pointed to the Alpha template via the project-file route)", async () => {
    render(<App />);
    await openAlpha();
    fireEvent.click(byNav("financing"));
    fireEvent.click(byField("finEnabled"));
    fireEvent.click(byNav("results"));
    expect(byStat("equityOutlay").textContent).toBe("3139944");
    expect(byStat("equityNpvAtWacc").textContent).toBe("1593384.3");
    const warning = document.querySelector('[data-testid="equity-ambiguity-warning"]');
    expect(warning && warning.textContent).toContain("56 sign changes");
    expect(warning && warning.textContent).toContain("may not be unique");
    expect(byStat("equityIrr").textContent).toContain("20.00612%");
  });

  it("the debt schedule and DSCR tables render engine data; the minimum DSCR is highlighted (v0.6.10 re-anchor: the fixture's per-line 31.69% debt on the three container lines — drawn total 89 999 600 at the 3.5% annuity over 20 years with grace 3)", () => {
    render(<App />);
    loadFinancing();
    fireEvent.click(byNav("results"));
    const debt = document.querySelector('[data-testid="debt-schedule"]');
    // The grace years 4–6 are interest-only at 3 206 705.47 per year; the annuity
    // service from year 7 is 7 241 944.09 with the final-year interest 133 349.53
    // (engine-emitted, script-verified).
    expect(debt && debt.textContent).toContain("3206705.47");
    expect(debt && debt.textContent).toContain("4099568.51");
    expect(debt && debt.textContent).toContain("133349.53");
    const dscr = document.querySelector('[data-testid="dscr-table"]');
    expect(dscr && dscr.textContent).toContain("4.5734");
    const minRow = dscr && dscr.querySelector('[data-dscr-min="true"]');
    expect(minRow).toBeTruthy();
    expect(document.querySelector('[data-testid="min-dscr"]')?.textContent).toContain("4.3189");
    expect(document.querySelector('[data-testid="min-dscr"]')?.textContent).toContain("2048");
  });

  it("the zero-outlay note renders in place of the null equity IRR (FN-5 class) (v0.6.10 re-anchor: a 100% share with the service start moved to year 6 keeps every debt-funded cost inside the service window on the program base)", () => {
    render(<App />);
    loadFinancing();
    fireEvent.change(byField("finShare"), { target: { value: "100" } });
    // The fixture's per-line overrides (31.69 on p1–p3) would keep the container lines
    // partially equity-funded; raise them to the full share as well.
    for (const line of ["p1", "p2", "p3"]) {
      fireEvent.change(document.querySelector('[data-field="finLineShare"][data-line="' + line + '"]') as HTMLElement, { target: { value: "100" } });
    }
    fireEvent.change(byField("finStart"), { target: { value: "6" } });
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
  it("with the toggle on (Mode A), the displayed payment is the leveraged figure P_L (v0.6.10 re-anchor: the fixture's per-line debt — the leveraged solve lands the equity at the 6% target with the payment 2698180.689756401 → €2 698 k at entry thousands)", () => {
    render(<App />);
    loadFinancing();
    fireEvent.click(byField("finLeveraged"));
    fireEvent.click(byNav("overview"));
    expect(byStat("paymentAmount").textContent).toBe("\u20ac2 698 k");
  });

  it("FIN-LEVERAGED-MODE surfaces for fixed tariff mode (v0.6.10 re-anchor: the financing arrives enabled, so no toggle is needed before the leveraged click)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("tariff"));
    fireEvent.change(byField("tariffMode"), { target: { value: "fixed" } });
    fireEvent.change(document.querySelector('[data-field="tariffFixed"]') as HTMLElement, { target: { value: "600000" } });
    fireEvent.click(byNav("financing"));
    fireEvent.click(byField("finLeveraged"));
    const summary = document.querySelector('[data-testid="issues-summary"]');
    expect(summary && summary.textContent).toContain("FIN-LEVERAGED-MODE");
  });
});
