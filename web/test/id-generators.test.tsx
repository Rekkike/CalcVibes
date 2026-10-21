import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";
import { nextContractId, nextCostId, nextId, nextOperatingId } from "../src/state.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;

// v0.6.13 Task E (AUD-15): one collision-proof id helper serves every generator.
describe("AUD-15: the id generators are collision-proof", () => {
  it("delete a middle row, add a row: the id never returns", () => {
    const ops = [{ id: "o1" }, { id: "o3" }] as never[];
    const costs = [{ id: "c1" }, { id: "c3" }] as never[];
    const contracts = [{ id: "k1" }, { id: "k3" }] as never[];
    expect(nextOperatingId(ops)).toBe("o2");
    expect(nextCostId(costs)).toBe("c2");
    expect(nextContractId(contracts)).toBe("k2");
    expect(["o1", "o3"]).not.toContain(nextOperatingId(ops));
  });

  it("the contiguous case is unchanged (the next integer)", () => {
    expect(nextOperatingId([{ id: "o1" }, { id: "o2" }] as never[])).toBe("o3");
    expect(nextCostId([] as never[])).toBe("c1");
  });

  it("the shared helper is the smallest unused integer for any prefix", () => {
    expect(nextId("x", ["x2", "x1", "y1"])).toBe("x3");
    expect(nextId("x", ["x1", "x3"])).toBe("x2");
    expect(nextId("t", [])).toBe("t1");
  });

  it("the Operating section: remove the first of several lines, add one — the ids stay unique", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("operating"));
    const ids = () => Array.from(document.querySelectorAll('[data-kind="operating"]')).map((r) => r.getAttribute("data-line"));
    fireEvent.click(byAction("add-operating"));
    fireEvent.click(byAction("add-operating"));
    expect(ids().length).toBeGreaterThanOrEqual(3);
    fireEvent.click(document.querySelector('[data-action="remove-operating"]') as HTMLElement);
    fireEvent.click(byAction("add-operating"));
    const after = ids();
    expect(new Set(after).size).toBe(after.length);
  });
});
