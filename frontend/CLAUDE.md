# Nebari Gateway Console — design rules

Follow the Nebari design system for every screen. "Following Nebari" means using
the tokens and primitives below — not eyeballing each page. If you're typing a
hex color or hand-rolling a component, you're off-design.

## Source of truth

- Design system = the `@nebari` shadcn registry (base-vega style). Config in
  `components.json`. Tokens live in `src/index.css` (the `@nebari/theme` block).
- Need a component we don't have yet (Table, Tabs, Dialog, Tooltip, …)? Pull it
  from the registry — don't invent one:
  `npx shadcn@4.21.0 add @nebari/<name> --yes`
- Custom chart primitives (`sparkline.tsx`, `stacked-area.tsx`, `bar-series.tsx`,
  `surface-state.tsx`) are intentionally local per plan.md §8 — leave them.

## Color — always tokens, never hex

- Surfaces/text: `bg-background`, `bg-card`, `text-foreground`,
  `text-muted-foreground`, `border-border`.
- Accent (the Nebari purple `#9547C0`): `text-primary` / `bg-primary`. Used for
  active/selected states only.
- Data viz: `chart-1` … `chart-5`. Status: `success`/`warning`/`destructive`/`info`
  `-foreground` variants (see how `app-shell.tsx` footer + `degradation-banner` use them).

## Type

- UI: **Geist** (`--font-sans`). Numbers / tabular / IDs: **IBM Plex Mono**
  (`font-mono`). Both are loaded via `@fontsource*` imports in `src/index.css`.
- Metric values use `font-mono text-2xl tabular-nums` (see `pages/overview.tsx`).

## Shape & spacing

- Rounding: `rounded-sm` (~6px) / `rounded-md` (~8px). Don't over-round.
- **Plain-text nav is bare text — no background pill, no box.** The top-bar links
  (Docs · Guides · Reference) use `rounded-none px-0 hover:bg-transparent`. Icon
  buttons (GitHub, theme toggle) have no hover box either — just `hover:opacity-70`.
  This was a repeated miss; keep nav/icon controls boxless.
- Cards: `bg-card` + `border-border` + `shadow-xs` (the registry `Card`). Layout
  rhythm is `p-4` / `gap-4`, grids like `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`.

## Active-state treatment (purple)

- Top tabs: purple underline-active (built into `NavLink` via `data-[active=true]`).
- Sidebar item: 2px purple left-bar + muted fill (see `SidebarMenuButton` usage in
  `app-shell.tsx`).

## Reference images

The authoritative look is the two Nebari SVGs the user pasted (site chrome +
docs page). When unsure about chrome details, render/inspect those rather than
guessing — the nav labels/treatment were corrected against them.

## Building phases

`SECTIONS` in `app-shell.tsx` scaffolds all four phases: Observe (1, live),
Configure (2), Guardrails (3), Operate (4) — later phases are shown-but-disabled.
To bring a phase live: flip its `phase`/`live` gating there, add routes in
`App.tsx`, and build pages from the primitives above (styling comes for free).

## Before you finish

`npm run build` (runs tsc) and `npx vitest run` must be clean. Currently 118 tests.
