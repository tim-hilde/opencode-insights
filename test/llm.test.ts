import { describe, expect, it } from "bun:test";
import { JsonParseError, extractJson, mapLimit, runLlm, runLlmJson } from "../src/llm.ts";
import type { LlmCallOptions, LlmClient } from "../src/llm.ts";

function makeMockClient(responseText: string, shouldFail = false) {
  let sessionId = "";
  let deleteCalled = false;

  return {
    get deleteCalled() {
      return deleteCalled;
    },
    get sessionId() {
      return sessionId;
    },
    session: {
      async create(_opts: { body: { title: string } }) {
        sessionId = "mock-session-123";
        return { data: { id: sessionId } };
      },
      async prompt(_opts: { path: { id: string }; body: unknown }) {
        if (shouldFail) throw new Error("LLM call failed");
        return {
          data: {
            info: {},
            parts: [{ type: "text", text: responseText }],
          },
        };
      },
      async delete(_opts: { path: { id: string } }) {
        deleteCalled = true;
        return {};
      },
    } satisfies LlmClient["session"],
  };
}

const baseOpts: LlmCallOptions = {
  model: { providerID: "anthropic", modelID: "claude-3-5-sonnet" },
  prompt: "test prompt",
  retryDelayMs: 0,
};

function makeRetryClient(failTimes: number, responseText = "ok") {
  let attempts = 0;
  let deletes = 0;
  return {
    get attempts() {
      return attempts;
    },
    get deletes() {
      return deletes;
    },
    session: {
      async create(_opts: { body: { title: string } }) {
        return { data: { id: "retry-session" } };
      },
      async prompt(_opts: { path: { id: string }; body: unknown }) {
        attempts++;
        if (attempts <= failTimes) throw new Error("transient");
        return { data: { info: {}, parts: [{ type: "text", text: responseText }] } };
      },
      async delete(_opts: { path: { id: string } }) {
        deletes++;
        return {};
      },
    } satisfies LlmClient["session"],
  };
}

describe("runLlm", () => {
  it("returns concatenated text from text parts", async () => {
    const client = makeMockClient("hello world");
    const result = await runLlm(client, baseOpts);
    expect(result).toBe("hello world");
  });

  it("concatenates multiple text parts", async () => {
    const client = makeMockClient("");
    // Override prompt to return multiple text parts
    // biome-ignore lint/suspicious/noExplicitAny: test mock override
    (client.session as any).prompt = async () => ({
      data: {
        info: {},
        parts: [
          { type: "text", text: "foo" },
          { type: "step-start", step: 1 },
          { type: "text", text: "bar" },
        ],
      },
    });
    const result = await runLlm(client, baseOpts);
    expect(result).toBe("foobar");
  });

  it("calls delete after successful prompt", async () => {
    const client = makeMockClient("ok");
    await runLlm(client, baseOpts);
    expect(client.deleteCalled).toBe(true);
  });

  it("calls delete even when prompt throws", async () => {
    const client = makeMockClient("", true);
    await expect(runLlm(client, baseOpts)).rejects.toThrow("LLM call failed");
    expect(client.deleteCalled).toBe(true);
  });

  it("uses [insights] analysis title for the throwaway session", async () => {
    let capturedTitle = "";
    const client = makeMockClient("ok");
    // biome-ignore lint/suspicious/noExplicitAny: test mock override
    (client.session as any).create = async (opts: { body: { title: string } }) => {
      capturedTitle = opts.body.title;
      return { data: { id: "s1" } };
    };
    await runLlm(client, baseOpts);
    expect(capturedTitle).toBe("[insights] analysis");
  });

  it("passes system prompt when provided", async () => {
    let capturedSystem: string | undefined;
    const client = makeMockClient("ok");
    // biome-ignore lint/suspicious/noExplicitAny: test mock override
    (client.session as any).prompt = async (opts: {
      path: { id: string };
      body: { system?: string };
    }) => {
      capturedSystem = opts.body.system;
      return { data: { info: {}, parts: [{ type: "text", text: "ok" }] } };
    };
    await runLlm(client, { ...baseOpts, system: "be concise" });
    expect(capturedSystem).toBe("be concise");
  });
});

describe("runLlm retry", () => {
  it("retries transient failures and returns once it succeeds", async () => {
    const client = makeRetryClient(2, "recovered");
    const result = await runLlm(client, baseOpts);
    expect(result).toBe("recovered");
    expect(client.attempts).toBe(3); // 2 failures + 1 success
  });

  it("throws the last error after exhausting all retries", async () => {
    const client = makeRetryClient(99);
    await expect(runLlm(client, { ...baseOpts, maxRetries: 2 })).rejects.toThrow("transient");
    expect(client.attempts).toBe(3); // initial attempt + 2 retries
  });

  it("does not retry when maxRetries is 0", async () => {
    const client = makeRetryClient(99);
    await expect(runLlm(client, { ...baseOpts, maxRetries: 0 })).rejects.toThrow("transient");
    expect(client.attempts).toBe(1);
  });

  it("cleans up the session on every attempt", async () => {
    const client = makeRetryClient(2, "ok");
    await runLlm(client, baseOpts);
    expect(client.deletes).toBe(3);
  });
});

describe("runLlmJson", () => {
  it("returns parsed JSON on a clean response", async () => {
    const client = makeMockClient('{"answer": 42}');
    const result = await runLlmJson(client, baseOpts);
    expect(result).toEqual({ answer: 42 });
  });

  it("retries when the model returns invalid JSON and succeeds on next attempt", async () => {
    let calls = 0;
    const client = makeMockClient("");
    // biome-ignore lint/suspicious/noExplicitAny: test mock override
    (client.session as any).prompt = async () => {
      calls++;
      const text = calls === 1 ? "not json at all" : '{"ok": true}';
      return { data: { info: {}, parts: [{ type: "text", text }] } };
    };
    const result = await runLlmJson(client, baseOpts);
    expect(result).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it("throws JsonParseError after exhausting retries on persistent bad JSON", async () => {
    const client = makeMockClient("still not json");
    await expect(runLlmJson(client, { ...baseOpts, maxRetries: 1 })).rejects.toBeInstanceOf(
      JsonParseError,
    );
  });

  it("throws on API error just like runLlm", async () => {
    const client = makeMockClient("", true);
    await expect(runLlmJson(client, { ...baseOpts, maxRetries: 0 })).rejects.toThrow(
      "LLM call failed",
    );
  });
});

describe("extractJson", () => {
  it("parses plain JSON", () => {
    const result = extractJson('{"foo": 1}');
    expect(result).toEqual({ foo: 1 });
  });

  it("strips json code fences", () => {
    const result = extractJson('```json\n{"foo": 2}\n```');
    expect(result).toEqual({ foo: 2 });
  });

  it("strips plain code fences", () => {
    const result = extractJson('```\n{"foo": 3}\n```');
    expect(result).toEqual({ foo: 3 });
  });

  it("handles leading and trailing text around {}", () => {
    const result = extractJson('Here is the result: {"bar": 4} (end)');
    expect(result).toEqual({ bar: 4 });
  });

  it("parses fenced JSON whose string values contain inner code fences", () => {
    const raw = [
      "```json",
      "{",
      '  "items": [',
      '    {"example": "Create `.opencode/commands/x.md`:\\n```md\\nhello\\n```"}',
      "  ]",
      "}",
      "```",
    ].join("\n");
    const result = extractJson(raw) as { items: Array<{ example: string }> };
    expect(result.items).toHaveLength(1);
    expect(result.items[0].example).toContain("hello");
  });

  it("parses JSON with backticks in values when not fenced", () => {
    const result = extractJson('{"cmd": "run `npm test` now"}');
    expect(result).toEqual({ cmd: "run `npm test` now" });
  });

  it("throws JsonParseError on invalid JSON inside braces", () => {
    expect(() => extractJson("{bad json}")).toThrow(JsonParseError);
  });

  it("throws JsonParseError when no JSON object found", () => {
    expect(() => extractJson("no json here at all")).toThrow(JsonParseError);
  });

  it("JsonParseError exposes raw text", () => {
    const raw = "{bad}";
    try {
      extractJson(raw);
      expect(true).toBe(false); // unreachable
    } catch (e) {
      expect(e).toBeInstanceOf(JsonParseError);
      expect((e as JsonParseError).raw).toBe(raw);
    }
  });
});

describe("mapLimit", () => {
  it("returns results in order", async () => {
    const results = await mapLimit([1, 2, 3], 2, async (x) => x * 2);
    expect(results).toEqual([2, 4, 6]);
  });

  it("handles empty array", async () => {
    const results = await mapLimit([], 5, async (x: number) => x);
    expect(results).toEqual([]);
  });

  it("handles limit greater than items length", async () => {
    const results = await mapLimit([1, 2], 10, async (x) => x + 1);
    expect(results).toEqual([2, 3]);
  });

  it("caps concurrency to limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    await mapLimit([1, 2, 3, 4, 5, 6], 2, async (x) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return x;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("passes index to fn", async () => {
    const indices: number[] = [];
    await mapLimit(["a", "b", "c"], 2, async (_item, i) => {
      indices.push(i);
    });
    expect(indices.sort()).toEqual([0, 1, 2]);
  });

  it("mapLimit with limit=0 still processes all items", async () => {
    const results = await mapLimit([1, 2, 3], 0, async (x) => x * 2);
    expect(results).toEqual([2, 4, 6]);
  });

  it("mapLimit with limit=-5 still processes all items", async () => {
    const results = await mapLimit([1, 2], -5, async (x) => x + 1);
    expect(results).toEqual([2, 3]);
  });
});
