import { describe, expect, it } from "vitest";
import { computeModel, composeAmbiguityNote } from "../src/engine.js";
import { scenarioResults, tornado } from "../src/scenarios.js";
import { programFixture0610 } from "./_program0610.js";
import { templateLike } from "./_shared.js";
import { EngineInputError } from "../src/validate.js";
import type { ModelInputs } from "../src/types.js";

// v0.6.11 — the scenario-granularity pass. The named set degrades per scenario, the tornado
// per cell; the span-coverage refusal carries its cause and its check; the ambiguity
// warnings are engine-composed with a mechanical cause classification. Every asserted figure
// is a directive reproduction pin (docs/directives/v0.6.11-scenario-granularity.md); the
// digits are the exact double values of record.

const OPT_REFUSAL =
  "Invalid model inputs: The required collections extend to year 24, beyond the declared tariff span (years 3-23): widen the tariff span or shorten the term.";

function syntheticOperationalFixture(): ModelInputs {
  const base = programFixture0610();
  return {
    ...base,
    funding: null,
    costs: [...base.costs, { id: "x1", name: "Mid-life overhaul (one-year spike)", category: "recurring", amount: 55000000, startYear: 10, durationYears: 1, escalation: 0 }],
  } as ModelInputs;
}

describe("v0.6.11 Task A — the named set degrades per scenario", () => {
  it("base computes with every headline pin; a scenario layer may not refuse the model's own terms", () => {
    const sc = scenarioResults(programFixture0610());
    expect(sc.base.result).not.toBeNull();
    expect(sc.base.refusal).toBeNull();
    const b = sc.base.result!;
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
  });

  it("optimistic refuses under its own stated terms, with the engine's reason verbatim", () => {
    const sc = scenarioResults(programFixture0610());
    expect(sc.optimistic.result).toBeNull();
    expect(sc.optimistic.refusal).toBe(OPT_REFUSAL);
  });

  it("pessimistic computes with every headline pin", () => {
    const sc = scenarioResults(programFixture0610());
    expect(sc.pessimistic.result).not.toBeNull();
    expect(sc.pessimistic.refusal).toBeNull();
    const p = sc.pessimistic.result!;
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

  it("the pessimistic-vs-base delta reproduces the exact double of record", () => {
    const sc = scenarioResults(programFixture0610());
    const delta = (sc.pessimistic.result!.paymentAmount as number) - (sc.base.result!.paymentAmount as number);
    expect(delta).toBe(865489.9467288586);
  });
});

describe("v0.6.11 Task B — the tornado degrades per cell", () => {
  it("computed cells carry their numbers with null refusals; burn and target and escalation", () => {
    const t = tornado(programFixture0610());
    const byFactor = Object.fromEntries(t.map((row) => [row.factor, row]));
    expect(byFactor.burn.low).toBe(2516090.5615513995);
    expect(byFactor.burn.high).toBe(3170640.6496137977);
    expect(byFactor.burn.lowRefusal).toBeNull();
    expect(byFactor.burn.highRefusal).toBeNull();
    expect(byFactor.targetIrr.low).toBe(2489496.3612990044);
    expect(byFactor.targetIrr.high).toBe(3233058.949475011);
    expect(byFactor.targetIrr.lowRefusal).toBeNull();
    expect(byFactor.targetIrr.highRefusal).toBeNull();
    expect(byFactor.escalation.low).toBe(2821372.917165251);
    expect(byFactor.escalation.high).toBe(2865574.620200431);
    expect(byFactor.escalation.lowRefusal).toBeNull();
    expect(byFactor.escalation.highRefusal).toBeNull();
  });

  it("the term high cell refuses with the reworded year-24 message; the low cell and its refusal stay clean", () => {
    const t = tornado(programFixture0610());
    const byFactor = Object.fromEntries(t.map((row) => [row.factor, row]));
    expect(byFactor.term.low).toBe(2901863.049251351);
    expect(byFactor.term.lowRefusal).toBeNull();
    expect(byFactor.term.high).toBeNull();
    expect(byFactor.term.highRefusal).toBe(OPT_REFUSAL);
  });
});

describe("v0.6.11 Task C — the span-coverage refusal carries its cause and its check", () => {
  it("throws the reworded refusal with the declared bounds on the program fixture (years 3-23, failing year 24)", () => {
    const inp = programFixture0610();
    try {
      computeModel({ ...inp, repayment: { ...inp.repayment, termYears: 25 } });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EngineInputError);
      expect((e as EngineInputError).issues[0]).toBe(
        "The required collections extend to year 24, beyond the declared tariff span (years 3-23): widen the tariff span or shorten the term."
      );
      expect((e as EngineInputError).message).toBe(OPT_REFUSAL);
    }
  });

  it("the bounds are data-driven: a shifted, shortened span yields its own bounds, never assumed constants", () => {
    const inp = programFixture0610();
    const shifted = { ...inp, tariff: { ...inp.tariff!, span: { startYear: 2, termYears: 10 } } } as ModelInputs;
    try {
      computeModel(shifted);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EngineInputError);
      expect((e as EngineInputError).issues[0]).toBe(
        "The required collections extend to year 13, beyond the declared tariff span (years 2-12): widen the tariff span or shorten the term."
      );
    }
  });
});

describe("v0.6.11 Task D — the engine-composed ambiguity notes, mechanically classified", () => {
  it("main view, program fixture: re-count 1 against 3 sign changes — financing cause, the yearly-aggregate note verbatim", () => {
    const r = computeModel(programFixture0610());
    expect(r.signChanges).toBe(3);
    expect(r.irrAmbiguityCause).toBe("financing");
    expect(r.irrAmbiguityNote).toBe(
      "Funding receipts alternate the net flow (3 sign changes), so the IRR may not be unique - the yearly-aggregate rate is shown; the NPV at WACC and the MIRR are unaffected and remain the reliable criteria."
    );
  });

  it("equity view, program fixture: re-count 1 against 4 sign changes — financing cause, the equity note verbatim", () => {
    const r = computeModel(programFixture0610());
    const e = r.financing?.equity;
    expect(e?.signChanges).toBe(4);
    expect(e?.ambiguityCause).toBe("financing");
    expect(e?.ambiguityNote).toBe(
      "Funding receipts and debt service alternate the equity net flow (4 sign changes), so the equity IRR may not be unique - the NPV at WACC and the MIRR are unaffected and remain the reliable criteria."
    );
  });

  it("synthetic operational fixture: every pin, operational cause (the year-10 spike, no funding present), the operational note verbatim", () => {
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
    expect(r.irrAmbiguityNote).toBe(
      "The net flow alternates 3 times beyond the funding pattern - collections below operating costs or one-off cost spikes can do this - so the IRR may not be unique; no unique IRR is shown. The NPV at WACC and the MIRR remain the reliable criteria, and the operating years at the alternations merit a look."
    );
  });

  it("equity view, synthetic fixture: the operational branch with the equity substitutions", () => {
    const r = computeModel(syntheticOperationalFixture());
    const e = r.financing?.equity;
    expect(e?.signChanges).toBe(4);
    expect(e?.ambiguityCause).toBe("operational");
    expect(e?.ambiguityNote).toBe(
      "The equity net flow alternates 4 times beyond the funding pattern - collections below operating costs or one-off cost spikes can do this - so the equity IRR may not be unique. The NPV at WACC and the MIRR remain the reliable criteria, and the operating years at the alternations merit a look."
    );
  });

  it("null branch, main view (the template fixture): one sign change, no cause, no note", () => {
    const r = computeModel(templateLike());
    expect(r.signChanges).toBe(1);
    expect(r.irrAmbiguityCause).toBeNull();
    expect(r.irrAmbiguityNote).toBeNull();
  });

  it("null branch, equity view (no funding, the service ending with the collections): one sign change, no cause, no note", () => {
    const pf = programFixture0610();
    const r = computeModel({ ...pf, funding: null, financing: { ...pf.financing!, termYears: 19 } } as ModelInputs);
    const e = r.financing?.equity;
    expect(e?.signChanges).toBe(1);
    expect(e?.zeroOutlay).toBe(false);
    expect(e?.ambiguityCause).toBeNull();
    expect(e?.ambiguityNote).toBeNull();
  });

  it("every composition branch asserts verbatim against the single-sourced composer", () => {
    expect(composeAmbiguityNote("financing", "main", 3, "yearly")).toBe(
      "Funding receipts alternate the net flow (3 sign changes), so the IRR may not be unique - the yearly-aggregate rate is shown; the NPV at WACC and the MIRR are unaffected and remain the reliable criteria."
    );
    expect(composeAmbiguityNote("financing", "main", 4, "ambiguous")).toBe(
      "Funding receipts alternate the net flow (4 sign changes), so the IRR may not be unique - no unique IRR is shown; the NPV at WACC and the MIRR are unaffected and remain the reliable criteria."
    );
    expect(composeAmbiguityNote("financing", "equity", 4, null)).toBe(
      "Funding receipts and debt service alternate the equity net flow (4 sign changes), so the equity IRR may not be unique - the NPV at WACC and the MIRR are unaffected and remain the reliable criteria."
    );
    expect(composeAmbiguityNote("operational", "main", 3, "yearly")).toBe(
      "The net flow alternates 3 times beyond the funding pattern - collections below operating costs or one-off cost spikes can do this - so the IRR may not be unique; the yearly-aggregate rate is shown. The NPV at WACC and the MIRR remain the reliable criteria, and the operating years at the alternations merit a look."
    );
    expect(composeAmbiguityNote("operational", "main", 3, "ambiguous")).toBe(
      "The net flow alternates 3 times beyond the funding pattern - collections below operating costs or one-off cost spikes can do this - so the IRR may not be unique; no unique IRR is shown. The NPV at WACC and the MIRR remain the reliable criteria, and the operating years at the alternations merit a look."
    );
    expect(composeAmbiguityNote("operational", "equity", 3, null)).toBe(
      "The equity net flow alternates 3 times beyond the funding pattern - collections below operating costs or one-off cost spikes can do this - so the equity IRR may not be unique. The NPV at WACC and the MIRR remain the reliable criteria, and the operating years at the alternations merit a look."
    );
  });
});

describe("v0.6.11 — the PRE-failing assertions of record", () => {
  it("scenarioResults returns per-variant outcomes instead of throwing wholesale (impossible on the pristine tree)", () => {
    const sc = scenarioResults(programFixture0610());
    expect(sc.base.result).not.toBeNull();
    expect(sc.optimistic.result).toBeNull();
    expect(sc.pessimistic.result).not.toBeNull();
  });

  it("tornado returns per-cell outcomes instead of throwing wholesale (impossible on the pristine tree)", () => {
    const t = tornado(programFixture0610());
    expect(t).toHaveLength(4);
    expect(t.every((row) => row.low !== null || row.lowRefusal !== null)).toBe(true);
    expect(t.every((row) => row.high !== null || row.highRefusal !== null)).toBe(true);
  });
});
