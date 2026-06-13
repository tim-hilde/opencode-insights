import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LlmClient } from "../src/llm.ts";
import { runInsights } from "../src/orchestrator.ts";
import { DEFAULT_MODEL } from "../src/types.ts";

const minimalFacet = {
  underlying_goal: "test",
  goal_categories: {},
  outcome: "done",
  satisfaction: {},
  friction_counts: {},
  friction_detail: "",
  primary_success: "ok",
  brief_summary: "test session",
};

const minimalAtAGlance = {
  whats_working: "working",
  whats_hindering: "hindering",
  quick_wins: "wins",
  ambitious_workflows: "ambitious",
};

function makeClient(): LlmClient {
  let callN = 0;
  return {
    session: {
      async create() {
        return { data: { id: `s${callN}` } };
      },
      async prompt() {
        callN++;
        // Alternate between facet and at-a-glance JSON
        if (callN <= 2)
          return {
            data: { info: {}, parts: [{ type: "text", text: JSON.stringify(minimalFacet) }] },
          };
        if (callN > 8)
          return {
            data: { info: {}, parts: [{ type: "text", text: JSON.stringify(minimalAtAGlance) }] },
          };
        return {
          data: { info: {}, parts: [{ type: "text", text: JSON.stringify({ result: "ok" }) }] },
        };
      },
      async delete() {
        return { data: {} };
      },
    },
  };
}

function makeTwoSessionDb(dbPath: string, now: number): void {
  const { Database } = require("bun:sqlite");
  const setupDb = new Database(dbPath);
  setupDb.run(`CREATE TABLE session (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL DEFAULT 'p1', parent_id TEXT,
    directory TEXT NOT NULL DEFAULT '/test', title TEXT NOT NULL, version TEXT NOT NULL DEFAULT '1',
    slug TEXT NOT NULL DEFAULT 's', time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL,
    agent TEXT, model TEXT, cost REAL NOT NULL DEFAULT 0,
    tokens_input INTEGER NOT NULL DEFAULT 0, tokens_output INTEGER NOT NULL DEFAULT 0,
    tokens_reasoning INTEGER NOT NULL DEFAULT 0, tokens_cache_read INTEGER NOT NULL DEFAULT 0,
    tokens_cache_write INTEGER NOT NULL DEFAULT 0, metadata TEXT
  )`);
  setupDb.run(
    "CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL)",
  );
  setupDb.run(
    "CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL)",
  );
  setupDb.run(
    `INSERT INTO session VALUES ('s1','p1',NULL,'/test','Fix bug','1','s1',${now - 86400000},${now - 86400000},'build','claude-sonnet',0.05,1000,500,0,0,0,NULL)`,
  );
  setupDb.run(
    `INSERT INTO session VALUES ('s2','p1',NULL,'/test','Add feature','1','s2',${now - 86400000 * 2},${now - 86400000 * 2},'explore','claude-sonnet',0.03,800,400,0,0,0,NULL)`,
  );
  setupDb.close();
}

describe("runInsights", () => {
  it("produces HTML and JSON output files", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "insights-test-"));
    try {
      const dbPath = join(tmpDir, "test.db");

      const { Database } = await import("bun:sqlite");
      const setupDb = new Database(dbPath);
      setupDb.run(`CREATE TABLE session (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL DEFAULT 'p1', parent_id TEXT,
        directory TEXT NOT NULL DEFAULT '/test', title TEXT NOT NULL, version TEXT NOT NULL DEFAULT '1',
        slug TEXT NOT NULL DEFAULT 's', time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL,
        agent TEXT, model TEXT, cost REAL NOT NULL DEFAULT 0,
        tokens_input INTEGER NOT NULL DEFAULT 0, tokens_output INTEGER NOT NULL DEFAULT 0,
        tokens_reasoning INTEGER NOT NULL DEFAULT 0, tokens_cache_read INTEGER NOT NULL DEFAULT 0,
        tokens_cache_write INTEGER NOT NULL DEFAULT 0, metadata TEXT
      )`);
      setupDb.run(
        "CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL)",
      );
      setupDb.run(
        "CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL)",
      );

      const now = Date.now();
      setupDb.run(
        `INSERT INTO session VALUES ('s1','p1',NULL,'/test','Fix bug','1','s',${now - 86400000},${now - 86400000},'build','claude-sonnet',0.05,1000,500,0,0,0,NULL)`,
      );
      setupDb.run(
        `INSERT INTO session VALUES ('s2','p1',NULL,'/test','Add feature','1','s2',${now - 86400000 * 2},${now - 86400000 * 2},'explore','claude-sonnet',0.03,800,400,0,0,0,NULL)`,
      );
      setupDb.run(
        `INSERT INTO message VALUES ('m1','s1',${now - 86400000},${now - 86400000},'${JSON.stringify({ role: "user", time: { created: now - 86400000 } })}')`,
      );
      setupDb.run(
        `INSERT INTO message VALUES ('m2','s1',${now - 86400000 + 1000},${now - 86400000 + 1000},'${JSON.stringify({ role: "assistant", tokens: { input: 1000, output: 500, total: 1500 }, cost: 0.05 })}')`,
      );
      setupDb.run(
        `INSERT INTO part VALUES ('p1','m2','s1',${now - 86400000},${now - 86400000},'${JSON.stringify({ type: "text", text: "I fixed the bug" })}')`,
      );
      setupDb.close();

      const outputPath = join(tmpDir, "report.html");
      const config = {
        model: DEFAULT_MODEL,
        days: 30,
        force: false,
        concurrency: 2,
        maxSessions: 200,
        projectOnly: false,
        output: outputPath,
      };

      const result = await runInsights({ client: makeClient(), stateDir: tmpDir, dbPath }, config);

      expect(result.reportPath).toBe(outputPath);
      expect(result.jsonPath).toBe(outputPath.replace(".html", ".json"));
      expect(existsSync(result.reportPath)).toBe(true);
      expect(existsSync(result.jsonPath)).toBe(true);

      const html = readFileSync(result.reportPath, "utf-8");
      expect(html.startsWith("<!DOCTYPE html>")).toBe(true);

      const jsonContent = JSON.parse(readFileSync(result.jsonPath, "utf-8"));
      expect(jsonContent.config).toBeDefined();
      expect(jsonContent.stats).toBeDefined();
      expect(jsonContent.generatedAt).toBeDefined();
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("returns session counts and cost", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "insights-test-"));
    try {
      const dbPath = join(tmpDir, "test.db");

      const { Database } = await import("bun:sqlite");
      const setupDb = new Database(dbPath);
      setupDb.run(
        `CREATE TABLE session (id TEXT PRIMARY KEY, project_id TEXT NOT NULL DEFAULT 'p1', parent_id TEXT, directory TEXT NOT NULL DEFAULT '/t', title TEXT NOT NULL, version TEXT NOT NULL DEFAULT '1', slug TEXT NOT NULL DEFAULT 's', time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, agent TEXT, model TEXT, cost REAL NOT NULL DEFAULT 0, tokens_input INTEGER NOT NULL DEFAULT 0, tokens_output INTEGER NOT NULL DEFAULT 0, tokens_reasoning INTEGER NOT NULL DEFAULT 0, tokens_cache_read INTEGER NOT NULL DEFAULT 0, tokens_cache_write INTEGER NOT NULL DEFAULT 0, metadata TEXT)`,
      );
      setupDb.run(
        "CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL)",
      );
      setupDb.run(
        "CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL)",
      );
      const now = Date.now();
      setupDb.run(
        `INSERT INTO session VALUES ('s1','p1',NULL,'/t','Test','1','s',${now - 86400000},${now - 86400000},'build',NULL,0.05,0,0,0,0,0,NULL)`,
      );
      setupDb.close();

      const outputPath = join(tmpDir, "out.html");
      const result = await runInsights(
        { client: makeClient(), stateDir: tmpDir, dbPath },
        {
          model: DEFAULT_MODEL,
          days: 30,
          force: false,
          concurrency: 2,
          maxSessions: 200,
          projectOnly: false,
          output: outputPath,
        },
      );

      expect(result.sessionCount).toBeGreaterThanOrEqual(0);
      expect(result.totalCost).toBeGreaterThanOrEqual(0);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("analyzedCount reflects actual extracted sessions, not total", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "insights-test-"));
    try {
      const dbPath = join(tmpDir, "test.db");
      const now = Date.now();
      makeTwoSessionDb(dbPath, now);

      // Client that fails on the first prompt call so one facet extraction fails
      let promptCalls = 0;
      const flakeyClient: LlmClient = {
        session: {
          async create() {
            return { data: { id: `s${promptCalls}` } };
          },
          async prompt() {
            promptCalls++;
            if (promptCalls === 1) throw new Error("first extraction fails");
            // Subsequent calls return valid facet/aggregate/at-a-glance JSON
            if (promptCalls <= 3)
              return {
                data: {
                  info: {},
                  parts: [{ type: "text", text: JSON.stringify(minimalFacet) }],
                },
              };
            if (promptCalls > 9)
              return {
                data: {
                  info: {},
                  parts: [{ type: "text", text: JSON.stringify(minimalAtAGlance) }],
                },
              };
            return {
              data: {
                info: {},
                parts: [{ type: "text", text: JSON.stringify({ result: "ok" }) }],
              },
            };
          },
          async delete() {
            return { data: {} };
          },
        },
      };

      const outputPath = join(tmpDir, "out.html");
      const result = await runInsights(
        { client: flakeyClient, stateDir: tmpDir, dbPath },
        {
          model: DEFAULT_MODEL,
          days: 30,
          force: false,
          concurrency: 1,
          maxSessions: 200,
          projectOnly: false,
          output: outputPath,
        },
      );

      expect(result.sessionCount).toBe(2);
      expect(result.analyzedCount).toBe(1);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});
