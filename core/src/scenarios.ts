import { computeModel } from "./engine.js";
import { EngineInputError } from "./validate.js";
import type { CostLine, ModelInputs, ModelResult } from "./types.js";

function assertNoCollectionsProfile(inp: ModelInputs): void {
  const profile = inp.repayment.collectionsOverrides;
  if (profile && Object.keys(profile).length > 0) {
    throw new EngineInputError(["The payment sensitivity tables require the solved payment stream; they do not apply while a collections profile is present (SCE-PROFILE)."]);
  }
}

// v0.6.12.2 (AUD-5): one shared burn helper — the multiplier scales the amount AND every
// per-year override value; a line without overrides keeps its exact shape.
function scaleBurn(c: CostLine, multiplier: number): CostLine {
  const scaled: CostLine = { ...c, amount: c.amount * multiplier };
  if (c.yearOverrides !== undefined) {
    const overrides: Record<number, number> = {};
    for (const [y, v] of Object.entries(c.yearOverrides)) overrides[Number(y)] = v * multiplier;
    scaled.yearOverrides = overrides;
  }
  return scaled;
}

export interface ScenarioShift {
  burnMultiplier: number;
  escalationShift: number;
  targetShift: number;
  termShift: number;
}

export function applyScenario(inp: ModelInputs, shift: ScenarioShift): ModelInputs {
  const contractsMode = inp.contracts !== undefined && inp.contracts.length > 0;
  return {
    ...inp,
    targetIrr: inp.targetIrr + shift.targetShift,
    repayment: contractsMode ? inp.repayment : { ...inp.repayment, termYears: inp.repayment.termYears + shift.termShift },
    contracts: contractsMode
      ? inp.contracts?.map((c) => ({ ...c, termYears: c.termYears + shift.termShift }))
      : inp.contracts,
    costs: inp.costs.map((c) => ({
      ...scaleBurn(c, shift.burnMultiplier),
      escalation: c.category === "recurring" ? c.escalation + shift.escalationShift : c.escalation,
    })),
  };
}

export const SCENARIO_SETS: Record<"base" | "optimistic" | "pessimistic", ScenarioShift> = {
  base: { burnMultiplier: 1.0, escalationShift: 0, targetShift: 0, termShift: 0 },
  optimistic: { burnMultiplier: 0.9, escalationShift: -1, targetShift: -2, termShift: 1 },
  pessimistic: { burnMultiplier: 1.1, escalationShift: 1, targetShift: 2, termShift: -1 },
};

// v0.6.11 Task A: the named set degrades per scenario. Each optional reality computes under
// its own stated terms; a variant that cannot exist under its terms is disclosed as exactly
// that, with the engine's refusal verbatim. The catch takes ONLY EngineInputError — a
// genuine defect never masquerades as a refusal (the v0.6.10 Task D.2 precedent).
export type ScenarioOutcome = { result: ModelResult; refusal: null } | { result: null; refusal: string };

function scenarioOutcome(inp: ModelInputs, shift: ScenarioShift): ScenarioOutcome {
  try {
    return { result: computeModel(applyScenario(inp, shift)), refusal: null };
  } catch (e) {
    if (e instanceof EngineInputError) return { result: null, refusal: e.message };
    throw e;
  }
}

export function scenarioResults(inp: ModelInputs): Record<"base" | "optimistic" | "pessimistic", ScenarioOutcome> {
  return {
    base: scenarioOutcome(inp, SCENARIO_SETS.base),
    optimistic: scenarioOutcome(inp, SCENARIO_SETS.optimistic),
    pessimistic: scenarioOutcome(inp, SCENARIO_SETS.pessimistic),
  };
}

// v0.6.11 Task B: the tornado degrades per cell. Each of the eight cells computes
// individually; a refused cell is null with its refusal string set; a computed cell is the
// number with its refusal null. A legitimately null paymentAmount (no refusal thrown)
// keeps its refusal null — null alone never means refusal.
export interface TornadoRow {
  factor: string;
  low: number | null;
  high: number | null;
  lowRefusal: string | null;
  highRefusal: string | null;
}

type TornadoCell = { value: number | null; refusal: string | null };

function tornadoCell(inp: ModelInputs): TornadoCell {
  try {
    return { value: computeModel(inp).paymentAmount, refusal: null };
  } catch (e) {
    if (e instanceof EngineInputError) return { value: null, refusal: e.message };
    throw e;
  }
}

export function tornado(inp: ModelInputs): TornadoRow[] {
  const burnLow = tornadoCell({ ...inp, costs: inp.costs.map((c) => scaleBurn(c, 0.9)) });
  const burnHigh = tornadoCell({ ...inp, costs: inp.costs.map((c) => scaleBurn(c, 1.1)) });
  const targetLow = tornadoCell({ ...inp, targetIrr: inp.targetIrr - 2 });
  const targetHigh = tornadoCell({ ...inp, targetIrr: inp.targetIrr + 2 });
  const termLow = tornadoCell({ ...inp, repayment: { ...inp.repayment, termYears: inp.repayment.termYears - 1 } });
  const termHigh = tornadoCell({ ...inp, repayment: { ...inp.repayment, termYears: inp.repayment.termYears + 1 } });
  const escLow = tornadoCell({ ...inp, costs: inp.costs.map((c) => (c.category === "recurring" ? { ...c, escalation: c.escalation - 1 } : c)) });
  const escHigh = tornadoCell({ ...inp, costs: inp.costs.map((c) => (c.category === "recurring" ? { ...c, escalation: c.escalation + 1 } : c)) });
  return [
    { factor: "burn", low: burnLow.value, high: burnHigh.value, lowRefusal: burnLow.refusal, highRefusal: burnHigh.refusal },
    { factor: "targetIrr", low: targetLow.value, high: targetHigh.value, lowRefusal: targetLow.refusal, highRefusal: targetHigh.refusal },
    { factor: "term", low: termLow.value, high: termHigh.value, lowRefusal: termLow.refusal, highRefusal: termHigh.refusal },
    { factor: "escalation", low: escLow.value, high: escHigh.value, lowRefusal: escLow.refusal, highRefusal: escHigh.refusal },
  ];
}

// v0.6.10 Task D.2: every two-way table catches EngineInputError per cell and yields null —
// a span that cannot cover a term renders an honest null cell, never a broken table.
export function paymentVsTermTargetTable(inp: ModelInputs, terms: number[], targets: number[]): (number | null)[][] {
  assertNoCollectionsProfile(inp);
  return targets.map((t) =>
    terms.map((term) => {
      try {
        return computeModel({ ...inp, targetIrr: t, repayment: { ...inp.repayment, termYears: term } }).paymentAmount;
      } catch (e) {
        if (e instanceof EngineInputError) return null;
        throw e;
      }
    })
  );
}

export function paymentVsBalloonTermTable(inp: ModelInputs, balloons: number[], terms: number[]): (number | null)[][] {
  assertNoCollectionsProfile(inp);
  return terms.map((term) =>
    balloons.map((balloon) => {
      try {
        return computeModel({ ...inp, repayment: { ...inp.repayment, termYears: term, balloon } }).paymentAmount;
      } catch (e) {
        if (e instanceof EngineInputError) return null;
        throw e;
      }
    })
  );
}

// v0.6.10 Task D.1: the grant-scale axis — each cell scales the grant rows' amounts by the
// factor and solves at the term. A factor of 0 removes the grant rows (a zero-amount grant is
// invalid per FND-AMOUNT); the loan rows never scale.
export function paymentVsGrantScaleTable(inp: ModelInputs, grantScales: number[], terms: number[]): (number | null)[][] {
  assertNoCollectionsProfile(inp);
  const scaledFunding = (scale: number): ModelInputs["funding"] => {
    if (!inp.funding || !inp.funding.rows || inp.funding.rows.length === 0) return inp.funding;
    const rows = inp.funding.rows
      .filter((fr) => fr.kind !== "grant" || scale > 0)
      .map((fr) => (fr.kind === "grant" ? { ...fr, amount: fr.amount * scale } : fr));
    return { rows };
  };
  return grantScales.map((scale) =>
    terms.map((term) => {
      try {
        return computeModel({ ...inp, repayment: { ...inp.repayment, termYears: term }, funding: scaledFunding(scale) }).paymentAmount;
      } catch (e) {
        if (e instanceof EngineInputError) return null;
        throw e;
      }
    })
  );
}
