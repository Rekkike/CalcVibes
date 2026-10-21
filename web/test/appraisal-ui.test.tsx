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
  it("renders the appraisal summary from the engine with basis labels (v0.6.10 re-anchor: the program fixture at entry unit thousands, EUR)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("appraisal"));
    expect(byStat("npvAtTarget").textContent).toBe("-€0,00 k");
    expect(byStat("npvAtWacc").textContent).toBe("€52 409,25 k"); // npvAtWacc 52409252.63203347, scratch-verified
    // v0.6.13 Task C (AUD-11) re-anchor: the profitability index is a dimensionless ratio (the deck dscr form), 1.1010015272787173
    expect(byStat("profitabilityIndex").textContent).toBe("1.10");
    expect(byStat("discountedPaybackYears").textContent).toBe("18.23938"); // 18.23938311386264
    expect(byStat("mirr").textContent).toBe("4.42677%"); // 0.044267690561307305
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
    // v0.6.11 re-anchor (Task D surface): the engine-composed operational note verbatim
    // (scratch-verified on this fixture — signChanges 3, headlineSource yearly).
    expect(warning.textContent).toContain(
      "The net flow alternates 3 times beyond the funding pattern - collections below operating costs or one-off cost spikes can do this - so the IRR may not be unique; the yearly-aggregate rate is shown. The NPV at WACC and the MIRR remain the reliable criteria, and the operating years at the alternations merit a look."
    );
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

  it("scenarios view renders the per-variant named-set outcomes (v0.6.11 re-anchor, Task E: the program optimistic variant needs a term the declared tariff span cannot cover; base and pessimistic compute)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    // v0.6.11 Task E: each variant recomputes under its own stated terms (the framing line
    // of record); the optimistic variant refuses under its terms and carries the engine's
    // reason beside its row; the base and pessimistic variants compute their solved payments.
    expect(document.querySelector('[data-testid="scenarios-framing"]')?.textContent).toBe(
      "Scenarios are optional realities: each recomputes under its own stated terms; a variant that cannot exist under its terms is shown as exactly that, with the reason beside it."
    );
    const refusal = document.querySelector('[data-testid="scenario-refusal-optimistic"]') as HTMLElement;
    expect(refusal.textContent).toBe("Invalid model inputs: The required collections extend to year 24, beyond the declared tariff span (years 3-23): widen the tariff span or shorten the term.");
    expect(document.querySelector('[data-testid="scenario-refusal-base"]')).toBeNull();
    expect(document.querySelector('[data-testid="scenario-refusal-pessimistic"]')).toBeNull();
    expect(document.querySelector('[data-stat="basePayment"]')?.textContent).toBe("€2 843 k"); // the solved payment pin 2843365.6055825967 at the fee formatter
    expect(document.querySelector('[data-stat="optPayment"]')?.textContent).toBe("—");
    expect(document.querySelector('[data-stat="pesPayment"]')?.textContent).toBe("€3 709 k"); // the solved payment pin 3708855.5523114554 at the fee formatter
  });

  it("sensitivity view renders the tornado with its honest refused cell and both two-way tables with honest cells (v0.6.11 re-anchor, Task E: the program loader presets the axes; the term-high tornado cell needs a term the declared tariff span cannot cover)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    // v0.6.11 Task E: the tornado always renders — each cell recomputes under its own stated
    // terms; the term-high cell refuses under its terms and carries the engine's reason
    // inline. The four rows carry the Task B pins at the fee formatter (scratch-verified).
    const tornadoTable = screen.getByTestId("tornado-table");
    expect(tornadoTable.querySelectorAll("tbody tr").length).toBe(4);
    const burnRow = tornadoTable.querySelector('tr[data-factor="burn"]') as HTMLElement;
    expect(burnRow.querySelectorAll("td")[1].textContent).toBe("€2 516 k"); // 2516090.5615513995
    expect(burnRow.querySelectorAll("td")[2].textContent).toBe("€3 171 k"); // 3170640.6496137977
    const targetRow = tornadoTable.querySelector('tr[data-factor="targetIrr"]') as HTMLElement;
    expect(targetRow.querySelectorAll("td")[1].textContent).toBe("€2 489 k"); // 2489496.3612990044
    expect(targetRow.querySelectorAll("td")[2].textContent).toBe("€3 233 k"); // 3233058.949475011
    const termRow = tornadoTable.querySelector('tr[data-factor="term"]') as HTMLElement;
    expect(termRow.querySelectorAll("td")[1].textContent).toBe("€2 902 k"); // the low pin 2901863.049251351
    const termHigh = termRow.querySelectorAll("td")[2];
    expect(termHigh.getAttribute("data-cell-refusal")).toBe("true");
    expect(termHigh.textContent).toBe("— Invalid model inputs: The required collections extend to year 24, beyond the declared tariff span (years 3-23): widen the tariff span or shorten the term.");
    const escRow = tornadoTable.querySelector('tr[data-factor="escalation"]') as HTMLElement;
    expect(escRow.querySelectorAll("td")[1].textContent).toBe("€2 821 k"); // 2821372.917165251
    expect(escRow.querySelectorAll("td")[2].textContent).toBe("€2 866 k"); // 2865574.620200431
    // The preset axes [4, 6, 8] x [15, 20, 25] and balloons [0, 8, 16] x terms [15, 20, 25]
    // compute: three rows each, no empty states; the term-25 cells carry the honest refusal.
    const tt = screen.getByTestId("term-target-table");
    expect(tt.querySelectorAll("tbody tr").length).toBe(3);
    const ttBase = tt.querySelectorAll("tbody tr")[1].querySelectorAll("td")[2].textContent;
    expect(ttBase).toBe("€2 843 k"); // the solved payment pin 2843365.6055825967 at the fee formatter
    const ttRefused = tt.querySelectorAll("tbody tr")[1].querySelectorAll("td")[3].textContent;
    expect(ttRefused).toBe("refused: Invalid model inputs: The required collections extend to year 24, beyond the declared tariff span (years 3-23): widen the tariff span or shorten the term.");
    const bt = screen.getByTestId("balloon-term-table");
    expect(bt.querySelectorAll("tbody tr").length).toBe(3);
    const btBase = bt.querySelectorAll("tbody tr")[1].querySelectorAll("td")[1].textContent;
    expect(btBase).toBe("€2 843 k");
    const btRefused = bt.querySelectorAll("tbody tr")[2].querySelectorAll("td")[1].textContent;
    expect(btRefused).toBe("refused: Invalid model inputs: The required collections extend to year 24, beyond the declared tariff span (years 3-23): widen the tariff span or shorten the term.");
    expect(screen.queryByTestId("term-target-empty")).toBeNull();
    expect(screen.queryByTestId("balloon-term-empty")).toBeNull();
  });
});
