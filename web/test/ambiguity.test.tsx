import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultsSection } from "../src/sections/ResultsSection.js";
import type { ModelResult } from "../../core/src/types.js";
import { demoProject } from "../src/state.js";
import { computeModel } from "../src/engine.js";

function stubbedResult(overrides: Partial<ModelResult>): ModelResult {
  const base = computeModel(demoProject());
  return { ...base, ...overrides };
}

describe("ambiguity warning (stubbed result; documented limitation)", () => {
  it("renders the warning when irrAmbiguous is true", () => {
    const result = stubbedResult({ signChanges: 3, irrAmbiguous: true });
    render(<ResultsSection result={result} targetIrr={12} currency="EUR" />);
    const warning = screen.getByTestId("irr-ambiguity-warning");
    expect(warning.textContent).toContain("3 sign changes");
    expect(warning.textContent).toContain("may not be unique");
  });

  it("does not render the warning when irrAmbiguous is false", () => {
    const result = stubbedResult({ signChanges: 1, irrAmbiguous: false });
    render(<ResultsSection result={result} targetIrr={12} currency="EUR" />);
    expect(screen.queryByTestId("irr-ambiguity-warning")).toBeNull();
  });

  it("engine limitation of record: no constructible valid input produces an ambiguous net vector, because collections start after the last cost month", () => {
    const r = computeModel(demoProject());
    expect(r.signChanges).toBe(1);
    expect(r.irrAmbiguous).toBe(false);
  });
});
