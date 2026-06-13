import { FRICTION_CATEGORIES, GOAL_CATEGORIES, SATISFACTION_LEVELS } from "./types.ts";

const JSON_SUFFIX =
  "RESPOND WITH ONLY A VALID JSON OBJECT. No markdown, no explanation, no code fences.";

const TONE = `Use second person ("you"). Constructive coaching tone. Don't be fluffy or overly complimentary. Be honest but constructive.`;

const FRICTION_DEFS: Record<(typeof FRICTION_CATEGORIES)[number], string> = {
  misunderstood_request: "Agent interpreted the user's request incorrectly",
  wrong_approach: "Right goal, but agent chose the wrong solution method",
  buggy_code: "Code produced by the agent didn't work correctly",
  user_rejected_action: "User said no/stop to an agent action or tool call",
  excessive_changes: "Agent over-engineered or changed more than asked",
  agent_got_blocked: "Agent couldn't proceed and stopped or got stuck",
  user_stopped_early: "User ended the session before the task was complete",
  wrong_file_or_location: "Agent edited or looked at the wrong file or directory",
  slow_or_verbose: "Agent was too slow or produced excessive, unhelpful output",
  external_issue: "External tool, API, or environment problem (not agent's fault)",
  user_unclear: "User's request was ambiguous or lacked necessary context",
  other: "Friction not covered by the above categories",
};

export function buildFacetPrompt(transcript: string, metaSummary: string): string {
  const categoriesStr = GOAL_CATEGORIES.join(", ");
  const satisfactionStr = SATISFACTION_LEVELS.join(", ");
  const frictionStr = FRICTION_CATEGORIES.map((c) => `   - ${c}: ${FRICTION_DEFS[c]}`).join("\n");

  return `You are analyzing an OpenCode session transcript. OpenCode is an AI-powered CLI tool where users interact with agents (build, explore, librarian, oracle) that use tools, skills, and project-specific AGENTS.md rules to complete tasks.

Given the transcript and session metadata below, extract structured information about this session.

CRITICAL GUIDELINES:

1. **goal_categories**: Count ONLY what the USER explicitly asked for.
   - DO NOT count the agent's autonomous codebase exploration
   - DO NOT count work the agent decided to do on its own
   - ONLY count when user says "can you...", "please...", "I need...", "let's..."

2. **user_satisfaction_counts**: Base ONLY on explicit user signals.
   - "Yay!", "great!", "perfect!" → happy
   - "thanks", "looks good", "that works" → satisfied
   - "ok, now let's..." (continuing without complaint) → likely_satisfied
   - "that's not right", "try again" → dissatisfied
   - "this is broken", "I give up" → frustrated
   - no clear signals either way → neutral

3. **friction_counts**: Be specific about what went wrong.
${frictionStr}

4. If very short or just warmup, use warmup_minimal for goal_category

## Session Metadata
${metaSummary}

## Session Transcript
${transcript}

Return a JSON object with these fields:
- "session_id": string
- "underlying_goal": string — what the user was trying to accomplish
- "goal_categories": object with keys [${categoriesStr}], each mapped to 0 or 1
- "outcome": one of "fully_achieved", "mostly_achieved", "partially_achieved", "not_achieved", "unclear"
- "satisfaction": object with keys [${satisfactionStr}], each mapped to 0 or 1 (exactly one should be 1)
- "friction_counts": object with keys [${FRICTION_CATEGORIES.join(", ")}], each mapped to a count integer
- "friction_detail": string — brief description of the main friction point if any, else empty string
- "primary_success": string — the main thing that went well, or "none"
- "brief_summary": string — 2-3 sentences max describing what happened

${JSON_SUFFIX}`;
}

export function buildChunkSummaryPrompt(chunk: string): string {
  return `You are summarizing a portion of an OpenCode session transcript.
Preserve: user requests and instructions, outcomes and results, satisfaction/frustration signals, tool failures and errors, key decisions.
Omit: repetitive tool output, file contents, long code blocks.
Return a concise prose summary (max 500 words).

TRANSCRIPT CHUNK:
${chunk}`;
}

export function buildProjectAreasPrompt(data: unknown): string {
  const dataStr = JSON.stringify(data, null, 2);
  return `You are analyzing OpenCode session data to identify the main areas of a project that the user works on. Sessions involve interactions with agents (build, explore, librarian, oracle) using tools, skills, and AGENTS.md project rules.

${TONE}

Identify 4-5 distinct project areas. For each, provide a name, description, approximate session count, and 2-3 example goals from the sessions.

SESSION DATA:
${dataStr}

Return a JSON object:
{
  "areas": [
    {"name": "string", "description": "string", "session_count": N, "example_goals": ["string"]}
  ]
}

${JSON_SUFFIX}`;
}

export function buildInteractionStylePrompt(data: unknown): string {
  const dataStr = JSON.stringify(data, null, 2);
  return `You are analyzing how a developer interacts with the OpenCode agent. Look at their patterns: how they phrase requests, how much context they provide, how they respond to agent actions, and how sessions typically unfold.

${TONE}

SESSION DATA:
${dataStr}

Return a JSON object:
{
  "narrative": "string — 2-3 sentences describing their overall interaction style",
  "key_patterns": ["string — specific observable pattern"],
  "strengths": ["string — what they do well in their interactions"],
  "growth_areas": ["string — where their interaction style could improve"]
}

${JSON_SUFFIX}`;
}

export function buildAgentPerformancePrompt(data: unknown): string {
  const dataStr = JSON.stringify(data, null, 2);
  return `You are analyzing agent performance across OpenCode sessions. OpenCode uses multiple agents (build, explore, librarian, oracle) and multiple models. Identify which agents perform best for which tasks, and surface cost and efficiency insights.

${TONE}

AGENT PERFORMANCE DATA:
${dataStr}

Return a JSON object:
{
  "top_performers": [
    {"agent": "string — agent name", "strength": "string — what this agent does best", "usage_pattern": "string — when the user tends to use it"}
  ],
  "cost_insights": ["string — observation about model/token costs"],
  "model_pairing_tips": ["string — tip for matching models to task types"],
  "efficiency_opportunities": ["string — specific way to reduce cost or time"]
}

${JSON_SUFFIX}`;
}

export function buildFrictionPrompt(data: unknown): string {
  const dataStr = JSON.stringify(data, null, 2);
  return `Analyze this OpenCode usage data and identify friction points for this user. Use second person ("you").

${TONE}

FRICTION DATA:
${dataStr}

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "intro": "1 sentence summarizing friction patterns",
  "categories": [
    {"category": "Concrete category name", "description": "1-2 sentences explaining this category and what could be done differently. Use 'you' not 'the user'.", "examples": ["Specific example with consequence", "Another example"]}
  ]
}

  Include 3 friction categories with 2 examples each.

${JSON_SUFFIX}`;
}

export function buildSuggestionsPrompt(data: unknown): string {
  const dataStr = JSON.stringify(data, null, 2);
  return `Analyze this OpenCode usage data and suggest improvements.

${TONE}

## OPENCODE FEATURES REFERENCE (pick from these for features_to_try):

1. **Skills**: Reusable prompt templates run with a /command.
   - How to use: Create \`.opencode/skills/<name>/SKILL.md\` with instructions. Type \`/<name>\` to run it.
   - Good for: repetitive workflows — /commit, /review, /pr, /deploy, /test

2. **AGENTS.md Rules**: Project-wide instructions the agent always follows.
   - How to use: Edit \`.opencode/AGENTS.md\` (or \`AGENTS.md\` in repo root).
   - Good for: coding standards, test requirements, preferred patterns

3. **Custom Commands**: Markdown files that become slash commands with shell injection.
   - How to use: Create \`.opencode/commands/<name>.md\` with frontmatter + template.
   - Good for: consistent workflows, running tests, reviewing changes

4. **Plugins**: Extend opencode with custom tools and hooks.
   - How to use: Add to \`opencode.json\` under the \`"plugin"\` array.
   - Good for: custom integrations, auto-formatting, external API access

5. **Headless Mode**: Run opencode non-interactively from scripts.
   - How to use: \`opencode run "fix lint errors"\`
   - Good for: CI/CD integration, batch code fixes, automated workflows

USER DATA:
${dataStr}

IMPORTANT for agents_md_additions: PRIORITIZE instructions that appear MULTIPLE TIMES in the user data. If the user told the agent the same thing in 2+ sessions, that's a PRIME candidate for AGENTS.md — they shouldn't have to repeat themselves.

IMPORTANT for features_to_try: Pick 2-3 from the OPENCODE FEATURES REFERENCE above. Include 2-3 items for each category.

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "agents_md_additions": [
    {"rule": "string — specific rule to add to AGENTS.md", "rationale": "string", "why_now": "string — why this is relevant based on their sessions"}
  ],
  "features_to_try": [
    {"feature": "Feature name from OPENCODE FEATURES REFERENCE", "one_liner": "string", "why_for_you": "string — why this applies to their sessions", "example": "string — copyable command or config snippet"}
  ],
  "workflow_patterns": [
    {"pattern": "string", "benefit": "string", "how_to": "string", "copyable_prompt": "string"}
  ]
}

${JSON_SUFFIX}`;
}

export function buildToolHealthPrompt(data: unknown): string {
  const dataStr = JSON.stringify(data, null, 2);
  return `You are analyzing tool usage health across OpenCode sessions. Tools include file operations (read, write, edit, glob, grep), shell commands (bash), LSP operations (diagnostics, definitions, references), and specialized tools (ast_grep, web fetch).

${TONE}

TOOL USAGE DATA:
${dataStr}

Return a JSON object:
{
  "problematic_tools": [
    {"tool": "string — tool name", "error_rate": "string — e.g. '23%'", "likely_cause": "string — why it fails"}
  ],
  "efficiency_tips": ["string — how to use tools more effectively"],
  "recovery_patterns": ["string — what to do when tools fail"]
}

${JSON_SUFFIX}`;
}

export function buildHorizonPrompt(data: unknown): string {
  const dataStr = JSON.stringify(data, null, 2);
  return `You are identifying future opportunities for an OpenCode user's workflow. Consider automation via hooks and headless mode (\`opencode run\`), skill gaps that could be filled with custom skills, and how their workflow could evolve as they adopt more OpenCode features like AGENTS.md rules and session management.

${TONE}

CURRENT WORKFLOW DATA:
${dataStr}

Return a JSON object:
{
  "automation_opportunities": [
    {"opportunity": "string — what to automate", "how": "string — specific opencode feature or approach", "effort": "low|medium|high"}
  ],
  "skill_gaps": ["string — capability gap that a custom skill could fill"],
  "workflow_evolutions": ["string — how their workflow could improve with better tooling or habits"]
}

${JSON_SUFFIX}`;
}

export function buildAtAGlancePrompt(allInsights: unknown, statsSummary: unknown): string {
  const insightsStr = JSON.stringify(allInsights, null, 2);
  const statsStr = JSON.stringify(statsSummary, null, 2);
  return `You're writing an "At a Glance" summary for an OpenCode usage insights report. The goal is to help users understand their usage and improve how they use OpenCode, especially as models improve.

${TONE}

Use this 4-part structure:

1. **whats_working** — What is the user's unique style of interacting with the agent and what are some impactful things they've done? Don't be fluffy or overly complimentary. Don't focus on tool calls.

2. **whats_hindering** — Split into (a) the agent's fault (misunderstandings, wrong approaches, bugs) and (b) user-side friction (not providing enough context, environment issues). Be honest but constructive.

3. **quick_wins** — Specific opencode features they could try, or a compelling workflow technique.

4. **ambitious_workflows** — As models improve over the next 3-6 months, what should they prepare for? What workflows that seem impossible now will become possible?

Keep each section to 2-3 not-too-long sentences. Don't overwhelm the user. Don't mention specific numerical stats. Use a coaching tone.

ALL INSIGHTS:
${insightsStr}

USAGE STATISTICS:
${statsStr}

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "whats_working": "string",
  "whats_hindering": "string (split: (a) agent's fault ... (b) user-side ...)",
  "quick_wins": "string",
  "ambitious_workflows": "string"
}

${JSON_SUFFIX}`;
}
