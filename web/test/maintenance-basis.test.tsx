import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { OperatingSection } from "../src/sections/OperatingSection.js";
import { moneyForDisplay } from "../src/engine.js";
import { computeModel } from "../../core/src/engine.js";
import type { ModelInputs } from "../../core/src/types.js";

// v0.6.12.2 Task A (AUD-3): the maintenance heading renders the basis the engine emitted on the
// maintenance entry — it never recomputes the capex total (the one-story rule).
const inputs = (): ModelInputs => ({
  projectName: "P", currency: "EUR", targetIrr: 8,
  costs: [{ id: "c1", name: "Capex", category: "capex", amount: 1, startYear: 1, durationYears: 1, escalation: 0, yearOverrides: { 1: 400000, 2: 600000 } }],
  repayment: { graceYears: 0, termYears: 5, paymentsPerYear: 1, paymentEscalation: 0, balloon: 0 },
  maintenance: { mode: "percent", percentPerYear: 1 },
});

const headingOf = (container: HTMLElement) => container.querySelector("h3")!.textContent;
const noop = () => {};

describe("AUD-3: the maintenance heading renders the emitted basis", () => {
  it("renders the profile-honoring basis the engine emitted", () => {
    const inp = inputs();
    const { container } = render(<OperatingSection inputs={inp} result={computeModel(inp)} setOperating={noop} setMaintenance={noop} entryUnit="ones" />);
    expect(headingOf(container)).toContain(moneyForDisplay(1000000, "EUR", "ones"));
  });

  it("renders the emitted field, not a recomputation", () => {
    const inp = inputs();
    const r = computeModel(inp);
    const doctored = { ...r, operatingLines: r.operatingLines.map((o) => (o.id === "maintenance" ? { ...o, basis: 777 } : o)) };
    const { container } = render(<OperatingSection inputs={inp} result={doctored} setOperating={noop} setMaintenance={noop} entryUnit="ones" />);
    expect(headingOf(container)).toContain(moneyForDisplay(777, "EUR", "ones"));
    expect(headingOf(container)).not.toContain(moneyForDisplay(1000000, "EUR", "ones"));
  });
});
