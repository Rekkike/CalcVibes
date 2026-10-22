import { useMemo, useRef, useState } from "react";
import { computeModel, solveTerm, valueToEntry, CURRENCIES_ENUM, ENTRY_UNITS, VERSION } from "./engine.js";
import type { EntryUnit } from "./engine.js";
import type { ModelInputs } from "./engine.js";
import { validateInputs } from "../../core/src/validate.js";
import { EngineInputError } from "../../core/src/validate.js";
import { restoreLegacyFinancing } from "../../core/src/financing.js";
import { blankCostLine, blankProject, migrateOnLoad, landNewbuildProject, nextCostId, shorePowerProgram, solarParkProject } from "./state.js";
import type { CostLine } from "../../core/src/types.js";
import { CostModelSection } from "./sections/CostModelSection.js";
import { RepaymentSection } from "./sections/RepaymentSection.js";
import { OverviewSection } from "./sections/OverviewSection.js";
import { TimelineSection } from "./sections/TimelineSection.js";
import { ResultsSection } from "./sections/ResultsSection.js";
import { AppraisalSection } from "./sections/AppraisalSection.js";
import { ScenariosSection } from "./sections/ScenariosSection.js";
import { OperatingSection } from "./sections/OperatingSection.js";
import { TariffSection } from "./sections/TariffSection.js";
import { FundingSection } from "./sections/FundingSection.js";
import { FinancingSection } from "./sections/FinancingSection.js";
import { YearlyDetailSection } from "./sections/YearlyDetailSection.js";
import { Presentation } from "./presentation/Presentation.js";
import { RootErrorBoundary } from "./ErrorBoundary.js";
import { parseProject, ProjectFileError } from "../../core/src/fileio.js";
import { downloadProjectFile } from "./projectFile.js";

// v0.6.18 (AUD-13/14/35): the project state a "New project", a loader or an Open replaces — the document and every
// setting the project file carries — snapshotted for the unsaved-change guard. The default entry unit is thousands.
interface ProjectSnapshot {
  inputs: ModelInputs;
  startYear: number | null;
  entryUnit: EntryUnit;
  targets: number[] | null;
  terms: number[] | null;
  balloons: number[] | null;
  grantScales: number[] | null;
}
const DEFAULT_ENTRY_UNIT: EntryUnit = "thousands";
// The entry unit is a display preference (it re-reads the same raw values): changing it is not unsaved work, so it stays
// out of the dirty comparison; New project and a file Open still reset or sync it.
const snapshotKey = (s: ProjectSnapshot): string => JSON.stringify({ ...s, entryUnit: null });
const blankSnapshot = (): ProjectSnapshot => ({ inputs: blankProject(), startYear: null, entryUnit: DEFAULT_ENTRY_UNIT, targets: null, terms: null, balloons: null, grantScales: null });

type View = "overview" | "costs" | "operating" | "repayment" | "tariff" | "funding" | "financing" | "appraisal" | "timeline" | "results" | "scenarios" | "detail";

export function App() {
  const [inputs, setInputs] = useState<ModelInputs>(blankProject);
  const [view, setView] = useState<View>("overview");
  const [presOpen, setPresOpen] = useState(false);
  // v0.6.17: the month gridlines on the Gantt — view state only (never a document field), off by default
  const [monthGrid, setMonthGrid] = useState(false);
  const [mode, setMode] = useState<"A" | "B" | "C">("A");
  const [modePayment, setModePayment] = useState(400000);
  const [startYear, setStartYear] = useState<number | null>(null);
  const [entryUnit, setEntryUnit] = useState<EntryUnit>(DEFAULT_ENTRY_UNIT);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    // v0.6.5 Task G/W15: the theme follows prefers-color-scheme; with no system preference or no
    // matchMedia the posture falls back to DARK. The header select remains the manual override.
    try {
      if (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    } catch {
      // the API is absent or throws: the dark fallback stands
    }
    return "dark";
  });
  const [startYearError, setStartYearError] = useState<string | null>(null);
  const [scenarioTargets, setScenarioTargets] = useState<number[] | null>(null);
  const [scenarioTerms, setScenarioTerms] = useState<number[] | null>(null);
  const [scenarioBalloons, setScenarioBalloons] = useState<number[] | null>(null);
  const [scenarioGrantScales, setScenarioGrantScales] = useState<number[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // v0.6.18 (AUD-35): the unsaved-change guard — the key of the state last loaded, saved or started fresh, and
  // the action waiting on the visible confirmation.
  const [baselineKey, setBaselineKey] = useState<string>(() => snapshotKey(blankSnapshot()));
  const [pendingAction, setPendingAction] = useState<{ label: string; run: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);


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
    // v0.6.10 Task E.5 (Task D.1): the grant-scale axis — a factor multiplies every grant row's
    // amount; 0 removes the grants (a zero-amount grant is invalid); negative factors are refused.
    checkList("grant-scale", scenarioGrantScales, (v) => v >= 0, (v) => `Scenario grant-scale ${v} must not be negative.`);
    return list;
  }, [inputs, scenarioTargets, scenarioTerms, scenarioBalloons, scenarioGrantScales]);
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
    try {
      if (mode === "B") return { kind: "B" as const, ...solveTerm(inputs, modePayment) };
      if (mode === "C") return { kind: "C" as const, result: computeModel(inputs, { fixedPayment: modePayment }) };
    } catch (e) {
      // v0.6.12.2 (AUD-8): Mode B is the true inverse of Mode A — it nets the funding, honors the
      // calculated residual and solves exactly one solved contract; the engine refusals
      // (SCE-PROFILE, SCE-CONTRACTS, SCE-TARIFF) render verbatim, never a crash.
      if (e instanceof EngineInputError) return { kind: "refusal" as const, message: e.issues.join(" ") };
      throw e;
    }
    return null;
  }, [inputs, issues, mode, modePayment]);

  const currentSnapshot = (): ProjectSnapshot => ({ inputs, startYear, entryUnit, targets: scenarioTargets, terms: scenarioTerms, balloons: scenarioBalloons, grantScales: scenarioGrantScales });
  const dirty = snapshotKey(currentSnapshot()) !== baselineKey;
  const applySnapshot = (s: ProjectSnapshot) => {
    setInputs(s.inputs);
    setStartYear(s.startYear);
    setEntryUnit(s.entryUnit);
    setScenarioTargets(s.targets);
    setScenarioTerms(s.terms);
    setScenarioBalloons(s.balloons);
    setScenarioGrantScales(s.grantScales);
    setBaselineKey(snapshotKey(s));
  };
  // A destructive action (New project, Open project, a loader) runs at once on a clean state; with unsaved
  // changes it waits on the visible confirmation — nothing disappears quietly.
  const guard = (label: string, run: () => void) => {
    if (dirty) setPendingAction({ label, run });
    else run();
  };
  // AUD-13: "New project" is the FULL reset — the document, the start year, the entry unit and every scenario axis.
  const newProject = () => {
    applySnapshot(blankSnapshot());
    setMode("A");
    setView("overview");
    setStartYearError(null);
    setLoadError(null);
  };
  // AUD-14: the loaders' balloon axis holds entry-unit values: the raw balloons scale to the ACTIVE unit.
  const loadPreset = (inputsNext: ModelInputs, preset: { startYear?: number | null; targets: number[]; terms?: number[]; balloonsRaw?: number[] }) => {
    applySnapshot({
      inputs: migrateOnLoad(inputsNext),
      startYear: preset.startYear === undefined ? startYear : preset.startYear,
      entryUnit,
      targets: preset.targets,
      terms: preset.terms === undefined ? scenarioTerms : preset.terms,
      balloons: preset.balloonsRaw === undefined ? scenarioBalloons : preset.balloonsRaw.map((v) => valueToEntry(v, entryUnit)),
      grantScales: scenarioGrantScales,
    });
  };
  const setProjectName = (v: string) => setInputs((p) => ({ ...p, projectName: v }));
  const setCurrency = (v: string) => setInputs((p) => ({ ...p, currency: v }));
  const setTargetIrr = (v: string) => setInputs((p) => ({ ...p, targetIrr: parseFloat(v) || 0 }));
  const setTimeline = (tl: import("../../core/src/types.js").TimelineBlock) => setInputs((p) => ({ ...p, timeline: tl }));
  const setProjectLength = (v: number | null) => setInputs((p) => ({ ...p, projectLengthYears: v }));
  const setRepayment = (patch: Partial<ModelInputs["repayment"]>) =>
    setInputs((p) => ({ ...p, repayment: { ...p.repayment, ...patch } }));
  const setContracts = (contracts: import("../../core/src/types.js").ContractParams[]) =>
    setInputs((p) => ({ ...p, contracts }));
  const setDepreciationDefault = (cfg: import("../../core/src/types.js").DepreciationConfig | null) =>
    setInputs((p) => ({ ...p, depreciationDefault: cfg }));
  const setAppraisal = (patch: Partial<NonNullable<ModelInputs["appraisal"]>>) =>
    setInputs((p) => ({ ...p, appraisal: { ...(p.appraisal ?? { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } }), ...patch } }));
  const setOperating = (lines: import("../../core/src/types.js").OperatingLine[]) =>
    setInputs((p) => ({ ...p, operatingLines: lines }));
  const setMaintenance = (m: import("../../core/src/types.js").MaintenanceConfig) =>
    setInputs((p) => ({ ...p, maintenance: m }));
  const setTariff = (t: import("../../core/src/types.js").TariffConfig) =>
    setInputs((p) => ({ ...p, tariff: t }));
  const setFacilities = (list: import("../../core/src/types.js").Facility[]) =>
    setInputs((p) => ({ ...p, facilities: list }));
  const setFacilityOptions = (o: import("../../core/src/types.js").FacilityOptions | undefined) =>
    setInputs((p) => ({ ...p, facilityOptions: o }));
  const setFunding = (fc: import("../../core/src/types.js").FundingConfig | null) =>
    setInputs((p) => ({ ...p, funding: fc }));
  const openProjectFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const loaded = parseProject(String(reader.result));
        applySnapshot({
          inputs: migrateOnLoad(loaded.inputs),
          startYear: loaded.settings.startYear,
          entryUnit: loaded.settings.entryUnit,
          targets: loaded.settings.scenarioTargets,
          terms: loaded.settings.scenarioTerms,
          balloons: loaded.settings.scenarioBalloons,
          grantScales: loaded.settings.scenarioGrantScales ?? null,
        });
        setMode("A");
        setLoadError(null);
      } catch (e) {
        setLoadError(e instanceof ProjectFileError ? e.message : "FILE-MALFORMED: the file is not valid JSON and cannot be opened.");
      }
    };
    reader.readAsText(file);
  };
  const saveProjectFile = () => {
    downloadProjectFile(inputs, { startYear, entryUnit, scenarioTargets, scenarioTerms, scenarioBalloons, scenarioGrantScales });
    setBaselineKey(snapshotKey(currentSnapshot()));
  };
  const exportXlsx = async () => {
    if (result === null) return;
    const { buildWorkbook } = await import("./xlsx.js");
    const buffer = await buildWorkbook(restoreLegacyFinancing(inputs), result, { startYear, ...(inputs.facilities !== undefined ? { facilities: inputs.facilities } : {}), ...(inputs.facilityOptions !== undefined ? { facilityOptions: inputs.facilityOptions } : {}) });
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
    const model = deckSlides(inputs, result, { startYear, entryUnit, scenarioTargets, scenarioTerms, scenarioBalloons, monthGrid });
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
    return <RootErrorBoundary><Presentation inputs={inputs} result={result} onExit={() => setPresOpen(false)} startYear={startYear} entryUnit={entryUnit} scenarioTargets={scenarioTargets} scenarioTerms={scenarioTerms} scenarioBalloons={scenarioBalloons} monthGrid={monthGrid} /></RootErrorBoundary>;
  }

  return (
    <div className="app-root" data-theme={theme}>
      <header className="app-header">
        <div className="toolbar-left">
          <h1>{inputs.projectName || "Untitled project"}</h1>
          <button data-action="new-project" onClick={() => guard("Starting a new project", newProject)}>New project</button>
          <button data-testid="save-project" onClick={saveProjectFile}>Save project</button>
          <button data-testid="open-project" onClick={() => guard("Opening a project", () => fileInputRef.current?.click())}>Open project</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".calcvibes.json,.json"
            data-testid="open-project-input"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              if (file) openProjectFile(file);
              e.target.value = "";
            }}
          />
          {/* v0.6.7 Task B / v0.6.10 Task F: the realistic demo rotation. The program loader
              (the whole-program port fixture of record) presets the start year 2026 (a
              presentation-only label; the first collection year 3 reads calendar 2028) and the
              three scenario axes (the balloon entries are entry-unit values; at unit millions,
              8 and 16 scale to raw balloons of 8 000 000 and 16 000 000 at compute). The grant-
              scale axis stays empty (the Round 23 empty-boxes principle). The land loader
              presets the target axis only; the term and balloon axes are inert in contracts
              mode (finding F1), so presetting them would be dishonest. The entry-unit select is
              untouched: only project-file open syncs the unit. */}
          <button data-action="load-demo" onClick={() => guard("Loading the shore-power demo", () => loadPreset(shorePowerProgram(), { startYear: 2026, targets: [4, 6, 8], terms: [15, 20, 25], balloonsRaw: [0, 8000000, 16000000] }))}>Load shore-power program demo (Rotterdam)</button>
          <button data-action="load-multi-lease-demo" onClick={() => guard("Loading the land newbuild demo", () => loadPreset(landNewbuildProject(), { targets: [6, 8, 10] }))}>Load land newbuild demo (Mjøstårnet)</button>
          {/* v0.6.6 Task B: the third loader presets the scenario axes (the amendment of record: the balloon
              entries are entry-unit values; at unit thousands, 1000 and 2000 scale to raw balloons of
              1 000 000 and 2 000 000 at compute). The other two loaders are untouched: additive only. */}
          <button data-action="load-solar-demo" onClick={() => guard("Loading the solar park demo", () => loadPreset(solarParkProject(), { targets: [5, 7, 9], terms: [15, 20, 25], balloonsRaw: [0, 1000000, 2000000] }))}>Load solar park demo</button>
        </div>
        <div data-testid="header-controls" className="header-controls">
          <button data-action="present" onClick={() => setPresOpen(true)}>Present results</button>
          <button data-action="download-pdf" onClick={downloadPdf} disabled={result === null}>Download PDF</button>
          <button data-action="print-deck" onClick={printDeck}>Print deck</button>
          <button data-action="export-xlsx" onClick={exportXlsx} disabled={result === null}>Export XLSX</button>
          {result === null && <span data-testid="export-disabled-reason" className="muted">XLSX and PDF export are disabled until the input issues are resolved.</span>}
          <label>Entry unit{" "}
            <select data-field="entryUnit" value={entryUnit} onChange={(e) => setEntryUnit(e.target.value as EntryUnit)}>
              {ENTRY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label>Theme{" "}
            <select data-field="theme" value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark")}>
              <option value="light">light</option>
              <option value="dark">dark</option>
            </select>
          </label>
          <span data-testid="version" className="muted">{VERSION}</span>
        </div>
        <nav data-testid="nav-groups" className="nav-groups">
          <div data-nav-group="model" className="nav-group">
            <span className="nav-group-label">Model</span>
            <div className="nav-group-views">
              {(["overview", "costs", "operating", "repayment", "tariff"] as View[]).map((v) => (
                <button key={v} data-nav={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
                  {v === "costs" ? "Cost model" : v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div data-nav-group="finance" className="nav-group">
            <span className="nav-group-label">Finance</span>
            <div className="nav-group-views">
              {(["funding", "financing", "appraisal"] as View[]).map((v) => (
                <button key={v} data-nav={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div data-nav-group="plan" className="nav-group">
            <span className="nav-group-label">Plan</span>
            <div className="nav-group-views">
              {(["timeline"] as View[]).map((v) => (
                <button key={v} data-nav={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div data-nav-group="read" className="nav-group">
            <span className="nav-group-label">Read</span>
            <div className="nav-group-views">
              {(["results", "scenarios", "detail"] as View[]).map((v) => (
                <button key={v} data-nav={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </nav>
      </header>
      {pendingAction !== null && (
        <div data-testid="unsaved-guard" role="alertdialog" className="warning unsaved-guard">
          <p data-testid="unsaved-guard-message">You have unsaved changes. {pendingAction.label} will discard them.</p>
          <button data-action="guard-confirm" onClick={() => { const run = pendingAction.run; setPendingAction(null); run(); }}>Discard the changes and continue</button>{" "}
          <button data-action="guard-cancel" onClick={() => setPendingAction(null)}>Keep my changes</button>
        </div>
      )}
      {loadError !== null && (
        <div data-testid="load-error" className="warning">{loadError}</div>
      )}
      {(issues.length > 0 || engineIssues.length > 0) && (
        <section data-testid="issues-summary" className="issues">
          <h2>Input issues ({issues.length + engineIssues.length})</h2>
          <ul>
            {[...issues, ...engineIssues].map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </section>
      )}
      <main>
        <RootErrorBoundary>
        {view === "overview" && (
          <OverviewSection inputs={inputs} result={result} startYear={startYear} entryUnit={entryUnit} setStartYear={(v) => {
            // v0.6.13 Task F (AUD-18): the writer refuses — symmetric with the file layer's
            // FILE-SETTINGS bound (null or a whole year between 1900 and 2200); a refused entry
            // never applies and the refusal follows.
            if (v !== null && (v < 1900 || v > 2200)) {
              setStartYearError("Project start year must be between 1900 and 2200.");
            } else if (v !== null && !Number.isInteger(v)) {
              setStartYearError("Project start year must be a whole year between 1900 and 2200.");
            } else {
              setStartYear(v);
              setStartYearError(null);
            }
          }} startYearError={startYearError} setProjectName={setProjectName} setTargetIrr={setTargetIrr} setProjectLength={setProjectLength} />
        )}
        {view === "costs" && (
          <CostModelSection
            inputs={inputs}
            issueByLine={issueByLine}
            setCurrency={setCurrency}
            addCost={addCost}
            removeCost={removeCost}
            updateCost={updateCost}
            result={result}
            setDepreciationDefault={setDepreciationDefault}
            entryUnit={entryUnit}
            startYear={startYear}
          />
        )}
        {view === "repayment" && (
          <RepaymentSection inputs={inputs} result={result} setRepayment={setRepayment} setContracts={setContracts} mode={mode} setMode={setMode} modePayment={modePayment} setModePayment={setModePayment} modeRefusal={modeResult !== null && modeResult.kind === "refusal" ? modeResult.message : null} startYear={startYear} entryUnit={entryUnit} />
        )}
        {view === "operating" && (
          <OperatingSection inputs={inputs} result={result} setOperating={setOperating} setMaintenance={setMaintenance} entryUnit={entryUnit} />
        )}
        {view === "tariff" && (
          <TariffSection inputs={inputs} result={result} setTariff={setTariff} startYear={startYear} entryUnit={entryUnit} />
        )}
        {view === "funding" && (
          <FundingSection inputs={inputs} result={result} setFunding={setFunding} startYear={startYear} entryUnit={entryUnit} />
        )}
        {view === "timeline" && (
          <TimelineSection inputs={inputs} result={result} setTimeline={setTimeline} startYear={startYear} monthGrid={monthGrid} setMonthGrid={setMonthGrid} />
        )}
        {view === "financing" && (
          <FinancingSection inputs={inputs} result={result} setFacilities={setFacilities} setFacilityOptions={setFacilityOptions} entryUnit={entryUnit} />
        )}
        {view === "appraisal" && (
          <AppraisalSection inputs={inputs} setAppraisal={setAppraisal} result={result} entryUnit={entryUnit} />
        )}
        {view === "results" && result !== null && mode === "A" && <ResultsSection result={result} targetIrr={inputs.targetIrr} currency={inputs.currency} startYear={startYear} entryUnit={entryUnit} />}
        {view === "results" && modeResult !== null && modeResult.kind === "refusal" && (
          <section data-testid="mode-results">
            <h2>Mode {mode} — refused</h2>
            <p data-stat="modeRefusal">The engine refused to compute the mode result for this project: {modeResult.message}</p>
          </section>
        )}
        {view === "results" && modeResult !== null && modeResult.kind === "B" && (
          <section data-testid="mode-results">
            <h2>Mode B — solved term</h2>
            {modeResult.paymentCount !== null ? (
              <>
                <p data-stat="modeBTerm">Solved term: {modeResult.termYears} years ({modeResult.paymentCount} payments; last payment month {modeResult.lastPaymentMonth}).</p>
                <ResultsSection result={modeResult.result} targetIrr={inputs.targetIrr} currency={inputs.currency} startYear={startYear} entryUnit={entryUnit} />
              </>
            ) : (
              <p data-stat="modeBInfeasible">Infeasible: the given payment can never reach the cost NPV within the solver bounds; the shortfall is {modeResult.kind === "B" && modeResult.shortfall !== null ? modeResult.shortfall.toFixed(2) : "—"}.</p>
            )}
          </section>
        )}
        {view === "results" && modeResult !== null && modeResult.kind === "C" && (
          <section data-testid="mode-results">
            <h2>Mode C — evaluation of the given payment</h2>
            <ResultsSection result={modeResult.result} targetIrr={inputs.targetIrr} currency={inputs.currency} startYear={startYear} entryUnit={entryUnit} />
          </section>
        )}
        {view === "detail" && result !== null && (
          <YearlyDetailSection inputs={inputs} result={result} startYear={startYear} entryUnit={entryUnit} />
        )}
        {view === "scenarios" && <ScenariosSection inputs={inputs} scenarioTargets={scenarioTargets} scenarioTerms={scenarioTerms} scenarioBalloons={scenarioBalloons} scenarioGrantScales={scenarioGrantScales} onScenarioTargetsChange={setScenarioTargets} onScenarioTermsChange={setScenarioTerms} onScenarioBalloonsChange={setScenarioBalloons} onScenarioGrantScalesChange={setScenarioGrantScales} entryUnit={entryUnit} currency={inputs.currency} />}
        {view === "results" && result === null && <p>Resolve the input issues to see results.</p>}
        </RootErrorBoundary>
      </main>
      <footer>CalcVibes — every figure is computed by the core engine; the UI performs no financial arithmetic.</footer>
    </div>
  );
}
