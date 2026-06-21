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
      whats_working: {
        your_direction: "You delegate methodically and verify outcomes.",
        agent_execution: "Your agent debugs precisely with a low tool error rate.",
      },
      whats_hindering: {
        agent: "The agent sometimes picks the wrong approach.",
        user_side: "You rarely provide file context up front.",
        tooling: "The insights tool times out on large date ranges.",
      },
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

  it("renders actor-split sub-labels for working (2) and hindering (3)", () => {
    const html = generateReport(makeReportData(), "{}");
    expect(html).toContain("Your Direction");
    expect(html).toContain("Your Agent's Execution");
    expect(html).toContain("Agent:");
    expect(html).toContain("User-side:");
    expect(html).toContain("Tooling");
    // content from the sub-parts is present
    expect(html).toContain("delegate methodically");
    expect(html).toContain("debugs precisely");
  });

  it("skips empty tooling sub-part in hindering", () => {
    const data = makeReportData();
    (data.atAGlance.whats_hindering as Record<string, string>).tooling = "";
    const html = generateReport(data, "{}");
    expect(html).not.toContain("Tooling &amp; Environment:");
    // other sub-parts still render
    expect(html).toContain("User-side:");
  });

  it("backward-compat: renders legacy string-shaped at-a-glance", () => {
    const data = makeReportData();
    data.atAGlance = {
      whats_working: "Legacy working string.",
      whats_hindering: "Legacy hindering string.",
      quick_wins: "Legacy wins.",
      ambitious_workflows: "Legacy ambitious.",
    };
    const html = generateReport(data, "{}");
    expect(html).toContain("Legacy working string.");
    expect(html).toContain("Legacy hindering string.");
    // no sub-labels for string shape
    expect(html).not.toContain("Your Direction");
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

  it("marks bar charts as role=img and drops zero-value rows", () => {
    const data = makeReportData();
    data.stats.topAgents = [
      { agent: "build", count: 3 },
      { agent: "ghostagent", count: 0 },
    ];
    const html = generateReport(data, "{}");
    expect(html).toContain('role="img"');
    expect(html).toContain("build");
    // zero-value row is omitted entirely (label never appears)
    expect(html).not.toContain("ghostagent");
  });

  it("includes accessibility landmarks (skip link, nav label, main)", () => {
    const html = generateReport(makeReportData(), "{}");
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('aria-label="Report sections"');
    expect(html).toContain('<main class="wrap" id="main-content">');
  });

  it("renders Room to Learn cards with a start-here step", () => {
    const data = makeReportData();
    data.aggregates.room_to_learn = {
      intro: "Topics drawn from your work.",
      areas: [
        {
          topic: "Caching strategies",
          type: "concept",
          rationale: "You lean on cache hit ratios across sessions.",
          first_step: "Read about cache invalidation trade-offs.",
        },
      ],
    };
    const html = generateReport(data, "{}");
    expect(html).toContain("Room to Learn");
    expect(html).toContain("Caching strategies");
    expect(html).toContain("Start here:");
  });

  it("interaction section omits prose narrative and strengths", () => {
    const data = makeReportData();
    data.aggregates.interaction_style = {
      narrative: "You are a decisive person.",
      key_patterns: ["You batch related requests together."],
      strengths: ["You delegate cleanly to subagents."],
      growth_areas: ["Provide file context up front."],
    };
    const html = generateReport(data, "{}");
    expect(html).not.toContain("You are a decisive person.");
    expect(html).not.toContain("You delegate cleanly to subagents.");
    expect(html).toContain("You batch related requests together.");
    expect(html).toContain("Provide file context up front.");
  });

  it("JSON island has no raw < character (prevents </script breakout)", () => {
    const html = generateReport(makeReportData(), '{"x":"</script>"}');
    // Extract just the JSON content between the opening tag's > and the closing </script>
    const match = html.match(
      /<script type="application\/json" id="insights-data">([\s\S]*?)<\/script>/,
    );
    expect(match).not.toBeNull();
    if (!match) return;
    const jsonContent = match[1];
    // The JSON content must not contain a literal < (only \u003c)
    expect(jsonContent).not.toContain("<");
    // Verify the JSON still parses correctly
    const parsed = JSON.parse(jsonContent);
    expect(parsed.x).toBe("</script>");
  });
});
