import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byStat = (v: string) => document.querySelector('[data-stat="' + v + '"]') as HTMLElement;
const byField = (v: string) => document.querySelector('[data-field="' + v + '"]') as HTMLElement;

describe("chunk 7: section parity and presentation", () => {
  it("cost model section supports adding lines, removing lines, and currency selection", () => {
    render(<App />);
    fireEvent.click(byNav("costs"));
    const table = () => document.querySelectorAll('[data-testid="cost-lines"] tbody tr[data-kind="cost"]').length;
    expect(table()).toBe(0);
    fireEvent.click(byAction("add-cost"));
    expect(table()).toBe(1);
    fireEvent.click(byAction("add-cost"));
    expect(table()).toBe(2);
    const options = Array.from((byField("currency") as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(["EUR", "USD", "GBP", "SEK", "NOK", "DKK"]);
    fireEvent.click(document.querySelector('[data-line="c2"] [data-action="remove-cost"]') as HTMLElement);
    expect(table()).toBe(1);
  });

  it("repayment section renders the solved structure from the live model", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("repayment"));
    expect(byStat("paymentAmount").textContent).toBe("475309.13");
    expect(byStat("paymentCount").textContent).toBe("28");
    expect(byStat("repaymentStartYear").textContent).toBe("3");
    expect(byStat("totalCollected").textContent).toBe("13308655.75");
  });

  it("results section renders the yearly table, composition, metrics, and goal check", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("results"));
    expect(screen.getByTestId("yearly-table").querySelectorAll("tbody tr").length).toBe(10);
    expect(screen.getByTestId("cost-composition").textContent).toContain("Development team");
    expect(byStat("paybackYears").textContent).toBe("6.95961");
    expect(byStat("achievedIrr").textContent).toBe("12%");
    expect(screen.getByTestId("goal-check").textContent).toContain("target achieved");
    expect(screen.queryByTestId("irr-ambiguity-warning")).toBeNull();
  });

  it("presentation mode navigates six slides by keyboard and exits on Escape", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byAction("present"));
    const pres = screen.getByTestId("presentation");
    expect(pres.getAttribute("data-slide")).toBe("0");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByTestId("presentation").getAttribute("data-slide")).toBe("1");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByTestId("presentation").getAttribute("data-slide")).toBe("4");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByTestId("presentation").getAttribute("data-slide")).toBe("5");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByTestId("presentation").getAttribute("data-slide")).toBe("5");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("presentation")).toBeNull();
    expect(byStat("paymentAmount")).toBeTruthy();
  });

  it("changing an input re-renders the live model (engine-driven recompute)", () => {
    render(<App />);
    fireEvent.click(byAction("load-demo"));
    fireEvent.click(byNav("repayment"));
    expect(byStat("paymentAmount").textContent).toBe("475309.13");
    fireEvent.change(byField("termYears"), { target: { value: "3" } });
    expect(byStat("paymentAmount").textContent).toBe("903142.2");
  });
});
