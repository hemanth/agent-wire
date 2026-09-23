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
  createdAt: string;
  updatedAt: string;
  invocationCount: number;
  lastInvokedAt?: string;
}

export interface RunAgentRequest {
  task?: string;
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  stream?: boolean;
  max_tokens?: number;
  maxTokens?: number;
}

export interface ToolExecutionStep {
  step: number;
  type: 'thought' | 'tool_call' | 'tool_result' | 'answer';
  timestamp: string;
  mcpName?: string;
  toolName?: string;
  toolArgs?: any;
  toolOutput?: any;
  content?: string;
}

export interface RunAgentResponse {
  agentId: string;
  task: string;
  result: string;
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
}
