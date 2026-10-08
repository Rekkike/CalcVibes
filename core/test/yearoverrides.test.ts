import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { EngineInputError } from "../src/validate.js";
import { appraisal, templateLike } from "./_shared.js";
import type { CostLine } from "../src/types.js";

const base = () => ({ ...templateLike(), appraisal: appraisal() });
const capexProfile = (): CostLine => ({ id: "cx", name: "Program", category: "capex", amount: 450000, startYear: 1, durationYears: 0, escalation: 0, yearOverrides: { 1: 3000000, 2: 30000000, 3: 300000000, 4: 5000000 } });
const fourLumps = (): CostLine[] => [
  { id: "x1", name: "A", category: "capex", amount: 3000000, startYear: 1, durationYears: 0, escalation: 0 },
  { id: "x2", name: "B", category: "capex", amount: 30000000, startYear: 2, durationYears: 0, escalation: 0 },
  { id: "x3", name: "C", category: "capex", amount: 300000000, startYear: 3, durationYears: 0, escalation: 0 },
  { id: "x4", name: "D", category: "capex", amount: 5000000, startYear: 4, durationYears: 0, escalation: 0 },
];

describe("CAP-PROFILE: CAPEX year overrides", () => {
  it("full pin set", () => {
    const r = computeModel({ ...base(), costs: [...base().costs, capexProfile()] });
    expect(Math.abs(r.totalCost - 345849860.00)).toBeLessThan(0.01);
    expect(Math.abs(r.costNpv - 249938650.47458)).toBeLessThan(0.01);
    expect(Math.abs((r.paymentAmount as number) - 20060600.48937)).toBeLessThan(0.01);
    expect(Math.abs(r.npvAtTarget)).toBeLessThan(1e-6);
    expect(Math.abs(r.npvAtWacc - 44963836.52290)).toBeLessThan(0.01);
    expect(Math.abs((r.profitabilityIndex as number) - 1.16214)).toBeLessThan(1e-4);
    expect(r.firstPaymentMonth).toBe(48);
    expect(r.paymentCount).toBe(28);
    expect(r.lastPaymentMonth).toBe(129);
    expect(r.monthly.length).toBe(132);
    expect(Math.abs(r.yearly[0].cost - 5850000.00)).toBeLessThan(0.01);
    expect(Math.abs(r.yearly[1].cost - 32466000.00)).toBeLessThan(0.01);
    expect(Math.abs(r.yearly[2].cost - 302533860.00)).toBeLessThan(0.01);
    expect(Math.abs(r.yearly[3].cost - 5000000.00)).toBeLessThan(0.01);
  });

  it("CAP-IDENT: four single-year CAPEX lines are scalar-identical", () => {
    const prof = computeModel({ ...base(), costs: [...base().costs, capexProfile()] });
    const four = computeModel({ ...base(), costs: [...base().costs, ...fourLumps()] });
    expect(four.totalCost).toBe(prof.totalCost);
    expect(four.costNpv).toBe(prof.costNpv);
    expect(four.paymentAmount).toBe(prof.paymentAmount);
    expect(four.npvAtWacc).toBe(prof.npvAtWacc);
    expect(JSON.stringify(four.yearly)).toBe(JSON.stringify(prof.yearly));
  });
});

describe("CAP-SPREAD (amendment): equal spread fill as overrides", () => {
  it("full pin set", () => {
    const spreadLine: CostLine = { ...capexProfile(), yearOverrides: { 1: 84500000, 2: 84500000, 3: 84500000, 4: 84500000 } };
    const r = computeModel({ ...base(), costs: [...base().costs, spreadLine] });
    expect(Math.abs(r.totalCost - 345849860.00)).toBeLessThan(0.01);
    expect(Math.abs(r.costNpv - 263288617.77337)).toBeLessThan(0.01);
    expect(Math.abs((r.paymentAmount as number) - 21132096.87466)).toBeLessThan(0.01);
    expect(Math.abs(r.npvAtTarget)).toBeLessThan(1e-6);
    expect(Math.abs(r.npvAtWacc - 52625852.30039)).toBeLessThan(0.01);
    expect(Math.abs((r.profitabilityIndex as number) - 1.18345)).toBeLessThan(1e-4);
    expect(r.firstPaymentMonth).toBe(48);
    expect(r.paymentCount).toBe(28);
    expect(r.lastPaymentMonth).toBe(129);
    expect(r.monthly.length).toBe(132);
    expect(Math.abs(r.yearly[0].cost - 87350000.00)).toBeLessThan(0.01);
    expect(Math.abs(r.yearly[1].cost - 86966000.00)).toBeLessThan(0.01);
    expect(Math.abs(r.yearly[2].cost - 87033860.00)).toBeLessThan(0.01);
    expect(Math.abs(r.yearly[3].cost - 84500000.00)).toBeLessThan(0.01);
  });

  it("CAP-SPREAD-IDENT: scalar-identical to four equal single-year CAPEX lines", () => {
    const spreadLine: CostLine = { ...capexProfile(), yearOverrides: { 1: 84500000, 2: 84500000, 3: 84500000, 4: 84500000 } };
    const prof = computeModel({ ...base(), costs: [...base().costs, spreadLine] });
    const four = computeModel({ ...base(), costs: [...base().costs,
      { id: "x1", name: "A", category: "capex", amount: 84500000, startYear: 1, durationYears: 0, escalation: 0 },
      { id: "x2", name: "B", category: "capex", amount: 84500000, startYear: 2, durationYears: 0, escalation: 0 },
      { id: "x3", name: "C", category: "capex", amount: 84500000, startYear: 3, durationYears: 0, escalation: 0 },
      { id: "x4", name: "D", category: "capex", amount: 84500000, startYear: 4, durationYears: 0, escalation: 0 }] });
    expect(four.totalCost).toBe(prof.totalCost);
    expect(four.costNpv).toBe(prof.costNpv);
    expect(four.paymentAmount).toBe(prof.paymentAmount);
    expect(four.npvAtWacc).toBe(prof.npvAtWacc);
    expect(four.profitabilityIndex).toBe(prof.profitabilityIndex);
    expect(JSON.stringify(four.yearly)).toBe(JSON.stringify(prof.yearly));
  });
});

describe("OVR-REC: recurring year override", () => {
  it("full pin set; escalation excluded on the overridden year; start unchanged", () => {
    const r = computeModel({ ...base(), costs: base().costs.map((c) => (c.id === "c1" ? { ...c, yearOverrides: { 3: 2000000 } } : c)) });
    expect(Math.abs(r.totalCost - 7940240.00)).toBeLessThan(0.01);
    expect(Math.abs(r.costNpv - 6700394.48742)).toBeLessThan(0.01);
    expect(Math.abs((r.paymentAmount as number) - 480167.60698)).toBeLessThan(0.01);
    expect(Math.abs(r.yearly[2].cost - 2624240.00)).toBeLessThan(0.01);
    expect(r.firstPaymentMonth).toBe(36);
  });
});

describe("OVR-BYTE: empty overrides are byte-identical", () => {
  it("payment and costNpv equal to 1e-12", () => {
    const withEmpty = computeModel({ ...base(), costs: base().costs.map((c) => ({ ...c, yearOverrides: {} })) });
    const plain = computeModel(base());
    expect(Math.abs((withEmpty.paymentAmount as number) - (plain.paymentAmount as number))).toBeLessThan(1e-12);
    expect(Math.abs(withEmpty.costNpv - plain.costNpv)).toBeLessThan(1e-12);
  });
});

describe("Directionals", () => {
  it("recurring overrides never move the start; a CAPEX profile's max year does", () => {
    const rec = computeModel({ ...base(), costs: base().costs.map((c) => (c.id === "c1" ? { ...c, yearOverrides: { 3: 2000000 } } : c)) });
    expect(rec.firstPaymentMonth).toBe(36);
    const prof = computeModel({ ...base(), costs: [...base().costs, capexProfile()] });
    expect(prof.firstPaymentMonth).toBe(48);
  });
});

describe("Validation constructs", () => {
  it("a recurring override outside the span surfaces an error naming the line and year", () => {
    expect(() => computeModel({ ...base(), costs: base().costs.map((c) => (c.id === "c1" ? { ...c, yearOverrides: { 9: 2000000 } } : c)) }))
      .toThrowError(/c1.*year 9 outside its span 1..3/);
  });

  it("a non-positive override amount surfaces an error", () => {
    expect(() => computeModel({ ...base(), costs: base().costs.map((c) => (c.id === "c1" ? { ...c, yearOverrides: { 3: 0 } } : c)) }))
      .toThrowError(EngineInputError);
    expect(() => computeModel({ ...base(), costs: [...base().costs, { ...capexProfile(), yearOverrides: { 1: 3000000, 2: -5 } }] }))
      .toThrowError(EngineInputError);
  });
});
