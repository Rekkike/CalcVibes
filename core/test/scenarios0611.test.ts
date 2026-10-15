import { describe, expect, it } from "vitest";
import { composeAmbiguityNote, computeModel } from "../src/engine.js";
import { scenarioResults, tornado } from "../src/scenarios.js";
import { programFixture0610 } from "./_shared.js";
import { templateLike } from "./_shared.js";
import { EngineInputError } from "../src/validate.js";
import type { FinancingConfig, ModelInputs } from "../src/types.js";

// v0.6.11 — the scenario-granularity pass. The optional-realities contract: each scenario
// and each tornado cell computes under its own stated terms and discloses its own refusal;
// the ambiguity notes compose once in the engine with a mechanically classified cause.
// Every pin below is a directive reproduction, verified at the engine's float spellings.

// The synthetic operational fixture of record: the program fixture with the funding block
// removed and one added cost line (the year-10 spike).
function syntheticOperationalFixture(): ModelInputs {
  const base = programFixture0610();
  return {
    ...base,
    funding: null,
    costs: [...base.costs, { id: "x1", name: "Mid-life overhaul (one-year spike)", category: "recurring", amount: 55000000, startYear: 10, durationYears: 1, escalation: 0 }],
  } as ModelInputs;
}

describe("v0.6.11 Task A — the named set degrades per scenario", () => {
  it("base computes (never a refusal when the main model computes); optimistic refuses; pessimistic computes — the PRE-failing contract", () => {
    const sc = scenarioResults(programFixture0610());
    // On PRE the wholesale call threw, killing all three variants including base.
    const b = sc.base.result!;
    expect(sc.base.refusal).toBeNull();
    expect(b.paymentAmount).toBe(2843365.6055825967);
    expect(b.totalCost).toBe(628250000);
    expect(b.paymentCount).toBe(240);
    expect(b.achievedIrr).toBe(0.06050952135640186);
    expect(b.npvAtWacc).toBe(52409252.63203347);
    expect(b.netGain).toBe(227657745.3398229);
    expect(b.paybackYears).toBe(13.853998049333244);
    expect(b.mirr).toBe(0.044267690561307305);
    expect(b.signChanges).toBe(3);
    expect(b.irrAmbiguous).toBe(true);
    expect(b.headlineSource).toBe("yearly");
    // The optimistic variant cannot exist under its own terms — disclosed as exactly that.
    expect(sc.optimistic.result).toBeNull();
    expect(sc.optimistic.refusal).toBe("Invalid model inputs: The required collections extend to year 24, beyond the declared tariff span (years 3-23): widen the tariff span or shorten the term.");
    const p = sc.pessimistic.result!;
    expect(sc.pessimistic.refusal).toBeNull();
    expect(p.paymentAmount).toBe(3708855.5523114554);
    expect(p.totalCost).toBe(667682706.419);
    expect(p.paymentCount).toBe(228);
    expect(p.achievedIrr).toBe(0.08046703557679658);
    expect(p.npvAtWacc).toBe(121924692.91236979);
    expect(p.netGain).toBe(351436359.5080104);
    expect(p.paybackYears).toBe(11.985852760533378);
    expect(p.mirr).toBe(0.051501283664327824);
    expect(p.signChanges).toBe(3);
    expect(p.irrAmbiguous).toBe(true);
    expect(p.headlineSource).toBe("yearly");
  });

  it("the Task F delta double: pessimistic minus base, the exact double", () => {
    const sc = scenarioResults(programFixture0610());
    expect((sc.pessimistic.result!.paymentAmount as number) - (sc.base.result!.paymentAmount as number)).toBe(865489.9467288586);
    expect(3708855.5523114554 - 2843365.6055825967).toBe(865489.9467288586);
  });
});

describe("v0.6.11 Task B — the tornado degrades per cell", () => {
  it("the eight cells compute individually; the term-high cell refuses, the rest compute — the PRE-failing contract", () => {
    const t = tornado(programFixture0610());
    expect(t.length).toBe(4);
    const by = Object.fromEntries(t.map((r) => [r.factor, r]));
    expect(by.burn.low).toBe(2516090.5615513995);
    expect(by.burn.high).toBe(3170640.6496137977);
    expect(by.burn.lowRefusal).toBeNull();
    expect(by.burn.highRefusal).toBeNull();
    expect(by.targetIrr.low).toBe(2489496.3612990044);
    expect(by.targetIrr.high).toBe(3233058.949475011);
    expect(by.targetIrr.lowRefusal).toBeNull();
    expect(by.targetIrr.highRefusal).toBeNull();
    expect(by.term.low).toBe(2901863.049251351);
    expect(by.term.lowRefusal).toBeNull();
    // The refused cell: null with the refusal set — null alone never means refusal.
    expect(by.term.high).toBeNull();
    expect(by.term.highRefusal).toBe("Invalid model inputs: The required collections extend to year 24, beyond the declared tariff span (years 3-23): widen the tariff span or shorten the term.");
    expect(by.escalation.low).toBe(2821372.917165251);
    expect(by.escalation.high).toBe(2865574.620200431);
    expect(by.escalation.lowRefusal).toBeNull();
    expect(by.escalation.highRefusal).toBeNull();
  });
});

describe("v0.6.11 Task C — the span-coverage refusal carries its cause and its check", () => {
  it("names the failing year and the declared bounds on the program fixture", () => {
    const inp = programFixture0610();
    try {
      computeModel({ ...inp, repayment: { ...inp.repayment, termYears: 25 } });
      expect.unreachable();
    } catch (e) {
      expect((e as EngineInputError).issues[0]).toBe("The required collections extend to year 24, beyond the declared tariff span (years 3-23): widen the tariff span or shorten the term.");
    }
  });

  it("the bounds are data-driven — the actual grid bounds, never assumed constants", () => {
    const inp = programFixture0610();
    const shifted = { ...inp, tariff: { ...inp.tariff!, span: { startYear: 4, termYears: 12 } } } as ModelInputs;
    try {
      computeModel(shifted);
      expect.unreachable();
    } catch (e) {
      expect((e as EngineInputError).issues[0]).toBe("The required collections extend to year 3, beyond the declared tariff span (years 4-16): widen the tariff span or shorten the term.");
    }
  });

  it("the zero-weighted-volume refusal is unchanged (a different refusal class, out of scope)", () => {
    const inp = programFixture0610();
    const zeroed = { ...inp, tariff: { ...inp.tariff!, rows: inp.tariff!.rows.map((row) => ({ ...row, lifts: row.lifts.map((v) => 0) })) } } as ModelInputs;
    try {
      computeModel({ ...zeroed, repayment: { ...inp.repayment, termYears: 5 } });
      expect.unreachable();
    } catch (e) {
      expect((e as EngineInputError).issues[0]).toBe("Grid year 3 has zero weighted volume against a positive required collection.");
    }
  });
});

describe("v0.6.11 Task D — the ambiguity classifier and the composed notes", () => {
  it("the program fixture: main 3 sign changes, re-count 1 — financing; equity 4, re-count 1 — financing", () => {
    const r = computeModel(programFixture0610());
    expect(r.signChanges).toBe(3);
    expect(r.irrAmbiguityCause).toBe("financing");
    expect(r.irrAmbiguityNote).toBe("Funding receipts alternate the net flow (3 sign changes), so the IRR may not be unique - the yearly-aggregate rate is shown; the NPV at WACC and the MIRR are unaffected and remain the reliable criteria.");
    expect(r.financing?.equity.signChanges).toBe(4);
    expect(r.financing?.equity.ambiguityCause).toBe("financing");
    expect(r.financing?.equity.ambiguityNote).toBe("Funding receipts and debt service alternate the equity net flow (4 sign changes), so the equity IRR may not be unique - the NPV at WACC and the MIRR are unaffected and remain the reliable criteria.");
  });

  it("the synthetic operational fixture: the alternation is the year-10 spike, not the funding pattern", () => {
    const r = computeModel(syntheticOperationalFixture());
    expect(r.paymentAmount).toBe(4281938.226814459);
    expect(r.paymentCount).toBe(240);
    expect(r.totalCost).toBe(683250000);
    expect(r.signChanges).toBe(3);
    expect(r.irrAmbiguous).toBe(true);
    expect(r.headlineSource).toBe("ambiguous");
    expect(r.achievedIrr).toBeNull();
    expect(r.npvAtWacc).toBe(77441739.92188473);
    expect(r.mirr).toBe(0.04630847078820022);
    expect(r.netGain).toBe(344415174.435475);
    expect(r.paybackYears).toBe(14.790458705726342);
    expect(r.irrAmbiguityCause).toBe("operational");
    expect(r.irrAmbiguityNote).toBe("The net flow alternates 3 times beyond the funding pattern - collections below operating costs or one-off cost spikes can do this - so the IRR may not be unique; no unique IRR is shown. The NPV at WACC and the MIRR remain the reliable criteria, and the operating years at the alternations merit a look.");
  });

  it("the null branches: no ambiguity, no cause, no note (main and equity views)", () => {
    const t = computeModel(templateLike());
    expect(t.signChanges).toBe(1);
    expect(t.irrAmbiguityCause).toBeNull();
    expect(t.irrAmbiguityNote).toBeNull();
    const finCfg: FinancingConfig = { enabled: true, sharePct: 0, debtRatePct: 6, termYears: 7, graceYears: 0, serviceStartYear: null, amortization: "annuity", leveragedSolve: false, perLineSharePct: {} };
    const tFin = computeModel({ ...templateLike(), financing: finCfg } as ModelInputs);
    expect(tFin.financing?.equity.signChanges).toBe(1);
    expect(tFin.financing?.equity.ambiguityCause).toBeNull();
    expect(tFin.financing?.equity.ambiguityNote).toBeNull();
  });

  it("the three pinned notes verbatim plus every remaining composition branch", () => {
    // The three pinned notes of record.
    expect(composeAmbiguityNote("financing", "main", 3, "yearly")).toBe("Funding receipts alternate the net flow (3 sign changes), so the IRR may not be unique - the yearly-aggregate rate is shown; the NPV at WACC and the MIRR are unaffected and remain the reliable criteria.");
    expect(composeAmbiguityNote("financing", "equity", 4, null)).toBe("Funding receipts and debt service alternate the equity net flow (4 sign changes), so the equity IRR may not be unique - the NPV at WACC and the MIRR are unaffected and remain the reliable criteria.");
    expect(composeAmbiguityNote("operational", "main", 3, "ambiguous")).toBe("The net flow alternates 3 times beyond the funding pattern - collections below operating costs or one-off cost spikes can do this - so the IRR may not be unique; no unique IRR is shown. The NPV at WACC and the MIRR remain the reliable criteria, and the operating years at the alternations merit a look.");
    // The remaining branches of the single-sourced composition function.
    expect(composeAmbiguityNote("financing", "main", 4, "ambiguous")).toBe("Funding receipts alternate the net flow (4 sign changes), so the IRR may not be unique - no unique IRR is shown; the NPV at WACC and the MIRR are unaffected and remain the reliable criteria.");
    expect(composeAmbiguityNote("operational", "main", 3, "yearly")).toBe("The net flow alternates 3 times beyond the funding pattern - collections below operating costs or one-off cost spikes can do this - so the IRR may not be unique; the yearly-aggregate rate is shown. The NPV at WACC and the MIRR remain the reliable criteria, and the operating years at the alternations merit a look.");
    expect(composeAmbiguityNote("operational", "equity", 3, null)).toBe("The equity net flow alternates 3 times beyond the funding pattern - collections below operating costs or one-off cost spikes can do this - so the equity IRR may not be unique. The NPV at WACC and the MIRR remain the reliable criteria, and the operating years at the alternations merit a look.");
  });
});
