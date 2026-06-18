import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { SessionFacet } from "./types.ts";

/**
 * Increment when the SessionFacet schema OR the facet-extraction prompt changes in a
 * way that should invalidate old cached facets.
 * v2: actor-attribution rewrite of brief_summary / primary_success (agent vs user).
 */
export const FACET_CACHE_VERSION = "v2";

export class FacetCache {
  readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  has(sessionId: string): boolean {
    return existsSync(join(this.dir, `${sessionId}.json`));
  }

  get(sessionId: string): SessionFacet | null {
    const path = join(this.dir, `${sessionId}.json`);
    try {
      const text = readFileSync(path, "utf-8");
      return JSON.parse(text) as SessionFacet;
    } catch {
      return null;
    }
  }

  put(sessionId: string, facet: SessionFacet): void {
    const tmpPath = join(this.dir, `${sessionId}.json.tmp`);
    const finalPath = join(this.dir, `${sessionId}.json`);
    writeFileSync(tmpPath, JSON.stringify(facet, null, 2), "utf-8");
    renameSync(tmpPath, finalPath);
  }

  clear(): void {
    try {
      const entries = readdirSync(this.dir);
      for (const entry of entries) {
        if (entry.endsWith(".json") || entry.endsWith(".json.tmp")) {
          unlinkSync(join(this.dir, entry));
        }
      }
    } catch {
      // dir doesn't exist, nothing to clear
    }
  }
}
