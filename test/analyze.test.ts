import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extractFacets,
  generateAtAGlance,
  prepareTranscript,
  runAggregateAnalysis,
} from "../src/analyze.ts";
import { FacetCache } from "../src/cache.ts";
import type { LlmClient } from "../src/llm.ts";
import { DEFAULT_MODEL } from "../src/types.ts";
import { createFixtureDb } from "./fixture.ts";

const defaultConfig = {
  model: DEFAULT_MODEL,
  days: 30,
  force: false,
  concurrency: 2,
  maxSessions: 2,
  projectOnly: false,
  output: "/tmp/out.html",
};

function makeJsonClient(responseObj: object): LlmClient {
  return {
    session: {
      async create() {
        return { data: { id: "mock-session" } };
      },
      async prompt() {
        return {
          data: {
            info: {},
            parts: [{ type: "text", text: JSON.stringify(responseObj) }],
          },
        };
      },
      async delete() {
        return { data: {} };
      },
    },
  };
}

const minimalFacet = {
  underlying_goal: "Test goal",
  goal_categories: { fix_bug: 1 },
  outcome: "achieved",
  satisfaction: { satisfied: 1 },
  friction_counts: {},
  friction_detail: "",
  primary_success: "done",
  brief_summary: "Fixed a bug",
};

describe("prepareTranscript", () => {
  it("returns transcript as-is when under 30k chars", async () => {
    const client = makeJsonClient({});
    const t = await prepareTranscript(client, "short text", DEFAULT_MODEL);
    expect(t).toBe("short text");
  });

  it("falls back to truncation if LLM fails on long transcript", async () => {
    const failClient: LlmClient = {
      session: {
        async create() {
          return { data: { id: "s" } };
        },
        async prompt() {
          throw new Error("fail");
        },
        async delete() {
          return { data: {} };
        },
      },
    };
    const longText = "x".repeat(35000);
    const result = await prepareTranscript(failClient, longText, DEFAULT_MODEL);
    expect(result).toContain("truncated");
    expect(result.length).toBeLessThan(longText.length);
  });
});

describe("extractFacets", () => {
  it("uses cache for already-cached sessions", async () => {
    const db = createFixtureDb();
    const cacheDir = mkdtempSync(join(tmpdir(), "facet-cache-"));
    const cache = new FacetCache(cacheDir);

    const cachedFacet = {
      sessionId: "s1",
      underlyingGoal: "cached",
      goalCategories: {},
      outcome: "",
      satisfaction: {},
      frictionCounts: {},
      frictionDetail: "",
      primarySuccess: "",
      briefSummary: "",
    };
    cache.put("s1", cachedFacet);

    let llmCallCount = 0;
    const countingClient: LlmClient = {
      session: {
        async create() {
          llmCallCount++;
          return { data: { id: "s" } };
        },
        async prompt() {
          return {
            data: {
              info: {},
              parts: [{ type: "text", text: JSON.stringify(minimalFacet) }],
            },
          };
        },
        async delete() {
          return { data: {} };
        },
      },
    };

    const results = await extractFacets(db, countingClient, ["s1", "s2"], defaultConfig, cache);

    expect(results.get("s1")?.underlyingGoal).toBe("cached");
    expect(llmCallCount).toBe(1);

    rmSync(cacheDir, { recursive: true });
  });

  it("force bypasses cache", async () => {
    const db = createFixtureDb();
    const cacheDir = mkdtempSync(join(tmpdir(), "facet-cache-"));
    const cache = new FacetCache(cacheDir);

    const cachedFacet = {
      sessionId: "s1",
      underlyingGoal: "old cached",
      goalCategories: {},
      outcome: "",
      satisfaction: {},
      frictionCounts: {},
      frictionDetail: "",
      primarySuccess: "",
      briefSummary: "",
    };
    cache.put("s1", cachedFacet);

    const freshFacet = { ...minimalFacet, underlying_goal: "fresh from LLM" };
    const client = makeJsonClient(freshFacet);

    const forcedConfig = { ...defaultConfig, force: true };
    const results = await extractFacets(db, client, ["s1"], forcedConfig, cache);

    expect(results.get("s1")?.underlyingGoal).toBe("fresh from LLM");
    rmSync(cacheDir, { recursive: true });
  });

  it("skips failed sessions without aborting", async () => {
    const db = createFixtureDb();
    const cacheDir = mkdtempSync(join(tmpdir(), "facet-cache-"));
    const cache = new FacetCache(cacheDir);

    let calls = 0;
    const flakeyClient: LlmClient = {
      session: {
        async create() {
          return { data: { id: `s${calls}` } };
        },
        async prompt() {
          calls++;
          if (calls === 1) throw new Error("first call fails");
          return {
            data: {
              info: {},
              parts: [{ type: "text", text: JSON.stringify(minimalFacet) }],
            },
          };
        },
        async delete() {
          return { data: {} };
        },
      },
    };

    const results = await extractFacets(db, flakeyClient, ["s1", "s2"], defaultConfig, cache);

    expect(results.size).toBe(1);
    rmSync(cacheDir, { recursive: true });
  });

  it("applies maxSessions cap even when force=true", async () => {
    const db = createFixtureDb();
    const cacheDir = mkdtempSync(join(tmpdir(), "facet-cache-"));
    const cache = new FacetCache(cacheDir);
    const client = makeJsonClient(minimalFacet);

    // force=true, maxSessions=1 → only 1 session processed despite 2 available
    const results = await extractFacets(
      db,
      client,
      ["s1", "s2"],
      {
        ...defaultConfig,
        force: true,
        maxSessions: 1,
      },
      cache,
    );

    expect(results.size).toBe(1);
    rmSync(cacheDir, { recursive: true });
  });

  it("calls onProgress callback", async () => {
    const db = createFixtureDb();
    const cacheDir = mkdtempSync(join(tmpdir(), "facet-cache-"));
    const cache = new FacetCache(cacheDir);
    const client = makeJsonClient(minimalFacet);

    const progressCalls: Array<[number, number]> = [];
    await extractFacets(db, client, ["s1"], defaultConfig, cache, (done, total) => {
      progressCalls.push([done, total]);
    });

    expect(progressCalls).toEqual([[1, 1]]);
    rmSync(cacheDir, { recursive: true });
  });
});

describe("runAggregateAnalysis", () => {
  it("returns an object with all 7 analysis keys", async () => {
    const client = makeJsonClient({ result: "ok" });
    const facets = new Map();
    const stats = {
      totalSessions: 0,
      analyzedSessions: 0,
      dateRange: { from: 0, to: 0 },
      totalMessages: 0,
      totalCost: 0,
      totalTokens: 0,
      topTools: [],
      topAgents: [],
      topModels: [],
      byAgentModel: [],
      toolErrorRates: [],
      cacheEfficiency: [],
      costPer1k: [],
      agentDelegation: [],
    };

    const results = await runAggregateAnalysis(facets, stats, defaultConfig, client);

    const expectedKeys = [
      "project_areas",
      "interaction_style",
      "agent_performance",
      "friction",
      "suggestions",
      "tool_health",
      "horizon",
    ];
    for (const key of expectedKeys) {
      expect(results).toHaveProperty(key);
    }
  });

  it("returns empty object for failed aggregate (doesn't abort)", async () => {
    const failClient: LlmClient = {
      session: {
        async create() {
          return { data: { id: "s" } };
        },
        async prompt() {
          throw new Error("fail");
        },
        async delete() {
          return { data: {} };
        },
      },
    };
    const facets = new Map();
    const stats = {
      totalSessions: 0,
      analyzedSessions: 0,
      dateRange: { from: 0, to: 0 },
      totalMessages: 0,
      totalCost: 0,
      totalTokens: 0,
      topTools: [],
      topAgents: [],
      topModels: [],
      byAgentModel: [],
      toolErrorRates: [],
      cacheEfficiency: [],
      costPer1k: [],
      agentDelegation: [],
    };

    const results = await runAggregateAnalysis(facets, stats, defaultConfig, failClient);

    expect(results.project_areas).toEqual({});
  });

  it("reports progress once per aggregate (7 total)", async () => {
    const client = makeJsonClient({ result: "ok" });
    const facets = new Map();
    const stats = {
      totalSessions: 0,
      analyzedSessions: 0,
      dateRange: { from: 0, to: 0 },
      totalMessages: 0,
      totalCost: 0,
      totalTokens: 0,
      topTools: [],
      topAgents: [],
      topModels: [],
      byAgentModel: [],
      toolErrorRates: [],
      cacheEfficiency: [],
      costPer1k: [],
      agentDelegation: [],
    };

    const calls: Array<[number, number]> = [];
    await runAggregateAnalysis(facets, stats, defaultConfig, client, (done, total) =>
      calls.push([done, total]),
    );

    expect(calls.length).toBe(7);
    // total is always 7; done increments to 7
    expect(calls.every(([, total]) => total === 7)).toBe(true);
    expect(Math.max(...calls.map(([done]) => done))).toBe(7);
  });
});
