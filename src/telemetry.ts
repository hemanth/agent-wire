export type LogLevel = 'info' | 'warn' | 'error';

export interface StructuredLogFields {
  requestId?: string;
  traceId?: string;
  entryPoint?: 'http' | 'mcp' | 'a2a' | 'openai_v1' | 'eval';
  method?: string;
  route?: string;
  statusClass?: '2xx' | '3xx' | '4xx' | '5xx';
  durationMs?: number;
  provider?: string;
  reason?: string;
}

interface RouteMetricsBucket {
  requests: number;
  errors4xx: number;
  errors5xx: number;
  latenciesMs: number[];
}

const SERVICE_STARTED_AT = Date.now();
const MAX_LATENCY_SAMPLES = 500;
const SLO_AVAILABILITY_TARGET = 0.995; // 99.5% availability SLO (0.5% error budget)

const routeMetrics = new Map<string, RouteMetricsBucket>();
let totalRequests = 0;
let totalErrors4xx = 0;
let totalErrors5xx = 0;

const SECRET_SCRUB_REGEX =
  /(?:sk-or-v1-[A-Za-z0-9_-]{8,}|wire_live_[A-Za-z0-9_-]{6,}|ghp_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,})/gi;

export function scrubSecrets(text: string): string {
  return text.replace(SECRET_SCRUB_REGEX, '[REDACTED]');
}

const KNOWN_WELL_KNOWN_ROUTES = new Set([
  '/.well-known/mcp/server-card.json',
  '/.well-known/agent-card.json',
  '/.well-known/agent-skills/index.json',
  '/.well-known/api-catalog',
  '/.well-known/ai-catalog.json',
  '/.well-known/oauth-protected-resource',
  '/.well-known/http-message-signatures-directory'
]);

const KNOWN_V1_ROUTES = new Set(['/v1/models', '/v1/chat/completions', '/v1/responses']);

export function normalizeRouteTemplate(pathname: string): string {
  if (pathname === '/' || pathname === '/index.html') return '/';
  if (pathname === '/api/health' || pathname === '/healthz') return '/api/health';
  if (pathname === '/api/metrics') return '/api/metrics';
  if (pathname === '/api/flags') return '/api/flags';
  if (pathname === '/api/agents') return '/api/agents';
  if (/^\/api\/agents\/[^/]+\/run$/.test(pathname)) return '/api/agents/:id/run';
  if (/^\/api\/agents\/[^/]+\/eval$/.test(pathname)) return '/api/agents/:id/eval';
  if (/^\/api\/agents\/[^/]+\/runs$/.test(pathname)) return '/api/agents/:id/runs';
  if (/^\/api\/agents\/[^/]+\/sessions$/.test(pathname)) return '/api/agents/:id/sessions';
  if (/^\/api\/agents\/[^/]+\/sessions\/[^/]+$/.test(pathname)) return '/api/agents/:id/sessions/:sessionId';
  if (/^\/api\/agents\/[^/]+\/agent-card\.json$/.test(pathname)) return '/api/agents/:id/agent-card.json';
  if (/^\/api\/agents\/[^/]+\/a2a$/.test(pathname)) return '/api/agents/:id/a2a';
  if (/^\/api\/agents\/[^/]+$/.test(pathname)) return '/api/agents/:id';
  if (pathname === '/api/keys') return '/api/keys';
  if (/^\/api\/keys\/[^/]+$/.test(pathname)) return '/api/keys/:id';
  if (pathname === '/api/mcp/probe') return '/api/mcp/probe';
  if (pathname === '/api/auth/openrouter-exchange') return '/api/auth/openrouter-exchange';
  if (pathname === '/mcp' || pathname === '/api/mcp') return '/mcp';
  if (pathname === '/api/a2a') return '/api/a2a';
  if (KNOWN_V1_ROUTES.has(pathname)) return pathname;
  if (/^\/\.well-known\/agent-skills\/[^/]+\/SKILL\.md$/.test(pathname)) {
    return '/.well-known/agent-skills/:id/SKILL.md';
  }
  if (KNOWN_WELL_KNOWN_ROUTES.has(pathname)) return pathname;
  if (
    pathname === '/openapi.json' ||
    pathname === '/llms.txt' ||
    pathname === '/llms-full.txt' ||
    pathname === '/auth.md' ||
    pathname === '/robots.txt' ||
    pathname === '/index.md'
  ) {
    return pathname;
  }
  return '/unmatched';
}

export function classifyStatus(status: number): '2xx' | '3xx' | '4xx' | '5xx' {
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  return '2xx';
}

export function recordRequestMetric(pathname: string, status: number, durationMs: number): void {
  const route = normalizeRouteTemplate(pathname);
  const statusClass = classifyStatus(status);
  totalRequests += 1;
  if (statusClass === '4xx') totalErrors4xx += 1;
  if (statusClass === '5xx') totalErrors5xx += 1;

  let bucket = routeMetrics.get(route);
  if (!bucket) {
    bucket = { requests: 0, errors4xx: 0, errors5xx: 0, latenciesMs: [] };
    routeMetrics.set(route, bucket);
  }
  bucket.requests += 1;
  if (statusClass === '4xx') bucket.errors4xx += 1;
  if (statusClass === '5xx') bucket.errors5xx += 1;

  if (bucket.latenciesMs.length >= MAX_LATENCY_SAMPLES) {
    bucket.latenciesMs.shift();
  }
  bucket.latenciesMs.push(Math.max(0, Math.round(durationMs)));
}

function computePercentile(samples: number[], percentile: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[idx];
}

export interface ErrorBudgetSummary {
  sloTarget: number;
  allowedErrorRate: number;
  observedErrorRate: number;
  errorBudgetRemainingPct: number;
  burnRate: number;
  releaseGate: 'ship_normally' | 'slow_rollout' | 'freeze_feature_work';
}

export function getErrorBudgetSummary(): ErrorBudgetSummary {
  const allowedErrorRate = Number((1 - SLO_AVAILABILITY_TARGET).toFixed(4)); // 0.005
  const observedErrorRate = totalRequests > 0 ? totalErrors5xx / totalRequests : 0;
  const burnRate = allowedErrorRate > 0 ? Number((observedErrorRate / allowedErrorRate).toFixed(3)) : 0;
  const consumedRatio = allowedErrorRate > 0 ? observedErrorRate / allowedErrorRate : 0;
  const remainingPct = Math.max(0, Math.min(100, Number(((1 - consumedRatio) * 100).toFixed(2))));

  let releaseGate: ErrorBudgetSummary['releaseGate'] = 'ship_normally';
  if (remainingPct <= 0) {
    releaseGate = 'freeze_feature_work';
  } else if (remainingPct <= 20) {
    releaseGate = 'slow_rollout';
  }

  return {
    sloTarget: SLO_AVAILABILITY_TARGET,
    allowedErrorRate,
    observedErrorRate: Number(observedErrorRate.toFixed(5)),
    errorBudgetRemainingPct: remainingPct,
    burnRate,
    releaseGate
  };
}

export function getMetricsSnapshot() {
  const allSamples: number[] = [];
  const routes: Record<
    string,
    {
      requests: number;
      errors4xx: number;
      errors5xx: number;
      errorRate5xx: number;
      latencyMs: { p50: number; p95: number; p99: number };
    }
  > = {};

  for (const [route, bucket] of routeMetrics.entries()) {
    allSamples.push(...bucket.latenciesMs);
    routes[route] = {
      requests: bucket.requests,
      errors4xx: bucket.errors4xx,
      errors5xx: bucket.errors5xx,
      errorRate5xx: bucket.requests > 0 ? Number((bucket.errors5xx / bucket.requests).toFixed(5)) : 0,
      latencyMs: {
        p50: computePercentile(bucket.latenciesMs, 50),
        p95: computePercentile(bucket.latenciesMs, 95),
        p99: computePercentile(bucket.latenciesMs, 99)
      }
    };
  }

  return {
    uptimeSeconds: Math.floor((Date.now() - SERVICE_STARTED_AT) / 1000),
    totals: {
      requests: totalRequests,
      errors4xx: totalErrors4xx,
      errors5xx: totalErrors5xx,
      errorRate5xx: totalRequests > 0 ? Number((totalErrors5xx / totalRequests).toFixed(5)) : 0,
      latencyMs: {
        p50: computePercentile(allSamples, 50),
        p95: computePercentile(allSamples, 95),
        p99: computePercentile(allSamples, 99)
      }
    },
    errorBudget: getErrorBudgetSummary(),
    routes
  };
}

export function getUptimeSeconds(): number {
  return Math.floor((Date.now() - SERVICE_STARTED_AT) / 1000);
}

export function logStructured(level: LogLevel, event: string, fields: StructuredLogFields = {}): void {
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    event
  };
  if (fields.requestId) payload.requestId = fields.requestId;
  if (fields.traceId) payload.traceId = fields.traceId;
  if (fields.entryPoint) payload.entryPoint = fields.entryPoint;
  if (fields.method) payload.method = fields.method;
  if (fields.route) payload.route = fields.route;
  if (fields.statusClass) payload.statusClass = fields.statusClass;
  if (typeof fields.durationMs === 'number') payload.durationMs = fields.durationMs;
  if (fields.provider) payload.provider = fields.provider;
  if (fields.reason) payload.reason = scrubSecrets(String(fields.reason)).slice(0, 300);

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  }
}
