// v0.6.18 Task I.2 — the vertical rhythm of the app sections, composed deliberately: WHAT GETS HOW MUCH SPACE. The values
// are the single source the stylesheet reads (the pin compares them); the walkthrough judges the allocation.
//
//  - a subsection heading (h3) takes a clear break ABOVE it (1.5 rem) and hugs its content BELOW (0.5 rem), so a heading
//    reads as the head of the block that follows, not as a free-floating line between two blocks;
//  - a sub-subheading (h4) takes the middle break above (1 rem);
//  - explanatory prose (the muted paragraphs) hugs the block it explains: 0.5 rem below, in a comfortable 1.45 line;
//  - a table (the editor scroll) hands 0.5 rem to the action row beneath it, and the add/remove action hugs the table it
//    acts on (0.25 rem above) — an action belongs to its table;
//  - sibling controls (a label with its select or input) keep 0.5 rem between rows.
export const SECTION_RHYTHM = {
  headingAbove: "var(--space-4)",
  headingBelow: "var(--space-2)",
  subheadingAbove: "var(--space-3)",
  proseBelow: "var(--space-2)",
  tableBelow: "var(--space-2)",
  actionAbove: "var(--space-1)",
  controlRow: "var(--space-2)",
  proseLineHeight: "1.45",
} as const;
