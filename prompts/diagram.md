Draw the core idea as Mermaid (flowchart LR, sequenceDiagram or mindmap).
Max 8 nodes, labels max 4 words, no styling. Return only the Mermaid code.

It will be read on a phone, so:
- For a chain of more than 4 steps use "flowchart TD" (top-down) instead of LR.
- Use sequenceDiagram only when the point is who talks to whom, in order.
- Use mindmap only for "the parts of X" ideas with no flow between them.
- Plain words at level {level}; no jargon labels.
- No styling, classes, click handlers, notes or init directives.

Return JSON: "mermaid" is the Mermaid code only (no code fences), "caption" is
one plain sentence (max 15 words) saying what the diagram shows.
