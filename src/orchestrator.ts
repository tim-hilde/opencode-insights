import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { extractFacets, generateAtAGlance, runAggregateAnalysis } from "./analyze.ts";
import { FacetCache } from "./cache.ts";
import { openDb, resolveDbPath } from "./db.ts";
import { aggregateAll, filterSessions } from "./extract.ts";
import type { LlmClient } from "./llm.ts";
import { generateReport } from "./report.ts";
import type { InsightsConfig } from "./types.ts";

export interface OrchestratorDeps {
  client: LlmClient;
  stateDir: string;
  dbPath?: string;
  projectDir?: string;
}

export interface InsightsResult {
  reportPath: string;
  jsonPath: string;
  atAGlance: Record<string, unknown>;
  sessionCount: number;
  analyzedCount: number;
  totalCost: number;
}

export async function runInsights(
  deps: OrchestratorDeps,
  config: InsightsConfig,
  onProgress?: (phase: string, done?: number, total?: number) => void,
): Promise<InsightsResult> {
  const dbPath = deps.dbPath ?? resolveDbPath(deps.stateDir);
  const db = openDb(dbPath);
  try {
    const sessionIds = filterSessions(db, {
      since: Date.now() - config.days * 86400000,
      projectDir: config.projectOnly ? deps.projectDir : undefined,
    });

    const stats = aggregateAll(db, sessionIds);

    const cache = new FacetCache(join(deps.stateDir, "insights", "facets"));
    if (config.force) cache.clear();

    const facets = await extractFacets(db, deps.client, sessionIds, config, cache, (done, total) =>
      onProgress?.("facets", done, total),
    );

    stats.analyzedSessions = facets.size;

    onProgress?.("aggregates");
    const aggregates = await runAggregateAnalysis(facets, stats, config, deps.client);

    onProgress?.("at_a_glance");
    const atAGlance = await generateAtAGlance(aggregates, stats, config, deps.client);

    const insightsJson = {
      generatedAt: new Date().toISOString(),
      config: { model: config.model, days: config.days },
      stats,
      sessionIds,
      facets: Object.fromEntries(facets),
      aggregates,
      atAGlance,
    };

    const html = generateReport(
      { stats, facets, aggregates, atAGlance, config, generatedAt: Date.now() },
      JSON.stringify(insightsJson, null, 2),
    );

    const reportPath = config.output;
    const jsonPath = reportPath.endsWith(".html")
      ? `${reportPath.slice(0, -5)}.json`
      : `${reportPath}.json`;

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, html, "utf-8");
    writeFileSync(jsonPath, JSON.stringify(insightsJson, null, 2), "utf-8");

    return {
      reportPath,
      jsonPath,
      atAGlance,
      sessionCount: sessionIds.length,
      analyzedCount: facets.size,
      totalCost: stats.totalCost,
    };
  } finally {
    db.close();
  }
}
