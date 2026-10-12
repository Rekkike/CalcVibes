import { describe, expect, it } from "vitest";
import { computeModel } from "../src/engine.js";
import { demoProject, multiLeaseProject } from "../../web/src/state.js";
import type { ModelInputs } from "../src/types.js";

// v0.6.5 Task D (W17): the contract-aware collections grid. In contracts mode the grid carries
// one row per contract, built from that contract's slots with its payment; the legacy
// dormant-slot row is gone for contracts mode, and the legacy (non-contracts) path is
// byte-identical to the pre-change output.

const fixCPortfolio = (): ModelInputs => {
  const demo = demoProject();
  return {
    ...demo,
    repayment: { ...demo.repayment, termYears: 7, paymentsPerYear: 1 },
    contracts: [
      { id: "k1", label: "Anchor tenant", startYear: 4, termYears: 29, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "evaluated", evaluatedPayment: 1000000 },
      { id: "k2", label: "Top-up", startYear: 4, termYears: 3, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 0, mode: "solved" },
    ],
  } as ModelInputs;
};

describe("v0.6.5 Task D: the contract-aware collections grid", () => {
  it("ML-ROWS: the multi-lease grid carries one row per contract named by its label, plus the unchanged residual", () => {
    const r = computeModel(multiLeaseProject() as ModelInputs);
    expect(r.collectionsGrid.map((row) => ({ id: row.id, name: row.name, kind: row.kind }))).toEqual([
      { id: "k1", name: "Contract one", kind: "contract" },
      { id: "k2", name: "Contract two", kind: "contract" },
      { id: "k3", name: "Lease three", kind: "contract" },
      { id: "residual", name: "Residual", kind: "residual" },
    ]);
  });

  it("ML-SUMS: the contract rows carry the true collections (the dormant legacy slots no longer drive the grid)", () => {
    const r = computeModel(multiLeaseProject() as ModelInputs);
    const sum = (row: (typeof r.collectionsGrid)[number]) => row.amounts.reduce((a, v) => a + v, 0);
    expect(sum(r.collectionsGrid[0])).toBeCloseTo(164673412.4450872, 6);
    expect(sum(r.collectionsGrid[1])).toBeCloseTo(164673412.4450872, 6);
    expect(sum(r.collectionsGrid[2])).toBeCloseTo(219564549.9267829, 6);
    expect(sum(r.collectionsGrid[3])).toBeCloseTo(98000000.00000001, 6);
    expect(r.collectionsGrid.find((row) => row.id === "payments")).toBeUndefined();
  });

  it("ML-RECON: the multi-lease grid sums to totalCollected and reconciles per year with the yearly inflows", () => {
    const r = computeModel(multiLeaseProject() as ModelInputs);
    const grand = r.collectionsGrid.reduce((a, row) => a + row.amounts.reduce((b, v) => b + v, 0), 0);
    expect(Math.abs(grand - r.totalCollected)).toBeLessThan(1e-6);
    expect(grand).toBeCloseTo(646911374.8169572, 6);
    for (let k = 0; k < r.yearly.length; k++) {
      const colSum = r.collectionsGrid.reduce((a, row) => a + (row.amounts[k] ?? 0), 0);
      expect(Math.abs(colSum - r.yearly[k].inflow)).toBeLessThan(1e-6);
    }
  });

  it("TEMPLATE-BYTE: the template (non-contracts) grid is byte-identical — one legacy payment row with the exact amounts", () => {
    const r = computeModel(demoProject());
    expect(r.collectionsGrid.length).toBe(1);
    expect(r.collectionsGrid[0].id).toBe("payments");
    expect(r.collectionsGrid[0].name).toBe("Payment stream");
    expect(r.collectionsGrid[0].kind).toBe("payments");
    expect(r.collectionsGrid[0].amounts).toEqual([
      0, 0, 475309.1340746104, 1901236.5362984417, 1901236.5362984417, 1901236.5362984417,
      1901236.5362984417, 1901236.5362984417, 1901236.5362984417, 1425927.4022238313,
    ]);
  });

  it("EVAL-ROWS: the mixed solved/evaluated portfolio carries per-contract rows and reconciles to totalCollected", () => {
    const inputs = fixCPortfolio();
    const r = computeModel(inputs);
    expect(r.collectionsGrid.map((row) => ({ id: row.id, name: row.name, kind: row.kind }))).toEqual([
      { id: "k1", name: "Anchor tenant", kind: "contract" },
      { id: "k2", name: "Top-up", kind: "contract" },
    ]);
    const grand = r.collectionsGrid.reduce((a, row) => a + row.amounts.reduce((b, v) => b + v, 0), 0);
    expect(Math.abs(grand - r.totalCollected)).toBeLessThan(1e-6);
    const anchor = r.collectionsGrid.find((row) => row.id === "k1")!;
    const anchorSum = anchor.amounts.reduce((a, v) => a + v, 0);
    expect(Math.abs(anchorSum - 1000000 * anchor.amounts.filter((v) => v > 0).length)).toBeLessThan(1e-6);
  });

  it("BALLOON-ROW: a contract balloon lands in that contract's row at its end year", () => {
    const demo = demoProject();
    const inputs = {
      ...demo,
      repayment: { ...demo.repayment, termYears: 7, paymentsPerYear: 1 },
      contracts: [
        { id: "k1", label: "With balloon", startYear: 4, termYears: 5, paymentsPerYear: 1, graceYears: 0, escalationPerYear: 0, balloon: 500000, mode: "solved" },
      ],
    } as ModelInputs;
    const r = computeModel(inputs);
    const k1 = r.collectionsGrid.find((row) => row.id === "k1");
    expect(k1).toBeTruthy();
    const grand = r.collectionsGrid.reduce((a, row) => a + row.amounts.reduce((b, v) => b + v, 0), 0);
    expect(Math.abs(grand - r.totalCollected)).toBeLessThan(1e-6);
    expect(k1!.amounts[8]).toBeCloseTo(500000, 6);
    expect(k1!.amounts.reduce((a, v) => a + v, 0)).toBeCloseTo(500000 + 5 * (r.paymentAmount as number), 6);
  });
});
