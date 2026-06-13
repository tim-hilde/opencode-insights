import { describe, expect, it } from "bun:test";
import { JsonParseError, extractJson, mapLimit, runLlm } from "../src/llm.ts";
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
};

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
});
