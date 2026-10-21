export function countSignChanges(flows: number[]): number {
  let changes = 0;
  let prevSign = 0;
  for (const f of flows) {
    if (f === 0) continue;
    const sign = f > 0 ? 1 : -1;
    if (prevSign !== 0 && sign !== prevSign) changes++;
    prevSign = sign;
  }
  return changes;
}

// v0.6.11 Task D: the ambiguity note — composed once by the engine, single-sourced for
// both views; every warning surface renders it verbatim, none composes its own wording.
// The rate clause composes from the headline source; the equity view carries none (it has
// no headline aggregate).
export function composeAmbiguityNote(
  cause: "financing" | "operational",
  view: "main" | "equity",
  signChanges: number,
  headlineSource: "monthly" | "yearly" | "ambiguous" | null
): string {
  const equity = view === "equity";
  const irrPhrase = equity ? "the equity IRR" : "the IRR";
  const rateClause = equity || headlineSource === "monthly"
    ? null
    : headlineSource === "yearly"
      ? "the yearly-aggregate rate is shown"
      : "no unique IRR is shown";
  if (cause === "financing") {
    const subject = equity
      ? "Funding receipts and debt service alternate the equity net flow"
      : "Funding receipts alternate the net flow";
    const mid = rateClause
      ? `${rateClause}; the NPV at WACC and the MIRR are unaffected and remain the reliable criteria.`
      : "the NPV at WACC and the MIRR are unaffected and remain the reliable criteria.";
    return `${subject} (${signChanges} sign changes), so ${irrPhrase} may not be unique - ${mid}`;
  }
  const flowPhrase = equity ? "The equity net flow" : "The net flow";
  return `${flowPhrase} alternates ${signChanges} times beyond the funding pattern - collections below operating costs or one-off cost spikes can do this - so ${irrPhrase} may not be unique${rateClause ? `; ${rateClause}` : ""}. The NPV at WACC and the MIRR remain the reliable criteria, and the operating years at the alternations merit a look.`;
}

export function npvMonthly(rateM: number, flows: number[]): number {
  let acc = 0;
  for (let i = 0; i < flows.length; i++) acc += flows[i] / Math.pow(1 + rateM, i + 1);
  return acc;
}

export function irrAnnual(flows: number[]): number | null {
  let allZero = true;
  for (const f of flows) {
    if (f !== 0) { allZero = false; break; }
  }
  if (allZero) return null;
  const loBound = -0.9, hiBound = 6.0;
  const steps = 96;
  const width = (hiBound - loBound) / steps;
  let lo = loBound, hi = 0;
  let fLo = npvMonthly(loBound, flows);
  let bracket: [number, number] | null = null;
  let prevRate = loBound, prevVal = fLo;
  for (let i = 1; i <= steps; i++) {
    const r = loBound + i * width;
    const v = npvMonthly(r, flows);
    if (prevVal === 0) { bracket = [prevRate, prevRate]; break; }
    if (prevVal * v < 0) { bracket = [prevRate, r]; break; }
    prevRate = r; prevVal = v;
  }
  if (bracket === null) return null;
  lo = bracket[0]; hi = bracket[1];
  fLo = npvMonthly(lo, flows);
  let rM = lo;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvMonthly(mid, flows);
    rM = mid;
    if (Math.abs(fMid) < 1e-9) break;
    if (fLo * fMid < 0) { hi = mid; } else { lo = mid; fLo = fMid; }
  }
  return Math.pow(1 + rM, 12) - 1;
}

export function npvYearly(rateA: number, flows: number[]): number {
  let acc = 0;
  for (let i = 0; i < flows.length; i++) acc += flows[i] / Math.pow(1 + rateA, i + 1);
  return acc;
}

export function irrYearly(flows: number[]): number | null {
  let allZero = true;
  for (const f of flows) {
    if (f !== 0) { allZero = false; break; }
  }
  if (allZero) return null;
  const loBound = -0.9, hiBound = 6.0;
  const steps = 96;
  const width = (hiBound - loBound) / steps;
  let fLo = npvYearly(loBound, flows);
  let bracket: [number, number] | null = null;
  let prevRate = loBound, prevVal = fLo;
  for (let i = 1; i <= steps; i++) {
    const r = loBound + i * width;
    const v = npvYearly(r, flows);
    if (prevVal === 0) { bracket = [prevRate, prevRate]; break; }
    if (prevVal * v < 0) { bracket = [prevRate, r]; break; }
    prevRate = r; prevVal = v;
  }
  if (bracket === null) return null;
  let lo = bracket[0], hi = bracket[1];
  fLo = npvYearly(lo, flows);
  let rA = lo;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvYearly(mid, flows);
    rA = mid;
    if (Math.abs(fMid) < 1e-9) break;
    if (fLo * fMid < 0) { hi = mid; } else { lo = mid; fLo = fMid; }
  }
  return rA;
}

export type { PaymentSlot };

export function computeModel(inp: ModelInputsLike, opts?: { fixedPayment?: number }): import("./types.js").ModelResult {
  const issues = validateInputs(inp);
  const finCfgIn = inp.financing && inp.financing.enabled ? inp.financing : null;
  if (finCfgIn) {
    // v0.6.12.1 (AUD-2): the last cost year honors the per-year profiles (lastCostYearOf).
    const derivedStart = lastCostYearOf(inp);
    const preliminaryHorizon = Math.max(
      Math.ceil(derivedStart * 12),
      (inp.repayment.firstCollectionYear ?? derivedStart + inp.repayment.graceYears) * 12 + Math.round(Math.max(0, inp.repayment.termYears) * 12)
    );
    validateFinancing({ financing: inp.financing, horizon: preliminaryHorizon, lastCostMonth: derivedStart * 12 }, issues);
    if (finCfgIn.leveragedSolve) {
      const t = inp.tariff;
      if (t && (t.mode === "manual" || t.mode === "fixed")) {
        issues.push("The leveraged solve does not apply to manual or fixed tariff modes (FIN-LEVERAGED-MODE).");
      }
    }
  }
  if (issues.length > 0) throw new EngineInputError(issues);
  const appraisal = inp.appraisal ?? { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } };
  const residualPosturePre = appraisal.residual.posture
    ?? ((appraisal.residual.mode ?? "amount") === "amount" && appraisal.residual.amount > 0 ? "set-price"
      : appraisal.residual.mode === "calculated" ? "book-value"
      : "none");
  const residualAmount = residualPosturePre === "none" ? 0 : appraisal.residual.amount;
  const residualYear = appraisal.residual.year;
  const target = inp.targetIrr;
  const rM = Math.pow(1 + target / 100, 1 / 12) - 1;
  const costs = inp.costs;
  const collectionsProfile = inp.repayment.collectionsOverrides && Object.keys(inp.repayment.collectionsOverrides).length > 0 ? inp.repayment.collectionsOverrides : null;
  const profileMode = collectionsProfile !== null;
  const profileYears = collectionsProfile ? Object.keys(collectionsProfile).map(Number).sort((a, b) => a - b) : [];
  const profileEndMonth = profileYears.length > 0 ? profileYears[profileYears.length - 1] * 12 : 0;
  const profileFirstMonth = profileYears.length > 0 ? (profileYears[0] - 1) * 12 + 1 : 0;
  let lastCostYear = 0;
  costs.forEach((c) => {
    const overrides = c.yearOverrides && Object.keys(c.yearOverrides).length > 0 ? c.yearOverrides : null;
    let end: number;
    if (c.category === "capex") {
      end = overrides ? Math.max(...Object.keys(overrides).map(Number)) : c.startYear;
    } else {
      end = c.startYear + Math.max(1, c.durationYears) - 1;
    }
    lastCostYear = Math.max(lastCostYear, end);
  });
  if (lastCostYear === 0) lastCostYear = 1;
  const explicitContracts = inp.contracts !== undefined && inp.contracts.length > 0;
  const contracts = normalizeContracts(inp, lastCostYear);
  const contractsMode = explicitContracts;
  const reinvestmentsAll = contractsMode ? allReinvestments(contracts) : [];
  const overrideYear = inp.repayment.firstCollectionYear ?? null;
  const repaymentStartYear = overrideYear !== null ? overrideYear : lastCostYear + inp.repayment.graceYears;
  const termMonths = Math.round(Math.max(0, inp.repayment.termYears) * 12);
  let totalMonths = profileMode
    ? Math.max(Math.ceil(lastCostYear * 12), profileEndMonth)
    : Math.max(Math.ceil(lastCostYear * 12), repaymentStartYear * 12 + termMonths);
  if (residualAmount > 0) totalMonths = Math.max(totalMonths, residualYear * 12);
  const tariffCfg0 = inp.tariff ?? { mode: "off" as const, escalationPerYear: 2, rows: [], fixedAnnualAmount: null, manualPrices: null };
  // v0.6.10 Task C (W35): the tariff owns its span — with a declared span the year columns run
  // span.startYear through span.startYear + span.termYears (termYears + 1 columns, the repayment
  // convention). Without a span the derivation is unchanged (repaymentStartYear, term + 1) —
  // the no-drift pin.
  const tariffSpanCfg = tariffCfg0.span ?? null;
  const gridFirstYear = tariffSpanCfg ? tariffSpanCfg.startYear : repaymentStartYear;
  const gridTermYears = tariffSpanCfg ? tariffSpanCfg.termYears : inp.repayment.termYears;
  const gridYears: number[] = [];
  for (let k = 0; k < gridTermYears + 1; k++) gridYears.push(gridFirstYear + k);
  // v0.6.10 Task C.2: a row is active in the years its span covers (startYear through
  // startYear + termYears - 1); a row with no span inherits the full grid. Volumes typed at a
  // grid column outside the row's span gate to zero in that year's weighted volume.
  const rowActiveInYear = (row: import("./types.js").TariffRow, year: number): boolean =>
    !row.span || (year >= row.span.startYear && year <= row.span.startYear + row.span.termYears - 1);
  const weightedVolumes: number[] = gridYears.map((year, k) =>
    tariffCfg0.rows.reduce((acc, row) => acc + (rowActiveInYear(row, year) ? row.weight * (row.lifts[k] ?? 0) : 0), 0)
  );
  const tariffCollectionMode0 = tariffCfg0.mode === "stable" || tariffCfg0.mode === "manual" || tariffCfg0.mode === "fixed";
  const lastTariffMonth = tariffCfg0.mode !== "off" ? gridYears[gridYears.length - 1] * 12 : -1;
  if (lastTariffMonth > totalMonths) totalMonths = lastTariffMonth;
  const horizonConstituents: import("./types.js").HorizonConstituent[] = [];
  horizonConstituents.push({ label: "cost program", month: Math.ceil(lastCostYear * 12) });
  if (profileMode) {
    horizonConstituents.push({ label: "collections profile", month: profileEndMonth });
  } else if (!tariffCollectionMode0) {
    horizonConstituents.push({ label: "repayment schedule", month: repaymentStartYear * 12 + termMonths });
  }
  if (lastTariffMonth > 0) horizonConstituents.push({ label: "tariff grid", month: lastTariffMonth });
  if (contractsMode) {
    for (const c of contracts) {
      horizonConstituents.push({ label: `contract ${c.label} collections`, month: contractLastCollectionMonth(c) });
      for (const ri of c.reinvestments) horizonConstituents.push({ label: `reinvestment (${c.label})`, month: ri.year * 12 });
    }
  }
  if (residualAmount > 0) horizonConstituents.push({ label: "residual", month: residualYear * 12 });
  const finCfg0 = inp.financing && inp.financing.enabled ? inp.financing : null;
  if (finCfg0) {
    horizonConstituents.push({ label: "financing service", month: (finCfg0.serviceStartYear ?? repaymentStartYear) * 12 + finCfg0.termYears * 12 });
  }
  if (inp.projectLengthYears !== undefined && inp.projectLengthYears !== null) {
    horizonConstituents.push({ label: "project length", month: inp.projectLengthYears * 12 });
  }
  for (const hc of horizonConstituents) {
    if (hc.month > totalMonths) totalMonths = hc.month;
  }
  const residualPosture = appraisal.residual.posture
    ?? ((appraisal.residual.mode ?? "amount") === "amount" && appraisal.residual.amount > 0 ? "set-price"
      : appraisal.residual.mode === "calculated" ? "book-value"
      : "none");
  const residualMode = residualPosture === "book-value" ? "calculated" : "amount";
  const residualSetAmount = residualPosture === "none" ? 0 : appraisal.residual.amount;
  const lineTotalsMap = new Map<string, number>();
  for (const c of inp.costs) {
    const overrides = c.yearOverrides && Object.keys(c.yearOverrides).length > 0 ? c.yearOverrides : null;
    let total = 0;
    if (overrides) {
      if (c.category === "capex") {
        for (const amount of Object.values(overrides)) total += amount;
      } else {
        const dur = Math.max(1, c.durationYears);
        for (let j = 0; j < dur; j++) {
          const y = c.startYear + j;
          const overridden = Object.prototype.hasOwnProperty.call(overrides, String(y));
          total += overridden ? (overrides as Record<number, number>)[y] : c.amount * Math.pow(1 + c.escalation / 100, j);
        }
      }
    } else if (c.category === "capex") {
      total = c.amount;
    } else {
      const dur = Math.max(1, c.durationYears);
      for (let j = 0; j < dur; j++) total += c.amount * Math.pow(1 + c.escalation / 100, j);
    }
    lineTotalsMap.set(c.id, total);
  }
  // v0.6.10 Task A/B: the funding block. Absent rows leave every downstream figure
  // byte-identical (the golden no-drift pin). The allocation runs before the book schedule so
  // both computeBookSchedule call sites receive the netting map.
  const fundingRows = inp.funding?.rows ?? [];
  const fundingPresent = fundingRows.length > 0;
  const fundingAllocation: import("./types.js").FundingAllocation[] = [];
  const nettingByLine: Map<string, Map<number, number>> | undefined = fundingPresent ? new Map() : undefined;
  let grantsTotal = 0;
  for (const fr of fundingRows) {
    if (fr.kind !== "grant") continue;
    grantsTotal += fr.amount;
    // Task B: each grant allocates proportionally to the capitalized-to-date cost of the
    // depreciating lines at its receipt year — lines whose effective depreciation config is
    // not "retained"; operating lines and reinvestments never share (they are not cost lines);
    // a line with zero capitalized-to-date at the receipt year gets no share.
    const eligible: { lineId: string; lineName: string; capitalizedToDate: number }[] = [];
    let baseTotal = 0;
    for (const c of inp.costs) {
      const cfg = c.depreciation ?? inp.depreciationDefault ?? null;
      if (!cfg || cfg.mode === "retained") continue;
      let cap = 0;
      for (const [y, amt] of lineIncurred(c)) {
        if (y <= fr.year) cap += amt;
      }
      if (cap <= 0) continue;
      eligible.push({ lineId: c.id, lineName: c.name, capitalizedToDate: cap });
      baseTotal += cap;
    }
    const shares: import("./types.js").FundingShare[] = eligible.map((e) => {
      const shareOfGrant = baseTotal > 0 ? e.capitalizedToDate / baseTotal : 0;
      // The pinned spelling: amount * capitalized-to-date / base, multiplication first.
      const nettedAmount = baseTotal > 0 ? (fr.amount * e.capitalizedToDate) / baseTotal : 0;
      const perLine = nettingByLine?.get(e.lineId) ?? new Map<number, number>();
      perLine.set(fr.year, nettedAmount);
      nettingByLine?.set(e.lineId, perLine);
      return { lineId: e.lineId, lineName: e.lineName, capitalizedToDate: e.capitalizedToDate, shareOfGrant, nettedAmount };
    });
    fundingAllocation.push({ grantId: fr.id, label: fr.label, year: fr.year, amount: fr.amount, shares });
  }
  if (residualMode === "calculated" && residualYear * 12 > totalMonths) {
    const provisional = computeBookSchedule(
      inp.costs,
      contracts.flatMap((c) => c.reinvestments.map((ri) => ({ contractId: c.id, ri }))),
      inp.depreciationDefault ?? null,
      residualYear,
      lineTotalsMap,
      nettingByLine,
    );
    if (provisional.remainingBookValueAt(residualYear) > 0) {
      horizonConstituents.push({ label: "book-value residual horizon extension", month: residualYear * 12 });
    }
  }
  for (const hc of horizonConstituents) {
    if (hc.month > totalMonths) totalMonths = hc.month;
  }
  // v0.6.10 Task A.1: the funding horizon refusals — they live here where the horizon is final.
  if (fundingPresent) {
    for (const fr of fundingRows) {
      if (fr.year * 12 > totalMonths) {
        throw new EngineInputError([`Funding row ${fr.id} lands in year ${fr.year}, beyond the model horizon of ${totalMonths} months (FND-HORIZON).`]);
      }
      if (fr.kind === "interest-free-loan") {
        const loanTerm = fr.termYears ?? 1;
        const loanStart = fr.repaymentStartYear ?? 1;
        if ((loanStart + loanTerm - 1) * 12 > totalMonths) {
          throw new EngineInputError([`Funding row ${fr.id} repays beyond the model horizon of ${totalMonths} months (FND-LOAN-HORIZON).`]);
        }
      }
    }
  }
  const horizonYears = Math.ceil(totalMonths / 12);
  const bookSchedule = computeBookSchedule(
    inp.costs,
    contracts.flatMap((c) => c.reinvestments.map((ri) => ({ contractId: c.id, ri }))),
    inp.depreciationDefault ?? null,
    horizonYears,
    lineTotalsMap,
    nettingByLine,
  );
  let residualAmountUsed = residualSetAmount;
  if (residualMode === "calculated") {
    residualAmountUsed = bookSchedule.remainingBookValueAt(Math.min(residualYear, horizonYears));
  }
  const costM = new Array<number>(totalMonths).fill(0);
  costs.forEach((c) => {
    const overrides = c.yearOverrides && Object.keys(c.yearOverrides).length > 0 ? c.yearOverrides : null;
    if (c.category === "capex") {
      if (overrides) {
        for (const [yStr, amount] of Object.entries(overrides)) {
          const y = Number(yStr);
          const m = Math.min(totalMonths, y * 12);
          if (m >= 1) costM[m - 1] += amount;
        }
      } else {
        const m = Math.min(totalMonths, c.startYear * 12);
        if (m >= 1) costM[m - 1] += c.amount;
      }
    } else {
      const dur = Math.max(1, c.durationYears);
      for (let y = c.startYear; y < c.startYear + dur; y++) {
        const overridden = overrides && Object.prototype.hasOwnProperty.call(overrides, String(y));
        const annual = overridden ? (overrides as Record<number, number>)[y] : c.amount * Math.pow(1 + c.escalation / 100, y - c.startYear);
        const monthly = annual / 12;
        for (let mm = (y - 1) * 12 + 1; mm <= y * 12 && mm <= totalMonths; mm++) costM[mm - 1] += monthly;
      }
    }
  });
  for (const ri of reinvestmentsAll) {
    const m = Math.min(totalMonths, ri.year * 12);
    if (m >= 1) costM[m - 1] += ri.amount;
  }
  let costNpv = 0;
  for (let i = 0; i < totalMonths; i++) costNpv += costM[i] / Math.pow(1 + rM, i + 1);
  const ppy = [1, 2, 4, 12].indexOf(inp.repayment.paymentsPerYear) >= 0 ? inp.repayment.paymentsPerYear : 1;
  const spacing = 12 / ppy;
  const paymentCount = Math.max(0, Math.round((termMonths / 12) * ppy));
  const slots: PaymentSlot[] = [];
  for (let k = 0; k < paymentCount; k++) {
    const monthIndex = repaymentStartYear * 12 + k * spacing;
    if (monthIndex > totalMonths) break;
    const yearsIn = Math.floor(k / ppy);
    slots.push({ monthIndex: monthIndex, escFactor: Math.pow(1 + inp.repayment.paymentEscalation / 100, yearsIn) });
  }
  const balloonMonth = repaymentStartYear * 12 + termMonths;
  const df = (m: number) => 1 / Math.pow(1 + rM, m);
  // v0.6.10 Task A.2: the grant-netted basis. fundingNpv is the present value at the target
  // monthly rate of the funding rows — each receipt discounted at its year-end month; an
  // interest-free loan additionally contributes its repayments (equal annual installments)
  // as negative present value (its subsidy element). It is subtracted from every solve
  // numerator; the identity npvAtTarget = 0 at the target rate holds on the full stream.
  let fundingNpv = 0;
  if (fundingPresent) {
    for (const fr of fundingRows) {
      fundingNpv += fr.amount * df(fr.year * 12);
      if (fr.kind === "interest-free-loan") {
        const loanTerm = fr.termYears ?? 1;
        const loanStart = fr.repaymentStartYear ?? 1;
        const installment = fr.amount / loanTerm;
        for (let k = 0; k < loanTerm; k++) {
          fundingNpv -= installment * df((loanStart + k) * 12);
        }
      }
    }
  }
  const balloonMonthProfile = profileEndMonth;
  const balloonDf = (profileMode ? balloonMonthProfile : balloonMonth) <= totalMonths ? df(profileMode ? balloonMonthProfile : balloonMonth) : 0;
  if (!profileMode && inp.repayment.balloon > 0 && inp.repayment.balloon * balloonDf >= costNpv) {
    throw new EngineInputError(["The balloon's discounted value at the target rate reaches the cost NPV; the solved payment would be non-positive."]);
  }
  const residualMonth = residualYear * 12;
  const residualDf = residualAmountUsed > 0 && residualMonth <= totalMonths ? df(residualMonth) : 0;
  const firstCollectionMonth = repaymentStartYear * 12;
  const lastPaymentMonth = slots.length > 0 ? slots[slots.length - 1].monthIndex : firstCollectionMonth;
  const lastInflowMonth = tariffCollectionMode0
    ? Math.max(lastTariffMonth, residualAmountUsed > 0 ? residualMonth : 0)
    : Math.max(lastPaymentMonth, residualAmountUsed > 0 ? residualMonth : 0);
  const finCfg = finCfgIn;
  if (finCfg) {
    const S = (finCfg.serviceStartYear ?? repaymentStartYear) * 12;
    if (S >= totalMonths) {
      throw new EngineInputError([`Financing serviceStartYear ${finCfg.serviceStartYear ?? repaymentStartYear} times 12 must be below the model horizon ${totalMonths}.`]);
    }
    let fundableAfterStart = false;
    inp.costs.forEach((c) => {
      if (c.category !== "recurring" && c.category !== "capex") return;
      const share = (finCfg.perLineSharePct?.[c.id] ?? finCfg.sharePct) / 100;
      if (share <= 0) return;
      // v0.6.12.1 (AUD-2): the line's last incurred year (the profile years when profiled; the
      // start year for a plain CAPEX lump; start + duration - 1 for a plain recurring line).
      let lastYear = 0;
      for (const [y] of lineIncurred(c)) lastYear = Math.max(lastYear, y);
      if (lastYear * 12 > S) fundableAfterStart = true;
    });
    if (fundableAfterStart) {
      throw new EngineInputError([`A debt-funded fundable cost lands strictly after the service start month ${S} (FIN-FUNDABLE-AFTER-START).`]);
    }
  }
  const operatingLinesIn = inp.operatingLines ?? [];
  const maintenanceCfg = inp.maintenance ?? { mode: "off" };
  const tariffCfg = tariffCfg0;
  const tariffCollectionMode = tariffCollectionMode0;
  const capexTotal = capexIncurredTotal(inp.costs);
  // v0.6.12.2 (AUD-4): the operating and maintenance window is the full actual collection span
  // of the solved model, both ends. The profile and contracts modes read their own span; the
  // dormant repayment block governs only the plain and tariff paths.
  let windowFirstMonth = firstCollectionMonth;
  let windowLastMonth = lastInflowMonth;
  if (profileMode) {
    windowFirstMonth = profileFirstMonth;
    windowLastMonth = Math.max(profileEndMonth, residualAmountUsed > 0 ? residualMonth : 0);
  } else if (contractsMode) {
    windowFirstMonth = Math.min(...contracts.map(contractFirstCollectionMonth));
    windowLastMonth = Math.max(Math.max(...contracts.map(contractLastCollectionMonth)), residualAmountUsed > 0 ? residualMonth : 0);
  }
  const operatingInfos: import("./types.js").OperatingLineInfo[] = [];
  let operatingNpv = 0;
  const addOperating = (line: { id: string; label: string; amount: number; startYear: number; yearCount: number; escalation: number }, basis?: number) => {
    const nominalFirst = line.startYear * 12 - 11;
    const nominalLast = (line.startYear + line.yearCount - 1) * 12;
    const effFirst = Math.max(nominalFirst, windowFirstMonth);
    const effLast = Math.min(nominalLast, windowLastMonth);
    if (effFirst > effLast) {
      throw new EngineInputError([
        `Operating line ${line.id} (${line.label}) falls entirely outside the collection window [${windowFirstMonth}, ${windowLastMonth}].`,
      ]);
    }
    let total = 0;
    for (let m = effFirst; m <= effLast; m++) {
      const yearOf = Math.floor((m - 1) / 12) + 1;
      const yearIdx = yearOf - line.startYear;
      const monthly = (line.amount * Math.pow(1 + line.escalation / 100, yearIdx)) / 12;
      costM[m - 1] += monthly;
      total += monthly;
      operatingNpv += monthly / Math.pow(1 + rM, m);
    }
    operatingInfos.push(basis === undefined
      ? { id: line.id, label: line.label, nominalSpan: [nominalFirst, nominalLast], effectiveWindow: [effFirst, effLast], total: total }
      : { id: line.id, label: line.label, nominalSpan: [nominalFirst, nominalLast], effectiveWindow: [effFirst, effLast], total: total, basis });
  };
  for (const line of operatingLinesIn) addOperating(line);
  if (maintenanceCfg.mode !== "off") {
    const annual = maintenanceCfg.mode === "percent"
      ? ((maintenanceCfg.percentPerYear ?? 0) / 100) * capexTotal
      : (maintenanceCfg.fixedAnnualAmount ?? 0);
    addOperating({ id: "maintenance", label: "Maintenance (derived)", amount: annual, startYear: Math.floor((windowFirstMonth - 1) / 12) + 1, yearCount: Math.ceil(totalMonths / 12), escalation: 0 }, capexTotal);
  }
  const operatingTotal = operatingInfos.reduce((acc, o) => acc + o.total, 0);
  const costNpvWithOperating = costNpv + operatingNpv;

  let dfSumEsc = 0;
  slots.forEach((s) => { dfSumEsc += s.escFactor * df(s.monthIndex); });
  let solvedContractsDfSum = dfSumEsc;
  let evaluatedInflowsPv = 0;
  let solvedBalloonsPv = inp.repayment.balloon * balloonDf;
  if (contractsMode) {
    solvedContractsDfSum = 0;
    solvedBalloonsPv = 0;
    evaluatedInflowsPv = 0;
    for (const c of contracts) {
      const cDf = (m: number) => (m <= totalMonths ? df(m) : 0);
      if (c.balloon > 0) solvedBalloonsPv += c.balloon * cDf(c.endMonth);
      if (c.mode === "solved") {
        for (const sl of c.slots) {
          if (sl.monthIndex <= totalMonths) solvedContractsDfSum += sl.escFactor * cDf(sl.monthIndex);
        }
      } else {
        if (c.evaluatedProfile !== null) {
          for (const [yStr, amt] of Object.entries(c.evaluatedProfile)) {
            const y = Number(yStr);
            for (let m = (y - 1) * 12 + 1; m <= y * 12; m++) {
              evaluatedInflowsPv += ((amt as number) / 12) * cDf(m);
            }
          }
        } else if (c.evaluatedPayment !== null && c.evaluatedPayment > 0) {
          for (const sl of c.slots) {
            if (sl.monthIndex <= totalMonths) evaluatedInflowsPv += (c.evaluatedPayment as number) * sl.escFactor * cDf(sl.monthIndex);
          }
        }
      }
    }
  }
  const leveraged = finCfg !== null && finCfg.leveragedSolve;
  let leveragedPayment: number | null = null;
  if (leveraged && !tariffCollectionMode) {
    let pvDraws = 0;
    const rD = Math.pow(1 + finCfg.debtRatePct / 100, 1 / 12) - 1;
    let bal = 0;
    const S = (finCfg.serviceStartYear ?? repaymentStartYear) * 12;
    // v0.6.12.1 (AUD-2): the draws derive from the profile-honoring incurred basis (fundableDraws).
    const drawAt = fundableDraws(inp.costs, finCfg, totalMonths);
    for (let m = 1; m <= S; m++) bal = (bal + drawAt[m - 1]) * (1 + rD);
    for (let m = 1; m <= S; m++) pvDraws += drawAt[m - 1] / Math.pow(1 + rM, m);
    const N = finCfg.termYears * 12;
    const G = finCfg.graceYears * 12;
    const amortMonths = N - G;
    const annA = rD === 0 ? bal / amortMonths : (bal * rD) / (1 - Math.pow(1 + rD, -amortMonths));
    const prinA = finCfg.amortization === "equal-principal" ? bal / amortMonths : null;
    let pvService = 0;
    let running = bal;
    for (let m = S + 1; m <= S + N; m++) {
      const int = running * rD;
      let pay = 0;
      let prin = 0;
      if (m <= S + G) {
        pay = int;
      } else {
        prin = finCfg.amortization === "annuity" ? annA - int : (prinA as number);
        pay = prin + int;
      }
      pvService += pay / Math.pow(1 + rM, m);
      running -= prin;
    }
    leveragedPayment = (costNpvWithOperating - pvDraws + pvService - inp.repayment.balloon * balloonDf - residualAmountUsed * residualDf - fundingNpv) / dfSumEsc;
  }
  const rawSolvedPayment = leveraged && leveragedPayment !== null
    ? leveragedPayment
    : (opts && opts.fixedPayment !== undefined
      ? opts.fixedPayment
      : (contractsMode
        ? (solvedContractsDfSum > 0 ? (costNpvWithOperating - solvedBalloonsPv - residualAmountUsed * residualDf - evaluatedInflowsPv - fundingNpv) / solvedContractsDfSum : 0)
        : (dfSumEsc > 0 ? (costNpvWithOperating - inp.repayment.balloon * balloonDf - residualAmountUsed * residualDf - fundingNpv) / dfSumEsc : 0)));
  const clampActive = !(tariffCollectionMode || profileMode) && rawSolvedPayment < 0;
  const solvedPayment = clampActive ? 0 : rawSolvedPayment;
  const payment = tariffCollectionMode || profileMode ? 0 : solvedPayment;
  const tariffEsc = tariffCfg.escalationPerYear / 100;
  const tariffInfos: import("./types.js").TariffYearInfo[] = [];
  let tariffBaseUnitPrice: number | null = null;
  if (tariffCfg.mode !== "off") {
    if (tariffCfg.mode === "decompose") {
      // v0.6.10 Task C.3 / v0.6.11 Task C: the coverage refusal — every year carrying required
      // collections must be a grid year; the tariff owns its span, it never borrows the
      // repayment shape. The v0.6.11 sentence names the declared bounds and prescribes the
      // check: the diagnosis, the cause, and the check in one sentence.
      const gridFirst = gridYears[0];
      const gridLast = gridYears[gridYears.length - 1];
      const gridYearSet = new Set(gridYears);
      for (const sl of slots) {
        const slotYear = Math.floor((sl.monthIndex - 1) / 12) + 1;
        if (payment * sl.escFactor > 0 && !gridYearSet.has(slotYear)) {
          throw new EngineInputError([`The required collections extend to year ${slotYear}, beyond the declared tariff span (years ${gridFirst}-${gridLast}): widen the tariff span or shorten the term.`]);
        }
      }
      for (let k = 0; k < gridYears.length; k++) {
        const year = gridYears[k];
        let required = 0;
        for (const sl of slots) {
          const slotYear = Math.floor((sl.monthIndex - 1) / 12) + 1;
          if (slotYear === year) required += payment * sl.escFactor;
        }
        if (weightedVolumes[k] <= 0 && required > 0) {
          throw new EngineInputError([`Grid year ${year} has zero weighted volume against a positive required collection.`]);
        }
        const unitPrice = weightedVolumes[k] > 0 ? required / weightedVolumes[k] : null;
        const perRowCharges: Record<string, number> | null = {};
        for (const row of tariffCfg.rows) {
          // v0.6.10 Task C.2: a row outside its span in this year carries no volume and no charge.
          (perRowCharges as Record<string, number>)[row.id] = rowActiveInYear(row, year) ? row.weight * (unitPrice as number) : 0;
        }
        tariffInfos.push({ year, required, weightedVolume: weightedVolumes[k], unitPrice, revenue: required, perRowCharges });
      }
    } else {
      let revenues: number[] = [];
      if (tariffCfg.mode === "stable") {
        let volumeNpvWeight = 0;
        for (let k = 0; k < gridYears.length; k++) {
          const year = gridYears[k];
          const eligible: number[] = [];
          for (let m = (year - 1) * 12 + 1; m <= year * 12; m++) {
            if (m >= firstCollectionMonth) eligible.push(m);
          }
          for (const m of eligible) {
            volumeNpvWeight += weightedVolumes[k] * Math.pow(1 + tariffEsc, k) / Math.pow(1 + rM, m) / eligible.length;
          }
        }
        if (volumeNpvWeight <= 0) {
          throw new EngineInputError(["Stable tariff infeasible: all weighted volumes are zero, so no base unit price can recover the cost NPV."]);
        }
        let netRequirement = costNpvWithOperating - inp.repayment.balloon * balloonDf - residualAmountUsed * residualDf - fundingNpv;
        if (leveraged) {
          let pvDraws = 0;
          const rD = Math.pow(1 + finCfg.debtRatePct / 100, 1 / 12) - 1;
          let bal = 0;
          const S = (finCfg.serviceStartYear ?? repaymentStartYear) * 12;
          // v0.6.12.1 (AUD-2): the draws derive from the profile-honoring incurred basis.
          const drawAt = fundableDraws(inp.costs, finCfg, totalMonths);
          for (let m = 1; m <= S; m++) bal = (bal + drawAt[m - 1]) * (1 + rD);
          for (let m = 1; m <= S; m++) pvDraws += drawAt[m - 1] / Math.pow(1 + rM, m);
          const N = finCfg.termYears * 12;
          const G = finCfg.graceYears * 12;
          const amortMonths = N - G;
          const annA = rD === 0 ? bal / amortMonths : (bal * rD) / (1 - Math.pow(1 + rD, -amortMonths));
          const prinA = finCfg.amortization === "equal-principal" ? bal / amortMonths : null;
          let pvService = 0;
          let running = bal;
          for (let m = S + 1; m <= S + N; m++) {
            const int = running * rD;
            let pay = 0;
            let prin = 0;
            if (m <= S + G) {
              pay = int;
            } else {
              prin = finCfg.amortization === "annuity" ? annA - int : (prinA as number);
              pay = prin + int;
            }
            pvService += pay / Math.pow(1 + rM, m);
            running -= prin;
          }
          netRequirement = netRequirement - pvDraws + pvService;
        }
        const base = netRequirement / volumeNpvWeight;
        tariffBaseUnitPrice = base;
        revenues = gridYears.map((_, k) => (base * Math.pow(1 + tariffEsc, k)) * weightedVolumes[k]);
      } else if (tariffCfg.mode === "manual") {
        revenues = gridYears.map((_, k) => (tariffCfg.manualPrices?.[k] ?? 0) * weightedVolumes[k]);
      } else {
        revenues = gridYears.map(() => tariffCfg.fixedAnnualAmount ?? 0);
      }
      for (let k = 0; k < gridYears.length; k++) {
        const year = gridYears[k];
        const unitPrice = tariffCfg.mode === "manual" ? (tariffCfg.manualPrices?.[k] ?? null) : (tariffCfg.mode === "stable" ? (tariffBaseUnitPrice as number) * Math.pow(1 + tariffEsc, k) : null);
        const perRowCharges: Record<string, number> | null = {};
        for (const row of tariffCfg.rows) {
          // v0.6.10 Task C.2: a row outside its span in this year carries no volume and no charge.
          (perRowCharges as Record<string, number>)[row.id] = rowActiveInYear(row, year) ? row.weight * (unitPrice as number) : 0;
        }
        tariffInfos.push({ year, required: null, weightedVolume: weightedVolumes[k], unitPrice, revenue: revenues[k], perRowCharges });
      }
    }
  }

  const inflowByMonth: Record<number, number> = {};
  if (profileMode) {
    for (const y of profileYears) {
      const amount = (collectionsProfile as Record<number, number>)[y];
      const monthly = amount / 12;
      for (let m = (y - 1) * 12 + 1; m <= y * 12; m++) {
        inflowByMonth[m] = (inflowByMonth[m] || 0) + monthly;
      }
    }
  } else if (!tariffCollectionMode && contractsMode) {
    for (const c of contracts) {
      if (c.mode === "solved") {
        for (const sl of c.slots) {
          if (sl.monthIndex <= totalMonths) inflowByMonth[sl.monthIndex] = (inflowByMonth[sl.monthIndex] || 0) + payment * sl.escFactor;
        }
      } else if (c.evaluatedProfile !== null) {
        for (const [yStr, amt] of Object.entries(c.evaluatedProfile)) {
          const y = Number(yStr);
          const monthly = (amt as number) / 12;
          for (let m = (y - 1) * 12 + 1; m <= y * 12 && m <= totalMonths; m++) {
            inflowByMonth[m] = (inflowByMonth[m] || 0) + monthly;
          }
        }
      } else if (c.evaluatedPayment !== null) {
        for (const sl of c.slots) {
          if (sl.monthIndex <= totalMonths) inflowByMonth[sl.monthIndex] = (inflowByMonth[sl.monthIndex] || 0) + (c.evaluatedPayment as number) * sl.escFactor;
        }
      }
      if (c.balloon > 0 && c.endMonth <= totalMonths) {
        inflowByMonth[c.endMonth] = (inflowByMonth[c.endMonth] || 0) + c.balloon;
      }
    }
  } else if (!tariffCollectionMode) {
    slots.forEach((s) => {
      inflowByMonth[s.monthIndex] = (inflowByMonth[s.monthIndex] || 0) + payment * s.escFactor;
    });
  } else {
    for (let k = 0; k < gridYears.length; k++) {
      const year = gridYears[k];
      const eligible: number[] = [];
      for (let m = (year - 1) * 12 + 1; m <= year * 12; m++) {
        if (m >= firstCollectionMonth) eligible.push(m);
      }
      const monthly = tariffInfos[k].revenue / eligible.length;
      for (const m of eligible) {
        inflowByMonth[m] = (inflowByMonth[m] || 0) + monthly;
      }
    }
  }
  const balloonLandingMonth = profileMode ? profileEndMonth : balloonMonth;
  if (!contractsMode && inp.repayment.balloon > 0 && balloonLandingMonth <= totalMonths) {
    inflowByMonth[balloonLandingMonth] = (inflowByMonth[balloonLandingMonth] || 0) + inp.repayment.balloon;
  }
  if (residualAmountUsed > 0 && residualMonth <= totalMonths) {
    inflowByMonth[residualMonth] = (inflowByMonth[residualMonth] || 0) + residualAmountUsed;
  }
  // v0.6.10 Task A.3: the funding cash rides in every mode — each receipt enters at its
  // year-end month; each interest-free loan's installments enter as negative inflows at
  // their months (the loan nets to zero over the horizon by construction).
  if (fundingPresent) {
    for (const fr of fundingRows) {
      const receiptMonth = fr.year * 12;
      inflowByMonth[receiptMonth] = (inflowByMonth[receiptMonth] || 0) + fr.amount;
      if (fr.kind === "interest-free-loan") {
        const loanTerm = fr.termYears ?? 1;
        const loanStart = fr.repaymentStartYear ?? 1;
        const installment = fr.amount / loanTerm;
        for (let k = 0; k < loanTerm; k++) {
          const im = (loanStart + k) * 12;
          inflowByMonth[im] = (inflowByMonth[im] || 0) - installment;
        }
      }
    }
  }
  const monthly: import("./types.js").MonthlyRow[] = [];
  let cumulative = 0;
  let paybackMonths: number | null = null;
  for (let m2 = 1; m2 <= totalMonths; m2++) {
    const inflow = inflowByMonth[m2] || 0;
    const cost = costM[m2 - 1];
    const net = inflow - cost;
    const prevCum = cumulative;
    cumulative += net;
    if (paybackMonths === null && cumulative >= 0 && prevCum < 0 && net > 0) {
      paybackMonths = (m2 - 1) + (0 - prevCum) / net;
    }
    monthly.push({ period: m2, year: Math.ceil(m2 / 12), cost: cost, inflow: inflow, net: net, cumulative: cumulative });
  }
  const monthlyFlows = monthly.map((mm2) => mm2.net);
  const monthlySignChanges = countSignChanges(monthlyFlows);
  const headlineSource: "monthly" | "yearly" | "ambiguous" = monthlySignChanges <= 1
    ? "monthly"
    : (() => {
        const years = Math.ceil(monthly.length / 12);
        const yearlyFlows: number[] = [];
        for (let y = 0; y < years; y++) {
          let sum = 0;
          for (let mIdx = y * 12; mIdx < Math.min(monthly.length, (y + 1) * 12); mIdx++) sum += monthlyFlows[mIdx];
          yearlyFlows.push(sum);
        }
        return countSignChanges(yearlyFlows) <= 1 ? "yearly" : "ambiguous";
      })();
  // v0.6.11 Task D: the ambiguity classifier — mechanical and data-driven, no heuristics.
  // When the sign changes exceed one, re-count on the flow with the financing cash removed
  // (the exact v0.6.10 Task A.3 contributions: each receipt at its year-end month, each
  // interest-free installment at its month). A re-count at or below one means the
  // alternations are the financing pattern itself — cause "financing"; beyond it the
  // operations alternate on their own — cause "operational".
  let irrAmbiguityCause: "financing" | "operational" | null = null;
  let irrAmbiguityNote: string | null = null;
  if (monthlySignChanges > 1) {
    const withoutFinancing = monthlyFlows.slice();
    if (fundingPresent) {
      for (const fr of fundingRows) {
        const receiptMonth = fr.year * 12;
        if (receiptMonth >= 1 && receiptMonth <= withoutFinancing.length) withoutFinancing[receiptMonth - 1] -= fr.amount;
        if (fr.kind === "interest-free-loan") {
          const loanTerm = fr.termYears ?? 1;
          const loanStart = fr.repaymentStartYear ?? 1;
          const installment = fr.amount / loanTerm;
          for (let k = 0; k < loanTerm; k++) {
            const im = (loanStart + k) * 12;
            if (im >= 1 && im <= withoutFinancing.length) withoutFinancing[im - 1] += installment;
          }
        }
      }
    }
    irrAmbiguityCause = countSignChanges(withoutFinancing) <= 1 ? "financing" : "operational";
    irrAmbiguityNote = composeAmbiguityNote(irrAmbiguityCause, "main", monthlySignChanges, headlineSource);
  }
  const achieved = headlineSource === "monthly"
    ? irrAnnual(monthlyFlows)
    : headlineSource === "yearly"
      ? (() => {
          const years = Math.ceil(monthly.length / 12);
          const yearlyFlows: number[] = [];
          for (let y = 0; y < years; y++) {
            let sum = 0;
            for (let mIdx = y * 12; mIdx < Math.min(monthly.length, (y + 1) * 12); mIdx++) sum += monthlyFlows[mIdx];
            yearlyFlows.push(sum);
          }
          return irrYearly(yearlyFlows);
        })()
      : null;
  const totalYears = Math.ceil(totalMonths / 12);
  const yearly: import("./types.js").YearlyRow[] = [];
  for (let yy = 1; yy <= totalYears; yy++) {
    const inYear = monthly.filter((row) => row.year === yy);
    if (inYear.length === 0) continue;
    let costSum = 0, inflowSum = 0;
    inYear.forEach((row) => { costSum += row.cost; inflowSum += row.inflow; });
    yearly.push({
      name: "Y" + yy, year: yy, cost: costSum, inflow: inflowSum,
      net: inflowSum - costSum, cumulative: inYear[inYear.length - 1].cumulative,
    });
  }
  const lineTotals = costs.map((c) => {
    const overrides = c.yearOverrides && Object.keys(c.yearOverrides).length > 0 ? c.yearOverrides : null;
    let total = 0;
    if (overrides) {
      if (c.category === "capex") {
        for (const amount of Object.values(overrides)) total += amount;
      } else {
        const dur2 = Math.max(1, c.durationYears);
        for (let j = 0; j < dur2; j++) {
          const y = c.startYear + j;
          const overridden = Object.prototype.hasOwnProperty.call(overrides, String(y));
          total += overridden ? (overrides as Record<number, number>)[y] : c.amount * Math.pow(1 + c.escalation / 100, j);
        }
      }
    } else if (c.category === "capex") {
      total = c.amount;
    } else {
      const dur2 = Math.max(1, c.durationYears);
      for (let j = 0; j < dur2; j++) total += c.amount * Math.pow(1 + c.escalation / 100, j);
    }
    return { id: c.id, name: c.name, total: total };
  });
  const reinvestmentsTotal = reinvestmentsAll.reduce((a, ri) => a + ri.amount, 0);
  const totalCost = lineTotals.reduce((a, l) => a + l.total, 0) + operatingTotal + reinvestmentsTotal;
  let totalCollected = 0;
  if (profileMode) {
    for (const y of profileYears) totalCollected += (collectionsProfile as Record<number, number>)[y];
  } else if (!tariffCollectionMode && contractsMode) {
    for (const c of contracts) {
      if (c.mode === "solved") {
        for (const sl of c.slots) { if (sl.monthIndex <= totalMonths) totalCollected += payment * sl.escFactor; }
      } else if (c.evaluatedProfile !== null) {
        for (const amt of Object.values(c.evaluatedProfile)) totalCollected += amt as number;
      } else if (c.evaluatedPayment !== null) {
        for (const sl of c.slots) { if (sl.monthIndex <= totalMonths) totalCollected += (c.evaluatedPayment as number) * sl.escFactor; }
      }
      if (c.balloon > 0 && c.endMonth <= totalMonths) totalCollected += c.balloon;
    }
  } else if (!tariffCollectionMode) {
    slots.forEach((s) => { totalCollected += payment * s.escFactor; });
  } else {
    for (const t of tariffInfos) totalCollected += t.revenue;
  }
  if (!contractsMode && inp.repayment.balloon > 0) totalCollected += inp.repayment.balloon;
  if (residualAmountUsed > 0) totalCollected += residualAmountUsed;
  // v0.6.10 Task A.4: totalCollected gains the grants total (the loans net zero and never join it).
  if (fundingPresent) totalCollected += grantsTotal;
  const signChanges = monthlySignChanges;
  const netFlows = monthlyFlows;
  const npvAtTarget = npvMonthly(rM, netFlows);
  const waccM = Math.pow(1 + appraisal.wacc / 100, 1 / 12) - 1;
  const npvCollectionsAtWacc = npvMonthly(waccM, monthly.map((mm2) => mm2.inflow));
  const npvCostsAtWacc = npvMonthly(waccM, costM);
  const npvAtWacc = npvMonthly(waccM, netFlows);
  const profitabilityIndex = npvCostsAtWacc > 0 ? npvCollectionsAtWacc / npvCostsAtWacc : null;
  let discountedCum = 0;
  let discountedPaybackMonths: number | null = null;
  for (let m2 = 1; m2 <= totalMonths; m2++) {
    const dNet = monthly[m2 - 1].net / Math.pow(1 + waccM, m2);
    const prev = discountedCum;
    discountedCum += dNet;
    if (discountedPaybackMonths === null && discountedCum >= 0 && prev < 0 && dNet > 0) {
      discountedPaybackMonths = (m2 - 1) + (0 - prev) / dNet;
    }
  }
  let pvNeg = 0, fvPos = 0;
  const N = netFlows.length;
  const finM = Math.pow(1 + appraisal.financeRate / 100, 1 / 12) - 1;
  const reinvM = Math.pow(1 + appraisal.reinvestmentRate / 100, 1 / 12) - 1;
  for (let i = 0; i < N; i++) {
    const f = netFlows[i];
    if (f < 0) pvNeg += -f / Math.pow(1 + finM, i + 1);
    if (f > 0) fvPos += f * Math.pow(1 + reinvM, N - (i + 1));
  }
  let mirr: number | null = null;
  if (pvNeg > 0 && fvPos > 0) {
    const ratio = fvPos / pvNeg;
    mirr = N > 0 ? Math.pow(ratio, 12 / N) - 1 : null;
  }
  const goalMet = achieved !== null && achieved >= target / 100 - 1e-9;
  const totalYearsForGrid = Math.ceil(totalMonths / 12);
  const costGrid: import("./types.js").GridRow[] = [];
  const zeroRow = () => new Array<number>(totalYearsForGrid).fill(0);
  for (const c of inp.costs) {
    const amounts = zeroRow();
    const overrides = c.yearOverrides && Object.keys(c.yearOverrides).length > 0 ? c.yearOverrides : null;
    if (c.category === "capex") {
      const years = overrides ? Object.keys(overrides).map(Number) : [c.startYear];
      for (const y of years) {
        if (y >= 1 && y <= totalYearsForGrid) amounts[y - 1] += overrides ? (overrides as Record<number, number>)[y] : c.amount;
      }
    } else {
      const dur = Math.max(1, c.durationYears);
      for (let y = c.startYear; y < c.startYear + dur && y <= totalYearsForGrid; y++) {
        const overridden = overrides && Object.prototype.hasOwnProperty.call(overrides, String(y));
        amounts[y - 1] += overridden ? (overrides as Record<number, number>)[y] : c.amount * Math.pow(1 + c.escalation / 100, y - c.startYear);
      }
    }
    costGrid.push({ id: c.id, name: c.name, kind: "cost", amounts });
  }
  for (const o of operatingInfos) {
    if (o.id === "maintenance") continue;
    const amounts = zeroRow();
    for (let m = o.effectiveWindow[0]; m <= o.effectiveWindow[1]; m++) {
      const y = Math.floor((m - 1) / 12) + 1;
      if (y >= 1 && y <= totalYearsForGrid) amounts[y - 1] += o.total / Math.max(1, o.effectiveWindow[1] - o.effectiveWindow[0] + 1);
    }
    costGrid.push({ id: o.id, name: o.label, kind: "operating", amounts });
  }
  if (maintenanceCfg.mode !== "off") {
    const mInfo = operatingInfos.find((o) => o.id === "maintenance");
    if (mInfo) {
      const amounts = zeroRow();
      for (let m = mInfo.effectiveWindow[0]; m <= mInfo.effectiveWindow[1]; m++) {
        const y = Math.floor((m - 1) / 12) + 1;
        if (y >= 1 && y <= totalYearsForGrid) amounts[y - 1] += mInfo.total / Math.max(1, mInfo.effectiveWindow[1] - mInfo.effectiveWindow[0] + 1);
      }
      costGrid.push({ id: "maintenance", name: "Maintenance (derived)", kind: "maintenance", amounts });
    }
  }
  for (const c of contracts) {
    for (const ri of c.reinvestments) {
      const amounts = zeroRow();
      const y = ri.year;
      if (y >= 1 && y <= totalYearsForGrid) amounts[y - 1] += ri.amount;
      costGrid.push({ id: `reinv-${c.id}-${ri.year}`, name: `Reinvestment (${c.label})`, kind: "reinvestment", amounts });
    }
  }
  const collectionsGrid: import("./types.js").GridRow[] = [];
  if (profileMode) {
    const amounts = zeroRow();
    for (const y of profileYears) {
      if (y >= 1 && y <= totalYearsForGrid) amounts[y - 1] += (collectionsProfile as Record<number, number>)[y];
    }
    collectionsGrid.push({ id: "profile", name: "Collections profile", kind: "profile", amounts });
  } else if (!tariffCollectionMode && contractsMode) {
    // v0.6.5 Task D (W17): in contracts mode the grid carries one row per contract, built from
    // that contract's slots with its payment (mirroring the totalCollected construction), so
    // every deck surface built from the grid reports the true collections. The legacy
    // dormant-slot row and the residual row are unchanged; the legacy path stays byte-identical.
    for (const c of contracts) {
      const amounts = zeroRow();
      if (c.mode === "solved") {
        for (const sl of c.slots) {
          if (sl.monthIndex > totalMonths) continue;
          const y = Math.floor((sl.monthIndex - 1) / 12) + 1;
          if (y >= 1 && y <= totalYearsForGrid) amounts[y - 1] += payment * sl.escFactor;
        }
      } else if (c.evaluatedProfile !== null) {
        for (const [yStr, amt] of Object.entries(c.evaluatedProfile)) {
          const y = Number(yStr);
          if (y >= 1 && y <= totalYearsForGrid) amounts[y - 1] += amt as number;
        }
      } else if (c.evaluatedPayment !== null) {
        for (const sl of c.slots) {
          if (sl.monthIndex > totalMonths) continue;
          const y = Math.floor((sl.monthIndex - 1) / 12) + 1;
          if (y >= 1 && y <= totalYearsForGrid) amounts[y - 1] += (c.evaluatedPayment as number) * sl.escFactor;
        }
      }
      if (c.balloon > 0 && c.endMonth <= totalMonths) {
        const y = Math.floor((c.endMonth - 1) / 12) + 1;
        if (y >= 1 && y <= totalYearsForGrid) amounts[y - 1] += c.balloon;
      }
      collectionsGrid.push({ id: c.id, name: c.label, kind: "contract", amounts });
    }
  } else if (tariffCfg0.mode !== "off" && tariffInfos.length > 0) {
    if ((inp.tariff?.rows ?? []).length === 0) {
      const amounts = zeroRow();
      for (const t of tariffInfos) {
        if (t.year >= 1 && t.year <= totalYearsForGrid) amounts[t.year - 1] += t.revenue;
      }
      collectionsGrid.push({ id: "tariff", name: "Tariff collections", kind: "tariff", amounts });
    } else {
      for (const row of inp.tariff?.rows ?? []) {
        const amounts = zeroRow();
        // v0.6.7 Task C: the row's amount for a tariff year is its true yearly revenue — the
        // year's required (or revenue) times the row's share of that year's weighted volume —
        // guarded to 0 when the weighted volume is 0. perRowCharges stays per-call (followup.test).
        tariffInfos.forEach((t, k) => {
          const share = t.weightedVolume > 0 ? (row.weight * (row.lifts[k] ?? 0)) / t.weightedVolume : 0;
          const amount = (t.required ?? t.revenue) * share;
          if (t.year >= 1 && t.year <= totalYearsForGrid) amounts[t.year - 1] += amount;
        });
        collectionsGrid.push({ id: row.id, name: row.label, kind: "tariff", amounts });
      }
    }
  } else {
    const amounts = zeroRow();
    for (const sl of slots) {
      const y = Math.floor((sl.monthIndex - 1) / 12) + 1;
      if (y >= 1 && y <= totalYearsForGrid) amounts[y - 1] += payment * sl.escFactor;
    }
    collectionsGrid.push({ id: "payments", name: "Payment stream", kind: "payments", amounts });
  }
  if (inp.repayment.balloon > 0 && (profileMode ? profileEndMonth : balloonMonth) <= totalMonths) {
    const amounts = zeroRow();
    const y = Math.floor(((profileMode ? profileEndMonth : balloonMonth) - 1) / 12) + 1;
    if (y >= 1 && y <= totalYearsForGrid) amounts[y - 1] += inp.repayment.balloon;
    collectionsGrid.push({ id: "balloon", name: "Balloon", kind: "balloon", amounts });
  }
  if (residualAmountUsed > 0 && residualMonth <= totalMonths) {
    const amounts = zeroRow();
    if (residualYear >= 1 && residualYear <= totalYearsForGrid) amounts[residualYear - 1] += residualAmountUsed;
    collectionsGrid.push({ id: "residual", name: "Residual", kind: "residual", amounts });
  }
  // v0.6.10 Task A.5: the funding rows ride as visible collections-side rows — a grant as
  // kind "grant" (the receipt), an interest-free loan as kind "funding-loan" (the receipt
  // plus the negative repayment entries, summing to zero). The full circle stays reconciled.
  if (fundingPresent) {
    for (const fr of fundingRows) {
      const amounts = zeroRow();
      if (fr.year >= 1 && fr.year <= totalYearsForGrid) amounts[fr.year - 1] += fr.amount;
      if (fr.kind === "interest-free-loan") {
        const loanTerm = fr.termYears ?? 1;
        const loanStart = fr.repaymentStartYear ?? 1;
        const installment = fr.amount / loanTerm;
        for (let k = 0; k < loanTerm; k++) {
          const y = loanStart + k;
          if (y >= 1 && y <= totalYearsForGrid) amounts[y - 1] -= installment;
        }
      }
      collectionsGrid.push({ id: fr.id, name: fr.label, kind: fr.kind === "grant" ? "grant" : "funding-loan", amounts });
    }
  }
  const bookView: import("./types.js").BookView = {
    lines: bookSchedule.lines.map((l) => ({ id: l.id, name: l.name, isRetained: l.isRetained, years: l.years })),
    combined: bookSchedule.combined.map((row, idx) => {
      const year = row.year;
      const collections = yearly.find((y) => y.year === year)?.inflow ?? 0;
      const operating = operatingInfos.reduce((acc, o) => {
        let sum = 0;
        for (let m = o.effectiveWindow[0]; m <= o.effectiveWindow[1]; m++) {
          if (Math.floor((m - 1) / 12) + 1 === year) sum += o.total / Math.max(1, o.effectiveWindow[1] - o.effectiveWindow[0] + 1);
        }
        return acc + sum;
      }, 0);
      return { year, beginning: row.beginning, charge: row.charge, ending: row.ending, collections, operating, bookResult: collections - operating - row.charge };
    }),
    totalCharge: bookSchedule.totalCharge,
    remainingBookValueAtResidualYear: bookSchedule.remainingBookValueAt(Math.min(residualYear, horizonYears)),
    gainOrLossOnSale: residualMode === "amount" ? residualSetAmount - bookSchedule.remainingBookValueAt(Math.min(residualYear, horizonYears)) : 0,
    residualMode: residualMode,
    setAmount: residualSetAmount,
  };
  const termPositions: import("./types.js").TermPosition[] = contractsMode
    ? contracts.map((c) => {
        const trunc = monthly.slice(0, Math.min(c.endMonth, totalMonths));
        const flows = trunc.map((row) => row.net);
        const truncIrr = irrAnnual(flows);
        const truncSignChanges = countSignChanges(flows);
        const cumNet = trunc.length > 0 ? trunc[trunc.length - 1].cumulative : 0;
        const truncNpvWacc = npvMonthly(waccM, flows);
        const truncNpvTarget = npvMonthly(rM, flows);
        let pb: number | null = null;
        for (const row of trunc) {
          if (row.cumulative >= 0) { pb = row.period / 12; break; }
        }
        return {
          contractId: c.id,
          label: c.label,
          endMonth: c.endMonth,
          truncatedIrr: truncIrr,
          truncatedIrrAmbiguous: truncSignChanges > 1,
          cumulativeNet: cumNet,
          npvAtWacc: truncNpvWacc,
          npvAtTarget: truncNpvTarget,
          paybackSoFar: pb,
        };
      })
    : [];
  let financing: import("./types.js").FinancingResult | null = null;
  if (finCfg) {
    const inflowsByMonth = monthly.map((row) => row.inflow);
    const netM = monthly.map((row) => row.net);
    financing = computeFinancingOverlay({
      costM,
      inflowsByMonth,
      netM,
      horizon: totalMonths,
      targetMonthlyRate: rM,
      waccMonthlyRate: waccM,
      firstCollectionYear: repaymentStartYear,
      lastCostMonth: lastCostYear * 12,
      projectIrr: achieved,
      costLineTotals: lineTotals,
      costs: inp.costs,
      // v0.6.11 Task D: the funding rows ride the context so the equity-view classifier
      // can strip the financing cash (receipts and interest-free installments).
      fundingRows: fundingRows,
    }, finCfg);
  }
  return {
    leveragedSolve: leveraged,
    totalCost: totalCost, costNpv: costNpvWithOperating, paymentAmount: tariffCollectionMode || profileMode ? null : (contractsMode && solvedContractsDfSum <= 0 ? null : solvedPayment),
    paymentCount: tariffCollectionMode || profileMode ? null : (contractsMode ? contracts.reduce((acc, c) => acc + c.slots.filter((sl) => sl.monthIndex <= totalMonths).length, 0) : slots.length), totalCollected: totalCollected,
    solvedClamped: clampActive,
    headlineSource: headlineSource,
    residualDisclosure: residualPosture === "set-price"
      ? `Assumes sale at year ${residualYear} for ${residualSetAmount}`
      : residualPosture === "book-value" && residualAmountUsed > 0
        ? `Assumes sale at remaining book value at year ${residualYear} for ${residualAmountUsed}`
        : null,
    netGain: totalCollected - totalCost, achievedIrr: achieved,
    paybackYears: paybackMonths === null ? null : paybackMonths / 12,
    lastCostYear: lastCostYear, repaymentStartYear: repaymentStartYear,
    monthly: monthly, yearly: yearly, lineTotals: lineTotals,
    signChanges: signChanges, irrAmbiguous: signChanges > 1,
    // v0.6.11 Task D: the engine-composed ambiguity note, rendered verbatim by the surfaces.
    irrAmbiguityCause: irrAmbiguityCause,
    irrAmbiguityNote: irrAmbiguityNote,
    npvAtTarget: npvAtTarget, npvAtWacc: npvAtWacc,
    firstPaymentMonth: profileMode ? profileFirstMonth : firstCollectionMonth,
    lastPaymentMonth: profileMode
      ? Math.max(profileEndMonth, residualAmountUsed > 0 ? residualMonth : 0)
      : tariffCollectionMode ? lastTariffMonth : lastPaymentMonth,
    operatingLines: operatingInfos, operatingTotal: operatingTotal,
    tariffYears: tariffInfos, tariffBaseUnitPrice: tariffBaseUnitPrice,
    financing: financing,
    costGrid: costGrid,
    collectionsGrid: collectionsGrid,
    npvCollectionsAtWacc: npvCollectionsAtWacc, npvCostsAtWacc: npvCostsAtWacc,
    profitabilityIndex: profitabilityIndex, discountedPaybackYears: discountedPaybackMonths === null ? null : discountedPaybackMonths / 12,
    mirr: mirr, goalMet: goalMet,
    horizon: { totalMonths: totalMonths, totalYears: Math.ceil(totalMonths / 12), constituents: horizonConstituents },
    bookView: bookView,
    termPositions: termPositions,
    // v0.6.10 Task A: the funding view — null when no funding rows are present.
    fundingView: fundingPresent ? { rows: fundingRows, grantsTotal, fundingNpv, allocation: fundingAllocation } : null,
    residualAmountUsed: residualAmountUsed,
    contractsInfo: contracts.map((c) => ({
      id: c.id,
      label: c.label,
      mode: c.mode,
      startYear: Math.floor(c.startMonth / 12) + (c.startMonth % 12 === 0 ? 0 : 1),
      termYears: c.termMonths / 12,
      paymentsPerYear: c.paymentsPerYear,
      paymentCount: c.slots.length,
      endMonth: c.endMonth,
      lastCollectionMonth: contractLastCollectionMonth(c),
      reinvestments: c.reinvestments,
    })),
  };
}

import { EngineInputError, validateInputs } from "./validate.js";
import { normalizeContracts, allReinvestments, contractLastCollectionMonth } from "./contracts.js";
import type { NormalizedContract } from "./contracts.js";
import { computeBookSchedule, lineIncurred } from "./depreciation.js";
import type { PaymentSlot } from "./slots.js";
import { computeFinancingOverlay, fundableDraws, validateFinancing } from "./financing.js";

type ModelInputsLike = import("./types.js").ModelInputs;
type CostLine = import("./types.js").CostLine;

// v0.6.12.2 (AUD-3): the maintenance basis — the profile-honoring capex incurred total (the
// lineIncurred basis the book view uses), gross of grants; recurring lines and rent stay out.
function capexIncurredTotal(costs: CostLine[]): number {
  let total = 0;
  for (const c of costs) {
    if (c.category !== "capex") continue;
    let line = 0;
    for (const [, amt] of lineIncurred(c)) line += amt;
    total += line;
  }
  return total;
}

// v0.6.12.2 (AUD-4): the first month a contract collects (a profile year opens at its month 1;
// slots start at the first payment month; a slot-less contract starts at its start month).
function contractFirstCollectionMonth(c: NormalizedContract): number {
  let first = c.slots.length > 0 ? c.slots[0].monthIndex : c.startMonth;
  if (c.evaluatedProfile !== null) {
    const years = Object.keys(c.evaluatedProfile).map(Number).sort((a, b) => a - b);
    if (years.length > 0) first = c.slots.length > 0 ? Math.min(first, (years[0] - 1) * 12 + 1) : (years[0] - 1) * 12 + 1;
  }
  return first;
}

function lastCostYearOf(inp: ModelInputsLike): number {
  let last = 0;
  inp.costs.forEach((c) => {
    const overrides = c.yearOverrides && Object.keys(c.yearOverrides).length > 0 ? c.yearOverrides : null;
    let end: number;
    if (c.category === "capex") {
      end = overrides ? Math.max(...Object.keys(overrides).map(Number)) : c.startYear;
    } else {
      end = c.startYear + Math.max(1, c.durationYears) - 1;
    }
    last = Math.max(last, end);
  });
  return last === 0 ? 1 : last;
}

function costNpvOf(inp: ModelInputsLike, rM: number, operatingWindowEnd: number | null = null): number {
  const lastCostYear = lastCostYearOf(inp);
  const totalMonths = Math.max(Math.ceil(lastCostYear * 12), (lastCostYear + inp.repayment.graceYears) * 12 + Math.round(Math.max(0, inp.repayment.termYears) * 12));
  const costM = new Array<number>(totalMonths).fill(0);
  inp.costs.forEach((c) => {
    if (c.category === "capex") {
      const overrides = c.yearOverrides && Object.keys(c.yearOverrides).length > 0 ? c.yearOverrides : null;
      if (overrides) {
        for (const [yStr, amount] of Object.entries(overrides)) {
          const y = Number(yStr);
          const m = Math.min(totalMonths, y * 12);
          if (m >= 1) costM[m - 1] += amount;
        }
      } else {
        const m = Math.min(totalMonths, c.startYear * 12);
        if (m >= 1) costM[m - 1] += c.amount;
      }
    } else {
      const dur = Math.max(1, c.durationYears);
      const overrides = c.yearOverrides && Object.keys(c.yearOverrides).length > 0 ? c.yearOverrides : null;
      for (let y = c.startYear; y < c.startYear + dur; y++) {
        const overridden = overrides && Object.prototype.hasOwnProperty.call(overrides, String(y));
        const annual = overridden ? (overrides as Record<number, number>)[y] : c.amount * Math.pow(1 + c.escalation / 100, y - c.startYear);
        const monthly = annual / 12;
        for (let mm = (y - 1) * 12 + 1; mm <= y * 12 && mm <= totalMonths; mm++) costM[mm - 1] += monthly;
      }
    }
  });
  let costNpv = 0;
  for (let i = 0; i < totalMonths; i++) costNpv += costM[i] / Math.pow(1 + rM, i + 1);
  if (operatingWindowEnd !== null) {
    const startMonth = (inp.repayment.firstCollectionYear ?? lastCostYear + inp.repayment.graceYears) * 12;
    const capexTotal = capexIncurredTotal(inp.costs);
    const addLine = (line: { amount: number; startYear: number; yearCount: number; escalation: number }) => {
      const nominalFirst = line.startYear * 12 - 11;
      const nominalLast = (line.startYear + line.yearCount - 1) * 12;
      const effFirst = Math.max(nominalFirst, startMonth);
      const effLast = Math.min(nominalLast, operatingWindowEnd);
      if (effFirst > effLast) return;
      for (let m = effFirst; m <= effLast; m++) {
        const yearOf = Math.floor((m - 1) / 12) + 1;
        const yearIdx = yearOf - line.startYear;
        const monthly = (line.amount * Math.pow(1 + line.escalation / 100, yearIdx)) / 12;
        costNpv += monthly / Math.pow(1 + rM, m);
      }
    };
    (inp.operatingLines ?? []).forEach(addLine);
    if (inp.maintenance && inp.maintenance.mode !== "off") {
      const annual = inp.maintenance.mode === "percent"
        ? ((inp.maintenance.percentPerYear ?? 0) / 100) * capexTotal
        : (inp.maintenance.fixedAnnualAmount ?? 0);
      addLine({ amount: annual, startYear: Math.floor((startMonth - 1) / 12) + 1, yearCount: Math.ceil(operatingWindowEnd / 12), escalation: 0 });
    }
  }
  return costNpv;
}


export interface SolveTermResult {
  paymentCount: number | null;
  termYears: number | null;
  lastPaymentMonth: number | null;
  shortfall: number | null;
  minimalityShortfall: number | null;
  result: import("./types.js").ModelResult;
}

export function solveTerm(inp: ModelInputsLike, payment: number): SolveTermResult {
  const profileGuard = inp.repayment.collectionsOverrides;
  if (profileGuard && Object.keys(profileGuard).length > 0) {
    throw new EngineInputError(["The payment sensitivity tables require the solved payment stream; they do not apply while a collections profile is present (SCE-PROFILE)."]);
  }
  const target = inp.targetIrr;
  const rM = Math.pow(1 + target / 100, 1 / 12) - 1;
  const ppy = [1, 2, 4, 12].indexOf(inp.repayment.paymentsPerYear) >= 0 ? inp.repayment.paymentsPerYear : 1;
  const spacing = 12 / ppy;
  const issues = validateInputs(inp);
  if (issues.length > 0) throw new EngineInputError(issues);
  const appraisal = inp.appraisal ?? { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } };
  const residualPosturePre = appraisal.residual.posture
    ?? ((appraisal.residual.mode ?? "amount") === "amount" && appraisal.residual.amount > 0 ? "set-price"
      : appraisal.residual.mode === "calculated" ? "book-value"
      : "none");
  const residualAmount = residualPosturePre === "none" ? 0 : appraisal.residual.amount;
  const residualYear = appraisal.residual.year;
  const overrideYear = inp.repayment.firstCollectionYear ?? null;
  const startMonth = overrideYear !== null ? overrideYear * 12 : (lastCostYearOf(inp) + inp.repayment.graceYears) * 12;
  const residualMonth = residualYear * 12;
  const residualDf = residualAmount > 0 ? 1 / Math.pow(1 + rM, Math.max(residualMonth, startMonth + 1)) : 0;
  const esc = inp.repayment.paymentEscalation / 100;
  const hasOperating = (inp.operatingLines && inp.operatingLines.length > 0) || (inp.maintenance && inp.maintenance.mode !== "off");
  let n: number | null = null;
  let windowEnd = startMonth;
  let targetNpv = 0;
  let dfSum = 0;
  let infeasible = false;
  for (let iter = 0; iter < 100; iter++) {
    const balloonMonth = startMonth + Math.round(inp.repayment.termYears * 12);
    const balloonDf = inp.repayment.balloon > 0 ? 1 / Math.pow(1 + rM, balloonMonth) : 0;
    const costNpvBase = costNpvOf(inp, rM, hasOperating ? windowEnd : null);
    targetNpv = costNpvBase - inp.repayment.balloon * balloonDf - residualAmount * residualDf;
    let dfSumIter = 0;
    let nIter: number | null = null;
    let bad = false;
    if (payment <= 0 || targetNpv <= 0) {
      bad = payment <= 0;
      if (bad) { infeasible = true; n = null; dfSum = dfSumIter; break; }
    }
    for (let k = 0; ; k++) {
      const escFactor = Math.pow(1 + esc, Math.floor(k / ppy));
      const monthIndex = startMonth + k * spacing;
      const d = payment * escFactor / Math.pow(1 + rM, monthIndex);
      if (!isFinite(d) || d <= 0) { bad = true; break; }
      if (dfSumIter + d >= targetNpv) {
        dfSumIter += d;
        nIter = k + 1;
        break;
      }
      dfSumIter += d;
      if (targetNpv - dfSumIter < 1e-9 * targetNpv) { nIter = k + 1; break; }
      if (d < 1e-12 * dfSumIter) { bad = true; break; }
    }
    if (bad) { infeasible = true; n = null; dfSum = dfSumIter; break; }
    const solvedLast = startMonth + ((nIter as number) - 1) * spacing;
    if (solvedLast === windowEnd || !hasOperating) {
      n = nIter;
      dfSum = dfSumIter;
      windowEnd = solvedLast;
      break;
    }
    if (solvedLast > windowEnd && iter > 0 && solvedLast === windowEnd) break;
    windowEnd = solvedLast;
    n = nIter;
    dfSum = dfSumIter;
    if (iter === 99) { n = nIter; dfSum = dfSumIter; windowEnd = solvedLast; }
  }
  if (infeasible || n === null) {
    const result = computeModel({ ...inp, repayment: { ...inp.repayment, termYears: inp.repayment.termYears } });
    return { paymentCount: null, termYears: null, lastPaymentMonth: null, shortfall: targetNpv - dfSum, minimalityShortfall: null, result };
  }
  const termYears = n / ppy;
  const lastPaymentMonth = startMonth + (n - 1) * spacing;
  const result = computeModel({ ...inp, repayment: { ...inp.repayment, termYears } }, { fixedPayment: payment });
  const shortfall = result.costNpv - dfSum;
  let dfSumMinusOne = 0;
  for (let j = 0; j < (n as number) - 1; j++) {
    const escFactor = Math.pow(1 + esc, Math.floor(j / ppy));
    dfSumMinusOne += escFactor / Math.pow(1 + rM, startMonth + j * spacing);
  }
  const minimalityShortfall = result.costNpv - payment * dfSumMinusOne;
  return { paymentCount: n, termYears, lastPaymentMonth, shortfall, minimalityShortfall, result };
}
