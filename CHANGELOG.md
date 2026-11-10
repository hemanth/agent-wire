# Changelog

All notable changes to `agent-wire` are documented in this file.

## [1.0.0] - 2026-11-09

### Added
- **Health, RED Metrics & Feature Flags**: Added `GET /api/health` (`/healthz`), `GET /api/metrics` (route-normalized request counts, `2xx`/`4xx`/`5xx` status classes, `p50`/`p95`/`p99` latency histograms, and `99.5%` SLO error-budget gate), and `GET /api/flags` (`src/telemetry.ts`, `src/flags.ts`).
- **Launch & Rollback Runbook**: Added `LAUNCH.md` covering pre-launch audit verification, feature flag lifecycle, rollout thresholds, symptom-based triage, and `< 5 min` rollback procedures.
- **Client Resilience & Code Splitting**: Added root React `ErrorBoundary` (`src/client/components/ErrorBoundary.tsx`) and lazy-loaded `AgentFleet`, `AgentStudio`, `AgentRunnerModal`, `OpenRouterModal`, and `ApiKeysModal`.
- **Launch Readiness E2E & Accessibility Suite**: Added `tests/launch-readiness.spec.ts` with `@axe-core/playwright` WCAG 2.1 AA audits across every view and modal.

### Security
- **Zero Dependency Advisories**: Upgraded `vite` (`^6.4.6`) and `wrangler` (`^4.159.0`), resolved transitive advisories (`0` vulnerabilities in `npm audit`), and enforced `ignore-scripts=true` in `.npmrc`.
- **Credential Redaction**: Added `sanitizeAgentForPublic` to strip `openRouterKey` and redact sensitive `mcps[].headers` across REST, MCP, and A2A discovery responses, plus automatic token scrubbing in structured JSON logs.
- **Strict CSP & Security Headers**: Eliminated inline scripts from `index.html` (`src/client/lib/runtime-init.ts`), enabling `script-src 'self'` alongside HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, non-wildcard CORS allowlisting, auth rate limiting, and IPv4/IPv6/cloud-metadata SSRF blocking.
- **Production Demo Key Gate**: Disabled fallback `wire_live_demo12345` acceptance when `ENVIRONMENT="production"`.

### Accessibility & Performance
- **WCAG 2.1 AA**: Added Skip-to-Content link, modal `Tab`/`Shift+Tab` focus trapping, keyboard-focusable code blocks, ARIA `tablist`/`listitem` fixes, and `>= 4.5:1` contrast upgrades across Studio, Fleet, and Runner modals.
- **Edge & Proxy Caching**: Configured `Cache-Control: public, max-age=31536000, immutable` on hashed `/assets/*` bundles, bfcache-friendly `Cache-Control: no-cache` on HTML, and gzip compression in `dev-server.mjs`.
