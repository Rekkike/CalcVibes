import { useEffect, useState } from "react";
import type { ModelInputs, ModelResult } from "../../../core/src/types.js";
import { deckSlides } from "../deck.js";

export function Presentation(props: { inputs: ModelInputs; result: ModelResult | null; onExit: () => void; startYear?: number | null }) {
  const { inputs, result, onExit, startYear = null } = props;
  const [slide, setSlide] = useState(0);
  const totalSlides = 5;
  const deck = result !== null ? deckSlides(inputs, result, { startYear }) : null;

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
      </header>
      <main>
        {deck === null && <p data-testid="deck-placeholder">No result to present.</p>}
        {deck !== null && deck.slides.map((sl, i) => (
          slide === i && (
            <section key={sl.name} data-slide-name={sl.name} className="deck-slide">
              {i === 0 ? <h1>{sl.title}</h1> : <h2>{sl.title}</h2>}
              {sl.body.map((f, j) => (
                <p key={j} className="deck-figure">
                  <span className="deck-figure-label">{f.label}</span>
                  <span className="deck-figure-value">{f.value}</span>
                  {f.disclosure !== undefined && <span className="deck-disclosure">{f.disclosure}</span>}
                </p>
              ))}
              {sl.disclosures.map((d, j) => (
                <p key={j} className="warning deck-disclosure">{d}</p>
              ))}
              {i === 1 && result !== null && (
                <svg data-testid="composition-bar" width="600" height="120" role="img" aria-label="Cost composition">
                  {(() => {
                    const total = result.lineTotals.reduce((a, l) => a + l.total, 0);
                    let x = 0;
                    return result.lineTotals.map((l, k) => {
                      const w = (l.total / total) * 600;
                      const rect = <rect key={k} x={x} y={40} width={w} height={40} fill={k % 2 === 0 ? "#6366f1" : "#10b981"} />;
                      const label = <text key={k + "t"} x={x + 4} y={100} fontSize="12">{l.name}</text>;
                      x += w;
                      return [rect, label];
                    });
                  })()}
                  <line x1="0" y1="80" x2="600" y2="80" stroke="#333" />
                </svg>
              )}
            </section>
          )
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
