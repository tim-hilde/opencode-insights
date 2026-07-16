#!/usr/bin/env bun
/**
 * Smoke test: runs DB queries + extract against the real opencode.db.
 * No LLM calls. Fast.
 */

import {
  getAgentDelegation,
  getByAgentModel,
  getCacheEfficiency,
  getCostPerMTok,
  getPartsWithMessages,
  getTokenTotals,
  getToolErrorRates,
  listSessionIds,
  openDb,
  resolveDbPath,
} from "../src/db.ts";
import { aggregateAll, filterSessions, reconstructTranscript } from "../src/extract.ts";

const dbPath = process.env.OPENCODE_DB ?? resolveDbPath();
console.log(`Opening: ${dbPath}`);

const db = openDb(dbPath);

try {
  // 1. Basic filter
  const since30 = Date.now() - 30 * 86400 * 1000;
  const ids = listSessionIds(db, since30);
  console.log(`Sessions (last 30 days, root only, no [insights]): ${ids.length}`);

  if (ids.length === 0) {
    console.log("No sessions found — check DB path or date filter");
    process.exit(1);
  }

  // 2. Token totals
  const totals = getTokenTotals(db, ids.slice(0, 50));
  console.log("Token totals (first 50 sessions):");
  console.log(
    `  input=${totals.totalTokensInput}, output=${totals.totalTokensOutput}, cost=$${totals.totalCost.toFixed(4)}`,
  );

  // 3. By agent/model
  const byAgentModel = getByAgentModel(db, ids.slice(0, 50));
  console.log(`Agent/model breakdown (${byAgentModel.length} groups):`);
  for (const row of byAgentModel.slice(0, 5)) {
    console.log(`  ${row.agent}/${row.model}: ${row.sessions} sessions, $${row.cost.toFixed(4)}`);
  }

  // 4. Tool error rates — this verifies $.tool.name JSON path
  const errorRates = getToolErrorRates(db, ids.slice(0, 50));
  console.log(`Tool error rates (${errorRates.length} tools):`);
  for (const row of errorRates.slice(0, 5)) {
    console.log(
      `  ${row.tool}: ${row.totalCalls} calls, ${(row.errorRate * 100).toFixed(1)}% errors`,
    );
  }

  if (errorRates.length === 0) {
    console.log("  WARNING: No tool data found. Checking part data shape...");
    // Debug: check what $.type values exist
    const sample = db
      .query<{ types: string }, []>(
        `SELECT GROUP_CONCAT(DISTINCT json_extract(data, '$.type')) as types FROM part LIMIT 100`,
      )
      .get();
    console.log(`  Part types found: ${sample?.types}`);

    // Check if tool name is at $.tool or $.tool.name
    const toolSample = db
      .query<{ tool_name: string; tool_raw: string }, []>(
        `SELECT json_extract(data, '$.tool.name') as tool_name, json_extract(data, '$.tool') as tool_raw FROM part WHERE json_extract(data, '$.type') = 'tool' LIMIT 3`,
      )
      .all();
    console.log("  Tool name samples ($.tool.name vs $.tool):");
    for (const r of toolSample) {
      console.log(`    $.tool.name=${r.tool_name}, $.tool=${r.tool_raw}`);
    }
  }

  // 5. Cache efficiency
  const cache = getCacheEfficiency(db, ids.slice(0, 50));
  console.log(`Cache efficiency (${cache.length} models):`);
  for (const row of cache.slice(0, 3)) {
    console.log(`  ${row.model}: ${(row.cacheRatio * 100).toFixed(1)}% cached`);
  }

  // 6. Reconstruct transcript for first session
  const firstId = ids[0];
  const transcript = reconstructTranscript(db, firstId);
  console.log(`\nTranscript for session ${firstId} (${transcript.length} chars):`);
  console.log(transcript.slice(0, 500));
  if (transcript.length > 500) console.log("...");

  // 7. Full aggregation
  console.log("\nRunning aggregateAll on first 20 sessions...");
  const stats = aggregateAll(db, ids.slice(0, 20));
  console.log(
    `Stats: ${stats.totalSessions} sessions, $${stats.totalCost.toFixed(4)} cost, ${stats.totalTokens} tokens`,
  );
  console.log(
    `Date range: ${new Date(stats.dateRange.from).toLocaleDateString()} – ${new Date(stats.dateRange.to).toLocaleDateString()}`,
  );
  console.log(
    `Top tools: ${stats.topTools
      .slice(0, 3)
      .map((t) => `${t.tool}(${t.count})`)
      .join(", ")}`,
  );
  console.log(
    `Top agents: ${stats.topAgents
      .slice(0, 3)
      .map((a) => `${a.agent}(${a.count})`)
      .join(", ")}`,
  );

  console.log("\n✅ Smoke test passed");
} finally {
  db.close();
}
