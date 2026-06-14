import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MODEL } from "./types.ts";
import type { InsightsModel } from "./types.ts";

export interface PluginConfig {
  // LLM used for all analysis calls. Format: "providerID/modelID".
  model: string;
  // Days of session history to analyse (default: 30).
  days: number;
  // Max parallel LLM calls during facet extraction (default: 4).
  concurrency: number;
  // Max sessions to extract per run — cost brake (default: 200).
  maxSessions: number;
}

export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
  model: "anthropic/claude-haiku-4-5",
  days: 30,
  concurrency: 4,
  maxSessions: 200,
};

/**
 * Coerce a value to a valid integer >= min. Returns defaultVal on failure.
 */
function coerceInt(value: unknown, min: number, defaultVal: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) return defaultVal;
  return Math.floor(n);
}

/**
 * Load plugin config from {configDir}/insights.json.
 * Creates the file with defaults on first run.
 * Validates each field individually — invalid fields fall back to their default.
 */
export function loadPluginConfig(configDir: string): PluginConfig {
  const path = join(configDir, "insights.json");
  if (!existsSync(path)) {
    try {
      writeFileSync(path, `${JSON.stringify(DEFAULT_PLUGIN_CONFIG, null, 2)}\n`, "utf-8");
    } catch {
      // Config dir might not be writable (CI, read-only mount). Silently continue.
    }
    return { ...DEFAULT_PLUGIN_CONFIG };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return { ...DEFAULT_PLUGIN_CONFIG };
  }

  return {
    model:
      typeof parsed.model === "string" && parsed.model.trim().length > 0
        ? parsed.model.trim()
        : DEFAULT_PLUGIN_CONFIG.model,
    days: coerceInt(parsed.days, 1, DEFAULT_PLUGIN_CONFIG.days),
    concurrency: coerceInt(parsed.concurrency, 1, DEFAULT_PLUGIN_CONFIG.concurrency),
    maxSessions: coerceInt(parsed.maxSessions, 1, DEFAULT_PLUGIN_CONFIG.maxSessions),
  };
}

/**
 * Parse "providerID/modelID" → InsightsModel.
 * Falls back to DEFAULT_MODEL for empty/missing input.
 * If no slash, assumes anthropic provider.
 */
export function parseModel(str?: string): InsightsModel {
  if (!str || str.trim().length === 0) return DEFAULT_MODEL;
  const trimmed = str.trim();
  const slash = trimmed.indexOf("/");
  if (slash === -1) return { providerID: "anthropic", modelID: trimmed };
  return {
    providerID: trimmed.slice(0, slash),
    modelID: trimmed.slice(slash + 1),
  };
}

/**
 * Returns current date as YYYY-MM-DD for use in output filenames.
 */
export function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
