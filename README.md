# opencode-insights

A native opencode plugin that generates usage insights reports from your session history.

Registers a `/insights` slash command that:

- Reads sessions from opencode's SQLite database
- Extracts per-session facets via LLM (with caching)
- Runs 8 aggregate analysis prompts
- Generates a self-contained HTML report + diffable `insights.json`

## Installation

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["file:/path/to/opencode-insights/src/index.ts"]
}
```

Or, for development, create `~/.config/opencode/plugins/insights.ts`:

```typescript
export { InsightsPlugin as default } from "/path/to/opencode-insights/src/index.ts"
```

## Usage

In the opencode TUI:

```
/insights
/insights --days 7
/insights --force
/insights --model anthropic/claude-haiku-4-5
/insights --output ~/Desktop/my-insights.html
/insights --project
```

## Configuration

On the first run, the plugin creates `~/.config/opencode/insights.json` with defaults:

```json
{
  "model": "anthropic/claude-haiku-4-5",
  "days": 30,
  "concurrency": 4
}
```

Edit this file to change the defaults for every `/insights` run.

| Field | Default | What it does |
|---|---|---|
| `model` | `anthropic/claude-haiku-4-5` | LLM used for all analysis calls. Format: `providerID/modelID`. Haiku-class models are recommended — they're fast, cheap, and sufficient for JSON extraction. Use a smarter model if you want richer analysis at higher cost. |
| `days` | `30` | How many days of session history to include. |
| `concurrency` | `4` | Max parallel LLM calls during per-session facet extraction. Increase to speed up the first run, decrease if you're hitting rate limits. |

Argument flags override config file values for a single run:

```
/insights --days 7              # override days
/insights --model anthropic/claude-sonnet-4-5  # use a smarter model this run
/insights --force               # re-analyze all sessions, ignoring cache
```

## How it works

1. **Extract** — reads sessions from `opencode.db` (last 30 days by default), filters out sub-agent sessions and `[insights]` sessions
2. **Facet extraction** — per-session LLM call extracting: goal, outcome, satisfaction, friction (cached to `~/.local/share/opencode/insights/facets/`)
3. **Aggregate analysis** — 8 prompts: project areas, interaction style, agent performance, friction, suggestions, tool health, horizon
4. **At-a-Glance synthesis** — final summary with split fault attribution (agent vs user-side)
5. **Report generation** — self-contained HTML + `insights.json` (diffable across runs)

## Development

```bash
bun install
bun test
bun run scripts/smoke-db.ts  # LLM-free validation against real DB
```

## Attribution

This plugin ports and extends [opencode-usage](https://github.com/rchardx/opencode-usage) by rchardx (MIT License).

Prompt improvements are based on Claude Code's `/insights` system prompts as documented by [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts).
