import { describe, expect, it } from "bun:test"
import { FRICTION_CATEGORIES } from "../src/types.ts"
import {
  buildAgentPerformancePrompt,
  buildAtAGlancePrompt,
  buildChunkSummaryPrompt,
  buildFacetPrompt,
  buildFrictionPrompt,
  buildHorizonPrompt,
  buildInteractionStylePrompt,
  buildProjectAreasPrompt,
  buildSuggestionsPrompt,
  buildToolHealthPrompt,
} from "../src/prompts.ts"

describe("buildFacetPrompt", () => {
  it("contains CRITICAL GUIDELINES section", () => {
    const p = buildFacetPrompt("transcript text", "meta summary")
    expect(p).toContain("CRITICAL GUIDELINES")
  })
  it("contains user-explicit intent guideline", () => {
    const p = buildFacetPrompt("transcript", "meta")
    expect(p).toContain("ONLY count when")
  })
  it("contains all 12 friction categories", () => {
    const p = buildFacetPrompt("transcript", "meta")
    for (const cat of FRICTION_CATEGORIES) {
      expect(p).toContain(cat)
    }
  })
  it("contains satisfaction signals", () => {
    const p = buildFacetPrompt("transcript", "meta")
    expect(p).toContain("happy")
    expect(p).toContain("frustrated")
  })
  it("ends with JSON_SUFFIX", () => {
    const p = buildFacetPrompt("transcript", "meta")
    expect(p).toContain("RESPOND WITH ONLY A VALID JSON OBJECT")
  })
  it("includes the transcript", () => {
    const p = buildFacetPrompt("MY UNIQUE TRANSCRIPT TEXT", "meta")
    expect(p).toContain("MY UNIQUE TRANSCRIPT TEXT")
  })
})

describe("buildChunkSummaryPrompt", () => {
  it("asks to preserve user requests and satisfaction signals", () => {
    const p = buildChunkSummaryPrompt("chunk text")
    expect(p).toContain("user requests")
    expect(p).toContain("chunk text")
  })
  it("does NOT have JSON_SUFFIX (returns prose)", () => {
    const p = buildChunkSummaryPrompt("chunk")
    expect(p).not.toContain("RESPOND WITH ONLY A VALID JSON OBJECT")
  })
})

describe("aggregate prompt builders", () => {
  const sampleData = { sessions: 5, facets: [], stats: {} }

  it("buildProjectAreasPrompt returns string with JSON_SUFFIX and TONE", () => {
    const p = buildProjectAreasPrompt(sampleData)
    expect(p).toContain("RESPOND WITH ONLY A VALID JSON OBJECT")
    expect(p).toContain("second person")
  })

  it("buildInteractionStylePrompt returns string with TONE", () => {
    const p = buildInteractionStylePrompt(sampleData)
    expect(p).toContain("second person")
  })

  it("buildFrictionPrompt uses second person (you)", () => {
    const p = buildFrictionPrompt(sampleData)
    expect(p).toContain("you")
    expect(p).toContain("categories")
  })

  it("buildSuggestionsPrompt contains AGENTS.md reference and CC IMPORTANT note", () => {
    const p = buildSuggestionsPrompt(sampleData)
    expect(p).toContain("AGENTS.md")
    expect(p).toContain("MULTIPLE TIMES")
  })

  it("buildSuggestionsPrompt contains opencode features", () => {
    const p = buildSuggestionsPrompt(sampleData)
    expect(p).toContain("Skills")
    expect(p).toContain("opencode run")
  })

  it("buildAtAGlancePrompt has 4-part structure with split fault", () => {
    const p = buildAtAGlancePrompt({}, {})
    expect(p).toContain("whats_working")
    expect(p).toContain("whats_hindering")
    expect(p).toContain("agent's fault")
    expect(p).toContain("user-side")
    expect(p).toContain("quick_wins")
    expect(p).toContain("ambitious_workflows")
  })

  it("buildHorizonPrompt returns string with JSON_SUFFIX", () => {
    const p = buildHorizonPrompt(sampleData)
    expect(p).toContain("RESPOND WITH ONLY A VALID JSON OBJECT")
    expect(p).toContain("automation_opportunities")
  })
})
