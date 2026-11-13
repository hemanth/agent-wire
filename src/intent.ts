import type {
  Agent,
  AgentIntentSpec,
  AgentIntentSlotSpec,
  DetectedIntentResult,
  AgentRoutingSummary,
  UserProfileState
} from './types.ts';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with', 'at', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'this', 'that', 'these', 'those', 'please',
  'can', 'could', 'would', 'should', 'you', 'my', 'our', 'we', 'me', 'i', 'do', 'does', 'did'
]);

const DOMAIN_EXPANSIONS: Array<{ triggers: RegExp; intentId: string; boostTokens: string[] }> = [
  {
    triggers: /\b(design|ui|ux|contrast|wcag|typography|font|fonts|hierarchy|hero|button|card|modal|layout|spacing|padding|margin|color|tailwind|css|slop|screen|stitch)\b/i,
    intentId: 'ui_design_audit',
    boostTokens: ['design', 'ui', 'contrast', 'wcag', 'typography', 'craft', 'stitch', 'screen', 'taste', 'critic', 'frontend']
  },
  {
    triggers: /\b(pr|pull\s+request|github|issue|issues|bug|triage|diff|commit|commits|repo|repository|regression|merge|branch|review\s+code)\b/i,
    intentId: 'code_pr_triage',
    boostTokens: ['github', 'pr', 'triage', 'issue', 'issues', 'bug', 'diff', 'repository', 'code']
  },
  {
    triggers: /\b(deploy|rollout|release|staging|production|cluster|kubernetes|incident|runbook)\b/i,
    intentId: 'release_operations',
    boostTokens: ['deploy', 'release', 'production', 'staging', 'ops', 'runbook']
  }
];

const FOLLOW_UP_PATTERNS = [
  /^(what|how)\s+about\b/i,
  /^(and|also|plus|now|instead|next)\b/i,
  /\b(on\s+that|for\s+that|in\s+that|from\s+earlier|above|previous|same\s+one|make\s+it|change\s+it|fix\s+it)\b/i,
  /\b(remind\s+me|what\s+did\s+we|which\s+.*\bwe\b|our\s+saved)\b/i
];

export function tokenizeNormalized(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_#-]+/g, ' ')
    .split(/\s+/)
    .map(tok => tok.replace(/^#+/, ''))
    .filter(tok => tok.length >= 2 && !STOP_WORDS.has(tok))
    .map(stemToken);
}

function stemToken(word: string): string {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') && word !== 'css') return word.slice(0, -1);
  return word;
}

export function detectFollowUpUtterance(task: string, hasPriorContext: boolean): boolean {
  if (!hasPriorContext) return false;
  const trimmed = task.trim();
  if (!trimmed) return false;
  for (const re of FOLLOW_UP_PATTERNS) {
    if (re.test(trimmed)) return true;
  }
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= 5 && /\?$/.test(trimmed)) return true;
  return false;
}

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractSlotsFromText(
  text: string,
  slotSpecs: AgentIntentSlotSpec[] | undefined,
  seedSlots: Record<string, string> = {}
): { slots: Record<string, string>; missingSlots: string[]; newlyFilledCount: number } {
  const slots: Record<string, string> = { ...seedSlots };
  const missingSlots: string[] = [];
  let newlyFilledCount = 0;

  if (!slotSpecs || slotSpecs.length === 0) {
    return { slots, missingSlots, newlyFilledCount };
  }

  for (const spec of slotSpecs) {
    const prevVal = slots[spec.name];
    let extracted: string | undefined = undefined;

    // 1. Explicit key=value or key: value syntax
    const kvRe = new RegExp(`\\b${escapeRegExp(spec.name)}\\s*[:=]\\s*([a-zA-Z0-9_./-]+)`, 'i');
    const kvMatch = text.match(kvRe);
    if (kvMatch?.[1]) {
      extracted = kvMatch[1];
    }

    // 2. Enum matching
    if (!extracted && Array.isArray(spec.enum) && spec.enum.length > 0) {
      for (const candidate of spec.enum) {
        const enumRe = new RegExp(`\\b${escapeRegExp(candidate)}\\b`, 'i');
        if (enumRe.test(text)) {
          extracted = candidate;
          break;
        }
      }
    }

    // 3. Regex pattern matching
    if (!extracted && spec.pattern) {
      try {
        const patRe = new RegExp(spec.pattern, 'i');
        const patMatch = text.match(patRe);
        if (patMatch?.[0]) {
          extracted = patMatch[0];
        }
      } catch {
        // Ignore invalid user-supplied regex pattern
      }
    }

    if (extracted !== undefined) {
      if (prevVal !== extracted) {
        newlyFilledCount += 1;
      }
      slots[spec.name] = extracted;
    }

    if (!slots[spec.name]) {
      missingSlots.push(spec.name);
    }
  }

  return { slots, missingSlots, newlyFilledCount };
}

export function buildClarificationPrompt(
  spec: AgentIntentSpec,
  missingNames: string[],
  filledSlots: Record<string, string>
): string {
  const missingSpecs = (spec.requiredSlots || []).filter(s => missingNames.includes(s.name));
  const filledPairs = Object.entries(filledSlots);
  const filledLine =
    filledPairs.length > 0
      ? `Captured so far: ${filledPairs.map(([k, v]) => `${k}="${v}"`).join(', ')}.\n`
      : '';
  const questions = missingSpecs
    .map(s => {
      const hint = s.enum?.length ? ` (options: ${s.enum.join(' | ')})` : '';
      return `- ${s.name}: ${s.description}${hint}`;
    })
    .join('\n');

  return `${filledLine}Before running "${spec.id}", please provide the missing parameter${missingSpecs.length > 1 ? 's' : ''}:\n${questions}`;
}

function scoreExplicitIntent(task: string, taskTokens: Set<string>, spec: AgentIntentSpec): { score: number; matched: string[] } {
  const matched: string[] = [];
  let hits = 0;

  for (const kw of spec.keywords || []) {
    const kwNorm = kw.trim().toLowerCase();
    if (!kwNorm) continue;
    if (task.toLowerCase().includes(kwNorm) || taskTokens.has(stemToken(kwNorm))) {
      hits += 2.2;
      matched.push(kwNorm);
    }
  }

  const descTokens = tokenizeNormalized(`${spec.id.replace(/[_-]+/g, ' ')} ${spec.description || ''} ${(spec.examples || []).join(' ')}`);
  for (const dt of descTokens) {
    if (taskTokens.has(dt)) {
      hits += 0.8;
      if (!matched.includes(dt)) matched.push(dt);
    }
  }

  const score = hits <= 0 ? 0 : Math.min(0.98, 0.35 + hits * 0.16);
  return { score: Number(score.toFixed(3)), matched };
}

export function classifyIntentForAgent(params: {
  agent: Agent;
  task: string;
  hasPriorContext?: boolean;
  pendingIntent?: { intentId: string; originalTask: string; slots: Record<string, string> };
  seedMemory?: Record<string, any>;
}): {
  intent: DetectedIntentResult;
  effectiveTask: string;
  clarificationMessage?: string;
  nextPendingIntent: { intentId: string; originalTask: string; slots: Record<string, string> } | null;
} {
  const { agent, task, hasPriorContext = false, pendingIntent, seedMemory } = params;
  const isFollowUp = detectFollowUpUtterance(task, hasPriorContext);
  const taskTokens = new Set(tokenizeNormalized(task));

  const memoryStringSlots: Record<string, string> = {};
  if (seedMemory && typeof seedMemory === 'object') {
    for (const [k, v] of Object.entries(seedMemory)) {
      if (typeof v === 'string' && v.trim()) {
        memoryStringSlots[k] = v.trim();
      }
    }
  }

  // 1. Check if resuming a pending multi-turn slot-fill intent on this agent
  if (pendingIntent && Array.isArray(agent.intents)) {
    const pendingSpec = agent.intents.find(i => i.id === pendingIntent.intentId);
    if (pendingSpec) {
      const mergedSeed = { ...memoryStringSlots, ...pendingIntent.slots };
      const slotRes = extractSlotsFromText(task, pendingSpec.requiredSlots, mergedSeed);

      if (slotRes.newlyFilledCount > 0) {
        if (slotRes.missingSlots.length > 0 && pendingSpec.clarifyOnMissingSlots !== false) {
          const clarificationMessage = buildClarificationPrompt(pendingSpec, slotRes.missingSlots, slotRes.slots);
          return {
            intent: {
              id: pendingSpec.id,
              description: pendingSpec.description,
              confidence: 0.96,
              action: 'clarify',
              isFollowUp: true,
              resumedPending: true,
              slots: slotRes.slots,
              missingSlots: slotRes.missingSlots,
              targetAgentId: agent.id,
              targetAgentSlug: agent.slug
            },
            effectiveTask: pendingIntent.originalTask,
            clarificationMessage,
            nextPendingIntent: {
              intentId: pendingSpec.id,
              originalTask: pendingIntent.originalTask,
              slots: slotRes.slots
            }
          };
        }

        const slotSummary = Object.entries(slotRes.slots)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        return {
          intent: {
            id: pendingSpec.id,
            description: pendingSpec.description,
            confidence: 0.98,
            action: 'execute',
            isFollowUp: true,
            resumedPending: true,
            slots: slotRes.slots,
            missingSlots: [],
            targetAgentId: agent.id,
            targetAgentSlug: agent.slug
          },
          effectiveTask: `${pendingIntent.originalTask} (${slotSummary})`,
          nextPendingIntent: null
        };
      }
    }
  }

  // 2. Match explicit agent.intents[] if configured
  if (Array.isArray(agent.intents) && agent.intents.length > 0) {
    let bestSpec: AgentIntentSpec | null = null;
    let bestScore = 0;
    let bestMatched: string[] = [];

    for (const spec of agent.intents) {
      const { score, matched } = scoreExplicitIntent(task, taskTokens, spec);
      if (score > bestScore) {
        bestScore = score;
        bestSpec = spec;
        bestMatched = matched;
      }
    }

    if (bestSpec && bestScore >= 0.45) {
      const slotRes = extractSlotsFromText(task, bestSpec.requiredSlots, memoryStringSlots);
      if (slotRes.missingSlots.length > 0 && bestSpec.clarifyOnMissingSlots !== false) {
        const clarificationMessage = buildClarificationPrompt(bestSpec, slotRes.missingSlots, slotRes.slots);
        return {
          intent: {
            id: bestSpec.id,
            description: bestSpec.description,
            confidence: bestScore,
            action: 'clarify',
            isFollowUp,
            slots: slotRes.slots,
            missingSlots: slotRes.missingSlots,
            matchedKeywords: bestMatched,
            targetAgentId: agent.id,
            targetAgentSlug: agent.slug
          },
          effectiveTask: task,
          clarificationMessage,
          nextPendingIntent: {
            intentId: bestSpec.id,
            originalTask: task,
            slots: slotRes.slots
          }
        };
      }

      return {
        intent: {
          id: bestSpec.id,
          description: bestSpec.description,
          confidence: bestScore,
          action: 'execute',
          isFollowUp,
          slots: slotRes.slots,
          missingSlots: slotRes.missingSlots,
          matchedKeywords: bestMatched,
          targetAgentId: agent.id,
          targetAgentSlug: agent.slug
        },
        effectiveTask: task,
        nextPendingIntent: null
      };
    }
  }

  // 3. Zero-config domain intent classification
  if (/^(hi|hello|hey|capabilities|help)\b/i.test(task.trim())) {
    return {
      intent: {
        id: 'capabilities_probe',
        confidence: 0.88,
        action: 'execute',
        isFollowUp,
        slots: {},
        missingSlots: [],
        targetAgentId: agent.id,
        targetAgentSlug: agent.slug
      },
      effectiveTask: task,
      nextPendingIntent: null
    };
  }

  if (isFollowUp) {
    return {
      intent: {
        id: 'follow_up_refinement',
        confidence: 0.86,
        action: 'execute',
        isFollowUp: true,
        slots: {},
        missingSlots: [],
        targetAgentId: agent.id,
        targetAgentSlug: agent.slug
      },
      effectiveTask: task,
      nextPendingIntent: null
    };
  }

  for (const dom of DOMAIN_EXPANSIONS) {
    if (dom.triggers.test(task)) {
      return {
        intent: {
          id: dom.intentId,
          confidence: 0.91,
          action: 'execute',
          isFollowUp: false,
          slots: {},
          missingSlots: [],
          targetAgentId: agent.id,
          targetAgentSlug: agent.slug
        },
        effectiveTask: task,
        nextPendingIntent: null
      };
    }
  }

  const fallbackIntentId = `${agent.slug.replace(/[^a-zA-Z0-9_]/g, '_')}_task`;
  return {
    intent: {
      id: fallbackIntentId,
      confidence: 0.72,
      action: 'execute',
      isFollowUp,
      slots: {},
      missingSlots: [],
      targetAgentId: agent.id,
      targetAgentSlug: agent.slug
    },
    effectiveTask: task,
    nextPendingIntent: null
  };
}

function buildAgentLexicon(agent: Agent): Set<string> {
  const parts: string[] = [
    agent.name,
    agent.slug.replace(/[-_]/g, ' '),
    agent.tagline,
    agent.systemPrompt.slice(0, 1200)
  ];
  for (const sk of agent.skills || []) {
    if (sk.enabled !== false) {
      parts.push(sk.name, sk.description);
    }
  }
  for (const mcp of agent.mcps || []) {
    parts.push(mcp.name);
    for (const t of mcp.tools || []) {
      parts.push(t.name.replace(/_/g, ' '), t.description);
    }
  }
  for (const intent of agent.intents || []) {
    parts.push(intent.id.replace(/[_-]/g, ' '), intent.description, ...(intent.keywords || []));
  }
  return new Set(tokenizeNormalized(parts.join(' ')));
}

export function scoreAgentForTask(agent: Agent, task: string): { score: number; matched: string[] } {
  const lexicon = buildAgentLexicon(agent);
  const rawTokens = tokenizeNormalized(task);
  const expanded = new Set(rawTokens);

  for (const dom of DOMAIN_EXPANSIONS) {
    if (dom.triggers.test(task)) {
      for (const bt of dom.boostTokens) {
        expanded.add(stemToken(bt));
      }
    }
  }

  const matched: string[] = [];
  let weightedHits = 0;

  for (const tok of rawTokens) {
    if (lexicon.has(tok)) {
      weightedHits += 1.5;
      if (!matched.includes(tok)) matched.push(tok);
    }
  }

  for (const tok of expanded) {
    if (!rawTokens.includes(tok) && lexicon.has(tok)) {
      weightedHits += 0.75;
    }
  }

  if (Array.isArray(agent.intents)) {
    const taskSet = new Set(rawTokens);
    for (const spec of agent.intents) {
      const explicit = scoreExplicitIntent(task, taskSet, spec);
      if (explicit.score >= 0.5) {
        weightedHits += explicit.score * 3.0;
      }
    }
  }

  const score = weightedHits <= 0 ? 0.15 : Math.min(0.99, 0.25 + weightedHits * 0.12);
  return { score: Number(score.toFixed(3)), matched };
}

export function routeAcrossFleet(params: {
  agents: Agent[];
  task: string;
  userProfile?: UserProfileState | null;
}): { agent: Agent; routing: AgentRoutingSummary; intentPreview: DetectedIntentResult } {
  const { agents, task, userProfile } = params;
  if (agents.length === 0) {
    throw new Error('No agents available in fleet.');
  }

  const activeAgentId = userProfile?.activeAgentId;
  const activeAgent = activeAgentId ? agents.find(a => a.id === activeAgentId) : undefined;
  const hasPriorContext = Boolean(activeAgent && (userProfile?.totalRuns || 0) > 0);
  const isFollowUp = detectFollowUpUtterance(task, hasPriorContext);

  // 1. If user has a pending multi-turn slot-fill intent on their active agent, stick to it unless clearly switching
  if (activeAgent && userProfile?.pendingIntents?.[activeAgent.id]) {
    const pending = userProfile.pendingIntents[activeAgent.id];
    const check = classifyIntentForAgent({
      agent: activeAgent,
      task,
      hasPriorContext: true,
      pendingIntent: pending,
      seedMemory: userProfile.userMemory
    });
    if (check.intent.resumedPending) {
      return {
        agent: activeAgent,
        routing: {
          targetAgentId: activeAgent.id,
          targetAgentSlug: activeAgent.slug,
          confidence: 0.98,
          stickyHit: true,
          switchedAgent: false,
          reason: 'pending_slot_fill'
        },
        intentPreview: check.intent
      };
    }
  }

  // 2. Score all candidate agents
  const scored = agents
    .map(ag => {
      const s = scoreAgentForTask(ag, task);
      return { agent: ag, score: s.score, matched: s.matched };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const activeScored = activeAgent ? scored.find(s => s.agent.id === activeAgent.id) : undefined;

  // 3. Apply per-user sticky affinity on follow-up turns or ambiguous ties
  if (activeAgent && activeScored) {
    const clearlyShiftedDomain =
      best.agent.id !== activeAgent.id &&
      best.score >= 0.52 &&
      best.score - activeScored.score >= 0.2;

    if (!clearlyShiftedDomain && (isFollowUp || best.score < 0.42)) {
      const cls = classifyIntentForAgent({
        agent: activeAgent,
        task,
        hasPriorContext: true,
        seedMemory: userProfile?.userMemory
      });
      return {
        agent: activeAgent,
        routing: {
          targetAgentId: activeAgent.id,
          targetAgentSlug: activeAgent.slug,
          confidence: Math.max(0.85, activeScored.score),
          stickyHit: true,
          switchedAgent: false,
          reason: isFollowUp ? 'follow_up_continuity' : 'sticky_user_affinity'
        },
        intentPreview: cls.intent
      };
    }

    if (best.agent.id !== activeAgent.id) {
      const cls = classifyIntentForAgent({
        agent: best.agent,
        task,
        hasPriorContext: false,
        seedMemory: userProfile?.userMemory
      });
      return {
        agent: best.agent,
        routing: {
          targetAgentId: best.agent.id,
          targetAgentSlug: best.agent.slug,
          confidence: best.score,
          stickyHit: false,
          switchedAgent: true,
          previousAgentId: activeAgent.id,
          reason: 'intent_shift'
        },
        intentPreview: cls.intent
      };
    }
  }

  const cls = classifyIntentForAgent({
    agent: best.agent,
    task,
    hasPriorContext,
    seedMemory: userProfile?.userMemory
  });
  return {
    agent: best.agent,
    routing: {
      targetAgentId: best.agent.id,
      targetAgentSlug: best.agent.slug,
      confidence: best.score,
      stickyHit: Boolean(activeAgent && best.agent.id === activeAgent.id),
      switchedAgent: false,
      reason: 'intent_match'
    },
    intentPreview: cls.intent
  };
}

export function validateAgentIntents(intents: unknown): { valid: boolean; error?: string } {
  if (intents === undefined) return { valid: true };
  if (!Array.isArray(intents) || intents.length > 25) {
    return { valid: false, error: 'Agent "intents" must be an array of up to 25 intent specifications.' };
  }
  for (const spec of intents) {
    if (!spec || typeof spec !== 'object' || typeof (spec as any).id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test((spec as any).id)) {
      return { valid: false, error: 'Each intent must include an alphanumeric "id" (1-64 chars).' };
    }
    if ((spec as any).requiredSlots !== undefined) {
      if (!Array.isArray((spec as any).requiredSlots) || (spec as any).requiredSlots.length > 15) {
        return { valid: false, error: 'Intent "requiredSlots" must be an array of up to 15 slot definitions.' };
      }
      for (const slot of (spec as any).requiredSlots) {
        if (!slot || typeof slot !== 'object' || typeof slot.name !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(slot.name)) {
          return { valid: false, error: 'Each requiredSlot must include an alphanumeric "name" (1-64 chars).' };
        }
      }
    }
  }
  return { valid: true };
}
