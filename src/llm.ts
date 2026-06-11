export interface SessionPromptBody {
  model?: { providerID: string; modelID: string }
  agent?: string
  system?: string
  tools?: Record<string, boolean>
  parts: Array<{ type: "text"; text: string }>
  noReply?: boolean
}

export interface LlmClient {
  session: {
    create(opts: { body: { title: string } }): Promise<unknown>
    prompt(opts: { path: { id: string }; body: SessionPromptBody }): Promise<unknown>
    delete(opts: { path: { id: string } }): Promise<unknown>
  }
}

export interface LlmCallOptions {
  model: { providerID: string; modelID: string }
  prompt: string
  system?: string
}

export async function runLlm(client: LlmClient, opts: LlmCallOptions): Promise<string> {
  const createResult = await client.session.create({ body: { title: "[insights] analysis" } })
  const sessionId = (createResult as { data: { id: string } }).data.id

  let text = ""
  try {
    const promptResult = await client.session.prompt({
      path: { id: sessionId },
      body: {
        model: opts.model,
        agent: "insights-analyzer",
        tools: {},
        system: opts.system,
        parts: [{ type: "text", text: opts.prompt }],
      },
    })

    const parts = (promptResult as { data: { parts: Array<{ type: string; text?: string }> } }).data
      .parts
    text = parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("")
  } finally {
    await client.session.delete({ path: { id: sessionId } })
  }

  return text
}

export class JsonParseError extends Error {
  constructor(
    readonly raw: string,
    cause: unknown,
  ) {
    super("Failed to parse JSON from LLM response")
    this.cause = cause
  }
}

export function extractJson(text: string): unknown {
  let cleaned = text.trim()

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]+?)\s*```/)
  if (fenceMatch) cleaned = fenceMatch[1]

  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new JsonParseError(text, new Error("No JSON object found"))
  }

  const jsonStr = cleaned.slice(start, end + 1)
  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    throw new JsonParseError(text, e)
  }
}

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++
      results[i] = await fn(items[i], i)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker)
  await Promise.all(workers)
  return results
}
