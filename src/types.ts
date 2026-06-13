export const GOAL_CATEGORIES = [
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

export const FRICTION_CATEGORIES = [
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

export const SATISFACTION_LEVELS = [
  "happy",
  "satisfied",
  "likely_satisfied",
  "neutral",
  "dissatisfied",
  "frustrated",
] as const;

export type GoalCategory = (typeof GOAL_CATEGORIES)[number];
export type FrictionCategory = (typeof FRICTION_CATEGORIES)[number];
export type SatisfactionLevel = (typeof SATISFACTION_LEVELS)[number];

/**
 * Extracted facets from a single session transcript.
 *
 * Fields typed as `string` are free-text produced by LLM analysis.
 * Fields typed as `Partial<Record<XCategory, number>>` have a fixed vocabulary defined
 * by the corresponding constant arrays (GOAL_CATEGORIES, FRICTION_CATEGORIES, etc.).
 */
export interface SessionFacet {
  sessionId: string;
  underlyingGoal: string;
  goalCategories: Partial<Record<GoalCategory, number>>;
  outcome: string;
  satisfaction: Partial<Record<SatisfactionLevel, number>>;
  frictionCounts: Partial<Record<FrictionCategory, number>>;
  frictionDetail: string;
  primarySuccess: string;
  briefSummary: string;
}

export interface SessionMeta {
  id: string;
  title: string;
  projectDir: string | null;
  parentId: string | null;
  durationMinutes: number;
  userMsgCount: number;
  assistantMsgCount: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  cost: number;
  toolCounts: Record<string, number>;
  agentCounts: Record<string, number>;
  modelCounts: Record<string, number>;
  startTime: number;
  endTime: number;
}

export interface AggregatedStats {
  totalSessions: number;
  analyzedSessions: number;
  dateRange: { from: number; to: number };
  totalMessages: number;
  totalCost: number;
  totalTokens: number;
  topTools: Array<{ tool: string; count: number }>;
  topAgents: Array<{ agent: string; count: number }>;
  topModels: Array<{ model: string; count: number }>;
  byAgentModel: Array<{
    agent: string;
    model: string;
    sessions: number;
    cost: number;
    tokens: number;
  }>;
  toolErrorRates: Array<{
    tool: string;
    totalCalls: number;
    errorCalls: number;
    errorRate: number;
  }>;
  cacheEfficiency: Array<{ model: string; cacheRatio: number }>;
  costPer1k: Array<{ model: string; costPer1kTokens: number }>;
  agentDelegation: Array<{ parentAgent: string; childAgent: string; count: number }>;
}

export interface InsightsModel {
  providerID: string;
  modelID: string;
}

export interface InsightsConfig {
  model: InsightsModel;
  days: number;
  force: boolean;
  concurrency: number;
  maxSessions: number;
  projectOnly: boolean;
  output: string;
}

export const DEFAULT_MODEL: InsightsModel = {
  providerID: "anthropic",
  modelID: "claude-haiku-4-5",
};
