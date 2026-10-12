import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { moneyForDisplay } from "../src/engine.js";
import { RootErrorBoundary } from "../src/ErrorBoundary.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byStat = (v: string) => document.querySelector('[data-stat="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;
const allByField = (v: string) => Array.from(document.querySelectorAll('[data-field="' + v + '"]')) as HTMLElement[];

describe("v0.6.2 chunk 1: the editing boundary", () => {
  it("UNIT-EDIT-1: typing 1000 at unit thousands yields totalCost 1000000 with app and deck display in tkr", () => {
    render(<App />);
    fireEvent.click(byNav("costs"));
    fireEvent.click(byAction("add-cost"));
    fireEvent.change(allByField("name")[0], { target: { value: "Line" } });
    const amount = allByField("amount")[0] as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "1000" } });
    expect(document.querySelector('[data-testid="cost-lines"] [data-stat="totalCost"], [data-testid="costs"]')?.textContent).toBeTruthy();
    fireEvent.click(byNav("overview"));
    expect(byStat("totalCost").textContent).toBe("1 000 tkr");
    expect(moneyForDisplay(1000000, "SEK", "thousands")).toBe("1 000,00 tkr");
  });

  it("UNIT-EDIT-2: at unit ones the same entry is 1000 (unchanged behavior)", () => {
    render(<App />);
    fireEvent.change(document.querySelector('[data-field="entryUnit"]') as HTMLElement, { target: { value: "ones" } });
    fireEvent.click(byNav("costs"));
    fireEvent.click(byAction("add-cost"));
    fireEvent.change(allByField("name")[0], { target: { value: "Line" } });
    fireEvent.change(allByField("amount")[0], { target: { value: "1000" } });
    fireEvent.click(byNav("overview"));
    expect(byStat("totalCost").textContent).toBe("1 000 kr");
  });

  it("UNIT-EDIT-3: the loaded template stores actuals while editors display valueToEntry (thousands)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const amount = allByField("amount")[0] as HTMLInputElement;
    expect(Number(amount.value)).toBeCloseTo(1800000 / 1000, 6);
    fireEvent.click(byNav("overview"));
    expect(byStat("paymentAmount").textContent).toBe("475 tkr");
  });
});

describe("v0.6.2 chunk 1: the cost model line totals (W3)", () => {
  it("LT-1: the template line totals render through the money formatter at unit ones", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.change(document.querySelector('[data-field="entryUnit"]') as HTMLElement, { target: { value: "ones" } });
    fireEvent.click(byNav("costs"));
    const cells = Array.from(document.querySelectorAll('[data-testid="line-total"]'));
    expect(cells.length).toBeGreaterThan(0);
    expect(cells[0].textContent).toBe("5 563 620,00 kr");
    expect(cells[1].textContent).toBe("1 836 240,00 kr");
    expect(cells[2].textContent).toBe("450 000,00 kr");
  });

  it("LT-2: the profile-only fixture renders 420000 as 420,00 tkr, never empty", () => {
    render(<App />);
    fireEvent.click(byAction("new-project"));
    fireEvent.click(byNav("costs"));
    fireEvent.click(byAction("add-cost"));
    fireEvent.change(allByField("name")[0], { target: { value: "CAPEX" } });
    fireEvent.change(allByField("category")[0], { target: { value: "capex" } });
    fireEvent.change(allByField("amount")[0], { target: { value: "0" } });
    fireEvent.click(allByField("year-editor-toggle") ? document.querySelector('[data-testid="year-editor-toggle"]') as HTMLElement : document.querySelectorAll('[data-action="add-override"]')[0] as HTMLElement);
    const addOverride = Array.from(document.querySelectorAll('[data-action="add-override"]'))[0] as HTMLElement;
    fireEvent.click(addOverride);
    const yearInput = allByField("override-year")[0] as HTMLInputElement;
    fireEvent.change(yearInput, { target: { value: "1" } });
    const amtInput = allByField("override-amount")[0] as HTMLInputElement;
    fireEvent.change(amtInput, { target: { value: "420" } });
    const cell = document.querySelector('[data-testid="line-total"]') as HTMLElement;
    expect(cell.textContent).toBe("420,00 tkr");
  });
});

describe("v0.6.2 chunk 1: scenarios guards and the root error boundary (W4)", () => {
  it("SCE-GUARD-1: the refusing balloon cell renders the engine message inline and the page renders", () => {
    render(<App />);
    fireEvent.click(byAction("new-project"));
    fireEvent.click(byNav("costs"));
    fireEvent.click(byAction("add-cost"));
    fireEvent.change(allByField("name")[0], { target: { value: "CAPEX" } });
    fireEvent.change(allByField("category")[0], { target: { value: "capex" } });
    fireEvent.change(allByField("amount")[0], { target: { value: "420" } });
    fireEvent.click(byNav("repayment"));
    fireEvent.change(byField("termYears"), { target: { value: "20" } });
    fireEvent.click(byNav("scenarios"));
    for (const v of ["5", "7", "9"]) {
      fireEvent.click(document.querySelector('[data-action="scenario-add-term"]') as HTMLElement);
      const inputs = document.querySelectorAll('[data-field="scenario-term"]');
      fireEvent.change(inputs[inputs.length - 1], { target: { value: v } });
    }
    for (const v of ["0", "1000", "2000"]) {
      fireEvent.click(document.querySelector('[data-action="scenario-add-balloon"]') as HTMLElement);
      const inputs = document.querySelectorAll('[data-field="scenario-balloon"]');
      fireEvent.change(inputs[inputs.length - 1], { target: { value: v } });
    }
    const table = document.querySelector('[data-testid="balloon-term-table"]') as HTMLElement;
    expect(table).toBeTruthy();
    const refusedCells = Array.from(table.querySelectorAll("td")).filter((td) => td.getAttribute("data-cell-refusal") === "true");
    expect(refusedCells.length).toBeGreaterThan(0);
    expect(refusedCells.some((td) => (td.textContent ?? "").includes("The balloon's discounted value at the target rate reaches the cost NPV; the solved payment would be non-positive."))).toBe(true);
  });

  it("SCE-GUARD-2: the demo project computes all cells (unchanged behavior)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    for (const v of ["5", "7", "9"]) {
      fireEvent.click(document.querySelector('[data-action="scenario-add-term"]') as HTMLElement);
      const inputs = document.querySelectorAll('[data-field="scenario-term"]');
      fireEvent.change(inputs[inputs.length - 1], { target: { value: v } });
    }
    for (const v of ["0", "1000", "2000"]) {
      fireEvent.click(document.querySelector('[data-action="scenario-add-balloon"]') as HTMLElement);
      const inputs = document.querySelectorAll('[data-field="scenario-balloon"]');
      fireEvent.change(inputs[inputs.length - 1], { target: { value: v } });
    }
    const table = document.querySelector('[data-testid="balloon-term-table"]') as HTMLElement;
    expect(Array.from(table.querySelectorAll("td[data-cell-refusal]")).length).toBe(0);
  });

  it("BND-1: a deliberately throwing child renders the boundary card with the shell intact", () => {
    const Throwing = () => { throw new Error("test-only explosion"); };
    render(
      <div data-testid="app-shell">
        <RootErrorBoundary>
          <Throwing />
        </RootErrorBoundary>
      </div>
    );
    expect(document.querySelector('[data-testid="app-shell"]')).toBeTruthy();
    const card = document.querySelector('[data-testid="root-error-boundary"]') as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.textContent).toContain("test-only explosion");
  });
});

describe("v0.6.2 chunk 1: NO-SCI and calendar-aware year entry (W1)", () => {
  it("NO-SCI: the money display on an e+47-class value contains no exponent", () => {
    const v = 2.4348669767842967e47;
    const app = moneyForDisplay(v, "SEK", "ones");
    expect(app).not.toContain("e");
    expect(app).not.toContain("E");
    expect(app).toContain("kr");
  });

  it("CALENDAR: the first-collection-year field converts calendar entry to model year with the conversion disclosed", () => {
    render(<App />);
    fireEvent.click(byAction("new-project"));
    fireEvent.click(byNav("overview"));
    fireEvent.change(byField("startYear"), { target: { value: "2026" } });
    fireEvent.click(byNav("costs"));
    fireEvent.click(byAction("add-cost"));
    fireEvent.change(allByField("name")[0], { target: { value: "CAPEX" } });
    fireEvent.change(allByField("category")[0], { target: { value: "capex" } });
    fireEvent.change(allByField("amount")[0], { target: { value: "420" } });
    fireEvent.click(byNav("repayment"));
    const label = document.querySelector('[data-field="firstCollectionYear"]') as HTMLInputElement;
    expect(label.getAttribute("data-year-semantics")).toBe("calendar");
    fireEvent.change(label, { target: { value: "2028" } });
    expect(document.querySelector('[data-testid="first-collection-year-conversion"]')?.textContent).toContain("model year 3");
    expect(byStat("repaymentStartYear").textContent).toBe("3");
  });
});

describe("v0.6.2 chunk 1: the Details-tab book grid (W5)", () => {
  it("DET-1 and DET-2: the grid renders engine bookView figures and the combined rows reconcile", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("detail"));
    const bookGrid = document.querySelector('[data-testid="book-grid"]') as HTMLElement;
    expect(bookGrid).toBeTruthy();
    expect(document.querySelector('[data-testid="book-view-disclosure"]')?.textContent).toContain("never enters the cash flows");
    const perLine = document.querySelector('[data-testid="book-per-line"]') as HTMLElement;
    const combined = document.querySelector('[data-testid="book-combined"]') as HTMLElement;
    expect(perLine.querySelectorAll("tr").length).toBeGreaterThan(0);
    expect(combined.querySelectorAll("tr").length).toBeGreaterThan(0);
    const perLineRows = Array.from(perLine.querySelectorAll("tr")).map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent ?? "").trim()));
    const combinedRows = Array.from(combined.querySelectorAll("tr")).map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent ?? "").trim()));
    expect(perLineRows.length).toBeGreaterThan(0);
    expect(combinedRows.length).toBeGreaterThan(0);
    const chargesEqual = (a: string, b: string) => parseFloat(a.replace(/[\s\u00a0]/g, "").replace(",", ".")) === parseFloat(b.replace(/[\s\u00a0]/g, "").replace(",", "."));
    let reconciled = 0;
    for (const row of combinedRows) {
      const yearIdx = perLineRows.findIndex((pr) => pr.length >= 5 && pr[1] === row[0] && chargesEqual(pr[3], row[2]));
      if (yearIdx >= 0) reconciled += 1;
    }
    expect(reconciled).toBeGreaterThan(0);
  });
});

describe("v0.6.2 chunk 1: the depreciation start-year surface (W6, web side)", () => {
  it("BK-UI: setting startYear 5 shows the year-5 first charge; the default shows the derived commissioning year", () => {
    render(<App />);
    fireEvent.click(byAction("new-project"));
    fireEvent.click(byNav("costs"));
    fireEvent.click(byAction("add-cost"));
    fireEvent.change(allByField("name")[0], { target: { value: "Build" } });
    fireEvent.change(allByField("amount")[0], { target: { value: "100" } });
    fireEvent.change(allByField("startYear")[0], { target: { value: "1" } });
    fireEvent.change(allByField("durationYears")[0], { target: { value: "3" } });
    fireEvent.change(allByField("line-depreciation-mode")[0] as HTMLSelectElement, { target: { value: "straight-line" } });
    const derived = document.querySelector('[data-field="line-depreciation-startYear"]') as HTMLInputElement;
    expect((document.body.textContent ?? "")).toContain("the year after the costs end");
    fireEvent.change(derived, { target: { value: "5" } });
    fireEvent.click(byNav("detail"));
    const perLine = document.querySelector('[data-testid="book-per-line"]') as HTMLElement;
    const chargesByYear = new Map<string, string>();
    Array.from(perLine.querySelectorAll("tr")).forEach((tr) => {
      const tds = Array.from(tr.querySelectorAll("td"));
      if (tds.length >= 5) {
        chargesByYear.set((tds[1].textContent ?? "").trim(), (tds[3].textContent ?? "").trim());
      }
    });
    expect(chargesByYear.get("Year 4")).toBe("0,00 tkr");
    expect(chargesByYear.get("Year 5")).toBe("15,00 tkr");
  });
});

describe("v0.6.2 chunk 2: the scenario axes (Round 23 ruling)", () => {
  it("AXES-1: the default state is three empty axes with the empty-state notice", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    expect(document.querySelectorAll('[data-field="scenario-target"]').length).toBe(0);
    expect(document.querySelectorAll('[data-field="scenario-term"]').length).toBe(0);
    expect(document.querySelectorAll('[data-field="scenario-balloon"]').length).toBe(0);
    expect(document.querySelector('[data-testid="scenarios-empty-state"]')?.textContent).toContain("Enter values to compute the tables.");
  });

  it("AXES-3: the inline explanations render on every axis", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    expect(document.querySelector('[data-testid="scenario-axis-explanation-target"]')?.textContent).toContain("target IRR");
    expect(document.querySelector('[data-testid="scenario-axis-explanation-term"]')?.textContent).toContain("number of years");
    expect(document.querySelector('[data-testid="scenario-axis-explanation-balloon"]')?.textContent).toContain("A balloon is a one-time final payment at the end of the term; 0 means none.");
  });

  it("AXES-2: entering balloons [0, 100000, 200000] on the small-project fixture computes the tables green", () => {
    render(<App />);
    fireEvent.click(byAction("new-project"));
    fireEvent.click(byNav("costs"));
    fireEvent.click(byAction("add-cost"));
    fireEvent.change(allByField("name")[0], { target: { value: "CAPEX" } });
    fireEvent.change(allByField("category")[0], { target: { value: "capex" } });
    fireEvent.change(allByField("amount")[0], { target: { value: "420" } });
    fireEvent.click(byNav("repayment"));
    fireEvent.change(byField("termYears"), { target: { value: "20" } });
    fireEvent.click(byNav("scenarios"));
    for (const v of ["5", "7", "9"]) {
      fireEvent.click(document.querySelector('[data-action="scenario-add-term"]') as HTMLElement);
      const inputs = document.querySelectorAll('[data-field="scenario-term"]');
      fireEvent.change(inputs[inputs.length - 1], { target: { value: v } });
    }
    for (const v of ["0", "100", "200"]) {
      fireEvent.click(document.querySelector('[data-action="scenario-add-balloon"]') as HTMLElement);
      const inputs = document.querySelectorAll('[data-field="scenario-balloon"]');
      fireEvent.change(inputs[inputs.length - 1], { target: { value: v } });
    }
    const table = document.querySelector('[data-testid="balloon-term-table"]') as HTMLElement;
    expect(table.querySelectorAll("tbody tr").length).toBe(3);
    expect(Array.from(table.querySelectorAll("td[data-cell-refusal]")).length).toBe(0);
  });
});

describe("v0.6.2 chunk 2: the deck scenarios summary slide (Round 23 supplement ruling)", () => {
  it("DECK-SCE-1: with the axes set the slide renders seventh with kicker 06 and only worksuite-visible figures", async () => {
    const { deckSlides } = await import("../src/deck.js");
    const { computeModel, deckMoneyForDisplay } = await import("../src/engine.js");
    const { demoProject } = await import("../src/state.js");
    const demo = demoProject();
    const result = computeModel(demo);
    const deck = deckSlides(demo, result, { startYear: null, entryUnit: "ones", scenarioTargets: [5, 7], scenarioTerms: [20, 25], scenarioBalloons: [0, 100000] });
    expect(deck.slides.length).toBe(7);
    const sce = deck.slides[6];
    expect(sce.name).toBe("scenarios");
    expect(sce.kickerNumber).toBe("06");
    const cellAtTerm = computeModel({ ...demo, repayment: { ...demo.repayment, termYears: 20 } }).paymentAmount;
    const rangeFig = sce.body.find((f) => f.label === "Payment range across the set terms");
    expect(rangeFig).toBeTruthy();
    expect(rangeFig?.value).toContain(deckMoneyForDisplay(cellAtTerm as number, "SEK", "ones"));
    const cellAtTarget = computeModel({ ...demo, targetIrr: 5 }).paymentAmount;
    const targetFig = sce.body.find((f) => f.label === "Payment at target 5%");
    expect(targetFig).toBeTruthy();
    expect(targetFig?.value).toBe(deckMoneyForDisplay(cellAtTarget as number, "SEK", "ones"));
    const baseFig = sce.body.find((f) => f.label === "Named-set delta, optimistic vs base");
    expect(baseFig).toBeTruthy();
    expect(sce.chart?.kind).toBe("rows");
    expect(sce.chart?.data.length).toBeGreaterThan(0);
  });

  it("DECK-SCE-2: with the axes empty the slide is absent and the provenance discloses it", async () => {
    const { deckSlides } = await import("../src/deck.js");
    const { computeModel } = await import("../src/engine.js");
    const { demoProject } = await import("../src/state.js");
    const demo = demoProject();
    const deck = deckSlides(demo, computeModel(demo), { startYear: null, entryUnit: "ones" });
    expect(deck.slides.length).toBe(6);
    expect(deck.slides.map((s) => s.name)).not.toContain("scenarios");
    expect(deck.provenance?.join(" ")).toContain("no scenarios set");
  });

  it("DECK-SCE-2 (app): the presentation provenance line discloses the absent scenarios slide", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    expect(document.querySelectorAll('[data-slide-name="scenarios"]').length).toBe(0);
    expect(document.querySelector('[data-testid="deck-provenance"]')?.textContent).toContain("no scenarios set");
    expect(document.querySelectorAll("[data-dot]").length).toBe(6);
  });

  it("DECK-SCE-1 (app): setting axis values mounts the seventh slide, the kicker, the deck chart, and seven dots", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("scenarios"));
    fireEvent.click(document.querySelector('[data-action="scenario-add-term"]') as HTMLElement);
    fireEvent.change(document.querySelector('[data-field="scenario-term"]') as HTMLInputElement, { target: { value: "20" } });
    fireEvent.click(byAction("present"));
    expect(document.querySelectorAll('[data-slide-name="scenarios"]').length).toBe(1);
    const scenariosSlide = document.querySelector('[data-slide-name="scenarios"]') as HTMLElement;
    expect(scenariosSlide.querySelector('[data-testid="slide-kicker"]')?.textContent).toMatch(/^06 — /);
    expect(scenariosSlide.querySelector('[data-slide-chart="scenarios"]')).toBeTruthy();
    expect(document.querySelectorAll("[data-dot]").length).toBe(7);
    expect(document.querySelector('[data-testid="deck-provenance"]')?.textContent).toContain("present");
  });

  it("DECK-SCE-3: the existing six slides' numbering re-anchors for the seventh slot (no content change)", async () => {
    const { deckSlides } = await import("../src/deck.js");
    const { computeModel } = await import("../src/engine.js");
    const { demoProject } = await import("../src/state.js");
    const demo = demoProject();
    const result = computeModel(demo);
    const without = deckSlides(demo, result, { startYear: null, entryUnit: "ones" });
    const withAxes = deckSlides(demo, result, { startYear: null, entryUnit: "ones", scenarioTerms: [20] });
    expect(withAxes.slides.slice(0, 6).map((s) => s.name)).toEqual(without.slides.map((s) => s.name));
    expect(withAxes.slides.slice(0, 6).map((s) => s.kickerNumber)).toEqual(without.slides.map((s) => s.kickerNumber));
    expect(withAxes.slides[6].kickerNumber).toBe("06");
  });
});
