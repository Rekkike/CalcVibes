import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { percentForDisplay, roundForDisplay } from "../src/engine.js";
import { yearHeader, demoProject } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;

// v0.6.7 re-anchor: the port fixture has signChanges 1, so the ambiguity warning cannot arise
// from the loaded demo. The real ambiguity case (signChanges 55) is re-pointed to the internal
// Alpha template via the project-file route, which loads the same project the old demo button loaded.
async function openAlpha() {
  const text = serializeProject(demoProject(), { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  const file = new File([text], "project-alpha.calcvibes.json", { type: "application/json" });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Project Alpha")).toBeTruthy();
  });
}

describe("chunk 5: operating, maintenance, override, settings surfaces", () => {
  it("operating lines: add, edit, remove; effective windows display from engine data (v0.6.7 re-anchor: the port fixture carries o1/o2, so the added line is o3; entry unit thousands, EUR)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("operating"));
    fireEvent.click(byAction("add-operating"));
    const count = () => document.querySelectorAll('[data-kind="operating"]').length;
    expect(count()).toBe(3);
    expect(screen.getByTestId("issues-summary").textContent).toContain("Operating line o3");
    fireEvent.change(document.querySelector('[data-line="o3"] [data-field="opLabel"]') as HTMLElement, { target: { value: "Rent" } });
    fireEvent.change(document.querySelector('[data-line="o3"] [data-field="opAmount"]') as HTMLElement, { target: { value: "120000" } });
    fireEvent.change(document.querySelector('[data-line="o3"] [data-field="opStartYear"]') as HTMLElement, { target: { value: "3" } });
    fireEvent.change(document.querySelector('[data-line="o3"] [data-field="opYearCount"]') as HTMLElement, { target: { value: "8" } });
    expect(screen.queryByTestId("issues-summary")).toBeNull();
    const info = document.querySelector('[data-line="o3"] [data-testid="operating-info"]');
    expect(info).toBeTruthy();
    expect(info && info.textContent).toContain("effective window 36–120");
    expect(info && info.textContent).toContain("total €850 000,00 k");
  });

  it("maintenance: percent mode with the rule-of-thumb hint; the derived line renders with its basis (v0.6.7 re-anchor: the port fixture's capex base)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("operating"));
    expect(document.body.textContent).toContain("Percent of CAPEX per year");
    fireEvent.change(byField("maintenanceMode"), { target: { value: "percent" } });
    expect(document.body.textContent).toContain("Percent per year");
    expect(document.body.textContent).toContain("rule of thumb: 0.5% of CAPEX per year");
    const derived = document.querySelector('[data-testid="maintenance-derived"]');
    expect(derived && derived.textContent).toContain("0.5% of total CAPEX");
    expect(derived && derived.textContent).toContain("36–275");
    // v0.6.10 re-anchor: the program fixture's capex base is the two capex lines
    // (100 M quay cabling + 20 M cruise terminal = 120 M); 0.5% per year over the
    // 20-year window (months 36–275) totals 12 000 000 → €12 000,00 k at entry thousands.
    expect(derived && derived.textContent).toContain("€12 000,00 k");
  });

  it("override: setting the first collection year disables grace and surfaces the message when grace is nonzero (v0.6.10 re-anchor: the program loader presets start year 2026, so the field is calendar-semantics — the entry 2027 converts to model year 2)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("repayment"));
    fireEvent.change(byField("firstCollectionYear"), { target: { value: "2027" } });
    expect((byField("graceYears") as HTMLInputElement).disabled).toBe(true);
    expect((byField("graceYears") as HTMLInputElement).value).toBe("0");
    fireEvent.change(byField("graceYears"), { target: { value: "1" } });
    fireEvent.change(byField("firstCollectionYear"), { target: { value: "2027" } });
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

  it("Mode B results render in the results panel (v0.6.10 re-anchor: the mode solves run gross of funding — the term-20 payment on the gross basis is 4017471.445590696, entry unit ones; the default 400000 is infeasible on the program base)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("repayment"));
    fireEvent.change(byField("mode"), { target: { value: "B" } });
    fireEvent.change(byField("entryUnit"), { target: { value: "ones" } });
    fireEvent.change(byField("modePayment"), { target: { value: "4017471.445590696" } });
    fireEvent.click(byNav("results"));
    expect(screen.getByTestId("mode-results").textContent).toContain("Solved term: 20 years (240 payments; last payment month 275)");
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

  it("the ambiguity disclosure renders from the real engine result for the MAINT case (signChanges 55)", async () => {
    render(<App />);
    await openAlpha();
    fireEvent.click(byNav("operating"));
    fireEvent.change(byField("maintenanceMode"), { target: { value: "percent" } });
    fireEvent.click(byNav("results"));
    const warning = screen.getByTestId("irr-ambiguity-warning");
    // v0.6.11 re-anchor (Task D surface): the engine-composed operational note verbatim
    // (scratch-verified on this fixture — signChanges 55, headlineSource yearly).
    expect(warning.textContent).toContain(
      "The net flow alternates 55 times beyond the funding pattern - collections below operating costs or one-off cost spikes can do this - so the IRR may not be unique; the yearly-aggregate rate is shown. The NPV at WACC and the MIRR remain the reliable criteria, and the operating years at the alternations merit a look."
    );
  });

  it("display round pin retained", () => {
    expect(roundForDisplay(1234.567)).toBe(1234.57);
  });
});
