import { TERM_GLOSSES } from "./engine.js";

// v0.6.21 Task C (Round 46 Supplement 7): each appraisal term the audience may not share carries its
// one-line gloss of record on first appearance, once per surface, styled to inform rather than alarm.
// The terminology is identical across surfaces (the shared TERM_GLOSSES table in engine.ts).
export function TermGloss(props: { term: string }) {
  const g = TERM_GLOSSES.find((x) => x.term === props.term);
  if (g === undefined) return null;
  return (
    <span className="term-gloss" data-testid="term-gloss" data-term={g.term}>
      {g.term} — {g.gloss}
    </span>
  );
}
