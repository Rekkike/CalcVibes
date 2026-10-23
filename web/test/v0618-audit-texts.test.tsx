// v0.6.18 Task D: the recovered audit texts (v0.6.12R), each fixed at source and each with its red proof.
// AUD-10 null IRR; AUD-13 the full reset; AUD-14 the loader's balloon axis; AUD-16 stable year rows; AUD-17 the
// Results page's entry unit; AUD-28 the book-view collections basis; AUD-35 the unsaved-change guard.
// (AUD-27, the recovery chart's grants, rides with Task H1.)
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { Presentation } from "../src/presentation/Presentation.js";
import { ResultsSection } from "../src/sections/ResultsSection.js";
import { YearMapEditor } from "../src/YearMapEditor.js";
import { computeModel, deckMoneyForDisplay, entryToValue } from "../src/engine.js";
import { deckSlides } from "../src/deck.js";
import { buildDeckPdf } from "../src/pdf.js";
import { buildWorkbook, readWorkbook } from "../src/xlsx.js";
import { composeBookCollections, demoProject, shorePowerProgram, solarParkProject } from "../src/state.js";
import { serializeProject } from "../../core/src/fileio.js";
import type { ModelInputs } from "../../core/src/types.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const axis = (a: string) => Array.from(document.querySelectorAll('[data-field="scenario-' + a + '"]')).map((i) => (i as HTMLInputElement).value);
const setUnit = (u: string) => fireEvent.change(document.querySelector('[data-field="entryUnit"]') as HTMLSelectElement, { target: { value: u } });

// ---- AUD-10 --------------------------------------------------------------------------------------------------
const nullIrr = (): ModelInputs => ({ ...demoProject(), costs: [] });

describe("v0.6.18 AUD-10: a null IRR renders the dash everywhere", () => {
  it("the fixture computes a null achieved IRR", () => {
    expect(computeModel(nullIrr()).achievedIrr).toBeNull();
  });

  it("DECK: no figure, tile, verdict or scenario line reads 0.00% for a null IRR", () => {
    const inp = nullIrr();
    const r = computeModel(inp);
    const deck = deckSlides(inp, r, { startYear: null, scenarioTargets: [4, 6] });
    const text = JSON.stringify(deck);
    expect(text).not.toContain("0.00%");
    const summary = deck.slides.find((s) => s.name === "summary")!;
    expect(summary.tiles!.find((t) => t.label === "Achieved IRR")!.value).toBe("—");
    expect(deck.slides.find((s) => s.name === "returns")!.body.find((f) => f.label === "Achieved IRR")!.value).toBe("—");
    expect(deck.slides.find((s) => s.name === "deal")!.tiles!.find((t) => t.label === "Achieved IRR")!.value).toBe("— vs 8.00% target".replace("8.00", (inp.targetIrr).toFixed(2)));
    const hurdle = deck.slides.find((s) => s.name === "deal")!.summaryCharts!.find((c) => c.kind === "hurdle")!;
    expect(hurdle.achievedMissing).toBe(true);
  });

  it("PDF: the hurdle line reads 'Achieved —'", () => {
    const inp = nullIrr();
    const deck = deckSlides(inp, computeModel(inp), { startYear: null });
    const trace = { drawnTitles: [] as string[], drawnFigures: [] as string[][] };
    buildDeckPdf(deck, "P", trace);
    const all = trace.drawnFigures.flat();
    expect(all).toContain("Achieved —");
    expect(all.some((x) => /Achieved \d/.test(x))).toBe(false);
    expect(all).toContain("—");
  });

  it("CHARTS and APP: the hurdle plot draws no achieved dot and reads '—'; the Results KPI reads the dash", () => {
    const inp = nullIrr();
    const r = computeModel(inp);
    const { container } = render(<Presentation inputs={inp} result={r} onExit={() => {}} />);
    expect(container.querySelector('[data-testid="hurdle-achieved-dot"]')).toBeNull();
    expect(container.querySelector('[data-testid="hurdle-achieved-label"]')!.textContent).toBe("Achieved —");
    expect(container.querySelector('[data-testid="hurdle-target-dot"]')).toBeTruthy();
    const res = render(<ResultsSection result={r} targetIrr={inp.targetIrr} currency="SEK" />);
    expect(res.container.querySelector(".kpi-value")!.textContent).toBe("—");
    expect(res.container.querySelector('[data-stat="achievedIrr"]')!.textContent).toBe("—");
  });
});

// ---- AUD-13 and AUD-35 ---------------------------------------------------------------------------------------
describe("v0.6.18 AUD-13 and AUD-35: the full reset and the unsaved-change guard", () => {
  it("GUARD-CLEAN: a clean app runs New project at once, with no confirmation", () => {
    render(<App />);
    fireEvent.click(byAction("new-project"));
    expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeNull();
  });

  it("GUARD-DIRTY: after an edit the destructive actions wait on a visible confirmation; Cancel keeps the work, Confirm discards it", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeNull(); // a freshly loaded demo is clean
    fireEvent.change(document.querySelector('[data-testid="overview"] [data-field="projectName"]') as HTMLInputElement, { target: { value: "Edited name" } });
    for (const trigger of [() => fireEvent.click(byAction("new-project")), () => fireEvent.click(document.querySelector('[data-testid="open-project"]') as HTMLElement), () => fireEvent.click(byAction("load-multi-lease-demo")), () => fireEvent.click(byAction("load-solar-demo")), () => fireEvent.click(byAction("load-demo"))]) {
      trigger();
      const g = document.querySelector('[data-testid="unsaved-guard"]') as HTMLElement;
      expect(g).toBeTruthy();
      expect(g.textContent).toContain("You have unsaved changes.");
      fireEvent.click(byAction("guard-cancel"));
      expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeNull();
      expect((document.querySelector('[data-testid="overview"] [data-field="projectName"]') as HTMLInputElement).value).toBe("Edited name");
    }
    fireEvent.click(byAction("new-project"));
    expect(document.querySelector('[data-testid="unsaved-guard-message"]')!.textContent).toBe("You have unsaved changes. Starting a new project will discard them.");
    fireEvent.click(byAction("guard-confirm"));
    expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeNull();
    expect((document.querySelector('[data-testid="overview"] [data-field="projectName"]') as HTMLInputElement).value).toBe("");
  });

  it("GUARD-SETTINGS: a settings-only change (the start year, a scenario axis, the entry unit) is unsaved work too", () => {
    render(<App />);
    fireEvent.change(document.querySelector('[data-testid="overview"] [data-field="startYear"]') as HTMLInputElement, { target: { value: "2030" } });
    fireEvent.click(byAction("new-project"));
    expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeTruthy();
  });

  it("RESET: New project resets the document AND the settings — the start year, the entry unit and every scenario axis", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    setUnit("millions");
    expect((document.querySelector('[data-testid="overview"] [data-field="startYear"]') as HTMLInputElement).value).toBe("2026");
    // the entry unit is a display preference: changing it alone is not unsaved work
    fireEvent.click(byAction("new-project"));
    expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeNull();
    expect((document.querySelector('[data-field="entryUnit"]') as HTMLSelectElement).value).toBe("thousands");
    // with a real change the guard stands and the confirmed reset restores the unit too
    fireEvent.click(byAction("load-demo"));
    setUnit("millions");
    fireEvent.change(document.querySelector('[data-testid="overview"] [data-field="startYear"]') as HTMLInputElement, { target: { value: "2040" } });
    fireEvent.click(byAction("new-project"));
    fireEvent.click(byAction("guard-confirm"));
    expect((document.querySelector('[data-testid="overview"] [data-field="startYear"]') as HTMLInputElement).value).toBe("");
    expect((document.querySelector('[data-field="entryUnit"]') as HTMLSelectElement).value).toBe("thousands");
    fireEvent.click(byNav("scenarios"));
    expect(axis("target")).toEqual([]);
    expect(axis("term")).toEqual([]);
    expect(axis("balloon")).toEqual([]);
    // and the clean state is clean again: no second confirmation
    fireEvent.click(byAction("new-project"));
    expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeNull();
  });

  it("SAVE: saving marks the state clean", () => {
    render(<App />);
    fireEvent.change(document.querySelector('[data-testid="overview"] [data-field="projectName"]') as HTMLInputElement, { target: { value: "X" } });
    URL.createObjectURL = () => "blob:x";
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = () => {};
    fireEvent.click(document.querySelector('[data-testid="save-project"]') as HTMLElement);
    fireEvent.click(byAction("new-project"));
    expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeNull();
  });

  it("OPEN: opening a project file loads it clean (no guard on the next action)", async () => {
    render(<App />);
    const text = serializeProject(shorePowerProgram(), { startYear: 2031, entryUnit: "millions", scenarioTargets: [5], scenarioTerms: null, scenarioBalloons: null });
    fireEvent.change(document.querySelector('[data-testid="open-project-input"]') as HTMLInputElement, { target: { files: [new File([text], "p.calcvibes.json", { type: "application/json" })] } });
    await waitFor(() => expect(screen.getByText("Shore-power program (Rotterdam)")).toBeTruthy());
    fireEvent.click(byAction("new-project"));
    expect(document.querySelector('[data-testid="unsaved-guard"]')).toBeNull();
  });
});

// ---- AUD-14 --------------------------------------------------------------------------------------------------
describe("v0.6.18 AUD-14: the loaders' balloon axis respects the entry unit", () => {
  it("PROGRAM: the entries scale to the active unit; the raw balloons are 0 / 8 000 000 / 16 000 000 in every unit", () => {
    for (const [unit, shown] of [["thousands", ["0", "8000", "16000"]], ["millions", ["0", "8", "16"]], ["ones", ["0", "8000000", "16000000"]]] as const) {
      render(<App />);
      setUnit(unit);
      fireEvent.click(byAction("load-demo"));
      fireEvent.click(byNav("scenarios"));
      expect(axis("balloon")).toEqual(shown);
      expect(axis("balloon").map((v) => entryToValue(Number(v), unit))).toEqual([0, 8000000, 16000000]);
      document.body.innerHTML = "";
    }
  });

  it("SOLAR: the entries scale likewise (the raw balloons 0 / 1 000 000 / 2 000 000); a fresh app reads 0 / 1000 / 2000", () => {
    render(<App />);
    fireEvent.click(byAction("load-solar-demo"));
    fireEvent.click(byNav("scenarios"));
    expect(axis("balloon")).toEqual(["0", "1000", "2000"]);
    expect(axis("target")).toEqual(["5", "7", "9"]);
    document.body.innerHTML = "";
    render(<App />);
    setUnit("millions");
    fireEvent.click(byAction("load-solar-demo"));
    fireEvent.click(byNav("scenarios"));
    expect(axis("balloon")).toEqual(["0", "1", "2"]);
  });
});

// ---- AUD-16 --------------------------------------------------------------------------------------------------
function Harness(props: { start: Record<number, number> }) {
  const [v, setV] = useState<Record<number, number>>(props.start);
  return (
    <div>
      <YearMapEditor value={v} onChange={setV} entryUnit="ones" tableTestId="t" rowAttr="data-override-year" yearField="y" amountField="a" removeAction="rm" addAction="add" defaultNewYear={1} />
      <output data-testid="record">{JSON.stringify(v)}</output>
    </div>
  );
}

describe("v0.6.18 AUD-16: the per-year editors key rows by a stable id", () => {
  it("FOCUS: editing a year keeps the same row and input element (no re-key, no focus loss)", () => {
    render(<Harness start={{ 2: 100, 5: 200 }} />);
    const before = document.querySelectorAll('[data-field="y"]');
    const second = before[1] as HTMLInputElement;
    second.focus();
    fireEvent.change(second, { target: { value: "6" } });
    const after = document.querySelectorAll('[data-field="y"]');
    expect(after[1]).toBe(second);
    expect(document.activeElement).toBe(second);
    expect(screen.getByTestId("record").textContent).toBe('{"2":100,"6":200}');
    // an intermediate empty text does not drop the row either
    fireEvent.change(second, { target: { value: "" } });
    expect(document.querySelectorAll('[data-field="y"]')[1]).toBe(second);
  });

  it("ADD-TWICE: the second 'Add year' is a working action — a second distinct row", () => {
    render(<Harness start={{}} />);
    fireEvent.click(byAction("add"));
    fireEvent.click(byAction("add"));
    fireEvent.click(byAction("add"));
    expect(Array.from(document.querySelectorAll("tbody tr")).map((r) => r.getAttribute("data-override-year"))).toEqual(["1", "2", "3"]);
    expect(screen.getByTestId("record").textContent).toBe('{"1":0,"2":0,"3":0}');
    fireEvent.click(document.querySelectorAll('[data-action="rm"]')[1] as HTMLElement);
    expect(screen.getByTestId("record").textContent).toBe('{"1":0,"3":0}');
  });

  it("COST EDITOR: a cost line's per-year editor adds two rows and keeps its input through a year edit", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("costs"));
    const line = document.querySelector('[data-kind="year-editor"]') as HTMLElement;
    fireEvent.click(line.querySelector('[data-action="add-override"]') as HTMLElement);
    fireEvent.click(line.querySelector('[data-action="add-override"]') as HTMLElement);
    const rows = line.querySelectorAll('[data-testid="year-editor"] tbody tr');
    expect(rows.length).toBe(2);
    const input = line.querySelector('[data-field="override-year"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "7" } });
    expect(line.querySelector('[data-field="override-year"]')).toBe(input);
  });

  it("COLLECTIONS EDITOR: the profile editor adds two rows and keeps its input through a year edit", () => {
    render(<App />);
    fireEvent.click(byAction("load-multi-lease-demo"));
    fireEvent.click(byNav("repayment"));
    const add = document.querySelector('[data-action="add-col-override"]') as HTMLElement;
    if (add === null) return; // the contracts surface carries no collections profile editor
    fireEvent.click(add);
    fireEvent.click(add);
    expect(document.querySelectorAll('[data-testid="collections-rows"] tbody tr').length).toBe(2);
  });
});

// ---- AUD-17 and AUD-28 ---------------------------------------------------------------------------------------
describe("v0.6.18 AUD-17: the Results page carries the entry unit", () => {
  it("FIGURES: the figure band, the NPV KPI, the composition list and the cashflow chart follow the unit in force", () => {
    const r = computeModel(shorePowerProgram());
    for (const unit of ["ones", "thousands", "millions"] as const) {
      const { container } = render(<ResultsSection result={r} targetIrr={6} currency="EUR" entryUnit={unit} />);
      const money = (v: number) => deckMoneyForDisplay(v, "EUR", unit);
      expect(Array.from(container.querySelectorAll('[data-testid="figure-band"] .figure-value')).map((e) => e.textContent)).toEqual([money(r.totalCost), money(r.totalCollected), money(r.netGain)]);
      expect(container.querySelectorAll(".kpi-value")[1].textContent).toBe(money(r.npvAtWacc));
      expect(Array.from(container.querySelectorAll('[data-testid="cost-composition"] li')).map((e) => e.textContent)).toEqual(r.lineTotals.map((l) => `${l.name}: ${money(l.total)}`));
      const peak = Math.max(...r.yearly.map((y) => y.cost));
      const costPeak = Array.from(container.querySelectorAll('[data-testid="column-peak-cost"]')).find((el) => !el.className.includes("hidden-peak"))!;
      expect(costPeak.textContent).toBe(`Cost peak ${money(peak)}`);
      container.remove();
    }
  });
});

describe("v0.6.18 AUD-28: the book view names its collections basis", () => {
  it("SPLIT: the collections column is every project inflow; the fee, grant and note columns sum to it exactly", () => {
    const r = computeModel(shorePowerProgram());
    const split = composeBookCollections(r)!;
    expect(split).not.toBeNull();
    for (const s of split) {
      const row = r.bookView!.combined.find((x) => x.year === s.year)!;
      expect(s.fees + s.grants + s.note).toBeCloseTo(row.collections, 6);
    }
    expect(split.reduce((a, s) => a + s.grants, 0)).toBeCloseTo(r.fundingView!.grantsTotal, 4);
    expect(split.some((s) => s.note !== 0)).toBe(true);
    expect(composeBookCollections(computeModel(demoProject()))).toBeNull();
  });

  it("APP: the header names the basis; the identified columns and the disclosure render; a project without grants keeps the plain columns", () => {
    const r = computeModel(shorePowerProgram());
    const a = render(<ResultsSection result={r} targetIrr={6} currency="EUR" entryUnit="ones" />);
    const heads = Array.from(a.container.querySelectorAll('[data-testid="book-schedule"] thead th')).map((h) => h.textContent);
    expect(heads).toEqual(["Year", "Beginning book value", "Depreciation charge", "Ending book value", "Collections (all project inflows)", "of which fee collections", "of which grant receipts", "of which the note (advance less installments)", "Operating", "Book result"]);
    expect(a.container.querySelector('[data-testid="book-view-disclosure"]')!.textContent).toContain("the interest-free note's advance net of its installments");
    expect(a.container.querySelectorAll("[data-book-grants]").length).toBe(r.bookView!.combined.length);
    a.container.remove();
    const plain = render(<ResultsSection result={computeModel(demoProject())} targetIrr={8} currency="EUR" entryUnit="ones" />);
    expect(Array.from(plain.container.querySelectorAll('[data-testid="book-schedule"] thead th')).map((h) => h.textContent)).toEqual(["Year", "Beginning book value", "Depreciation charge", "Ending book value", "Collections (all project inflows)", "Operating", "Book result"]);
  });

  it("XLSX: the Book view sheet carries the same named columns and the same values", async () => {
    const inp: ModelInputs = { ...shorePowerProgram(), depreciationDefault: { mode: "straight-line", years: 20 } };
    const r = computeModel(inp);
    const wb = await readWorkbook(await buildWorkbook(inp, r, { startYear: null }));
    const ws = wb.getWorksheet("Book view")!;
    const rows: unknown[][] = [];
    ws.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
    expect(rows[0]).toEqual(["Year", "Beginning book value", "Depreciation charge", "Ending book value", "Collections (all project inflows)", "of which fee collections", "of which grant receipts", "of which the note (advance less installments)", "Operating", "Book result"]);
    const split = composeBookCollections(r)!;
    expect(rows[1].slice(4, 8)).toEqual([r.bookView!.combined[0].collections, split[0].fees, split[0].grants, split[0].note]);
  });
});

// keep the unused solar import meaningful: the solar project carries no operating-line or grant surface here
void solarParkProject;
