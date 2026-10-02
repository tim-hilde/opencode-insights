import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  exposeOpenCode2Tables,
  getAgentDelegation,
  getByAgentModel,
  getCacheEfficiency,
  getCostPerMTok,
  getSessionDateRange,
  getSessionMeta,
  getTokenTotals,
  getToolErrorRates,
  listSessionIds,
  listSessionIdsWithDir,
  openDb,
} from "../src/db.ts";
import { aggregateAll, reconstructTranscript } from "../src/extract.ts";
import { createFixtureDbV2 } from "./fixture-v2.ts";
import { createFixtureDb } from "./fixture.ts";

// The same history stored by OpenCode 1 and OpenCode 2 must produce the same
// insights. Ids: s1/s2 roots with messages, s3 child of s1, s4 [insights],
// s5 outside the window, s6/s7 JSON model column.
const now = Date.now();
const since = now - 30 * 86400000;
const v1 = createFixtureDb(now);
const v2 = createFixtureDbV2(now);
exposeOpenCode2Tables(v2);
const ids = ["s1", "s2", "s6", "s7"];

describe("OpenCode 2 store", () => {
  test("lists the same root sessions", () => {
    expect(listSessionIds(v2, since)).toEqual(listSessionIds(v1, since));
    expect(listSessionIdsWithDir(v2, since)).toEqual(listSessionIdsWithDir(v1, since));
  });

  test("totals tokens, cost and user/assistant messages the same", () => {
    expect(getTokenTotals(v2, ids)).toEqual(getTokenTotals(v1, ids));
  });

  test("groups agents and models the same", () => {
    expect(getByAgentModel(v2, ids)).toEqual(getByAgentModel(v1, ids));
    expect(getCacheEfficiency(v2, ids)).toEqual(getCacheEfficiency(v1, ids));
    expect(getCostPerMTok(v2, ids)).toEqual(getCostPerMTok(v1, ids));
  });

  test("counts tool calls and errors from assistant content", () => {
    expect(getToolErrorRates(v2, ids)).toEqual(getToolErrorRates(v1, ids));
  });

  test("finds subagent delegation", () => {
    expect(getAgentDelegation(v2, ids)).toEqual(getAgentDelegation(v1, ids));
  });

  test("reports the same date range and session meta", () => {
    expect(getSessionDateRange(v2, ids)).toEqual(getSessionDateRange(v1, ids));
    expect(getSessionMeta(v2, "s1")).toEqual(getSessionMeta(v1, "s1"));
  });

  test("reconstructs the same transcript", () => {
    expect(reconstructTranscript(v2, "s1")).toBe(reconstructTranscript(v1, "s1"));
    expect(reconstructTranscript(v2, "s2")).toBe(reconstructTranscript(v1, "s2"));
  });

  test("aggregates the same stats", () => {
    expect(aggregateAll(v2, ids)).toEqual(aggregateAll(v1, ids));
  });

  test("openDb exposes the OpenCode 2 tables on a read-only file", () => {
    const path = join(mkdtempSync(join(tmpdir(), "insights-v2-")), "opencode.db");
    createFixtureDbV2(now, path).close();
    const db = openDb(path, "opencode2");
    try {
      expect(listSessionIds(db, since).sort()).toEqual(["s1", "s2", "s6", "s7"]);
    } finally {
      db.close();
    }
  });
});
