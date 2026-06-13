# Contributing

Contributions are welcome. Please open an issue before submitting a pull request for non-trivial changes.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (used for running tests, install, and build)
- Node.js ≥ 18 (required by the `engines` field; Bun handles it at runtime)

## Setup

```sh
git clone https://github.com/tim-hilde/opencode-insights
cd opencode-insights
bun install
```

This also installs [lefthook](https://github.com/evilmartians/lefthook) git hooks:

- **pre-commit** — runs Biome format/lint on staged `.ts` files, then typechecks
- **pre-push** — runs the full test suite

## Commands

| Command | Description |
|---|---|
| `bun test` | Run tests |
| `bun run typecheck` | TypeScript type check |
| `bun run lint` | Biome lint check |
| `bun run format` | Biome auto-format |
| `bun run build` | Build to `dist/` via tsup |
| `bun run smoke` | LLM-free validation against real DB |

## Project structure

```
src/
  index.ts        Plugin entry — config hook, /insights command, tool registration
  types.ts        Shared types, constants (GOAL_CATEGORIES, FRICTION_CATEGORIES, …)
  db.ts           Read-only SQLite queries against opencode.db
  extract.ts      filterSessions, reconstructTranscript, aggregateAll
  cache.ts        FacetCache — per-session JSON files with atomic writes
  prompts.ts      All LLM prompt builders (facet extraction + 8 aggregate prompts)
  llm.ts          runLlm via opencode SDK, extractJson, mapLimit
  analyze.ts      extractFacets (cached), runAggregateAnalysis, generateAtAGlance
  report.ts       Self-contained HTML report generator
  orchestrator.ts Pipeline wiring — runs the full insights pipeline end-to-end
scripts/
  smoke-db.ts     LLM-free validation against the real opencode.db
  update-readme-version.js  Called by semantic-release to sync version in README
test/             Unit tests (bun:test)
```

## Testing

```sh
bun test                          # run all tests
bun test test/db.test.ts          # run a single file
```

## Code style

Formatting and linting are enforced by [Biome](https://biomejs.dev). Run `bun run format` to auto-fix, or let the pre-commit hook handle it.

## Releasing

This project uses [semantic-release](https://semantic-release.gitbook.io) with [Conventional Commits](https://www.conventionalcommits.org).

Commit messages drive the version bump automatically on every push to `main`:
- `fix:` → patch (1.0.x)
- `feat:` → minor (1.x.0)
- `feat!:` or `BREAKING CHANGE:` → major (x.0.0)

No manual release step is required. The CI release workflow publishes to npm and creates a GitHub release automatically.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
