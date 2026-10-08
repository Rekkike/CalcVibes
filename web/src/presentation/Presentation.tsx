import { useEffect, useState } from "react";
import type { ModelInputs, ModelResult } from "../../../core/src/types.js";
import { roundForDisplay } from "../engine.js";
import { yearHeader } from "../state.js";

export function Presentation(props: { inputs: ModelInputs; result: ModelResult | null; onExit: () => void; startYear?: number | null }) {
  const { inputs, result, onExit, startYear = null } = props;
  const [slide, setSlide] = useState(0);
  const totalSlides = 5;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      if (e.key === "ArrowRight") setSlide((s) => Math.min(s + 1, totalSlides - 1));
      if (e.key === "ArrowLeft") setSlide((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit]);

  const pct = (v: number | null) => (v === null ? "—" : roundForDisplay(v * 100, 2) + "%");

  return (
    <div data-testid="presentation" data-slide={slide}>
      <header>
        <span>{inputs.projectName || "Untitled project"}</span>
        <button data-action="exit-presentation" onClick={onExit}>Exit presentation (Esc)</button>
      </header>
      <main>
        {slide === 0 && <h1>{inputs.projectName || "Untitled project"}</h1>}
        {slide === 1 && result !== null && (
          <section data-slide-name="investment">
            <h2>Investment</h2>
            <p>Total cost (nominal): {roundForDisplay(result.totalCost)} {inputs.currency}</p>
            <p>Cost NPV at target (discounted): {roundForDisplay(result.costNpv)} {inputs.currency}</p>
            <ul>{result.lineTotals.map((l) => <li key={l.id}>{l.name}: {roundForDisplay(l.total)}</li>)}</ul>
          </section>
        )}
        {slide === 2 && result !== null && (
          <section data-slide-name="repayment">
            <h2>Repayment</h2>
            <p>Solved payment: {result.paymentAmount === null ? "not applicable (collection mode)" : roundForDisplay(result.paymentAmount)} {inputs.currency}</p>
            <p>Payments: {result.paymentCount}, starting {yearHeader(result.repaymentStartYear, startYear)}</p>
            <p>Total collected (nominal): {roundForDisplay(result.totalCollected)} {inputs.currency}</p>
          </section>
        )}
        {slide === 3 && result !== null && (
          <section data-slide-name="returns">
            <h2>Returns</h2>
            <p>Achieved IRR: {pct(result.achievedIrr)} (target {roundForDisplay(inputs.targetIrr, 2)}%)</p>
            {result !== null && result.irrAmbiguous && (
              <p className="warning">Warning: the net flow has {result.signChanges} sign changes; the IRR may not be unique.</p>
            )}
            <p>Payback: {result.paybackYears === null ? "—" : roundForDisplay(result.paybackYears, 2) + " years (nominal)"}</p>
            <p>Net gain (nominal): {roundForDisplay(result.netGain)} {inputs.currency}</p>
          </section>
        )}
        {slide === 4 && result !== null && (
          <section data-slide-name="summary">
            <h2>Summary</h2>
            <p>Total cost {roundForDisplay(result.totalCost)}, total collected {roundForDisplay(result.totalCollected)}, net gain {roundForDisplay(result.netGain)} — all nominal.</p>
            <p>Achieved IRR {pct(result.achievedIrr)} against target {roundForDisplay(inputs.targetIrr, 2)}%.</p>
          </section>
        )}
      </main>
      <footer>
        <button data-action="prev-slide" onClick={() => setSlide((s) => Math.max(s - 1, 0))}>← Previous</button>
        <span>{[...Array(totalSlides)].map((_, i) => <span key={i} data-dot={i} className={i === slide ? "dot active" : "dot"}>·</span>)}</span>
        <button data-action="next-slide" onClick={() => setSlide((s) => Math.min(s + 1, totalSlides - 1))}>Next →</button>
      </footer>
    </div>
  );
}
