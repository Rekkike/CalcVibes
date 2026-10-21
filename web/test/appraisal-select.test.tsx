import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { demoProject } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs } from "../../core/src/types.js";

const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;
const stat = (v: string) => document.querySelector('[data-stat="' + v + '"]')?.textContent;

async function openProject(inputs: ModelInputs) {
  render(<App />);
  const text = serializeProject(inputs, { startYear: null, entryUnit: "ones", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  const file = new File([text], "p.calcvibes.json", { type: "application/json" });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Project Alpha")).toBeTruthy();
  });
}

// v0.6.13 Task D (AUD-12): the residual-mode select writes the full dual-seam state — the engine
// reads posture before mode, so a fixture that carries a posture must not shadow the select.
describe("AUD-12: the residual-mode select changes the model, not just a label", () => {
  const withPosture = (): ModelInputs => ({
    ...demoProject(),
    depreciationDefault: { mode: "straight-line", years: 40 },
    appraisal: { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "none", amount: 0, year: 5 } },
  });

  it("selecting Calculated on a posture-carrying project books the book-value residual", async () => {
    await openProject(withPosture());
    fireEvent.click(byNav("results"));
    expect(stat("residualUsed")).toBe("0");
    fireEvent.click(byNav("appraisal"));
    fireEvent.change(byField("residualMode"), { target: { value: "calculated" } });
    fireEvent.click(byNav("results"));
    expect(Number(stat("residualUsed")?.replace(/\s/g, "").replace(",", "."))).toBeGreaterThan(0);
  });

  it("selecting Set amount back leaves the amount editable and live", async () => {
    await openProject(withPosture());
    fireEvent.click(byNav("appraisal"));
    fireEvent.change(byField("residualMode"), { target: { value: "calculated" } });
    fireEvent.change(byField("residualMode"), { target: { value: "amount" } });
    fireEvent.change(byField("residualAmount"), { target: { value: "1000000" } });
    fireEvent.click(byNav("results"));
    expect(stat("residualUsed")).toContain("1");
    expect(stat("residualUsed")).not.toBe("0");
  });

  it("the select shows the effective mode of a project that carries only a posture", async () => {
    const inp = withPosture();
    inp.appraisal = { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { posture: "book-value", amount: 0, year: 5 } };
    await openProject(inp);
    fireEvent.click(byNav("appraisal"));
    expect((byField("residualMode") as HTMLSelectElement).value).toBe("calculated");
  });
});
