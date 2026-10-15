import { describe, expect, it } from "vitest";
// v0.6.11: the program fixture moved to _shared.ts (single-sourced across the funding and
// scenario suites; importing a test file into another test file double-runs its tests).
import { programFixture0610 } from "./_shared.js";
import { computeModel } from "../src/engine.js";
import { paymentVsTermTargetTable, paymentVsBalloonTermTable, paymentVsGrantScaleTable } from "../src/scenarios.js";
import { EngineInputError } from "../src/validate.js";
import type { ModelInputs } from "../src/types.js";


const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("v0.6.10 Task F — the program fixture's solved figures (reproduction pins)", () => {
  it("reproduces every headline pin", () => {
    const r = computeModel(programFixture0610());
    expect(r.totalCost).toBe(628250000);
    expect(r.costNpv).toBe(479231369.7270124);
    expect(r.paymentAmount).toBe(2843365.6055825967);
    expect(r.paymentCount).toBe(240);
    expect(r.totalCollected).toBe(855907745.3398229);
    expect(r.netGain).toBe(227657745.3398229);
    expect(r.paybackYears).toBe(13.853998049333244);
    expect(r.discountedPaybackYears).toBe(18.23938311386264);
    expect(r.npvAtWacc).toBe(52409252.63203347);
    expect(r.mirr).toBe(0.044267690561307305);
    expect(r.profitabilityIndex).toBe(1.1010015272787173);
    // The monthly-resolution identity: npvAtTarget is float noise at zero.
    expect(r.npvAtTarget).toBe(-2.1629966795444489e-7);
    expect(r.lastCostYear).toBe(5);
    expect(r.firstPaymentMonth).toBe(36);
    expect(r.lastPaymentMonth).toBe(275);
    expect(r.horizon?.totalMonths).toBe(276);
  });

  it("reproduces the honest-headline pins (the watchpoint of record)", () => {
    const r = computeModel(programFixture0610());
    expect(r.signChanges).toBe(3);
    expect(r.irrAmbiguous).toBe(true);
    expect(r.achievedIrr).toBe(0.06050952135640186);
    expect(r.goalMet).toBe(true);
    const y1 = r.yearly.find((y) => y.year === 1)!;
    const y5 = r.yearly.find((y) => y.year === 5)!;
    const y14 = r.yearly.find((y) => y.year === 14)!;
    const y23 = r.yearly.find((y) => y.year === 23)!;
    expect(y1.net).toBe(-27500000);
    expect(y5.net).toBe(88870387.26699115);
    expect(y14.inflow).toBe(34120387.26699115);
    expect(y23.cumulative).toBe(227657745.33982268);
  });

  it("reproduces the tariff year pins (the span grid keys from year 3)", () => {
    const r = computeModel(programFixture0610());
    const t = r.tariffYears;
    expect(t.length).toBe(21);
    const at = (y: number) => t.find((x) => x.year === y)!;
    expect(at(3).required).toBe(2843365.6055825967);
    expect(at(3).weightedVolume).toBe(400);
    expect(at(3).unitPrice).toBe(7108.4140139564915);
    expect(at(4).required).toBe(34120387.26699115);
    expect(at(4).weightedVolume).toBe(640);
    expect(at(4).unitPrice).toBe(53313.105104673676);
    expect(at(5).required).toBe(34120387.26699115);
    expect(at(5).weightedVolume).toBe(850);
    expect(at(5).unitPrice).toBe(40141.63207881312);
    expect(at(6).required).toBe(34120387.26699115);
    expect(at(6).weightedVolume).toBe(1030);
    expect(at(6).unitPrice).toBe(33126.58957960306);
    expect(at(7).required).toBe(34120387.26699115);
    expect(at(7).weightedVolume).toBe(1107);
    expect(at(7).unitPrice).toBe(30822.391388429227);
    expect(at(8).required).toBe(34120387.26699115);
    expect(at(8).weightedVolume).toBe(1151);
    expect(at(8).unitPrice).toBe(29644.124471755997);
    for (let y = 9; y <= 22; y++) {
      expect(at(y).required).toBe(34120387.26699115);
      expect(at(y).weightedVolume).toBe(1170);
      expect(at(y).unitPrice).toBe(29162.724159821497);
    }
    expect(at(23).required).toBe(31277021.66140856);
    expect(at(23).weightedVolume).toBe(1170);
    expect(at(23).unitPrice).toBe(26732.497146503043);
  });

  it("reproduces the financing overlay pins (gross of the funding block, the scope wall)", () => {
    const r = computeModel(programFixture0610());
    const f = r.financing!;
    expect(f.drawnTotal).toBe(89999600.00000003);
    expect(f.idc).toBe(3081167.5096770525);
    expect(f.serviceStartBalance).toBe(93080767.50967708);
    expect(f.annuityPayment).toBe(603495.341204519);
    expect(f.totalInterest).toBe(39652398.51975607);
    expect(f.totalService).toBe(132733166.02943361);
    expect(f.minDscr).toEqual({ year: 23, value: 4.31887090724161 });
    expect(f.yearly.find((y) => y.year === 4)!.service).toBe(3206705.4745704313);
    expect(f.yearly.find((y) => y.year === 23)!.interest).toBe(133349.5345103564);
    expect(f.yearly.find((y) => y.year === 23)!.principal).toBe(7108594.559943871);
    expect(f.dscr.find((d) => d.year === 4)!.dscr).toBe(10.328478099919028);
    expect(f.dscr.find((d) => d.year === 8)!.dscr).toBe(4.573411066836907);
    expect(f.equity.outlay).toBe(359000400);
    expect(f.equity.npvAtWacc).toBe(56332110.592094585);
    expect(f.equity.payback).toBe(12.48356167807797);
    expect(f.equity.irr).toBe(0.07136243190763225);
    expect(f.equity.signChanges).toBe(4);
  });
});

describe("v0.6.10 Task A — the funding block in the engine", () => {
  it("reproduces the funding view pins (grantsTotal, fundingNpv, the allocation)", () => {
    const r = computeModel(programFixture0610());
    const fv = r.fundingView!;
    expect(fv).not.toBeNull();
    expect(fv.grantsTotal).toBe(173500000);
    expect(fv.fundingNpv).toBe(140055345.14230645);
    expect(fv.rows.length).toBe(4);
    const g1 = fv.allocation.find((a) => a.grantId === "g1")!;
    const g2 = fv.allocation.find((a) => a.grantId === "g2")!;
    const g3 = fv.allocation.find((a) => a.grantId === "g3")!;
    // AFIF €70M at year 3, capitalized base 378.5M.
    expect(g1.shares.map((s) => s.nettedAmount)).toEqual([
      13685601.05680317, 20343461.03038309, 18494055.482166447, 11558784.676354028, 3698811.0964332893, 2219286.6578599736,
    ]);
    expect(g1.shares.map((s) => s.capitalizedToDate)).toEqual([74000000, 110000000, 100000000, 62500000, 20000000, 12000000]);
    // National €100M at year 5, base the full 449M.
    expect(g2.shares.map((s) => s.nettedAmount)).toEqual([
      16481069.042316258, 24498886.414253898, 22271714.922048997, 27839643.652561247, 4454342.9844098, 4454342.9844098,
    ]);
    expect(g2.shares.map((s) => s.capitalizedToDate)).toEqual([74000000, 110000000, 100000000, 125000000, 20000000, 20000000]);
    // Provincial €3.5M at year 1, base 41M (p1 37M, p6 4M).
    expect(g3.shares.map((s) => s.nettedAmount)).toEqual([3158536.5853658537, 341463.4146341463]);
    expect(g3.shares.map((s) => s.capitalizedToDate)).toEqual([37000000, 4000000]);
  });

  it("reproduces the collections-grid funding rows and the full circle", () => {
    const r = computeModel(programFixture0610());
    const rows = r.collectionsGrid;
    const g1 = rows.find((x) => x.id === "g1")!;
    const g2 = rows.find((x) => x.id === "g2")!;
    const g3 = rows.find((x) => x.id === "g3")!;
    const l1 = rows.find((x) => x.id === "l1")!;
    expect(sum(g1.amounts)).toBe(70000000);
    expect(sum(g2.amounts)).toBe(100000000);
    expect(sum(g3.amounts)).toBe(3500000);
    expect(sum(l1.amounts)).toBe(0);
    expect(g1.kind).toBe("grant");
    expect(g2.kind).toBe("grant");
    expect(g3.kind).toBe("grant");
    expect(l1.kind).toBe("funding-loan");
    const tSums = ["r1", "r2", "r3", "r4"].map((id) => sum(rows.find((x) => x.id === id)!.amounts));
    expect(tSums[0]).toBe(490354385.9115055);
    expect(tSums[1]).toBe(96808387.83346725);
    expect(tSums[2]).toBe(75190154.16526192);
    expect(tSums[3]).toBe(20054817.429588314);
    // The tariff rows plus the grants reconcile to totalCollected (the engine's own
    // year-major accumulation; see the completion report for the intermediate-total note).
    expect(sum(r.tariffYears.map((t) => t.revenue)) + 173500000).toBe(r.totalCollected);
  });

  it("throws the funding validation refusals with the exact strings", () => {
    const base = programFixture0610();
    expect(() => computeModel({ ...base, funding: { rows: [{ id: "gx", label: "Bad", kind: "voucher" as never, amount: 1, year: 1 }] } })).toThrow(/Funding row gx has unsupported kind "voucher" \(FND-KIND\)\./);
    expect(() => computeModel({ ...base, funding: { rows: [{ id: "gx", label: "Bad", kind: "grant", amount: 1, year: 0 }] } })).toThrow(/Funding row gx must land in a model year of at least 1 \(FND-YEAR\)\./);
    expect(() => computeModel({ ...base, funding: { rows: [{ id: "gx", label: "Bad", kind: "grant", amount: 0, year: 1 }] } })).toThrow(/Funding row gx must carry a positive amount \(FND-AMOUNT\)\./);
    expect(() => computeModel({ ...base, funding: { rows: [{ id: "gx", label: "Bad", kind: "interest-free-loan", amount: 1000000, year: 1, termYears: 0, repaymentStartYear: 4 }] } })).toThrow(/Funding row gx must carry a term and repayment start year of at least 1 \(FND-LOAN-TERM\)\./);
  });

  it("throws the funding horizon refusals with the exact strings", () => {
    const base = programFixture0610();
    try {
      computeModel({ ...base, funding: { rows: [{ id: "gx", label: "Late grant", kind: "grant", amount: 1000000, year: 40 }] } });
      expect.unreachable();
    } catch (e) {
      expect((e as EngineInputError).issues[0]).toBe("Funding row gx lands in year 40, beyond the model horizon of 276 months (FND-HORIZON).");
    }
    try {
      computeModel({ ...base, funding: { rows: [{ id: "lx", label: "Late note", kind: "interest-free-loan", amount: 1000000, year: 1, termYears: 10, repaymentStartYear: 30 }] } });
      expect.unreachable();
    } catch (e) {
      expect((e as EngineInputError).issues[0]).toBe("Funding row lx repays beyond the model horizon of 276 months (FND-LOAN-HORIZON).");
    }
  });

  it("is engine-blind when the funding block is absent (the golden no-drift class)", () => {
    const withFunding = programFixture0610();
    const withoutFunding: ModelInputs = { ...withFunding, funding: null };
    const bare = computeModel(withoutFunding);
    // The un-netted PRE figures of record (the red proof pair): the solve works against the
    // gross basis when the funding block is absent.
    expect(bare.paymentAmount).toBe(4017471.445590696);
    expect(bare.tariffYears.find((t) => t.year === 5)!.unitPrice).toBe(56717.24393775101);
    expect(bare.fundingView).toBeNull();
  });

  it("rides as cash, grid rows, and totalCollected only in profile mode (never re-solved)", () => {
    const base = programFixture0610();
    const withProfile = computeModel({
      ...base,
      tariff: { mode: "off", escalationPerYear: 0, rows: [], fixedAnnualAmount: null, manualPrices: null },
      repayment: { ...base.repayment, firstCollectionYear: null, collectionsOverrides: { 6: 34120387.26699115 } },
    });
    // The authored profile is untouched: the payment is not solved, the grants join the cash.
    expect(withProfile.paymentAmount).toBeNull();
    expect(withProfile.totalCollected).toBe(34120387.26699115 + 173500000);
    expect(withProfile.collectionsGrid.filter((x) => x.kind === "grant").length).toBe(3);
    expect(withProfile.fundingView!.grantsTotal).toBe(173500000);
    // The authored profile amount is never silently re-solved; the funding cash rides on top:
    // year 1 carries the provincial grant and the note advance, year 6 the profile less the
    // note installment, year 4 only the negative installment.
    expect(withProfile.yearly.find((y) => y.year === 1)!.inflow).toBe(13500000);
    expect(withProfile.yearly.find((y) => y.year === 4)!.inflow).toBe(-1000000);
    expect(withProfile.yearly.find((y) => y.year === 6)!.inflow).toBe(33120387.266991146);
  });
});

describe("v0.6.10 Task B — the book nets the depreciable base", () => {
  it("reproduces the netted book pins", () => {
    const r = computeModel(programFixture0610());
    const bv = r.bookView!;
    const yr = (id: string, year: number) => bv.lines.find((l) => l.id === id)!.years.find((y) => y.year === year)!;
    // p1: commissions year 4 on 57155862.35783097 (74M less AFIF and provincial), charges
    // 2857793.1178915487, re-bases at year 5 on the national share, charges 1990368.4314538508
    // for the remaining nineteen years, ending at exactly 0.
    expect(yr("p1", 4).beginning).toBe(57155862.35783097);
    expect(yr("p1", 4).charge).toBe(2857793.1178915487);
    expect(yr("p1", 5).charge).toBe(1990368.4314538508);
    expect(yr("p1", 23).ending).toBe(0);
    // p3: the re-based charge 2903101.7036785726; the ending dust pinned as spelled.
    expect(yr("p3", 5).charge).toBe(2903101.7036785726);
    expect(yr("p3", 23).ending).toBe(2.60770320892334e-8);
    // p4: commissions year 6 on 85601571.67108473 (the directive's loose 85601571.67), charges
    // 4280078.583554236; two charge years remain at the horizon (honest).
    expect(yr("p4", 6).beginning).toBe(85601571.67108473);
    expect(yr("p4", 6).charge).toBe(4280078.583554236);
    expect(yr("p4", 23).ending).toBe(8560157.16710845);
    // p6's year-23 ending book.
    expect(yr("p6", 23).ending).toBe(1298490.6943096141);
    // p2 and p5 end at 0.
    expect(yr("p2", 23).ending).toBe(0);
    expect(yr("p5", 23).ending).toBe(0);
    // The combined schedule.
    const c4 = bv.combined.find((c) => c.year === 4)!;
    const c5 = bv.combined.find((c) => c.year === 5)!;
    const c6 = bv.combined.find((c) => c.year === 6)!;
    expect(c4.charge).toBe(12230976.737442408);
    expect(c4.ending).toBe(328019023.2625576);
    expect(c5.charge).toBe(8667502.349914568);
    expect(c5.ending).toBe(254601520.91264305);
    expect(c6.charge).toBe(13596826.280623607);
    expect(bv.totalCharge).toBe(265641352.138582);
  });

  it("keeps the no-net schedule byte-identical (the golden no-drift pin)", () => {
    const inp: ModelInputs = {
      projectName: "No-drift", currency: "EUR", targetIrr: 6,
      costs: [{ id: "a", name: "Asset", category: "capex", amount: 160000000, startYear: 1, durationYears: 0, escalation: 0, depreciation: { mode: "straight-line", years: 20, startYear: 4 } }],
      repayment: { graceYears: 0, termYears: 20, paymentsPerYear: 12, paymentEscalation: 0, balloon: 0, firstCollectionYear: 4 },
      appraisal: { wacc: 4, financeRate: 3.5, reinvestmentRate: 3.5, residual: { posture: "none", amount: 0, year: 24 } },
    };
    const bv = computeModel(inp).bookView!;
    expect(bv.totalCharge).toBe(160000000);
    expect(bv.combined.find((c) => c.year === 4)!.charge).toBe(8000000);
    expect(bv.combined.find((c) => c.year === 4)!.ending).toBe(152000000);
    expect(bv.combined.find((c) => c.year === 23)!.charge).toBe(8000000);
    expect(bv.combined.find((c) => c.year === 23)!.ending).toBe(0);
  });
});

describe("v0.6.10 Task C — the tariff owns its span (W35)", () => {
  it("reproduces the independence pin (the grid keys from the span, not the repayment)", () => {
    const inp = programFixture0610();
    const r = computeModel({
      ...inp,
      repayment: { ...inp.repayment, firstCollectionYear: null, termYears: 15 },
    });
    expect(r.tariffYears[0]?.weightedVolume).toBe(400);
    expect(r.tariffYears[2]?.weightedVolume).toBe(850);
    expect(r.paymentAmount).toBe(3534782.339371078);
  });

  it("throws the coverage refusal when a slot year falls outside the grid", () => {
    const inp = programFixture0610();
    try {
      computeModel({ ...inp, repayment: { ...inp.repayment, termYears: 25 } });
      expect.unreachable();
    } catch (e) {
      // v0.6.11 Task C: the sentence re-anchored to the reworded refusal (the failing year and the declared bounds).
      expect((e as EngineInputError).issues[0]).toBe("The required collections extend to year 24, beyond the declared tariff span (years 3-23): widen the tariff span or shorten the term.");
    }
  });

  it("gates a row's volume and charge to zero outside its span; a row without a span inherits the full grid", () => {
    const inp = programFixture0610();
    const r = computeModel({
      ...inp,
      tariff: { ...inp.tariff!, rows: inp.tariff!.rows.map((row) => row.id === "r1" ? { ...row, span: { startYear: 3, termYears: 3 } } : row) },
    });
    // Year 5 is inside r1's span {3,3} (years 3..5); year 6 is outside — the 800 weighted GWh gate off.
    expect(r.tariffYears.find((t) => t.year === 5)!.weightedVolume).toBe(850);
    expect(r.tariffYears.find((t) => t.year === 6)!.weightedVolume).toBe(230);
    expect(r.tariffYears.find((t) => t.year === 6)!.perRowCharges!.r1).toBe(0);
    // The un-spanned rows inherit the full grid: r1's lift array still keys from year 3 at year 23
    // when no row span is declared (the fixture's own r1 case, weighted 1170).
    const base = computeModel(inp);
    expect(base.tariffYears.find((t) => t.year === 23)!.weightedVolume).toBe(1170);
  });

  it("derives the grid from the repayment shape unchanged when no span is declared (no-drift)", () => {
    const inp = programFixture0610();
    const r = computeModel({ ...inp, tariff: { ...inp.tariff!, span: null } });
    // The PRE derivation: repayment start year 3, term 20 — grid years 3..23, 21 columns.
    expect(r.tariffYears.length).toBe(21);
    expect(r.tariffYears[0].year).toBe(3);
    expect(r.tariffYears[20].year).toBe(23);
  });
});

describe("v0.6.10 Task D — the scenario grant-scale axis and the null cells", () => {
  it("reproduces the term-target pins with the honest null cells", () => {
    const inp = programFixture0610();
    const table = paymentVsTermTargetTable(inp, [15, 20, 25], [4, 6, 8]);
    expect(table[0]).toEqual([2876236.6840662714, 2489496.3612990044, null]);
    expect(table[1]).toEqual([3222212.0085670594, 2843365.6055825967, null]);
    expect(table[2]).toEqual([3598192.0075015617, 3233058.949475011, null]);
  });

  it("reproduces the balloon pins with the honest null cells", () => {
    const inp = programFixture0610();
    const table = paymentVsBalloonTermTable(inp, [0, 8000000, 16000000], [15, 20, 25]);
    expect(table[0]).toEqual([3222212.0085670594, 3194463.950180429, 3166715.891793798]);
    expect(table[1]).toEqual([2843365.6055825967, 2825808.1068380335, 2808250.6080934713]);
    expect(table[2]).toEqual([null, null, null]);
  });

  it("reproduces the grant-scale pins (the loan rows never scale)", () => {
    const inp = programFixture0610();
    const table = paymentVsGrantScaleTable(inp, [0, 0.5, 1], [20]);
    expect(table[0][0]).toBe(3990190.2135963826);
    expect(table[1][0]).toBe(3416777.90958949);
    expect(table[2][0]).toBe(2843365.6055825967);
    // The factor-0.5 totalCollected pin.
    const half = computeModel({ ...inp, funding: { rows: [
      { id: "g1", label: "AFIF grant (EU)", kind: "grant", amount: 35000000, year: 3 },
      { id: "g2", label: "National shore-power grant", kind: "grant", amount: 50000000, year: 5 },
      { id: "g3", label: "Province & municipality grant", kind: "grant", amount: 1750000, year: 1 },
      { id: "l1", label: "Municipality interest-free note", kind: "interest-free-loan", amount: 10000000, year: 1, termYears: 10, repaymentStartYear: 4 },
    ] } });
    expect(half.totalCollected).toBe(906776698.3014795);
  });
});
