import type { Database } from "bun:sqlite";
import { sep } from "node:path";
import type { AgentModelRow } from "./db.ts";
import {
  getAgentDelegation,
  getByAgentModel,
  getCacheEfficiency,
  getCostPer1k,
  getPartsWithMessages,
  getSessionDateRange,
  getTokenTotals,
  getToolErrorRates,
  listSessionIds,
  listSessionIdsWithDir,
} from "./db.ts";
import type { AggregatedStats } from "./types.ts";

export interface FilterOptions {
  since?: number;
  projectDir?: string;
}

export function filterSessions(db: Database, opts: FilterOptions = {}): string[] {
  const since = opts.since ?? Date.now() - 30 * 86400 * 1000;

  if (!opts.projectDir) {
    return listSessionIds(db, since);
  }

  const rows = listSessionIdsWithDir(db, since);
  return rows
    .filter(
      // biome-ignore lint/style/noNonNullAssertion: opts.projectDir is checked truthy above
      (r) => r.directory === opts.projectDir || r.directory.startsWith(`${opts.projectDir!}${sep}`),
    )
    .map((r) => r.id);
}

export function reconstructTranscript(db: Database, sessionId: string): string {
  const rows = getPartsWithMessages(db, sessionId);

  const lines: string[] = [];
  for (const row of rows) {
    let part: Record<string, unknown>;
    try {
      part = JSON.parse(row.partData);
    } catch {
      continue;
    }

    const role: string = row.role ?? "unknown";

    if (part.type === "text" && part.text) {
      lines.push(`[${role}]: ${part.text}`);
    } else if (part.type === "tool" && part.tool) {
      // opencode stores tool name as a scalar string in $.tool (confirmed against production DB)
      const toolName: string = typeof part.tool === "string" ? part.tool : "unknown";
      const status: string =
        (part.state as { status?: string } | null | undefined)?.status ?? "unknown";
      lines.push(`[assistant]: Used ${toolName} (${status})`);
    } else if (part.type === "reasoning" && part.text) {
      lines.push(`[assistant]: (reasoning) ${String(part.text).slice(0, 200)}`);
    }
    // skip: step-start, step-finish, file, patch, subtask
  }

  return lines.join("\n");
}

function aggregateByAgent(rows: AgentModelRow[]): Array<{ agent: string; count: number }> {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.agent, (map.get(row.agent) ?? 0) + row.sessions);
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([agent, count]) => ({ agent, count }));
}

function aggregateByModel(rows: AgentModelRow[]): Array<{ model: string; count: number }> {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.model, (map.get(row.model) ?? 0) + row.sessions);
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([model, count]) => ({ model, count }));
}

export function aggregateAll(db: Database, sessionIds: string[]): AggregatedStats {
  const totals = getTokenTotals(db, sessionIds);
  const byAgentModel = getByAgentModel(db, sessionIds);
  const toolErrorRates = getToolErrorRates(db, sessionIds);
  const cacheEfficiency = getCacheEfficiency(db, sessionIds);
  const costPer1k = getCostPer1k(db, sessionIds);
  const agentDelegation = getAgentDelegation(db, sessionIds);

  return {
    totalSessions: sessionIds.length,
    analyzedSessions: sessionIds.length,
    dateRange: getSessionDateRange(db, sessionIds),
    totalMessages: totals.totalMessages,
    totalCost: totals.totalCost,
    totalTokens: totals.totalTokens,
    topTools: toolErrorRates.slice(0, 10).map((r) => ({ tool: r.tool, count: r.totalCalls })),
    topAgents: aggregateByAgent(byAgentModel).slice(0, 5),
    topModels: aggregateByModel(byAgentModel).slice(0, 5),
    byAgentModel,
    toolErrorRates,
    cacheEfficiency,
    costPer1k,
    agentDelegation,
  };
}
