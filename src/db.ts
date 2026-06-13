import { Database } from "bun:sqlite";
import type { SessionMeta } from "./types.ts";

export function openDb(path: string): Database {
  return new Database(path, { readonly: true });
}

export function resolveDbPath(stateDir?: string): string {
  if (process.env.OPENCODE_DB) return process.env.OPENCODE_DB;
  if (stateDir) return `${stateDir}/opencode.db`;
  const xdg = process.env.XDG_DATA_HOME ?? `${process.env.HOME}/.local/share`;
  return `${xdg}/opencode/opencode.db`;
}

export function listSessionIds(db: Database, since: number): string[] {
  const rows = db
    .query<{ id: string }, [number]>(`
    SELECT id FROM session
    WHERE parent_id IS NULL
      AND title NOT LIKE '[insights]%'
      AND time_created >= ?
    ORDER BY time_created DESC
  `)
    .all(since);
  return rows.map((r) => r.id);
}

export function listSessionIdsWithDir(
  db: Database,
  since: number,
): Array<{ id: string; directory: string }> {
  return db
    .query<{ id: string; directory: string }, [number]>(`
    SELECT id, directory
    FROM session
    WHERE parent_id IS NULL
      AND title NOT LIKE '[insights]%'
      AND time_created >= ?
    ORDER BY time_created DESC
  `)
    .all(since);
}

export interface TokenTotals {
  totalCost: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalTokensReasoning: number;
  totalTokensCacheRead: number;
  totalTokensCacheWrite: number;
  totalTokens: number;
  totalMessages: number;
}

export function getTokenTotals(db: Database, sessionIds: string[]): TokenTotals {
  if (sessionIds.length === 0) {
    return {
      totalCost: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalTokensReasoning: 0,
      totalTokensCacheRead: 0,
      totalTokensCacheWrite: 0,
      totalTokens: 0,
      totalMessages: 0,
    };
  }
  const placeholders = sessionIds.map(() => "?").join(",");
  const row = db
    .query<
      {
        cost: number;
        input: number;
        output: number;
        reasoning: number;
        cache_read: number;
        cache_write: number;
        total: number;
      },
      string[]
    >(`
    SELECT
      SUM(cost) as cost,
      SUM(tokens_input) as input,
      SUM(tokens_output) as output,
      SUM(tokens_reasoning) as reasoning,
      SUM(tokens_cache_read) as cache_read,
      SUM(tokens_cache_write) as cache_write,
      SUM(tokens_input + tokens_output + tokens_reasoning + tokens_cache_read) as total
    FROM session WHERE id IN (${placeholders})
  `)
    .get(...sessionIds);

  const msgRow = db
    .query<{ cnt: number }, string[]>(`
    SELECT COUNT(*) as cnt FROM message WHERE session_id IN (${placeholders})
  `)
    .get(...sessionIds);

  return {
    totalCost: row?.cost ?? 0,
    totalTokensInput: row?.input ?? 0,
    totalTokensOutput: row?.output ?? 0,
    totalTokensReasoning: row?.reasoning ?? 0,
    totalTokensCacheRead: row?.cache_read ?? 0,
    totalTokensCacheWrite: row?.cache_write ?? 0,
    totalTokens: row?.total ?? 0,
    totalMessages: msgRow?.cnt ?? 0,
  };
}

export interface AgentModelRow {
  agent: string;
  model: string;
  sessions: number;
  cost: number;
  tokens: number;
}

export function getByAgentModel(db: Database, sessionIds: string[]): AgentModelRow[] {
  if (sessionIds.length === 0) return [];
  const placeholders = sessionIds.map(() => "?").join(",");
  return db
    .query<AgentModelRow, string[]>(`
    SELECT
      COALESCE(agent, 'unknown') as agent,
      COALESCE(model, 'unknown') as model,
      COUNT(*) as sessions,
      SUM(cost) as cost,
      SUM(tokens_input + tokens_output + tokens_reasoning + tokens_cache_read) as tokens
    FROM session
    WHERE id IN (${placeholders})
    GROUP BY agent, model
    ORDER BY cost DESC
  `)
    .all(...sessionIds);
}

export interface ToolErrorRateRow {
  tool: string;
  totalCalls: number;
  errorCalls: number;
  errorRate: number;
}

export function getToolErrorRates(db: Database, sessionIds: string[]): ToolErrorRateRow[] {
  if (sessionIds.length === 0) return [];
  const placeholders = sessionIds.map(() => "?").join(",");
  const rows = db
    .query<{ tool: string; total: number; errors: number }, string[]>(`
    SELECT
      json_extract(data, '$.tool') as tool,
      COUNT(*) as total,
      SUM(CASE WHEN json_extract(data, '$.state.status') = 'error' THEN 1 ELSE 0 END) as errors
    FROM part
    WHERE session_id IN (${placeholders})
      AND json_extract(data, '$.type') = 'tool'
      AND json_extract(data, '$.tool') IS NOT NULL
    GROUP BY tool
    ORDER BY total DESC
  `)
    .all(...sessionIds);
  return rows.map((r) => ({
    tool: r.tool,
    totalCalls: r.total,
    errorCalls: r.errors,
    errorRate: r.total > 0 ? r.errors / r.total : 0,
  }));
}

export interface CacheEfficiencyRow {
  model: string;
  cacheRatio: number;
}

export function getCacheEfficiency(db: Database, sessionIds: string[]): CacheEfficiencyRow[] {
  if (sessionIds.length === 0) return [];
  const placeholders = sessionIds.map(() => "?").join(",");
  const rows = db
    .query<{ model: string; cache_read: number; input: number }, string[]>(`
    SELECT
      COALESCE(model, 'unknown') as model,
      SUM(tokens_cache_read) as cache_read,
      SUM(tokens_input) as input
    FROM session
    WHERE id IN (${placeholders})
    GROUP BY model
  `)
    .all(...sessionIds);
  return rows.map((r) => ({
    model: r.model,
    cacheRatio: r.input + r.cache_read > 0 ? r.cache_read / (r.input + r.cache_read) : 0,
  }));
}

export interface CostPer1kRow {
  model: string;
  costPer1kTokens: number;
}

export function getCostPer1k(db: Database, sessionIds: string[]): CostPer1kRow[] {
  if (sessionIds.length === 0) return [];
  const placeholders = sessionIds.map(() => "?").join(",");
  const rows = db
    .query<{ model: string; cost: number; tokens: number }, string[]>(`
    SELECT
      COALESCE(model, 'unknown') as model,
      SUM(cost) as cost,
      SUM(tokens_input + tokens_output + tokens_reasoning + tokens_cache_read) as tokens
    FROM session
    WHERE id IN (${placeholders})
    GROUP BY model
    HAVING tokens > 0
  `)
    .all(...sessionIds);
  return rows.map((r) => ({
    model: r.model,
    costPer1kTokens: (r.cost / r.tokens) * 1000,
  }));
}

export interface AgentDelegationRow {
  parentAgent: string;
  childAgent: string;
  count: number;
}

export function getAgentDelegation(db: Database, sessionIds: string[]): AgentDelegationRow[] {
  if (sessionIds.length === 0) return [];
  const placeholders = sessionIds.map(() => "?").join(",");
  const params = [...sessionIds, ...sessionIds];
  return db
    .query<AgentDelegationRow, string[]>(`
    SELECT
      COALESCE(parent.agent, 'unknown') as parentAgent,
      COALESCE(child.agent, 'unknown') as childAgent,
      COUNT(*) as count
    FROM session child
    JOIN session parent ON child.parent_id = parent.id
    WHERE child.id IN (${placeholders}) OR parent.id IN (${placeholders})
    GROUP BY parentAgent, childAgent
    ORDER BY count DESC
  `)
    .all(...params);
}

export interface PartWithRole {
  partData: string;
  role: string;
}

export function getPartsWithMessages(db: Database, sessionId: string): PartWithRole[] {
  return db
    .query<PartWithRole, [string]>(`
    SELECT p.data as partData, json_extract(m.data, '$.role') as role
    FROM part p
    JOIN message m ON p.message_id = m.id
    WHERE m.session_id = ?
    ORDER BY p.time_created ASC, p.id ASC
  `)
    .all(sessionId);
}

export function getSessionDateRange(
  db: Database,
  sessionIds: string[],
): { from: number; to: number } {
  if (sessionIds.length === 0) return { from: 0, to: 0 };
  const placeholders = sessionIds.map(() => "?").join(",");
  const row = db
    .query<{ from_ts: number; to_ts: number }, string[]>(
      `SELECT MIN(time_created) as from_ts, MAX(time_created) as to_ts FROM session WHERE id IN (${placeholders})`,
    )
    .get(...sessionIds);
  return { from: row?.from_ts ?? 0, to: row?.to_ts ?? 0 };
}

export function getSessionMeta(db: Database, sessionId: string): SessionMeta | null {
  const session = db
    .query<
      {
        id: string;
        title: string;
        directory: string | null;
        parent_id: string | null;
        time_created: number;
        time_updated: number;
        cost: number;
        tokens_input: number;
        tokens_output: number;
        tokens_reasoning: number;
        tokens_cache_read: number;
        tokens_cache_write: number;
      },
      [string]
    >(`
    SELECT id, title, directory, parent_id, time_created, time_updated,
      cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write
    FROM session WHERE id = ?
  `)
    .get(sessionId);

  if (!session) return null;

  const msgCounts = db
    .query<{ role: string; cnt: number }, [string]>(`
    SELECT json_extract(data, '$.role') as role, COUNT(*) as cnt
    FROM message WHERE session_id = ? GROUP BY role
  `)
    .all(sessionId);

  const userMsgCount = msgCounts.find((r) => r.role === "user")?.cnt ?? 0;
  const assistantMsgCount = msgCounts.find((r) => r.role === "assistant")?.cnt ?? 0;

  const toolRows = db
    .query<{ tool: string; cnt: number }, [string]>(`
    SELECT json_extract(data, '$.tool') as tool, COUNT(*) as cnt
    FROM part WHERE session_id = ?
      AND json_extract(data, '$.type') = 'tool'
      AND json_extract(data, '$.tool') IS NOT NULL
    GROUP BY tool
  `)
    .all(sessionId);
  const toolCounts: Record<string, number> = {};
  for (const r of toolRows) toolCounts[r.tool] = r.cnt;

  const agentRows = db
    .query<{ agent: string; cnt: number }, [string]>(`
    SELECT COALESCE(json_extract(data, '$.agent'), 'unknown') as agent, COUNT(*) as cnt
    FROM message WHERE session_id = ? AND json_extract(data, '$.role') = 'assistant'
    GROUP BY agent
  `)
    .all(sessionId);
  const agentCounts: Record<string, number> = {};
  for (const r of agentRows) agentCounts[r.agent] = r.cnt;

  const modelRows = db
    .query<{ model: string; cnt: number }, [string]>(`
    SELECT COALESCE(json_extract(data, '$.modelID'), 'unknown') as model, COUNT(*) as cnt
    FROM message WHERE session_id = ? AND json_extract(data, '$.role') = 'assistant'
    GROUP BY model
  `)
    .all(sessionId);
  const modelCounts: Record<string, number> = {};
  for (const r of modelRows) modelCounts[r.model] = r.cnt;

  return {
    id: session.id,
    title: session.title,
    projectDir: session.directory,
    parentId: session.parent_id,
    durationMinutes: (session.time_updated - session.time_created) / 60000,
    userMsgCount,
    assistantMsgCount,
    inputTokens: session.tokens_input,
    outputTokens: session.tokens_output,
    reasoningTokens: session.tokens_reasoning,
    cacheReadTokens: session.tokens_cache_read,
    cacheWriteTokens: session.tokens_cache_write,
    totalTokens:
      session.tokens_input +
      session.tokens_output +
      session.tokens_reasoning +
      session.tokens_cache_read,
    cost: session.cost,
    toolCounts,
    agentCounts,
    modelCounts,
    startTime: session.time_created,
    endTime: session.time_updated,
  };
}
