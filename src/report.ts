import type { AggregatedStats, InsightsConfig, SessionFacet } from "./types.ts"

export interface ReportData {
  stats: AggregatedStats
  facets: Map<string, SessionFacet>
  aggregates: Record<string, unknown>
  atAGlance: Record<string, unknown>
  config: InsightsConfig
  generatedAt: number
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function fmtCost(n: number): string {
  return `$${n.toFixed(4)}`
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function unavailable(): string {
  return `<p class="muted">(analysis unavailable)</p>`
}

function isEmptyObject(v: unknown): boolean {
  return v == null || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)
}

function renderProjectAreas(agg: unknown): string {
  if (isEmptyObject(agg)) return unavailable()
  const data = agg as { areas?: Array<{ name: string; description: string; session_count: number; example_goals?: string[] }> }
  if (!data.areas?.length) return unavailable()
  return data.areas.map(a => `
    <div class="card" style="margin:8px 0">
      <strong>${esc(a.name)}</strong>
      <span class="tag">${esc(a.session_count)} sessions</span>
      <p style="margin:6px 0">${esc(a.description)}</p>
      ${a.example_goals?.length ? `<div>${a.example_goals.map(g => `<span class="tag">${esc(g)}</span>`).join("")}</div>` : ""}
    </div>`).join("")
}

function renderInteractionStyle(agg: unknown): string {
  if (isEmptyObject(agg)) return unavailable()
  const data = agg as Record<string, unknown>
  return Object.entries(data).map(([k, v]) =>
    `<p><strong>${esc(k.replace(/_/g, " "))}:</strong> ${esc(v)}</p>`
  ).join("")
}

function renderAgentPerformance(agg: unknown): string {
  if (isEmptyObject(agg)) return unavailable()
  const data = agg as Record<string, unknown>
  return Object.entries(data).map(([k, v]) =>
    `<p><strong>${esc(k)}:</strong> ${esc(typeof v === "object" ? JSON.stringify(v) : v)}</p>`
  ).join("")
}

function renderFriction(agg: unknown): string {
  if (isEmptyObject(agg)) return unavailable()
  const data = agg as { intro?: string; categories?: Array<{ category: string; description: string; examples?: string[] }> }
  if (!data.categories?.length) return unavailable()
  const intro = data.intro ? `<p>${esc(data.intro)}</p>` : ""
  const items = data.categories.map(c => `
    <div class="friction-item">
      <strong>${esc(c.category)}</strong>
      <p style="margin:4px 0">${esc(c.description)}</p>
      ${c.examples?.length ? `<ul style="margin:4px 0">${c.examples.map(e => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
    </div>`).join("")
  return intro + items
}

function renderToolHealth(agg: unknown): string {
  if (isEmptyObject(agg)) return unavailable()
  const data = agg as Record<string, unknown>
  return Object.entries(data).map(([k, v]) =>
    `<p><strong>${esc(k.replace(/_/g, " "))}:</strong> ${esc(typeof v === "object" ? JSON.stringify(v) : v)}</p>`
  ).join("")
}

function renderSuggestions(agg: unknown): string {
  if (isEmptyObject(agg)) return unavailable()
  const data = agg as {
    agents_md_additions?: Array<{ rule: string; rationale: string; why_now: string }>
    features_to_try?: Array<{ feature: string; one_liner: string; why_for_you: string; example: string }>
    workflow_patterns?: Array<{ pattern: string; benefit: string; how_to: string; copyable_prompt: string }>
  }

  let out = ""

  if (data.agents_md_additions?.length) {
    out += `<h3>AGENTS.md Additions</h3>`
    out += data.agents_md_additions.map(s => `
      <div class="card" style="margin:8px 0">
        <strong>${esc(s.rule)}</strong>
        <p style="margin:4px 0">${esc(s.rationale)}</p>
        <span class="muted">${esc(s.why_now)}</span>
      </div>`).join("")
  }

  if (data.features_to_try?.length) {
    out += `<h3>Features to Try</h3>`
    out += data.features_to_try.map(f => `
      <div class="card" style="margin:8px 0">
        <strong>${esc(f.feature)}</strong> — ${esc(f.one_liner)}
        <p style="margin:4px 0">${esc(f.why_for_you)}</p>
        <pre>${esc(f.example)}</pre>
      </div>`).join("")
  }

  if (data.workflow_patterns?.length) {
    out += `<h3>Workflow Patterns</h3>`
    out += data.workflow_patterns.map(w => `
      <div class="card" style="margin:8px 0">
        <strong>${esc(w.pattern)}</strong> — ${esc(w.benefit)}
        <p style="margin:4px 0">${esc(w.how_to)}</p>
        <pre>${esc(w.copyable_prompt)}</pre>
      </div>`).join("")
  }

  return out || unavailable()
}

function renderHorizon(agg: unknown): string {
  if (isEmptyObject(agg)) return unavailable()
  const data = agg as Record<string, unknown>
  return Object.entries(data).map(([k, v]) =>
    `<p><strong>${esc(k.replace(/_/g, " "))}:</strong> ${esc(typeof v === "object" ? JSON.stringify(v) : v)}</p>`
  ).join("")
}

const CSS = `
:root{
  --ivory:#FAF9F5;
  --paper:#FFFFFF;
  --g100:#F0EEE6;
  --g200:#E6E3DA;
  --g300:#D1CFC5;
  --g500:#87867F;
  --g700:#3D3D3A;
  --slate:#141413;
  --clay:#D97757;
  --clay-d:#B85C3E;
  --rust:#B04A3F;
  --olive:#788C5D;
  --oat:#E3DACC;
  --serif:ui-serif,Georgia,"Times New Roman",Times,serif;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Monaco,Consolas,monospace;
  --radius-panel:12px;
  --radius-row:8px;
  --border:1.5px solid var(--g300);
}
*{box-sizing:border-box}
body{margin:0;padding:56px 24px 120px;background:var(--ivory);color:var(--slate);font-family:var(--sans);font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:920px;margin:0 auto}
h1{font-family:var(--serif);font-weight:500;font-size:36px;letter-spacing:-.01em;line-height:1.2;margin:0 0 18px}
h2{font-family:var(--serif);font-weight:500;font-size:24px;letter-spacing:-.01em;margin:28px 0 6px}
h3{font-family:var(--serif);font-weight:500;font-size:18px;margin:20px 0 4px}
a{color:var(--clay);text-decoration:none}
a:hover{color:var(--clay-d);text-decoration:underline}
code,pre{font-family:var(--mono);background:var(--g100);border-radius:6px}
code{padding:1px 5px;font-size:.86em}
pre{padding:12px 14px;overflow:auto;border:var(--border);white-space:pre-wrap;word-break:break-word}
.panel,.card{background:var(--paper);border:var(--border);border-radius:var(--radius-panel);padding:18px}
.muted{color:var(--g500)}
button{font:inherit;cursor:pointer;border:var(--border);background:var(--paper);color:var(--slate);border-radius:9px;padding:8px 14px}
button.primary{background:var(--clay);border-color:var(--clay);color:var(--paper);font-weight:600}
button:hover{filter:brightness(.98)}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}
.stat{background:var(--paper);border:var(--border);border-radius:var(--radius-row);padding:12px 16px}
.stat-label{font-size:12px;color:var(--g500);text-transform:uppercase;letter-spacing:.06em}
.stat-value{font-size:22px;font-weight:600;color:var(--slate);font-family:var(--mono)}
.at-a-glance{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}
.glance-item{background:var(--paper);border:var(--border);border-radius:var(--radius-panel);padding:16px}
.glance-label{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--clay);margin-bottom:8px}
.friction-item{border-left:3px solid var(--rust);padding-left:12px;margin:8px 0}
.suggestion-item pre{margin:8px 0;font-size:13px}
.tag{display:inline-block;background:var(--g100);border:var(--border);border-radius:4px;padding:2px 8px;font-size:12px;margin:2px}
`

export function generateReport(data: ReportData, insightsJson: string): string {
  const { stats, aggregates, atAGlance } = data
  const topAgent = stats.topAgents[0]?.agent ?? "—"
  const dateFrom = fmtDate(stats.dateRange.from)
  const dateTo = fmtDate(stats.dateRange.to)

  // Safe JSON island: prevent </script> from closing the tag early
  const safeJson = insightsJson.replace(/<\/script>/gi, "<\\/script>")

  const glance = (key: string, label: string) => {
    const val = atAGlance[key]
    const content = val != null ? esc(val) : `<span class="muted">(analysis unavailable)</span>`
    return `
      <div class="glance-item">
        <div class="glance-label">${label}</div>
        <div>${content}</div>
      </div>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenCode Insights</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <h1>OpenCode Insights</h1>
  <p class="muted">${esc(dateFrom)} – ${esc(dateTo)}</p>

  <div class="stats-grid">
    <div class="stat">
      <div class="stat-label">Sessions</div>
      <div class="stat-value">${esc(stats.totalSessions)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Tokens</div>
      <div class="stat-value">${esc(fmtTokens(stats.totalTokens))}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total Cost</div>
      <div class="stat-value">${esc(fmtCost(stats.totalCost))}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Top Agent</div>
      <div class="stat-value">${esc(topAgent)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Date Range</div>
      <div class="stat-value" style="font-size:14px">${esc(dateFrom)} – ${esc(dateTo)}</div>
    </div>
  </div>

  <button class="primary" onclick="exportJson()">Export insights.json</button>

  <h2>At a Glance</h2>
  <div class="at-a-glance">
    ${glance("whats_working", "What's Working")}
    ${glance("whats_hindering", "What's Hindering")}
    ${glance("quick_wins", "Quick Wins")}
    ${glance("ambitious_workflows", "Ambitious Workflows")}
  </div>

  <h2>Project Areas</h2>
  <div class="panel">${renderProjectAreas(aggregates.project_areas)}</div>

  <h2>Interaction Style</h2>
  <div class="panel">${renderInteractionStyle(aggregates.interaction_style)}</div>

  <h2>Agent Performance</h2>
  <div class="panel">${renderAgentPerformance(aggregates.agent_performance)}</div>

  <h2>Friction</h2>
  <div class="panel">${renderFriction(aggregates.friction)}</div>

  <h2>Tool Health</h2>
  <div class="panel">${renderToolHealth(aggregates.tool_health)}</div>

  <h2>Suggestions</h2>
  <div class="panel">${renderSuggestions(aggregates.suggestions)}</div>

  <h2>Horizon</h2>
  <div class="panel">${renderHorizon(aggregates.horizon)}</div>
</div>

<script type="application/json" id="insights-data">${safeJson}</script>
<script>
function exportJson() {
  const data = document.getElementById('insights-data').textContent;
  const blob = new Blob([data], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'insights.json';
  a.click();
}
</script>
</body>
</html>`
}
