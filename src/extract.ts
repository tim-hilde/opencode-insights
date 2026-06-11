import { Database } from "bun:sqlite"
import type { AggregatedStats } from "./types.ts"
import type { AgentModelRow } from "./db.ts"
import {
  listSessionIds,
  getSessionMeta,
  getTokenTotals,
  getByAgentModel,
  getToolErrorRates,
  getCacheEfficiency,
  getCostPer1k,
  getAgentDelegation,
} from "./db.ts"

export interface FilterOptions {
  since?: number
  projectDir?: string
}

export function filterSessions(db: Database, opts: FilterOptions = {}): string[] {
  const since = opts.since ?? Date.now() - 30 * 86400 * 1000
  const ids = listSessionIds(db, since)
  if (!opts.projectDir) return ids
  return ids.filter(id => {
    const meta = getSessionMeta(db, id)
    return meta?.projectDir?.startsWith(opts.projectDir!) ?? false
  })
}

export function reconstructTranscript(db: Database, sessionId: string): string {
  const rows = db.query<{ part_data: string; msg_data: string }, [string]>(`
    SELECT p.data as part_data, m.data as msg_data
    FROM part p
    JOIN message m ON p.message_id = m.id
    WHERE m.session_id = ?
    ORDER BY p.time_created ASC, p.id ASC
  `).all(sessionId)

  const lines: string[] = []
  for (const row of rows) {
    let part: Record<string, any>
    let msg: Record<string, any>
    try {
      part = JSON.parse(row.part_data)
      msg = JSON.parse(row.msg_data)
    } catch {
      continue
    }

    const role: string = msg.role ?? "unknown"

    if (part.type === "text" && part.text) {
      lines.push(`[${role}]: ${part.text}`)
    } else if (part.type === "tool" && part.tool?.name) {
      const status: string = part.state?.status ?? "unknown"
      lines.push(`[assistant]: Used ${part.tool.name} (${status})`)
    } else if (part.type === "reasoning" && part.text) {
      lines.push(`[assistant]: (reasoning) ${String(part.text).slice(0, 200)}`)
    }
    // skip: step-start, step-finish, file, patch, subtask
  }

  return lines.join("\n")
}

function getDateRange(db: Database, sessionIds: string[]): { from: number; to: number } {
  if (sessionIds.length === 0) return { from: 0, to: 0 }
  const placeholders = sessionIds.map(() => "?").join(",")
  const row = db.query<{ from_ts: number; to_ts: number }, string[]>(`
    SELECT MIN(time_created) as from_ts, MAX(time_created) as to_ts
    FROM session WHERE id IN (${placeholders})
  `).get(...sessionIds)
  return { from: row?.from_ts ?? 0, to: row?.to_ts ?? 0 }
}

function aggregateByAgent(rows: AgentModelRow[]): Array<{ agent: string; count: number }> {
  const map = new Map<string, number>()
  for (const row of rows) map.set(row.agent, (map.get(row.agent) ?? 0) + row.sessions)
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([agent, count]) => ({ agent, count }))
}

function aggregateByModel(rows: AgentModelRow[]): Array<{ model: string; count: number }> {
  const map = new Map<string, number>()
  for (const row of rows) map.set(row.model, (map.get(row.model) ?? 0) + row.sessions)
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([model, count]) => ({ model, count }))
}

export function aggregateAll(db: Database, sessionIds: string[]): AggregatedStats {
  const totals = getTokenTotals(db, sessionIds)
  const byAgentModel = getByAgentModel(db, sessionIds)
  const toolErrorRates = getToolErrorRates(db, sessionIds)
  const cacheEfficiency = getCacheEfficiency(db, sessionIds)
  const costPer1k = getCostPer1k(db, sessionIds)
  const agentDelegation = getAgentDelegation(db, sessionIds)

  return {
    totalSessions: sessionIds.length,
    analyzedSessions: sessionIds.length,
    dateRange: getDateRange(db, sessionIds),
    totalMessages: totals.totalMessages,
    totalCost: totals.totalCost,
    totalTokens: totals.totalTokens,
    topTools: toolErrorRates.slice(0, 10).map(r => ({ tool: r.tool, count: r.totalCalls })),
    topAgents: aggregateByAgent(byAgentModel).slice(0, 5),
    topModels: aggregateByModel(byAgentModel).slice(0, 5),
    byAgentModel,
    toolErrorRates,
    cacheEfficiency,
    costPer1k,
    agentDelegation,
  }
}
