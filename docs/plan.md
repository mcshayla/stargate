# Nebari Gateway Console — Product & Design Plan

> Living planning doc. The authoritative technical spec is [`docs/spec.md`](./spec.md);
> this doc is the **product + design + UX** layer on top of it: who we're building
> for, what they need, and the flows we want to nail. Edit freely.

---

## 1. What we're building

A **control plane and operations console** for the Envoy AI Gateway (being renamed
**Agent Router**). The gateway is the data plane — one OpenAI-compatible endpoint in
front of every model, routing by policy, metering in dollars, recording every request
as evidence. What it lacks is an **operations surface**. That's us.

**The one-liner:** _One endpoint in front of every model, where every request is
routed by policy, metered in dollars, and recorded as evidence._

Two things are non-negotiable (from the spec):
1. **Build on Envoy AI Gateway** — don't replace the data plane.
2. **A genuinely nice, useful UI** — that's the whole point. Judge every decision by
   whether it makes the console better to use.

One guardrail worth repeating: **the console must never become the only way to operate
the gateway.** Every console-owned resource exports to YAML. Delete the console →
you still have a working gateway.

---

## 2. Where we are (status)

**Session 1 — done:** frontend scaffold is live.
- Vite + React 19 + TypeScript + Tailwind v4, consuming the **nebari-design** shadcn
  registry (`@nebari/*`, Base UI). Fonts: Geist + IBM Plex Mono.
- App shell: sidebar nav (Observe / Configure / Guardrails / Operate), top bar with
  time-range + environment badge.
- Three Phase-1 pages against **mock data**: Overview, Traffic, Spend + a Receipt
  drawer (decision trace).
- Runs at `http://localhost:5173/` (`cd frontend && npm run dev`).

**Session 2 — done:** Traffic went live-and-calm (the Infra signature flow).
- **StreamTable** (`components/stream-table.tsx`) — a dedicated live-stream primitive
  (spec §8), distinct from the paginated `DataTable`: sticky header, vertical-scroll
  viewport, top-insert with a batched entry tint (Q3), "N new" pill, freeze-on-hover /
  focus with no focus-steal.
- **`useLiveStream`** hook — polls a `mintReceipt()` factory to simulate arrivals,
  behind a swappable "rows since cursor" seam for later SSE/WebSocket (Q3).
- **URL-serialized filters** (`useTrafficFilters`) — verdict (multi) / model / free-text
  search, each its own query param, shareable/linkable (Q4). Verdict chips read as their
  badges (glyph + label).
- **Receipt drawer is URL-addressable** (`?receipt=<id>`, Q2) — a peek is shareable and
  Back closes it.
- Row-enter/tint keyframes added to `index.css`, reduced-motion gated.

**Not yet:** real backend, database, live gateway data, auth, and everything Phase 2+.
Everything visible today is fabricated data — a UX skeleton to react to, not a product.
Traffic's own **time-range filter** is deliberately deferred to the shared global
time-range control (see IA §5) so it isn't built twice.

---

## 3. The users

Three audiences read the **same request stream** through different lenses. Designing
well means each one can get in, answer their question, and get out — without wading
through the other two's concerns.

> **Phase 1 primary persona: the Platform / Infra Engineer.** Phase 1 (Observe) exists
> to make debugging a bad call better than `kubectl logs`. Finance and Security become
> first-class as Spend, Budgets, and Guardrails mature.

### 3.1 Platform / Infra Engineer — "Keep it up, route it right, debug the bad call"

| | |
|---|---|
| **Who** | Owns the gateway's reliability. Lives in terminals, dashboards, on-call rotations. |
| **Mental model** | Requests, routes, upstreams, latency, error codes, failover. |
| **Top jobs** | Is the gateway healthy? Why did *this* request fail/slow down? Which provider is flaky? Did my config change break routing? |
| **Frustrations today** | Answers are scattered across `kubectl logs`, provider dashboards, and Grafana. No single request-level story. Cost is invisible at debug time. |
| **Needs from the console** | A dense, live request stream; drill into any request's full decision trace; health at a glance; config-change → traffic-effect correlation. |
| **Questions they walk in with** | "What's erroring right now?" · "Show me that request." · "Did the 2:14pm route change cause this?" · "Which upstream is failing over?" |
| **Success signal** | _"I'd rather debug here than in the logs."_ |

### 3.2 Finance / FinOps — "Know where the money went, and cap it"

| | |
|---|---|
| **Who** | Owns spend accountability across teams/projects. Reports to leadership on AI cost. |
| **Mental model** | Cost centers, budgets, attribution, trends, projections. |
| **Top jobs** | Where did this month's spend go? Who's about to blow their budget? Is spend trending up? Can I cap a team? |
| **Frustrations today** | Provider invoices don't map to internal teams/projects. No real-time view. No enforcement — only after-the-fact bills. |
| **Needs from the console** | Cost attribution by team/project/key/model/provider; budgets with real enforcement (warn/throttle/block); projection with a stated basis; export to CSV/PDF. |
| **Questions they walk in with** | "What did research spend this week?" · "Who's over 80%?" · "If this rate holds, where do we land?" · "Cap this key at $500." |
| **Success signal** | _A budget set in the UI actually stops spend._ |

### 3.3 Security / Compliance — "Prove what left the perimeter"

| | |
|---|---|
| **Who** | Owns data protection and audit. Answers to auditors and incident reviews. |
| **Mental model** | Sensitive data, egress, redaction, policy, evidence, blast radius. |
| **Top jobs** | Did any PII/secrets leave? Prove a request was handled correctly. Author a redaction rule and trust it. Investigate an incident. |
| **Frustrations today** | Model traffic is a black box. No record of what was sent/redacted/blocked. Rules can't be tested before they're trusted. |
| **Needs from the console** | Per-request verdict + decision trace (what was redacted/blocked and why); rule authoring with **replay** against recorded traffic before promotion; tamper-evident receipts; provenance. |
| **Questions they walk in with** | "Did anything leak?" · "Prove this request was clean." · "What would this rule have done last week?" · "Show me every block for this key." |
| **Success signal** | _A non-engineer authors, replays, and promotes a redaction rule with confidence._ |

### 3.4 Design implication

The **receipt is the atom** all three share. Infra reads it for the trace, Finance for
the cost, Security for the verdict/redactions. Get the receipt right and every persona's
view is a different projection of the same object. → Build the receipt/DecisionTrace
first (done in skeleton; deepen it).

---

## 4. Requirements

### 4.1 Functional — by phase

Phase 0 + 1 are the realistic near-term target; 2–4 are the roadmap.

| Phase | Focus | Exit criterion |
|---|---|---|
| **0 — Spine** | Receipt schema, OTel pipeline, Warden skeleton, API scaffold, OIDC | Real traffic produces queryable receipts |
| **1 — Observe** ⬅ *us* | Traffic, Receipt detail, Overview, Spend (read-only) | An engineer would rather debug here than in `kubectl logs` |
| **2 — Configure** | Reconciler, backends, routes, keys, budgets, diff-before-apply, export YAML | Add + route to a provider without touching the cluster |
| **3 — Enforce** | Detectors, policy compiler, Warden enforcement, monitor mode, rule builder, replay | A non-engineer authors, replays, promotes a redaction rule |
| **4 — Optimize** | Model aliases, savings analysis, budget enforcement, activity timeline, signed export | A budget cap set in the UI actually stops spend |

**Phase 1 surfaces (what "done" means for us):**
- **Overview** — health strip; requests/spend/blocked with trend; volume trend;
  "what changed" (config change → traffic effect); needs-attention list.
- **Traffic** — dense live stream (time, key, model, tokens, cost, latency, verdict);
  filters that serialize to URL; rows settle in place (live but calm); freeze-on-hover.
- **Receipt** (drawer) — verdict; model resolution (requested → resolved); decision
  trace (identity → budget → rules → route → upstream → response); token breakdown with
  price basis; redaction summary (type + count only); related receipts.
- **Spend** — trend + breakdown (team/project/key/model/provider); budget rows show
  enforcement action; projection to period end with stated basis; drill-through to
  filtered Traffic.

### 4.2 Non-functional — experience principles

The six principles from the spec (§7.1) — these are the design north star:
1. **The receipt is the atom.** Every chart/number drills to the receipts behind it.
2. **Every decision explains itself.** Block / reroute / redact / fallback each carry an
   inline trace. No unexplained outcomes.
3. **Provenance is always visible.** Git-owned resources link to source; the adopt path
   is explicit. (Phase 2+)
4. **Config changes are proposals.** Show a diff; "pending" is a distinct visual state.
   (Phase 2+)
5. **Live but calm.** Numbers settle, rows enter without reflowing the table. One
   orchestrated motion moment per surface, max.
6. **Cost travels with latency.** Dollars appear next to ms and tokens, always.

**Design language (§7.2):**
- **Color** = state, not decoration. Near-monochrome OKLCH neutrals + a small set of
  semantic verdict colors (allowed / redacted / rerouted / blocked / fallback).
- **Type** — interface font + **monospace for identifiers, models, tokens, money,
  hashes**. **Tabular numerals** wherever a number can change. Money right-aligned,
  consistent decimals per column.
- **Density** — comfortable / compact / dense (user-selectable). Traffic defaults dense.
- **Structure** — borders/rules encode grouping, not decoration. **No card grids.**

**Accessibility (§7.7) — WCAG 2.2 AA as a build gate:**
- Verdict never by color alone — glyph + text label always. (Implemented.)
- Live table is keyboard-navigable and does **not** steal focus on new rows.
- Charts have a keyboard-accessible table equivalent.
- Full keyboard path for any destructive action.

---

## 5. Information architecture

```
Observe    (Phase 1 — read-only)     Configure  (Phase 2)
├─ Overview                          ├─ Models    (catalog · aliases · pricing)
├─ Traffic  → Receipt drawer         ├─ Routing   (routes · backends · fallback)
└─ Spend    → drill to Traffic       └─ Keys      (keys · teams · projects)

Guardrails (Phase 3 — enforcement)   Operate
├─ Policies & Rules                  ├─ Activity  (config + traffic timeline)
├─ Detectors                         └─ Settings  (providers · retention · OIDC)
└─ Replay
```

**Global elements (every screen):**
- Environment switcher (prod vs. staging, distinct accent).
- Time-range control — **shared state** across Overview / Traffic / Spend / Activity.
- Command palette (⌘K) — jump to a key / model / rule / trace id.
- Degradation banner — Warden cache stale, control plane down, fail-open, failover.

---

## 6. The flows we want to nail

Each persona has one signature journey. If these three feel effortless, the console works.

### Flow A — Infra: "Debug a bad call"
1. Land on **Overview** → notice a spike in `blocked`/errors or an attention item.
2. Click through to **Traffic**, pre-filtered to the failing slice (verdict/model/time).
3. Scan the dense stream; verdict color-bar draws the eye to the bad rows.
4. Open the **Receipt** → read the **decision trace**: which step stopped/slowed it.
5. See the config-change correlation ("route changed 2:14pm") → know the cause.
   *Success: root cause in < 1 min, without leaving the console.*

### Flow B — Finance: "Find the spend and cap it"
1. **Spend** → Breakdown by team → sort by cost → spot the outlier.
2. See the budget bar + enforcement badge → who's near the cap.
3. Drill a row → filtered **Traffic** for that team → confirm what's driving it.
4. (Phase 2/4) Set/adjust a **Budget** with an enforcement action → spend actually caps.
   *Success: attribution is obvious; the cap is real, not advisory.*

### Flow C — Security: "Prove what left the perimeter"
1. **Traffic**, filter to `redacted` + `blocked` → the egress-relevant slice.
2. Open a **Receipt** → verdict + redaction summary (type + count, never content).
3. Read the trace → which rule fired, in what mode.
4. (Phase 3) In **Guardrails**, author a rule → **replay** it against last week's traffic
   → see the diff → promote with confidence.
   *Success: evidence is legible to an auditor; rules are trustworthy before they're live.*

---

## 7. Open design questions (to think through)

These are the decisions that shape the design — worth sitting with before building deeper:

- **Density default & switching.** Is dense-by-default right for Traffic? How does the
  comfortable/compact/dense control surface — global, or per-table?
- **The receipt drawer vs. full page.** Drawer for quick peeks, deep-link to a full page
  for sharing/incident review? Or drawer only?
- **"Live but calm" mechanics.** How do new rows arrive — top-insert with a highlight?
  Poll vs. stream? What's the freeze-on-hover interaction exactly?
- **Time-range as shared state.** Does changing it on Traffic change it on Spend? Where
  does it live (URL, global store)?
- **Overview's "what changed."** How do we visually join a config change to its traffic
  effect without it becoming noisy?
- **Verdict vocabulary & color.** Five states — are the current glyphs/colors legible and
  distinct for color-blind users at a glance?
- **Empty / degraded / loading states.** These are most of the real experience. What does
  each surface look like when the pipeline is stale or the gateway is down?
- **Command palette scope.** What's jumpable in Phase 1 (receipts, keys, models)?

---

## 8. Next steps

**Decided — charting / data-viz:** use **Recharts**, but built **into the nebari-design
registry** as themed primitives (`Sparkline`, `StackedArea`, `BarSeries` — spec §8) via
the `nebari-component` house recipe; pages import `@nebari/*`, never Recharts directly.
(shadcn's chart pattern is itself a Recharts wrapper, so this is the native fit for the
registry.) Five constraints, each tied to an open-question decision in
[`user-stories.md`](./user-stories.md):
1. **Live but calm (Q3):** `isAnimationActive={false}`, immutable data updates, bounded
   point count — no twitch on every poll tick.
2. **OKLCH theming:** colors via CSS variables from the token ramps, not hardcoded. The
   verdict stacked-area uses the Q6 ramp (allowed→neutral, redacted→violet,
   rerouted→blue, blocked→red, fallback→amber) — CVD/grayscale-checked.
3. **Keyboard-accessible table fallback (§7.7):** every chart ships a toggle-able
   `<table>` equivalent, built into the registry component.
4. **Drill to receipts (§7.1):** chart `onClick` → Traffic filtered to that slice (reuses
   Q4 URL filters).
5. **Known ceiling:** Recharts is SVG (re-renders whole chart) — fine for P1. Only if a
   live Traffic sparkline with thousands of high-frequency points gets janky, swap that
   one component's internals to uPlot (canvas) behind the same registry API. Don't
   pre-optimize.

- [ ] Deepen the three personas — validate against real Nebari users if possible.
- [ ] Sketch/wireframe the key flows (Figma) before building further.
- [ ] Decide the open design questions in §7.
- [ ] Flesh out Phase 1 pages toward "full" (live-feel Traffic, richer receipt, real
      charts) — see the spec's §8 component list (StreamTable, DecisionTrace, DiffView,
      Money/TokenCount/Duration, Sparkline/StackedArea).
- [ ] Plan the backend + docker-compose (frontend + control plane + Postgres) for when
      we move off mock data.

---

## Appendix — reference

- Spec: [`docs/spec.md`](./spec.md) — §7 UX, §8 components, §13 gotchas.
- Design system: nebari-design shadcn registry — Storybook at
  <https://nebari-dev.github.io/nebari-design/>; components via `npx shadcn add @nebari/<name>`.
- Design-system skill: `.claude/skills/nebari-component/`.
- Frontend: `frontend/` — `npm run dev` → `http://localhost:5173/`.
