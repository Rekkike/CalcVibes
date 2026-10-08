import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { appraisal, templateLike } from "./_shared.js";
import type { FinancingConfig, ModelInputs } from "../src/types.js";

const base = () => ({ ...templateLike(), appraisal: appraisal() });
const profile = { 3: 1000000, 4: 2000000, 5: 3000000, 6: 4000000 };
const withProfile = (): ModelInputs => ({ ...base(), repayment: { ...base().repayment, collectionsOverrides: profile } });
const fin = (): FinancingConfig => ({ enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0, serviceStartYear: null, amortization: "annuity", leveragedSolve: false, perLineSharePct: {} });

describe("COL-BYTE: byte-identity without profile or length", () => {
  it("the engine is unchanged on the seven configurations (full results at 1e-12)", () => {
    const configs: ModelInputs[] = [
      base(),
      { ...base(), costs: base().costs.map((c) => (c.id === "c1" ? { ...c, yearOverrides: { 3: 2000000 } } : c)) },
      { ...base(), costs: [...base().costs, { id: "cx", name: "Program", category: "capex", amount: 450000, startYear: 1, durationYears: 0, escalation: 0, yearOverrides: { 1: 3000000, 2: 30000000, 3: 300000000, 4: 5000000 } }] },
      { ...base(), tariff: { mode: "fixed", escalationPerYear: 2, rows: [], fixedAnnualAmount: 600000, manualPrices: null } },
      { ...base(), tariff: { mode: "stable", escalationPerYear: 2, rows: [{ id: "r1", label: "L20", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] }, { id: "r2", label: "L40", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] }], fixedAnnualAmount: null, manualPrices: null } },
      { ...base(), financing: fin() },
      { ...base(), financing: fin(), costs: base().costs.map((c) => (c.id === "c2" ? { ...c, amount: c.amount * 2 } : c)) },
    ];
    for (const cfg of configs) {
      const withEmpty = { ...cfg, repayment: { ...cfg.repayment, collectionsOverrides: {} }, projectLengthYears: null } as ModelInputs;
      const a = computeModel(withEmpty);
      const b = computeModel(cfg);
      const strip = (r: unknown) => {
        const c = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
        delete c.costGrid;
        delete c.collectionsGrid;
        return JSON.stringify(c);
      };
      expect(strip(a)).toBe(strip(b));
    }
  });
});

describe("COL-PROFILE", () => {
  it("full pin set", () => {
    const p = computeModel(withProfile());
    expect(p.paymentAmount).toBeNull();
    expect(p.paymentCount).toBeNull();
    expect(Math.abs(p.totalCost - 7849860.00)).toBeLessThan(0.01);
    expect(Math.abs(p.costNpv - 6632597.98344)).toBeLessThan(0.01);
    expect(Math.abs(p.totalCollected - 10000000.00)).toBeLessThan(0.01);
    expect(Math.abs(p.netGain - 2150140.00)).toBeLessThan(0.01);
    expect(Math.abs(p.npvAtTarget - -613263.91654)).toBeLessThan(0.01);
    expect(Math.abs(p.npvAtWacc - 79072.93640)).toBeLessThan(0.01);
    expect(Math.abs(p.npvCollectionsAtWacc - 7073140.71019)).toBeLessThan(0.01);
    expect(Math.abs(p.npvCostsAtWacc - 6994067.77379)).toBeLessThan(0.01);
    expect(Math.abs((p.profitabilityIndex as number) - 1.01131)).toBeLessThan(1e-4);
    expect(Math.abs((p.achievedIrr as number) - 0.08407705)).toBeLessThan(1e-6);
    expect(p.goalMet).toBe(false);
    expect(Math.abs((p.paybackYears as number) - 5.46247)).toBeLessThan(1e-4);
    expect(Math.abs((p.discountedPaybackYears as number) - 5.96863)).toBeLessThan(1e-4);
    expect(Math.abs((p.mirr as number) - 0.07349509)).toBeLessThan(1e-6);
    expect(p.signChanges).toBe(1);
    expect(p.irrAmbiguous).toBe(false);
    expect(p.firstPaymentMonth).toBe(25);
    expect(p.lastPaymentMonth).toBe(72);
    expect(p.monthly.length).toBe(72);
    const inflowYears = p.yearly.filter((r) => r.inflow > 0).map((r) => r.inflow);
    expect(inflowYears.length).toBe(4);
    expect(Math.abs(inflowYears[0] - 1000000.00)).toBeLessThan(0.01);
    expect(Math.abs(inflowYears[1] - 2000000.00)).toBeLessThan(0.01);
    expect(Math.abs(inflowYears[2] - 3000000.00)).toBeLessThan(0.01);
    expect(Math.abs(inflowYears[3] - 4000000.00)).toBeLessThan(0.01);
  });
});

describe("COL-IDENT / COL-ZERO / COL-ONE", () => {
  it("the spread fill equals the hand-keyed equal map (full result at 1e-12)", () => {
    const equal = { 3: 2500000, 4: 2500000, 5: 2500000, 6: 2500000 };
    const a = computeModel({ ...base(), repayment: { ...base().repayment, collectionsOverrides: equal } });
    const strip = (r: unknown) => {
      const c = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
      delete c.costGrid;
      delete c.collectionsGrid;
      return JSON.stringify(c);
    };
    expect(strip(a)).toBe(strip(computeModel({ ...base(), repayment: { ...base().repayment, collectionsOverrides: { 3: 2500000, 4: 2500000, 5: 2500000, 6: 2500000 } } })));
  });

  it("at target 0 the nominal identity: npvAtTarget exactly 2,150,140", () => {
    const equal = { 3: 2500000, 4: 2500000, 5: 2500000, 6: 2500000 };
    const z = computeModel({ ...base(), targetIrr: 0, repayment: { ...base().repayment, collectionsOverrides: equal } });
    expect(Math.abs(z.npvAtTarget - 2150140)).toBeLessThan(1e-6);
  });

  it("the exact-cost profile: netGain 0, horizon 36, IRR 0, goalMet false, gap pinned", () => {
    const one = computeModel({ ...base(), repayment: { ...base().repayment, collectionsOverrides: { 3: 7849860 } } });
    expect(one.netGain).toBe(0);
    expect(one.monthly.length).toBe(36);
    expect(one.lastPaymentMonth).toBe(36);
    expect((one.achievedIrr as number)).toBe(0);
    expect(one.goalMet).toBe(false);
    expect(Math.abs(one.npvAtTarget - -744203.81716)).toBeLessThan(0.01);
  });
});

describe("COL-BALLOON / COL-RESIDUAL / COL-FIN", () => {
  it("the balloon rides the profile end; the grid shows both rows", () => {
    const bal = computeModel({ ...base(), repayment: { ...base().repayment, balloon: 1000000, collectionsOverrides: profile } });
    expect(Math.abs(bal.totalCollected - 11000000.00)).toBeLessThan(0.01);
    expect(bal.lastPaymentMonth).toBe(72);
    expect(Math.abs(bal.npvAtTarget - -106632.79536)).toBeLessThan(0.01);
    expect(Math.abs((bal.achievedIrr as number) - 0.11414750)).toBeLessThan(1e-6);
    const profRow = bal.collectionsGrid.find((r) => r.id === "profile");
    const balRow = bal.collectionsGrid.find((r) => r.id === "balloon");
    expect(profRow).toBeTruthy();
    expect(balRow).toBeTruthy();
    expect(Math.abs((balRow as { amounts: number[] }).amounts[5] - 1000000)).toBeLessThan(0.01);
  });

  it("the residual extends the horizon", () => {
    const res = computeModel({ ...base(), appraisal: appraisal(8, 6, 6, 500000, 8), repayment: { ...base().repayment, collectionsOverrides: profile } });
    expect(Math.abs(res.totalCollected - 10500000.00)).toBeLessThan(0.01);
    expect(res.monthly.length).toBe(96);
    expect(res.lastPaymentMonth).toBe(96);
    expect(Math.abs(res.npvAtTarget - -411322.30255)).toBeLessThan(0.01);
    expect(Math.abs((res.achievedIrr as number) - 0.09706157)).toBeLessThan(1e-6);
  });

  it("financing works unchanged on the profile (cost-driven); DSCR zeros legitimate; the ambiguity flag travels", () => {
    const f = computeModel({ ...base(), financing: fin(), repayment: { ...base().repayment, collectionsOverrides: profile } });
    const z = f.financing as NonNullable<typeof f.financing>;
    expect(Math.abs(z.drawnTotal - 4709916.00)).toBeLessThan(0.01);
    expect(Math.abs(z.idc - 453213.98445)).toBeLessThan(0.01);
    expect(Math.abs(z.serviceStartBalance - 5163129.98445)).toBeLessThan(0.01);
    expect(Math.abs((z.annuityPayment as number) - 75033.07966)).toBeLessThan(0.01);
    expect(z.termMonths).toBe(84);
    expect(z.graceMonths).toBe(0);
    expect(Math.abs(z.totalService - 6302778.69134)).toBeLessThan(0.01);
    expect(Math.abs((z.dscr.find((d) => d.year === 4)?.dscr as number) - 2.22124252)).toBeLessThan(1e-4);
    expect(Math.abs((z.dscr.find((d) => d.year === 5)?.dscr as number) - 3.33186377)).toBeLessThan(1e-4);
    expect(Math.abs((z.dscr.find((d) => d.year === 6)?.dscr as number) - 4.44248503)).toBeLessThan(1e-4);
    expect(z.dscr.find((d) => d.year === 7)?.dscr).toBe(0);
    expect(z.minDscr).toEqual({ year: 7, value: 0 });
    expect(Math.abs(z.equity.outlay - 3139944.00)).toBeLessThan(0.01);
    expect(Math.abs(z.equity.npvAtWacc - 419634.24308)).toBeLessThan(0.01);
    expect(Math.abs((z.equity.irr as number) - 0.20028712)).toBeLessThan(1e-6);
    expect(Math.abs((z.equity.payback as number) - 4.49549)).toBeLessThan(1e-4);
    expect(z.equity.signChanges).toBe(2);
  });
});

describe("COL-DIR", () => {
  it("amounts x1.1 raise IRR and close the gap; the same total earlier beats the target", () => {
    const up = computeModel({ ...base(), repayment: { ...base().repayment, collectionsOverrides: { 3: 1100000, 4: 2200000, 5: 3300000, 6: 4400000 } } });
    expect(Math.abs((up.achievedIrr as number) - 0.11935528)).toBeLessThan(1e-6);
    expect(Math.abs(up.npvAtTarget - -11330.50985)).toBeLessThan(0.01);
    const early = computeModel({ ...base(), repayment: { ...base().repayment, collectionsOverrides: { 3: 4000000, 4: 3000000, 5: 2000000, 6: 1000000 } } });
    expect(Math.abs((early.achievedIrr as number) - 0.12911781)).toBeLessThan(1e-6);
    expect(Math.abs(early.npvAtTarget - 107100.20913)).toBeLessThan(0.01);
    expect(early.goalMet).toBe(true);
  });
});

describe("COL-VALID", () => {
  it("each construct surfaces its named error", () => {
    expect(() => computeModel({ ...base(), repayment: { ...base().repayment, collectionsOverrides: { 3: 0 } } })).toThrowError(/COL-PROFILE-AMOUNT/);
    expect(() => computeModel({ ...base(), repayment: { ...base().repayment, collectionsOverrides: { 3: -5 } } })).toThrowError(/COL-PROFILE-AMOUNT/);
    expect(() => computeModel({ ...base(), repayment: { ...base().repayment, collectionsOverrides: { 2.5: 100 } } })).toThrowError(/COL-PROFILE-YEAR/);
    expect(() => computeModel({ ...base(), repayment: { ...base().repayment, collectionsOverrides: { 0: 100 } } })).toThrowError(/COL-PROFILE-YEAR/);
    expect(() => computeModel({ ...base(), tariff: { mode: "fixed", escalationPerYear: 2, rows: [], fixedAnnualAmount: 600000, manualPrices: null }, repayment: { ...base().repayment, collectionsOverrides: profile } })).toThrowError(/COL-TARIFF-CONFLICT/);
    expect(() => computeModel({ ...base(), financing: { ...fin(), leveragedSolve: true }, repayment: { ...base().repayment, collectionsOverrides: profile } })).toThrowError(/FIN-LEVERAGED-PROFILE/);
  });

  it("the tables and solveTerm refuse under a profile (the fifth construct, SCE-PROFILE)", async () => {
    const { paymentVsTermTargetTable, paymentVsBalloonTermTable } = await import("../src/scenarios.js");
    const { solveTerm } = await import("../src/engine.js");
    const msg = "The payment sensitivity tables require the solved payment stream; they do not apply while a collections profile is present (SCE-PROFILE).";
    expect(() => paymentVsTermTargetTable(withProfile(), [5, 7, 9], [8, 12, 16])).toThrowError(/SCE-PROFILE/);
    expect(() => paymentVsBalloonTermTable(withProfile(), [0, 1000000], [5, 7, 9])).toThrowError(/SCE-PROFILE/);
    expect(() => solveTerm(withProfile(), 400000)).toThrowError(/SCE-PROFILE/);
    const msgTable = (() => { try { paymentVsTermTargetTable(withProfile(), [5], [8]); return ""; } catch (e) { return (e as Error).message; } })();
    expect(msgTable).toContain(msg);
    // unchanged: the named scenario sets and the tornado keep working under profile mode
    const { scenarioResults, tornado } = await import("../src/scenarios.js");
    expect(() => scenarioResults(withProfile())).not.toThrow();
    expect(() => tornado(withProfile())).not.toThrow();
  });
});

describe("PROJ-LEN battery", () => {
  it("PROJ-LEN-BYTE: length 10 equals derived (every field at 1e-12; grids stripped as additive)", () => {
    const len10 = computeModel({ ...base(), projectLengthYears: 10 });
    const plain = computeModel(base());
    const strip = (r: unknown) => {
      const c = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
      delete c.costGrid;
      delete c.collectionsGrid;
      return JSON.stringify(c);
    };
    expect(strip(len10)).toBe(strip(plain));
  });

  it("PROJ-LEN-EXT: length 12 extends to 144 months, 12 rows; only mirr moves", () => {
    const len12 = computeModel({ ...base(), projectLengthYears: 12 });
    const plain = computeModel(base());
    expect(len12.monthly.length).toBe(144);
    expect(len12.yearly.length).toBe(12);
    expect(Math.abs((len12.mirr as number) - 0.08292457)).toBeLessThan(1e-6);
    expect(Math.abs((plain.mirr as number) - 0.08756864)).toBeLessThan(1e-6);
    expect(Math.abs(len12.totalCost - plain.totalCost)).toBeLessThan(1e-12);
    expect(Math.abs(len12.costNpv - plain.costNpv)).toBeLessThan(1e-12);
    expect(Math.abs(len12.totalCollected - plain.totalCollected)).toBeLessThan(1e-12);
    expect(Math.abs(len12.netGain - plain.netGain)).toBeLessThan(1e-12);
    expect(Math.abs(len12.npvAtTarget - plain.npvAtTarget)).toBeLessThan(1e-12);
    expect(Math.abs(len12.npvAtWacc - plain.npvAtWacc)).toBeLessThan(1e-12);
  });

  it("PROJ-LEN-EXCEEDED names each offender", () => {
    expect(() => computeModel({ ...base(), projectLengthYears: 9 })).toThrowError(/the repayment schedule ends at month 120/);
    expect(() => computeModel({ ...base(), projectLengthYears: 2 })).toThrowError(/the cost program ends at month 36; the repayment schedule ends at month 120/);
    expect(() => computeModel({ ...base(), projectLengthYears: 5, repayment: { ...base().repayment, collectionsOverrides: profile } })).toThrowError(/the collections profile ends at month 72/);
  });

  it("PROJ-VALID: 0 and 2.5 surface PROJ-LENGTH-INVALID", () => {
    expect(() => computeModel({ ...base(), projectLengthYears: 0 })).toThrowError(/PROJ-LENGTH-INVALID/);
    expect(() => computeModel({ ...base(), projectLengthYears: 2.5 })).toThrowError(/PROJ-LENGTH-INVALID/);
  });
});

describe("GRID battery", () => {
  it("GRID-BASE: the template grids pinned", () => {
    const t = computeModel(base());
    const g = (id: string) => t.costGrid.find((r) => r.id === id)?.amounts;
    expect(g("c1")?.slice(0, 3)).toEqual([1800000, 1854000, 1909620]);
    expect(g("c2")?.slice(0, 3)).toEqual([600000, 612000, 624240]);
    expect(g("c3")).toEqual([450000, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const ps = t.collectionsGrid.find((r) => r.id === "payments")?.amounts;
    expect(ps).toBeTruthy();
    expect(Math.abs((ps as number[])[2] - 475309.13407)).toBeLessThan(0.01);
    for (const i of [3, 4, 5, 6, 7, 8]) {
      expect(Math.abs((ps as number[])[i] - 1901236.53628)).toBeLessThan(0.01);
    }
    expect(Math.abs((ps as number[])[9] - 1425927.40221)).toBeLessThan(0.01);
  });

  it("GRID-PROFILE: the profile-mode grid rows", () => {
    const p = computeModel(withProfile());
    const prof = p.collectionsGrid.find((r) => r.id === "profile");
    expect(prof?.amounts.slice(0, 6)).toEqual([0, 0, 1000000, 2000000, 3000000, 4000000]);
  });

  it("GRID-RECON: the five identities at 1e-6 across four configurations", () => {
    const configs: ModelInputs[] = [
      base(),
      withProfile(),
      { ...base(), maintenance: { mode: "percent", percentPerYear: 0.5 }, operatingLines: [{ id: "o1", label: "Rent", amount: 120000, startYear: 3, yearCount: 8, escalation: 0 }] },
      { ...base(), tariff: { mode: "fixed", escalationPerYear: 2, rows: [], fixedAnnualAmount: 600000, manualPrices: null } },
    ];
    for (const cfg of configs) {
      const r = computeModel(cfg);
      const years = r.yearly.length;
      for (let k = 0; k < years; k++) {
        const costSum = r.costGrid.reduce((a, row) => a + row.amounts[k], 0);
        expect(Math.abs(costSum - r.yearly[k].cost)).toBeLessThan(1e-6);
        const colSum = r.collectionsGrid.reduce((a, row) => a + row.amounts[k], 0);
        expect(Math.abs(colSum - r.yearly[k].inflow)).toBeLessThan(1e-6);
      }
      for (const row of r.costGrid) {
        const rowSum = row.amounts.reduce((a, b) => a + b, 0);
        if (row.kind === "cost") {
          const lt = r.lineTotals.find((l) => l.id === row.id);
          expect(Math.abs(rowSum - (lt as { total: number }).total)).toBeLessThan(1e-6);
        } else if (row.kind === "operating") {
          const o = r.operatingLines.find((l) => l.id === row.id);
          expect(Math.abs(rowSum - (o as { total: number }).total)).toBeLessThan(1e-6);
        }
      }
      const costGrand = r.costGrid.reduce((a, row) => a + row.amounts.reduce((x, y) => x + y, 0), 0);
      expect(Math.abs(costGrand - r.totalCost)).toBeLessThan(1e-6);
      const colGrand = r.collectionsGrid.reduce((a, row) => a + row.amounts.reduce((x, y) => x + y, 0), 0);
      expect(Math.abs(colGrand - r.totalCollected)).toBeLessThan(1e-6);
    }
  });
});
