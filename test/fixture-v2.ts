import { Database } from "bun:sqlite";

/**
 * The history from createFixtureDb(), stored the way OpenCode 2 stores it:
 * sessions in session_v2, messages as typed JSON in session_message (tool calls,
 * text and reasoning live in the assistant message's content array).
 */
export function createFixtureDbV2(now = Date.now(), path = ":memory:"): Database {
  const db = new Database(path);
  const day = 86400000;

  db.run(`CREATE TABLE session_v2 (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT 'proj1',
    parent_id TEXT,
    slug TEXT NOT NULL DEFAULT 'slug',
    directory TEXT NOT NULL,
    title TEXT,
    version TEXT NOT NULL DEFAULT '2.0',
    cost REAL NOT NULL DEFAULT 0,
    tokens_input INTEGER NOT NULL DEFAULT 0,
    tokens_output INTEGER NOT NULL DEFAULT 0,
    tokens_reasoning INTEGER NOT NULL DEFAULT 0,
    tokens_cache_read INTEGER NOT NULL DEFAULT 0,
    tokens_cache_write INTEGER NOT NULL DEFAULT 0,
    agent TEXT,
    model TEXT,
    time_created INTEGER NOT NULL,
    time_updated INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE session_message (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    type TEXT NOT NULL,
    seq INTEGER NOT NULL,
    time_created INTEGER NOT NULL,
    time_updated INTEGER NOT NULL,
    data TEXT NOT NULL
  )`);

  const session = db.prepare(
    `INSERT INTO session_v2 (id, parent_id, directory, title, time_created, time_updated, agent, model,
      cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write)
     VALUES (?, ?, '/home/user/proj', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  );
  const opus = (variant: string) =>
    JSON.stringify({ id: "claude-opus-4-8", providerID: "anthropic", variant });
  session.run(
    "s1",
    null,
    "Fix login bug",
    now - 5 * day,
    now - 5 * day,
    "build",
    "anthropic/claude-sonnet-4-5",
    0.05,
    1000,
    500,
    200,
    100,
  );
  session.run(
    "s2",
    null,
    "Add feature X",
    now - 3 * day,
    now - 3 * day,
    "explore",
    "anthropic/claude-sonnet-4-5",
    0.03,
    800,
    400,
    100,
    50,
  );
  session.run(
    "s3",
    "s1",
    "Subagent task",
    now - 4 * day,
    now - 4 * day,
    "build",
    "anthropic/claude-haiku-4-5",
    0.01,
    200,
    100,
    0,
    0,
  );
  session.run(
    "s4",
    null,
    "[insights] analysis",
    now - 2 * day,
    now - 2 * day,
    "build",
    "anthropic/claude-haiku-4-5",
    0.02,
    300,
    150,
    0,
    0,
  );
  session.run(
    "s5",
    null,
    "Old session",
    now - 40 * day,
    now - 40 * day,
    "explore",
    "anthropic/claude-haiku-4-5",
    0.01,
    100,
    50,
    0,
    0,
  );
  session.run(
    "s6",
    null,
    "Opus xhigh task",
    now - 1 * day,
    now - 1 * day,
    "build",
    opus("xhigh"),
    0.5,
    2000,
    1000,
    500,
    200,
  );
  session.run(
    "s7",
    null,
    "Opus default task",
    now - 1 * day,
    now - 1 * day,
    "build",
    opus("default"),
    0.2,
    1000,
    500,
    100,
    50,
  );

  const message = db.prepare("INSERT INTO session_message VALUES (?, ?, ?, ?, ?, ?, ?)");
  const add = (
    id: string,
    sessionID: string,
    type: string,
    seq: number,
    time: number,
    data: object,
  ) => message.run(id, sessionID, type, seq, time, time, JSON.stringify(data));
  const sonnet = { id: "claude-sonnet-4-5", providerID: "anthropic" };

  add("m1", "s1", "user", 0, now - 5 * day, { text: "Please fix the login bug." });
  add("m2", "s1", "assistant", 1, now - 5 * day + 1000, {
    agent: "build",
    model: sonnet,
    content: [
      {
        type: "tool",
        id: "c1",
        name: "bash",
        state: { status: "completed", input: { command: "ls" } },
      },
      {
        type: "tool",
        id: "c2",
        name: "bash",
        state: {
          status: "error",
          input: { command: "bad cmd" },
          error: { type: "x", message: "boom" },
        },
      },
      { type: "text", text: "I fixed the bug." },
    ],
    tokens: { input: 1000, output: 500, reasoning: 0, cache: { read: 200, write: 100 } },
    cost: 0.05,
  });
  // OpenCode 2-only message kinds are neither messages nor transcript content in OpenCode 1.
  add("m2s", "s1", "synthetic", 2, now - 5 * day + 2000, { text: "<system-reminder>" });

  add("m3", "s2", "user", 0, now - 3 * day, { text: "" });
  add("m4", "s2", "assistant", 1, now - 3 * day + 1000, {
    agent: "explore",
    model: sonnet,
    content: [
      {
        type: "tool",
        id: "c3",
        name: "read",
        state: { status: "completed", input: { path: "src/auth.ts" } },
      },
      { type: "text", text: "I analyzed the codebase." },
    ],
    tokens: { input: 800, output: 400, reasoning: 0, cache: { read: 100, write: 50 } },
    cost: 0.03,
  });

  return db;
}
