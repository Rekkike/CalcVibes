import { useEffect, useState } from "react";
import type { ModelInputs, ModelResult } from "../../../core/src/types.js";
import { deckSlides } from "../deck.js";
import { deckMoneyForDisplay } from "../engine.js";
import { yearHeader } from "../state.js";
import { CompositionRows, RecoveryBars, CoverageCurve, CostWaterfall, HurdlePlot } from "../charts.js";
import type { EntryUnit, CurrencyCode } from "../engine.js";

export function Presentation(props: { inputs: ModelInputs; result: ModelResult | null; onExit: () => void; startYear?: number | null; entryUnit?: EntryUnit }) {
  const { inputs, result, onExit, startYear = null, entryUnit = "ones" } = props;
  const [slide, setSlide] = useState(0);
  const totalSlides = 6;
  const deck = result !== null ? deckSlides(inputs, result, { startYear, entryUnit }) : null;
  const currency = (inputs.currency as CurrencyCode) ?? "SEK";

  const dominantLine = result !== null && result.lineTotals.length > 0
    ? result.lineTotals.reduce((b, l) => (l.total > b.total ? l : b), result.lineTotals[0])
    : null;
  const investmentKicker = dominantLine !== null ? `${dominantLine.name} dominates the cost base` : "The cost base";
  const recoveryKicker = inputs.tariff !== undefined && inputs.tariff.mode !== "off"
    ? inputs.tariff.mode === "decompose"
      ? "Per-lift prices set the yearly recovery"
      : inputs.tariff.mode === "stable"
        ? "An escalating tariff ramps the inflows"
        : "The inflows follow the modelled profile"
    : result !== null && result.paymentAmount !== null
      ? "Even payments spread the recovery"
      : "The inflows follow the modelled profile";

  const peakFor = (v: number) => deckMoneyForDisplay(v, currency, entryUnit);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      if (e.key === "ArrowRight") setSlide((s) => Math.min(s + 1, totalSlides - 1));
      if (e.key === "ArrowLeft") setSlide((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit]);

  return (
    <div data-testid="presentation" data-slide={slide}>
      <header>
        <span>{inputs.projectName || "Untitled project"}</span>
        <button data-action="exit-presentation" onClick={onExit}>Exit presentation (Esc)</button>
        <button data-action="download-pdf" onClick={async () => {
          if (result === null) return;
          const { buildDeckPdf } = await import("../pdf.js");
          const doc = buildDeckPdf(deck as NonNullable<typeof deck>, inputs.projectName || "project");
          doc.save(`${inputs.projectName || "project"}.pdf`);
        }} disabled={result === null}>Download PDF</button>
        {result === null && <span data-testid="export-disabled-reason" className="muted">Exports and PDF are disabled until the input issues are resolved.</span>}
      </header>
      <main>
        {deck === null && <p data-testid="deck-placeholder">No result to present.</p>}
        {deck !== null && deck.slides.map((sl, i) => (
          <section key={sl.name} data-slide-name={sl.name} data-slide-index={i} data-slide-active={slide === i ? "true" : "false"} className="deck-slide deck-slide-print">
            <header className="deck-slide-header">{inputs.projectName || "Untitled project"}</header>
            {i === 0 ? <h1>{sl.title}</h1> : <h2>{sl.title}</h2>}
            {sl.tiles !== undefined && (
              <div data-testid="summary-tiles" className="summary-tiles">
                {sl.tiles.map((t, j) => (
                  <div key={"tile-" + j} data-tile={t.label} className={"stat-card deck-tile" + (t.tone !== undefined ? ` tone-${t.tone}` : "")}>
                    <span className="stat-label">{t.label}</span>
                    <span className="stat-value">{t.value}</span>
                    {t.disclosure !== undefined && <span className="deck-disclosure">{t.disclosure}</span>}
                  </div>
                ))}
              </div>
            )}
            {sl.summaryCharts !== undefined && result !== null && (
              <div data-testid="summary-charts" className="summary-charts">
                <div data-summary-chart="hurdle"><HurdlePlot target={inputs.targetIrr} achieved={(result.achievedIrr ?? 0) * 100} goalMet={result.goalMet} solved={result.paymentAmount !== null} /></div>
                <div data-summary-chart="bars"><RecoveryBars collectionsGrid={result.collectionsGrid} years={result.yearly.length} labelFor={(y) => yearHeader(y, startYear)} peakFor={peakFor} kicker={recoveryKicker} /></div>
              </div>
            )}
            {sl.body.map((f, j) => (
              <p key={j} className="deck-figure">
                <span className="deck-figure-label">{f.label}</span>
                <span className="deck-figure-value">{f.value}</span>
                {f.disclosure !== undefined && <span className="deck-disclosure">{f.disclosure}</span>}
              </p>
            ))}
            {sl.insights !== undefined && sl.insights.map((d, j) => (
              <p key={"ins-" + j} data-testid="deck-insight" className="deck-disclosure insight">{d}</p>
            ))}
            {sl.verdict !== undefined && (
              <p data-testid="deck-verdict" className="deck-disclosure insight">{sl.verdict}</p>
            )}
            {sl.disclosures.map((d, j) => (
              <p key={j} className="warning deck-disclosure">{d}</p>
            ))}
            {i === 5 && deck?.glosses !== undefined && deck.glosses.map((g, j) => (
              <p key={"gl-" + j} data-testid="term-gloss" className="deck-disclosure"><strong>{g.term}</strong>: {g.gloss}</p>
            ))}
            {i === 1 && result !== null && (
              <div data-testid="deck-chart-slot" data-slide-chart="investment">
                <CompositionRows lineTotals={result.lineTotals} valueFor={(t) => deckMoneyForDisplay(t, currency, entryUnit)} kicker={investmentKicker} />
                <CostWaterfall lineTotals={result.lineTotals} total={result.totalCost} valueFor={(t) => deckMoneyForDisplay(t, currency, entryUnit)} />
              </div>
            )}
            {i === 3 && result !== null && (
              <div data-testid="deck-chart-slot" data-slide-chart="coverage">
                <CoverageCurve yearly={result.yearly} labelFor={(y) => yearHeader(y, startYear)} valueFor={(v) => deckMoneyForDisplay(v, currency, entryUnit)} />
              </div>
            )}
            {i === 2 && result !== null && (
              <div data-testid="deck-chart-slot" data-slide-chart="recovery">
                <RecoveryBars collectionsGrid={result.collectionsGrid} years={result.yearly.length} labelFor={(y) => yearHeader(y, startYear)} peakFor={peakFor} kicker={recoveryKicker} />
              </div>
            )}
            
            <footer className="deck-slide-footer">
              <span>slide {i + 1} of {deck.slides.length}</span>
              <span>Generated from the live model — {inputs.projectName || "Untitled project"}</span>
            </footer>
          </section>
        ))}
      </main>
      <footer>
        <button data-action="prev-slide" onClick={() => setSlide((s) => Math.max(s - 1, 0))}>← Previous</button>
        <span>{[...Array(totalSlides)].map((_, i) => <span key={i} data-dot={i} className={i === slide ? "dot active" : "dot"}>·</span>)}</span>
        <button data-action="next-slide" onClick={() => setSlide((s) => Math.min(s + 1, totalSlides - 1))}>Next →</button>
      </footer>
    </div>
  );
}
