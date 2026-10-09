import { computeModel } from "./engine.js";
import { EngineInputError } from "./validate.js";
import type { ModelInputs, ModelResult } from "./types.js";

function assertNoCollectionsProfile(inp: ModelInputs): void {
  const profile = inp.repayment.collectionsOverrides;
  if (profile && Object.keys(profile).length > 0) {
    throw new EngineInputError(["The payment sensitivity tables require the solved payment stream; they do not apply while a collections profile is present (SCE-PROFILE)."]);
  }
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
      ...c,
      amount: c.amount * shift.burnMultiplier,
      escalation: c.category === "recurring" ? c.escalation + shift.escalationShift : c.escalation,
    })),
  };
}

export const SCENARIO_SETS: Record<"base" | "optimistic" | "pessimistic", ScenarioShift> = {
  base: { burnMultiplier: 1.0, escalationShift: 0, targetShift: 0, termShift: 0 },
  optimistic: { burnMultiplier: 0.9, escalationShift: -1, targetShift: -2, termShift: 1 },
  pessimistic: { burnMultiplier: 1.1, escalationShift: 1, targetShift: 2, termShift: -1 },
};

export function scenarioResults(inp: ModelInputs): Record<"base" | "optimistic" | "pessimistic", ModelResult> {
  return {
    base: computeModel(applyScenario(inp, SCENARIO_SETS.base)),
    optimistic: computeModel(applyScenario(inp, SCENARIO_SETS.optimistic)),
    pessimistic: computeModel(applyScenario(inp, SCENARIO_SETS.pessimistic)),
  };
}

export interface TornadoRow {
  factor: string;
  low: number | null;
  high: number | null;
}

export function tornado(inp: ModelInputs): TornadoRow[] {
  const burnLow = computeModel({ ...inp, costs: inp.costs.map((c) => ({ ...c, amount: c.amount * 0.9 })) }).paymentAmount;
  const burnHigh = computeModel({ ...inp, costs: inp.costs.map((c) => ({ ...c, amount: c.amount * 1.1 })) }).paymentAmount;
  const targetLow = computeModel({ ...inp, targetIrr: inp.targetIrr - 2 }).paymentAmount;
  const targetHigh = computeModel({ ...inp, targetIrr: inp.targetIrr + 2 }).paymentAmount;
  const termLow = computeModel({ ...inp, repayment: { ...inp.repayment, termYears: inp.repayment.termYears - 1 } }).paymentAmount;
  const termHigh = computeModel({ ...inp, repayment: { ...inp.repayment, termYears: inp.repayment.termYears + 1 } }).paymentAmount;
  const escLow = computeModel({ ...inp, costs: inp.costs.map((c) => (c.category === "recurring" ? { ...c, escalation: c.escalation - 1 } : c)) }).paymentAmount;
  const escHigh = computeModel({ ...inp, costs: inp.costs.map((c) => (c.category === "recurring" ? { ...c, escalation: c.escalation + 1 } : c)) }).paymentAmount;
  return [
    { factor: "burn", low: burnLow, high: burnHigh },
    { factor: "targetIrr", low: targetLow, high: targetHigh },
    { factor: "term", low: termLow, high: termHigh },
    { factor: "escalation", low: escLow, high: escHigh },
  ];
}

export function paymentVsTermTargetTable(inp: ModelInputs, terms: number[], targets: number[]): (number | null)[][] {
  assertNoCollectionsProfile(inp);
  return targets.map((t) =>
    terms.map((term) =>
      computeModel({ ...inp, targetIrr: t, repayment: { ...inp.repayment, termYears: term } }).paymentAmount
    )
  );
}

export function paymentVsBalloonTermTable(inp: ModelInputs, balloons: number[], terms: number[]): (number | null)[][] {
  assertNoCollectionsProfile(inp);
  return terms.map((term) =>
    balloons.map((balloon) =>
      computeModel({ ...inp, repayment: { ...inp.repayment, termYears: term, balloon } }).paymentAmount
    )
  );
}
