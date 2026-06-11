import { Database } from "bun:sqlite"

export function createFixtureDb(): Database {
  const db = new Database(":memory:")

  db.run(`CREATE TABLE session (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT 'proj1',
    parent_id TEXT,
    directory TEXT NOT NULL DEFAULT '/home/user/project',
    title TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    slug TEXT NOT NULL DEFAULT 'slug',
    time_created INTEGER NOT NULL,
    time_updated INTEGER NOT NULL,
    agent TEXT,
    model TEXT,
    cost REAL NOT NULL DEFAULT 0,
    tokens_input INTEGER NOT NULL DEFAULT 0,
    tokens_output INTEGER NOT NULL DEFAULT 0,
    tokens_reasoning INTEGER NOT NULL DEFAULT 0,
    tokens_cache_read INTEGER NOT NULL DEFAULT 0,
    tokens_cache_write INTEGER NOT NULL DEFAULT 0,
    metadata TEXT
  )`)

  db.run(`CREATE TABLE message (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL,
    time_updated INTEGER NOT NULL,
    data TEXT NOT NULL
  )`)

  db.run(`CREATE TABLE part (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL,
    time_updated INTEGER NOT NULL,
    data TEXT NOT NULL
  )`)

  const now = Date.now()
  const day = 86400000

  // s1: normal root session, build agent
  db.run(`INSERT INTO session VALUES ('s1','proj1',NULL,'/home/user/proj','Fix login bug','1.0','s1',${now - 5 * day},${now - 5 * day},'build','anthropic/claude-sonnet-4-5',0.05,1000,500,0,200,100,NULL)`)

  // s2: normal root session, explore agent
  db.run(`INSERT INTO session VALUES ('s2','proj1',NULL,'/home/user/proj','Add feature X','1.0','s2',${now - 3 * day},${now - 3 * day},'explore','anthropic/claude-sonnet-4-5',0.03,800,400,0,100,50,NULL)`)

  // s3: sub-agent child (has parent_id) — excluded from listSessionIds
  db.run(`INSERT INTO session VALUES ('s3','proj1','s1','/home/user/proj','Subagent task','1.0','s3',${now - 4 * day},${now - 4 * day},'build','anthropic/claude-haiku-4-5',0.01,200,100,0,0,0,NULL)`)

  // s4: [insights] titled — excluded from listSessionIds
  db.run(`INSERT INTO session VALUES ('s4','proj1',NULL,'/home/user/proj','[insights] analysis','1.0','s4',${now - 2 * day},${now - 2 * day},'build','anthropic/claude-haiku-4-5',0.02,300,150,0,0,0,NULL)`)

  // s5: older than 30-day default window
  db.run(`INSERT INTO session VALUES ('s5','proj1',NULL,'/home/user/proj','Old session','1.0','s5',${now - 40 * day},${now - 40 * day},'explore','anthropic/claude-haiku-4-5',0.01,100,50,0,0,0,NULL)`)

  // Messages for s1
  db.run(`INSERT INTO message VALUES ('m1','s1',${now - 5 * day},${now - 5 * day},'${JSON.stringify({ role: "user", time: { created: now - 5 * day } })}')`)
  db.run(`INSERT INTO message VALUES ('m2','s1',${now - 5 * day + 1000},${now - 5 * day + 1000},'${JSON.stringify({ role: "assistant", agent: "build", modelID: "claude-sonnet-4-5", providerID: "anthropic", tokens: { input: 1000, output: 500, reasoning: 0, cache: { read: 200, write: 100 }, total: 1700 }, cost: 0.05 })}')`)

  // Messages for s2
  db.run(`INSERT INTO message VALUES ('m3','s2',${now - 3 * day},${now - 3 * day},'${JSON.stringify({ role: "user", time: { created: now - 3 * day } })}')`)
  db.run(`INSERT INTO message VALUES ('m4','s2',${now - 3 * day + 1000},${now - 3 * day + 1000},'${JSON.stringify({ role: "assistant", agent: "explore", modelID: "claude-sonnet-4-5", providerID: "anthropic", tokens: { input: 800, output: 400, reasoning: 0, cache: { read: 100, write: 50 }, total: 1300 }, cost: 0.03 })}')`)

  // Parts for s1: user text part, 2 tool parts (1 success, 1 error), 1 assistant text part
  db.run(`INSERT INTO part VALUES ('p0','m1','s1',${now - 5 * day - 100},${now - 5 * day - 100},'${JSON.stringify({ type: "text", text: "Please fix the login bug." })}')`)
  db.run(`INSERT INTO part VALUES ('p1','m2','s1',${now - 5 * day},${now - 5 * day},'${JSON.stringify({ type: "tool", tool: { name: "bash" }, state: { status: "completed", input: { command: "ls" } } })}')`)
  db.run(`INSERT INTO part VALUES ('p2','m2','s1',${now - 5 * day + 100},${now - 5 * day + 100},'${JSON.stringify({ type: "tool", tool: { name: "bash" }, state: { status: "error", input: { command: "bad cmd" } } })}')`)
  db.run(`INSERT INTO part VALUES ('p3','m2','s1',${now - 5 * day + 200},${now - 5 * day + 200},'${JSON.stringify({ type: "text", text: "I fixed the bug." })}')`)

  // Parts for s2: 1 tool part (read), 1 text
  db.run(`INSERT INTO part VALUES ('p4','m4','s2',${now - 3 * day},${now - 3 * day},'${JSON.stringify({ type: "tool", tool: { name: "read" }, state: { status: "completed", input: { path: "src/auth.ts" } } })}')`)
  db.run(`INSERT INTO part VALUES ('p5','m4','s2',${now - 3 * day + 100},${now - 3 * day + 100},'${JSON.stringify({ type: "text", text: "I analyzed the codebase." })}')`)

  return db
}
