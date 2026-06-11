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

Set `OPENCODE_INSIGHTS_MODEL=provider/model` environment variable to override the default analysis model (`anthropic/claude-haiku-4-5`).

Or pass `--model provider/model` as an argument to `/insights`.

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
