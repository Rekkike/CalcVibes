import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { demoProject } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs } from "../../core/src/types.js";

const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;

async function openProject(inputs: ModelInputs) {
  render(<App />);
  const text = serializeProject(inputs, { startYear: null, entryUnit: "thousands", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  const file = new File([text], "p.calcvibes.json", { type: "application/json" });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Project Alpha")).toBeTruthy();
  });
}

// v0.6.12.2 Task F (AUD-8): the Repayment section renders the engine's Mode B refusals verbatim.
describe("AUD-8: the Repayment section renders the term-solver refusals", () => {
  it("SCE-CONTRACTS: two solved contracts", async () => {
    const solved = (id: string, startYear: number) => ({ id, label: id, startYear, termYears: 5, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" as const });
    await openProject({ ...demoProject(), contracts: [solved("k1", 2), solved("k2", 3)] });
    fireEvent.click(byNav("repayment"));
    fireEvent.change(byField("mode"), { target: { value: "B" } });
    expect(screen.getByTestId("mode-refusal").textContent).toBe("The term solver applies to exactly one solved contract; this project carries 2 solved contracts (SCE-CONTRACTS).");
  });

  it("SCE-TARIFF: a tariff collection mode", async () => {
    await openProject({ ...demoProject(), tariff: { mode: "fixed", escalationPerYear: 0, rows: [], fixedAnnualAmount: 1500000, manualPrices: null } });
    fireEvent.click(byNav("repayment"));
    fireEvent.change(byField("mode"), { target: { value: "B" } });
    expect(screen.getByTestId("mode-refusal").textContent).toBe("The term solver requires the solved payment stream; tariff collection modes carry none (SCE-TARIFF).");
  });

  it("no refusal renders for Mode A or for a solvable project", async () => {
    await openProject(demoProject());
    fireEvent.click(byNav("repayment"));
    expect(screen.queryByTestId("mode-refusal")).toBeNull();
  });
});
