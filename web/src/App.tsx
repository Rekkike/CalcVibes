import { useMemo, useState } from "react";
import { computeModel, solveTerm, CURRENCIES_ENUM } from "./engine.js";
import type { ModelInputs } from "./engine.js";
import { validateInputs } from "../../core/src/validate.js";
import { EngineInputError } from "../../core/src/validate.js";
import { blankCostLine, blankProject, demoProject, nextCostId } from "./state.js";
import type { CostLine } from "../../core/src/types.js";
import { CostModelSection } from "./sections/CostModelSection.js";
import { RepaymentSection } from "./sections/RepaymentSection.js";
import { OverviewSection } from "./sections/OverviewSection.js";
import { ResultsSection } from "./sections/ResultsSection.js";
import { AppraisalSection } from "./sections/AppraisalSection.js";
import { ScenariosSection } from "./sections/ScenariosSection.js";
import { OperatingSection } from "./sections/OperatingSection.js";
import { TariffSection } from "./sections/TariffSection.js";
import { FinancingSection } from "./sections/FinancingSection.js";
import { Presentation } from "./presentation/Presentation.js";

type View = "overview" | "costs" | "operating" | "repayment" | "tariff" | "financing" | "appraisal" | "results" | "scenarios";

export function App() {
  const [inputs, setInputs] = useState<ModelInputs>(blankProject);
  const [view, setView] = useState<View>("overview");
  const [presOpen, setPresOpen] = useState(false);
  const [mode, setMode] = useState<"A" | "B" | "C">("A");
  const [modePayment, setModePayment] = useState(400000);
  const [startYear, setStartYear] = useState<number | null>(null);
  const [startYearError, setStartYearError] = useState<string | null>(null);
  const [scenarioTargets, setScenarioTargets] = useState<number[] | null>(null);
  const [scenarioTerms, setScenarioTerms] = useState<number[] | null>(null);
  const [scenarioBalloons, setScenarioBalloons] = useState<number[] | null>(null);

  const issues = useMemo(() => {
    const list = validateInputs(inputs);
    if (!CURRENCIES_ENUM.includes(inputs.currency as (typeof CURRENCIES_ENUM)[number])) {
      list.push(`Currency "${inputs.currency}" is not a recognized currency (SEK, EUR, USD, GBP, NOK, DKK).`);
    }
    const checkList = (name: string, arr: number[] | null, validate: (v: number) => boolean, message: (v: number) => string) => {
      if (arr === null) return;
      if (arr.length === 0) {
        list.push(`Scenario ${name} list must not be empty.`);
        return;
      }
      const seen = new Set<number>();
      for (const v of arr) {
        if (!Number.isFinite(v)) {
          list.push(`Scenario ${name} list contains a non-finite entry.`);
        } else if (!validate(v)) {
          list.push(message(v));
        }
        if (seen.has(v)) {
          list.push(`Scenario ${name} list contains a duplicate entry (${v}).`);
        }
        seen.add(v);
      }
    };
    checkList("target", scenarioTargets, (v) => v >= 0, (v) => `Scenario target ${v} must not be negative.`);
    checkList("term", scenarioTerms, (v) => v > 0, (v) => `Scenario term ${v} must be positive.`);
    checkList("balloon", scenarioBalloons, (v) => v >= 0, (v) => `Scenario balloon ${v} must not be negative.`);
    return list;
  }, [inputs, scenarioTargets, scenarioTerms, scenarioBalloons]);
  const { result, engineIssues } = useMemo(() => {
    if (issues.length > 0) return { result: null, engineIssues: [] as string[] };
    try {
      return { result: computeModel(inputs), engineIssues: [] as string[] };
    } catch (e) {
      if (e instanceof EngineInputError) return { result: null, engineIssues: e.issues };
      throw e;
    }
  }, [inputs, issues]);
  const modeResult = useMemo(() => {
    if (issues.length > 0 || engineIssues.length > 0) return null;
    if (mode === "B") return { kind: "B" as const, ...solveTerm(inputs, modePayment) };
    if (mode === "C") return { kind: "C" as const, result: computeModel(inputs, { fixedPayment: modePayment }) };
    return null;
  }, [inputs, issues, mode, modePayment]);

  const setProjectName = (v: string) => setInputs((p) => ({ ...p, projectName: v }));
  const setCurrency = (v: string) => setInputs((p) => ({ ...p, currency: v }));
  const setTargetIrr = (v: string) => setInputs((p) => ({ ...p, targetIrr: parseFloat(v) || 0 }));
  const setRepayment = (patch: Partial<ModelInputs["repayment"]>) =>
    setInputs((p) => ({ ...p, repayment: { ...p.repayment, ...patch } }));
  const setAppraisal = (patch: Partial<NonNullable<ModelInputs["appraisal"]>>) =>
    setInputs((p) => ({ ...p, appraisal: { ...(p.appraisal ?? { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } }), ...patch } }));
  const setOperating = (lines: import("../../core/src/types.js").OperatingLine[]) =>
    setInputs((p) => ({ ...p, operatingLines: lines }));
  const setMaintenance = (m: import("../../core/src/types.js").MaintenanceConfig) =>
    setInputs((p) => ({ ...p, maintenance: m }));
  const setTariff = (t: import("../../core/src/types.js").TariffConfig) =>
    setInputs((p) => ({ ...p, tariff: t }));
  const setFinancing = (fc: import("../../core/src/types.js").FinancingConfig) =>
    setInputs((p) => ({ ...p, financing: fc }));
  const exportXlsx = async () => {
    if (result === null) return;
    const { buildWorkbook } = await import("./xlsx.js");
    const buffer = await buildWorkbook(inputs, result, { startYear });
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inputs.projectName || "project"}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const downloadPdf = async () => {
    if (result === null) return;
    const { buildDeckPdf } = await import("./pdf.js");
    const { deckSlides } = await import("./deck.js");
    const model = deckSlides(inputs, result, { startYear });
    const doc = buildDeckPdf(model, inputs.projectName || "project");
    doc.save(`${inputs.projectName || "project"}.pdf`);
  };
  const printDeck = () => { setPresOpen(true); };
  const addCost = () => setInputs((p) => ({ ...p, costs: [...p.costs, blankCostLine(nextCostId(p.costs))] }));
  const removeCost = (id: string) => setInputs((p) => ({ ...p, costs: p.costs.filter((c) => c.id !== id) }));
  const updateCost = (id: string, patch: Partial<CostLine>) =>
    setInputs((p) => ({ ...p, costs: p.costs.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  const issueByLine = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of issues) {
      const m = issue.match(/^Cost line (\S+?) /);
      if (m) {
        const id = m[1];
        const list = map.get(id) || [];
        list.push(issue);
        map.set(id, list);
      }
    }
    return map;
  }, [issues]);

  if (presOpen) {
    return <Presentation inputs={inputs} result={result} onExit={() => setPresOpen(false)} startYear={startYear} />;
  }

  return (
    <div className="app-root">
      <header>
        <h1>{inputs.projectName || "Untitled project"}</h1>
        <nav>
          {(["overview", "costs", "operating", "repayment", "tariff", "financing", "appraisal", "results", "scenarios"] as View[]).map((v) => (
            <button key={v} data-nav={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
              {v === "costs" ? "Cost model" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>
        <button data-action="load-demo" onClick={() => setInputs(demoProject())}>Load demo project (Project Alpha)</button>
        <button data-action="new-project" onClick={() => setInputs(blankProject())}>New project</button>
        <button data-action="present" onClick={() => setPresOpen(true)}>Present results</button>
        <label>Project start year (optional, 1900–2200){" "}
          <input data-field="startYear" type="number" value={startYear ?? ""} onChange={(e) => {
            const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
            setStartYear(v !== null && !Number.isNaN(v) ? v : null);
            if (v !== null && !Number.isNaN(v) && (v < 1900 || v > 2200)) {
              setStartYearError("Project start year must be between 1900 and 2200.");
            } else {
              setStartYearError(null);
            }
          }} />
        </label>
        {startYearError !== null && <p data-testid="start-year-error" className="warning">{startYearError}</p>}
        <button data-action="export-xlsx" onClick={exportXlsx} disabled={result === null}>Export XLSX</button>
        <button data-action="print-deck" onClick={printDeck}>Print deck</button>
        <button data-action="download-pdf" onClick={downloadPdf} disabled={result === null}>Download PDF</button>
        {result === null && <span data-testid="export-disabled-reason" className="muted">Exports, print, and PDF are disabled until the input issues are resolved.</span>}
      </header>
      {(issues.length > 0 || engineIssues.length > 0) && (
        <section data-testid="issues-summary" className="issues">
          <h2>Input issues ({issues.length + engineIssues.length})</h2>
          <ul>
            {[...issues, ...engineIssues].map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </section>
      )}
      <main>
        {view === "overview" && (
          <OverviewSection inputs={inputs} result={result} setProjectName={setProjectName} setTargetIrr={setTargetIrr} />
        )}
        {view === "costs" && (
          <CostModelSection
            inputs={inputs}
            issueByLine={issueByLine}
            setCurrency={setCurrency}
            addCost={addCost}
            removeCost={removeCost}
            updateCost={updateCost}
          />
        )}
        {view === "repayment" && (
          <RepaymentSection inputs={inputs} result={result} setRepayment={setRepayment} mode={mode} setMode={setMode} modePayment={modePayment} setModePayment={setModePayment} />
        )}
        {view === "operating" && (
          <OperatingSection inputs={inputs} result={result} setOperating={setOperating} setMaintenance={setMaintenance} />
        )}
        {view === "tariff" && (
          <TariffSection inputs={inputs} result={result} setTariff={setTariff} startYear={startYear} />
        )}
        {view === "financing" && (
          <FinancingSection inputs={inputs} setFinancing={setFinancing} />
        )}
        {view === "appraisal" && (
          <AppraisalSection inputs={inputs} setAppraisal={setAppraisal} result={result} />
        )}
        {view === "results" && result !== null && mode === "A" && <ResultsSection result={result} targetIrr={inputs.targetIrr} currency={inputs.currency} startYear={startYear} />}
        {view === "results" && modeResult !== null && mode === "B" && (
          <section data-testid="mode-results">
            <h2>Mode B — solved term</h2>
            {modeResult.kind === "B" && modeResult.paymentCount !== null ? (
              <>
                <p data-stat="modeBTerm">Solved term: {modeResult.termYears} years ({modeResult.paymentCount} payments; last payment month {modeResult.lastPaymentMonth}).</p>
                <ResultsSection result={modeResult.result} targetIrr={inputs.targetIrr} currency={inputs.currency} startYear={startYear} />
              </>
            ) : (
              <p data-stat="modeBInfeasible">Infeasible: the given payment can never reach the cost NPV within the solver bounds; the shortfall is {modeResult.kind === "B" && modeResult.shortfall !== null ? modeResult.shortfall.toFixed(2) : "—"}.</p>
            )}
          </section>
        )}
        {view === "results" && modeResult !== null && mode === "C" && (
          <section data-testid="mode-results">
            <h2>Mode C — evaluation of the given payment</h2>
            <ResultsSection result={modeResult.result} targetIrr={inputs.targetIrr} currency={inputs.currency} startYear={startYear} />
          </section>
        )}
        {view === "scenarios" && <ScenariosSection inputs={inputs} scenarioTargets={scenarioTargets} scenarioTerms={scenarioTerms} scenarioBalloons={scenarioBalloons} onScenarioTargetsChange={setScenarioTargets} onScenarioTermsChange={setScenarioTerms} onScenarioBalloonsChange={setScenarioBalloons} />}
        {view === "results" && result === null && <p>Resolve the input issues to see results.</p>}
      </main>
      <footer>CalcVibes — every figure is computed by the core engine; the UI performs no financial arithmetic.</footer>
    </div>
  );
}
