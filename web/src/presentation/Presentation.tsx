import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ModelInputs, ModelResult } from "../../../core/src/types.js";
import { deckSlides } from "../deck.js";
import type { ScenarioTargetChart } from "../deck.js";
import { deckMoneyForDisplay, feeForDisplay, percentTwoForDisplay } from "../engine.js";
import { yearHeader } from "../state.js";
import { CompositionDonut, RecoveryBars, StageReturnsChart, CostWaterfall, LedgerWaterfall, HurdlePlot, ScenarioComparisonBars, GanttChart } from "../charts.js";
import type { EntryUnit, CurrencyCode } from "../engine.js";


// v0.6.5 Task B/W11: the scenarios target infographic — one variable per chart, zero-based, direct
// HTML labels (no viewbox text), semantic verdict colors, the break-even target marked as the crossing.
function ScenarioTargetBars(props: { chart: ScenarioTargetChart; currency: CurrencyCode; entryUnit: EntryUnit }) {
  const { chart, currency, entryUnit } = props;
  const n = Math.max(1, chart.points.length);
  const slot = 100 / n;
  const barW = slot * 0.6;
  const maxAbs = Math.max(...chart.points.map((p) => Math.abs(p.value)), 1e-12);
  const targetX = (i: number) => i * slot + slot / 2;
  const breakX = (() => {
    const be = chart.breakEvenTarget;
    if (be === null || chart.points.length === 0) return null;
    if (be <= chart.points[0].target) return 0;
    if (be >= chart.points[chart.points.length - 1].target) return 100;
    for (let i = 0; i < chart.points.length - 1; i++) {
      const a = chart.points[i].target;
      const b = chart.points[i + 1].target;
      if (be >= a && be <= b) {
        const t = b > a ? (be - a) / (b - a) : 0;
        return targetX(i) + t * (targetX(i + 1) - targetX(i));
      }
    }
    return null;
  })();
  if (chart.mode === "solved") {
    return (
      <div data-testid="scenario-target-chart" data-mode="solved" className="chart-block scenario-target-chart">
        <p data-testid="chart-kicker" className="chart-kicker">{chart.kicker}</p>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="scenario-target-svg">
          {chart.points.map((p, i) => {
            const h = (Math.max(0, p.value) / maxAbs) * 100;
            const x = targetX(i) - barW / 2;
            return <rect key={p.label} data-target-bar={p.label} x={x.toFixed(2)} y={(100 - h).toFixed(2)} width={barW.toFixed(2)} height={h.toFixed(2)} fill="#34d399" />;
          })}
        </svg>
        <ul className="scenario-target-labels">
          {chart.points.map((p) => (
            <li key={p.label} data-target-label={p.label} className="scenario-target-label">
              <span className="row-name">{p.label}</span>
              {/* v0.6.9 Task F (finding W28): the solved-mode payment values render through the
                  magnitude-aware feeForDisplay (the pinned target strings "€1,4 M" et al.). */}
              <span className="row-value">{feeForDisplay(p.value, currency, entryUnit)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const zeroY = 25;
  return (
    <div data-testid="scenario-target-chart" data-mode="evaluated" className="chart-block scenario-target-chart">
      <p data-testid="chart-kicker" className="chart-kicker">{chart.kicker}</p>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="scenario-target-svg">
        <line data-testid="scenario-target-zero" x1={0} x2={100} y1={zeroY} y2={zeroY} stroke="rgba(148,163,184,0.45)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {chart.points.map((p, i) => {
          const h = (Math.abs(p.value) / maxAbs) * 70;
          const x = targetX(i) - barW / 2;
          return p.value >= 0
            ? <rect key={p.label} data-target-bar={p.label} data-met={p.met ? "true" : "false"} x={x.toFixed(2)} y={(zeroY - h).toFixed(2)} width={barW.toFixed(2)} height={h.toFixed(2)} fill={p.met ? "#34d399" : "#fb7185"} />
            : <rect key={p.label} data-target-bar={p.label} data-met={p.met ? "true" : "false"} x={x.toFixed(2)} y={zeroY} width={barW.toFixed(2)} height={h.toFixed(2)} fill={p.met ? "#34d399" : "#fb7185"} />;
        })}
        {breakX !== null && <line data-testid="scenario-break-even-marker" x1={breakX.toFixed(2)} x2={breakX.toFixed(2)} y1={0} y2={100} stroke="#e8b84b" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      </svg>
      <ul className="scenario-target-labels">
        {chart.points.map((p) => (
          <li key={p.label} data-target-label={p.label} data-met={p.met ? "true" : "false"} className="scenario-target-label">
            <span className="row-name">{p.label} target</span>
            <span className="row-value">{p.met ? "met" : "not met"}</span>
          </li>
        ))}
      </ul>
      {chart.breakEvenTarget !== null && (
        <p data-testid="scenario-break-even-caption" className="scenario-break-even-caption">break-even at {percentTwoForDisplay(chart.breakEvenTarget)}</p>
      )}
    </div>
  );
}

export function Presentation(props: { inputs: ModelInputs; result: ModelResult | null; onExit: () => void; startYear?: number | null; entryUnit?: EntryUnit; scenarioTargets?: number[] | null; scenarioTerms?: number[] | null; scenarioBalloons?: number[] | null; monthGrid?: boolean }) {
  const { inputs, result, onExit, startYear = null, entryUnit = "ones", scenarioTargets = null, scenarioTerms = null, scenarioBalloons = null, monthGrid = false } = props;
  const [slide, setSlide] = useState(0);
  // v0.6.18 Task H1: the month level of the recovery bars composes only on request (a view state, never a document field)
  const [recoveryMonthly, setRecoveryMonthly] = useState(false);
  const deck = result !== null ? deckSlides(inputs, result, { startYear, entryUnit, scenarioTargets, scenarioTerms, scenarioBalloons, monthGrid, recoveryMonthly }) : null;
  const totalSlides = deck?.slides.length ?? 7;
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
  // v0.6.5 Task F/W14: swipe navigation on touch devices — a horizontal swipe with a threshold
  // changes slides; the vertical scroll is never hijacked (the dominant-axis test).
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (el === null) return;
    let startX: number | null = null;
    let startY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (startX === null || startY === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      startX = null;
      startY = null;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) setSlide((s) => Math.min(s + 1, totalSlides - 1));
      else setSlide((s) => Math.max(s - 1, 0));
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [totalSlides]);


  return (
    <div ref={stageRef} data-testid="presentation" data-slide={slide}>
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
            {i !== 0 && sl.kickerNumber !== undefined && (
              <p data-testid="slide-kicker" className="slide-kicker">{sl.kickerNumber} — {sl.name}</p>
            )}
            {i === 0 ? <h1>{sl.title}</h1> : <h2>{sl.title}</h2>}
            {i === 0 && sl.titleMetrics !== undefined && (
              <div data-testid="title-metrics" className="title-metrics">
                {sl.titleMetrics.map((m, j) => (
                  <div key={"tm-" + j} data-title-metric={m.label} className="title-metric">
                    <span className="metric-label">{m.label}</span>
                    <span className="metric-value">{m.value}</span>
                  </div>
                ))}
              </div>
            )}
            {sl.verdict !== undefined && (
              <p data-testid="deck-verdict" className="deck-disclosure insight deck-verdict-lead">{sl.verdict}</p>
            )}
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
            {sl.donuts !== undefined && sl.donuts.length > 0 && (
              <div data-testid="summary-donuts" className="summary-donuts">
                {sl.donuts.map((d) => (
                  <div key={d.id} data-donut={d.id} className="summary-donut">
                    <p data-testid="chart-kicker" className="chart-kicker">{d.title}</p>
                    <CompositionDonut lineTotals={d.segments.map((s) => ({ id: s.id, name: s.label, total: s.value, ...(s.share !== undefined ? { share: s.share } : {}) }))} valueFor={(t) => deckMoneyForDisplay(t, currency, entryUnit)} />
                    {d.disclosure !== undefined && <span className="deck-disclosure">{d.disclosure}</span>}
                  </div>
                ))}
              </div>
            )}
            {sl.solverScenario !== null && sl.solverScenario !== undefined && (
              <div data-testid="solver-scenario" className="solver-scenario">
                <p className="solver-scenario-label">{sl.solverScenario.label}</p>
                <p className="solver-scenario-value">Required solved rent: {sl.solverScenario.requiredPayment ?? "not applicable"}</p>
              </div>
            )}
            {sl.summaryCharts !== undefined && result !== null && (
              <div data-testid="summary-charts" className="summary-charts">
                <div data-summary-chart="hurdle"><HurdlePlot target={inputs.targetIrr} achieved={(result.achievedIrr ?? 0) * 100} achievedMissing={result.achievedIrr === null} goalMet={result.goalMet} solved={result.paymentAmount !== null} /></div>
                {(() => { const bars = sl.summaryCharts.find((c) => c.kind === "bars"); return bars === undefined ? null : <div data-summary-chart="bars"><RecoveryBars series={bars.data} peakFor={peakFor} kicker={recoveryKicker} periodNote={`${bars.kicker ?? ""}. ${bars.periodNote ?? ""}`.trim()} basis={bars.basis ?? "annual"} /></div>; })()}
              </div>
            )}
            {sl.name === "investment" && result !== null && (
              <div data-testid="deck-chart-slot" data-slide-chart="investment">
                {/* v0.6.15: the combined investment waterfall — the ledger at the individual-line level
                    over the stepped columns at group level; both render the deck model's waterfall
                    (composed once in deck.ts; nothing is recomputed here). The shares are on the
                    full-outflow basis (the share of the total program cost) throughout. */}
                {sl.waterfall !== undefined && <LedgerWaterfall waterfall={sl.waterfall} kicker={investmentKicker} />}
                {sl.waterfall !== undefined && <CostWaterfall waterfall={sl.waterfall} />}
                {/* v0.6.10 Task G.1: the funding breakdown block — beneath the waterfall:
                    gross capital program, grants, net private capital, the grant intensity,
                    and the funding rows with their kinds and years. Every figure is composed
                    by the deck model (deck.ts); the presentation renders, never recomputes. */}
                {sl.funding !== undefined && (
                  <div data-testid="deck-funding-block" className="deck-funding-block">
                    <p data-testid="chart-kicker" className="chart-kicker">The funding breakdown</p>
                    <p data-stat="funding-gross">{sl.funding.grossLabel}: {sl.funding.gross}</p>
                    <p data-stat="funding-grants">Grants: {sl.funding.grants}</p>
                    <p data-stat="funding-net">Net private capital: {sl.funding.net}</p>
                    <p data-stat="funding-intensity">Grant intensity: {sl.funding.intensity}</p>
                    <ul data-testid="deck-funding-rows">
                      {sl.funding.rows.map((r) => (
                        <li key={r.label} data-funding-kind={r.kind}>{r.label} ({r.kind === "grant" ? "grant" : "interest-free note"}, year {r.year}{r.term != null ? `, term ${r.term} years` : ""}): {r.value}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {sl.name === "timeline" && sl.gantt !== undefined && (
              <div data-testid="deck-chart-slot" data-slide-chart="timeline">
                <GanttChart gantt={sl.gantt} />
              </div>
            )}
            {sl.name === "operations" && sl.chart !== undefined && sl.chart.data.length > 0 && (
              <div data-testid="deck-chart-slot" data-slide-chart="operations">
                {/* v0.6.18 Task A: the yearly operating burn — the deck model's own series (the engine's
                    per-year operating amounts), rendered as bars at the entry unit; nothing is recomputed. */}
                <RecoveryBars series={sl.chart.data} peakFor={peakFor} kicker={sl.chart.kicker} periodNote="Each bar is one program year of operating cost." basis="annual" />
              </div>
            )}
            {sl.name === "recovery" && result !== null && (
              <div data-testid="deck-chart-slot" data-slide-chart="recovery">
                {/* v0.6.18 Task H1: the annual basis by default; the month level only on request (the toggle below recomposes the
                    deck series; nothing is recomputed here) */}
                <RecoveryBars series={sl.chart?.data ?? []} peakFor={peakFor} kicker={recoveryKicker} periodNote={`${sl.chart?.kicker ?? ""}. ${sl.chart?.periodNote ?? ""}`.trim()} basis={sl.chart?.basis ?? "annual"} />
                <button data-action="recovery-monthly" onClick={() => setRecoveryMonthly((v) => !v)}>{recoveryMonthly ? "Show annual" : "Show monthly"}</button>
              </div>
            )}
            {sl.name === "coverage" && result !== null && (
              <div data-testid="deck-chart-slot" data-slide-chart="coverage" style={sl.chart !== undefined && sl.chart.crossingX != null ? ({ "--deck-crossing-x": `${sl.chart.crossingX}%` } as CSSProperties) : undefined}>
                <StageReturnsChart yearly={result.yearly} labelFor={(y) => yearHeader(y, startYear)} />
                <p data-testid="crossing-caption" className="stage-crossing-caption">
                  {result.paybackYears === null
                    ? "The cumulative line never crosses zero."
                    : "The gold line crosses zero where the outlay is covered."}
                </p>
              </div>
            )}
            {sl.name === "scenarios" && sl.chart !== undefined && sl.chart.data.length > 0 && (
              <div data-testid="deck-chart-slot" data-slide-chart="scenarios">
                {/* v0.6.8 Task G (finding W23): the scenarios chart no longer reuses CompositionRows
                    (the composition-share stamp is meaningless in a sensitivity comparison). Zero-based
                    comparison bars, direct labels, no share column; the kicker is emitted by the deck
                    model and names the varied parameter as an action title. */}
                <ScenarioComparisonBars
                  data={sl.chart.data}
                  valueFor={(t) => feeForDisplay(t, currency, entryUnit)}
                  kicker={sl.chart.kicker}
                />
              </div>
            )}
            {sl.name === "scenarios" && sl.targetChart !== undefined && (
              <div data-testid="deck-chart-slot" data-slide-chart="scenarios-target">
                <ScenarioTargetBars chart={sl.targetChart} currency={currency} entryUnit={entryUnit} />
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
            {sl.disclosures.map((d, j) => (
              <p key={j} className="warning deck-disclosure">{d}</p>
            ))}
            {sl.name === "deal" && deck?.glosses !== undefined && deck.glosses.map((g, j) => (
              <p key={"gl-" + j} data-testid="term-gloss" className="deck-disclosure"><strong>{g.term}</strong>: {g.gloss}</p>
            ))}

            <footer className="deck-slide-footer">
              <span>slide {i + 1} of {deck.slides.length}</span>
              <span>Generated from the live model — {inputs.projectName || "Untitled project"}</span>
            </footer>
          </section>
        ))}
      </main>
      {deck?.provenance !== undefined && (
        <div data-testid="deck-provenance" className="deck-provenance">
          {deck.provenance.map((p, j) => (
            <p key={"prov-" + j} className="deck-disclosure">{p}</p>
          ))}
        </div>
      )}
      <footer className="stage-nav stage-nav-chrome">
        <button data-action="prev-slide" className={"stage-nav-button" + (slide === 0 ? " stage-nav-button-disabled" : "")} onClick={() => setSlide((s) => Math.max(s - 1, 0))} aria-disabled={slide === 0 ? "true" : "false"} aria-label="Previous slide">‹</button>
        <span className="stage-dots">{[...Array(totalSlides)].map((_, i) => <span key={i} data-dot={i} className={i === slide ? "stage-dot stage-dot-active" : "stage-dot"}>·</span>)}</span>
        <span className="stage-nav-counter">{slide + 1} / {totalSlides}</span>
        <button data-action="next-slide" className={"stage-nav-button" + (slide >= totalSlides - 1 ? " stage-nav-button-disabled" : "")} onClick={() => setSlide((s) => Math.min(s + 1, totalSlides - 1))} aria-disabled={slide >= totalSlides - 1 ? "true" : "false"} aria-label="Next slide">›</button>
      </footer>
    </div>
  );
}
