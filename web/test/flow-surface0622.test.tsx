import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel } from "../src/engine.js";
import { composeFlow, shorePowerProgram } from "../src/state.js";
import { composeFlowSlide } from "../src/deck.js";

// v0.6.22 Task C/F — the Plan flow surface: the nav seat beside Timeline, the composed reading (the
// same composed model the deck consumes) with the per-year drill on the editor-scroll wrapper (the
// W25 parity ruling) inside the W24 two-column grid, the editor grammar (the pairing grid with the
// source and use selects, the MoneyEditor amount, the remove control, the add control with nextId,
// rows keyed by the stable generated id), and the named refusals rendering in the section.

const q = (sel: string) => document.querySelector(sel) as HTMLElement;
const qa = (sel: string) => Array.from(document.querySelectorAll(sel)) as HTMLElement[];

describe("v0.6.22 Task C — the Plan flow surface", () => {
  it("NAV: the Plan group carries flow beside timeline", () => {
    render(<App />);
    const plan = q('[data-nav-group="plan"]');
    const navs = qa('[data-nav-group="plan"] [data-nav]').map((b) => b.getAttribute("data-nav"));
    expect(navs).toEqual(["timeline", "flow"]);
    expect(plan.textContent).toContain("Flow");
  });

  it("READING: the surface renders the aggregated composition, the caption, the fungibility caption and the per-year drill with the signed remainder row", () => {
    render(<App />);
    fireEvent.click(q('[data-action="load-solar-demo"]'));
    fireEvent.click(q('[data-nav="flow"]'));
    const surface = q('[data-testid="flow-surface"]');
    expect(surface).toBeTruthy();
    expect(q('[data-testid="flow-fungibility"]').textContent).toContain("Cash is fungible");
    expect(q('[data-testid="flow-composition"]').getAttribute("data-form")).toBe("bands");
    expect(q('[data-testid="flow-bands"]')).toBeTruthy();
    expect(q('[data-testid="flow-caption"]').textContent).toContain("Flow surface in the app");
    expect(q('[data-stat="flow-remainder"]').textContent).toBeTruthy();
    // the W25 parity ruling: the drill rides the editor-scroll wrapper with the sticky name column
    const scroll = q('[data-testid="flow-drill-scroll"]');
    expect(scroll.className).toContain("editor-scroll");
    expect(q('[data-testid="flow-drill"]')).toBeTruthy();
    const remRow = q('[data-flow-drill-row="remainder"]');
    expect(remRow.getAttribute("data-signed")).toBe("true");
    // the solar demo runs 4 shortfall years: the drill shows them signed (data-negative), never hidden
    const negCells = qa('[data-flow-drill-row="remainder"] [data-negative="true"]');
    expect(negCells.length).toBe(4);
    expect(q('[data-testid="flow-shortfall-note"]').textContent).toContain("4 of 24 years run a shortfall");
    // the W24 two-column grid wrapper is present (the breakpoint CSS does the layout)
    expect(q(".flow-surface-grid")).toBeTruthy();
  });

  it("DRILL-TO-AGGREGATE: the drill rows reconcile to the composed aggregation by construction", () => {
    const inputs = shorePowerProgram();
    const result = computeModel(inputs);
    const flow = composeFlow(inputs, result);
    const view = composeFlowSlide(flow, (v) => String(v));
    // per-year bucket allocations sum to the aggregated connectors per bucket
    const bucketOf = (useKey: string) => (useKey === "equity:remainder" ? "Equity remainder" : useKey === "financing:service" ? "Debt service" : ({ operating: "Operating", maintenance: "Operating", reinvestment: "Reinvestment", cost: "Capital" } as Record<string, string>)[useKey.slice(0, useKey.indexOf(":"))] ?? useKey);
    for (const band of view.useBands) {
      const fromYears = flow.years.reduce((a, y) => a + y.allocations.filter((x) => bucketOf(x.useKey) === band.key).reduce((b, x) => b + x.amount, 0), 0);
      const fromConn = view.connectors.filter((c) => c.useKey === band.key).reduce((a, c) => a + c.raw, 0);
      expect(fromYears).toBeCloseTo(fromConn, 6); // every band: the per-year drill sums to its aggregated connectors
      if (band.key !== "Equity remainder" && band.raw > 0) {
        expect(fromConn).toBeCloseTo(Math.min(band.raw, flow.connectors.filter((c) => bucketOf(c.useKey) === band.key).reduce((a, c) => a + c.amount, 0)), 6);
      }
    }
    // the income side: per-year kind outflows sum to the band raws
    for (const band of view.incomeBands) {
      const fromYears = flow.years.reduce((a, y) => a + y.allocations.filter((x) => x.sourceKey.startsWith(band.key + ":")).reduce((b, x) => b + x.amount, 0), 0);
      expect(fromYears).toBeCloseTo(band.raw, 6);
    }
  });

  it("EDITOR: add pairing (nextId, default selects), the amount refusal at zero, the amount write through the MoneyEditor at the entry unit, source and use selects, remove", () => {
    render(<App />);
    fireEvent.click(q('[data-action="load-solar-demo"]'));
    fireEvent.click(q('[data-nav="flow"]'));
    expect(qa('[data-flow-pairing]').length).toBe(0);
    fireEvent.click(q('[data-action="flow-add-pairing"]'));
    const row = q('[data-flow-pairing="f1"]');
    expect(row).toBeTruthy(); // the stable generated id keys the row
    // the default amount 0 is refused by name (collect-all), rendered in the section
    expect(q('[data-flow-refusal="FLOW-PAIRING-AMOUNT"]').textContent).toContain("f1");
    // the entry unit is thousands on this loader: 50 entered is 50 000 raw
    const amount = q('[data-field="flow-amount"]') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "50" } });
    expect(q('[data-flow-refusal="FLOW-PAIRING-AMOUNT"]')).toBeNull();
    // the source and use selects list the live identities
    const srcSel = q('[data-field="flow-source"]') as HTMLSelectElement;
    expect(srcSel.value).toBe("payments:payments");
    const useSel = q('[data-field="flow-use"]') as HTMLSelectElement;
    expect(useSel.value).toBe("cost:c1"); // the default use: the first non-equity use row (the solar demo has no financing)
    fireEvent.change(useSel, { target: { value: "cost:c3" } });
    expect((q('[data-field="flow-use"]') as HTMLSelectElement).value).toBe("cost:c3");
    fireEvent.click(q('[data-action="flow-remove-pairing"]'));
    expect(qa('[data-flow-pairing]').length).toBe(0);
    // removing the last pairing removes the document field (the minimal-document convention)
    fireEvent.click(q('[data-action="flow-add-pairing"]'));
    fireEvent.click(q('[data-action="flow-remove-pairing"]'));
    expect(qa('[data-flow-pairing]').length).toBe(0);
  });

  it("PROGRAM DEMO: the surface shows the grant and note sources and the debt-service bucket (demo honesty, no new fixtures)", () => {
    render(<App />);
    fireEvent.click(q('[data-action="load-demo"]'));
    fireEvent.click(q('[data-nav="flow"]'));
    expect(q('[data-flow-income-label="grant"]')).toBeTruthy();
    expect(q('[data-flow-income-label="funding-loan"]')).toBeTruthy();
    expect(q('[data-flow-use-label="Debt service"]')).toBeTruthy();
    // the year-3 overlap is disclosed in the summary: 4 shortfall years on the program
    expect(q('[data-testid="flow-shortfall-note"]').textContent).toContain("4 of 23 years run a shortfall");
  });
});
