// v0.6.18 Task C: the financing display — the per-facility debt-service schedules (computed by the core
// since v0.6.14, displayed nowhere until now) on the app Results view and the XLSX audit route. The deck
// gains nothing. Nothing in the engine moves: the DSCR and the equity metrics are the engine's own.
import { describe, expect, it } from "vitest";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { App } from "../src/App.js";
import { computeModel, roundForDisplay } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import { buildWorkbook, readWorkbook } from "../src/xlsx.js";
import { composeFacilitySchedules, demoProject, migrateOnLoad, shorePowerProgram } from "../src/state.js";
import { restoreLegacyFinancing } from "../../core/src/financing.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { Facility, ModelInputs } from "../../core/src/types.js";

const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

// An amount-first project: two debt facilities (one general, one attached to the capex line) on the golden template.
const authored = (): ModelInputs => {
  const base = demoProject();
  const capex = base.costs.find((c) => c.category === "capex")!.id;
  const facilities: Facility[] = [
    { id: "fac1", label: "Bank loan", amount: 3000000, ratePct: 5, termYears: 8, graceYears: 1, amortization: "annuity", serviceStartYear: null, scope: { kind: "general" }, origin: "financing" },
    { id: "fac2", label: "Equipment loan", amount: 400000, ratePct: 4, termYears: 5, graceYears: 0, amortization: "equal-principal", serviceStartYear: null, scope: { kind: "attached", lineIds: [capex] }, origin: "financing" },
  ];
  return { ...base, facilities };
};
const program = (): ModelInputs => migrateOnLoad(shorePowerProgram());

describe("v0.6.18 Task C: the per-facility schedules (composed once)", () => {
  for (const [name, make] of [["the migrated program (the EIB facility plus the interest-free note)", program], ["an amount-first two-facility project", authored]] as const) {
    it(`RECONCILE: ${name}: the facility rows sum to the combined aggregate, year by year, and in total`, () => {
      const inp = make();
      const r = computeModel(inp);
      const views = composeFacilitySchedules(r);
      expect(views.length).toBeGreaterThanOrEqual(2);
      for (const y of r.financing!.yearly) {
        for (const k of ["interest", "principal", "service"] as const) {
          const sum = views.reduce((a, v) => a + (v.rows.find((x) => x.year === y.year)?.[k] ?? 0), 0);
          expect(Math.abs(sum - y[k])).toBeLessThan(1e-6);
        }
      }
      // no facility row falls outside a combined year
      for (const v of views) for (const row of v.rows) expect(r.financing!.yearly.some((y) => y.year === row.year) || row.draws !== 0).toBe(true);
      const total = (k: "interest" | "service") => views.reduce((a, v) => a + v.totals[k], 0);
      expect(Math.abs(total("interest") - r.financing!.totalInterest)).toBeLessThan(1e-3);
      expect(Math.abs(total("service") - r.financing!.totalService)).toBeLessThan(1e-3);
      expect(Math.abs(views.reduce((a, v) => a + v.totals.draws, 0) - r.financing!.drawnTotal)).toBeLessThan(1e-3);
      // the closing balance reads the engine's balance at the year end
      const f0 = r.financing!.facilities![0];
      expect(views[0].rows[0].balance).toBe(f0.monthly.balance[Math.min(views[0].rows[0].year * 12, f0.monthly.service.length) - 1]);
    });
  }

  it("NOTE-NAMED: the interest-free note's payback is its own named installments, never an unnamed share of the combined principal", () => {
    const r = computeModel(program());
    const views = composeFacilitySchedules(r);
    const note = views.find((v) => v.origin === "funding-note")!;
    expect(note.label).toBe("Municipality interest-free note");
    expect(note.principalLabel).toBe("Installment");
    expect(note.totals.interest).toBe(0);
    expect(note.totals.principal).toBeCloseTo(10000000, 4);
    const debt = views.find((v) => v.origin === "financing")!;
    expect(debt.principalLabel).toBe("Principal");
    // the combined principal in a year = the debt facility's principal + the note's installment
    for (const row of note.rows.filter((x) => x.service > 0)) {
      const combined = r.financing!.yearly.find((y) => y.year === row.year)!;
      const d = debt.rows.find((x) => x.year === row.year)?.principal ?? 0;
      expect(Math.abs(combined.principal - d - row.principal)).toBeLessThan(1e-6);
    }
  });

  it("ABSENT: a project without financing composes no schedules; the pure helper reads null as empty", () => {
    expect(composeFacilitySchedules(null)).toEqual([]);
    expect(composeFacilitySchedules(computeModel(demoProject()))).toEqual([]);
  });
});

async function openResults(inputs: ModelInputs) {
  render(<App />);
  const text = serializeProject(inputs, { startYear: null, entryUnit: "ones", scenarioTargets: null, scenarioTerms: null, scenarioBalloons: null });
  fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
  await waitFor(() => expect(screen.getByText(inputs.projectName)).toBeTruthy());
  fireEvent.click(byNav("results"));
}

describe("v0.6.18 Task C: the Results view", () => {
  it("VIEW: each facility's yearly rows sit beneath the combined schedule; the note's installments are named; the combined aggregate, the DSCR and the equity panel stand", async () => {
    const inp = program();
    const r = computeModel(inp);
    await openResults(shorePowerProgram());
    const root = document.querySelector('[data-testid="facility-schedules"]') as HTMLElement;
    expect(root).toBeTruthy();
    const combined = document.querySelector('[data-testid="debt-schedule"]') as HTMLElement;
    expect(combined.compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const views = composeFacilitySchedules(r);
    const blocks = Array.from(root.querySelectorAll("[data-facility-schedule]")) as HTMLElement[];
    expect(blocks.map((b) => b.getAttribute("data-facility-schedule"))).toEqual(views.map((v) => v.id));
    views.forEach((v, i) => {
      const heads = Array.from(blocks[i].querySelectorAll("thead th")).map((h) => h.textContent);
      expect(heads).toEqual(["Year", "Draws", "Interest", v.principalLabel, "Service", "Closing balance"]);
      const trs = Array.from(blocks[i].querySelectorAll("tbody tr[data-facility-year]")) as HTMLElement[];
      expect(trs).toHaveLength(v.rows.length);
      trs.forEach((tr, j) => {
        const cells = Array.from(tr.querySelectorAll("td")).map((td) => td.textContent);
        expect(cells.slice(1)).toEqual([v.rows[j].draws, v.rows[j].interest, v.rows[j].principal, v.rows[j].service, v.rows[j].balance].map((x) => String(roundForDisplay(x))));
      });
    });
    expect(blocks[1].querySelector('[data-testid="facility-schedule-title"]')!.textContent).toBe("Municipality interest-free note — interest-free note (payback installments), general (the whole program)");
    expect(root.querySelector('[data-testid="facility-schedules-note"]')!.textContent).toContain("sum of these facility rows");
    // the combined aggregate retained; the DSCR and the equity figures are the engine's own
    expect(combined.querySelectorAll("tbody tr")).toHaveLength(r.financing!.yearly.length);
    expect(document.querySelector('[data-testid="min-dscr"]')!.textContent).toBe(`Minimum DSCR: ${roundForDisplay(r.financing!.minDscr!.value, 4)} in Year ${r.financing!.minDscr!.year}`);
    expect(document.querySelector('[data-stat="equityOutlay"]')!.textContent).toBe(String(roundForDisplay(r.financing!.equity.outlay)));
  });

  it("DECK-UNTOUCHED: the deck gains nothing from the facility schedules", () => {
    const inp = program();
    const deck = deckSlides(inp, computeModel(inp), { startYear: null });
    const text = JSON.stringify(deck);
    expect(text).not.toContain("Installment");
    expect(text).not.toContain("facility-schedule");
    expect(text).not.toContain("Closing balance");
  });
});

describe("v0.6.18 Task C: the XLSX audit route", () => {
  it("FINANCING-SHEET: each facility's block carries its raw yearly rows beneath the combined rows; the note's installments are named", async () => {
    const inp = program();
    const r = computeModel(inp);
    const wb = await readWorkbook(await buildWorkbook(restoreLegacyFinancing(inp), r, { startYear: null, facilities: inp.facilities }));
    const ws = wb.getWorksheet("Financing")!;
    const rows: unknown[][] = [];
    ws.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
    const text = rows.map((x) => x.join("|"));
    expect(text.some((l) => l.startsWith("Facility schedules (by facility; the combined rows above are their sum)"))).toBe(true);
    const views = composeFacilitySchedules(r);
    for (const v of views) {
      const head = rows.findIndex((x) => String(x[0]).startsWith(`${v.label} — `));
      expect(head).toBeGreaterThan(0);
      expect(rows[head + 1]).toEqual(["Year", "Draws", "Interest", v.principalLabel, "Service", "Closing balance"]);
      v.rows.forEach((row, i) => expect(rows[head + 2 + i]).toEqual([row.year, row.draws, row.interest, row.principal, row.service, row.balance]));
      expect(rows[head + 2 + v.rows.length].slice(0, 5)).toEqual(["Total", v.totals.draws, v.totals.interest, v.totals.principal, v.totals.service]);
    }
    expect(text.some((l) => l.startsWith("Municipality interest-free note — interest-free note (payback installments)"))).toBe(true);
    // the combined rows and the equity rows stand (the first rows of the sheet)
    expect(rows[0]).toEqual(["Year", "Interest", "Principal", "Service", "DSCR"]);
    expect(rows[1][1]).toBe(r.financing!.yearly[0].interest);
    expect(text.some((l) => l.startsWith("Equity outlay|" + r.financing!.equity.outlay))).toBe(true);
  });

  it("INPUTS-ECHO: an amount-first project echoes its facility inputs on the Inputs sheet; a legacy-shaped project adds none", async () => {
    const inp = authored();
    const r = computeModel(inp);
    const wb = await readWorkbook(await buildWorkbook(restoreLegacyFinancing(inp), r, { startYear: null, facilities: inp.facilities }));
    const items = new Map<string, unknown>();
    wb.getWorksheet("Inputs")!.eachRow((row) => items.set(String(row.getCell(1).value), row.getCell(2).value));
    expect(items.get("facility fac1 label")).toBe("Bank loan");
    expect(items.get("facility fac1 amount")).toBe(3000000);
    expect(items.get("facility fac1 ratePct")).toBe(5);
    expect(items.get("facility fac1 scope")).toBe("general");
    expect(items.get("facility fac2 amortization")).toBe("equal-principal");
    expect(String(items.get("facility fac2 scope"))).toContain("attached: ");
    expect(items.get("facilityOptions.leveragedSolve")).toBe(false);
    // the legacy-shaped migrated program: its twin echoes the legacy financing block; no facility rows join
    const mig = program();
    const rr = computeModel(mig);
    const wb2 = await readWorkbook(await buildWorkbook(restoreLegacyFinancing(mig), rr, { startYear: null, facilities: mig.facilities }));
    const keys: string[] = [];
    wb2.getWorksheet("Inputs")!.eachRow((row) => keys.push(String(row.getCell(1).value)));
    expect(keys.some((k) => k.startsWith("facility "))).toBe(false);
    expect(keys).toContain("financing.sharePct");
  });

  it("AMOUNT-FIRST-SHEET: the per-facility blocks exist for an amount-first project too", async () => {
    const inp = authored();
    const r = computeModel(inp);
    const wb = await readWorkbook(await buildWorkbook(restoreLegacyFinancing(inp), r, { startYear: null, facilities: inp.facilities }));
    const ws = wb.getWorksheet("Financing")!;
    const titles: string[] = [];
    ws.eachRow((row) => { const v = String(row.getCell(1).value); if (v.includes(" — facility, ")) titles.push(v); });
    expect(titles).toEqual(["Bank loan — facility, general (the whole program)", "Equipment loan — facility, attached to 1 cost line"]);
  });
});
