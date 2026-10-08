import { useEffect, useState } from "react";
import type { ModelInputs, ModelResult } from "../../../core/src/types.js";
import { deckSlides } from "../deck.js";
import { moneyForDisplay } from "../engine.js";
import { yearHeader } from "../state.js";
import { CompositionDonut, RecoveryBars } from "../charts.js";
import type { EntryUnit } from "../engine.js";

export function Presentation(props: { inputs: ModelInputs; result: ModelResult | null; onExit: () => void; startYear?: number | null; entryUnit?: EntryUnit }) {
  const { inputs, result, onExit, startYear = null, entryUnit = "ones" } = props;
  const [slide, setSlide] = useState(0);
  const totalSlides = 5;
  const deck = result !== null ? deckSlides(inputs, result, { startYear, entryUnit }) : null;

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
                  </div>
                ))}
              </div>
            )}
            {sl.summaryCharts !== undefined && result !== null && (
              <div data-testid="summary-charts" className="summary-charts">
                <div data-summary-chart="donut"><CompositionDonut lineTotals={result.lineTotals} centerTotal={moneyForDisplay(result.totalCost, (inputs.currency as Parameters<typeof moneyForDisplay>[1]) ?? "SEK", entryUnit)} /></div>
                <div data-summary-chart="bars"><RecoveryBars collectionsGrid={result.collectionsGrid} years={result.yearly.length} labelFor={(y) => yearHeader(y, startYear)} /></div>
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
            {i === 4 && deck?.glosses !== undefined && deck.glosses.map((g, j) => (
              <p key={"gl-" + j} data-testid="term-gloss" className="deck-disclosure"><strong>{g.term}</strong>: {g.gloss}</p>
            ))}
            {i === 1 && result !== null && (
              <div data-testid="deck-chart-slot" data-slide-chart="investment">
                <CompositionDonut lineTotals={result.lineTotals} centerTotal={moneyForDisplay(result.totalCost, (inputs.currency as Parameters<typeof moneyForDisplay>[1]) ?? "SEK", entryUnit)} />
              </div>
            )}
            {i === 2 && result !== null && (
              <div data-testid="deck-chart-slot" data-slide-chart="recovery">
                <RecoveryBars collectionsGrid={result.collectionsGrid} years={result.yearly.length} labelFor={(y) => yearHeader(y, startYear)} />
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
