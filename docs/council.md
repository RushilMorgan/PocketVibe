# Council: anything, and from your saves

Status (2026-11-15): **built on a branch, not live.** Migration `20261115082631_council_item` (one
additive column) is applied. Not yet run against the real council models.

## Why

The Council was built to stress-test ideas: every prompt said so, and its verdict was Go / Refine
first / Park it / Drop it. That wording doesn't fit "is this article right?" or "which should I buy?".
It also only took typed text, so running a save by it meant copying things across by hand.

## What changed

**It takes anything.** When framing, the chair now picks a **mode**:

| Mode | For | The four verdicts read as |
|---|---|---|
| `decision` | An idea, plan or choice to act on | Go · Refine first · Park it · Drop it |
| `claim` | Is this true, does it hold up | Holds up · Partly true · Unproven · Doesn't hold up |
| `question` | What's the answer, which is better, what to make of this | Clear answer · Likely, with caveats · It depends · Can't say yet |

- The stored verdict values are unchanged (`go`, `refine`, `park`, `drop`): one scale from yes to no,
  worded per mode (`verdictLabel` in `lib/council/schemas.ts`). So there is no data change, and
  sessions from before modes read as decisions.
- Every council prompt was rewritten to cover all three and to say what the verdict words mean in
  each. For a question, the headline has to be the answer itself.
- The report's steps are headed per mode ("Next steps" / "How to check it" / "What to do with this"),
  as is each step's signal ("Stop if" / "It would be wrong if" / "Think again if").

**From your saves.** Every finished save has a **Run it by the Council** card: type what you want them
to weigh in on, or leave it blank for "What should I make of this? Is it right, and does it matter?".

- The council gets a brief built from the save (`lib/council/refer.ts`): your question, the title and
  link, the explainer's lines (or the recipe's description), why it matters, and up to 3,500
  characters of the source text. It still does its own web research.
- The session is linked to the save (`council_sessions.item_id`): the save lists its sessions with
  their verdicts, and the session links back. Deleting the save keeps the session.
- The what-if card's **Debate it** goes the same way, so the council sees the save and not just the
  scenario line.

Cost and limits are unchanged: roughly $1–2 a session, and the daily cap (`COUNCIL_DAILY_CAP`).

## Not verified

Built without access to the council's models. To check on the first few real sessions: that the chair
picks a sensible mode, that members use the verdict words in that mode's meaning, and that a
question's headline really is the answer.
