import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultsSection } from "../src/sections/ResultsSection.js";
import { computeModel } from "../src/engine.js";
import { demoProject } from "../src/state.js";
import type { ModelResult } from "../../core/src/types.js";

function resultWith(overrides: Partial<ModelResult>): ModelResult {
  const base = computeModel(demoProject());
  return { ...base, ...overrides };
}

describe("ambiguity warning display (component contract)", () => {
  it("renders the warning when irrAmbiguous is true", () => {
    const result = resultWith({ signChanges: 3, irrAmbiguous: true });
    render(<ResultsSection result={result} targetIrr={12} currency="EUR" />);
    const warning = screen.getByTestId("irr-ambiguity-warning");
    expect(warning.textContent).toContain("3 sign changes");
    expect(warning.textContent).toContain("may not be unique");
  });

  it("does not render the warning when irrAmbiguous is false", () => {
    const result = resultWith({ signChanges: 1, irrAmbiguous: false });
    render(<ResultsSection result={result} targetIrr={12} currency="EUR" />);
    expect(screen.queryByTestId("irr-ambiguity-warning")).toBeNull();
  });
});
