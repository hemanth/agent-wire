export interface McpTool {
  name: string;
  description: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface McpConnector {
  id: string;
  name: string;
  url: string;
  type: 'http' | 'sse';
  headers?: Record<string, string>;
  tools?: McpTool[];
  status?: 'unknown' | 'connected' | 'error';
  errorMessage?: string;
}

export interface AttachedSkill {
  id: string;
  name: string;
  description: string;
  content: string; // The SKILL.md / markdown instruction
  enabled: boolean;
}

export interface AgentGuardrails {
  blockPromptInjection?: boolean;
  redactPii?: boolean;
  maxToolSteps?: number;
}

export interface AgentIntentSlotSpec {
  name: string;
  description: string;
  pattern?: string;
  enum?: string[];
}

export interface AgentIntentSpec {
  id: string;
  description: string;
  keywords?: string[];
  examples?: string[];
  clarifyOnMissingSlots?: boolean;
  requiredSlots?: AgentIntentSlotSpec[];
}

export interface DetectedIntentResult {
  id: string;
  description?: string;
  confidence: number;
  action: 'execute' | 'clarify';
  isFollowUp: boolean;
  resumedPending?: boolean;
  slots: Record<string, string>;
  missingSlots: string[];
  matchedKeywords?: string[];
  targetAgentId?: string;
  targetAgentSlug?: string;
}

export interface AgentRoutingSummary {
  targetAgentId: string;
  targetAgentSlug: string;
  confidence: number;
  stickyHit: boolean;
  switchedAgent: boolean;
  previousAgentId?: string;
  reason: string;
}

export interface StickyUserSummary {
  userId: string;
  sessionId: string;
  autoBound: boolean;
  totalRuns: number;
  activeAgentId?: string;
  userMemory: Record<string, any>;
}

export interface UserProfileState {
  userId: string;
  principalHash: string;
  createdAt: string;
  updatedAt: string;
  totalRuns: number;
  activeAgentId?: string;
  userMemory: Record<string, any>;
  pendingIntents: Record<
    string,
    {
      intentId: string;
      originalTask: string;
      slots: Record<string, string>;
      updatedAt: string;
    }
  >;
}

export interface Agent {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  systemPrompt: string;
  models: string[]; // OpenRouter auto-fallback model list
  temperature: number;
  maxTokens?: number;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  responseFormat?: 'text' | 'json_object' | 'json_schema';
  outputSchema?: Record<string, any>;
  guardrails?: AgentGuardrails;
  intents?: AgentIntentSpec[];
  subAgents?: string[];
  mcps: McpConnector[];
  skills: AttachedSkill[];
  openRouterKey?: string;
  visibility?: 'public' | 'private';
  ownerId?: string;
  isProtected?: boolean;
  createdAt: string;
  updatedAt: string;
  invocationCount: number;
  lastInvokedAt?: string;
}

export interface RunAgentRequest {
  input?: string;
  task?: string;
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  sessionId?: string;
  userId?: string;
  user?: string;
  stickyUser?: boolean;
  userMemory?: Record<string, any>;
  callerPrincipal?: string;
  mcpToken?: string;
  context?: Record<string, any>;
  memory?: Record<string, any>;
  stream?: boolean;
  max_tokens?: number;
  maxTokens?: number;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  responseFormat?: 'text' | 'json_object' | 'json_schema';
  outputSchema?: Record<string, any>;
}

export interface ToolExecutionStep {
  step: number;
  type: 'thought' | 'intent' | 'tool_call' | 'tool_result' | 'handoff' | 'guardrail' | 'answer';
  timestamp: string;
  durationMs?: number;
  mcpName?: string;
  toolName?: string;
  toolArgs?: any;
  toolOutput?: any;
  content?: string;
}

export interface RunAgentResponse {
  runId: string;
  traceId: string;
  agentId: string;
  task: string;
  result: string;
  structuredOutput?: any;
  status: 'success' | 'needs_input' | 'error';
  error?: string;
  modelUsed: string;
  modelsAttempted?: string[];
  reasoningEffort?: string;
  toolsUsed: string[];
  subAgentsCalled?: string[];
  guardrailsTriggered?: string[];
  intent?: DetectedIntentResult;
  routing?: AgentRoutingSummary;
  stickyUser?: StickyUserSummary;
  steps: ToolExecutionStep[];
  tokens?: {
    prompt: number;
    completion: number;
    reasoning?: number;
    total: number;
  };
  estimatedCostUsd?: number;
  durationMs: number;
  sessionId?: string;
  sessionMessagesCount?: number;
  memory?: Record<string, any>;
}

export interface AgentRunRecord extends RunAgentResponse {
  createdAt: string;
}

export interface AgentWireApiKey {
  id: string;
  name: string;
  keyPrefix: string; // e.g. wire_live_xxxx...
  createdAt: string;
  lastUsedAt?: string;
}

export interface AgentSessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface AgentSession {
  id: string;
  agentId: string;
  principalHash?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  messages: AgentSessionMessage[];
  memory: Record<string, any>;
  runsCount: number;
}

export interface AgentEvalCase {
  id: string;
  name: string;
  task: string;
  expectedContains?: string[];
  expectedNotContains?: string[];
  expectJson?: boolean;
  maxDurationMs?: number;
}

export interface AgentEvalCaseResult {
  id: string;
  name: string;
  task: string;
  passed: boolean;
  durationMs: number;
  runId: string;
  outputPreview: string;
  assertions: Array<{ label: string; passed: boolean; detail?: string }>;
}

export interface AgentEvalSuiteResponse {
  evalId: string;
  agentId: string;
  agentName: string;
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  durationMs: number;
  results: AgentEvalCaseResult[];
}
