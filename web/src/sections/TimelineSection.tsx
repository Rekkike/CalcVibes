import type { ModelInputs, ModelResult, TimelineActivity, TimelineBlock, TimelineDecisionPoint, TimelineEngineEvent, TimelineMilestone, TimelineOutcome, TimelinePhase, TimelineTie } from "../../../core/src/types.js";
import {
  PPS_DISCLOSURE, TIMELINE_EVENT_LABELS, TIMELINE_PHASES, availableEngineEvents, nextId, nextUnusedBp, programSpanYears,
  timelineAuthored, timelineOf, validateTimeline, yearHeader,
} from "../state.js";

const OUTCOMES: { id: TimelineOutcome; label: string }[] = [
  { id: "continue", label: "Continue (fortsätta)" },
  { id: "change", label: "Change (förändra)" },
  { id: "terminate", label: "Terminate (lägga ner)" },
];

const tieValue = (t: TimelineTie | undefined): string =>
  t === undefined ? "" : t.kind === "activity" ? "activity:" + t.activityId : "engine-event:" + t.event;

// v0.6.13: the Timeline section — the PPS-aligned planning layer. It edits the optional timeline
// block only; the engine never reads it, and its refusals are section-local (they never join the
// compute-blocking input issues).
export function TimelineSection(props: {
  inputs: ModelInputs;
  result: ModelResult | null;
  setTimeline: (tl: TimelineBlock) => void;
  startYear: number | null;
}) {
  const { inputs, result, setTimeline, startYear } = props;
  const tl = timelineOf(inputs);
  const span = programSpanYears(inputs, result);
  const events = availableEngineEvents(inputs, result);
  const refusals = validateTimeline(inputs, result);
  const authored = timelineAuthored(inputs);
  const commit = (patch: Partial<TimelineBlock>) => setTimeline({ ...tl, ...patch });
  const updateActivity = (id: string, patch: Partial<TimelineActivity>) =>
    commit({ activities: tl.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const updateGate = (id: string, patch: Partial<TimelineDecisionPoint>) =>
    commit({ decisionPoints: tl.decisionPoints.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const updateMilestone = (id: string, patch: Partial<TimelineMilestone>) =>
    commit({ milestones: tl.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const num = (v: string) => parseFloat(v) || 0;
  const yearsNote = (y: number) => (Number.isInteger(y) && y >= 1 ? yearHeader(y, startYear) : "—");

  // The tie select: a chosen tie sets the marker to the tied target's program year once (the stored
  // year stays editable); a tie never alters the model.
  const chooseTie = (m: TimelineMilestone, value: string) => {
    if (value === "") {
      const { tie: _drop, ...rest } = m;
      commit({ milestones: tl.milestones.map((x) => (x.id === m.id ? rest : x)) });
    } else if (value.startsWith("activity:")) {
      const activityId = value.slice("activity:".length);
      const target = tl.activities.find((a) => a.id === activityId);
      updateMilestone(m.id, { tie: { kind: "activity", activityId }, ...(target !== undefined ? { year: target.endYear } : {}) });
    } else {
      const event = value.slice("engine-event:".length) as TimelineEngineEvent;
      const target = events.find((e) => e.event === event);
      updateMilestone(m.id, { tie: { kind: "engine-event", event }, ...(target !== undefined ? { year: target.year } : {}) });
    }
  };

  return (
    <section data-testid="timeline">
      <h2>Timeline</h2>
      <p data-testid="pps-disclosure" className="muted">{PPS_DISCLOSURE}</p>
      <p className="muted">
        A planning and presentation layer: the timeline never alters the cash flows, the solver or the horizon.{" "}
        {span !== null ? `The program span is years 1–${span}.` : "The program span appears once the model solves."}
      </p>
      <label>Project scale{" "}
        <select data-field="projectScale" value={tl.projectScale ?? "full"} onChange={(e) => commit({ projectScale: e.target.value as "mini" | "full" })}>
          <option value="full">Full (BP1–BP8)</option>
          <option value="mini">Mini (BP1, BP3, BP4, BP8)</option>
        </select>
      </label>
      {!authored && (
        <p data-testid="timeline-empty" className="muted">No timeline authored yet. Add an activity, a decision gate or a milestone to start; the deck shows a program Gantt slide once the timeline is authored and refusal-free.</p>
      )}

      <h3>Activities</h3>
      <div className="editor-scroll" data-testid="timeline-activities-scroll">
        <table data-testid="timeline-activities">
          <thead><tr><th>Label</th><th>Start year</th><th>End year</th><th>Phase</th><th></th></tr></thead>
          <tbody>
            {tl.activities.map((a) => (
              <tr key={a.id} data-kind="activity" data-line={a.id}>
                <td><input data-field="activityLabel" value={a.label} onChange={(e) => updateActivity(a.id, { label: e.target.value })} /></td>
                <td><input data-field="activityStart" type="number" value={a.startYear} onChange={(e) => updateActivity(a.id, { startYear: num(e.target.value) })} /><span className="muted"> {yearsNote(a.startYear)}</span></td>
                <td><input data-field="activityEnd" type="number" value={a.endYear} onChange={(e) => updateActivity(a.id, { endYear: num(e.target.value) })} /><span className="muted"> {yearsNote(a.endYear)}</span></td>
                <td>
                  <select data-field="activityPhase" value={a.phase} onChange={(e) => updateActivity(a.id, { phase: e.target.value as TimelinePhase })}>
                    {TIMELINE_PHASES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </td>
                <td><button data-action="remove-activity" onClick={() => commit({ activities: tl.activities.filter((x) => x.id !== a.id) })}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button data-action="add-activity" onClick={() => commit({ activities: [...tl.activities, { id: nextId("a", tl.activities.map((a) => a.id)), label: "", startYear: 1, endYear: 1, phase: "prestudy" }] })}>Add activity</button>

      <h3>Decision points</h3>
      <div className="editor-scroll" data-testid="timeline-gates-scroll">
        <table data-testid="timeline-gates">
          <thead><tr><th>Title</th><th>Code</th><th>Year</th><th>Outcome</th><th></th></tr></thead>
          <tbody>
            {tl.decisionPoints.map((d) => (
              <tr key={d.id} data-kind="gate" data-line={d.id}>
                <td><input data-field="gateTitle" value={d.title} onChange={(e) => updateGate(d.id, { title: e.target.value })} /></td>
                <td data-field="gateCode">{d.code ?? "—"}</td>
                <td><input data-field="gateYear" type="number" value={d.year} onChange={(e) => updateGate(d.id, { year: num(e.target.value) })} /><span className="muted"> {yearsNote(d.year)}</span></td>
                <td>
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
        const bp = nextUnusedBp(tl);
        const gate: TimelineDecisionPoint = { id: nextId("d", tl.decisionPoints.map((d) => d.id)), title: bp?.title ?? "", year: 1, ...(bp !== null ? { code: bp.code } : {}) };
        commit({ decisionPoints: [...tl.decisionPoints, gate] });
      }}>Add decision gate</button>

      <h3>Milestones</h3>
      <div className="editor-scroll" data-testid="timeline-milestones-scroll">
        <table data-testid="timeline-milestones">
          <thead><tr><th>Label</th><th>Year</th><th>Tie</th><th></th></tr></thead>
          <tbody>
            {tl.milestones.map((m) => {
              const current = tieValue(m.tie);
              const known = new Set(["", ...tl.activities.map((a) => "activity:" + a.id), ...events.map((e) => "engine-event:" + e.event)]);
              return (
                <tr key={m.id} data-kind="milestone" data-line={m.id}>
                  <td><input data-field="milestoneLabel" value={m.label} onChange={(e) => updateMilestone(m.id, { label: e.target.value })} /></td>
                  <td><input data-field="milestoneYear" type="number" value={m.year} onChange={(e) => updateMilestone(m.id, { year: num(e.target.value) })} /><span className="muted"> {yearsNote(m.year)}</span></td>
                  <td>
                    <select data-field="milestoneTie" value={current} onChange={(e) => chooseTie(m, e.target.value)}>
                      <option value="">No tie</option>
                      {tl.activities.map((a) => <option key={a.id} value={"activity:" + a.id}>Activity {a.id} ({a.label || "unnamed"})</option>)}
                      {events.map((e) => <option key={e.event} value={"engine-event:" + e.event}>{TIMELINE_EVENT_LABELS[e.event]} (year {e.year})</option>)}
                      {!known.has(current) && <option value={current}>{current} (not available)</option>}
                    </select>
                  </td>
                  <td><button data-action="remove-milestone" onClick={() => commit({ milestones: tl.milestones.filter((x) => x.id !== m.id) })}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button data-action="add-milestone" onClick={() => commit({ milestones: [...tl.milestones, { id: nextId("m", tl.milestones.map((m) => m.id)), label: "", year: 1 }] })}>Add milestone</button>

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
