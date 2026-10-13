import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { demoProject } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byStat = (v: string) => document.querySelector('[data-stat="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;

// v0.6.7 re-anchor: the port fixture's residual posture is "none", so the residual UI controls
// are inert on the loaded demo. The residual behaviors (set-price residual, its validation,
// and the real ambiguity case) are re-pointed to the internal Alpha template via the
// project-file route, which loads the same project the old demo button loaded.
async function openAlpha() {
  const text = serializeProject(demoProject(), { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  const file = new File([text], "project-alpha.calcvibes.json", { type: "application/json" });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Project Alpha")).toBeTruthy();
  });
}

describe("chunk 6: appraisal section, residual, engine goalMet", () => {
  it("renders the appraisal summary from the engine with basis labels (v0.6.7 re-anchor: the port fixture at entry unit thousands, EUR)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("appraisal"));
    expect(byStat("npvAtTarget").textContent).toBe("-€0,00 k");
    expect(byStat("npvAtWacc").textContent).toBe("€27 497,14 k");
    expect(byStat("profitabilityIndex").textContent).toBe("€0,00 k");
    expect(byStat("discountedPaybackYears").textContent).toBe("18.3685");
    expect(byStat("mirr").textContent).toBe("4.49028%");
    expect(byStat("goalMet").textContent).toBe("Target achieved");
    const summary = document.querySelector('[data-testid="appraisal-summary"]') as HTMLElement;
    expect(summary.textContent).toContain("discounted at WACC");
    expect(summary.textContent).toContain("NPV collections at WACC / NPV costs at WACC");
  });

  it("residual input is visible, labeled as collections-side, and lowers the payment live (re-pointed to the Alpha template via the project-file route)", async () => {
    render(<App />);
    await openAlpha();
    fireEvent.click(byNav("appraisal"));
    expect(document.body.textContent).toContain("terminal inflow on the collections side");
    expect((byField("residualAmount") as HTMLInputElement).value).toBe("0");
    fireEvent.change(byField("residualAmount"), { target: { value: "1000" } });
    fireEvent.click(byNav("overview"));
    expect(byStat("paymentAmount").textContent).toBe("452 tkr");
  });

  it("residual validation issues surface next to the fields (re-pointed to the Alpha template via the project-file route)", async () => {
    render(<App />);
    await openAlpha();
    fireEvent.click(byNav("appraisal"));
    fireEvent.change(byField("residualAmount"), { target: { value: "1000" } });
    fireEvent.change(byField("residualYear"), { target: { value: "1.5" } });
    expect(screen.getByTestId("issues-summary").textContent).toContain("The set-price disposition requires a sale year that is an integer of at least 1.");
  });

  it("results section displays the engine goalMet flag", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    expect(screen.getByTestId("goal-check").textContent).toContain("target achieved");
  });

  it("the real ambiguity case renders the warning from an engine result (re-pointed to the Alpha template via the project-file route)", async () => {
    render(<App />);
    await openAlpha();
    fireEvent.click(byNav("appraisal"));
    fireEvent.change(byField("residualAmount"), { target: { value: "2000" } });
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
    expect((document.querySelector('[data-field="modePayment"]') as HTMLInputElement).value).toBe("400");
    fireEvent.change(byField("mode"), { target: { value: "C" } });
    expect(document.querySelector('[data-field="modePayment"]')).toBeTruthy();
  });

  it("scenarios view renders the three named sets with engine figures (v0.6.7 re-anchor: the port fixture)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    expect(byStat("basePayment").textContent).toBe("€1 626,22 k");
    expect(byStat("optPayment").textContent).toBe("€1 299,27 k");
    expect(byStat("pesPayment").textContent).toBe("€2 002,40 k");
  });

  it("sensitivity view renders the tornado and both two-way tables (v0.6.7 re-anchor: the port loader presets the axes, so the tables compute)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    const tornado = screen.getByTestId("tornado-table");
    expect(tornado.querySelectorAll("tbody tr").length).toBe(4);
    const factors = Array.from(tornado.querySelectorAll("tbody tr")).map((tr) => tr.getAttribute("data-factor"));
    expect(factors).toEqual(["burn", "targetIrr", "term", "escalation"]);
    // The preset axes [4, 6, 8] x [15, 20, 25] and balloons [0, 8, 16] x terms [15, 20, 25]
    // now compute: three rows each, no empty states.
    const tt = screen.getByTestId("term-target-table");
    expect(tt.querySelectorAll("tbody tr").length).toBe(3);
    const ttBase = tt.querySelectorAll("tbody tr")[1].querySelectorAll("td")[2].textContent;
    expect(ttBase).toBe("€1 626,22 k");
    const bt = screen.getByTestId("balloon-term-table");
    expect(bt.querySelectorAll("tbody tr").length).toBe(3);
    const btBase = bt.querySelectorAll("tbody tr")[1].querySelectorAll("td")[1].textContent;
    expect(btBase).toBe("€1 626,22 k");
    expect(screen.queryByTestId("term-target-empty")).toBeNull();
    expect(screen.queryByTestId("balloon-term-empty")).toBeNull();
  });
});
