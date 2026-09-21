# LLM Serving Pack — takeaways for the Gateway Console

Notes from cloning and running [`nebari-dev/llm-serving-pack`](https://github.com/nebari-dev/llm-serving-pack)
locally (Key Manager UI, dev mode) on 2026-09-18. This is our **closest sibling pack**
and the one spec §12 flags for the absorb-vs-adopt decision.

## What it is
- A Nebari software pack that serves self-hosted LLMs on Kubernetes via an operator +
  an `LLMModel` CRD (model download → vLLM pods → routing → auth).
- Ships a **Key Manager UI**: a React SPA where users mint/revoke API keys for the
  models they're allowed to use. **No chat UI** — just vLLM OpenAI-compatible endpoints.
- Alpha (`v0.1.0-alpha.x`).

## The big overlap (matters for our spec §12)
- **It already runs on Envoy AI Gateway** for token counting + rate limiting — i.e. it
  sits on *the same data plane our console governs*.
- Its Key Manager UI is a small slice of what our **Keys** surface (spec §7.5.8) does.
- Decision to settle before Phase 2: **absorb** llm-serving-pack, or treat it as the
  **provider-configuration slice** of our Configure phase. Prior art now exists to look at.

## Frontend stack (near-identical to ours)
- **Vite + React + TypeScript + Tailwind + shadcn/ui** — same family as our console
  (plan.md §2). Path aliases `@/…` like standard shadcn.
- **Biome** for lint/format (not ESLint/Prettier). Worth matching for cross-pack
  consistency if we care about that.
- Delivery shape: one **nginx-served static SPA** + a Go `key-manager` backend. That's
  the same shape our console targets (static assets behind the API server, spec §4.2).

## The dev-mode seam (steal this)
The pattern that lets you run the UI with no cluster and no Keycloak:
- `VITE_DEV_NO_AUTH=true` → bypasses the Keycloak login redirect entirely.
- `vite.config.ts` proxies `/api` → `WEBAPI_URL` (defaults to `http://localhost:8080`).
  Override the env var to point at a port-forwarded backend, a mock, or nothing.
- `dev/run-dev.sh` orchestrates the full path (kind cluster + port-forward + Vite), but
  the **frontend alone runs standalone**: `VITE_DEV_NO_AUTH=true npm run dev`.

**Apply to our console:** same two-part seam — an auth-bypass flag for local dev, and a
single `/api` proxy target we can swing between mock data and a real control-plane. This
is the clean mock↔real boundary our plan.md §2 wants for `useLiveStream`.

## How to view it again
```
cd <scratchpad>/llm-serving-pack/frontend
VITE_DEV_NO_AUTH=true npm run dev -- --port 5273 --strictPort
# → http://localhost:5273/  (UI renders; /api calls error with no backend)
```

## Open follow-ups
- [ ] Read `frontend/src` for their routing + auth-bypass + `/api` call patterns.
- [ ] Settle absorb-vs-adopt for llm-serving-pack before Phase 2 (spec §12).
- [ ] Decide whether to match their Biome setup.
