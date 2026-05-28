"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import { useTheme } from "@/context/ThemeContext"
import { useProject } from "@/components/project/ProjectContext"
import ProjectPageShell from "@/components/project/ProjectPageShell"
import { analyze } from "@/api/ai"
import {
  Send, Loader2, Sparkles, User, Database,
  ChevronDown, Copy, Check, Code2, ChevronRight,
  BarChart3, Table2, TrendingUp, AlertCircle,
  PieChart as PieIcon, LineChart as LineIcon, Zap,
} from "lucide-react"
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart as RPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

// ─── TYPES ───────────────────────────────────────────────
type ChartKind = "bar" | "line" | "area" | "pie" | "none"

interface AiResult {
  text:   string
  sql?:   string
  rows?:  any[]
  chart:  ChartKind
  xKey?:  string
  yKey?:  string
  error?: string
}

interface Message {
  role:    "user" | "ai"
  text:    string
  result?: AiResult
  ts:      Date
}

function extractRowsFromPayload(payload: any): any[] | undefined {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.result?.rows)) return payload.result.rows
  if (Array.isArray(payload?.analysis?.rows)) return payload.analysis.rows
  return undefined
}

function looksLikePipeTableLine(line: string) {
  const trimmed = line.trim()
  if (!trimmed) return false
  const pipeCount = (trimmed.match(/\|/g) ?? []).length
  return pipeCount >= 2 && (trimmed.includes(" | ") || trimmed.startsWith("|") || trimmed.endsWith("|"))
}

function splitPipeCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map(cell => cell.trim())
}

function isMarkdownSeparator(cells: string[]) {
  return cells.length > 0 && cells.every(cell => /^:?-{2,}:?$/.test(cell.replace(/\s/g, "")))
}

function uniqueColumnNames(cols: string[]) {
  const seen = new Map<string, number>()
  return cols.map((raw, index) => {
    const base = (raw || `column_${index + 1}`).trim() || `column_${index + 1}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count ? `${base}_${count + 1}` : base
  })
}

function rowsFromPipeTable(text: string): any[] | undefined {
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (!looksLikePipeTableLine(lines[i])) continue

    const block: string[] = []
    for (let j = i; j < lines.length && looksLikePipeTableLine(lines[j]); j++) {
      block.push(lines[j])
    }

    if (block.length < 2) {
      i += block.length
      continue
    }

    const first = splitPipeCells(block[0])
    const second = splitPipeCells(block[1])
    if (!isMarkdownSeparator(second) || first.length < 2) {
      i += block.length
      continue
    }

    const cols = uniqueColumnNames(first)
    const rows = block.slice(2)
      .map(line => splitPipeCells(line))
      .filter(cells => cells.length === cols.length && !isMarkdownSeparator(cells))
      .map(cells => Object.fromEntries(cols.map((col, idx) => [col, cells[idx]])))

    if (rows.length) return rows
    i += block.length
  }
  return undefined
}

function cleanAnswerText(text: string, rows?: any[]) {
  const withoutCode = text
    .replace(/```sql[\s\S]*?```/gi, "")
    .replace(/```[\s\S]*?```/g, "")

  const cleaned = withoutCode
    .split(/\r?\n/)
    .filter(line => !looksLikePipeTableLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (cleaned) return cleaned
  if (rows?.length) return `Found ${rows.length} row${rows.length !== 1 ? "s" : ""}.`
  return ""
}

// ─── PARSE /analyze RESPONSE ─────────────────────────────
/*
  LangChain message chain shape:
  {
    analysis: {
      messages: [
        { type:"human",  content:"user question" },
        { type:"ai",     tool_calls:[{ name:"SparkSQLExecutor", args:{ __arg1:"SELECT ..." } }] },
        { type:"tool",   content:"[{...rows}]" | "{\"error\":\"...\"}" },
        { type:"ai",     content:"Here is what I found …"  (no tool_calls) }
      ]
    }
  }
*/
function parseAnalyzeResponse(res: any): AiResult {
  const msgs: any[] = res?.analysis?.messages ?? []

  // 1 — SQL from tool-call message
  let sql: string | undefined
  for (const m of msgs) {
    if (m.type === "ai" && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      const args = m.tool_calls[0]?.args ?? {}
      sql = args.__arg1 || args.query || args.sql
      if (sql) break
    }
  }

  // 2 — Rows / error from tool-result message
  let rows: any[] | undefined = extractRowsFromPayload(res)
  let toolError: string | undefined
  for (const m of msgs) {
    if (m.type === "tool") {
      const raw = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "")
      try {
        const p = JSON.parse(raw)
        const parsedRows = extractRowsFromPayload(p)
        if (parsedRows)                               { rows = parsedRows; break }
        if (typeof p?.error === "string")             { toolError = p.error; break }
      } catch { /* not JSON */ }
    }
  }

  // 3 — Final natural-language answer from last AI message with no tool_calls
  let text = ""
  const finalMsgs = msgs.filter(
    (m: any) => m.type === "ai" && (!m.tool_calls || m.tool_calls.length === 0)
  )
  const last = finalMsgs[finalMsgs.length - 1]
  if (last) {
    const raw = last.content
    if (typeof raw === "string") {
      text = raw
    } else if (Array.isArray(raw)) {
      text = raw.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
    }
  }

  if (!rows?.length) rows = rowsFromPipeTable(text)
  text = cleanAnswerText(text, rows)

  // Fallbacks
  if (!text && toolError)  text = `Query returned an error: ${toolError}`
  if (!text && rows?.length) text = `Found ${rows.length} row${rows.length !== 1 ? "s" : ""}.`
  if (!text)                 text = "I wasn't able to generate an answer for that."

  // 4 — Auto-detect best chart type
  const chart = autoChart(rows, sql, text)
  const { xKey, yKey } = autoAxes(rows)

  return { text, sql, rows: rows?.length ? rows : undefined, chart, xKey, yKey, error: toolError }
}

function autoChart(rows?: any[], sql?: string, text?: string): ChartKind {
  if (!rows || rows.length < 2) return "none"
  const keys = Object.keys(rows[0])
  if (keys.length < 2) return "none"

  const q = (sql ?? "").toLowerCase()
  const t = (text ?? "").toLowerCase()
  const chartIntent = /chart|graph|plot|visual|trend|over time|by |group by|count\(|sum\(|avg\(|min\(|max\(/i.test(t + " " + q)

  // Wide result sets are usually raw records. Rendering a chart for those tends to
  // pick an arbitrary numeric field and creates misleading visual noise.
  if (keys.length > 4 && !chartIntent) return "none"

  // Pie: exactly 2 cols, all values numeric, ≤ 12 rows
  if (keys.length === 2 && rows.length <= 12) {
    const allNum = rows.every(r => !isNaN(Number(r[keys[1]])) && r[keys[1]] !== "")
    if (allNum) return "pie"
  }

  // Time-series → line
  if (/month|year|date|day|week|quarter|hour|period/i.test(keys[0]) || /group by.*(month|year|date)/i.test(q)) return "line"

  // Trend language → area
  if (/trend|over time|growth|increase|decrease|change over/i.test(t + q)) return "area"

  // Default bar for categorical × numeric
  return "bar"
}

function autoAxes(rows?: any[]): { xKey?: string; yKey?: string } {
  if (!rows?.length) return {}
  const keys = Object.keys(rows[0])
  if (keys.length < 2) return { xKey: keys[0] }
  // x = first non-numeric, y = first numeric
  const xKey = keys.find(k => isNaN(Number(rows[0][k])) || rows[0][k] === "") ?? keys[0]
  const yKey = keys.find(k => k !== xKey && !isNaN(Number(rows[0][k])) && rows[0][k] !== "") ?? keys[1]
  return { xKey, yKey }
}

// ─── CHART ───────────────────────────────────────────────
const COLORS = ["#7c6bff","#34d399","#f59e0b","#ef4444","#3b82f6","#ec4899","#a78bfa","#10b981","#f97316","#06b6d4"]

function ResultChart({ result, dark, accent }: { result: AiResult; dark: boolean; accent: string }) {
  const { rows, chart, xKey, yKey } = result
  if (!rows?.length || chart === "none" || !xKey || !yKey) return null

  const tc  = dark ? "rgba(240,240,248,0.4)"  : "rgba(15,15,26,0.42)"
  const gc  = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"
  const tbg = dark ? "#1c1c2a" : "#fff"
  const tb  = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"

  const data = rows.map(r => ({ ...r, [yKey]: Number(r[yKey]) }))
  const h    = Math.min(Math.max(rows.length * 18 + 60, 200), 300)
  const tilt = rows.length > 8

  const axis = {
    tick: { fill: tc, fontSize: tilt ? 10 : 11, fontFamily: "'Geist', sans-serif" },
    axisLine: { stroke: gc }, tickLine: false as const,
  }
  const tip = {
    contentStyle: { background: tbg, border: `1px solid ${tb}`, borderRadius: 10, fontSize: 12, fontFamily: "'Geist', sans-serif" },
    labelStyle: { color: dark ? "#f0f0f8" : "#0f0f1a", fontWeight: 600, marginBottom: 2 },
    cursor: { fill: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" },
  }

  const ChartIcon = chart === "pie" ? PieIcon : chart === "line" ? LineIcon : chart === "area" ? TrendingUp : BarChart3

  return (
    <div style={{ marginTop: 12, background: dark ? "#0d0d14" : "#f6f6fa", border: `1px solid ${dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.07)"}`, borderRadius: 12, overflow: "hidden" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px 6px", borderBottom: `1px solid ${dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.05)"}` }}>
        <ChartIcon size={12} color={accent} />
        <span style={{ fontSize: 11, fontWeight: 700, color: tc, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {chart} · {xKey} × {yKey}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: tc, fontFamily: "'Geist Mono',monospace" }}>{rows.length} rows</span>
      </div>

      <div style={{ padding: "8px 6px 4px" }}>
        <ResponsiveContainer width="100%" height={h}>
          {chart === "pie" ? (
            <RPieChart>
              <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius="68%"
                label={({ name, percent }: any) => `${String(name).slice(0,16)} ${(percent*100).toFixed(0)}%`}
                labelLine={{ stroke: tc, strokeWidth: 0.7 }} fontSize={11}
              >
                {data.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tip} />
            </RPieChart>
          ) : chart === "area" ? (
            <AreaChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: tilt ? 48 : 16 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gc} />
              <XAxis dataKey={xKey} {...axis} angle={tilt ? -35 : 0} textAnchor={tilt ? "end" : "middle"} interval="preserveStartEnd" />
              <YAxis {...axis} />
              <Tooltip {...tip} />
              <Area type="monotone" dataKey={yKey} stroke={accent} strokeWidth={2.5} fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, fill: accent }} />
            </AreaChart>
          ) : chart === "line" ? (
            <LineChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: tilt ? 48 : 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gc} />
              <XAxis dataKey={xKey} {...axis} angle={tilt ? -35 : 0} textAnchor={tilt ? "end" : "middle"} interval="preserveStartEnd" />
              <YAxis {...axis} />
              <Tooltip {...tip} />
              <Line type="monotone" dataKey={yKey} stroke={accent} strokeWidth={2.5} dot={{ fill: accent, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: tilt ? 52 : 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gc} />
              <XAxis dataKey={xKey} {...axis} angle={tilt ? -40 : 0} textAnchor={tilt ? "end" : "middle"} interval={0} />
              <YAxis {...axis} />
              <Tooltip {...tip} />
              <Bar dataKey={yKey} fill={accent} radius={[4, 4, 0, 0]}
                background={{ fill: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"}}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── TABLE ───────────────────────────────────────────────
function ResultTable({ rows, dark, accent, border, textMain, textSub }: {
  rows: any[]; dark: boolean; accent: string; border: string; textMain: string; textSub: string
}) {
  const [expanded, setExpanded] = useState(false)
  const cols    = Object.keys(rows[0])
  const display = expanded ? rows : rows.slice(0, 10)

  return (
    <div style={{ marginTop: 10, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontFamily: "'Geist', sans-serif" }}>
          <thead>
            <tr style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>
              {cols.map(c => (
                <th key={c} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: textSub, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", borderBottom: `1px solid ${border}` }}>
                  {c.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {display.map((row, i) => (
              <tr key={i}
                style={{ borderBottom: i < display.length - 1 ? `1px solid ${border}` : "none", transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {cols.map(c => {
                  const v = row[c]
                  const isNum = v !== null && v !== "" && !isNaN(Number(v))
                  return (
                    <td key={c} style={{ padding: "7px 12px", color: isNum ? accent : (dark ? "rgba(240,240,248,0.8)" : "rgba(15,15,26,0.8)"), whiteSpace: "nowrap", fontFamily: isNum ? "'Geist Mono',monospace" : "inherit", fontWeight: isNum ? 500 : 400 }}>
                      {isNum ? Number(v).toLocaleString() : String(v ?? "—")}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <button onClick={() => setExpanded(p => !p)}
          style={{ width: "100%", padding: "8px 12px", background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: "none", borderTop: `1px solid ${border}`, cursor: "pointer", fontSize: 12, color: accent, fontFamily: "'Geist', sans-serif", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)")}
          onMouseLeave={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)")}
        >
          {expanded ? "Show less ↑" : `Show all ${rows.length} rows`}
          <ChevronDown size={12} style={{ transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0)" }} />
        </button>
      )}
    </div>
  )
}

// ─── MARKDOWN ────────────────────────────────────────────
function Md({ text, dark, accent, textMain, textSub }: { text: string; dark: boolean; accent: string; textMain: string; textSub: string }) {
  const html = useMemo(() => text
    .replace(/^### (.+)$/gm, `<h4 style="font-size:13px;font-weight:700;color:${textMain};margin:8px 0 3px">$1</h4>`)
    .replace(/^## (.+)$/gm,  `<h3 style="font-size:14px;font-weight:700;color:${textMain};margin:10px 0 4px">$1</h3>`)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="font-weight:700;color:${textMain}">$1</strong>`)
    .replace(/\*(.+?)\*/g,     `<em>$1</em>`)
    .replace(/`([^`\n]+)`/g,   `<code style="font-family:'Geist Mono',monospace;background:${dark?"rgba(124,107,255,0.12)":"rgba(0,0,0,0.07)"};color:${accent};padding:1px 6px;border-radius:4px;font-size:0.88em">$1</code>`)
    .replace(/^[•\-\*] (.+)$/gm, `<div style="display:flex;gap:7px;margin:2px 0"><span style="color:${accent};flex-shrink:0;margin-top:1px">▸</span><span>$1</span></div>`)
    .replace(/^(\d+)\. (.+)$/gm, `<div style="display:flex;gap:7px;margin:2px 0"><span style="color:${accent};font-family:'Geist Mono',monospace;font-size:0.85em;min-width:16px">$1.</span><span>$2</span></div>`)
    .replace(/\n\n/g, `<div style="height:7px"></div>`)
    .replace(/\n/g, "<br/>")
  , [text, dark, accent, textMain])

  return (
    <div style={{ fontSize: 13.5, lineHeight: 1.72, color: dark ? "rgba(240,240,248,0.88)" : "rgba(15,15,26,0.88)" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────
export default function AIChatPage() {
  const params    = useParams()
  const projectId = Number(params.id)
  const { effective, accentColor } = useTheme()
  const { project } = useProject()
  const dark = effective === "dark"

  const accent   = accentColor
  const surface  = dark ? "#13131e" : "#ffffff"
  const border   = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"
  const textMain = dark ? "#f0f0f8" : "#0f0f1a"
  const textSub  = dark ? "rgba(240,240,248,0.4)" : "rgba(15,15,26,0.45)"
  const inputBg  = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"

  const [messages, setMessages] = useState<Message[]>([{
    role: "ai",
    text: "Hi! I'm your AI data analyst. Select a dataset and ask anything — I'll run SQL queries, build charts, and explain results.",
    ts: new Date(),
  }])
  const [input,   setInput]   = useState("")
  const [loading, setLoading] = useState(false)
  const [dataset, setDataset] = useState("")
  const [sqlOpen, setSqlOpen] = useState<Record<number, boolean>>({})
  const [copied,  setCopied]  = useState<number | null>(null)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const datasets = project?.datasets ?? []

  useEffect(() => {
    if (!dataset && datasets.length) {
      const ready = datasets.find(d => d.status === "ready") || datasets[0]
      if (ready) setDataset(ready.name)
    }
  }, [datasets])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 120) + "px"
  }, [input])

  async function handleSend() {
    if (!input.trim() || loading || !dataset) return
    const q = input.trim()
    setInput("")
    setMessages(p => [...p, { role: "user", text: q, ts: new Date() }])
    setLoading(true)
    try {
      const res    = await analyze.post({ project_id: projectId, dataset, query: q })
      const result = parseAnalyzeResponse(res)
      setMessages(p => [...p, { role: "ai", text: result.text, result, ts: new Date() }])
    } catch (err: any) {
      setMessages(p => [...p, {
        role: "ai",
        text: "Sorry, something went wrong connecting to the analysis engine. Please try again.",
        result: { text: "", chart: "none", error: err.message },
        ts: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  const prompts = [
    "How many rows are in this dataset?",
    "Show me the top 10 records",
    "What are all the column names?",
    "Show average values grouped by category",
    "Which rows have the highest values?",
    "Give me a statistical summary",
  ]

  return (
    <ProjectPageShell projectId={projectId} section="AI Chat">
      <style>{`
        @keyframes bounce {
          0%,80%,100%{ transform:translateY(0); opacity:.55; }
          40%         { transform:translateY(-5px); opacity:1; }
        }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { from{transform:rotate(0)} to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 240px)", minHeight: 480 }}>

        {/* ── Dataset bar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "9px 14px", background: surface, border: `1px solid ${border}`, borderRadius: 12, flexWrap: "wrap" }}>
          <Database size={13} color={accent} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: textSub }}>Dataset</span>
          <div style={{ position: "relative", flex: 1, minWidth: 160, maxWidth: 300 }}>
            <select value={dataset} onChange={e => setDataset(e.target.value)}
              style={{ width: "100%", appearance: "none", padding: "5px 28px 5px 10px", borderRadius: 8, border: `1px solid ${border}`, background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", color: textMain, fontSize: 13, fontFamily: "'Geist',sans-serif", cursor: "pointer", outline: "none" }}
            >
              {!datasets.length && <option value="">No datasets</option>}
              {datasets.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: textSub }} />
          </div>
          {dataset && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", background: `${accent}14`, border: `1px solid ${accent}28`, borderRadius: 20, fontSize: 11, fontWeight: 600, color: accent }}>
              <Zap size={10} /> Active
            </span>
          )}
        </div>

        {/* ── Messages ── */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, paddingBottom: 10, paddingRight: 2, scrollbarWidth: "thin", scrollbarColor: `${accent}20 transparent` }}>

          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start", animation: "fadeUp 0.22s ease" }}>

              {/* Avatar */}
              <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: m.role === "ai" ? `${accent}18` : dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", border: `1px solid ${m.role === "ai" ? `${accent}30` : border}`, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                {m.role === "ai" ? <Sparkles size={14} color={accent} /> : <User size={14} color={textSub} />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>

                {/* ── USER ── */}
                {m.role === "user" && (
                  <div>
                    {dataset && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: textSub, background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", padding: "2px 7px", borderRadius: 4, marginBottom: 5, fontFamily: "'Geist Mono',monospace" }}>
                        <Database size={9} />{dataset}
                      </div>
                    )}
                    <div style={{ background: `${accent}14`, border: `1px solid ${accent}28`, borderRadius: "4px 12px 12px 12px", padding: "10px 14px", display: "inline-block", maxWidth: "85%" }}>
                      <p style={{ fontSize: 13.5, color: textMain, margin: 0, lineHeight: 1.65 }}>{m.text}</p>
                    </div>
                  </div>
                )}

                {/* ── AI ── */}
                {m.role === "ai" && (
                  <div>
                    {/* Text answer */}
                    <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: "4px 12px 12px 12px", padding: "12px 16px" }}>
                      <Md text={m.text} dark={dark} accent={accent} textMain={textMain} textSub={textSub} />
                    </div>

                    {/* Error */}
                    {m.result?.error && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 8, padding: "8px 12px", background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 9 }}>
                        <AlertCircle size={13} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: 12, color: "#f87171", fontFamily: "'Geist Mono',monospace", lineHeight: 1.5 }}>
                          {m.result.error.slice(0, 220)}
                        </span>
                      </div>
                    )}

                    {/* SQL */}
                    {m.result?.sql && (
                      <div style={{ marginTop: 8 }}>
                        <button onClick={() => setSqlOpen(p => ({ ...p, [i]: !p[i] }))}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: textSub, background: "none", border: "none", cursor: "pointer", padding: "2px 0", marginBottom: 4, transition: "color 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.color = accent)}
                          onMouseLeave={e => (e.currentTarget.style.color = textSub)}
                        >
                          <Code2 size={12} /> SQL executed
                          <ChevronRight size={11} style={{ transition: "transform 0.15s", transform: sqlOpen[i] ? "rotate(90deg)" : "rotate(0)" }} />
                        </button>
                        {sqlOpen[i] && (
                          <div style={{ position: "relative", background: dark ? "#09090f" : "#f2f2f7", border: `1px solid ${border}`, borderRadius: 10, overflow: "hidden" }}>
                            <pre style={{ margin: 0, padding: "12px 14px", fontSize: 12.5, fontFamily: "'Geist Mono',monospace", color: accent, overflowX: "auto", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {m.result.sql}
                            </pre>
                            <button
                              onClick={() => { navigator.clipboard.writeText(m.result!.sql!); setCopied(i); setTimeout(() => setCopied(null), 1800) }}
                              style={{ position: "absolute", top: 8, right: 8, background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", border: `1px solid ${border}`, borderRadius: 7, padding: "4px 9px", cursor: "pointer", color: textSub, display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "'Geist',sans-serif" }}
                              onMouseEnter={e => (e.currentTarget as any).style.color = textMain}
                              onMouseLeave={e => (e.currentTarget as any).style.color = textSub}
                            >
                              {copied === i ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                              {copied === i ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chart */}
                    {m.result?.rows && m.result.chart !== "none" && m.result.xKey && m.result.yKey && (
                      <ResultChart result={m.result} dark={dark} accent={accent} />
                    )}

                    {/* Table */}
                    {m.result?.rows && m.result.rows.length > 0 && (
                      <ResultTable
                        rows={m.result.rows}
                        dark={dark} accent={accent}
                        border={border} textMain={textMain} textSub={textSub}
                      />
                    )}

                    {/* Footer */}
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: textSub }}>
                        {m.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {m.result?.rows && (
                        <>
                          <span style={{ fontSize: 10, color: textSub }}>·</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: textSub, background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", padding: "2px 8px", borderRadius: 20 }}>
                            <Table2 size={9} />{m.result.rows.length} rows
                          </span>
                          {m.result.chart !== "none" && (
                            <>
                              <span style={{ fontSize: 10, color: textSub }}>·</span>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: accent, fontWeight: 600, background: `${accent}10`, padding: "2px 8px", borderRadius: 20 }}>
                                <BarChart3 size={9} />{m.result.chart} chart
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}18`, border: `1px solid ${accent}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Sparkles size={14} color={accent} />
              </div>
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: "4px 12px 12px 12px", padding: "13px 18px", display: "flex", gap: 6, alignItems: "center" }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{ width: 7, height: 7, borderRadius: "50%", background: accent, animation: `bounce 1.2s ease ${j * 0.18}s infinite` }} />
                ))}
                <span style={{ fontSize: 12, color: textSub, marginLeft: 4 }}>Analysing…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Prompt chips ── */}
        {messages.length <= 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 8, marginBottom: 10 }}>
            {prompts.map(p => (
              <button key={p} onClick={() => setInput(p)}
                style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "none", color: textSub, fontFamily: "'Geist',sans-serif", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as any).style.borderColor = `${accent}50`; (e.currentTarget as any).style.color = accent }}
                onMouseLeave={e => { (e.currentTarget as any).style.borderColor = border; (e.currentTarget as any).style.color = textSub }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* ── Input bar ── */}
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 12, display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={textareaRef} rows={1}
            placeholder={dataset ? `Ask anything about ${dataset}…` : "Select a dataset to start…"}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            disabled={!dataset || loading}
            style={{ flex: 1, background: inputBg, border: `1px solid ${border}`, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontFamily: "'Geist',sans-serif", color: textMain, outline: "none", resize: "none", lineHeight: 1.5, maxHeight: 120, overflow: "auto", transition: "border-color 0.15s", opacity: !dataset ? 0.5 : 1 }}
            onFocus={e => (e.currentTarget.style.borderColor = `${accent}55`)}
            onBlur={e => (e.currentTarget.style.borderColor = border)}
          />
          <button onClick={handleSend} disabled={loading || !input.trim() || !dataset}
            style={{ width: 44, height: 44, borderRadius: 11, border: "none", background: `linear-gradient(135deg,${accent},#a78bfa)`, display: "flex", alignItems: "center", justifyContent: "center", cursor: loading || !input.trim() || !dataset ? "not-allowed" : "pointer", flexShrink: 0, opacity: loading || !input.trim() || !dataset ? 0.45 : 1, boxShadow: `0 3px 14px ${accent}45`, transition: "opacity 0.15s, transform 0.1s" }}
            onMouseEnter={e => { if (!loading && input.trim() && dataset) (e.currentTarget as any).style.transform = "scale(1.08)" }}
            onMouseLeave={e => { (e.currentTarget as any).style.transform = "scale(1)" }}
          >
            {loading
              ? <Loader2 size={16} color="white" style={{ animation: "spin 1s linear infinite" }} />
              : <Send size={16} color="white" />
            }
          </button>
        </div>

      </div>
    </ProjectPageShell>
  )
}
