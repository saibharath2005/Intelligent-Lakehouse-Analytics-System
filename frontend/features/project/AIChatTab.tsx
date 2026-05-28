"use client"

import { useState, useRef, useEffect } from "react"
import { useTheme } from "@/context/ThemeContext"
import { useToast } from "@/components/ui/ToastProvider"
import { analyze } from "@/api/ai"
import { getDatasets } from "@/api/project"
import type { Dataset } from "@/api/project"
import {
  Send, Loader2, Sparkles, User, ChevronDown,
  Database, Code2, AlertCircle, CheckCircle,
  Copy, Check, ChevronRight, Zap, Clock,
} from "lucide-react"

// ─── TYPES ───────────────────────────────────────────────

interface LCMessage {
  type: "human" | "ai" | "tool"
  content: string | string[]
  additional_kwargs?: {
    function_call?: { name: string; arguments: string }
  }
  response_metadata?: {
    model_name?: string
    finish_reason?: string
  }
  name?: string | null
  usage_metadata?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
  tool_calls?: { name: string; args: any }[]
}

interface AnalyzeResponse {
  project_id: number
  dataset: string
  query: string
  analysis: { messages: LCMessage[] }
}

interface ChatTurn {
  id: string
  userQuery: string
  dataset: string
  timestamp: Date
  status: "loading" | "done" | "error"
  messages: LCMessage[]          // raw LangChain messages
  finalAnswer: string[]          // extracted final AI content blocks
  sqlQuery?: string              // extracted SQL if present
  toolError?: string             // error from tool execution
  usage?: { input: number; output: number; total: number }
  model?: string
}

// ─── HELPERS ─────────────────────────────────────────────

/** Extract the last AI message's content as string array */
function extractFinalAnswer(messages: LCMessage[]): string[] {
  const aiMessages = messages.filter(m => m.type === "ai" && m.tool_calls?.length === 0)
  if (!aiMessages.length) return []
  const last = aiMessages[aiMessages.length - 1]
  if (Array.isArray(last.content)) return last.content.filter(c => typeof c === "string" && c.trim())
  if (typeof last.content === "string" && last.content.trim()) return [last.content]
  return []
}

/** Extract SQL query from tool calls or content code blocks */
function extractSQL(messages: LCMessage[]): string | undefined {
  // From tool call arguments
  for (const m of messages) {
    if (m.type === "ai" && m.additional_kwargs?.function_call) {
      try {
        const args = JSON.parse(m.additional_kwargs.function_call.arguments)
        const sql = args.__arg1 || args.query || args.sql
        if (sql) return sql.trim()
      } catch {}
    }
    if (m.type === "ai" && m.tool_calls?.length) {
      for (const tc of m.tool_calls) {
        const sql = tc.args.__arg1 || tc.args.query || tc.args.sql
        if (sql) return String(sql).trim()
      }
    }
  }
  // From content code blocks
  for (const m of messages) {
    const blocks = Array.isArray(m.content) ? m.content : [m.content]
    for (const block of blocks) {
      if (typeof block !== "string") continue
      const match = block.match(/```sql\n([\s\S]+?)```/)
      if (match) return match[1].trim()
    }
  }
  return undefined
}

/** Extract tool error if SparkSQL failed */
function extractToolError(messages: LCMessage[]): string | undefined {
  for (const m of messages) {
    if (m.type === "tool" && typeof m.content === "string") {
      try {
        const parsed = JSON.parse(m.content)
        if (parsed.error) {
          // Return just the first line of the Spark error — the rest is AST noise
          return parsed.error.split("\n")[0].trim()
        }
      } catch {}
    }
  }
  return undefined
}

/** Extract token usage from last AI message */
function extractUsage(messages: LCMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const u = messages[i].usage_metadata
    if (u) return { input: u.input_tokens, output: u.output_tokens, total: u.total_tokens }
  }
  return undefined
}

/** Extract model name */
function extractModel(messages: LCMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i].response_metadata?.model_name
    if (m) return m
  }
  return undefined
}

/** Render markdown-ish text: **bold**, `code`, and code blocks */
function renderContent(text: string, dark: boolean, accentColor: string) {
  // Split on ```...``` blocks
  const parts = text.split(/(```[\s\S]*?```)/g)
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const inner = part.replace(/^```(?:sql|python)?\n?/, "").replace(/```$/, "")
      return (
        <div key={i} style={{ background: dark ? "#0a0a10" : "#f4f3ff", border: `1px solid ${dark ? "rgba(124,107,255,0.2)" : "rgba(124,107,255,0.15)"}`, borderRadius: 8, padding: "10px 14px", fontFamily: "'Geist Mono',monospace", fontSize: 12.5, color: dark ? "#c4b8ff" : "#5b4de8", overflowX: "auto", margin: "8px 0", lineHeight: 1.65 }}>
          {inner}
        </div>
      )
    }
    // Inline formatting
    const segments = part.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    return (
      <span key={i}>
        {segments.map((seg, j) => {
          if (seg.startsWith("**") && seg.endsWith("**"))
            return <strong key={j} style={{ fontWeight: 600, color: dark ? "#f0f0f8" : "#0f0f1a" }}>{seg.slice(2,-2)}</strong>
          if (seg.startsWith("`") && seg.endsWith("`"))
            return <code key={j} style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, background: dark ? "rgba(124,107,255,0.15)" : "rgba(124,107,255,0.1)", color: dark ? "#c4b8ff" : "#5b4de8", padding: "1px 6px", borderRadius: 4 }}>{seg.slice(1,-1)}</code>
          return <span key={j}>{seg}</span>
        })}
      </span>
    )
  })
}

// ─── SQL BLOCK ───────────────────────────────────────────
function SQLBlock({ sql, dark, accentColor }: { sql: string; dark: boolean; accentColor: string }) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen]     = useState(true)

  const copy = () => {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div style={{ background: dark ? "#0a0a10" : "#f8f7ff", border: `1px solid ${dark ? "rgba(124,107,255,0.2)" : "rgba(124,107,255,0.15)"}`, borderRadius: 10, overflow: "hidden", margin: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: open ? `1px solid ${dark ? "rgba(124,107,255,0.12)" : "rgba(124,107,255,0.1)"}` : "none", cursor: "pointer" }} onClick={() => setOpen(p => !p)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Code2 size={13} color={accentColor} />
          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, fontWeight: 600, color: accentColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>Generated SQL</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={e => { e.stopPropagation(); copy() }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: dark ? "rgba(240,240,248,0.4)" : "rgba(15,15,26,0.4)", padding: "3px 7px", borderRadius: 5, transition: "all 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = accentColor)}
            onMouseLeave={e => (e.currentTarget.style.color = dark ? "rgba(240,240,248,0.4)" : "rgba(15,15,26,0.4)")}
          >
            {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
          </button>
          <ChevronRight size={13} color={dark ? "rgba(240,240,248,0.3)" : "rgba(15,15,26,0.3)"} style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
        </div>
      </div>
      {open && (
        <pre style={{ margin: 0, padding: "12px 14px", fontFamily: "'Geist Mono',monospace", fontSize: 12.5, color: dark ? "#c4b8ff" : "#5b4de8", overflowX: "auto", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
          {sql}
        </pre>
      )}
    </div>
  )
}

// ─── TOOL STEP BADGE ─────────────────────────────────────
function ToolStepBadge({ name, error, dark, accentColor }: { name: string; error?: string; dark: boolean; accentColor: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 10px", borderRadius: 8, background: error ? "rgba(248,113,113,0.08)" : `${accentColor}10`, border: `1px solid ${error ? "rgba(248,113,113,0.25)" : `${accentColor}25`}`, marginBottom: 8 }}>
      {error
        ? <AlertCircle size={12} color="#f87171" />
        : <CheckCircle size={12} color="#34d399" />
      }
      <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: error ? "#f87171" : "#34d399", fontWeight: 500 }}>
        {name} {error ? "— column not found, retrying" : "— executed"}
      </span>
    </div>
  )
}

// ─── CHAT TURN ───────────────────────────────────────────
function ChatTurnCard({ turn, dark, accentColor, surface, border, textMain, textSub }: {
  turn: ChatTurn; dark: boolean; accentColor: string
  surface: string; border: string; textMain: string; textSub: string
}) {
  const hasToolCall  = turn.messages.some(m => m.type === "ai" && (m.tool_calls?.length || m.additional_kwargs?.function_call))
  const toolName     = turn.messages.find(m => m.type === "ai" && m.additional_kwargs?.function_call)?.additional_kwargs?.function_call?.name
                    ?? turn.messages.find(m => m.type === "ai" && m.tool_calls?.length)?.tool_calls?.[0]?.name

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.3s ease both" }}>

      {/* ── USER BUBBLE ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ maxWidth: "75%", background: `${accentColor}18`, border: `1px solid ${accentColor}28`, borderRadius: "14px 14px 4px 14px", padding: "11px 15px" }}>
          <p style={{ fontSize: 14, color: textMain, margin: 0, lineHeight: 1.6 }}>{turn.userQuery}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 8px", background: `${accentColor}14`, borderRadius: 20, border: `1px solid ${accentColor}20` }}>
              <Database size={10} color={accentColor} />
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: accentColor }}>{turn.dataset}</span>
            </div>
            <span style={{ fontSize: 11, color: textSub }}>{turn.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 10, alignSelf: "flex-end" }}>
          <User size={13} color={textSub} />
        </div>
      </div>

      {/* ── AI RESPONSE ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: `${accentColor}18`, border: `1px solid ${accentColor}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={13} color={accentColor} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Loading state */}
          {turn.status === "loading" && (
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: "14px 14px 14px 4px", padding: "14px 16px", display: "flex", gap: 5, alignItems: "center" }}>
              <Loader2 size={13} color={accentColor} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: textSub }}>Analysing with Spark SQL…</span>
            </div>
          )}

          {/* Error */}
          {turn.status === "error" && (
            <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "14px 14px 14px 4px", padding: "14px 16px" }}>
              <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>Something went wrong. Please try again.</p>
            </div>
          )}

          {/* Done */}
          {turn.status === "done" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

              {/* Tool execution step */}
              {hasToolCall && toolName && (
                <ToolStepBadge name={toolName} error={turn.toolError} dark={dark} accentColor={accentColor} />
              )}

              {/* SQL block */}
              {turn.sqlQuery && (
                <SQLBlock sql={turn.sqlQuery} dark={dark} accentColor={accentColor} />
              )}

              {/* Final answer */}
              {turn.finalAnswer.length > 0 && (
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: "14px 14px 14px 4px", padding: "14px 16px" }}>
                  {turn.finalAnswer.map((block, i) => (
                    <div key={i} style={{ fontSize: 14, color: textMain, lineHeight: 1.75, marginBottom: i < turn.finalAnswer.length - 1 ? 12 : 0 }}>
                      {renderContent(block, dark, accentColor)}
                    </div>
                  ))}
                </div>
              )}

              {/* Metadata footer */}
              {(turn.usage || turn.model) && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 2 }}>
                  {turn.model && (
                    <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: textSub }}>
                      {turn.model}
                    </span>
                  )}
                  {turn.usage && (
                    <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: textSub }}>
                      {turn.usage.total} tokens
                    </span>
                  )}
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: dark ? "rgba(52,211,153,0.6)" : "rgba(15,122,90,0.7)", display: "flex", alignItems: "center", gap: 3 }}>
                    <CheckCircle size={9} /> done
                  </span>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────
export default function AIChatTab({ projectId }: { projectId: number }) {
  const { effective, accentColor } = useTheme()
  const dark   = effective === "dark"
  const toast  = useToast()

  const [turns, setTurns]           = useState<ChatTurn[]>([])
  const [input, setInput]           = useState("")
  const [sending, setSending]       = useState(false)
  const [datasets, setDatasets]     = useState<Dataset[]>([])
  const [selectedDs, setSelectedDs] = useState("")
  const [dsLoading, setDsLoading]   = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Shared theme tokens ──
  const surface   = dark ? "#13131e" : "#ffffff"
  const border    = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"
  const textMain  = dark ? "#f0f0f8" : "#0f0f1a"
  const textSub   = dark ? "rgba(240,240,248,0.38)" : "rgba(15,15,26,0.45)"
  const inputBg   = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"

  // Load datasets for selector
  useEffect(() => {
    const load = async () => {
      setDsLoading(true)
      try {
        const data = await getDatasets(projectId)
        const list = Array.isArray(data) ? data : []
        setDatasets(list)
        if (list.length > 0) setSelectedDs(list[0].name)
      } catch {
        setDatasets([])
      } finally {
        setDsLoading(false)
      }
    }
    load()
  }, [projectId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [turns])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px"
    }
  }, [input])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    if (!selectedDs) { toast.error("Select a dataset first"); return }

    const userQuery = input.trim()
    setInput("")

    const turnId = Date.now().toString()
    const newTurn: ChatTurn = {
      id: turnId,
      userQuery,
      dataset: selectedDs,
      timestamp: new Date(),
      status: "loading",
      messages: [],
      finalAnswer: [],
    }

    setTurns(p => [...p, newTurn])
    setSending(true)

    try {
      const res: AnalyzeResponse = await analyze.post({
        project_id: projectId,
        dataset: selectedDs,
        query: userQuery,
      })

      const msgs = res.analysis?.messages ?? []

      setTurns(p => p.map(t => t.id === turnId ? {
        ...t,
        status: "done",
        messages: msgs,
        finalAnswer: extractFinalAnswer(msgs),
        sqlQuery: extractSQL(msgs),
        toolError: extractToolError(msgs),
        usage: extractUsage(msgs),
        model: extractModel(msgs),
      } : t))

    } catch (err: any) {
      setTurns(p => p.map(t => t.id === turnId ? { ...t, status: "error" } : t))
      toast.error("Analysis failed: " + (err.message ?? "Unknown error"))
    } finally {
      setSending(false)
    }
  }

  const prompts = [
    "What is the trend over time?",
    "Which airline has the most delays?",
    "Show average arrival delay by month",
    "What are the top 5 busiest routes?",
    "Compare cancellation rates by carrier",
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .ai-textarea:focus { border-color: ${accentColor}80 !important; box-shadow: 0 0 0 3px ${accentColor}12 !important; }
        .ai-textarea::placeholder { color: ${dark ? "rgba(240,240,248,0.22)" : "rgba(15,15,26,0.28)"}; }
        .ai-ds-select:focus { border-color: ${accentColor}80 !important; }
        .prompt-chip:hover { border-color: ${accentColor}55 !important; color: ${accentColor} !important; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 280px)", minHeight: 520, fontFamily: "'Geist',sans-serif" }}>

        {/* ── DATASET SELECTOR BAR ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0 16px", borderBottom: `1px solid ${border}`, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Database size={14} color={accentColor} />
            <span style={{ fontSize: 12, fontWeight: 600, color: textSub, textTransform: "uppercase", letterSpacing: "0.06em" }}>Dataset</span>
          </div>

          {dsLoading ? (
            <div style={{ height: 32, width: 180, borderRadius: 8, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", animation: "pulse 1.8s ease-in-out infinite" }} />
          ) : datasets.length === 0 ? (
            <span style={{ fontSize: 13, color: "#f87171", display: "flex", alignItems: "center", gap: 5 }}>
              <AlertCircle size={13} /> No datasets — upload one in the Datasets tab
            </span>
          ) : (
            <div style={{ position: "relative" }}>
              <select
                className="ai-ds-select"
                value={selectedDs}
                onChange={e => setSelectedDs(e.target.value)}
                style={{ appearance: "none", background: inputBg, border: `1px solid ${border}`, borderRadius: 9, padding: "7px 32px 7px 12px", fontSize: 13, fontFamily: "'Geist Mono',monospace", color: textMain, outline: "none", cursor: "pointer", transition: "border-color 0.15s", minWidth: 200 }}
              >
                {datasets.map(ds => (
                  <option key={ds.id} value={ds.name} style={{ background: dark ? "#13131e" : "#fff" }}>
                    {ds.name}
                    {ds.status !== "ready" ? ` (${ds.status})` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: textSub }} />
            </div>
          )}

          {turns.length > 0 && (
            <span style={{ marginLeft: "auto", fontSize: 11, color: textSub, display: "flex", alignItems: "center", gap: 5, fontFamily: "'Geist Mono',monospace" }}>
              <Clock size={11} /> {turns.length} quer{turns.length === 1 ? "y" : "ies"} this session
            </span>
          )}
        </div>

        {/* ── MESSAGES ── */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 28, paddingBottom: 8, scrollbarWidth: "thin", scrollbarColor: `${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} transparent` }}>

          {/* Empty / welcome state */}
          {turns.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center", padding: "32px 24px" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: `${accentColor}18`, border: `1px solid ${accentColor}28`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                <Zap size={24} color={accentColor} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: textMain, margin: "0 0 8px", letterSpacing: "-0.2px" }}>Ask your data anything</h3>
              <p style={{ fontSize: 14, color: textSub, margin: "0 0 28px", maxWidth: 340, lineHeight: 1.65 }}>
                The AI analyst converts your question into Spark SQL, runs it against your dataset, and explains the results.
              </p>
              {/* Prompt chips */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 540 }}>
                {prompts.map(p => (
                  <button key={p} className="prompt-chip" onClick={() => setInput(p)}
                    style={{ fontSize: 12, padding: "7px 13px", borderRadius: 20, border: `1px solid ${border}`, background: "none", color: textSub, fontFamily: "'Geist',sans-serif", cursor: "pointer", transition: "all 0.15s" }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat turns */}
          {turns.map(turn => (
            <ChatTurnCard
              key={turn.id}
              turn={turn}
              dark={dark}
              accentColor={accentColor}
              surface={surface}
              border={border}
              textMain={textMain}
              textSub={textSub}
            />
          ))}

          <div ref={bottomRef} />
        </div>

        {/* ── INPUT BAR ── */}
        <div style={{ paddingTop: 16, borderTop: `1px solid ${border}`, marginTop: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              ref={textareaRef}
              className="ai-textarea"
              rows={1}
              placeholder={selectedDs ? `Ask about ${selectedDs}…` : "Select a dataset above to begin…"}
              value={input}
              disabled={!selectedDs || sending}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              style={{
                flex: 1, background: inputBg,
                border: `1px solid ${border}`,
                borderRadius: 12, padding: "11px 14px",
                fontSize: 14, fontFamily: "'Geist',sans-serif",
                color: textMain, outline: "none", resize: "none",
                lineHeight: 1.55, transition: "border-color 0.15s, box-shadow 0.15s",
                overflowY: "hidden",
                opacity: !selectedDs ? 0.5 : 1,
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim() || !selectedDs}
              style={{
                width: 44, height: 44, borderRadius: 12, border: "none",
                background: `linear-gradient(135deg,${accentColor},#a78bfa)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: sending || !input.trim() || !selectedDs ? "not-allowed" : "pointer",
                flexShrink: 0,
                opacity: sending || !input.trim() || !selectedDs ? 0.45 : 1,
                transition: "opacity 0.15s, transform 0.15s",
                boxShadow: `0 3px 14px ${accentColor}40`,
              }}
              onMouseEnter={e => { if (!sending && input.trim() && selectedDs) (e.currentTarget as any).style.transform = "scale(1.06)" }}
              onMouseLeave={e => { (e.currentTarget as any).style.transform = "scale(1)" }}
            >
              {sending
                ? <Loader2 size={17} color="white" style={{ animation: "spin 1s linear infinite" }} />
                : <Send size={17} color="white" />
              }
            </button>
          </div>
          <p style={{ fontSize: 11, color: textSub, marginTop: 8, textAlign: "center", fontFamily: "'Geist Mono',monospace" }}>
            Enter to send · Shift+Enter for new line · Results powered by Spark SQL + {extractModel(turns.flatMap(t => t.messages)) ?? "Gemini"}
          </p>
        </div>

      </div>
    </>
  )
}
