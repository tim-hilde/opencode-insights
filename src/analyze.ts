import type { Database } from "bun:sqlite";
import type { FacetCache } from "./cache.ts";
import { getSessionMeta } from "./db.ts";
import { reconstructTranscript } from "./extract.ts";
import { mapLimit, runLlm, runLlmJson } from "./llm.ts";
import type { LlmClient } from "./llm.ts";
import {
  buildAgentPerformancePrompt,
  buildAtAGlancePrompt,
  buildChunkSummaryPrompt,
  buildFacetPrompt,
  buildFrictionPrompt,
  buildHorizonPrompt,
  buildInteractionStylePrompt,
  buildProjectAreasPrompt,
  buildRoomToLearnPrompt,
  buildSuggestionsPrompt,
  buildToolHealthPrompt,
} from "./prompts.ts";
import type { AggregatedStats, InsightsConfig, SessionFacet } from "./types.ts";
import { FRICTION_CATEGORIES, GOAL_CATEGORIES, SATISFACTION_LEVELS } from "./types.ts";

const CHUNK_SIZE = 25000;
const PASSTHROUGH = 30000;
const MAX_NEW_SESSIONS = 200;

/** Max parallel chunk-summary LLM calls inside prepareTranscript.
 *  Note: each facet extraction already runs config.concurrency workers,
 *  so effective parallel LLM calls = config.concurrency × CHUNK_CONCURRENCY.
 */
const CHUNK_CONCURRENCY = 1;

/** Extracts the retry knobs from config so every analysis call shares one policy. */
function retryOptsFrom(config: InsightsConfig): {
  maxRetries?: number;
  retryDelayMs?: number;
} {
  return { maxRetries: config.maxRetries, retryDelayMs: config.retryDelayMs };
}

export async function prepareTranscript(
  client: LlmClient,
  transcript: string,
  model: { providerID: string; modelID: string },
): Promise<string> {
  if (transcript.length <= PASSTHROUGH) return transcript;

  const chunks: string[] = [];
  for (let i = 0; i < transcript.length; i += CHUNK_SIZE) {
    chunks.push(transcript.slice(i, i + CHUNK_SIZE));
  }

  try {
    const summaries = await mapLimit(chunks, CHUNK_CONCURRENCY, async (chunk) => {
      const prompt = buildChunkSummaryPrompt(chunk);
      return runLlm(client, { model, prompt });
    });
    return summaries.join("\n\n---\n\n");
  } catch {
    const keep = Math.floor(PASSTHROUGH * 0.4);
    return `${transcript.slice(0, keep)}\n[...truncated...]\n${transcript.slice(-keep)}`;
  }
}

function normalizeCategories<T extends string>(
  raw: unknown,
  allowed: readonly T[],
): Partial<Record<T, number>> {
  if (!raw || typeof raw !== "object") return {};
  const result: Partial<Record<T, number>> = {};
  for (const key of Object.keys(raw as object)) {
    if ((allowed as readonly string[]).includes(key)) {
      const val = (raw as Record<string, unknown>)[key];
      result[key as T] = typeof val === "number" ? val : 0;
    }
  }
  return result;
}

function normalizeFacet(sessionId: string, raw: unknown): SessionFacet {
  if (!raw || typeof raw !== "object") throw new Error("Invalid facet JSON");
  const r = raw as Record<string, unknown>;

  return {
    sessionId,
    underlyingGoal: String(r.underlying_goal ?? r.underlyingGoal ?? ""),
    goalCategories: normalizeCategories(r.goal_categories ?? r.goalCategories, GOAL_CATEGORIES),
    outcome: String(r.outcome ?? ""),
    satisfaction: normalizeCategories(r.satisfaction, SATISFACTION_LEVELS),
    frictionCounts: normalizeCategories(r.friction_counts ?? r.frictionCounts, FRICTION_CATEGORIES),
    frictionDetail: String(r.friction_detail ?? r.frictionDetail ?? ""),
    primarySuccess: String(r.primary_success ?? r.primarySuccess ?? ""),
    briefSummary: String(r.brief_summary ?? r.briefSummary ?? ""),
  };
}

export async function extractFacets(
  db: Database,
  client: LlmClient,
  sessionIds: string[],
  config: InsightsConfig,
  cache: FacetCache,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, SessionFacet>> {
  const result = new Map<string, SessionFacet>();

  const uncached: string[] = [];
  for (const id of sessionIds) {
    if (!config.force) {
      const facet = cache.get(id);
      if (facet) {
        result.set(id, facet);
        continue;
      }
    }
    uncached.push(id);
  }

  const toProcess = uncached.slice(0, config.maxSessions);
  const total = toProcess.length;
  if (total === 0) return result;

  let done = 0;

  await mapLimit(toProcess, config.concurrency, async (sessionId) => {
    try {
      const transcript = reconstructTranscript(db, sessionId);
      const prepared = await prepareTranscript(client, transcript, config.model);
      const meta = getSessionMeta(db, sessionId);
      const metaSummary = meta
        ? JSON.stringify({
            title: meta.title,
            duration: `${meta.durationMinutes.toFixed(1)}m`,
            messages: `${meta.userMsgCount} user, ${meta.assistantMsgCount} assistant`,
            cost: `$${meta.cost.toFixed(4)}`,
            agents: Object.keys(meta.agentCounts),
          })
        : "";

      const prompt = buildFacetPrompt(prepared, metaSummary);
      const parsed = await runLlmJson(client, {
        model: config.model,
        prompt,
        ...retryOptsFrom(config),
      });
      const facet = normalizeFacet(sessionId, parsed);

      cache.put(sessionId, facet);
      result.set(sessionId, facet);
    } catch {
      // Skip failed sessions — don't abort the whole pipeline
    } finally {
      done++;
      onProgress?.(done, total);
    }
  });

  return result;
}

function buildRollupData(
  facets: Map<string, SessionFacet>,
  stats: AggregatedStats,
): Record<string, unknown> {
  const outcomeCounts: Record<string, number> = {};
  const satisfactionCounts: Record<string, number> = {};
  const frictionCounts: Record<string, number> = {};
  const goalCounts: Record<string, number> = {};
  const summaries: string[] = [];

  for (const facet of facets.values()) {
    if (facet.outcome) outcomeCounts[facet.outcome] = (outcomeCounts[facet.outcome] ?? 0) + 1;
    for (const [k, v] of Object.entries(facet.satisfaction)) {
      if (v) satisfactionCounts[k] = (satisfactionCounts[k] ?? 0) + 1;
    }
    for (const [k, v] of Object.entries(facet.frictionCounts)) {
      if (v) frictionCounts[k] = (frictionCounts[k] ?? 0) + (v as number);
    }
    for (const [k, v] of Object.entries(facet.goalCategories)) {
      if (v) goalCounts[k] = (goalCounts[k] ?? 0) + 1;
    }
    if (facet.briefSummary) summaries.push(facet.briefSummary);
  }

  return {
    total_sessions: stats.totalSessions,
    analyzed_sessions: facets.size,
    date_range: stats.dateRange,
    total_cost: stats.totalCost,
    total_tokens: stats.totalTokens,
    top_tools: stats.topTools,
    top_agents: stats.topAgents,
    top_models: stats.topModels,
    by_agent_model: stats.byAgentModel,
    tool_error_rates: stats.toolErrorRates,
    cache_efficiency: stats.cacheEfficiency,
    cost_per_1k: stats.costPer1k,
    agent_delegation: stats.agentDelegation,
    outcome_counts: outcomeCounts,
    satisfaction_counts: satisfactionCounts,
    friction_counts: frictionCounts,
    goal_category_counts: goalCounts,
    session_summaries: summaries.slice(0, 50),
  };
}

const AGGREGATE_PROMPTS: Array<{ key: string; builder: (data: unknown) => string }> = [
  { key: "project_areas", builder: buildProjectAreasPrompt },
  { key: "interaction_style", builder: buildInteractionStylePrompt },
  { key: "agent_performance", builder: buildAgentPerformancePrompt },
  { key: "friction", builder: buildFrictionPrompt },
  { key: "suggestions", builder: buildSuggestionsPrompt },
  { key: "tool_health", builder: buildToolHealthPrompt },
  { key: "room_to_learn", builder: buildRoomToLearnPrompt },
  { key: "horizon", builder: buildHorizonPrompt },
];

export async function runAggregateAnalysis(
  facets: Map<string, SessionFacet>,
  stats: AggregatedStats,
  config: InsightsConfig,
  client: LlmClient,
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, unknown>> {
  const rollupData = buildRollupData(facets, stats);
  const results: Record<string, unknown> = {};
  const total = AGGREGATE_PROMPTS.length;
  let done = 0;

  await mapLimit(AGGREGATE_PROMPTS, config.concurrency, async ({ key, builder }) => {
    try {
      const prompt = builder(rollupData);
      results[key] = await runLlmJson(client, {
        model: config.model,
        prompt,
        ...retryOptsFrom(config),
      });
    } catch {
      results[key] = {};
    } finally {
      done++;
      onProgress?.(done, total);
    }
  });

  return results;
}

export async function generateAtAGlance(
  aggregates: Record<string, unknown>,
  stats: AggregatedStats,
  config: InsightsConfig,
  client: LlmClient,
): Promise<Record<string, unknown>> {
  const statsSummary = {
    total_sessions: stats.totalSessions,
    analyzed_sessions: stats.analyzedSessions,
    date_range: stats.dateRange,
    total_cost: stats.totalCost,
    total_tokens: stats.totalTokens,
    top_tools: stats.topTools.slice(0, 5),
    top_agents: stats.topAgents.slice(0, 5),
  };
  try {
    const prompt = buildAtAGlancePrompt(aggregates, statsSummary);
    return (await runLlmJson(client, {
      model: config.model,
      prompt,
      ...retryOptsFrom(config),
    })) as Record<string, unknown>;
  } catch {
    return {};
  }
}
