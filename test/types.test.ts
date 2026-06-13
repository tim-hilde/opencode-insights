import { describe, expect, test } from "bun:test";
import {
  type AggregatedStats,
  DEFAULT_MODEL,
  FRICTION_CATEGORIES,
  GOAL_CATEGORIES,
  type InsightsConfig,
  SATISFACTION_LEVELS,
  type SessionFacet,
  type SessionMeta,
} from "../src/types.ts";

describe("constants", () => {
  test("GOAL_CATEGORIES has 13 entries", () => {
    expect(GOAL_CATEGORIES.length).toBe(13);
  });

  test("FRICTION_CATEGORIES has 12 entries", () => {
    expect(FRICTION_CATEGORIES.length).toBe(12);
  });

  test("GOAL_CATEGORIES contains all expected values", () => {
    const expected = [
      "debug_investigate",
      "implement_feature",
      "fix_bug",
      "write_script_tool",
      "refactor_code",
      "configure_system",
      "create_pr_commit",
      "analyze_data",
      "understand_codebase",
      "write_tests",
      "write_docs",
      "deploy_infra",
      "warmup_minimal",
    ] as const;
    for (const cat of expected) {
      expect(GOAL_CATEGORIES).toContain(cat);
    }
  });

  test("FRICTION_CATEGORIES includes all required values", () => {
    const required = [
      "misunderstood_request",
      "wrong_approach",
      "buggy_code",
      "user_rejected_action",
      "excessive_changes",
      "agent_got_blocked",
      "user_stopped_early",
      "wrong_file_or_location",
      "slow_or_verbose",
      "external_issue",
      "user_unclear",
      "other",
    ] as const;
    for (const value of required) {
      expect(FRICTION_CATEGORIES).toContain(value);
    }
  });

  test("SATISFACTION_LEVELS has 6 entries", () => {
    expect(SATISFACTION_LEVELS.length).toBe(6);
  });

  test("DEFAULT_MODEL is anthropic/claude-haiku-4-5", () => {
    expect(DEFAULT_MODEL.providerID).toBe("anthropic");
    expect(DEFAULT_MODEL.modelID).toBe("claude-haiku-4-5");
  });
});

describe("type compatibility", () => {
  test("SessionFacet accepts valid literal object", () => {
    const _facet = {
      sessionId: "abc",
      underlyingGoal: "fix a bug",
      goalCategories: { fix_bug: 1, debug_investigate: 0 },
      outcome: "fully_achieved",
      satisfaction: { happy: 1 },
      frictionCounts: { wrong_approach: 2 },
      frictionDetail: "none",
      primarySuccess: "correct_code_edits",
      briefSummary: "Fixed the bug successfully.",
    } satisfies SessionFacet;
  });

  test("SessionMeta accepts valid literal object", () => {
    const _meta = {
      id: "sess-1",
      title: "Test Session",
      projectDir: "/home/user/project",
      parentId: null,
      durationMinutes: 15,
      userMsgCount: 5,
      assistantMsgCount: 5,
      inputTokens: 1000,
      outputTokens: 500,
      reasoningTokens: 0,
      cacheReadTokens: 200,
      cacheWriteTokens: 100,
      totalTokens: 1800,
      cost: 0.002,
      toolCounts: { bash: 3 },
      agentCounts: { build: 1 },
      modelCounts: { "claude-3-5-haiku": 5 },
      startTime: 1700000000000,
      endTime: 1700000900000,
    } satisfies SessionMeta;
  });

  test("AggregatedStats accepts valid literal object", () => {
    const _stats = {
      totalSessions: 10,
      analyzedSessions: 8,
      dateRange: { from: 1700000000000, to: 1700900000000 },
      totalMessages: 100,
      totalCost: 0.5,
      totalTokens: 50000,
      topTools: [{ tool: "bash", count: 30 }],
      topAgents: [{ agent: "build", count: 8 }],
      topModels: [{ model: "claude-3-5-haiku", count: 8 }],
      byAgentModel: [
        { agent: "build", model: "claude-3-5-haiku", sessions: 8, cost: 0.4, tokens: 40000 },
      ],
      toolErrorRates: [{ tool: "bash", totalCalls: 30, errorCalls: 2, errorRate: 0.067 }],
      cacheEfficiency: [{ model: "claude-3-5-haiku", cacheRatio: 0.3 }],
      costPer1k: [{ model: "claude-3-5-haiku", costPer1kTokens: 0.01 }],
      agentDelegation: [{ parentAgent: "build", childAgent: "explore", count: 3 }],
    } satisfies AggregatedStats;
  });

  test("InsightsConfig accepts valid literal object", () => {
    const _config = {
      model: { providerID: "anthropic", modelID: "claude-haiku-4-5" },
      days: 30,
      force: false,
      concurrency: 4,
      projectOnly: false,
      output: "insights.html",
    } satisfies InsightsConfig;
  });
});
