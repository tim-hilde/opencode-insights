import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getAgentDelegation,
  getByAgentModel,
  getCacheEfficiency,
  getCostPer1k,
  getSessionMeta,
  getTokenTotals,
  getToolErrorRates,
  listSessionIds,
  openDb,
} from "../src/db.ts";
import { createFixtureDb } from "./fixture.ts";

describe("openDb", () => {
  it("returns a readable Database", () => {
    const tmpPath = join(tmpdir(), `test-opendb-${Date.now()}.db`);
    const setup = new Database(tmpPath);
    setup.run("CREATE TABLE t (id INTEGER)");
    setup.run("INSERT INTO t VALUES (42)");
    setup.close();

    const db = openDb(tmpPath);
    const row = db.query<{ id: number }, []>("SELECT id FROM t").get();
    expect(row?.id).toBe(42);
    db.close();
    unlinkSync(tmpPath);
  });

  it("throws on write attempt to read-only DB", () => {
    const tmpPath = join(tmpdir(), `test-ro-${Date.now()}.db`);
    const setup = new Database(tmpPath);
    setup.run("CREATE TABLE t (id INTEGER)");
    setup.close();

    const db = openDb(tmpPath);
    expect(() => db.run("INSERT INTO t VALUES (1)")).toThrow();
    db.close();
    unlinkSync(tmpPath);
  });
});

describe("listSessionIds", () => {
  it("returns root sessions only (no parent_id)", () => {
    const db = createFixtureDb();
    const since = Date.now() - 35 * 86400000;
    const ids = listSessionIds(db, since);
    expect(ids).not.toContain("s3");
  });

  it("excludes [insights] titled sessions", () => {
    const db = createFixtureDb();
    const since = Date.now() - 35 * 86400000;
    const ids = listSessionIds(db, since);
    expect(ids).not.toContain("s4");
  });

  it("excludes sessions older than since", () => {
    const db = createFixtureDb();
    const since = Date.now() - 35 * 86400000;
    const ids = listSessionIds(db, since);
    expect(ids).not.toContain("s5");
  });

  it("includes normal sessions within window", () => {
    const db = createFixtureDb();
    const since = Date.now() - 35 * 86400000;
    const ids = listSessionIds(db, since);
    expect(ids).toContain("s1");
    expect(ids).toContain("s2");
  });
});

describe("getSessionMeta", () => {
  it("returns null for unknown session ID", () => {
    const db = createFixtureDb();
    expect(getSessionMeta(db, "nonexistent-id")).toBeNull();
  });

  it("correctly maps token fields for s1", () => {
    const db = createFixtureDb();
    const meta = getSessionMeta(db, "s1");
    expect(meta).not.toBeNull();
    if (!meta) return;
    expect(meta.inputTokens).toBe(1000);
    expect(meta.outputTokens).toBe(500);
    expect(meta.reasoningTokens).toBe(0);
    expect(meta.cacheReadTokens).toBe(200);
    expect(meta.cacheWriteTokens).toBe(100);
    expect(meta.cost).toBeCloseTo(0.05, 5);
    expect(meta.totalTokens).toBe(1700);
  });

  it("toolCounts aggregates tools used in session", () => {
    const db = createFixtureDb();
    const meta = getSessionMeta(db, "s1");
    expect(meta).not.toBeNull();
    if (!meta) return;
    expect(meta.toolCounts.bash).toBe(2);
  });

  it("userMsgCount and assistantMsgCount split correctly for s1", () => {
    const db = createFixtureDb();
    const meta = getSessionMeta(db, "s1");
    expect(meta).not.toBeNull();
    if (!meta) return;
    expect(meta.userMsgCount).toBe(1);
    expect(meta.assistantMsgCount).toBe(1);
  });

  it("durationMinutes is >= 0", () => {
    const db = createFixtureDb();
    const meta = getSessionMeta(db, "s1");
    expect(meta).not.toBeNull();
    if (!meta) return;
    expect(meta.durationMinutes).toBeGreaterThanOrEqual(0);
  });
});

describe("getTokenTotals", () => {
  it("aggregates tokens and cost across sessions", () => {
    const db = createFixtureDb();
    const totals = getTokenTotals(db, ["s1", "s2"]);
    expect(totals.totalCost).toBeCloseTo(0.08, 5);
    expect(totals.totalTokensInput).toBe(1800);
    expect(totals.totalTokensOutput).toBe(900);
  });
});

describe("getByAgentModel", () => {
  it("groups by agent and model", () => {
    const db = createFixtureDb();
    const rows = getByAgentModel(db, ["s1", "s2"]);
    const build = rows.find((r) => r.agent === "build");
    expect(build).toBeDefined();
    expect(build?.sessions).toBe(1);
  });
});

describe("getToolErrorRates", () => {
  it("calculates error rates for tools", () => {
    const db = createFixtureDb();
    const rates = getToolErrorRates(db, ["s1", "s2"]);
    const bash = rates.find((r) => r.tool === "bash");
    expect(bash).toBeDefined();
    expect(bash?.totalCalls).toBe(2);
    expect(bash?.errorCalls).toBe(1);
    expect(bash?.errorRate).toBeCloseTo(0.5, 5);
  });
});

describe("getCacheEfficiency", () => {
  it("calculates correct cache ratio for sonnet model", () => {
    const db = createFixtureDb();
    const rows = getCacheEfficiency(db, ["s1", "s2"]);
    const sonnet = rows.find((r) => r.model.includes("sonnet"));
    // s1: cache_read=200, input=1000; s2: cache_read=100, input=800
    // combined: 300/(1800+300) = 300/2100 ≈ 0.143
    expect(sonnet).toBeDefined();
    if (!sonnet) return;
    expect(sonnet.cacheRatio).toBeGreaterThan(0.1);
    expect(sonnet.cacheRatio).toBeLessThan(0.2);
  });
});

describe("getCostPer1k", () => {
  it("calculates cost per 1k total tokens", () => {
    const db = createFixtureDb();
    const rows = getCostPer1k(db, ["s1", "s2"]);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.costPer1kTokens).toBeGreaterThan(0);
    }
  });
});

describe("getAgentDelegation", () => {
  it("finds build→build delegation from s1→s3", () => {
    const db = createFixtureDb();
    // s3 has parent_id=s1; query finds it when s1 is in the set
    const rows = getAgentDelegation(db, ["s1", "s2"]);
    const delegation = rows.find((r) => r.parentAgent === "build" && r.childAgent === "build");
    expect(delegation).toBeDefined();
    expect(delegation?.count).toBe(1);
  });
});

describe("empty sessionIds handling", () => {
  it("listSessionIds with future since returns []", () => {
    const db = createFixtureDb();
    const ids = listSessionIds(db, Date.now() + 1000000);
    expect(ids).toEqual([]);
  });

  it("getTokenTotals with [] returns zero struct", () => {
    const db = createFixtureDb();
    const t = getTokenTotals(db, []);
    expect(t.totalCost).toBe(0);
    expect(t.totalTokens).toBe(0);
  });

  it("getByAgentModel with [] returns []", () => {
    expect(getByAgentModel(createFixtureDb(), [])).toEqual([]);
  });

  it("getToolErrorRates with [] returns []", () => {
    expect(getToolErrorRates(createFixtureDb(), [])).toEqual([]);
  });

  it("getCacheEfficiency with [] returns []", () => {
    expect(getCacheEfficiency(createFixtureDb(), [])).toEqual([]);
  });

  it("getCostPer1k with [] returns []", () => {
    expect(getCostPer1k(createFixtureDb(), [])).toEqual([]);
  });

  it("getAgentDelegation with [] returns []", () => {
    expect(getAgentDelegation(createFixtureDb(), [])).toEqual([]);
  });
});
