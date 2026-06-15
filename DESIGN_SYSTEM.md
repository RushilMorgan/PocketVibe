# Hey Toolie — "Velix" Design System

> The single reference for the app's look & feel. If you're styling anything new,
> read this first and **compose the existing primitives** — don't hand-roll
> colours, shadows, or one-off chrome. Keep this doc in sync when the system changes.

The system is named **Velix** (after the Dribbble shot it's adapted from). It is
**light, frosted, and monochrome-primary**: near-black does the work of a brand
colour, and each tool's identity colour appears only as a **soft pastel accent**.

---

## 1. Principles

1. **Light & frosted.** Pearlescent off-white canvas, translucent white cards,
   hairline borders, soft shadows. No dark chrome anywhere anymore.
2. **Black is primary.** Near-black `#16150f` is the action/brand colour —
   buttons, the FAB, active pills, send buttons, chrome marks.
3. **Colour = identity, used softly.** Per-type accents (recipe rose, idea
   violet, …) appear as glows, soft-pastel chips, eyebrows, ticks — never as the
   primary button colour.
4. **Data-viz colour is sacred.** Charts that *encode meaning* (ICE ring, SWOT
   quadrants, score bars, mind-map branches) keep their colours — recolouring
   them would destroy information.
5. **One source of truth.** Tokens live in `index.css` (`.tp-*`), per-type
   identity in `templateIdentity.ts`, primitives in `components/tools/ui.tsx`.
   Never re-declare these.

---

## 2. Where it lives

| Concern | File |
|---|---|
| Scoped CSS token layer (`.tp-*`) | `src/index.css` (search "Velix") |
| Per-type identity (emoji/label/accent/gradient) | `src/lib/templateIdentity.ts` (exhaustive `Record<CreationType,…>`) |
| Derived per-type maps (emoji/label/accent) | `src/lib/creationTypeMeta.ts` (DERIVES from templateIdentity — don't edit values here) |
| Tool-page UI primitives | `src/components/tools/ui.tsx` |
| Generic tool component + engines | `src/components/tools/GenericTool.tsx` |
| Tool-page shell + registry | `src/components/ToolPage.tsx` + `src/lib/toolPages.ts` |
| Font | Plus Jakarta Sans (loaded in `index.html` + each `*.html` entry) |

---

## 3. Tokens (the `.tp-*` layer)

All scoped under `.tp-surface` so they never leak into anything not opted in.
`.tp-surface` also sets the **Plus Jakarta Sans** font.

### Colour / ink
| Token | Value | Use |
|---|---|---|
| `tp-ink` | `#16150f` | primary text, marks, primary fills |
| `tp-ink-2` | `#5f635c` | secondary text |
| `tp-ink-3` | `#9a9d96` | muted text, kickers, hints |
| line / border | `rgba(22,21,15,0.08)` | hairline borders, dividers (`tp-divider`) |
| soft fill | `rgba(22,21,15,0.03–0.05)` | subtle chips/panels (busy state, "Viewing" badge) |

### Surfaces (classes)
| Class | What it is |
|---|---|
| `tp-surface` | the page canvas: pearlescent gradient (white + faint mint/rose radials) + Jakarta font |
| `tp-glass` | frosted pill/button: `rgba(255,255,255,.86)` + hairline + soft shadow |
| `tp-card` | frosted card: `rgba(255,255,255,.92)` + `rgba(22,21,15,.08)` border + `0 10px 34px` shadow |
| `tp-btn-dark` | near-black button `#16150f` (`:active` → `#000`) + dark shadow |
| `tp-input` | frosted input `rgba(255,255,255,.85)` + hairline; placeholder `#9a9d96` |
| `tp-divider` | hairline divider bg |

> Avoid `backdrop-filter`/`blur` on these — it's heavy and breaks headless
> screenshots. High-opacity white reads near-identical; that's why `tp-glass`/
> `tp-card` use ~0.86–0.92 alpha instead of real glass.

### Radii / shadow / motion
- **Radii:** cards `rounded-[22px]`–`[26px]`, tiles `[14px]`–`[20px]`, inputs
  `rounded-2xl`, pills `rounded-full`.
- **Shadows:** soft & dark — `0 10px 34px rgba(22,21,15,.07)` (cards),
  `0 12px 30px rgba(22,21,15,.30)` (the FAB). Accent glows use the accent at low
  alpha, e.g. `0 12px 28px ${accent}38`.
- **Motion:** tap feedback `active:scale-95` / `active:scale-[0.99]`; `twinkle`
  keyframe (FAB stardust) respects `prefers-reduced-motion`.

### Typography
- Font: **Plus Jakarta Sans** (via `tp-surface`; tool-page HTML entries load it).
- Display H1: `text-[34px] font-extrabold tracking-tight leading-[1.04]`.
- Section H2: `text-lg font-extrabold tracking-tight`.
- Body: `text-sm`/`text-[15px]`, `tp-ink-2`.
- Kicker/eyebrow: `text-[10px]–[11px] font-bold uppercase tracking-[0.16em]–[0.22em]`,
  colour = the per-type accent (tool pages) or `tp-ink-3` (neutral chrome).
- **Weights:** 400 / 600 / 700 / 800 (extrabold for display). Two-tone is fine here
  (unlike the host-chrome rule elsewhere).

---

## 4. Per-type accent system

`templateIdentity.ts` is the **single exhaustive** `Record<CreationType, …>` of
emoji, label, tagline, `accent`, `accentSoft`, `accentBorder`, gradient, `showHero`.
`creationTypeMeta.ts` DERIVES `TYPE_EMOJI` / `TYPE_LABEL` / `TYPE_ACCENT` from it —
so list, header, hero, and canvas can never drift. **To change a type's look,
edit `templateIdentity.ts` only.**

| Type | Accent | Soft |
|---|---|---|
| recipe / recipe_book | `#e11d48` rose | `#fff1f2` |
| idea_thinking_board | `#7c3aed` violet | `#f5f3ff` |
| meal_planner | `#ea580c` orange | `#fff7ed` |
| budget_calculator | `#059669` green | `#ecfdf5` |
| savings_tracker | `#0284c7` sky | `#f0f9ff` |
| workout_tracker | `#dc2626` red | `#fef2f2` |
| event_planner | `#e11d48` rose | `#fff1f2` |
| price_calculator | `#4f46e5` indigo | `#eef2ff` |
| checklist / others | `#7c3aed` violet (default) | … |

**Accent is consumed two ways:** the `tpl-accent-*` utility classes (set via
`templateCssVars(type)` on a wrapper — used by in-app renderers), and inline
styles in tool pages (`style={{ background: accent.accentSoft }}` etc.).

---

## 5. Primitives — `components/tools/ui.tsx`

Compose these for every tool page; don't hand-roll equivalents.

| Primitive | Purpose |
|---|---|
| `ToolButton` | `variant` dark / ghost × `shape` pill / block, `full`. Black primary or frosted ghost. |
| `ToolCard` | frosted card surface (`tp-card`). |
| `ToolChip` | pastel-accent pill; `active` flips it near-black. |
| `ToolInput` | frosted input / textarea (`multiline`) with accent focus ring. |
| `HeroTile` | rounded-square emoji tile with accent glow (`size` lg / sm). |
| `SectionLabel` | divider + uppercase section label. |
| `AccentEyebrow` | small uppercase kicker in the accent colour. |
| `ToolProgress` | live generation theater (frosted, narrates real pipeline stages, accent dots/checks + skeleton). |
| `ToolQuotaNotice` | shared daily-limit modal. |

`ToolAccent` (`{ accent, accentSoft }`) is defined in `lib/toolPages.ts` and
threaded from `ToolPage` into every section + the live tool.

---

## 6. Patterns

### Buttons
- **Primary** → `tp-btn-dark` (black, white text). Send buttons, "Build…", "Map…",
  hero CTAs, share.
- **Secondary / ghost** → `tp-glass tp-ink` pill.
- **Selectable pill** (dietary, intent, category, tabs) → active `tp-btn-dark`,
  inactive `tp-glass tp-ink` (or accent-pastel via `ToolChip` on tool pages).

### Cards & chips
- Card → `tp-card` + a radius. Chip → `ToolChip` (pastel `accentSoft` bg + accent
  text; active → black) or `tp-glass` for neutral chrome.

### Sheets (bottom sheets / chat) — **all light now**
White sheet (`bg-white rounded-t-3xl` + Jakarta), drag handle
`rgba(22,21,15,.15)`, `✦` + `tp-ink-3` eyebrow header, **black user bubbles
(`#16150f`) + grey assistant bubbles (`rgba(22,21,15,.05)`)**, `tp-glass` chips,
`tp-input`, **`tp-btn-dark` send**, amber-50 for warnings.
Surfaces using this: `CreationComposer` (FAB chat), `ElementChatSheet` (idea
tap-to-refine), `RecipeRenderer` Ask-Toolie, and the shared `BottomSheet`
(intake sheets).

### FAB
Black `tp-btn-dark`-style **"✦ Ask Toolie" pill** (`CreationComposer`) with a
white 4-point sparkle SVG and **twinkling stardust**; it **collapses to a circle
while scrolling** (capture-phase scroll listener) and re-expands on idle.

### Tool page anatomy (`ToolPage` + `toolPages.ts`)
`Hero → How-it-works → Live tool → Customize → Where-next → Footer`, all themed by
the type accent. The live tool is bespoke (`RecipeExtractorTool`, `IdeaBoardTool`,
`MealPlannerTool`) or generic (`GenericTool` + a `TOOL_ENGINES` entry). See
RULES.md → "Standalone Tool Pages (SEO)" for the full add-a-page checklist.

### Shared `/s/:slug` page (`SharedToolPage`)
Light frosted header + footer, `tp-surface` page + loading/error, light pastel
role badges (Admin = violet-50, Participant = emerald-50, Viewing = neutral),
black "Save my own copy" / "Create your own" pills.

---

## 7. Do / Don't

| ✅ Do | ❌ Don't |
|------|---------|
| Compose `tp-*` utilities + `tools/ui.tsx` primitives | Hand-roll cards/buttons/inputs with raw hex |
| Use black (`tp-btn-dark`) for primary actions | Use a coloured fill as the primary button |
| Use the per-type accent softly (glow, chips, eyebrow) | Paint chrome (header, FAB, brand ✦) in an accent |
| Edit a type's look in `templateIdentity.ts` only | Re-declare per-type colour/emoji maps elsewhere |
| Keep data-viz colours (ICE/SWOT/score bars) | "Velix-ify" charts that encode meaning into monochrome |
| Add `frosted`/variant props to share a renderer light + in-app | Fork a renderer to restyle it |
| Respect `prefers-reduced-motion` for decorative motion | Add always-on animation without a reduced-motion guard |

---

## 8. Notes / gotchas

- **Dev has no Gemini key** → generation returns null locally, so live AI results
  (recipes, boards, progress theaters) can't be screenshot in dev. Seed a mock
  in component state to verify visuals, then revert; or check in prod.
- **Headless screenshots are flaky** in this repo — restart the preview server if
  one hangs. Avoid `backdrop-filter` (it makes captures hang).
- The main app's `<body>` still defaults to a system/Nunito font; **`tp-surface`
  is what switches a surface to Jakarta.** Apply it (or set the font inline) on
  any new Velix surface that isn't a child of `tp-surface`.
