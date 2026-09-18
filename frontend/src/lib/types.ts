// Domain model for the Nebari Gateway Console.
// Phase 1 (Observe) is read-only, so these mirror what the receipt pipeline
// emits rather than anything the console writes back.

/**
 * The outcome the gateway recorded for a request. Every surface renders the
 * verdict with a glyph + label (never color alone) per the spec's a11y gate.
 */
export type Verdict =
  | 'allowed'
  | 'redacted'
  | 'rerouted'
  | 'blocked'
  | 'truncated'

export type RequestStatus = 'success' | 'error'

export type TokenUsage = {
  input: number
  cached: number
  output: number
  reasoning: number
}

/** One step in a receipt's decision trace — the spine of the receipt view. */
export type TraceStep = {
  stage:
    | 'identity'
    | 'budget'
    | 'rules'
    | 'route'
    | 'upstream'
    | 'response'
  label: string
  outcome: string
  durationMs: number
  /** Steps that changed or stopped the request read as notable. */
  notable?: boolean
}

// Types bound to <DataTable> (Receipt, SpendRow) are declared as `type` aliases
// rather than `interface` so they satisfy TanStack's `Record<string, unknown>`
// constraint — interfaces have no implicit index signature.

/** A single request as it appears in Traffic and the receipt drawer. */
export type Receipt = {
  id: string
  traceId: string
  ts: string // ISO 8601
  durationMs: number
  ttftMs?: number // time-to-first-token, streaming only
  key: string
  team: string
  project: string
  modelRequested: string
  modelResolved: string
  provider: string
  backend: string
  region: string
  verdict: Verdict
  status: RequestStatus
  statusCode: number
  costUsd: number
  tokens: TokenUsage
  /** Redaction summary carries type + count only, never captured content. */
  redactions: { type: string; count: number }[]
  trace: TraceStep[]
}

/** A spend row in the breakdown table, grouped by an attribution dimension. */
export type SpendRow = {
  scope: string
  requests: number
  costUsd: number
  budgetUsd?: number
  enforcement?: 'warn' | 'throttle' | 'block'
}

/** One item in the Overview "needs attention" list. */
export type AttentionItem = {
  id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
}

/**
 * A consequential change to the gateway or its config — the raw material for
 * Overview's "what changed" timeline. Deliberately narrow: we plot only changes
 * that could plausibly move traffic (routes, backends, rules, budgets, models,
 * deploys, keys), never every poll tick, so a tick-mark always means something.
 */
export type ChangeKind =
  | 'route' // routing / failover policy changed
  | 'backend' // backend or provider added / adopted / removed
  | 'rule' // guardrail rule promoted or edited
  | 'budget' // budget cap set or changed
  | 'model' // model alias or pricing changed
  | 'deploy' // gateway / control-plane rollout
  | 'key' // API key created or revoked

/**
 * Where a change came from — carries the provenance principle onto the timeline.
 * `git` = a Git-owned resource reconciled in; `console` = authored in the UI;
 * `system` = detected by the platform (e.g. an auto-failover), not authored.
 */
export type ChangeSource = 'git' | 'console' | 'system'

/**
 * A way the gateway is currently degraded — the raw material for the global
 * degradation banner (spec §7.4/§7.6). One banner slot, ranked by severity, so
 * the system's worst current problem is always the one on screen.
 */
export type DegradationKind =
  | 'fail-open' // a guardrail policy is failing open — requests pass unchecked
  | 'control-plane' // the control plane is unreachable; config is read-only
  | 'failover' // a provider is failing over to a backup backend
  | 'cache-stale' // the Warden decision cache is stale; verdicts may lag

/** How loud a degradation should be — drives tint and banner ranking. */
export type DegradationSeverity = 'critical' | 'warning' | 'info'

/** One active degradation of the gateway. */
export type Degradation = {
  id: string
  kind: DegradationKind
  severity: DegradationSeverity
  title: string // short headline — the banner's first line
  detail: string // one-line explanation of the current behavior
  /** When the degradation began — feeds the "active for Xm" / cache-age clock. */
  since?: string // ISO 8601
  /**
   * Whether the operator may dismiss the banner. A fail-open is a security
   * event and stays pinned while active (spec §7.6) regardless of this flag —
   * {@link canDismissDegradation} enforces that.
   */
  dismissible: boolean
  /** Optional jump target for the surface that explains or resolves it. */
  href?: string
}

/** A single tick on the "what changed" timeline. */
export type ChangeEvent = {
  id: string
  ts: string // ISO 8601
  kind: ChangeKind
  title: string // short, scannable — the tick's headline
  detail: string // one-line context
  source: ChangeSource
  actor?: string // who or what made the change
  /**
   * Optional drill target for the correlated traffic effect — typically a
   * filtered Traffic URL (`/traffic?…`). Correlation, not causation: the link
   * shows the slice, it never claims the change caused it.
   */
  href?: string
}
