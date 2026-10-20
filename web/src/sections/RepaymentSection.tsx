import type { ContractParams, ModelInputs, ModelResult } from "../../../core/src/types.js";
import { moneyForDisplay, entryToValue, feeForDisplay } from "../engine.js";
import type { CurrencyCode, EntryUnit } from "../engine.js";
import { MoneyEditor } from "../MoneyEditor.js";
import { blankContract, nextContractId, spreadFill, yearHeader } from "../state.js";

export function RepaymentSection(props: {
  inputs: ModelInputs;
  result: ModelResult | null;
  setRepayment: (patch: Partial<ModelInputs["repayment"]>) => void;
  setContracts: (contracts: ContractParams[]) => void;
  mode: "A" | "B" | "C";
  setMode: (m: "A" | "B" | "C") => void;
  modePayment: number;
  setModePayment: (p: number) => void;
  startYear?: number | null;
  entryUnit: EntryUnit;
}) {
  const { inputs, result, setRepayment, setContracts, mode, setMode, modePayment, setModePayment, startYear = null, entryUnit } = props;
  const currency = (inputs.currency as CurrencyCode) ?? "SEK";
  const money = (v: number) => moneyForDisplay(v, currency, entryUnit);
  // v0.6.9 Task F (finding W28): the solved payment figure renders through feeForDisplay.
  const fee = (v: number) => feeForDisplay(v, currency, entryUnit);
  const r = inputs.repayment;
  const num = (key: keyof ModelInputs["repayment"]) => (e: { target: { value: string } }) =>
    setRepayment({ [key]: parseFloat(e.target.value) || 0 } as Partial<ModelInputs["repayment"]>);
  const explicit = (inputs.contracts ?? []).length > 0;
  const contracts = inputs.contracts ?? [];
  const updateContract = (id: string, patch: Partial<ContractParams>) =>
    setContracts(contracts.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const updateReinvestment = (c: ContractParams, idx: number, patch: Partial<{ year: number; amount: number }>) => {
    const ris = (c.reinvestments ?? []).map((ri, j) => (j === idx ? { ...ri, ...patch } : ri));
    updateContract(c.id, { reinvestments: ris });
  };
  return (
    <section data-testid="repayment">
      <h2>Repayment</h2>
      <label>Mode{" "}
        <select data-field="mode" value={mode} onChange={(e) => setMode(e.target.value as "A" | "B" | "C")}>
          <option value="A">Mode A — solve the payment</option>
          <option value="B">Mode B — solve the term given a payment</option>
          <option value="C">Mode C — evaluate a given payment</option>
        </select>
      </label>
      {mode !== "A" && (
        <label>Payment per period <MoneyEditor dataField="modePayment" value={modePayment} entryUnit={entryUnit} onChange={setModePayment} /></label>
      )}
      {/* v0.6.8 Task E (finding W21): the optional, user-authored repayment basis note. Empty by
          default, never required, no engine semantics (engine-blind by the pinned check); the
          browser enforces the 500-character bound. Surfaced in the deck and the PDF. */}
      <label>Basis note (optional){" "}
        <input
          data-field="repaymentBasisNote"
          className="muted"
          type="text"
          maxLength={500}
          value={r.basisNote ?? ""}
          placeholder="Optional note on how this block is meant — shown in the deck and PDF"
          onChange={(e) => setRepayment({ basisNote: e.target.value === "" ? null : e.target.value })}
        />
      </label>
      <div data-testid="contracts-editor">
        <h3>Contracts (deals)</h3>
        <p className="muted">Each contract is a negotiated deal. Solved contracts share one per-period payment solved so the whole project hits the target; evaluated contracts carry a set payment or a per-year collections profile.</p>
        {!explicit && (
          <p data-testid="legacy-contract-note" className="muted">This project runs one payment stream (the repayment configuration below maps to one solved contract). Add a contract to model multiple deals.</p>
        )}
        {contracts.map((c) => (
          <div key={c.id} data-testid="contract-card" data-contract={c.id} data-contract-mode={c.mode}>
            <label>Label <input data-field="contract-label" value={c.label} onChange={(e) => updateContract(c.id, { label: e.target.value })} /></label>
            <label>Mode{" "}
              <select data-field="contract-mode" value={c.mode} onChange={(e) => updateContract(c.id, { mode: e.target.value as ContractParams["mode"] })}>
                <option value="solved">Solved (shares the solved payment)</option>
                <option value="evaluated">Evaluated (a set deal)</option>
              </select>
            </label>
            <label>Start year <input data-field="contract-startYear" type="number" value={c.startYear} onChange={(e) => updateContract(c.id, { startYear: parseFloat(e.target.value) || 0 })} /></label>
            <label>Term (years) <input data-field="contract-termYears" type="number" value={c.termYears} onChange={(e) => updateContract(c.id, { termYears: parseFloat(e.target.value) || 0 })} /></label>
            <label>Payments per year{" "}
              <select data-field="contract-paymentsPerYear" value={c.paymentsPerYear} onChange={(e) => updateContract(c.id, { paymentsPerYear: parseInt(e.target.value, 10) })}>
                <option value={1}>Annual</option>
                <option value={2}>Semi-annual</option>
                <option value={4}>Quarterly</option>
                <option value={12}>Monthly</option>
              </select>
            </label>
            <label>Grace (years) <input data-field="contract-graceYears" type="number" value={c.graceYears} onChange={(e) => updateContract(c.id, { graceYears: parseFloat(e.target.value) || 0 })} /></label>
            <label>Indexation % per year <input data-field="contract-escalationPerYear" type="number" value={c.escalationPerYear} onChange={(e) => updateContract(c.id, { escalationPerYear: parseFloat(e.target.value) || 0 })} /></label>
            <label>Balloon <MoneyEditor dataField="contract-balloon" value={c.balloon} entryUnit={entryUnit} onChange={(v) => updateContract(c.id, { balloon: v })} /></label>
            {c.mode === "evaluated" && (
              <>
                <label>Payment per period <MoneyEditor dataField="contract-evaluatedPayment" value={c.evaluatedPayment ?? 0} entryUnit={entryUnit} onChange={(v) => updateContract(c.id, { evaluatedPayment: v })} /></label>
                <details data-testid="contract-profile-editor">
                  <summary>Per-year collections profile (optional)</summary>
                  <table data-testid="contract-profile-rows">
                    <thead><tr><th>Year</th><th>Collected sum</th><th></th></tr></thead>
                    <tbody>
                      {Object.entries(c.evaluatedProfile ?? {}).map(([y, amount]) => (
                        <tr key={y} data-profile-year={y}>
                          <td><input data-field="profile-year" value={y} onChange={(e) => {
                            const next = { ...(c.evaluatedProfile ?? {}) };
                            delete next[Number(y)];
                            next[parseFloat(e.target.value) || 0] = amount;
                            updateContract(c.id, { evaluatedProfile: next });
                          }} /></td>
                          <td><MoneyEditor dataField="profile-amount" value={amount} entryUnit={entryUnit} onChange={(v) => {
                            const next = { ...(c.evaluatedProfile ?? {}) };
                            next[Number(y)] = v;
                            updateContract(c.id, { evaluatedProfile: next });
                          }} /></td>
                          <td><button data-action="remove-profile-year" data-year={y} onClick={() => {
                            const next = { ...(c.evaluatedProfile ?? {}) };
                            delete next[Number(y)];
                            updateContract(c.id, { evaluatedProfile: next });
                          }}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button data-action="add-profile-year" onClick={() => {
                    const next = { ...(c.evaluatedProfile ?? {}) };
                    next[3] = next[3] ?? 0;
                    updateContract(c.id, { evaluatedProfile: next });
                  }}>Add year</button>
                </details>
              </>
            )}
            <details data-testid="reinvestments-editor">
              <summary>Reinvestments (adjustments required in connection with this deal; real cash outflows at the end of their year)</summary>
              <table data-testid="reinvestments-rows">
                <thead><tr><th>Year</th><th>Amount</th><th></th></tr></thead>
                <tbody>
                  {(c.reinvestments ?? []).map((ri, idx) => (
                    <tr key={idx} data-reinvestment-year={ri.year}>
                      <td><input data-field="reinvestment-year" type="number" value={ri.year} onChange={(e) => updateReinvestment(c, idx, { year: parseFloat(e.target.value) || 0 })} /></td>
                      <td><MoneyEditor dataField="reinvestment-amount" value={ri.amount} entryUnit={entryUnit} onChange={(v) => updateReinvestment(c, idx, { amount: v })} /></td>
                      <td><button data-action="remove-reinvestment" onClick={() => updateContract(c.id, { reinvestments: (c.reinvestments ?? []).filter((_, j) => j !== idx) })}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button data-action="add-reinvestment" onClick={() => updateContract(c.id, { reinvestments: [...(c.reinvestments ?? []), { year: c.startYear, amount: 0 }] })}>Add reinvestment</button>
            </details>
            <button data-action="remove-contract" onClick={() => setContracts(contracts.filter((x) => x.id !== c.id))}>Remove contract</button>
          </div>
        ))}
        <button data-action="add-contract" onClick={() => {
          const lastEnd = contracts.length > 0 ? contracts[contracts.length - 1].startYear + contracts[contracts.length - 1].termYears : 1;
          setContracts([...contracts, blankContract(nextContractId(contracts), lastEnd)]);
        }}>Add contract</button>
      </div>
      {!explicit && (
        <>
          <p data-testid="legacy-contract-note" className="muted">This project runs one payment stream (the repayment configuration below maps to one solved contract). Add a contract to model multiple deals.</p>
          <label>First collection year (calendar){" "}
            <input data-field="firstCollectionYear" data-year-semantics="calendar" type="number" value={
              inputs.repayment.firstCollectionYear === null || inputs.repayment.firstCollectionYear === undefined
                ? ""
                : (startYear === null ? inputs.repayment.firstCollectionYear : startYear + (inputs.repayment.firstCollectionYear as number) - 1)
            } onChange={(e) => {
              if (e.target.value === "") { setRepayment({ firstCollectionYear: null }); return; }
              const cal = parseFloat(e.target.value) || 0;
              const modelYear = startYear === null ? cal : cal - startYear + 1;
              setRepayment({ firstCollectionYear: modelYear });
            }} />
          </label>
          <p data-testid="first-collection-year-conversion" className="muted">
            {startYear === null
              ? "No project start year is set; the entry is used as the model year directly."
              : `Calendar year entry converts to a model year: start year ${startYear} + entry − 1 = model year ${
                  inputs.repayment.firstCollectionYear === null || inputs.repayment.firstCollectionYear === undefined
                    ? "(not set)"
                    : inputs.repayment.firstCollectionYear
                }.`}
          </p>
          <details data-testid="collections-editor">
            <summary>Per-year collections profile (optional; overrides the solved stream)</summary>
            <table data-testid="collections-rows">
              <thead><tr><th>Year</th><th>Collected sum</th><th></th></tr></thead>
              <tbody>
                {Object.entries(inputs.repayment.collectionsOverrides ?? {}).map(([y, amount]) => (
                  <tr key={y} data-override-year={y} data-calendar-label={yearHeader(Number(y), startYear)}>
                    <td><input data-field="col-override-year" value={y} onChange={(e) => {
                      const next = { ...(inputs.repayment.collectionsOverrides ?? {}) };
                      delete next[Number(y)];
                      next[parseFloat(e.target.value) || 0] = amount;
                      setRepayment({ collectionsOverrides: next });
                    }} /> <span className="muted" data-testid="col-override-calendar-label">{yearHeader(Number(y), startYear)}</span></td>
                    <td><MoneyEditor dataField="col-override-amount" value={amount} entryUnit={entryUnit} onChange={(v) => {
                      const next = { ...(inputs.repayment.collectionsOverrides ?? {}) };
                      next[Number(y)] = v;
                      setRepayment({ collectionsOverrides: next });
                    }} /></td>
                    <td><button data-action="remove-col-override" data-year={y} onClick={() => {
                      const next = { ...(inputs.repayment.collectionsOverrides ?? {}) };
                      delete next[Number(y)];
                      setRepayment({ collectionsOverrides: next });
                    }}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button data-action="add-col-override" onClick={() => {
              const next = { ...(inputs.repayment.collectionsOverrides ?? {}) };
              next[3] = next[3] ?? 0;
              setRepayment({ collectionsOverrides: next });
            }}>Add year</button>
            <div data-testid="collections-spread">
              <label>Spread total <input data-field="col-spread-total" type="number" defaultValue="" /></label>
              <label>First year <input data-field="col-spread-first" type="number" defaultValue={3} /></label>
              <label>Year count <input data-field="col-spread-count" type="number" defaultValue={1} /></label>
              <button data-action="col-spread-fill" onClick={() => {
                const root = document.querySelector('[data-testid="collections-editor"]') as HTMLElement;
                const totalEntry = parseFloat((root.querySelector('[data-field="col-spread-total"]') as HTMLInputElement).value) || 0;
                const firstYear = parseFloat((root.querySelector('[data-field="col-spread-first"]') as HTMLInputElement).value) || 1;
                const yearCount = parseFloat((root.querySelector('[data-field="col-spread-count"]') as HTMLInputElement).value) || 1;
                setRepayment({ collectionsOverrides: spreadFill(entryToValue(totalEntry, entryUnit), firstYear, yearCount) });
              }}>Spread</button>
            </div>
          </details>
          <label>Term (years) <input data-field="termYears" type="number" value={r.termYears} onChange={num("termYears")} /></label>
          <label>Payments per year{" "}
            <select data-field="paymentsPerYear" value={r.paymentsPerYear} onChange={(e) => setRepayment({ paymentsPerYear: parseInt(e.target.value, 10) })}>
              <option value={1}>Annual</option>
              <option value={2}>Semi-annual</option>
              <option value={4}>Quarterly</option>
              <option value={12}>Monthly</option>
            </select>
          </label>
          <label>Grace (years) <input data-field="graceYears" type="number" value={r.graceYears} disabled={inputs.repayment.firstCollectionYear !== null && inputs.repayment.firstCollectionYear !== undefined} onChange={num("graceYears")} /></label>
          <label>Indexation (CPI) % per year (rule of thumb: 2%) <input data-field="paymentEscalation" type="number" value={r.paymentEscalation} onChange={num("paymentEscalation")} /></label>
          <label>Balloon <MoneyEditor dataField="balloon" value={r.balloon} entryUnit={entryUnit} onChange={(v) => setRepayment({ balloon: v })} /></label>
        </>
      )}
      {result !== null && (
        <dl data-testid="repayment-summary">
          <dt>Solved payment</dt><dd data-stat="paymentAmount">{result.paymentAmount === null ? "not applicable (collection mode)" : fee(result.paymentAmount)}</dd>
          <dt>Payment count</dt><dd data-stat="paymentCount">{result.paymentCount}</dd>
          <dt>First payment year</dt><dd data-stat="repaymentStartYear">{result.repaymentStartYear}</dd>
          <dt>Total collected</dt><dd data-stat="totalCollected">{money(result.totalCollected)}</dd>
        </dl>
      )}
    </section>
  );
}
