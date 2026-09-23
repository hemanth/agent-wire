import type { Agent, AttachedSkill, McpConnector } from './types.ts';

export const DEFAULT_MODELS = [
  'anthropic/claude-3.5-sonnet',
  'google/gemini-2.5-flash',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat',
];

export const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', context: '200k', speed: 'Fast' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', context: '1M', speed: 'Ultra-fast' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', context: '2M', speed: 'Moderate' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', context: '128k', speed: 'Fast' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'Meta', context: '128k', speed: 'Very Fast' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek', context: '64k', speed: 'Fast' },
];

export const BUILTIN_SKILLS: AttachedSkill[] = [
  {
    id: 'taste-skill',
    name: 'Taste & UI Craft Standard',
    description: 'High-craft frontend design guidelines, intentional contrast, and anti-AI-slop rules',
    enabled: true,
    content: `# Taste Skill (Craft & Aesthetics)
- Verify contrast: Body text ≥4.5:1 against background.
- Typography: Cap body line length at 65-75ch. Pair on a contrast axis.
- Layout: No nested cards. Rely on generous spacing rhythm over box dividers.
- Absolute bans: No gradient text, no decorative blur overkill, no 2023-era uppercase kicker above every section.
- Produce production-grade, intentional interfaces.`
  },
  {
    id: 'code-review-and-quality',
    name: 'Code Review & Multi-Axis QA',
    description: 'Rigorous engineering evaluation across correctness, security, and maintainability',
    enabled: true,
    content: `# Code Review Standard
- Correctness: Check edge cases, null guards, off-by-one errors.
- Readability: Clean names, single responsibility, flat nesting.
- Architecture: Stable boundaries, zero circular imports.
- Security: Parameterized queries, sanitized untrusted inputs.`
  },
  {
    id: 'api-design-standard',
    name: 'API & Ergonomic Interface Design',
    description: 'Extensible Web Manifesto principles: low-level primitives, minimal ceremony',
    enabled: false,
    content: `# API Design Standard
- Primitives over prescriptive wrappers.
- Zero boilerplate: the most common path should be 3 lines of code.
- Provide sensible defaults for all optional parameters.`
  }
];

export const PRESET_MCPS: McpConnector[] = [
  {
    id: 'stitch-mcp',
    name: 'Stitch MCP (UI Design & Screen Gen)',
    url: 'https://stitch.googleapis.com/mcp',
    type: 'http',
    tools: [
      { name: 'generate_screen_from_text', description: 'Generates UI layouts and screens from text descriptions' },
      { name: 'list_screens', description: 'Lists all UI screens in the project' },
      { name: 'create_design_system', description: 'Creates a consistent tokenized design system' }
    ],
    status: 'connected'
  },
  {
    id: 'github-mcp',
    name: 'GitHub Repository MCP',
    url: 'https://api.githubmcp.com/sse',
    type: 'sse',
    tools: [
      { name: 'list_issues', description: 'Lists open issues and PRs in a repository' },
      { name: 'get_file_contents', description: 'Retrieves source code from a GitHub repo' },
      { name: 'create_issue_comment', description: 'Posts comments or triage analysis to an issue' }
    ],
    status: 'connected'
  }
];

export const STARTER_AGENTS: Agent[] = [
  {
    id: 'agt_design_critic',
    name: 'Taste & Design Critic',
    slug: 'design-critic',
    tagline: 'Audits UI implementations against Taste Skill principles and suggests high-craft refinements',
    systemPrompt: `You are an elite Design Critic and Frontend Architect. Your job is to review proposed UI designs, components, or screens.
You strictly enforce high contrast, typographic hierarchy, responsive spacing, and elimination of AI-slop tropes (like gradient text, excessive cards, and bloated eyebrows).
When relevant, call the Stitch MCP tools to inspect or generate alternative design screens.`,
    models: ['anthropic/claude-3.5-sonnet', 'google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct'],
    temperature: 0.3,
    mcps: [PRESET_MCPS[0]],
    skills: [BUILTIN_SKILLS[0]],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    invocationCount: 14,
    lastInvokedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString()
  },
  {
    id: 'agt_pr_triage',
    name: 'GitHub Issue & PR Triager',
    slug: 'pr-triage',
    tagline: 'Connects to GitHub MCP to analyze bug reports, verify reproduction steps, and draft fixes',
    systemPrompt: `You are an autonomous engineering triage assistant.
When given an issue or PR task, you query the GitHub MCP tools to fetch the issue details, examine the diff, check for security regressions, and propose actionable next steps.`,
    models: ['google/gemini-2.5-flash', 'anthropic/claude-3.5-sonnet'],
    temperature: 0.2,
    mcps: [PRESET_MCPS[1]],
    skills: [BUILTIN_SKILLS[1]],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    invocationCount: 42,
    lastInvokedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString()
  }
];
