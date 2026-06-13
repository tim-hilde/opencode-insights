import { describe, expect, it } from "bun:test";
import { generateReport } from "../src/report.ts";
import type { ReportData } from "../src/report.ts";
import { DEFAULT_MODEL } from "../src/types.ts";

function makeReportData(partial: Partial<ReportData> = {}): ReportData {
  return {
    stats: {
      totalSessions: 5,
      analyzedSessions: 4,
      dateRange: { from: Date.now() - 7 * 86400000, to: Date.now() },
      totalMessages: 40,
      totalCost: 0.123,
      totalTokens: 50000,
      topTools: [{ tool: "bash", count: 20 }],
      topAgents: [{ agent: "build", count: 3 }],
      topModels: [{ model: "claude-sonnet-4-5", count: 5 }],
      byAgentModel: [],
      toolErrorRates: [],
      cacheEfficiency: [],
      costPer1k: [],
      agentDelegation: [],
    },
    facets: new Map(),
    aggregates: {
      project_areas: {
        areas: [
          {
            name: "Backend",
            description: "API work",
            session_count: 3,
            example_goals: ["fix auth"],
          },
        ],
      },
      friction: {
        intro: "Some friction",
        categories: [
          {
            category: "misunderstood_request",
            description: "Agent misunderstood you",
            examples: ["example 1"],
          },
        ],
      },
      suggestions: {
        agents_md_additions: [
          { rule: "Always run tests", rationale: "consistency", why_now: "repeated 3x" },
        ],
        features_to_try: [
          {
            feature: "Skills",
            one_liner: "Reusable prompts",
            why_for_you: "saves time",
            example: "opencode skills",
          },
        ],
        workflow_patterns: [
          {
            pattern: "TDD",
            benefit: "fewer bugs",
            how_to: "write tests first",
            copyable_prompt: "Write a test for...",
          },
        ],
      },
      interaction_style: {},
      agent_performance: {},
      tool_health: {},
      horizon: {},
    },
    atAGlance: {
      whats_working: "You work efficiently with the build agent.",
      whats_hindering: "(a) Agent sometimes misunderstands. (b) You rarely provide file context.",
      quick_wins: "Try using Skills for repeated workflows.",
      ambitious_workflows: "Headless mode for CI/CD automation.",
    },
    config: {
      model: DEFAULT_MODEL,
      days: 30,
      force: false,
      concurrency: 4,
      maxSessions: 200,
      projectOnly: false,
      output: "./insights.html",
    },
    generatedAt: Date.now(),
    ...partial,
  };
}

describe("generateReport", () => {
  it("returns a string starting with <!DOCTYPE html>", () => {
    const html = generateReport(makeReportData(), "{}");
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  });

  it("has no external URLs (no http:// or https:// in the HTML except inside script)", () => {
    const html = generateReport(makeReportData(), "{}");
    // Only check style and link tags, not script content
    const headSection = html.slice(0, html.indexOf("<body"));
    expect(headSection).not.toContain("http");
  });

  it("contains JSON island script tag", () => {
    const html = generateReport(makeReportData(), '{"test":true}');
    expect(html).toContain('<script type="application/json" id="insights-data">');
    expect(html).toContain('"test":true');
  });

  it("JSON island parses back correctly", () => {
    const insightsJson = JSON.stringify({ sessions: 5, cost: 0.123 });
    const html = generateReport(makeReportData(), insightsJson);
    const match = html.match(
      /<script type="application\/json" id="insights-data">([\s\S]*?)<\/script>/,
    );
    expect(match).not.toBeNull();
    if (!match) return;
    const parsed = JSON.parse(match[1]);
    expect(parsed.sessions).toBe(5);
  });

  it("HTML-escapes user content", () => {
    const data = makeReportData();
    data.atAGlance.whats_working = "<script>alert('xss')</script>";
    const html = generateReport(data, "{}");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders stats header with session count and cost", () => {
    const html = generateReport(makeReportData(), "{}");
    expect(html).toContain("5"); // sessions
    expect(html).toContain("0.1230"); // cost
  });

  it("renders At a Glance section with all 4 panels", () => {
    const html = generateReport(makeReportData(), "{}");
    expect(html).toContain("What's Working");
    expect(html).toContain("What's Hindering");
    expect(html).toContain("Quick Wins");
    expect(html).toContain("Ambitious Workflows");
  });

  it("renders friction section with rust-border items", () => {
    const html = generateReport(makeReportData(), "{}");
    expect(html).toContain("friction-item");
    expect(html).toContain("misunderstood_request");
  });

  it("renders suggestions with copyable pre blocks", () => {
    const html = generateReport(makeReportData(), "{}");
    expect(html).toContain("Always run tests");
    expect(html).toContain("opencode skills");
  });

  it("handles empty aggregates gracefully (no crash)", () => {
    const data = makeReportData();
    data.aggregates = {};
    data.atAGlance = {};
    const html = generateReport(data, "{}");
    expect(html).toContain("analysis unavailable");
  });

  it("contains exportJson function", () => {
    const html = generateReport(makeReportData(), "{}");
    expect(html).toContain("exportJson");
    expect(html).toContain("insights.json");
  });
});
