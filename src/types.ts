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

export interface Agent {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  systemPrompt: string;
  models: string[]; // OpenRouter auto-fallback model list
  temperature: number;
  maxTokens?: number;
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
  task?: string;
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  sessionId?: string;
  context?: Record<string, any>;
  memory?: Record<string, any>;
  stream?: boolean;
  max_tokens?: number;
  maxTokens?: number;
}

export interface ToolExecutionStep {
  step: number;
  type: 'thought' | 'tool_call' | 'tool_result' | 'answer';
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
  status: 'success' | 'error';
  error?: string;
  modelUsed: string;
  modelsAttempted?: string[];
  toolsUsed: string[];
  steps: ToolExecutionStep[];
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
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
  createdAt: string;
  updatedAt: string;
  messages: AgentSessionMessage[];
  memory: Record<string, any>;
  runsCount: number;
}

