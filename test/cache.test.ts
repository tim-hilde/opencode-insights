import { afterEach, beforeEach, describe, expect, it, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FACET_CACHE_VERSION, FacetCache } from "../src/cache.ts";
import type { SessionFacet } from "../src/types.ts";

const sampleFacet: SessionFacet = {
  sessionId: "test-123",
  underlyingGoal: "Fix the login bug",
  goalCategories: { fix_bug: 1 },
  outcome: "fully_achieved",
  satisfaction: { satisfied: 1 },
  frictionCounts: {},
  frictionDetail: "",
  primarySuccess: "Bug fixed",
  briefSummary: "Fixed a login authentication bug",
};

let dir: string;
let cache: FacetCache;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "facet-cache-test-"));
  cache = new FacetCache(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("FacetCache.has", () => {
  test("returns false for nonexistent session", () => {
    expect(cache.has("missing")).toBe(false);
  });

  test("returns true after put", () => {
    cache.put("test-123", sampleFacet);
    expect(cache.has("test-123")).toBe(true);
  });
});

describe("FacetCache.get", () => {
  test("returns null for nonexistent session", () => {
    expect(cache.get("missing")).toBeNull();
  });

  test("returns facet back after put (deep equality)", () => {
    cache.put("test-123", sampleFacet);
    expect(cache.get("test-123")).toEqual(sampleFacet);
  });

  test("returns null on corrupted JSON file", () => {
    writeFileSync(join(dir, "bad.json"), "not valid json{{{", "utf-8");
    expect(cache.get("bad")).toBeNull();
  });
});

describe("FacetCache.put", () => {
  test("no .tmp file left after successful put", () => {
    cache.put("test-123", sampleFacet);
    expect(existsSync(join(dir, "test-123.json.tmp"))).toBe(false);
  });

  test("overwrites existing entry correctly", () => {
    cache.put("test-123", sampleFacet);
    const updated: SessionFacet = { ...sampleFacet, underlyingGoal: "Different goal" };
    cache.put("test-123", updated);
    expect(cache.get("test-123")).toEqual(updated);
  });
});

describe("FACET_CACHE_VERSION", () => {
  it("is exported as 'v1'", () => {
    expect(FACET_CACHE_VERSION).toBe("v1");
  });
});

describe("FacetCache.clear", () => {
  test("removes all .json files", () => {
    cache.put("a", sampleFacet);
    cache.put("b", sampleFacet);
    cache.clear();
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(false);
  });

  test("removes leftover .tmp files", () => {
    const tmpFile = join(dir, "leftover.json.tmp");
    writeFileSync(tmpFile, "{}", "utf-8");
    cache.clear();
    expect(existsSync(tmpFile)).toBe(false);
  });

  test("does not throw on nonexistent dir", () => {
    const emptyCache = new FacetCache(join(tmpdir(), `facet-nonexistent-${Date.now()}`));
    // Remove the dir that was auto-created by the constructor
    rmSync(emptyCache.dir, { recursive: true, force: true });
    expect(() => emptyCache.clear()).not.toThrow();
  });
});
