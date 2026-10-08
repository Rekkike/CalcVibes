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

interface PaymentSlot {
  monthIndex: number;
  escFactor: number;
}

export function computeModel(inp: ModelInputsLike, opts?: { fixedPayment?: number }): import("./types.js").ModelResult {
  const issues = validateInputs(inp);
  const finCfgIn = inp.financing && inp.financing.enabled ? inp.financing : null;
  if (finCfgIn) {
    const derivedStart = inp.costs.reduce((mx, c) => Math.max(mx, c.category === "capex" ? c.startYear : c.startYear + Math.max(1, c.durationYears) - 1), 0) || 1;
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
  const residualAmount = appraisal.residual.amount;
  const residualYear = appraisal.residual.year;
  const target = inp.targetIrr;
  const rM = Math.pow(1 + target / 100, 1 / 12) - 1;
  const costs = inp.costs;
  let lastCostYear = 0;
  costs.forEach((c) => {
    const end = c.category === "capex" ? c.startYear : c.startYear + Math.max(1, c.durationYears) - 1;
    lastCostYear = Math.max(lastCostYear, end);
  });
  if (lastCostYear === 0) lastCostYear = 1;
  const overrideYear = inp.repayment.firstCollectionYear ?? null;
  const repaymentStartYear = overrideYear !== null ? overrideYear : lastCostYear + inp.repayment.graceYears;
  const termMonths = Math.round(Math.max(0, inp.repayment.termYears) * 12);
  let totalMonths = Math.max(Math.ceil(lastCostYear * 12), repaymentStartYear * 12 + termMonths);
  if (residualAmount > 0) totalMonths = Math.max(totalMonths, residualYear * 12);
  const tariffCfg0 = inp.tariff ?? { mode: "off" as const, escalationPerYear: 2, rows: [], fixedAnnualAmount: null, manualPrices: null };
  const gridFirstYear = repaymentStartYear;
  const gridYears: number[] = [];
  for (let k = 0; k < inp.repayment.termYears + 1; k++) gridYears.push(gridFirstYear + k);
  const weightedVolumes: number[] = gridYears.map((_, k) =>
    tariffCfg0.rows.reduce((acc, row) => acc + row.weight * (row.lifts[k] ?? 0), 0)
  );
  const tariffCollectionMode0 = tariffCfg0.mode === "stable" || tariffCfg0.mode === "manual" || tariffCfg0.mode === "fixed";
  const lastTariffMonth = tariffCfg0.mode !== "off" ? gridYears[gridYears.length - 1] * 12 : -1;
  if (lastTariffMonth > totalMonths) totalMonths = lastTariffMonth;
  const costM = new Array<number>(totalMonths).fill(0);
  costs.forEach((c) => {
    if (c.category === "capex") {
      const m = Math.min(totalMonths, c.startYear * 12);
      if (m >= 1) costM[m - 1] += c.amount;
    } else {
      const dur = Math.max(1, c.durationYears);
      for (let y = c.startYear; y < c.startYear + dur; y++) {
        const esc = Math.pow(1 + c.escalation / 100, y - c.startYear);
        const monthly = (c.amount * esc) / 12;
        for (let mm = (y - 1) * 12 + 1; mm <= y * 12 && mm <= totalMonths; mm++) costM[mm - 1] += monthly;
      }
    }
  });
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
  const balloonDf = balloonMonth <= totalMonths ? df(balloonMonth) : 0;
  if (inp.repayment.balloon > 0 && inp.repayment.balloon * balloonDf >= costNpv) {
    throw new EngineInputError(["The balloon's discounted value at the target rate reaches the cost NPV; the solved payment would be non-positive."]);
  }
  const residualMonth = residualYear * 12;
  const residualDf = residualAmount > 0 && residualMonth <= totalMonths ? df(residualMonth) : 0;
  const firstCollectionMonth = repaymentStartYear * 12;
  const lastPaymentMonth = slots.length > 0 ? slots[slots.length - 1].monthIndex : firstCollectionMonth;
  const lastInflowMonth = tariffCollectionMode0
    ? Math.max(lastTariffMonth, residualAmount > 0 ? residualMonth : 0)
    : Math.max(lastPaymentMonth, residualAmount > 0 ? residualMonth : 0);
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
      if (c.category === "capex") {
        if (c.startYear * 12 > S) fundableAfterStart = true;
      } else {
        const endMonth = (c.startYear + Math.max(1, c.durationYears) - 1) * 12;
        if (endMonth > S) fundableAfterStart = true;
      }
    });
    if (fundableAfterStart) {
      throw new EngineInputError([`A debt-funded fundable cost lands strictly after the service start month ${S} (FIN-FUNDABLE-AFTER-START).`]);
    }
  }
  const operatingLinesIn = inp.operatingLines ?? [];
  const maintenanceCfg = inp.maintenance ?? { mode: "off" };
  const tariffCfg = tariffCfg0;
  const tariffCollectionMode = tariffCollectionMode0;
  const capexTotal = inp.costs
    .filter((c) => c.category === "capex")
    .reduce((acc, c) => acc + c.amount, 0);
  const operatingInfos: import("./types.js").OperatingLineInfo[] = [];
  let operatingNpv = 0;
  const addOperating = (line: { id: string; label: string; amount: number; startYear: number; yearCount: number; escalation: number }) => {
    const nominalFirst = line.startYear * 12 - 11;
    const nominalLast = (line.startYear + line.yearCount - 1) * 12;
    const effFirst = Math.max(nominalFirst, firstCollectionMonth);
    const effLast = Math.min(nominalLast, lastInflowMonth);
    if (effFirst > effLast) {
      throw new EngineInputError([
        `Operating line ${line.id} (${line.label}) falls entirely outside the collection window [${firstCollectionMonth}, ${lastInflowMonth}].`,
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
    operatingInfos.push({ id: line.id, label: line.label, nominalSpan: [nominalFirst, nominalLast], effectiveWindow: [effFirst, effLast], total: total });
  };
  for (const line of operatingLinesIn) addOperating(line);
  if (maintenanceCfg.mode !== "off") {
    const annual = maintenanceCfg.mode === "percent"
      ? ((maintenanceCfg.percentPerYear ?? 0) / 100) * capexTotal
      : (maintenanceCfg.fixedAnnualAmount ?? 0);
    addOperating({ id: "maintenance", label: "Maintenance (derived)", amount: annual, startYear: Math.floor((firstCollectionMonth - 1) / 12) + 1, yearCount: Math.ceil(totalMonths / 12), escalation: 0 });
  }
  const operatingTotal = operatingInfos.reduce((acc, o) => acc + o.total, 0);
  const costNpvWithOperating = costNpv + operatingNpv;

  let dfSumEsc = 0;
  slots.forEach((s) => { dfSumEsc += s.escFactor * df(s.monthIndex); });
  const leveraged = finCfg !== null && finCfg.leveragedSolve;
  let leveragedPayment: number | null = null;
  if (leveraged && !tariffCollectionMode) {
    let pvDraws = 0;
    const rD = Math.pow(1 + finCfg.debtRatePct / 100, 1 / 12) - 1;
    let bal = 0;
    const S = (finCfg.serviceStartYear ?? repaymentStartYear) * 12;
    const drawAt = new Array<number>(totalMonths).fill(0);
    inp.costs.forEach((c) => {
      if (c.category !== "recurring" && c.category !== "capex") return;
      const share = (finCfg.perLineSharePct?.[c.id] ?? finCfg.sharePct) / 100;
      if (c.category === "capex") {
        const m = Math.min(totalMonths, c.startYear * 12);
        if (m >= 1) drawAt[m - 1] += share * c.amount;
      } else {
        const dur = Math.max(1, c.durationYears);
        for (let y = c.startYear; y < c.startYear + dur; y++) {
          const esc = Math.pow(1 + c.escalation / 100, y - c.startYear);
          const monthly = (c.amount * esc) / 12;
          for (let mm = (y - 1) * 12 + 1; mm <= y * 12 && mm <= totalMonths; mm++) drawAt[mm - 1] += share * monthly;
        }
      }
    });
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
    leveragedPayment = (costNpvWithOperating - pvDraws + pvService - inp.repayment.balloon * balloonDf - residualAmount * residualDf) / dfSumEsc;
  }
  const solvedPayment = leveraged && leveragedPayment !== null
    ? leveragedPayment
    : (opts && opts.fixedPayment !== undefined
      ? opts.fixedPayment
      : (dfSumEsc > 0 ? (costNpvWithOperating - inp.repayment.balloon * balloonDf - residualAmount * residualDf) / dfSumEsc : 0));
  const payment = tariffCollectionMode ? 0 : solvedPayment;
  const tariffEsc = tariffCfg.escalationPerYear / 100;
  const tariffInfos: import("./types.js").TariffYearInfo[] = [];
  let tariffBaseUnitPrice: number | null = null;
  if (tariffCfg.mode !== "off") {
    if (tariffCfg.mode === "decompose") {
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
          (perRowCharges as Record<string, number>)[row.id] = row.weight * (unitPrice as number);
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
        let netRequirement = costNpvWithOperating - inp.repayment.balloon * balloonDf - residualAmount * residualDf;
        if (leveraged) {
          let pvDraws = 0;
          const rD = Math.pow(1 + finCfg.debtRatePct / 100, 1 / 12) - 1;
          let bal = 0;
          const S = (finCfg.serviceStartYear ?? repaymentStartYear) * 12;
          const drawAt = new Array<number>(totalMonths).fill(0);
          inp.costs.forEach((c) => {
            if (c.category !== "recurring" && c.category !== "capex") return;
            const share = (finCfg.perLineSharePct?.[c.id] ?? finCfg.sharePct) / 100;
            if (c.category === "capex") {
              const m = Math.min(totalMonths, c.startYear * 12);
              if (m >= 1) drawAt[m - 1] += share * c.amount;
            } else {
              const dur = Math.max(1, c.durationYears);
              for (let y = c.startYear; y < c.startYear + dur; y++) {
                const esc = Math.pow(1 + c.escalation / 100, y - c.startYear);
                const monthly = (c.amount * esc) / 12;
                for (let mm = (y - 1) * 12 + 1; mm <= y * 12 && mm <= totalMonths; mm++) drawAt[mm - 1] += share * monthly;
              }
            }
          });
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
          (perRowCharges as Record<string, number>)[row.id] = row.weight * (unitPrice as number);
        }
        tariffInfos.push({ year, required: null, weightedVolume: weightedVolumes[k], unitPrice, revenue: revenues[k], perRowCharges });
      }
    }
  }

  const inflowByMonth: Record<number, number> = {};
  if (!tariffCollectionMode) {
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
  if (inp.repayment.balloon > 0 && balloonMonth <= totalMonths) {
    inflowByMonth[balloonMonth] = (inflowByMonth[balloonMonth] || 0) + inp.repayment.balloon;
  }
  if (residualAmount > 0 && residualMonth <= totalMonths) {
    inflowByMonth[residualMonth] = (inflowByMonth[residualMonth] || 0) + residualAmount;
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
  const achieved = irrAnnual(monthly.map((mm2) => mm2.net));
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
    let total = 0;
    if (c.category === "capex") total = c.amount;
    else {
      const dur2 = Math.max(1, c.durationYears);
      for (let j = 0; j < dur2; j++) total += c.amount * Math.pow(1 + c.escalation / 100, j);
    }
    return { id: c.id, name: c.name, total: total };
  });
  const totalCost = lineTotals.reduce((a, l) => a + l.total, 0) + operatingTotal;
  let totalCollected = 0;
  if (!tariffCollectionMode) {
    slots.forEach((s) => { totalCollected += payment * s.escFactor; });
  } else {
    for (const t of tariffInfos) totalCollected += t.revenue;
  }
  if (inp.repayment.balloon > 0) totalCollected += inp.repayment.balloon;
  if (residualAmount > 0) totalCollected += residualAmount;
  const signChanges = countSignChanges(monthly.map((mm2) => mm2.net));
  const netFlows = monthly.map((mm2) => mm2.net);
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
    }, finCfg);
  }
  return {
    leveragedSolve: leveraged,
    totalCost: totalCost, costNpv: costNpvWithOperating, paymentAmount: tariffCollectionMode ? null : solvedPayment,
    paymentCount: tariffCollectionMode ? null : slots.length, totalCollected: totalCollected,
    netGain: totalCollected - totalCost, achievedIrr: achieved,
    paybackYears: paybackMonths === null ? null : paybackMonths / 12,
    lastCostYear: lastCostYear, repaymentStartYear: repaymentStartYear,
    monthly: monthly, yearly: yearly, lineTotals: lineTotals,
    signChanges: signChanges, irrAmbiguous: signChanges > 1,
    npvAtTarget: npvAtTarget, npvAtWacc: npvAtWacc,
    firstPaymentMonth: firstCollectionMonth,
    lastPaymentMonth: tariffCollectionMode ? lastTariffMonth : lastPaymentMonth,
    operatingLines: operatingInfos, operatingTotal: operatingTotal,
    tariffYears: tariffInfos, tariffBaseUnitPrice: tariffBaseUnitPrice,
    financing: financing,
    npvCollectionsAtWacc: npvCollectionsAtWacc, npvCostsAtWacc: npvCostsAtWacc,
    profitabilityIndex: profitabilityIndex, discountedPaybackYears: discountedPaybackMonths === null ? null : discountedPaybackMonths / 12,
    mirr: mirr, goalMet: goalMet,
  };
}

import { EngineInputError, validateInputs } from "./validate.js";
import { computeFinancingOverlay, validateFinancing } from "./financing.js";

type ModelInputsLike = import("./types.js").ModelInputs;

function lastCostYearOf(inp: ModelInputsLike): number {
  let last = 0;
  inp.costs.forEach((c) => {
    const end = c.category === "capex" ? c.startYear : c.startYear + Math.max(1, c.durationYears) - 1;
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
      const m = Math.min(totalMonths, c.startYear * 12);
      if (m >= 1) costM[m - 1] += c.amount;
    } else {
      const dur = Math.max(1, c.durationYears);
      for (let y = c.startYear; y < c.startYear + dur; y++) {
        const esc2 = Math.pow(1 + c.escalation / 100, y - c.startYear);
        const monthly = (c.amount * esc2) / 12;
        for (let mm = (y - 1) * 12 + 1; mm <= y * 12 && mm <= totalMonths; mm++) costM[mm - 1] += monthly;
      }
    }
  });
  let costNpv = 0;
  for (let i = 0; i < totalMonths; i++) costNpv += costM[i] / Math.pow(1 + rM, i + 1);
  if (operatingWindowEnd !== null) {
    const startMonth = (inp.repayment.firstCollectionYear ?? lastCostYear + inp.repayment.graceYears) * 12;
    const capexTotal = inp.costs
      .filter((c) => c.category === "capex")
      .reduce((acc, c) => acc + c.amount, 0);
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
  const target = inp.targetIrr;
  const rM = Math.pow(1 + target / 100, 1 / 12) - 1;
  const ppy = [1, 2, 4, 12].indexOf(inp.repayment.paymentsPerYear) >= 0 ? inp.repayment.paymentsPerYear : 1;
  const spacing = 12 / ppy;
  const issues = validateInputs(inp);
  if (issues.length > 0) throw new EngineInputError(issues);
  const appraisal = inp.appraisal ?? { wacc: 8, financeRate: 6, reinvestmentRate: 6, residual: { amount: 0, year: 10 } };
  const residualAmount = appraisal.residual.amount;
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
