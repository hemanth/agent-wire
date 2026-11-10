# AgentWire Production Launch, Monitoring & Rollback Runbook

Target production endpoints:
- **Studio & API**: `https://h3manth.com/ai/agent-wire/`
- **Cloudflare Worker**: `agent-wire` (`wrangler.toml`)

---

## 1. Completed Pre-Launch Audit Checklist

### Code Quality
- [x] Zero TypeScript compiler errors (`npm run typecheck` / `tsc -b`)
- [x] Production client & Node server bundles build cleanly (`npm run build && npm run build:server`)
- [x] All 27 Playwright E2E tests pass across 8 suites (`npm test`)
- [x] Zero stray debug `console.log` calls in runtime client/server code (all server logs emit secret-scrubbed structured JSON via `src/telemetry.ts`)
- [x] React `ErrorBoundary` wraps the root studio UI (`src/client/components/ErrorBoundary.tsx`)

### Security
- [x] Dependency audit clean: `npm audit` reports **0 vulnerabilities**; `.npmrc` enforces `ignore-scripts=true`
- [x] Zero hardcoded secrets in source; demo key `wire_live_demo12345` disabled when `ENVIRONMENT="production"` unless `ALLOW_DEMO_KEY="true"`
- [x] Secret redaction (`sanitizeAgentForPublic`) strips `openRouterKey` and redacts sensitive `mcps[].headers` (`Authorization`, `X-API-Key`, etc.) across REST, MCP (`resources/read`), and A2A responses
- [x] Input validation (`validateAgentInput`) enforces field types, max lengths, token/temperature bounds, and creation-time SSRF checks (`isSafeRemoteUrl` blocking RFC1918 IPv4, IPv6 loopback/ULA/link-local/IPv4-mapped `::1`/`fc00:`/`fe80:`/`::ffff:`, and cloud metadata `169.254.169.254`/`metadata.google.internal`)
- [x] Rate limiting active on auth (`POST /api/auth/openrouter-exchange`: 10 req / 15 min per IP), API key lifecycle (`20 req / 15 min`), and mutating endpoints (`30 req / min`)
- [x] Non-wildcard CORS allowlist (`resolveCorsOrigin` via `ALLOWED_ORIGINS`)
- [x] Strict security headers on all responses: `Content-Security-Policy` (`script-src 'self'`, `frame-ancestors 'none'`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`
- [x] Unhandled `500` errors return sanitized `{ error: { code: "INTERNAL_ERROR", message: "Something went wrong" }, requestId }` with zero stack trace leakage

### Performance
- [x] Route/view code splitting via `React.lazy` + `Suspense` for `AgentFleet`, `AgentStudio`, `AgentRunnerModal`, `OpenRouterModal`, and `ApiKeysModal` (initial JS bundle ~100 kB gzipped; secondary views loaded on demand)
- [x] Hashed static bundles (`/assets/*`) served with `Cache-Control: public, max-age=31536000, immutable`
- [x] HTML entry served with `Cache-Control: no-cache` (preserves browser bfcache — no `no-store`)
- [x] Gzip compression enabled on Node reverse-proxy server (`dev-server.mjs`) and automatic Brotli/Gzip at Cloudflare Edge

### Accessibility (WCAG 2.1 AA)
- [x] Automated `@axe-core/playwright` (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) passes with **0 violations** across Landing, Active Fleet, Agent Runner Modal (Sandbox, History & Traces, Evals & Protocols), Agent Studio, API Keys Modal, and OpenRouter Modal
- [x] Keyboard Skip-to-Content link (`#main-content`), focus trapping (`Tab`/`Shift+Tab`) and `Escape` dismissal + focus restoration in `useModalA11y`, keyboard-focusable code regions, and `>= 4.5:1` text contrast throughout

### Infrastructure & Observability
- [x] Health endpoints: `GET /api/health` and `GET /healthz`
- [x] RED metrics & latency percentiles (`p50`, `p95`, `p99`): `GET /api/metrics` (low-cardinality normalized route templates)
- [x] Feature flag registry & live evaluation endpoint: `GET /api/flags`
- [x] W3C `traceparent` + `X-Request-Id` correlation headers propagated across HTTP, MCP, A2A, and OpenAI v1 facade calls

### Documentation
- [x] `README.md`, `CHANGELOG.md`, `LAUNCH.md`, and `/openapi.json` updated for `v1.0.0`

---

## 2. Feature Flag Registry & Lifecycle

Defined in `src/flags.ts` and overridden at runtime via `FEATURE_FLAGS` (JSON object or comma-separated `flag=bool` pairs — zero redeploy required when updating Worker vars or `.env`):

| Flag | Default | Owner | Cleanup Date | Purpose |
| :--- | :---: | :--- | :---: | :--- |
| `mcpLiveExecution` | `true` | `@hemanth` | `2026-12-01` | Live outbound remote MCP `tools/list` & `tools/call` during runs |
| `a2aDelegation` | `true` | `@hemanth` | `2026-12-01` | Multi-agent sub-task delegation (`@slug`) |
| `openAiFacade` | `true` | `@hemanth` | `2026-12-01` | `/v1/models`, `/v1/chat/completions`, `/v1/responses` |
| `evalSuite` | `true` | `@hemanth` | `2026-12-01` | `POST /api/agents/:id/eval` deterministic eval runner |
| `strictGuardrails` | `true` | `@hemanth` | `2026-12-01` | Prompt-injection shield & PII redaction enforcement |

---

## 3. Staged Rollout & Decision Thresholds

1. **Stage 1 — Smoke / Internal Verification**: Deploy Worker / Node bundle, run the First-Hour Verification commands below.
2. **Stage 2 — Canary (`FEATURE_FLAGS` rollout % if introducing risky changes)**: 5% → 25% → 50% → 100% over 15–60 min observation windows.
3. **Stage 3 — Post-100% Cleanup**: Remove expired flags by their `expiresAt` date (`2026-12-01`).

| Metric (`GET /api/metrics`) | Advance | Hold & Investigate | Immediate Rollback |
| :--- | :--- | :--- | :--- |
| **5xx Error Rate** (`totals.errorRate5xx`) | `< 0.5%` (within 99.5% SLO) | `0.5% – 1.0%` | `> 1.0%` sustained for 5 min |
| **p95 Latency** (`totals.latencyMs.p95`) | Within 10% of baseline (`< 1500ms` non-LLM, `< 8000ms` LLM) | `+10% – +30%` | `> +50%` or upstream timeouts spiking |
| **Client JS Errors** (`ErrorBoundary`) | `0` new unhandled render errors | Isolated non-blocking warning | Any crash on Overview, Fleet, or Studio |
| **Agent Run Success** (`/api/agents/:id/run`) | Normal completion + valid SSE frames | Minor drop (`< 5%`) | `> 10%` failure spike |

### Error Budget Policy (`99.5%` Availability SLO)
`GET /api/health` and `GET /api/metrics` compute `errorBudget` in real time:
- **Remaining > 20%** (`ship_normally`): Ship features at normal velocity.
- **Remaining 0% – 20%** (`slow_rollout`): Require staged canary rollouts and extra review.
- **Remaining 0%** (`freeze_feature_work`): Freeze feature deploys; prioritize reliability fixes only.

---

## 4. On-Call Triage & First-Hour Verification

Run immediately after any production deploy (`BASE="https://h3manth.com/ai/agent-wire"`):

```bash
# 1. Liveness, readiness, feature flags & SLO gate
curl -fsS "$BASE/api/health" | jq .

# 2. Critical user flow: execute starter agent end-to-end
curl -fsS -X POST "$BASE/api/agents/agt_design_critic/run" \
  -H "Content-Type: application/json" \
  -d '{"task": "Audit contrast on a primary CTA button"}' | jq '{status, durationMs, modelUsed}'

# 3. Inspect RED metrics (rate, 5xx errors, p50/p95/p99 latency)
curl -fsS "$BASE/api/metrics" | jq '{totals, errorBudget}'
```

### Symptom-Based Triage Guide
- **Is it broken right now?** Check `totals.errorRate5xx` and `errorBudget.burnRate` in `GET /api/metrics`. `burnRate > 6` indicates fast budget burn.
- **What broke (`http` vs `mcp` vs `openrouter`)?** Filter structured JSON logs by `"level":"error"` or `"event":"llm.openrouter_fallback_sandbox"` and correlate via `traceId` / `requestId`.
- **Upstream MCP server hanging or failing?** Toggle `mcpLiveExecution=false` immediately (see Rollback Plan Level 1) so agents continue serving via system prompt + skills without waiting on degraded remote MCP endpoints.

---

## 5. Rollback Plan (Target Recovery < 5 Minutes)

### Level 1 — Instant Feature Flag Kill-Switch (< 1 Minute, Zero Code Revert)
Disable a misbehaving subsystem immediately:

```bash
# Cloudflare Workers
npx wrangler deploy --var 'FEATURE_FLAGS:mcpLiveExecution=false'

# Node / PM2 host (h3manth.com)
FEATURE_FLAGS="mcpLiveExecution=false" pm2 restart agent-wire --update-env
```

### Level 2 — Cloudflare Worker Instant Version Rollback (< 2 Minutes)
Revert the Worker to the previous known-good deployment ID:

```bash
npx wrangler deployments list
npx wrangler rollback --message "Rollback agent-wire due to post-deploy regression"
```

### Level 3 — Node / Reverse-Proxy Host Rollback (< 5 Minutes)
Revert to the prior commit, rebuild `dist` + `dist-server`, and reload:

```bash
git revert --no-edit HEAD
npm run build && npm run build:server
pm2 reload agent-wire
curl -fsS http://localhost:8787/api/health
```

> **Schema Compatibility Note**: Agent, session, run-log, and API-key KV records in `v1.0.0` are strictly additive and backward-compatible (`sanitizeAgentForPublic` operates at serialization time without mutating stored KV payloads), so rolling back application code requires zero data migration.
