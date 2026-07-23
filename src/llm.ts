import { ANALYSIS_SYSTEM_PROMPT } from "./prompts.ts";

export interface SessionPromptBody {
  model?: { providerID: string; modelID: string };
  agent?: string;
  system?: string;
  tools?: Record<string, boolean>;
  parts: Array<{ type: "text"; text: string }>;
  noReply?: boolean;
}

export interface LlmClient {
  session: {
    create(opts: { body: { title: string } }): Promise<unknown>;
    prompt(opts: { path: { id: string }; body: SessionPromptBody }): Promise<unknown>;
    delete(opts: { path: { id: string } }): Promise<unknown>;
  };
}

export interface LlmCallOptions {
  model: { providerID: string; modelID: string };
  prompt: string;
  system?: string;
  /** Additional attempts after the first on a failed call. Default: 2. */
  maxRetries?: number;
  /** Base delay (ms) for exponential backoff between retries. Default: 500. */
  retryDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runLlm(client: LlmClient, opts: LlmCallOptions): Promise<string> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await runLlmOnce(client, opts);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) await sleep(baseDelay * 2 ** attempt);
    }
  }
  throw lastError;
}

async function runLlmOnce(client: LlmClient, opts: LlmCallOptions): Promise<string> {
  const createResult = await client.session.create({ body: { title: "[insights] analysis" } });
  const sessionId = (createResult as { data: { id: string } }).data.id;

  try {
    const promptResult = await client.session.prompt({
      path: { id: sessionId },
      body: {
        model: opts.model,
        // Hard-deny every tool: these throwaway sessions inherit the default (build)
        // agent, and an empty object ({}) leaves all inherited tools ENABLED. "*": false
        // is opencode's wildcard deny — the analysis call physically cannot run tools,
        // load skills, or edit files even if transcript content tries to induce it.
        tools: { "*": false },
        // Default to the non-agentic analyzer framing; an explicit system still wins.
        system: opts.system ?? ANALYSIS_SYSTEM_PROMPT,
        parts: [{ type: "text", text: opts.prompt }],
      },
    });

    const parts = (promptResult as { data: { parts: Array<{ type: string; text?: string }> } }).data
      .parts;
    return parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
  } finally {
    // Best-effort cleanup of the throwaway session: a delete failure must not mask
    // the result/error above, nor trigger a pointless retry of the (paid) prompt.
    try {
      await client.session.delete({ path: { id: sessionId } });
    } catch {
      /* ignore */
    }
  }
}

export class JsonParseError extends Error {
  constructor(
    readonly raw: string,
    cause: unknown,
  ) {
    super("Failed to parse JSON from LLM response");
    this.cause = cause;
  }
}

export function extractJson(text: string): unknown {
  let cleaned = text.trim();

  // Strip a wrapping markdown fence WITHOUT using it to bound the content: a greedy/
  // non-greedy fence regex mis-fires when a string value contains its own code fence
  // (e.g. a `copyable_prompt` with a ```md``` block), truncating valid JSON. Instead we
  // drop only a leading opener and trailing closer, then rely on brace matching below.
  cleaned = cleaned.replace(/^```(?:json)?[ \t]*\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new JsonParseError(text, new Error("No JSON object found"));
  }

  const jsonStr = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new JsonParseError(text, e);
  }
}

/**
 * Like runLlm, but additionally parses the response as JSON and retries on
 * both API errors and JSON parse failures (JsonParseError). Use this wherever
 * the caller needs structured JSON output — it covers the full call+parse cycle.
 */
export async function runLlmJson(client: LlmClient, opts: LlmCallOptions): Promise<unknown> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const raw = await runLlmOnce(client, opts);
      return extractJson(raw);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) await sleep(baseDelay * 2 ** attempt);
    }
  }
  throw lastError;
}

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker);
  await Promise.all(workers);
  return results;
}
