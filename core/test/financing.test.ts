import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { appraisal, templateLike } from "./_shared.js";
import type { FinancingConfig, TariffRow } from "../src/types.js";

const base = () => ({ ...templateLike(), appraisal: appraisal() });
const fin = (over: Partial<FinancingConfig> = {}): FinancingConfig => ({
  enabled: true, sharePct: 60, debtRatePct: 6, termYears: 7, graceYears: 0,
  serviceStartYear: null, amortization: "annuity", leveragedSolve: false, perLineSharePct: {}, ...over,
});
const rows: TariffRow[] = [
  { id: "r1", label: "Loaded 20-ft", weight: 1, lifts: [400, 800, 800, 800, 800, 800, 800, 600] },
  { id: "r2", label: "Loaded 40-ft", weight: 2, lifts: [150, 300, 300, 300, 300, 300, 300, 225] },
];
const strip = (o: unknown) => {
  const c = JSON.parse(JSON.stringify(o)) as Record<string, unknown>;
  delete c.financing;
  delete c.leveragedSolve;
  delete c.horizon;
  delete c.contractsInfo;
  delete c.bookView;
  delete c.termPositions;
  delete c.residualAmountUsed;
  return c;
};

describe("FN-0 overlay identity", () => {
  it("every project field equals the financing-off result byte for byte", () => {
    const off = computeModel(base());
    const on = computeModel({ ...base(), financing: fin() });
    expect(JSON.stringify(strip(on))).toBe(JSON.stringify(strip(off)));
    expect(Math.abs((on.paymentAmount as number) - 475309.13407)).toBeLessThan(0.01);
    expect(on.lastPaymentMonth).toBe(117);
    expect(on.monthly.length).toBe(120);
  });
});

describe("FN-0b share 0 degenerate", () => {
  it("no error; zero debt; equity metrics equal the project metrics", () => {
    const r = computeModel({ ...base(), financing: fin({ sharePct: 0 }) });
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(z.drawnTotal).toBe(0);
    expect(z.serviceStartBalance).toBe(0);
    expect(z.minDscr).toBeNull();
    expect(z.equity.outlay).toBe(7849860);
    expect(Math.abs(z.equity.npvAtWacc - 1252822.99465)).toBeLessThan(0.01);
    expect(Math.abs((z.equity.payback as number) - 6.95960606)).toBeLessThan(1e-4);
    expect(Math.abs((z.equity.irr as number) - 0.12)).toBeLessThan(1e-6);
    expect(z.equity.signChanges).toBe(1);
  });
});

describe("FN-1 annuity debt", () => {
  it("full structure, service, DSCR, and equity pins", () => {
    const r = computeModel({ ...base(), financing: fin() });
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(Math.abs(z.drawnTotal - 4709916.00000)).toBeLessThan(0.01);
    expect(Math.abs(z.idc - 453213.98445)).toBeLessThan(0.01);
    expect(Math.abs(z.serviceStartBalance - 5163129.98445)).toBeLessThan(0.01);
    expect(z.serviceStartMonth + 1).toBe(37);
    expect(z.serviceStartMonth + z.termMonths).toBe(120);
    expect(Math.abs((z.annuityPayment as number) - 75033.07966)).toBeLessThan(0.01);
    expect(Math.abs(z.totalInterest - 1139648.70690)).toBeLessThan(0.01);
    expect(Math.abs(z.totalService - 6302778.69134)).toBeLessThan(0.01);
    expect(Math.abs(z.monthly.balance[119])).toBeLessThan(1e-6);
    const y4 = z.yearly.find((y) => y.year === 4) as { interest: number; principal: number; service: number };
    expect(Math.abs(y4.interest - 285287.37197)).toBeLessThan(0.01);
    expect(Math.abs(y4.principal - 615109.58394)).toBeLessThan(0.01);
    expect(Math.abs(y4.service - 900396.95591)).toBeLessThan(0.01);
    const y10 = z.yearly.find((y) => y.year === 10) as { interest: number; principal: number; service: number };
    expect(Math.abs(y10.interest - 27852.25496)).toBeLessThan(0.01);
    expect(Math.abs(y10.principal - 872544.70095)).toBeLessThan(0.01);
    expect(Math.abs(y10.service - 900396.95591)).toBeLessThan(0.01);
    for (const y of [4, 5, 6, 7, 8, 9]) {
      expect(Math.abs((z.dscr.find((d) => d.year === y)?.dscr as number) - 2.1115537140)).toBeLessThan(1e-4);
    }
    expect(Math.abs((z.dscr.find((d) => d.year === 10)?.dscr as number) - 1.5836652855)).toBeLessThan(1e-4);
    expect(z.minDscr?.year).toBe(10);
    expect(Math.abs((z.minDscr?.value as number) - 1.5836652855)).toBeLessThan(1e-4);
    for (const y of [1, 2, 3]) {
      expect(z.dscr.find((d) => d.year === y)?.dscr).toBeNull();
    }
    expect(Math.abs(z.equity.outlay - 3139944.00000)).toBeLessThan(0.01);
    expect(Math.abs(z.equity.npvAtWacc - 1593384.30133)).toBeLessThan(0.01);
    expect(Math.abs(z.equity.npvAtTarget - 897141.38183)).toBeLessThan(0.01);
    expect(Math.abs((z.equity.payback as number) - 5.7317471844)).toBeLessThan(1e-4);
    expect(z.equity.signChanges).toBe(56);
    expect(z.equity.irrAmbiguous).toBe(true);
    expect(Math.abs((z.equity.irr as number) - 0.2000612172)).toBeLessThan(1e-6);
  });
});

describe("FN-2 equal-principal", () => {
  it("structure, DSCR, and equity pins", () => {
    const r = computeModel({ ...base(), financing: fin({ amortization: "equal-principal" }) });
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(Math.abs(z.serviceStartBalance - 5163129.98445)).toBeLessThan(0.01);
    expect(Math.abs(z.monthly.service[36] - 86597.62942)).toBeLessThan(0.01);
    expect(Math.abs(z.monthly.service[119] - 61765.02120)).toBeLessThan(0.01);
    expect(Math.abs(z.totalInterest - 1068101.34168)).toBeLessThan(0.01);
    expect(Math.abs(z.totalService - 6231231.32613)).toBeLessThan(0.01);
    expect(Math.abs((z.dscr.find((d) => d.year === 4)?.dscr as number) - 1.8650084822)).toBeLessThan(1e-4);
    expect(Math.abs((z.dscr.find((d) => d.year === 9)?.dscr as number) - 2.3646933982)).toBeLessThan(1e-4);
    expect(Math.abs((z.dscr.find((d) => d.year === 10)?.dscr as number) - 1.8739353822)).toBeLessThan(1e-4);
    expect(z.minDscr?.year).toBe(4);
    expect(Math.abs((z.minDscr?.value as number) - 1.8650084822)).toBeLessThan(1e-4);
    expect(Math.abs(z.equity.outlay - 3139944.00000)).toBeLessThan(0.01);
    expect(Math.abs(z.equity.npvAtWacc - 1579461.41170)).toBeLessThan(0.01);
    expect(Math.abs(z.equity.npvAtTarget - 864594.56666)).toBeLessThan(0.01);
    expect(Math.abs((z.equity.payback as number) - 5.9770262987)).toBeLessThan(1e-4);
    expect(z.equity.signChanges).toBe(56);
    expect(Math.abs((z.equity.irr as number) - 0.1944427777)).toBeLessThan(1e-6);
  });
});

describe("FN-3 annuity with grace 2", () => {
  it("grace service, DSCR, and equity pins", () => {
    const r = computeModel({ ...base(), financing: fin({ graceYears: 2 }) });
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(Math.abs(z.serviceStartBalance - 5163129.98445)).toBeLessThan(0.01);
    expect(Math.abs(z.monthly.service[36] - 25131.79627)).toBeLessThan(0.01);
    expect(Math.abs(z.monthly.service[60] - 99436.63287)).toBeLessThan(0.01);
    expect(Math.abs(z.totalInterest - 1406231.09814)).toBeLessThan(0.01);
    expect(Math.abs((z.dscr.find((d) => d.year === 4)?.dscr as number) - 6.3042202114)).toBeLessThan(1e-4);
    expect(Math.abs((z.dscr.find((d) => d.year === 6)?.dscr as number) - 1.5933401349)).toBeLessThan(1e-4);
    expect(Math.abs((z.dscr.find((d) => d.year === 10)?.dscr as number) - 1.1950051012)).toBeLessThan(1e-4);
    expect(z.minDscr?.year).toBe(10);
    expect(Math.abs((z.minDscr?.value as number) - 1.1950051012)).toBeLessThan(1e-4);
    expect(Math.abs(z.equity.npvAtWacc - 1647190.59410)).toBeLessThan(0.01);
    expect(Math.abs((z.equity.payback as number) - 4.7250540251)).toBeLessThan(1e-4);
    expect(z.equity.signChanges).toBe(56);
    expect(Math.abs((z.equity.irr as number) - 0.2268184480)).toBeLessThan(1e-6);
  });
});

describe("FN-4 per-line override", () => {
  it("drawn, structure, DSCR, and equity pins", () => {
    const r = computeModel({ ...base(), financing: fin({ perLineSharePct: { c1: 80 } }) });
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(Math.abs(z.drawnTotal - 5822640.00000)).toBeLessThan(0.01);
    expect(Math.abs(z.idc - 557949.46866)).toBeLessThan(0.01);
    expect(Math.abs(z.serviceStartBalance - 6380589.46866)).toBeLessThan(0.01);
    expect(Math.abs((z.annuityPayment as number) - 92725.78442)).toBeLessThan(0.01);
    expect(Math.abs(z.totalInterest - 1408376.42265)).toBeLessThan(0.01);
    expect(Math.abs(z.totalService - 7788965.89131)).toBeLessThan(0.01);
    expect(Math.abs((z.dscr.find((d) => d.year === 4)?.dscr as number) - 1.7086550307)).toBeLessThan(1e-4);
    expect(Math.abs((z.dscr.find((d) => d.year === 10)?.dscr as number) - 1.2814912730)).toBeLessThan(1e-4);
    expect(z.minDscr?.year).toBe(10);
    expect(Math.abs((z.minDscr?.value as number) - 1.2814912730)).toBeLessThan(1e-4);
    expect(Math.abs(z.equity.outlay - 2027220.00000)).toBeLessThan(0.01);
    expect(Math.abs(z.equity.npvAtWacc - 1673100.09961)).toBeLessThan(0.01);
    expect(Math.abs((z.equity.payback as number) - 4.9945233327)).toBeLessThan(1e-4);
    expect(z.equity.signChanges).toBe(56);
    expect(Math.abs((z.equity.irr as number) - 0.2654462074)).toBeLessThan(1e-6);
  });
});

describe("FN-5 share 100 (zero equity outlay)", () => {
  it("full debt; null equity IRR with the zero-outlay flag; the boundary lesson", () => {
    const r = computeModel({ ...base(), financing: fin({ sharePct: 100 }) });
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(Math.abs(z.drawnTotal - 7849860.00000)).toBeLessThan(0.01);
    expect(Math.abs(z.idc - 755356.64075)).toBeLessThan(0.01);
    expect(Math.abs(z.serviceStartBalance - 8605216.64075)).toBeLessThan(0.01);
    expect(Math.abs((z.annuityPayment as number) - 125055.13276)).toBeLessThan(0.01);
    expect(Math.abs((z.dscr.find((d) => d.year === 4)?.dscr as number) - 1.2669322284)).toBeLessThan(1e-4);
    expect(Math.abs((z.dscr.find((d) => d.year === 10)?.dscr as number) - 0.9501991713)).toBeLessThan(1e-4);
    expect(z.minDscr?.year).toBe(10);
    expect(Math.abs((z.minDscr?.value as number) - 0.9501991713)).toBeLessThan(1e-4);
    expect(z.equity.outlay).toBe(0);
    expect(z.equity.zeroOutlay).toBe(true);
    expect(z.equity.irr).toBeNull();
    expect(z.equity.signChanges).toBe(55);
    expect(Math.abs(z.equity.npvAtWacc - 1820425.17244)).toBeLessThan(0.01);
    expect(Math.abs((z.equity.payback as number) - 2.9166666667)).toBeLessThan(1e-4);
  });
});

describe("FN-6 leveraged annuity solve", () => {
  it("P_L, debt structure identity, verification, and project fields", () => {
    const r = computeModel({ ...base(), financing: fin({ leveragedSolve: true }) });
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(Math.abs((r.paymentAmount as number) - 411017.66120)).toBeLessThan(0.01);
    expect((r.paymentAmount as number)).toBeLessThan(475309.13407);
    expect(Math.abs(z.drawnTotal - 4709916.00000)).toBeLessThan(0.01);
    expect(Math.abs(z.serviceStartBalance - 5163129.98445)).toBeLessThan(0.01);
    expect(Math.abs((z.annuityPayment as number) - 75033.07966)).toBeLessThan(0.01);
    expect(Math.abs(z.equity.npvAtTarget)).toBeLessThan(1e-6);
    expect(Math.abs((z.equity.irr as number) - 0.12)).toBeLessThan(1e-6);
    expect(z.equity.signChanges).toBe(56);
    expect(z.equity.irrAmbiguous).toBe(true);
    expect(Math.abs(r.totalCollected - 11508494.51360)).toBeLessThan(0.01);
    expect(Math.abs((r.achievedIrr as number) - 0.08459148)).toBeLessThan(1e-6);
    expect(z.minDscr?.year).toBe(10);
    expect(Math.abs((z.minDscr?.value as number) - 1.3694548560)).toBeLessThan(1e-4);
    expect(Math.abs(z.equity.npvAtWacc - 477889.73973)).toBeLessThan(0.01);
    expect(Math.abs((z.equity.payback as number) - 6.7351555702)).toBeLessThan(1e-4);
    expect(r.leveragedSolve).toBe(true);
  });

  it("decompose + leveraged: the decompose payment equals P_L", () => {
    const dec = computeModel({ ...base(), tariff: { mode: "decompose", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null }, financing: fin({ leveragedSolve: true }) });
    expect(Math.abs((dec.paymentAmount as number) - 411017.66120)).toBeLessThan(0.01);
  });
});

describe("FN-6b leveraged at debt rate 15%", () => {
  it("P_L strictly above the project-basis payment and above the 6% figure", () => {
    const r = computeModel({ ...base(), financing: fin({ leveragedSolve: true, debtRatePct: 15 }) });
    expect(Math.abs((r.paymentAmount as number) - 515911.95792)).toBeLessThan(0.01);
    expect((r.paymentAmount as number)).toBeGreaterThan(475309.13407);
    expect((r.paymentAmount as number)).toBeGreaterThan(411017.66120);
  });
});

describe("FN-7 leveraged stable-tariff solve", () => {
  it("base_L, clean-vector verification, and project fields", () => {
    const r = computeModel({ ...base(), tariff: { mode: "stable", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null }, financing: fin({ leveragedSolve: true }) });
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(Math.abs((r.tariffBaseUnitPrice as number) - 1041.3509366)).toBeLessThan(1e-4);
    expect(Math.abs(z.drawnTotal - 4709916.00000)).toBeLessThan(0.01);
    expect(Math.abs(z.serviceStartBalance - 5163129.98445)).toBeLessThan(0.01);
    expect(Math.abs(z.equity.npvAtTarget)).toBeLessThan(1e-6);
    expect(Math.abs((z.equity.irr as number) - 0.12)).toBeLessThan(1e-6);
    expect(z.equity.signChanges).toBe(1);
    expect(z.equity.irrAmbiguous).toBe(false);
    expect(Math.abs(r.totalCollected - 11365425.63391)).toBeLessThan(0.01);
    expect(Math.abs((r.achievedIrr as number) - 0.08364010)).toBeLessThan(1e-6);
    expect(z.minDscr?.year).toBe(10);
    expect(Math.abs((z.minDscr?.value as number) - 1.3949337928)).toBeLessThan(1e-4);
    expect(Math.abs(z.equity.npvAtWacc - 446507.98695)).toBeLessThan(0.01);
    expect(Math.abs((z.equity.payback as number) - 6.8281653337)).toBeLessThan(1e-4);
  });
});

describe("FN-8 stable-tariff overlay (no leveraged toggle)", () => {
  it("overlay identity and clean-vector equity pins", () => {
    const r = computeModel({ ...base(), tariff: { mode: "stable", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null }, financing: fin() });
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(Math.abs((r.tariffBaseUnitPrice as number) - 1204.2392789)).toBeLessThan(1e-4);
    expect(Math.abs(z.equity.outlay - 3139944.00000)).toBeLessThan(0.01);
    expect(Math.abs((z.equity.irr as number) - 0.2054328506)).toBeLessThan(1e-6);
    expect(z.equity.signChanges).toBe(1);
    expect(Math.abs(z.equity.npvAtWacc - 1557093.80788)).toBeLessThan(0.01);
    expect(Math.abs((z.equity.payback as number) - 5.7022036389)).toBeLessThan(1e-4);
    expect(Math.abs((z.dscr.find((d) => d.year === 4)?.dscr as number) - 1.9098839451)).toBeLessThan(1e-4);
    expect(Math.abs((z.dscr.find((d) => d.year === 9)?.dscr as number) - 2.1086662002)).toBeLessThan(1e-4);
    expect(Math.abs((z.dscr.find((d) => d.year === 10)?.dscr as number) - 1.6131296431)).toBeLessThan(1e-4);
    expect(z.minDscr?.year).toBe(10);
    expect(Math.abs((z.minDscr?.value as number) - 1.6131296431)).toBeLessThan(1e-4);
    for (const y of [1, 2, 3]) {
      expect(z.dscr.find((d) => d.year === y)?.dscr).toBeNull();
    }
  });
});

describe("Directionals D-1..D-6", () => {
  it("D-1: equity IRR strictly increasing in the debt share on the clean vector", () => {
    const mk = (share: number) => computeModel({ ...base(), tariff: { mode: "stable", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null }, financing: fin({ sharePct: share }) });
    const s40 = (mk(40).financing as NonNullable<ReturnType<typeof computeModel>["financing"]>).equity.irr as number;
    const s60 = (mk(60).financing as NonNullable<ReturnType<typeof computeModel>["financing"]>).equity.irr as number;
    const s80 = (mk(80).financing as NonNullable<ReturnType<typeof computeModel>["financing"]>).equity.irr as number;
    expect(Math.abs(s40 - 0.1583890224)).toBeLessThan(1e-6);
    expect(Math.abs(s60 - 0.2054328506)).toBeLessThan(1e-6);
    expect(Math.abs(s80 - 0.3407759281)).toBeLessThan(1e-6);
    expect(s40).toBeLessThan(s60);
    expect(s60).toBeLessThan(s80);
  });

  it("D-2: equity IRR strictly decreasing in the debt rate", () => {
    const r = computeModel({ ...base(), tariff: { mode: "stable", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: null }, financing: fin({ debtRatePct: 15 }) });
    const irr = (r.financing as NonNullable<ReturnType<typeof computeModel>["financing"]>).equity.irr as number;
    expect(Math.abs(irr - 0.0517367772)).toBeLessThan(1e-6);
    expect(irr).toBeLessThan(0.2054328506);
  });

  it("D-3: total interest ordering at the same B_S", () => {
    const ep = (computeModel({ ...base(), financing: fin({ amortization: "equal-principal" }) }).financing as NonNullable<ReturnType<typeof computeModel>["financing"]>).totalInterest;
    const an = (computeModel({ ...base(), financing: fin() }).financing as NonNullable<ReturnType<typeof computeModel>["financing"]>).totalInterest;
    const gr = (computeModel({ ...base(), financing: fin({ graceYears: 2 }) }).financing as NonNullable<ReturnType<typeof computeModel>["financing"]>).totalInterest;
    expect(ep).toBeLessThan(an);
    expect(an).toBeLessThan(gr);
    expect(Math.abs(ep - 1068101.34168)).toBeLessThan(0.01);
    expect(Math.abs(an - 1139648.70690)).toBeLessThan(0.01);
    expect(Math.abs(gr - 1406231.09814)).toBeLessThan(0.01);
  });

  it("D-4: minimum DSCR strictly decreasing in share", () => {
    const m1 = (computeModel({ ...base(), financing: fin() }).financing as NonNullable<ReturnType<typeof computeModel>["financing"]>).minDscr;
    const m2 = (computeModel({ ...base(), financing: fin({ sharePct: 100 }) }).financing as NonNullable<ReturnType<typeof computeModel>["financing"]>).minDscr;
    expect((m1 as { value: number }).value).toBeGreaterThan((m2 as { value: number }).value);
  });

  it("D-5: leveraged payment strictly increasing in the debt rate", () => {
    const p6 = computeModel({ ...base(), financing: fin({ leveragedSolve: true }) }).paymentAmount as number;
    const p15 = computeModel({ ...base(), financing: fin({ leveragedSolve: true, debtRatePct: 15 }) }).paymentAmount as number;
    expect(p6).toBeLessThan(475309.13407);
    expect(475309.13407).toBeLessThan(p15);
  });

  it("D-6: grace up => equity IRR up and equity payback down", () => {
    const g0 = computeModel({ ...base(), financing: fin() }).financing as NonNullable<ReturnType<typeof computeModel>["financing"]>;
    const g2 = computeModel({ ...base(), financing: fin({ graceYears: 2 }) }).financing as NonNullable<ReturnType<typeof computeModel>["financing"]>;
    expect((g2.equity.irr as number)).toBeGreaterThan(g0.equity.irr as number);
    expect((g2.equity.payback as number)).toBeLessThan(g0.equity.payback as number);
  });
});

describe("Boundary cases B-1..B-3", () => {
  it("B-1 term 1", () => {
    const r = computeModel({ ...base(), financing: fin({ termYears: 1 }) });
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(z.serviceStartMonth + 1).toBe(37);
    expect(z.serviceStartMonth + z.termMonths).toBe(48);
    expect(Math.abs((z.annuityPayment as number) - 443995.06752)).toBeLessThan(0.01);
    expect(Math.abs(z.totalInterest - 164810.82580)).toBeLessThan(0.01);
    expect(z.minDscr?.year).toBe(4);
    expect(Math.abs((z.minDscr?.value as number) - 0.3568426535)).toBeLessThan(1e-4);
    expect(Math.abs((z.equity.payback as number) - 7.2346276180)).toBeLessThan(1e-4);
  });

  it("B-2 grace 6 = term - 1", () => {
    const r = computeModel({ ...base(), financing: fin({ graceYears: 6 }) });
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(Math.abs(z.monthly.service[36] - 25131.79627)).toBeLessThan(0.01);
    expect(Math.abs(z.monthly.service[107] - 25131.79627)).toBeLessThan(0.01);
    expect(Math.abs(z.monthly.service[108] - 443995.06752)).toBeLessThan(0.01);
    expect(Math.abs(z.monthly.service[119] - 443995.06752)).toBeLessThan(0.01);
    expect(Math.abs(z.totalInterest - 1974300.15758)).toBeLessThan(0.01);
    expect(z.minDscr?.year).toBe(10);
    expect(Math.abs((z.minDscr?.value as number) - 0.2676319901)).toBeLessThan(1e-4);
    expect(Math.abs((z.equity.payback as number) - 4.7250540251)).toBeLessThan(1e-4);
  });

  it("B-3 debt rate 0 degenerates to straight-line", () => {
    const r = computeModel({ ...base(), financing: fin({ debtRatePct: 0 }) });
    const z = r.financing as NonNullable<typeof r.financing>;
    expect(z.idc).toBe(0);
    expect(Math.abs(z.serviceStartBalance - 4709916.00000)).toBeLessThan(0.01);
    expect(Math.abs((z.annuityPayment as number) - 56070.42857)).toBeLessThan(0.01);
    expect(z.totalInterest).toBe(0);
    expect(Math.abs((z.dscr.find((d) => d.year === 4)?.dscr as number) - 2.8256673270)).toBeLessThan(1e-4);
  });
});

describe("Validation rules FIN-*", () => {
  const tryFin = (over: Partial<FinancingConfig>) => computeModel({ ...base(), financing: fin(over) });

  it("FIN-SHARE-RANGE", () => {
    expect(() => tryFin({ sharePct: 150 })).toThrowError(/sharePct/);
    expect(() => tryFin({ sharePct: -10 })).toThrowError(/sharePct/);
  });
  it("FIN-SHARE-LINE-RANGE", () => {
    expect(() => tryFin({ perLineSharePct: { c1: 120 } })).toThrowError(/per-line share for line c1/);
  });
  it("FIN-RATE-LOWER", () => {
    expect(() => tryFin({ debtRatePct: -100 })).toThrowError(/debtRatePct/);
    expect(() => tryFin({ debtRatePct: -150 })).toThrowError(/debtRatePct/);
  });
  it("FIN-TERM-MIN (collect-all; grace may co-fire)", () => {
    expect(() => tryFin({ termYears: 0 })).toThrowError(/termYears must be at least 1/);
  });
  it("FIN-GRACE-LT-TERM", () => {
    expect(() => tryFin({ graceYears: 7 })).toThrowError(/graceYears/);
    expect(() => tryFin({ graceYears: 8 })).toThrowError(/graceYears/);
  });
  it("FIN-START-IN-HORIZON", () => {
    expect(() => tryFin({ serviceStartYear: 11 })).toThrowError(/horizon/);
    expect(() => tryFin({ serviceStartYear: 10 })).toThrowError(/horizon/);
    expect(() => tryFin({ serviceStartYear: 3 })).not.toThrow();
  });
  it("FIN-FUNDABLE-AFTER-START", () => {
    expect(() => tryFin({ serviceStartYear: 2 })).toThrowError(/FIN-FUNDABLE-AFTER-START/);
  });
  it("FIN-LEVERAGED-MODE", () => {
    expect(() => computeModel({ ...base(), tariff: { mode: "manual", escalationPerYear: 2, rows, fixedAnnualAmount: null, manualPrices: [1, 2, 3, 4, 5, 6, 7, 8] }, financing: fin({ leveragedSolve: true }) })).toThrowError(/FIN-LEVERAGED-MODE/);
    expect(() => computeModel({ ...base(), tariff: { mode: "fixed", escalationPerYear: 2, rows, fixedAnnualAmount: 600000, manualPrices: null }, financing: fin({ leveragedSolve: true }) })).toThrowError(/FIN-LEVERAGED-MODE/);
  });
});
