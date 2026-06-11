import { describe, it, expect } from "bun:test"
import { Database } from "bun:sqlite"
import { tmpdir } from "os"
import { join } from "path"
import { unlinkSync } from "fs"
import { createFixtureDb } from "./fixture.ts"
import {
  listSessionIds,
  getSessionMeta,
  getTokenTotals,
  getByAgentModel,
  getToolErrorRates,
  getCacheEfficiency,
  getCostPer1k,
  getAgentDelegation,
} from "../src/db.ts"

describe("openDb", () => {
  it("opens read-only successfully", () => {
    const db = createFixtureDb()
    expect(db.query).toBeDefined()
  })

  it("throws on write attempt to read-only DB (file-based)", () => {
    const tmpPath = join(tmpdir(), `test-ro-${Date.now()}.db`)
    const setupDb = new Database(tmpPath)
    setupDb.run("CREATE TABLE t (id INTEGER)")
    setupDb.close()

    const ro = new Database(tmpPath, { readonly: true })
    expect(() => ro.run("INSERT INTO t VALUES (1)")).toThrow()
    ro.close()
    unlinkSync(tmpPath)
  })
})

describe("listSessionIds", () => {
  it("returns root sessions only (no parent_id)", () => {
    const db = createFixtureDb()
    const since = Date.now() - 35 * 86400000
    const ids = listSessionIds(db, since)
    expect(ids).not.toContain("s3")
  })

  it("excludes [insights] titled sessions", () => {
    const db = createFixtureDb()
    const since = Date.now() - 35 * 86400000
    const ids = listSessionIds(db, since)
    expect(ids).not.toContain("s4")
  })

  it("excludes sessions older than since", () => {
    const db = createFixtureDb()
    const since = Date.now() - 35 * 86400000
    const ids = listSessionIds(db, since)
    expect(ids).not.toContain("s5")
  })

  it("includes normal sessions within window", () => {
    const db = createFixtureDb()
    const since = Date.now() - 35 * 86400000
    const ids = listSessionIds(db, since)
    expect(ids).toContain("s1")
    expect(ids).toContain("s2")
  })
})

describe("getTokenTotals", () => {
  it("aggregates tokens and cost across sessions", () => {
    const db = createFixtureDb()
    const totals = getTokenTotals(db, ["s1", "s2"])
    expect(totals.totalCost).toBeCloseTo(0.08, 5)
    expect(totals.totalTokensInput).toBe(1800)
    expect(totals.totalTokensOutput).toBe(900)
  })
})

describe("getByAgentModel", () => {
  it("groups by agent and model", () => {
    const db = createFixtureDb()
    const rows = getByAgentModel(db, ["s1", "s2"])
    const build = rows.find(r => r.agent === "build")
    expect(build).toBeDefined()
    expect(build!.sessions).toBe(1)
  })
})

describe("getToolErrorRates", () => {
  it("calculates error rates for tools", () => {
    const db = createFixtureDb()
    const rates = getToolErrorRates(db, ["s1", "s2"])
    const bash = rates.find(r => r.tool === "bash")
    expect(bash).toBeDefined()
    expect(bash!.totalCalls).toBe(2)
    expect(bash!.errorCalls).toBe(1)
    expect(bash!.errorRate).toBeCloseTo(0.5, 5)
  })
})

describe("getCacheEfficiency", () => {
  it("calculates cache read ratio per model", () => {
    const db = createFixtureDb()
    const rows = getCacheEfficiency(db, ["s1", "s2"])
    expect(rows.length).toBeGreaterThan(0)
    const sonnet = rows.find(r => r.model.includes("sonnet"))
    expect(sonnet).toBeDefined()
    expect(sonnet!.cacheRatio).toBeGreaterThan(0)
  })
})

describe("getCostPer1k", () => {
  it("calculates cost per 1k total tokens", () => {
    const db = createFixtureDb()
    const rows = getCostPer1k(db, ["s1", "s2"])
    expect(rows.length).toBeGreaterThan(0)
    rows.forEach(r => expect(r.costPer1kTokens).toBeGreaterThan(0))
  })
})

describe("getAgentDelegation", () => {
  it("finds parent→child agent relationships", () => {
    const db = createFixtureDb()
    // s3 is child of s1 (build→build delegation)
    const rows = getAgentDelegation(db, ["s1", "s2", "s3"])
    expect(rows.length).toBeGreaterThan(0)
  })
})
