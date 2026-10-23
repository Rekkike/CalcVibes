import { useState } from "react";
import { GanttChart } from "../charts.js";
import { workspaceGantt } from "../deck.js";
import type { ModelInputs, ModelResult, TimelineActivity, TimelineBlock, TimelineDecisionPoint, TimelineEngineEvent, TimelineMilestone, TimelineOutcome, TimelinePhase, TimelineSource, TimelineTie } from "../../../core/src/types.js";
import {
  DECISION_DISCLOSURE, TIMELINE_EVENT_LABELS, resolveMilestone, activitiesInPhase, availableEngineEvents, ensurePhases, financingSuggestionBlock, nextId, nextUnusedDecisionPoint,
  phaseVocabularyIssues, phasesOf, programSpanYears, replaceSourceActivities, sourceHasActivities, suggestActivitiesFromContracts,
  suggestActivitiesFromCosts, suggestActivitiesFromFinancing, suggestActivitiesFromFunding, suggestActivitiesFromOperating,
  suggestActivitiesFromTariff, tariffSuggestionBlock, timelineAuthored, timelineOf, timelineWindow, validateTimeline, withScalePreset, yearHeader, yearMonthHeader,
} from "../state.js";

// v0.6.13.2 Task B: the per-source suggestion buttons. Each derives one source of the project into
// activities carrying that source's marker; the review note names what was derived.
// v0.6.18 Task G: the space allocation of the Timeline editors — WHAT GETS WHAT SPACE, composed deliberately (the
// walkthrough judges it). A free-text column (the label, the gate title) GROWS to take everything the fixed columns
// leave; a year is a short whole number and gets four digits of room; a month select gets exactly its longest
// option ("Year only" / "Month 12"); the year and its month sit on ONE line with their calendar note beneath, so the
// pair no longer stacks into two full-width lines; a choice (the phase, the lane, the outcome, the tie) takes its
// longest option, capped; the decision-point code is a short fixed token; an action is as wide as its button. The
// widths below are the single source the stylesheet reads (the pin compares them).
export const TIMELINE_SPACE = { label: "grow", year: "4.25rem", month: "6.75rem", phase: "9rem", lane: "9rem", outcome: "11rem", tie: "16rem", code: "3.5rem" } as const;

const plural = (n: number) => `${n} ${n === 1 ? "activity" : "activities"}`;
const SOURCES: { source: TimelineSource; action: string; label: string; noun: string; zero: string; note: (n: number) => string }[] = [
  {
    source: "cost-program", action: "suggest-activities", label: "Suggest activities from the cost program", noun: "cost-program",
    zero: "The cost program has no lines to derive activities from.",
    note: (n) => `Suggested ${plural(n)}, one per cost line. Operating lines are excluded from this button: the operating-lines button derives them. Every activity enters in the Production phase because the phase cannot be derived from a cost line; review the spans and phases and adjust them.`,
  },
  {
    source: "contracts", action: "suggest-contracts", label: "Suggest activities from the contracts", noun: "contracts",
    zero: "The project has no contracts to derive activities from.",
    note: (n) => `Suggested ${plural(n)} from the contracts: one per contract over its term, plus one short activity per reinvestment. They enter in the Revenue phase; review the spans and adjust them.`,
  },
  {
    source: "funding", action: "suggest-funding", label: "Suggest activities from the funding", noun: "funding",
    zero: "The project has no funding rows to derive activities from.",
    note: (n) => `Suggested ${plural(n)} from the funding: one per row, a grant at its receipt year and an interest-free note from the draw to the final repayment. They enter in the Funding phase; review the spans and adjust them.`,
  },
  {
    source: "financing", action: "suggest-financing", label: "Suggest the debt facility from the financing", noun: "financing",
    zero: "The financing derives no activity.",
    note: () => "Suggested the debt facility activity over its service term. It enters in the Financing phase; review the span and adjust it.",
  },
  {
    source: "operating", action: "suggest-operating", label: "Suggest activities from the operating lines", noun: "operating-lines",
    zero: "The project has no operating lines to derive activities from.",
    note: (n) => `Suggested ${plural(n)} from the operating lines, one per line over its years. They enter in the Operations phase; review the spans and adjust them.`,
  },
  {
    source: "tariff", action: "suggest-tariff", label: "Suggest activities from the tariff rows", noun: "tariff",
    zero: "The tariff derives no activities.",
    note: (n) => `Suggested ${plural(n)} from the tariff rows that declare a span, one per row over its span. They enter in the Revenue phase; review the spans and adjust them.`,
  },
];

const OUTCOMES: { id: TimelineOutcome; label: string }[] = [
  { id: "continue", label: "Continue" },
  { id: "change", label: "Change" },
  { id: "terminate", label: "Terminate" },
];

const tieValue = (t: TimelineTie | undefined): string =>
  t === undefined ? "" : t.kind === "activity" ? (t.anchor === "start" ? "activity-start:" : "activity:") + t.activityId : "engine-event:" + t.event;

// v0.6.13: the Timeline section — the decision-point planning layer. It edits the optional timeline
// block only; the engine never reads it, and its refusals are section-local (they never join the
// compute-blocking input issues).
export function TimelineSection(props: {
  inputs: ModelInputs;
  result: ModelResult | null;
  setTimeline: (tl: TimelineBlock) => void;
  startYear: number | null;
  monthGrid?: boolean;
  setMonthGrid?: (on: boolean) => void;
}) {
  const { inputs, result, setTimeline, startYear, monthGrid = false, setMonthGrid } = props;
  const tl = timelineOf(inputs);
  const span = programSpanYears(inputs, result);
  const events = availableEngineEvents(inputs, result);
  const refusals = validateTimeline(inputs, result);
  const authored = timelineAuthored(inputs);
  // A patch value of undefined removes the key (an emptied lane-visibility map leaves the block).
  const commit = (patch: Partial<TimelineBlock>) => {
    const next = { ...tl, ...patch } as Record<string, unknown>;
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    setTimeline(next as unknown as TimelineBlock);
  };
  // v0.6.13.1/2: the one-click suggestions — the only route from the project's sources into the
  // timeline. The click IS authorship per source (it commits through the setTimeline seam and
  // replaces exactly that source's marked entries); the count drives the review note, which
  // disappears again once that source's entries are removed.
  const [suggested, setSuggested] = useState<Partial<Record<TimelineSource, number>>>({});
  const [phaseNote, setPhaseNote] = useState<string | null>(null);
  const [newPhase, setNewPhase] = useState<{ id: string; label: string }>({ id: "", label: "" });
  const derive = (source: TimelineSource, taken: string[]): TimelineActivity[] =>
    source === "cost-program" ? suggestActivitiesFromCosts(inputs, taken)
    : source === "contracts" ? suggestActivitiesFromContracts(inputs, taken)
    : source === "funding" ? suggestActivitiesFromFunding(inputs, taken)
    : source === "financing" ? suggestActivitiesFromFinancing(inputs, result, taken)
    : source === "operating" ? suggestActivitiesFromOperating(inputs, taken)
    : suggestActivitiesFromTariff(inputs, taken);
  const suggest = (source: TimelineSource) => {
    const taken = tl.activities.filter((a) => a.derivedFrom !== source).map((a) => a.id);
    const derived = derive(source, taken);
    commit({ activities: replaceSourceActivities(tl.activities, source, derived), phases: ensurePhases(tl, derived) });
    setSuggested((s) => ({ ...s, [source]: derived.length }));
  };
  const blockReason = (source: TimelineSource): string | null =>
    source === "financing" ? financingSuggestionBlock(inputs, result) : source === "tariff" ? tariffSuggestionBlock(inputs) : null;
  const phases = phasesOf(tl);
  const vocabularyIssues = phaseVocabularyIssues(tl);
  const setLane = (id: string, mode: string) => {
    const next = { ...(tl.laneVisibility ?? {}) };
    if (mode === "auto") delete next[id];
    else next[id] = mode === "show";
    commit({ laneVisibility: Object.keys(next).length > 0 ? next : undefined });
  };
  const addPhase = () => {
    const id = newPhase.id.trim().toLowerCase().replace(/\s+/g, "-");
    const label = newPhase.label.trim();
    if (id === "" || label === "") { setPhaseNote("A phase needs an id and a label."); return; }
    if (phases.some((p) => p.id === id)) { setPhaseNote(`The phase id "${id}" already exists in the vocabulary: choose a different id.`); return; }
    commit({ phases: [...phases, { id, label }] });
    setNewPhase({ id: "", label: "" });
    setPhaseNote(null);
  };
  const removePhase = (id: string) => {
    const users = activitiesInPhase(tl, id);
    if (users.length > 0) {
      setPhaseNote(`The phase "${id}" cannot be deleted while activities reference it: ${users.map((a) => `${a.id} (${a.label || "unnamed"})`).join(", ")}; move or remove them first.`);
      return;
    }
    const vis = { ...(tl.laneVisibility ?? {}) };
    delete vis[id];
    commit({ phases: phases.filter((p) => p.id !== id), laneVisibility: Object.keys(vis).length > 0 ? vis : undefined });
    setPhaseNote(null);
  };
  // v0.6.17: a patch value of undefined clears the key (the empty month selector is the year-grained default)
  const merged = <T extends object>(base: T, patch: Partial<T>): T => {
    const next = { ...base, ...patch } as Record<string, unknown>;
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    return next as T;
  };
  const updateActivity = (id: string, patch: Partial<TimelineActivity>) =>
    commit({ activities: tl.activities.map((a) => (a.id === id ? merged(a, patch) : a)) });
  const updateGate = (id: string, patch: Partial<TimelineDecisionPoint>) =>
    commit({ decisionPoints: tl.decisionPoints.map((d) => (d.id === id ? merged(d, patch) : d)) });
  // v0.6.18 Task F: a milestone authored outside the chart window is asked about, never dropped silently: the
  // guard follows the milestone whose year was just authored; "Extend the window" widens it (a confirmed
  // extension carried in the block), "Keep the window" leaves it and the deck caption keeps counting the
  // milestone as omitted. Nothing extends on its own.
  const [guardFor, setGuardFor] = useState<{ id: string; year: number } | null>(null);
  const [keptOutside, setKeptOutside] = useState<string[]>([]);
  const updateMilestone = (id: string, patch: Partial<TimelineMilestone>) => {
    commit({ milestones: tl.milestones.map((m) => (m.id === id ? merged(m, patch) : m)) });
    if (patch.year !== undefined) setGuardFor({ id, year: patch.year });
  };
  const chartWindow = span !== null ? timelineWindow(tl, span) : null;
  const guardTarget = guardFor === null ? undefined : tl.milestones.find((m) => m.id === guardFor.id && m.year === guardFor.year);
  const guardOutside = guardTarget !== undefined && chartWindow !== null && span !== null && Number.isInteger(guardTarget.year) && guardTarget.year >= 1 && guardTarget.year <= span
    && (guardTarget.year < chartWindow.firstYear || guardTarget.year > chartWindow.lastYear) && !keptOutside.includes(`${guardTarget.id}:${guardTarget.year}`);
  const extendWindow = () => {
    if (guardTarget === undefined || chartWindow === null) return;
    const ext = { ...(tl.windowExtension ?? {}) };
    if (guardTarget.year < chartWindow.firstYear) ext.firstYear = guardTarget.year;
    else ext.lastYear = guardTarget.year;
    commit({ windowExtension: ext } as Partial<TimelineBlock>);
    setGuardFor(null);
  };
  const keepWindow = () => {
    if (guardTarget !== undefined) setKeptOutside((k) => [...k, `${guardTarget.id}:${guardTarget.year}`]);
    setGuardFor(null);
  };
  // v0.6.17: the optional month selector — the empty state is the year-grained default
  const monthSelect = (field: string, value: number | undefined, onPick: (m: number | undefined) => void) => (
    <select className="tl-month" data-field={field} value={value === undefined ? "" : String(value)} onChange={(e) => onPick(e.target.value === "" ? undefined : parseInt(e.target.value, 10))}>
      <option value="">Year only</option>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => <option key={mo} value={String(mo)}>Month {mo}</option>)}
      {value !== undefined && !(Number.isInteger(value) && value >= 1 && value <= 12) && <option value={String(value)}>{value} (outside 1–12)</option>}
    </select>
  );
  const monthNote = (y: number, mo: number | undefined) => (Number.isInteger(y) && y >= 1 ? yearMonthHeader(y, mo, startYear) : "—");
  const num = (v: string) => parseFloat(v) || 0;

  // v0.6.19: the tie is a REFERENCE, not a copy. Choosing a tie sets the tie alone: the milestone's authored year and
  // month stay exactly what they were (never silently rewritten); the drawn position composes live from the target
  // (resolveMilestone), and the authored fields are the fallback when the tie is removed or unresolvable.
  const chooseTie = (m: TimelineMilestone, value: string) => {
    if (value === "") {
      const { tie: _drop, ...rest } = m;
      commit({ milestones: tl.milestones.map((x) => (x.id === m.id ? rest : x)) });
    } else if (value.startsWith("activity-start:")) {
      updateMilestone(m.id, { tie: { kind: "activity", activityId: value.slice("activity-start:".length), anchor: "start" } });
    } else if (value.startsWith("activity:")) {
      updateMilestone(m.id, { tie: { kind: "activity", activityId: value.slice("activity:".length) } });
    } else {
      updateMilestone(m.id, { tie: { kind: "engine-event", event: value.slice("engine-event:".length) as TimelineEngineEvent } });
    }
  };

  return (
    <section data-testid="timeline">
      <h2>Timeline</h2>
      <p data-testid="decision-disclosure" className="muted">{DECISION_DISCLOSURE}</p>
      <p className="muted">
        A planning and presentation layer: the timeline never alters the cash flows, the solver or the horizon.{" "}
        {span !== null ? `The program span is years 1–${span}.` : "The program span appears once the model solves."}
      </p>
      {/* v0.6.18 Task I.1: the program Gantt in the workspace — the deck's composed-once model, rendered here by the same
          chart; the month gridlines follow the deck's view-state toggle below (never a document field). */}
      {(() => {
        const gantt = result !== null ? workspaceGantt(inputs, result, startYear, monthGrid) : null;
        return gantt !== null ? (
          <div data-testid="workspace-gantt" className="workspace-gantt">
            <GanttChart gantt={gantt} />
          </div>
        ) : (
          <p data-testid="workspace-gantt-note" className="muted">The program Gantt appears here once the timeline is authored and refusal-free.</p>
        );
      })()}
      {setMonthGrid !== undefined && (
        <label>Month gridlines on the Gantt (a view setting; not saved with the project){" "}
          <input data-field="monthGrid" type="checkbox" checked={monthGrid} onChange={(e) => setMonthGrid(e.target.checked)} />
        </label>
      )}
      <label>Project scale{" "}
        {/* v0.6.18 Task E: Empty (the default; no automatic population), Full (the gates DP1-DP8) and Mini (the gates
            DP1, DP3, DP4, DP8). Choosing Full or Mini adds the missing gates of the set; an authored gate is never
            moved or removed. */}
        <select data-field="projectScale" value={tl.projectScale ?? "empty"} onChange={(e) => {
          const v = e.target.value;
          if (v === "empty") commit({ projectScale: undefined });
          else commit({ projectScale: v as "mini" | "full", decisionPoints: withScalePreset(tl, v as "mini" | "full") });
        }}>
          <option value="empty">Empty (no automatic gates)</option>
          <option value="full">Full (DP1–DP8)</option>
          <option value="mini">Mini (DP1, DP3, DP4, DP8)</option>
        </select>
      </label>
      {!authored && (
        <p data-testid="timeline-empty" className="muted">No timeline authored yet. Add an activity, a decision gate or a milestone to start, or suggest activities from the cost program, the contracts, the funding, the financing, the operating lines or the tariff rows; the deck shows a program Gantt slide once the timeline is authored and refusal-free.</p>
      )}
      <div data-testid="timeline-suggest-buttons">
        {SOURCES.map((s) => {
          const reason = blockReason(s.source);
          const has = sourceHasActivities(tl, s.source);
          return (
            <button
              key={s.source}
              data-action={s.action}
              data-source={s.source}
              disabled={has || reason !== null}
              title={has ? `The ${s.noun} suggestion is already in the grid: remove its activities to use it again. A suggestion replaces only its own source's entries and never touches hand-authored activities.` : reason ?? undefined}
              onClick={() => suggest(s.source)}
            >{s.label}</button>
          );
        })}
      </div>
      {SOURCES.map((s) => {
        const n = suggested[s.source];
        if (n === undefined || !(n === 0 || sourceHasActivities(tl, s.source))) return null;
        return (
          <p key={s.source} data-testid="timeline-suggestion-note" data-source={s.source} className="muted">{n === 0 ? s.zero : s.note(n)}</p>
        );
      })}

      <h3>Phases</h3>
      <p className="muted">The phase vocabulary is the lane set of the program Gantt. A lane is shown when it carries an activity; choose Always show to draw it empty or Hide to leave it off. The visibility is presentation-only: hiding a lane never removes its activities.</p>
      <div className="editor-scroll" data-testid="timeline-phases-scroll">
        <table className="timeline-table" data-testid="timeline-phases">
          <thead><tr><th>Id</th><th>Label</th><th>Activities</th><th>Lane</th><th></th></tr></thead>
          <tbody>
            {phases.map((p, i) => (
              <tr key={p.id + ":" + i} data-kind="phase" data-line={p.id}>
                <td data-field="phaseId">{p.id}</td>
                <td className="tl-grow"><input data-field="phaseLabel" value={p.label} onChange={(e) => commit({ phases: phases.map((q, j) => (j === i ? { ...q, label: e.target.value } : q)) })} /></td>
                <td data-field="phaseCount">{activitiesInPhase(tl, p.id).length}</td>
                <td className="tl-pick-lane">
                  <select data-field="laneVisibility" value={tl.laneVisibility?.[p.id] === undefined ? "auto" : tl.laneVisibility[p.id] ? "show" : "hide"} onChange={(e) => setLane(p.id, e.target.value)}>
                    <option value="auto">Automatic</option>
                    <option value="show">Always show</option>
                    <option value="hide">Hide</option>
                  </select>
                </td>
                <td><button data-action="remove-phase" onClick={() => removePhase(p.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label>New phase id <input data-field="newPhaseId" value={newPhase.id} onChange={(e) => setNewPhase({ ...newPhase, id: e.target.value })} /></label>{" "}
      <label>Label <input data-field="newPhaseLabel" value={newPhase.label} onChange={(e) => setNewPhase({ ...newPhase, label: e.target.value })} /></label>{" "}
      <button data-action="add-phase" onClick={addPhase}>Add phase</button>
      {phaseNote !== null && <p data-testid="timeline-phase-refusal" className="warning">{phaseNote}</p>}
      {vocabularyIssues.length > 0 && (
        <ul data-testid="timeline-phase-issues" className="warning">{vocabularyIssues.map((m, i) => <li key={i}>{m}</li>)}</ul>
      )}

      <h3>Activities</h3>
      <div className="editor-scroll" data-testid="timeline-activities-scroll">
        <table className="timeline-table" data-testid="timeline-activities">
          <thead><tr><th>Label</th><th>Start year</th><th>End year</th><th>Phase</th><th></th></tr></thead>
          <tbody>
            {tl.activities.map((a) => (
              <tr key={a.id} data-kind="activity" data-line={a.id}>
                <td className="tl-grow"><input data-field="activityLabel" value={a.label} onChange={(e) => updateActivity(a.id, { label: e.target.value })} /></td>
                <td className="tl-when"><span className="tl-pair"><input className="tl-year" data-field="activityStart" type="number" value={a.startYear} onChange={(e) => updateActivity(a.id, { startYear: num(e.target.value) })} />{monthSelect("activityStartMonth", a.startMonth, (mo) => updateActivity(a.id, { startMonth: mo }))}</span><span className="muted tl-note" data-span-note="start">{monthNote(a.startYear, a.startMonth)}</span></td>
                <td className="tl-when"><span className="tl-pair"><input className="tl-year" data-field="activityEnd" type="number" value={a.endYear} onChange={(e) => updateActivity(a.id, { endYear: num(e.target.value) })} />{monthSelect("activityEndMonth", a.endMonth, (mo) => updateActivity(a.id, { endMonth: mo }))}</span><span className="muted tl-note" data-span-note="end">{monthNote(a.endYear, a.endMonth)}</span></td>
                <td className="tl-pick-phase">
                  <select data-field="activityPhase" value={a.phase} onChange={(e) => updateActivity(a.id, { phase: e.target.value as TimelinePhase })}>
                    {phases.map((p, i) => <option key={p.id + ":" + i} value={p.id}>{p.label}</option>)}
                  </select>
                </td>
                <td><button data-action="remove-activity" onClick={() => commit({ activities: tl.activities.filter((x) => x.id !== a.id) })}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button data-action="add-activity" onClick={() => commit({ activities: [...tl.activities, { id: nextId("a", tl.activities.map((a) => a.id)), label: "", startYear: 1, endYear: 1, phase: phases[0]?.id ?? "prestudy" }] })}>Add activity</button>

      <h3>Decision points</h3>
      <div className="editor-scroll" data-testid="timeline-gates-scroll">
        <table className="timeline-table" data-testid="timeline-gates">
          <thead><tr><th>Title</th><th>Code</th><th>Year</th><th>Outcome</th><th></th></tr></thead>
          <tbody>
            {tl.decisionPoints.map((d) => (
              <tr key={d.id} data-kind="gate" data-line={d.id}>
                <td className="tl-grow"><input data-field="gateTitle" value={d.title} onChange={(e) => updateGate(d.id, { title: e.target.value })} /></td>
                <td className="tl-code" data-field="gateCode">{d.code ?? "—"}</td>
                <td className="tl-when"><span className="tl-pair"><input className="tl-year" data-field="gateYear" type="number" value={d.year} onChange={(e) => updateGate(d.id, { year: num(e.target.value) })} />{monthSelect("gateMonth", d.month, (mo) => updateGate(d.id, { month: mo }))}</span><span className="muted tl-note" data-span-note="gate">{monthNote(d.year, d.month)}</span></td>
                <td className="tl-pick-outcome">
                  <select data-field="gateOutcome" value={d.outcome ?? ""} onChange={(e) => {
                    if (e.target.value === "") {
                      const { outcome: _drop, ...rest } = d;
                      commit({ decisionPoints: tl.decisionPoints.map((x) => (x.id === d.id ? rest : x)) });
                    } else {
                      updateGate(d.id, { outcome: e.target.value as TimelineOutcome });
                    }
                  }}>
                    <option value="">Not yet held</option>
                    {OUTCOMES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </td>
                <td><button data-action="remove-gate" onClick={() => commit({ decisionPoints: tl.decisionPoints.filter((x) => x.id !== d.id) })}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button data-action="add-gate" onClick={() => {
        const dp = nextUnusedDecisionPoint(tl);
        const gate: TimelineDecisionPoint = { id: nextId("d", tl.decisionPoints.map((d) => d.id)), title: dp?.title ?? "", year: 1, ...(dp !== null ? { code: dp.code } : {}) };
        commit({ decisionPoints: [...tl.decisionPoints, gate] });
      }}>Add decision gate</button>

      <h3>Milestones</h3>
      <div className="editor-scroll" data-testid="timeline-milestones-scroll">
        <table className="timeline-table" data-testid="timeline-milestones">
          <thead><tr><th>Label</th><th>Year</th><th>Tie</th><th></th></tr></thead>
          <tbody>
            {tl.milestones.map((m) => {
              const current = tieValue(m.tie);
              const known = new Set(["", ...tl.activities.flatMap((a) => ["activity:" + a.id, "activity-start:" + a.id]), ...events.map((e) => "engine-event:" + e.event)]);
              return (
                <tr key={m.id} data-kind="milestone" data-line={m.id}>
                  <td className="tl-grow"><input data-field="milestoneLabel" value={m.label} onChange={(e) => updateMilestone(m.id, { label: e.target.value })} /></td>
                  <td className="tl-when"><span className="tl-pair"><input className="tl-year" data-field="milestoneYear" type="number" value={m.year} onChange={(e) => updateMilestone(m.id, { year: num(e.target.value) })} />{monthSelect("milestoneMonth", m.month, (mo) => updateMilestone(m.id, { month: mo }))}</span><span className="muted tl-note" data-span-note="milestone">{monthNote(m.year, m.month)}</span></td>
                  <td className="tl-pick-tie">
                    <select data-field="milestoneTie" value={current} onChange={(e) => chooseTie(m, e.target.value)}>
                      <option value="">No tie</option>
                      {tl.activities.map((a) => <option key={a.id} value={"activity:" + a.id}>Activity {a.id} ({a.label || "unnamed"})</option>)}
                      {tl.activities.map((a) => <option key={"s" + a.id} value={"activity-start:" + a.id}>Activity start {a.id} ({a.label || "unnamed"})</option>)}
                      {events.map((e) => <option key={e.event} value={"engine-event:" + e.event}>{TIMELINE_EVENT_LABELS[e.event]} (year {e.year})</option>)}
                      {!known.has(current) && <option value={current}>{current} (not available)</option>}
                    </select>
                    {m.tie !== undefined && (() => {
                      // v0.6.19: the read-only exposure of the live-composed position (never authored, never written)
                      const r = resolveMilestone(tl, m, events);
                      const at = r.month === undefined ? `year ${r.year}` : `year ${r.year}, month ${r.month}`;
                      const from = r.source === "activity-finish" ? "the finish of its activity" : r.source === "activity-start" ? "the start of its activity" : "the live engine event";
                      return r.source === "authored" ? (
                        <span className="muted" data-testid="tie-position" data-milestone={m.id}> The tie does not resolve (the model has not solved or the target is missing): drawn at the authored position, {at}.</span>
                      ) : (
                        <span className="muted" data-testid="tie-position" data-milestone={m.id}> Drawn at the live position: {at} (from {from}; read-only). The year and month above hold the fallback.</span>
                      );
                    })()}
                  </td>
                  <td><button data-action="remove-milestone" onClick={() => commit({ milestones: tl.milestones.filter((x) => x.id !== m.id) })}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button data-action="add-milestone" onClick={() => {
        const id = nextId("m", tl.milestones.map((m) => m.id));
        commit({ milestones: [...tl.milestones, { id, label: "", year: 1 }] });
        setGuardFor({ id, year: 1 });
      }}>Add milestone</button>
      {guardOutside && guardTarget !== undefined && chartWindow !== null && (
        <div data-testid="milestone-window-guard" role="alertdialog" className="warning">
          <p data-testid="milestone-window-guard-message">Milestone {guardTarget.id} ({guardTarget.label || "unnamed"}) falls in {yearMonthHeader(guardTarget.year, guardTarget.month, startYear)}, outside the chart window of {yearHeader(chartWindow.firstYear, startYear)}–{yearHeader(chartWindow.lastYear, startYear)}. Extend the window to show it, or keep the window: the milestone then stays authored and the chart caption counts it as omitted.</p>
          <button data-action="window-extend" onClick={extendWindow}>Extend the window</button>{" "}
          <button data-action="window-keep" onClick={keepWindow}>Keep the window</button>
        </div>
      )}

      {result === null && authored && (
        <p data-testid="timeline-standdown" className="muted">The span checks stand down while the model has input issues; the input-issues panel governs.</p>
      )}
      {refusals.length > 0 && (
        <div data-testid="timeline-refusals" className="warning">
          <h3>Timeline refusals ({refusals.length})</h3>
          <ul>
            {refusals.map((r, i) => <li key={i} data-refusal={r.code}>{r.message}</li>)}
          </ul>
          <p className="muted">The model keeps solving; the deck omits the timeline slide until these are resolved.</p>
        </div>
      )}
    </section>
  );
}
