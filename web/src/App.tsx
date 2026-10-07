import { useMemo, useState } from "react";
import { computeModel } from "./engine.js";
import type { ModelInputs } from "./engine.js";
import { validateInputs } from "../../core/src/validate.js";
import { blankCostLine, blankProject, demoProject, nextCostId } from "./state.js";
import type { CostLine, ModelResult } from "../../core/src/types.js";
import { CostModelSection } from "./sections/CostModelSection.js";
import { RepaymentSection } from "./sections/RepaymentSection.js";
import { OverviewSection } from "./sections/OverviewSection.js";
import { ResultsSection } from "./sections/ResultsSection.js";
import { AppraisalSection } from "./sections/AppraisalSection.js";
import { ScenariosSection } from "./sections/ScenariosSection.js";
import { Presentation } from "./presentation/Presentation.js";

type View = "overview" | "costs" | "repayment" | "appraisal" | "results" | "scenarios";

export function App() {
  const [inputs, setInputs] = useState<ModelInputs>(blankProject);
  const [view, setView] = useState<View>("overview");
  const [presOpen, setPresOpen] = useState(false);
  const [mode, setMode] = useState<"A" | "B" | "C">("A");
  const [modePayment, setModePayment] = useState(400000);

  const issues = useMemo(() => validateInputs(inputs), [inputs]);
  const result: ModelResult | null = useMemo(() => {
    if (issues.length > 0) return null;
    return computeModel(inputs);
  }, [inputs, issues]);

  const setProjectName = (v: string) => setInputs((p) => ({ ...p, projectName: v }));
  const setCurrency = (v: string) => setInputs((p) => ({ ...p, currency: v }));
  const setTargetIrr = (v: string) => setInputs((p) => ({ ...p, targetIrr: parseFloat(v) || 0 }));
  const setRepayment = (patch: Partial<ModelInputs["repayment"]>) =>
    setInputs((p) => ({ ...p, repayment: { ...p.repayment, ...patch } }));
  const setAppraisal = (patch: Partial<NonNullable<ModelInputs["appraisal"]>>) =>
    setInputs((p) => ({ ...p, appraisal: { ...(p.appraisal ?? { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } }), ...patch } }));
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
    return <Presentation inputs={inputs} result={result} onExit={() => setPresOpen(false)} />;
  }

  return (
    <div>
      <header>
        <h1>{inputs.projectName || "Untitled project"}</h1>
        <nav>
          {(["overview", "costs", "repayment", "appraisal", "results", "scenarios"] as View[]).map((v) => (
            <button key={v} data-nav={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
              {v === "costs" ? "Cost model" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>
        <button data-action="load-demo" onClick={() => setInputs(demoProject())}>Load demo project (Project Alpha)</button>
        <button data-action="new-project" onClick={() => setInputs(blankProject())}>New project</button>
        <button data-action="present" onClick={() => setPresOpen(true)} disabled={result === null}>Present results</button>
      </header>
      {issues.length > 0 && (
        <section data-testid="issues-summary" className="issues">
          <h2>Input issues ({issues.length})</h2>
          <ul>
            {issues.map((issue, i) => <li key={i}>{issue}</li>)}
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
        {view === "appraisal" && (
          <AppraisalSection inputs={inputs} setAppraisal={setAppraisal} result={result} />
        )}
        {view === "results" && result !== null && <ResultsSection result={result} targetIrr={inputs.targetIrr} currency={inputs.currency} />}
        {view === "scenarios" && <ScenariosSection inputs={inputs} />}
        {view === "results" && result === null && <p>Resolve the input issues to see results.</p>}
      </main>
      <footer>CalcVibes — every figure is computed by the core engine; the UI performs no financial arithmetic.</footer>
    </div>
  );
}
