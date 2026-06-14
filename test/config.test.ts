import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_PLUGIN_CONFIG, dateStamp, loadPluginConfig, parseModel } from "../src/config.ts";
import { DEFAULT_MODEL } from "../src/types.ts";

// ── parseModel ────────────────────────────────────────────────────────────────

describe("parseModel", () => {
  it("parses provider/model correctly", () => {
    const m = parseModel("anthropic/claude-haiku-4-5");
    expect(m.providerID).toBe("anthropic");
    expect(m.modelID).toBe("claude-haiku-4-5");
  });

  it("parses openai/gpt-4o", () => {
    const m = parseModel("openai/gpt-4o");
    expect(m.providerID).toBe("openai");
    expect(m.modelID).toBe("gpt-4o");
  });

  it("no-slash → defaults providerID to anthropic", () => {
    const m = parseModel("claude-sonnet-4-5");
    expect(m.providerID).toBe("anthropic");
    expect(m.modelID).toBe("claude-sonnet-4-5");
  });

  it("empty string → DEFAULT_MODEL", () => {
    expect(parseModel("")).toEqual(DEFAULT_MODEL);
  });

  it("undefined → DEFAULT_MODEL", () => {
    expect(parseModel(undefined)).toEqual(DEFAULT_MODEL);
  });

  it("whitespace-only → DEFAULT_MODEL", () => {
    expect(parseModel("   ")).toEqual(DEFAULT_MODEL);
  });
});

// ── dateStamp ─────────────────────────────────────────────────────────────────

describe("dateStamp", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(dateStamp()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── loadPluginConfig ──────────────────────────────────────────────────────────

describe("loadPluginConfig", () => {
  function tempDir(): string {
    return mkdtempSync(join(tmpdir(), "ins-cfg-"));
  }

  it("creates insights.json with defaults on first run", () => {
    const dir = tempDir();
    const cfg = loadPluginConfig(dir);
    expect(cfg).toEqual(DEFAULT_PLUGIN_CONFIG);
    // File should have been written
    const written = JSON.parse(
      require("node:fs").readFileSync(join(dir, "insights.json"), "utf-8"),
    );
    expect(written.days).toBe(30);
    rmSync(dir, { recursive: true });
  });

  it("returns defaults when file is missing and dir is not writable (no throw)", () => {
    // Use a non-existent nested path — write will silently fail
    const cfg = loadPluginConfig("/nonexistent/path/that/cannot/be/created");
    expect(cfg).toEqual(DEFAULT_PLUGIN_CONFIG);
  });

  it("reads valid config file", () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, "insights.json"),
      JSON.stringify({ model: "openai/gpt-4o", days: 7, concurrency: 2, maxSessions: 50 }),
    );
    const cfg = loadPluginConfig(dir);
    expect(cfg.model).toBe("openai/gpt-4o");
    expect(cfg.days).toBe(7);
    expect(cfg.concurrency).toBe(2);
    expect(cfg.maxSessions).toBe(50);
    rmSync(dir, { recursive: true });
  });

  it("falls back to defaults for malformed JSON", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "insights.json"), "{ invalid json }");
    expect(loadPluginConfig(dir)).toEqual(DEFAULT_PLUGIN_CONFIG);
    rmSync(dir, { recursive: true });
  });

  it("partial config — missing fields use defaults", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "insights.json"), JSON.stringify({ days: 14 }));
    const cfg = loadPluginConfig(dir);
    expect(cfg.days).toBe(14);
    expect(cfg.model).toBe(DEFAULT_PLUGIN_CONFIG.model);
    expect(cfg.concurrency).toBe(DEFAULT_PLUGIN_CONFIG.concurrency);
    rmSync(dir, { recursive: true });
  });

  it('days: "30" (string) → falls back to default', () => {
    const dir = tempDir();
    writeFileSync(join(dir, "insights.json"), JSON.stringify({ days: "30" }));
    const cfg = loadPluginConfig(dir);
    // "30" is coercible via Number() → 30 which is valid, so it should work
    // Actually Number("30") === 30, which is >= 1 → should be accepted
    expect(cfg.days).toBe(30);
    rmSync(dir, { recursive: true });
  });

  it("concurrency: 0 → falls back to default (1 minimum)", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "insights.json"), JSON.stringify({ concurrency: 0 }));
    const cfg = loadPluginConfig(dir);
    expect(cfg.concurrency).toBe(DEFAULT_PLUGIN_CONFIG.concurrency);
    rmSync(dir, { recursive: true });
  });

  it("concurrency: -1 → falls back to default", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "insights.json"), JSON.stringify({ concurrency: -1 }));
    const cfg = loadPluginConfig(dir);
    expect(cfg.concurrency).toBe(DEFAULT_PLUGIN_CONFIG.concurrency);
    rmSync(dir, { recursive: true });
  });

  it("concurrency: NaN → falls back to default", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "insights.json"), JSON.stringify({ concurrency: null }));
    const cfg = loadPluginConfig(dir);
    expect(cfg.concurrency).toBe(DEFAULT_PLUGIN_CONFIG.concurrency);
    rmSync(dir, { recursive: true });
  });

  it("maxSessions: 0 → falls back to default", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "insights.json"), JSON.stringify({ maxSessions: 0 }));
    const cfg = loadPluginConfig(dir);
    expect(cfg.maxSessions).toBe(DEFAULT_PLUGIN_CONFIG.maxSessions);
    rmSync(dir, { recursive: true });
  });

  it("model: empty string → falls back to default", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "insights.json"), JSON.stringify({ model: "" }));
    const cfg = loadPluginConfig(dir);
    expect(cfg.model).toBe(DEFAULT_PLUGIN_CONFIG.model);
    rmSync(dir, { recursive: true });
  });

  it("model: 42 (number) → falls back to default", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "insights.json"), JSON.stringify({ model: 42 }));
    const cfg = loadPluginConfig(dir);
    expect(cfg.model).toBe(DEFAULT_PLUGIN_CONFIG.model);
    rmSync(dir, { recursive: true });
  });
});
