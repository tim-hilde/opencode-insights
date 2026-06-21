## [1.3.1](https://github.com/tim-hilde/opencode-insights/compare/v1.3.0...v1.3.1) (2026-06-21)


### Bug Fixes

* use correct link ([6c0017e](https://github.com/tim-hilde/opencode-insights/commit/6c0017e40fa3914927991954c0d1028e29ca3484))

# [1.3.0](https://github.com/tim-hilde/opencode-insights/compare/v1.2.0...v1.3.0) (2026-06-21)


### Features

* collapsible report sections and opt-in dark mode ([cb568f8](https://github.com/tim-hilde/opencode-insights/commit/cb568f860dbf609a1fe83e1be7968c112a955a74))

# [1.2.0](https://github.com/tim-hilde/opencode-insights/compare/v1.1.3...v1.2.0) (2026-06-21)


### Features

* add Room to Learn section and improve report accessibility ([1ead6a0](https://github.com/tim-hilde/opencode-insights/commit/1ead6a06b6dec19fdd386e9cc2d2d6772cb96936))

## [1.1.3](https://github.com/tim-hilde/opencode-insights/compare/v1.1.2...v1.1.3) (2026-06-18)


### Bug Fixes

* extractJson truncated JSON when string values contained code fences ([afd7a5d](https://github.com/tim-hilde/opencode-insights/commit/afd7a5d5d49f56c25221dce6df4e6db2282ba41b))

## [1.1.2](https://github.com/tim-hilde/opencode-insights/compare/v1.1.1...v1.1.2) (2026-06-18)


### Bug Fixes

* attribute report actions to agent vs user vs tooling (split at-a-glance, facet-level attribution, v2 cache) ([783daec](https://github.com/tim-hilde/opencode-insights/commit/783daec8606b6c20d2c6b91a7a3dfcbd4b570f8e))

## [1.1.1](https://github.com/tim-hilde/opencode-insights/compare/v1.1.0...v1.1.1) (2026-06-15)


### Bug Fixes

* harden prompts against injection (nonce delimiters + guard), default to current project (--all for global) ([394960b](https://github.com/tim-hilde/opencode-insights/commit/394960bf71295a26a2140fa2c7a72bd984bc62c1))

# [1.1.0](https://github.com/tim-hilde/opencode-insights/compare/v1.0.4...v1.1.0) (2026-06-15)


### Features

* live progress toasts (start + facet milestones + per-aggregate + summary) ([ff136a7](https://github.com/tim-hilde/opencode-insights/commit/ff136a701ac8507b1cc4e8042172b98fffcc17a8))

## [1.0.4](https://github.com/tim-hilde/opencode-insights/compare/v1.0.3...v1.0.4) (2026-06-15)


### Bug Fixes

* remove insights-analyzer agent registration; run analysis via default agent ([fe70c53](https://github.com/tim-hilde/opencode-insights/commit/fe70c530d2feccd5d242fcf9cfbd4c3a699fe70f))

## [1.0.3](https://github.com/tim-hilde/opencode-insights/compare/v1.0.2...v1.0.3) (2026-06-15)


### Bug Fixes

* extract clean model name + variant from JSON model column in cost queries ([57534f4](https://github.com/tim-hilde/opencode-insights/commit/57534f4fbce70600cad44aff0e461f7b36ba1ff6))

## [1.0.2](https://github.com/tim-hilde/opencode-insights/compare/v1.0.1...v1.0.2) (2026-06-14)


### Bug Fixes

* resolve opencode.db from XDG data dir, not state dir ([d9e2157](https://github.com/tim-hilde/opencode-insights/commit/d9e2157b2dccca00602a68e71b33158e7242ec98))

## [1.0.1](https://github.com/tim-hilde/opencode-insights/compare/v1.0.0...v1.0.1) (2026-06-14)


### Bug Fixes

* lazy-resolve client paths to avoid plugin-init deadlock ([8401976](https://github.com/tim-hilde/opencode-insights/commit/8401976c1f9fe2e3256c808443aa8bf728d7a8f8))

# 1.0.0 (2026-06-14)


### Bug Fixes

* \u003c-escape JSON island, cache versioning, $.tool scalar, IN-list chunking ([aca4d68](https://github.com/tim-hilde/opencode-insights/commit/aca4d68c3ee78f5a06a4da89a393cf5c5559edbc))
* analyze.ts — single cache.get lookup, use config.concurrency for aggregates ([2efa635](https://github.com/tim-hilde/opencode-insights/commit/2efa6350305a78fd4ab38ed3ad075b1a5b6d3a63))
* analyzedSessions reflects facets.size, force always respects cap, mapLimit clamp ([150f40c](https://github.com/tim-hilde/opencode-insights/commit/150f40cd256e752df6a9771839e8eac3c3f7ec1c))
* Biome compliance — node: imports, noNonNullAssertion, noExplicitAny, noForEach ([516c64d](https://github.com/tim-hilde/opencode-insights/commit/516c64d77263fa6391c6ac1dd1d8c74219389f4e))
* db.ts — add getSessionMeta tests, openDb test, empty-array coverage, precise assertions ([8615334](https://github.com/tim-hilde/opencode-insights/commit/8615334d91daeabcaa2d16315223d2ce989cbf4b))
* getAgentDelegation parent.id-only predicate prevents double-count across chunks, pin FACET_CACHE_VERSION in test ([82bc619](https://github.com/tim-hilde/opencode-insights/commit/82bc619e7862cf72f269a5d1f5b7f17ea7fc1e92))
* harden JSON.parse type guard in loadPluginConfig, clean up config tests ([19354ca](https://github.com/tim-hilde/opencode-insights/commit/19354cacbe8c5b8c262757efe6efa2d11cc5b193))
* move SQL queries to db.ts, document N+1 in filterSessions ([57fcb48](https://github.com/tim-hilde/opencode-insights/commit/57fcb48764e419e077c98bdc1392f3a0f36cce41))
* N+1 in filterSessions, remove unused abort from LlmCallOptions ([49b0d8e](https://github.com/tim-hilde/opencode-insights/commit/49b0d8e2c1a2d40982bd08052d3943f6d69bf0c0))
* orchestrator.ts — db.close in finally, remove redundant dateRange ([05ca8d8](https://github.com/tim-hilde/opencode-insights/commit/05ca8d8dd30b117c9e2fbf85282194ed9d645621))
* path-boundary check for --project, jsonPath always distinct from reportPath ([43e1a1b](https://github.com/tim-hilde/opencode-insights/commit/43e1a1b3e50d442e21557ffd34169ae38c9f57c0))
* prompts.ts — JSON_SUFFIX positioning, TONE in at-a-glance, neutral satisfaction signal ([9a8547a](https://github.com/tim-hilde/opencode-insights/commit/9a8547a62777c214edd3387a188ca92c98fe3655))
* regenerate bun.lock without file: path references (CI fix) ([451f28c](https://github.com/tim-hilde/opencode-insights/commit/451f28cccde897d22f8393b82dc73813c20b82bf))
* replace explicit any with unknown for Biome compliance ([6c93423](https://github.com/tim-hilde/opencode-insights/commit/6c93423d025c5d7b93a1e934d8f5ce686b533ece))
* types.ts — clarify free-text fields, fix compile-guard tests, add GOAL_CATEGORIES membership check ([350b8b6](https://github.com/tim-hilde/opencode-insights/commit/350b8b6f5f0fd1567d324b6fd4ad4a6fce03374e))
* use $.tool (flat string) for tool name per production schema ([b272d86](https://github.com/tim-hilde/opencode-insights/commit/b272d86e442a5cb4447c38d2def09cf195d68ffe))


### Features

* analyze.ts — extractFacets, runAggregateAnalysis, generateAtAGlance ([d4905d9](https://github.com/tim-hilde/opencode-insights/commit/d4905d96ecdfa5998ba11234e19186fc6216953a))
* auto-create insights.json with defaults on first run; improve README config docs ([aca3b54](https://github.com/tim-hilde/opencode-insights/commit/aca3b547d33570c1e60544b6253a1a0cb778a53a))
* cache.ts — FacetCache with atomic writes ([2ac789d](https://github.com/tim-hilde/opencode-insights/commit/2ac789d0285261398817d70f66dfb87bf8afdfef))
* db.ts — read-only SQLite queries with fixture tests ([c721a70](https://github.com/tim-hilde/opencode-insights/commit/c721a70a5a88622cbb1a00b8232144b5c555df8d))
* extract.ts — filterSessions, reconstructTranscript, aggregateAll ([aeb7a36](https://github.com/tim-hilde/opencode-insights/commit/aeb7a36c71ae10a53923a308c4109676425a0036))
* index.ts — plugin entry, config hook, insights tool, /insights command ([bc34088](https://github.com/tim-hilde/opencode-insights/commit/bc3408863eb73ba9565b69ee0121b5f90a966fe0))
* llm.ts — runLlm via SDK, extractJson, mapLimit ([38a71df](https://github.com/tim-hilde/opencode-insights/commit/38a71dfbe070e8cc69d6d9c5be230dbc73781ca4))
* open HTML report in default browser after generation ([2ee893d](https://github.com/tim-hilde/opencode-insights/commit/2ee893df2c827012be29507964844c37775fce24))
* orchestrator.ts — pipeline wiring, insights.json export ([b8c7fb0](https://github.com/tim-hilde/opencode-insights/commit/b8c7fb02dbef77e95dc3a3a94bd3d9062e33b5f8))
* prompts.ts — port + §6.1–6.5 CC prompt improvements ([3663759](https://github.com/tim-hilde/opencode-insights/commit/3663759f18e430343edf730f60f694f88acbf1d6))
* report.ts — self-contained HTML with html-artifacts house style ([e4d9ef3](https://github.com/tim-hilde/opencode-insights/commit/e4d9ef3dc1c770e99e894186f1acc6274daa31bb))
* report.ts — sticky nav, 9 sections, bar charts, proper section renderers ([c30f533](https://github.com/tim-hilde/opencode-insights/commit/c30f5336851587e3a4702d4e558342c36444e937))
* smoke-db.ts — LLM-free validation against real DB ([7683a34](https://github.com/tim-hilde/opencode-insights/commit/7683a34e8fa9e57e0b2c9c09f02e9b16343d3b17))
* types.ts — constants and interfaces ([30d8b33](https://github.com/tim-hilde/opencode-insights/commit/30d8b33e00cafd8e17ec432996b906b2a674863f))
