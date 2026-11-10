import type { Env } from './store.ts';

export type FeatureFlagName =
  | 'mcpLiveExecution'
  | 'a2aDelegation'
  | 'openAiFacade'
  | 'evalSuite'
  | 'strictGuardrails';

export interface FeatureFlagDefinition {
  name: FeatureFlagName;
  description: string;
  owner: string;
  expiresAt: string;
  defaultEnabled: boolean;
  rolloutPercent: number;
}

export interface EvaluatedFeatureFlags {
  values: Record<FeatureFlagName, boolean>;
  definitions: Array<FeatureFlagDefinition & { enabled: boolean }>;
}

export const FEATURE_FLAG_REGISTRY: Record<FeatureFlagName, FeatureFlagDefinition> = {
  mcpLiveExecution: {
    name: 'mcpLiveExecution',
    description: 'Enable live remote MCP JSON-RPC tools/list and tools/call execution',
    owner: '@hemanth',
    expiresAt: '2026-12-01',
    defaultEnabled: true,
    rolloutPercent: 100
  },
  a2aDelegation: {
    name: 'a2aDelegation',
    description: 'Enable Google A2A v1.0 multi-agent peer task delegation',
    owner: '@hemanth',
    expiresAt: '2026-12-01',
    defaultEnabled: true,
    rolloutPercent: 100
  },
  openAiFacade: {
    name: 'openAiFacade',
    description: 'Expose drop-in OpenAI /v1/chat/completions and /v1/responses endpoints',
    owner: '@hemanth',
    expiresAt: '2026-12-01',
    defaultEnabled: true,
    rolloutPercent: 100
  },
  evalSuite: {
    name: 'evalSuite',
    description: 'Enable built-in deterministic evaluation runner (/api/agents/:id/eval)',
    owner: '@hemanth',
    expiresAt: '2026-12-01',
    defaultEnabled: true,
    rolloutPercent: 100
  },
  strictGuardrails: {
    name: 'strictGuardrails',
    description: 'Enforce prompt-injection shield and PII/secret redaction across runs',
    owner: '@hemanth',
    expiresAt: '2026-12-01',
    defaultEnabled: true,
    rolloutPercent: 100
  }
};

function hashSubjectBucket(flagName: string, subjectId: string): number {
  const input = `${flagName}:${subjectId}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

function parseFlagOverrides(raw?: string): Partial<Record<FeatureFlagName, boolean | number>> {
  if (!raw || !raw.trim()) return {};
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const out: Partial<Record<FeatureFlagName, boolean | number>> = {};
      for (const key of Object.keys(FEATURE_FLAG_REGISTRY) as FeatureFlagName[]) {
        const val = parsed[key];
        if (typeof val === 'boolean' || typeof val === 'number') {
          out[key] = val;
        }
      }
      return out;
    } catch {
      return {};
    }
  }

  const out: Partial<Record<FeatureFlagName, boolean | number>> = {};
  for (const part of trimmed.split(',')) {
    const [k, v] = part.split('=').map(s => s.trim());
    if (k && k in FEATURE_FLAG_REGISTRY && v !== undefined) {
      const flagKey = k as FeatureFlagName;
      if (v === 'true' || v === 'on' || v === '1') out[flagKey] = true;
      else if (v === 'false' || v === 'off' || v === '0') out[flagKey] = false;
      else if (/^\d+$/.test(v)) out[flagKey] = Math.min(100, Math.max(0, Number(v)));
    }
  }
  return out;
}

export function evaluateFeatureFlags(env?: Env, subjectId = 'anonymous'): EvaluatedFeatureFlags {
  const overrides = parseFlagOverrides(env?.FEATURE_FLAGS);
  const values = {} as Record<FeatureFlagName, boolean>;
  const definitions: Array<FeatureFlagDefinition & { enabled: boolean }> = [];

  for (const key of Object.keys(FEATURE_FLAG_REGISTRY) as FeatureFlagName[]) {
    const def = FEATURE_FLAG_REGISTRY[key];
    const override = overrides[key];
    let enabled = def.defaultEnabled;
    let rolloutPercent = def.rolloutPercent;

    if (typeof override === 'boolean') {
      enabled = override;
      rolloutPercent = override ? 100 : 0;
    } else if (typeof override === 'number') {
      rolloutPercent = override;
      enabled = rolloutPercent > 0 && hashSubjectBucket(key, subjectId) < rolloutPercent;
    } else if (enabled && rolloutPercent < 100) {
      enabled = hashSubjectBucket(key, subjectId) < rolloutPercent;
    }

    values[key] = enabled;
    definitions.push({ ...def, rolloutPercent, enabled });
  }

  return { values, definitions };
}
