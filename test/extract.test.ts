import { describe, it, expect } from "bun:test"
import { createFixtureDb } from "./fixture.ts"
import { filterSessions, reconstructTranscript, aggregateAll } from "../src/extract.ts"

describe("filterSessions", () => {
  it("returns root sessions within default 30-day window", () => {
    const db = createFixtureDb()
    const ids = filterSessions(db)
    expect(ids).toContain("s1")
    expect(ids).toContain("s2")
    expect(ids).not.toContain("s3") // child session
    expect(ids).not.toContain("s4") // [insights] titled
    expect(ids).not.toContain("s5") // 40 days old
  })

  it("respects since option", () => {
    const db = createFixtureDb()
    // s1 is 5 days old, s2 is 3 days old; cutoff at 4 days ago excludes s1
    const ids = filterSessions(db, { since: Date.now() - 4 * 86400000 })
    expect(ids).not.toContain("s1")
    expect(ids).toContain("s2")
  })

  it("filters by projectDir when provided", () => {
    const db = createFixtureDb()
    const ids = filterSessions(db, { projectDir: "/home/user/proj" })
    expect(ids).toContain("s1")
    expect(ids).toContain("s2")

    const ids2 = filterSessions(db, { projectDir: "/other/project" })
    expect(ids2).toHaveLength(0)
  })
})

describe("reconstructTranscript", () => {
  it("includes user and assistant text parts", () => {
    const db = createFixtureDb()
    const t = reconstructTranscript(db, "s1")
    expect(t).toContain("[user]")
    expect(t).toContain("[assistant]")
  })

  it("includes tool usage lines", () => {
    const db = createFixtureDb()
    const t = reconstructTranscript(db, "s1")
    expect(t).toContain("bash")
    expect(t).toContain("completed")
    expect(t).toContain("error")
  })

  it("skips step-start and other non-content parts", () => {
    const db = createFixtureDb()
    const t = reconstructTranscript(db, "s1")
    expect(t).not.toContain("step-start")
    expect(t).not.toContain("step-finish")
  })

  it("returns empty string for unknown session", () => {
    const db = createFixtureDb()
    const t = reconstructTranscript(db, "nonexistent")
    expect(t).toBe("")
  })

  it("is ordered: user message appears before assistant response", () => {
    const db = createFixtureDb()
    const t = reconstructTranscript(db, "s1")
    const userIdx = t.indexOf("[user]")
    const assistantIdx = t.indexOf("[assistant]")
    expect(userIdx).toBeGreaterThanOrEqual(0)
    expect(assistantIdx).toBeGreaterThanOrEqual(0)
    expect(userIdx).toBeLessThan(assistantIdx)
  })
})

describe("aggregateAll", () => {
  it("returns correct totalSessions", () => {
    const db = createFixtureDb()
    const stats = aggregateAll(db, ["s1", "s2"])
    expect(stats.totalSessions).toBe(2)
  })

  it("includes toolErrorRates data", () => {
    const db = createFixtureDb()
    const stats = aggregateAll(db, ["s1", "s2"])
    expect(stats.toolErrorRates.length).toBeGreaterThan(0)
    const bash = stats.toolErrorRates.find(r => r.tool === "bash")
    expect(bash).toBeDefined()
  })

  it("returns empty stats for empty sessionIds", () => {
    const db = createFixtureDb()
    const stats = aggregateAll(db, [])
    expect(stats.totalSessions).toBe(0)
    expect(stats.totalCost).toBe(0)
    expect(stats.toolErrorRates).toEqual([])
  })

  it("computes dateRange", () => {
    const db = createFixtureDb()
    const stats = aggregateAll(db, ["s1", "s2"])
    expect(stats.dateRange.from).toBeGreaterThan(0)
    expect(stats.dateRange.to).toBeGreaterThanOrEqual(stats.dateRange.from)
  })
})
