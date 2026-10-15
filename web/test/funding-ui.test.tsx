// Directive v0.6.10 Task E.1: the funding block worksuite surface — the rows editor, the
// engine-emitted funding view, the live validation (FND-AMOUNT through the issues summary),
// and the grant-scale scenario axis and its per-cell table. Every figure below was
// script-verified against the delivered engine before this file was written (exact double
// equality where the engine returns the pinned double verbatim; the display forms are the
// engine's own formatters at entry unit thousands — the App's default state, which the demo
// loader does not touch). The UI performs no financial arithmetic: every rendered figure is
// compared against the engine's fundingView, one source.
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";
import { shorePowerProgram } from "../src/state.js";
import { computeModel } from "../src/engine.js";
import { feeForDisplay, moneyForDisplay, percentTwoForDisplay } from "../src/engine.js";
import { paymentVsGrantScaleTable } from "../../core/src/scenarios.js";

const byAction = (v: string) => document.querySelector('[data-action="' + v + '"]') as HTMLElement;
const byNav = (v: string) => document.querySelector('[data-nav="' + v + '"]') as HTMLElement;
const byTestid = (v: string) => document.querySelector('[data-testid="' + v + '"]') as HTMLElement;

async function loadProgramDemo() {
  render(<App />);
  fireEvent.click(byAction("load-demo"));
  await waitFor(() => {
    expect(screen.getByText("Shore-power program (Rotterdam)")).toBeTruthy();
  });
}

describe("v0.6.10 Task E.1: the funding worksuite surface", () => {
  it("FUNDING-ROWS: the program fixture carries the three grants and the interest-free note; the loan row alone carries the term fields", async () => {
    await loadProgramDemo();
    fireEvent.click(byNav("funding"));
    const rows = Array.from(document.querySelectorAll("[data-funding-row]"));
    expect(rows.map((r) => r.getAttribute("data-funding-row"))).toEqual(["g1", "g2", "g3", "l1"]);
    // The grant rows carry label, kind, amount, and landing year — never the loan-only fields.
    for (const id of ["g1", "g2", "g3"]) {
      const row = document.querySelector('[data-funding-row="' + id + '"]') as HTMLElement;
      expect(row.querySelector('[data-field="fundingKind"]')).toBeTruthy();
      expect((row.querySelector('[data-field="fundingKind"]') as HTMLSelectElement).value).toBe("grant");
      expect(row.querySelector('[data-field="fundingTerm"]')).toBeNull();
      expect(row.querySelector('[data-field="fundingRepayStart"]')).toBeNull();
    }
    const l1 = document.querySelector('[data-funding-row="l1"]') as HTMLElement;
    expect((l1.querySelector('[data-field="fundingKind"]') as HTMLSelectElement).value).toBe("interest-free-loan");
    expect((l1.querySelector('[data-field="fundingTerm"]') as HTMLInputElement).value).toBe("10");
    expect((l1.querySelector('[data-field="fundingRepayStart"]') as HTMLInputElement).value).toBe("4");
  });

  it("FUNDING-VIEW: the engine-emitted funding view renders the grants total, the funding NPV, and the per-grant allocation with the capitalized-to-date shares", async () => {
    // Engine pins (exact doubles, script-verified): the grants total, the funding NPV, and the
    // allocation shape — g1 spreads over all six depreciating lines, g3 (year 1) over the two
    // lines capitalized that early; the loan never joins the allocation.
    const r = computeModel(shorePowerProgram());
    const fv = r.fundingView!;
    expect(fv.grantsTotal).toBe(173500000);
    expect(fv.fundingNpv).toBe(140055345.14230645);
    expect(fv.allocation.map((a) => a.grantId)).toEqual(["g1", "g2", "g3"]);
    const g1 = fv.allocation.find((a) => a.grantId === "g1")!;
    const g3 = fv.allocation.find((a) => a.grantId === "g3")!;
    expect(g1.shares.length).toBe(6);
    expect(g3.shares.length).toBe(2);

    await loadProgramDemo();
    fireEvent.click(byNav("funding"));
    await waitFor(() => {
      expect(byTestid("funding-view")).toBeTruthy();
    });
    // The summary figures at entry unit thousands (the App default the loader leaves untouched).
    expect(document.querySelector('[data-stat="grantsTotal"]')?.textContent).toBe("Grants total: €173 500,00 k");
    expect(document.querySelector('[data-stat="fundingNpv"]')?.textContent).toBe("Funding NPV at target: €140 055,35 k");
    // Three allocations render — the grants only; the interest-free note never allocates.
    expect(Array.from(document.querySelectorAll("[data-allocation]")).map((e) => e.getAttribute("data-allocation"))).toEqual(["g1", "g2", "g3"]);
    // The g1 paragraph with its full allocation-rule suffix.
    const g1p = document.querySelector('[data-allocation="g1"] p')?.textContent ?? "";
    expect(g1p).toBe(
      "AFIF grant (EU): €70 000,00 k at year 2028 — allocated proportionally to the capitalized-to-date cost of the depreciating lines at the receipt year."
    );
    // The g1 allocation table is engine-derived: six rows, every share and netted amount the
    // engine's own display of its own doubles (one source — the UI recomputes nothing).
    const g1Rows = Array.from(document.querySelectorAll('[data-allocation="g1"] [data-testid="funding-allocation-table"] tbody tr'));
    expect(g1Rows.length).toBe(6);
    for (const s of g1.shares) {
      const tr = document.querySelector('[data-allocation="g1"] tr[data-line="' + s.lineId + '"]') as HTMLElement;
      expect(tr).toBeTruthy();
      const cells = Array.from(tr.querySelectorAll("td")).map((td) => td.textContent);
      expect(cells[0]).toBe(s.lineName);
      expect(cells[2]).toBe(percentTwoForDisplay(s.shareOfGrant));
      expect(cells[3]).toBe(moneyForDisplay(s.nettedAmount, "EUR", "thousands"));
    }
    // The pinned p1 spelling inside g1 (the recorded pins of record).
    const p1 = document.querySelector('[data-allocation="g1"] tr[data-line="p1"]') as HTMLElement;
    expect(Array.from(p1.querySelectorAll("td"))[2].textContent).toBe("19.55%");
    expect(Array.from(p1.querySelectorAll("td"))[3].textContent).toBe("€13 685,60 k");
    // g3: year 1, only p1 and p6 are capitalized — the two-share allocation, the pinned spellings.
    const g3p = document.querySelector('[data-allocation="g3"] p')?.textContent ?? "";
    expect(g3p).toBe(
      "Province & municipality grant: €3 500,00 k at year 2026 — allocated proportionally to the capitalized-to-date cost of the depreciating lines at the receipt year."
    );
    expect(document.querySelector('[data-allocation="g3"] tr[data-line="p1"] td:nth-child(3)')?.textContent).toBe("90.24%");
    expect(document.querySelector('[data-allocation="g3"] tr[data-line="p6"] td:nth-child(3)')?.textContent).toBe("9.76%");
  });

  it("FUNDING-EDITORS: the blank app adds and removes funding rows, the loan kind toggles the term fields, and a zero amount refuses through the issues summary (FND-AMOUNT)", async () => {
    render(<App />);
    fireEvent.click(byNav("funding"));
    expect(document.querySelectorAll("[data-funding-row]").length).toBe(0);
    fireEvent.click(byAction("add-funding-row"));
    const f1 = document.querySelector('[data-funding-row="f1"]') as HTMLElement;
    expect(f1).toBeTruthy();
    expect((f1.querySelector('[data-field="fundingKind"]') as HTMLSelectElement).value).toBe("grant");
    // A grant row lands with amount 0 — the engine's collect-all validation refuses it.
    await waitFor(() => {
      expect(byTestid("issues-summary")).toBeTruthy();
    });
    expect(byTestid("issues-summary").textContent).toContain("Funding row f1 must carry a positive amount (FND-AMOUNT).");
    // The loan kind alone surfaces the term and repayment-start fields.
    fireEvent.change(f1.querySelector('[data-field="fundingKind"]') as HTMLSelectElement, { target: { value: "interest-free-loan" } });
    expect((document.querySelector('[data-funding-row="f1"] [data-field="fundingTerm"]') as HTMLInputElement).value).toBe("1");
    expect((document.querySelector('[data-funding-row="f1"] [data-field="fundingRepayStart"]') as HTMLInputElement).value).toBe("1");
    fireEvent.change(document.querySelector('[data-funding-row="f1"] [data-field="fundingKind"]') as HTMLSelectElement, { target: { value: "grant" } });
    expect(document.querySelector('[data-funding-row="f1"] [data-field="fundingTerm"]')).toBeNull();
    // Removing the row clears the refusal — the blank project computes cleanly again.
    fireEvent.click(document.querySelector('[data-funding-row="f1"] [data-action="remove-funding-row"]') as HTMLElement);
    expect(document.querySelectorAll("[data-funding-row]").length).toBe(0);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="issues-summary"]')).toBeNull();
    });
  });

  it("GRANT-SCALE-AXIS: the axis ships empty beside the honest scenario refusal, and its explanation renders", async () => {
    await loadProgramDemo();
    fireEvent.click(byNav("scenarios"));
    // v0.6.11 re-anchor (Task E): the per-variant contract — the optimistic variant refuses
    // under its own terms (the term-25 shift leaves the declared tariff span) and carries its
    // engine reason; the axis editors and the per-cell tables still render.
    expect(byTestid("scenarios-framing")).toBeTruthy();
    expect(byTestid("scenario-refusal-optimistic").textContent).toContain(
      "Invalid model inputs: The required collections extend to year 24, beyond the declared tariff span (years 3-23): widen the tariff span or shorten the term."
    );
    // The grant-scale axis explanation (the axis editor always renders).
    expect(byTestid("scenario-axis-explanation-grant-scale").textContent).toBe(
      "The grant-scale factor multiplies every grant row's amount; 0 removes the grants entirely; the loan rows never scale."
    );
    // The grant-scale table is empty-state while the axis is empty (the loader presets no scales).
    expect(byTestid("grant-scale-empty")).toBeTruthy();
    expect(byTestid("grant-scale-empty").textContent).toBe("Enter values to compute the tables.");
    expect(document.querySelectorAll('[data-field="scenario-grant-scale"]').length).toBe(0);
  });

  it("GRANT-SCALE-TABLE: the axis edit drives the per-cell table; the cells match the engine's paymentVsGrantScaleTable digit for digit, with honest refusals at term 25", async () => {
    // Engine pins (exact doubles, script-verified on the rebuilt engine): the full 3x3 matrix
    // at scales [0, 0.5, 1] x terms [15, 20, 25]. A factor of 0 removes the grant rows; the
    // loan rows never scale; the term-25 cells refuse (the required collections leave the
    // declared tariff grid) and return null.
    const inp = shorePowerProgram();
    const core = paymentVsGrantScaleTable(inp, [0, 0.5, 1], [15, 20, 25]);
    expect(core).toEqual([
      [4576582.960344898, 3990190.2135963826, null],
      [3899397.4844559785, 3416777.90958949, null],
      [3222212.0085670594, 2843365.6055825967, null],
    ]);
    expect(core[0][1]).toBe(3990190.2135963826);
    expect(core[1][1]).toBe(3416777.90958949);
    expect(core[2][1]).toBe(2843365.6055825967);

    await loadProgramDemo();
    fireEvent.click(byNav("scenarios"));
    // The axis edit: add then set each factor, so every intermediate axis state is unique.
    fireEvent.click(byAction("scenario-add-grant-scale"));
    fireEvent.change(document.querySelector('[data-field="scenario-grant-scale"][data-index="0"]') as HTMLInputElement, { target: { value: "0" } });
    fireEvent.click(byAction("scenario-add-grant-scale"));
    fireEvent.change(document.querySelector('[data-field="scenario-grant-scale"][data-index="1"]') as HTMLInputElement, { target: { value: "0.5" } });
    fireEvent.click(byAction("scenario-add-grant-scale"));
    fireEvent.change(document.querySelector('[data-field="scenario-grant-scale"][data-index="2"]') as HTMLInputElement, { target: { value: "1" } });
    await waitFor(() => {
      expect(byTestid("grant-scale-term-table")).toBeTruthy();
    });
    expect(byTestid("grant-scale-empty")).toBeNull();
    // Every computed cell renders the engine's own fee display of the engine's own double
    // (one source); every refused cell carries the honest refusal with its refusal marker.
    const scales = [0, 0.5, 1];
    const terms = [15, 20, 25];
    for (let i = 0; i < scales.length; i++) {
      const tr = document.querySelector('[data-grant-scale="' + scales[i] + '"]') as HTMLElement;
      expect(tr).toBeTruthy();
      const cells = Array.from(tr.querySelectorAll("td"));
      for (let j = 0; j < terms.length; j++) {
        if (core[i][j] === null) {
          expect(cells[j + 1].getAttribute("data-cell-refusal")).toBe("true");
          expect(cells[j + 1].textContent).toBe(
            "refused: Invalid model inputs: The required collections extend to year 24, beyond the declared tariff span (years 3-23): widen the tariff span or shorten the term."
          );
        } else {
          expect(cells[j + 1].getAttribute("data-cell-refusal")).toBeNull();
          expect(cells[j + 1].textContent).toBe(feeForDisplay(core[i][j] as number, "EUR", "thousands"));
        }
      }
    }
    // The pinned term-20 spellings (the fee display at the App's entry unit thousands).
    const row20 = document.querySelector('[data-grant-scale="0"]') as HTMLElement;
    expect(Array.from(row20.querySelectorAll("td"))[2].textContent).toBe("€3 990 k");
    expect(Array.from(document.querySelector('[data-grant-scale="0.5"]')?.querySelectorAll("td") ?? [])[2].textContent).toBe("€3 417 k");
    expect(Array.from(document.querySelector('[data-grant-scale="1"]')?.querySelectorAll("td") ?? [])[2].textContent).toBe("€2 843 k");
  });
});
