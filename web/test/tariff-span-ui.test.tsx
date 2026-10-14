// Directive v0.6.10 Task E.2/E.3: the tariff span editors — the declared overall span
// (all-or-nothing commit, text initialized FROM the declared span: the ratified
// initial-sync defect fix), the per-row spans (empty = inherit the common span, preset
// row spans render their values), and the per-segment surcharge at the full-ramp year.
// Every figure below was script-verified against the delivered engine before this file
// was written (exact doubles; the display forms are the engine's own formatters). The
// UI performs no arithmetic: the rendered rates derive from the engine's per-row
// charges divided by the declared display divisor (one source).
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { shorePowerProgram } from "../src/state.js";
import { computeModel, unitPriceForDisplay, roundForDisplay } from "../src/engine.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byTestid = (v: string) => document.querySelector('[data-testid="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLInputElement;
const rowField = (row: string, field: string) =>
  document.querySelector('[data-row="' + row + '"] [data-field="' + field + '"]') as HTMLInputElement;

// The grid header's text is split across a nested span (the machine volume unit), so
// getByText cannot match it; locate it by its own textContent instead.
function gridHeaderText(): string {
  const h3 = Array.from(document.querySelectorAll("h3")).find((h) => (h.textContent ?? "").startsWith("Volume grid"));
  return h3?.textContent ?? "";
}

async function loadProgramDemo() {
  render(<App />);
  fireEvent.click(byAction("load-demo"));
  await waitFor(() => {
    expect(screen.getByText("Shore-power program (Rotterdam)")).toBeTruthy();
  });
  fireEvent.click(byNav("tariff"));
  await waitFor(() => {
    expect(byTestid("tariff")).toBeTruthy();
  });
}

describe("v0.6.10 Task E.2/E.3: the tariff span editors and the per-segment surcharge", () => {
  it("SPAN-DECLARED: the declared span renders its own values (the initial-sync fix), and the grid header names the declared span with the machine volume unit", async () => {
    await loadProgramDemo();
    // The overall span text initializes FROM the declared span — editing one field never
    // silently drops the other (the ratified defect fix of the pass).
    expect(byField("tariffSpanStart").value).toBe("3");
    expect(byField("tariffSpanTerm").value).toBe("20");
    // The grid header: years 3 through 23 (a term of 20 touches 21 calendar years),
    // declared span, and the machine volume unit.
    expect(gridHeaderText()).toBe("Volume grid (collection years 3–23, declared tariff span) — volumes in GWh");
    expect(byTestid("tariff-volume-unit").textContent).toBe(" — volumes in GWh");
    // The grid columns: Descriptor, Weight, 21 year columns, and the two row-span columns.
    expect(document.querySelectorAll('[data-testid="tariff-rows"] th').length).toBe(25);
    const ths = Array.from(document.querySelectorAll('[data-testid="tariff-rows"] th')).map((th) => th.textContent);
    expect(ths[2]).toBe("2028");
    expect(ths[3]).toBe("2029");
    expect(ths[22]).toBe("2048");
  });

  it("SPAN-ALL-OR-NOTHING: an empty field falls back to the derived default; the span declares only when both fields carry values", async () => {
    await loadProgramDemo();
    fireEvent.click(byAction("clear-tariff-span"));
    await waitFor(() => {
      expect(gridHeaderText()).toBe("Volume grid (collection years 3–23, derived from the model span) — volumes in GWh");
    });
    // The placeholders show the repayment-derived default (first collection year 3, term 20).
    expect(byField("tariffSpanStart").value).toBe("");
    expect(byField("tariffSpanTerm").value).toBe("");
    expect(byField("tariffSpanStart").placeholder).toBe("3");
    expect(byField("tariffSpanTerm").placeholder).toBe("20");
    // A start year alone never declares the span (all-or-nothing).
    fireEvent.change(byField("tariffSpanStart"), { target: { value: "3" } });
    expect(gridHeaderText()).toBe("Volume grid (collection years 3–23, derived from the model span) — volumes in GWh");
    expect(byField("tariffSpanStart").value).toBe("3");
    // The term completes the declaration: a term of 21 touches years 3 through 24.
    fireEvent.change(byField("tariffSpanTerm"), { target: { value: "21" } });
    await waitFor(() => {
      expect(gridHeaderText()).toBe("Volume grid (collection years 3–24, declared tariff span) — volumes in GWh");
    });
    expect(document.querySelectorAll('[data-testid="tariff-rows"] th').length).toBe(26);
    const ths = Array.from(document.querySelectorAll('[data-testid="tariff-rows"] th')).map((th) => th.textContent);
    expect(ths[22]).toBe("2048");
    expect(ths[23]).toBe("2049");
  });

  it("ROW-SPANS: the preset per-row spans render their own values (the initial-sync fix), empty inherits, and clearing one field clears the row span", async () => {
    await loadProgramDemo();
    // r1 carries no row span: both fields empty with the inherit placeholder.
    expect(rowField("r1", "tariffRowSpanStart").value).toBe("");
    expect(rowField("r1", "tariffRowSpanTerm").value).toBe("");
    expect(rowField("r1", "tariffRowSpanStart").placeholder).toBe("inherit");
    expect(rowField("r1", "tariffRowSpanTerm").placeholder).toBe("inherit");
    // The preset row spans initialize in the text fields (the ratified defect fix).
    expect(rowField("r2", "tariffRowSpanStart").value).toBe("5");
    expect(rowField("r2", "tariffRowSpanTerm").value).toBe("19");
    expect(rowField("r3", "tariffRowSpanStart").value).toBe("6");
    expect(rowField("r3", "tariffRowSpanTerm").value).toBe("18");
    expect(rowField("r4", "tariffRowSpanStart").value).toBe("6");
    expect(rowField("r4", "tariffRowSpanTerm").value).toBe("18");
    // Clearing one field is all-or-nothing: the row span drops and both fields resync.
    fireEvent.change(rowField("r4", "tariffRowSpanStart"), { target: { value: "" } });
    await waitFor(() => {
      expect(rowField("r4", "tariffRowSpanStart").value).toBe("");
      expect(rowField("r4", "tariffRowSpanTerm").value).toBe("");
    });
    // The other rows are untouched by the r4 edit.
    expect(rowField("r3", "tariffRowSpanStart").value).toBe("6");
    expect(rowField("r3", "tariffRowSpanTerm").value).toBe("18");
  });

  it("UNIT-PRICE-AND-SEGMENT-RATES: the unit price column renders the engine's exact doubles, and the per-segment surcharge renders at the full-ramp year over the declared divisor", async () => {
    // Engine pins (exact doubles, script-verified on the rebuilt engine): the unit prices
    // and the full-ramp per-row charges. The full-ramp year is 9 (calendar 2034, the first
    // grid year at the maximum weighted volume 1170 GWh).
    const inp = shorePowerProgram();
    const r = computeModel(inp);
    const y3 = r.tariffYears.find((y) => y.year === 3)!;
    const y5 = r.tariffYears.find((y) => y.year === 5)!;
    const y9 = r.tariffYears.find((y) => y.year === 9)!;
    const y22 = r.tariffYears.find((y) => y.year === 22)!;
    expect(y3.unitPrice).toBe(7108.4140139564915);
    expect(y5.unitPrice).toBe(40141.63207881312);
    expect(y9.unitPrice).toBe(29162.724159821497);
    expect(y9.weightedVolume).toBe(1170);
    expect(y22.unitPrice).toBe(29162.724159821497);
    expect(y9.perRowCharges).toEqual({ r1: 58325.448319642994, r2: 43744.08623973225, r3: 29162.724159821497, r4: 14581.362079910748 });

    await loadProgramDemo();
    // The decomposition rows: the unit price column at the engine's own display.
    const row3 = document.querySelector('[data-testid="tariff-decomposition"] [data-year="3"]') as HTMLElement;
    const cells3 = Array.from(row3.querySelectorAll("td")).map((td) => td.textContent);
    expect(cells3[0]).toBe("2028");
    expect(cells3[3]).toBe(unitPriceForDisplay(7108.4140139564915, "EUR"));
    expect(cells3[3]).toBe("€7 108,41");
    const row5 = document.querySelector('[data-testid="tariff-decomposition"] [data-year="5"]') as HTMLElement;
    expect(Array.from(row5.querySelectorAll("td"))[3].textContent).toBe("€40 141,63");
    const row9 = document.querySelector('[data-testid="tariff-decomposition"] [data-year="9"]') as HTMLElement;
    const cells9 = Array.from(row9.querySelectorAll("td")).map((td) => td.textContent);
    expect(cells9[0]).toBe("2034");
    expect(cells9[3]).toBe("€29 162,72");
    expect(cells9[2]).toBe("€1,17 k");
    const row22 = document.querySelector('[data-testid="tariff-decomposition"] [data-year="22"]') as HTMLElement;
    expect(Array.from(row22.querySelectorAll("td"))[3].textContent).toBe("€29 162,72");
    // The per-segment surcharge at the full-ramp year: each rendered rate is the engine's
    // own per-row charge divided by the declared display divisor, one source.
    const divisor = inp.tariff?.priceDisplayDivisor as number;
    expect(divisor).toBe(10000);
    expect(inp.tariff?.priceUnitLabel).toBe("€ct/kWh");
    const labels = ["Deep-sea container berths", "Cruise terminal berths", "Bulk & liquid market berths", "Inland & public berths"];
    const rowIds = ["r1", "r2", "r3", "r4"];
    for (let i = 0; i < rowIds.length; i++) {
      const li = document.querySelector('[data-testid="per-lift-charges"] [data-row-charge="' + rowIds[i] + '"]') as HTMLElement;
      expect(li).toBeTruthy();
      const charge = (y9.perRowCharges as Record<string, number>)[rowIds[i]];
      expect(li.textContent).toBe(
        `${labels[i]}: ${roundForDisplay(charge / divisor, 2).toFixed(2).replace(".", ",")} €ct/kWh`
      );
    }
    expect(document.querySelector('[data-testid="per-lift-charges"] [data-row-charge="r1"]')?.textContent).toBe("Deep-sea container berths: 5,83 €ct/kWh");
    expect(document.querySelector('[data-testid="per-lift-charges"] [data-row-charge="r2"]')?.textContent).toBe("Cruise terminal berths: 4,37 €ct/kWh");
    expect(document.querySelector('[data-testid="per-lift-charges"] [data-row-charge="r3"]')?.textContent).toBe("Bulk & liquid market berths: 2,92 €ct/kWh");
    expect(document.querySelector('[data-testid="per-lift-charges"] [data-row-charge="r4"]')?.textContent).toBe("Inland & public berths: 1,46 €ct/kWh");
    // The full-ramp note names the calendar year (2034).
    expect(screen.getByText("Rendered at the full-ramp year (2034), the first grid year at the maximum weighted volume.")).toBeTruthy();
  });
});
