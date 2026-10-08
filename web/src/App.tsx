import { useMemo, useState } from "react";
import { computeModel, solveTerm } from "./engine.js";
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
import { Presentation } from "./presentation/Presentation.js";

type View = "overview" | "costs" | "operating" | "repayment" | "tariff" | "appraisal" | "results" | "scenarios";

export function App() {
  const [inputs, setInputs] = useState<ModelInputs>(blankProject);
  const [view, setView] = useState<View>("overview");
  const [presOpen, setPresOpen] = useState(false);
  const [mode, setMode] = useState<"A" | "B" | "C">("A");
  const [modePayment, setModePayment] = useState(400000);
  const [startYear, setStartYear] = useState<number | null>(null);
  const [startYearError, setStartYearError] = useState<string | null>(null);

  const issues = useMemo(() => validateInputs(inputs), [inputs]);
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
    <div>
      <header>
        <h1>{inputs.projectName || "Untitled project"}</h1>
        <nav>
          {(["overview", "costs", "operating", "repayment", "tariff", "appraisal", "results", "scenarios"] as View[]).map((v) => (
            <button key={v} data-nav={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
              {v === "costs" ? "Cost model" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>
        <button data-action="load-demo" onClick={() => setInputs(demoProject())}>Load demo project (Project Alpha)</button>
        <button data-action="new-project" onClick={() => setInputs(blankProject())}>New project</button>
        <button data-action="present" onClick={() => setPresOpen(true)} disabled={result === null}>Present results</button>
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
        {view === "scenarios" && <ScenariosSection inputs={inputs} />}
        {view === "results" && result === null && <p>Resolve the input issues to see results.</p>}
      </main>
      <footer>CalcVibes — every figure is computed by the core engine; the UI performs no financial arithmetic.</footer>
    </div>
  );
}
