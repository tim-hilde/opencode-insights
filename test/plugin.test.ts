import { describe, expect, test } from "bun:test";
import plugin, { InsightsPlugin } from "../src/index.ts";

type Added = { name: string; description?: string; input?: unknown; execute: unknown };

function makeContext() {
  const commands: Added[] = [];
  const tools: Added[] = [];
  const prompts: Array<Record<string, unknown>> = [];
  const registration = { dispose: async () => {} };
  const ctx = {
    location: { directory: "/home/user/project" },
    command: {
      transform: async (edit: (editor: { add(d: Added): void }) => void) => {
        edit({ add: (d) => commands.push(d) });
        return registration;
      },
    },
    tool: {
      transform: async (edit: (editor: { add(d: Added): void }) => void) => {
        edit({ add: (d) => tools.push(d) });
        return registration;
      },
    },
    session: {
      prompt: async (input: Record<string, unknown>) => {
        prompts.push(input);
      },
    },
    generate: { text: async () => ({ text: "{}" }) },
  };
  return { ctx, commands, tools, prompts };
}

describe("plugin entry", () => {
  test("serves OpenCode 1 via server() and OpenCode 2 via setup()", () => {
    expect(plugin.id).toBe("opencode-insights");
    expect(plugin.server).toBe(InsightsPlugin);
    expect(typeof plugin.setup).toBe("function");
  });

  test("OpenCode 2 /insights asks the session to run the tool with the user's arguments", async () => {
    const { ctx, commands, prompts } = makeContext();
    await plugin.setup(ctx as never);

    const command = commands.find((c) => c.name === "insights");
    expect(command?.description).toBe(
      "Generate a usage insights report for your OpenCode sessions.",
    );
    await (command?.execute as (input: unknown) => Promise<void>)({
      sessionID: "ses_1",
      prompt: { text: " days=7 all=true " },
      delivery: "immediate",
    });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.sessionID).toBe("ses_1");
    expect(prompts[0]?.delivery).toBe("immediate");
    expect(prompts[0]?.text).toStartWith(
      "Call the insights tool with these arguments: days=7 all=true\n\n",
    );
  });

  test("OpenCode 2 registers the insights tool with its arguments", async () => {
    const { ctx, tools } = makeContext();
    await plugin.setup(ctx as never);

    const tool = tools.find((t) => t.name === "insights");
    expect(tool?.description).toContain("Analyze OpenCode session history");
    const input = tool?.input as { type: string; properties: Record<string, unknown> };
    expect(input.type).toBe("object");
    expect(Object.keys(input.properties).sort()).toEqual([
      "all",
      "days",
      "force",
      "model",
      "output",
    ]);
  });
});
