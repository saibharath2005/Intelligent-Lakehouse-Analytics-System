"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useTheme } from "@/context/ThemeContext"
import { useToast } from "@/components/ui/ToastProvider"
import { getDashboards, renameDashboard, addWidget } from "@/api/dashboard"
import { updateWidget, deleteWidget, updatePageLayout } from "@/api/widget"
import { addPage, updatePage } from "@/api/dashboardPage"
import { analyze } from "@/api/ai"
import {
  Plus, X, ChevronLeft, BarChart3, LineChart as LineIcon,
  PieChart as PieIcon, Table2, Zap, GripVertical, Loader2,
  RefreshCw, ChevronDown, MoreHorizontal, LayoutGrid, Pencil,
  Maximize2, AlertCircle, WifiOff, Play, Check, Trash2, Edit3,
} from "lucide-react"
import {
  BarChart, Bar, LineChart as ReLineChart, Line,
  PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts"

// ─── TYPES ────────────────────────────────────────────────
// Exact shapes from GET /dashboard/{project_id}
type ChartType = "bar" | "line" | "area" | "pie" | "table" | "kpi"

interface ApiWidget {
  widget_id:  number
  chart_type: ChartType
  title?:     string
  query?:     string
  dataset_name?: string
  x_axis?:    string | null
  y_axis?:    string | null
  layout:     { x: number; y: number; w: number; h: number }
  data:       any[] | { error: string } | null
}

interface ApiPage {
  page_id:   number
  name:      string
  widgets:   ApiWidget[]
}

interface ApiDashboard {
  dashboard_id: number
  name:         string
  pages:        ApiPage[]
}

// Runtime widget — flattened layout, plus fetch state
interface Widget extends ApiWidget {
  // flattened from layout for easy access
  pos_x:   number
  pos_y:   number
  width:   number
  height:  number
  // runtime
  fetching?: boolean
  fetchError?: string
  liveData?: any[]  // data fetched via /analyze
}

interface Page {
  page_id: number
  name:    string
  widgets: Widget[]
}

// ─── CONSTANTS ────────────────────────────────────────────
const COLS   = 12
const ROW_H  = 90   // px per row unit
const COLORS = ["#7c6bff","#34d399","#f59e0b","#ef4444","#3b82f6","#ec4899","#a78bfa","#10b981","#f97316","#06b6d4"]

// ─── HELPERS ──────────────────────────────────────────────
function flattenWidget(w: ApiWidget): Widget {
  return {
    ...w,
    pos_x:  w.layout?.x ?? 0,
    pos_y:  w.layout?.y ?? 0,
    width:  w.layout?.w ?? 4,
    height: w.layout?.h ?? 3,
  }
}

function extractRows(data: any): any[] | null {
  if (!data) return null
  if (Array.isArray(data)) return data
  if (data?.error) return null  // server-side error (e.g. Spark down)
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.rows)) return data.rows
  return null
}

function extractDataError(data: any): string | null {
  if (data?.error) return String(data.error)
  return null
}

/** Parse the /analyze response, extracting rows from the tool result message */
function parseAnalyzeRows(res: any): { rows: any[] | null; error: string | null } {
  const msgs: any[] = res?.analysis?.messages ?? []
  for (const m of msgs) {
    if (m.type === "tool") {
      const raw = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "")
      try {
        const p = JSON.parse(raw)
        if (Array.isArray(p))        return { rows: p,       error: null }
        if (Array.isArray(p?.data))  return { rows: p.data,  error: null }
        if (Array.isArray(p?.rows))  return { rows: p.rows,  error: null }
        if (p?.error)                return { rows: null,    error: String(p.error) }
      } catch { /* not JSON */ }
    }
  }
  return { rows: null, error: "No data returned" }
}

function isSparkDown(err: string) {
  return /WinError 10061|Connection refused|refused it|ECONNREFUSED/i.test(err)
}

// ─── CHART RENDERER ───────────────────────────────────────
function ChartRenderer({
  widget, dark, accent,
}: { widget: Widget; dark: boolean; accent: string }) {
  const tc  = dark ? "rgba(240,240,248,0.45)" : "rgba(15,15,26,0.45)"
  const gc  = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"
  const tbg = dark ? "#1a1a28" : "#ffffff"
  const tb  = dark ? "rgba(255,255,255,0.1)"  : "rgba(0,0,0,0.1)"

  // ── Loading ──
  if (widget.fetching) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", gap:10 }}>
      <Loader2 size={16} color={accent} style={{ animation:"db-spin 1s linear infinite" }} />
      <span style={{ fontSize:12, color:tc }}>Running query…</span>
    </div>
  )

  // ── Error states ──
  const serverErr = extractDataError(widget.data)
  const displayErr = widget.fetchError || serverErr

  if (displayErr) {
    const offline = isSparkDown(displayErr)
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:10, padding:16, textAlign:"center" }}>
        {offline
          ? <WifiOff size={20} color={tc} />
          : <AlertCircle size={20} color="#f87171" />
        }
        <p style={{ fontSize:12, color: offline ? tc : "#f87171", lineHeight:1.5, margin:0, maxWidth:200 }}>
          {offline
            ? "Spark engine offline. Start the backend and click ↺ to retry."
            : displayErr.slice(0, 160)
          }
        </p>
      </div>
    )
  }

  // ── Resolve data: prefer liveData (from /analyze), fall back to API data ──
  const rows = widget.liveData ?? extractRows(widget.data)

  if (!rows || rows.length === 0) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:8 }}>
      <BarChart3 size={22} color={dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} />
      <span style={{ fontSize:12, color:tc }}>
        {widget.query ? "No data returned" : "No query set — click Edit"}
      </span>
    </div>
  )

  // ── KPI ──
  if (widget.chart_type === "kpi") {
    // For KPI: try y_axis key first, then first numeric column, then first value
    const yKey = widget.y_axis || Object.keys(rows[0]).find(k => !isNaN(Number(rows[0][k]))) || Object.keys(rows[0])[0]
    const val  = rows[0]?.[yKey]
    const numVal = Number(val)
    const isNum  = !isNaN(numVal)

    // Change vs second row if available
    const prev    = rows[1]?.[yKey]
    const prevNum = Number(prev)
    const hasDelta = rows.length > 1 && !isNaN(prevNum) && prevNum !== 0 && isNum
    const delta    = hasDelta ? ((numVal - prevNum) / Math.abs(prevNum) * 100) : null

    // Subtitle: the label column (first non-y_axis column or x_axis)
    const labelKey = widget.x_axis || Object.keys(rows[0]).find(k => k !== yKey) || yKey

    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:6, padding:12 }}>
        {/* Label */}
        <span style={{ fontSize:11, fontWeight:600, color:tc, textTransform:"uppercase", letterSpacing:"0.06em" }}>
          {(yKey || "").replace(/_/g," ")}
        </span>
        {/* Big value */}
        <span style={{ fontFamily:"'Instrument Serif',serif", fontSize:Math.min(52, Math.max(32, 52 - String(isNum ? numVal.toLocaleString() : val).length * 1.8)), fontWeight:400, color:dark?"#f0f0f8":"#0f0f1a", letterSpacing:"-2px", lineHeight:1, textAlign:"center" }}>
          {isNum ? numVal.toLocaleString() : String(val ?? "—")}
        </span>
        {/* Delta badge */}
        {delta !== null && (
          <span style={{ fontSize:12, fontWeight:700, color:delta >= 0 ? "#34d399" : "#f87171", background:delta >= 0 ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", padding:"2px 10px", borderRadius:20 }}>
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {/* Row count hint */}
        {rows.length > 1 && (
          <span style={{ fontSize:10, color:tc, fontFamily:"'Geist Mono',monospace" }}>
            {rows.length} rows
          </span>
        )}
      </div>
    )
  }

  // ── Table ──
  if (widget.chart_type === "table") {
    const cols = Object.keys(rows[0])
    return (
      <div style={{ height:"100%", overflowY:"auto", overflowX:"auto", scrollbarWidth:"thin" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:"'Geist',sans-serif" }}>
          <thead>
            <tr style={{ position:"sticky", top:0, background:dark?"#13131e":"#ffffff", borderBottom:`1px solid ${gc}` }}>
              {cols.map(c => (
                <th key={c} style={{ padding:"7px 12px", textAlign:"left", fontSize:10, fontWeight:700, color:tc, textTransform:"uppercase", letterSpacing:"0.05em", whiteSpace:"nowrap" }}>
                  {c.replace(/_/g," ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0,100).map((row, i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${gc}` }}
                onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {cols.map(c => {
                  const v = row[c]
                  const isNum = v !== null && v !== "" && !isNaN(Number(v))
                  return (
                    <td key={c} style={{ padding:"6px 12px", color:isNum?accent:(dark?"rgba(240,240,248,0.78)":"rgba(15,15,26,0.78)"), whiteSpace:"nowrap", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", fontFamily:isNum?"'Geist Mono',monospace":"inherit" }}>
                      {isNum ? Number(v).toLocaleString() : String(v ?? "—")}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 100 && (
          <div style={{ padding:"6px 12px", fontSize:11, color:tc, borderTop:`1px solid ${gc}` }}>
            Showing 100 of {rows.length} rows
          </div>
        )}
      </div>
    )
  }

  // ── Charts ──
  const xKey = widget.x_axis || Object.keys(rows[0])[0]
  const yKey = widget.y_axis || Object.keys(rows[0]).find(k => k !== xKey && !isNaN(Number(rows[0][k]))) || Object.keys(rows[0])[1]
  const data = rows.map(r => ({ ...r, [yKey]: isNaN(Number(r[yKey])) ? r[yKey] : Number(r[yKey]) }))
  const tilt = data.length > 8

  const axis = {
    tick: { fill:tc, fontSize:tilt?9:11, fontFamily:"'Geist',sans-serif" },
    axisLine: { stroke:gc },
    tickLine: false as const,
  }
  const tip = {
    contentStyle: { background:tbg, border:`1px solid ${tb}`, borderRadius:10, fontSize:12, fontFamily:"'Geist',sans-serif" },
    labelStyle: { color:dark?"#f0f0f8":"#0f0f1a", fontWeight:600 },
    cursor: { fill:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)" },
  }

  if (widget.chart_type === "pie") return (
    <ResponsiveContainer width="100%" height="100%">
      <RePieChart>
        <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius="68%"
          label={({ name, percent }:any) => `${String(name).slice(0,14)} ${(percent*100).toFixed(0)}%`}
          labelLine={{ stroke:tc, strokeWidth:0.7 }} fontSize={11}
        >
          {data.map((_:any, i:number) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
        </Pie>
        <Tooltip {...tip} />
      </RePieChart>
    </ResponsiveContainer>
  )

  if (widget.chart_type === "area") return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top:4, right:8, left:-16, bottom:tilt?32:4 }}>
        <defs>
          <linearGradient id={`ag${widget.widget_id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={accent} stopOpacity={0.28} />
            <stop offset="95%" stopColor={accent} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gc} />
        <XAxis dataKey={xKey} {...axis} angle={tilt?-35:0} textAnchor={tilt?"end":"middle"} interval="preserveStartEnd" />
        <YAxis {...axis} />
        <Tooltip {...tip} />
        <Area type="monotone" dataKey={yKey} stroke={accent} strokeWidth={2.5} fill={`url(#ag${widget.widget_id})`} dot={false} activeDot={{ r:4, fill:accent }} />
      </AreaChart>
    </ResponsiveContainer>
  )

  if (widget.chart_type === "line") return (
    <ResponsiveContainer width="100%" height="100%">
      <ReLineChart data={data} margin={{ top:4, right:8, left:-16, bottom:tilt?32:4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gc} />
        <XAxis dataKey={xKey} {...axis} angle={tilt?-35:0} textAnchor={tilt?"end":"middle"} interval="preserveStartEnd" />
        <YAxis {...axis} />
        <Tooltip {...tip} />
        <Line type="monotone" dataKey={yKey} stroke={accent} strokeWidth={2.5} dot={{ fill:accent, r:3, strokeWidth:0 }} activeDot={{ r:5 }} />
      </ReLineChart>
    </ResponsiveContainer>
  )

  // Bar (default)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top:4, right:8, left:-16, bottom:tilt?40:4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gc} />
        <XAxis dataKey={xKey} {...axis} angle={tilt?-40:0} textAnchor={tilt?"end":"middle"} interval={0} />
        <YAxis {...axis} />
        <Tooltip {...tip} />
        <Bar dataKey={yKey} fill={accent} radius={[4,4,0,0]}
          background={{ fill:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)", radius:[4,4,0,0] }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── WIDGET CARD ──────────────────────────────────────────
function WidgetCard({
  widget, editMode, dark, accent, surface, border, textMain, textSub,
  onEdit, onDelete, onDragStart, onResizeStart, onRefresh,
}: {
  widget: Widget; editMode: boolean; dark: boolean; accent: string
  surface: string; border: string; textMain: string; textSub: string
  onEdit: () => void; onDelete: () => void
  onDragStart: (e: React.MouseEvent) => void
  onResizeStart: (e: React.MouseEvent) => void
  onRefresh: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const ChartIcon =
    widget.chart_type === "pie"   ? PieIcon   :
    widget.chart_type === "line"  ? LineIcon  :
    widget.chart_type === "area"  ? LineIcon  :
    widget.chart_type === "table" ? Table2    :
    widget.chart_type === "kpi"   ? Zap       : BarChart3

  return (
    <div style={{
      position:"absolute",
      left:`${(widget.pos_x / COLS) * 100}%`,
      top: widget.pos_y * ROW_H,
      width:`${(widget.width / COLS) * 100}%`,
      height: widget.height * ROW_H,
      background: surface,
      border:`1px solid ${editMode ? `${accent}35` : border}`,
      borderRadius:14,
      display:"flex", flexDirection:"column",
      overflow:"hidden",
      transition:"border-color 0.2s, box-shadow 0.2s",
      boxShadow: editMode ? `0 0 0 2px ${accent}18` : (dark?"0 2px 12px rgba(0,0,0,0.2)":"0 2px 8px rgba(0,0,0,0.07)"),
      userSelect:"none",
    }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 13px", borderBottom:`1px solid ${border}`, background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)", flexShrink:0, minWidth:0 }}>
        {editMode && (
          <div onMouseDown={onDragStart} style={{ cursor:"grab", color:textSub, display:"flex", flexShrink:0 }}>
            <GripVertical size={13} />
          </div>
        )}

        <div style={{ width:22, height:22, borderRadius:6, background:`${accent}16`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <ChartIcon size={12} color={accent} />
        </div>

        <span style={{ fontSize:13, fontWeight:600, color:textMain, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", letterSpacing:"-0.2px" }}>
          {widget.title || widget.chart_type.toUpperCase()}
        </span>

        {/* Refresh button */}
        <button onClick={onRefresh} disabled={widget.fetching}
          style={{ background:"none", border:"none", cursor:widget.fetching?"not-allowed":"pointer", display:"flex", alignItems:"center", padding:"3px 5px", borderRadius:6, color:textSub, transition:"all 0.15s", flexShrink:0, opacity:widget.fetching?0.4:1 }}
          onMouseEnter={e=>(e.currentTarget.style.background=dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)")}
          onMouseLeave={e=>(e.currentTarget.style.background="none")}
          title="Re-run query"
        >
          {widget.fetching
            ? <Loader2 size={12} style={{ animation:"db-spin 1s linear infinite" }} />
            : <RefreshCw size={12} />
          }
        </button>

        {editMode && (
          <div style={{ position:"relative", flexShrink:0 }}>
            <button onClick={()=>setMenuOpen(p=>!p)}
              style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", padding:"3px 5px", borderRadius:6, color:textSub, transition:"all 0.15s" }}
              onMouseEnter={e=>(e.currentTarget.style.background=dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)")}
              onMouseLeave={e=>(e.currentTarget.style.background="none")}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div style={{ position:"absolute", right:0, top:"calc(100% + 4px)", background:dark?"#1a1a28":"#ffffff", border:`1px solid ${border}`, borderRadius:10, overflow:"hidden", boxShadow:dark?"0 8px 24px rgba(0,0,0,0.5)":"0 8px 24px rgba(0,0,0,0.12)", minWidth:130, zIndex:200, animation:"db-slideDown 0.12s ease" }}>
                <button onClick={()=>{onEdit();setMenuOpen(false)}}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"9px 14px", background:"none", border:"none", cursor:"pointer", fontSize:13, color:textMain, fontFamily:"'Geist',sans-serif", transition:"background 0.12s" }}
                  onMouseEnter={e=>(e.currentTarget.style.background=dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.04)")}
                  onMouseLeave={e=>(e.currentTarget.style.background="none")}
                >
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={()=>{onDelete();setMenuOpen(false)}}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"9px 14px", background:"none", border:"none", cursor:"pointer", fontSize:13, color:"#f87171", fontFamily:"'Geist',sans-serif", transition:"background 0.12s" }}
                  onMouseEnter={e=>(e.currentTarget.style.background="rgba(248,113,113,0.08)")}
                  onMouseLeave={e=>(e.currentTarget.style.background="none")}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart area */}
      <div style={{ flex:1, padding:widget.chart_type==="table"?0:"10px 12px 8px", minHeight:0, overflow:"hidden" }}>
        <ChartRenderer widget={widget} dark={dark} accent={accent} />
      </div>

      {/* Resize handle */}
      {editMode && (
        <div onMouseDown={onResizeStart}
          style={{ position:"absolute", bottom:4, right:4, width:16, height:16, cursor:"se-resize", display:"flex", alignItems:"center", justifyContent:"center", color:`${accent}55`, borderRadius:4 }}
          title="Drag to resize"
        >
          <Maximize2 size={11} />
        </div>
      )}
    </div>
  )
}

// ─── WIDGET FORM (Add / Edit) ─────────────────────────────
const CHART_TYPES: { id: ChartType; label: string; Icon: any }[] = [
  { id:"bar",   label:"Bar",   Icon:BarChart3 },
  { id:"line",  label:"Line",  Icon:LineIcon  },
  { id:"area",  label:"Area",  Icon:LineIcon  },
  { id:"pie",   label:"Pie",   Icon:PieIcon   },
  { id:"table", label:"Table", Icon:Table2    },
  { id:"kpi",   label:"KPI",   Icon:Zap       },
]

function WidgetForm({
  initial, onSave, onCancel, saving,
  dark, accent, surface, border, textMain, textSub,
}: {
  initial?: Partial<Widget>
  onSave: (d: Partial<Widget>) => void
  onCancel: () => void
  saving: boolean
  dark:boolean; accent:string; surface:string; border:string; textMain:string; textSub:string
}) {
  const [title,     setTitle]     = useState(initial?.title || "")
  const [chartType, setChartType] = useState<ChartType>(initial?.chart_type || "bar")
  const [dataset,   setDataset]   = useState(initial?.dataset_name || "")
  const [query,     setQuery]     = useState(initial?.query || "")
  const [xAxis,     setXAxis]     = useState(initial?.x_axis || "")
  const [yAxis,     setYAxis]     = useState(initial?.y_axis || "")
  const [width,     setWidth]     = useState(initial?.width  || 6)
  const [height,    setHeight]    = useState(initial?.height || 3)

  const inp = {
    width:"100%", boxSizing:"border-box" as const,
    background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",
    border:`1px solid ${border}`, borderRadius:9,
    padding:"9px 12px", fontSize:13,
    fontFamily:"'Geist',sans-serif", color:textMain,
    outline:"none", transition:"border-color 0.15s",
  }
  const focus = (e:any) => (e.currentTarget.style.borderColor = `${accent}60`)
  const blur  = (e:any) => (e.currentTarget.style.borderColor = border)
  const lbl = (t:string) => (
    <span style={{ fontSize:11, fontWeight:700, color:textSub, textTransform:"uppercase" as const, letterSpacing:"0.06em" }}>{t}</span>
  )

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Title */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {lbl("Widget title")}
        <input style={inp} placeholder="e.g. Total Delays" value={title} onChange={e=>setTitle(e.target.value)} onFocus={focus} onBlur={blur} />
      </div>

      {/* Chart type */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {lbl("Chart type")}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:5 }}>
          {CHART_TYPES.map(ct => {
            const I = ct.Icon
            const active = chartType === ct.id
            return (
              <button key={ct.id} onClick={()=>setChartType(ct.id)}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding:"9px 4px", borderRadius:9, border:`1px solid ${active?`${accent}55`:border}`, background:active?`${accent}14`:"none", cursor:"pointer", transition:"all 0.15s" }}
              >
                <I size={14} color={active?accent:textSub} />
                <span style={{ fontSize:9.5, fontWeight:600, color:active?accent:textSub }}>{ct.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Dataset */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {lbl("Dataset name")}
        <input style={inp} placeholder="e.g. airline_data.csv" value={dataset} onChange={e=>setDataset(e.target.value)} onFocus={focus} onBlur={blur} />
      </div>

      {/* Query */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {lbl("SQL query")}
        <textarea rows={4}
          style={{ ...inp, resize:"vertical", fontFamily:"'Geist Mono',monospace", fontSize:12, lineHeight:1.6 }}
          placeholder="SELECT Reporting_Airline, COUNT(*) AS flight_id FROM data GROUP BY Reporting_Airline ORDER BY flight_id DESC LIMIT 10"
          value={query} onChange={e=>setQuery(e.target.value)} onFocus={focus} onBlur={blur}
        />
      </div>

      {/* Axes */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {lbl("X axis column")}
          <input style={inp} placeholder="Reporting_Airline" value={xAxis} onChange={e=>setXAxis(e.target.value)} onFocus={focus} onBlur={blur} />
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {lbl("Y axis column")}
          <input style={inp} placeholder="flight_id" value={yAxis} onChange={e=>setYAxis(e.target.value)} onFocus={focus} onBlur={blur} />
        </div>
      </div>

      {/* Size */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {lbl(`Width — ${width}/12`)}
          <input type="range" min={2} max={12} value={width} onChange={e=>setWidth(Number(e.target.value))} style={{ accentColor:accent, width:"100%" }} />
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {lbl(`Height — ${height} rows`)}
          <input type="range" min={2} max={8} value={height} onChange={e=>setHeight(Number(e.target.value))} style={{ accentColor:accent, width:"100%" }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:"flex", gap:10, paddingTop:4 }}>
        <button
          onClick={()=>onSave({ title, chart_type:chartType, dataset_name:dataset, query, x_axis:xAxis, y_axis:yAxis, width, height })}
          disabled={saving}
          style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${accent},#a78bfa)`, color:"white", fontSize:13, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:saving?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, opacity:saving?0.7:1 }}
        >
          {saving ? <Loader2 size={13} style={{ animation:"db-spin 1s linear infinite" }} /> : <Check size={13} />}
          {initial?.widget_id ? "Update" : "Add widget"}
        </button>
        <button onClick={onCancel}
          style={{ padding:"10px 16px", borderRadius:10, border:`1px solid ${border}`, background:"none", color:textSub, fontSize:13, fontFamily:"'Geist',sans-serif", cursor:"pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── INLINE QUERY EDITOR ──────────────────────────────────
function QueryEditor({
  widget, projectId, dark, accent, border, textMain, textSub,
  onDataUpdate, onClose,
}: {
  widget: Widget; projectId: number
  dark:boolean; accent:string; border:string; textMain:string; textSub:string
  onDataUpdate: (widgetId:number, rows:any[], error?:string) => void
  onClose: () => void
}) {
  const [query,    setQuery]    = useState(widget.query || "")
  const [dataset,  setDataset]  = useState(widget.dataset_name || "")
  const [running,  setRunning]  = useState(false)
  const [result,   setResult]   = useState<any[]|null>(null)
  const [error,    setError]    = useState<string|null>(null)
  const toast = useToast()

  async function run() {
    if (!query.trim() || !dataset.trim()) {
      toast.error("Set both a dataset name and a SQL query first.")
      return
    }
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await analyze.post({ project_id:projectId, dataset, query })
      const { rows, error:err } = parseAnalyzeRows(res)
      if (err) {
        setError(err)
        toast.error("Query error: " + err.slice(0,80))
      } else {
        setResult(rows || [])
        onDataUpdate(widget.widget_id, rows || [])
        toast.success(`Query OK — ${rows?.length ?? 0} rows`)
      }
    } catch(e:any) {
      const msg = e.message || "Unknown error"
      setError(msg)
      toast.error("Failed to run query")
    } finally {
      setRunning(false)
    }
  }

  const inp = {
    width:"100%", boxSizing:"border-box" as const,
    background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",
    border:`1px solid ${border}`, borderRadius:9,
    padding:"8px 12px", fontSize:13,
    fontFamily:"'Geist',sans-serif", color:textMain,
    outline:"none",
  }

  return (
    <div style={{ borderTop:`1px solid ${border}`, background:dark?"rgba(0,0,0,0.25)":"rgba(0,0,0,0.03)", padding:"14px 14px 12px" }}>
      {/* Dataset row */}
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
        <span style={{ fontSize:10, fontWeight:700, color:textSub, textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>Dataset</span>
        <input style={{ ...inp, padding:"5px 10px", fontSize:12, flex:1 }} placeholder="airline_data.csv" value={dataset} onChange={e=>setDataset(e.target.value)} />
      </div>

      {/* SQL textarea */}
      <textarea rows={3}
        style={{ ...inp, fontFamily:"'Geist Mono',monospace", fontSize:11.5, lineHeight:1.65, resize:"vertical", marginBottom:8 }}
        placeholder="SELECT column, COUNT(*) AS count FROM data GROUP BY column LIMIT 20"
        value={query} onChange={e=>setQuery(e.target.value)}
        onKeyDown={e=>{ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); run() } }}
      />

      {/* Error */}
      {error && (
        <div style={{ display:"flex", alignItems:"flex-start", gap:7, marginBottom:8, padding:"8px 10px", background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:8 }}>
          <AlertCircle size={13} color="#f87171" style={{ flexShrink:0, marginTop:1 }} />
          <span style={{ fontSize:11.5, color:"#f87171", fontFamily:"'Geist Mono',monospace", lineHeight:1.5 }}>
            {isSparkDown(error) ? "Spark engine offline. Start the backend and retry." : error.slice(0,200)}
          </span>
        </div>
      )}

      {/* Result preview */}
      {result && result.length > 0 && (
        <div style={{ marginBottom:8, padding:"6px 10px", background:`${accent}0e`, border:`1px solid ${accent}25`, borderRadius:8, fontSize:11.5, color:accent, fontFamily:"'Geist Mono',monospace" }}>
          ✓ {result.length} rows · columns: {Object.keys(result[0]).join(", ")}
        </div>
      )}
      {result && result.length === 0 && (
        <div style={{ marginBottom:8, padding:"6px 10px", background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)", borderRadius:8, fontSize:11.5, color:textSub }}>
          Query returned 0 rows.
        </div>
      )}

      {/* Run button */}
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <button onClick={run} disabled={running}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:8, border:"none", background:`linear-gradient(135deg,${accent},#a78bfa)`, color:"white", fontSize:12, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:running?"not-allowed":"pointer", opacity:running?0.7:1 }}
        >
          {running ? <Loader2 size={12} style={{ animation:"db-spin 1s linear infinite" }}/> : <Play size={12}/>}
          {running ? "Running…" : "Run  ⌘↵"}
        </button>
        <button onClick={onClose}
          style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${border}`, background:"none", color:textSub, fontSize:12, fontFamily:"'Geist',sans-serif", cursor:"pointer" }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────
export default function DashboardPage() {
  const params    = useParams()
  const projectId = Number(params.id)
  const dashId    = Number(params.dashboardId)

  const { effective, accentColor } = useTheme()
  const dark  = effective === "dark"
  const toast = useToast()

  const accent   = accentColor
  const surface  = dark ? "#13131e" : "#ffffff"
  const border   = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"
  const textMain = dark ? "#f0f0f8"  : "#0f0f1a"
  const textSub  = dark ? "rgba(240,240,248,0.4)"  : "rgba(15,15,26,0.45)"
  const shared   = { dark, accent, surface, border, textMain, textSub }

  // ── State ──
  const [dashboard, setDashboard]   = useState<ApiDashboard | null>(null)
  const [pages,     setPages]       = useState<Page[]>([])
  const [pageIdx,   setPageIdx]     = useState(0)
  const [editMode,  setEditMode]    = useState(false)
  const [loading,   setLoading]     = useState(true)
  const [saving,    setSaving]      = useState(false)

  const [showAdd,    setShowAdd]    = useState(false)
  const [editWidget, setEditWidget] = useState<Widget | null>(null)
  const [queryWidget, setQueryWidget] = useState<number | null>(null)  // widget_id

  const [renamingPage,  setRenamingPage]  = useState<number | null>(null)
  const [newPageName,   setNewPageName]   = useState("")
  const [renamingDash,  setRenamingDash]  = useState(false)
  const [dashName,      setDashName]      = useState("")

  const gridRef   = useRef<HTMLDivElement>(null)
  const dragRef   = useRef<{ wid:number; sx:number; sy:number; ox:number; oy:number } | null>(null)
  const resizeRef = useRef<{ wid:number; sx:number; sy:number; ow:number; oh:number } | null>(null)

  const activePage = pages[pageIdx] ?? null

  // ── Load dashboard ──
  useEffect(() => { load() }, [dashId])

  async function load() {
    setLoading(true)
    try {
      const res = await getDashboards(projectId)
      // API returns array OR single object — handle both
      const list: ApiDashboard[] = Array.isArray(res) ? res : [res]
      const dash = list.find(d => d.dashboard_id === dashId) ?? list[0]
      if (!dash) { toast.error("Dashboard not found"); return }

      setDashboard(dash)
      setDashName(dash.name)

      const ps: Page[] = (dash.pages ?? []).map(p => ({
        page_id: p.page_id,
        name:    p.name,
        widgets: (p.widgets ?? []).map(flattenWidget),
      }))
      setPages(ps)
      setPageIdx(0)
    } catch(e:any) {
      toast.error("Failed to load: " + e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Run a single widget's query via /analyze ──
  async function runWidget(widget: Widget) {
    if (!widget.query || !widget.dataset_name) {
      toast.error("Widget has no query or dataset. Click Edit to add one.")
      return
    }
    updateWidget_state(widget.widget_id, { fetching:true, fetchError:undefined })
    try {
      const res = await analyze.post({ project_id:projectId, dataset:widget.dataset_name, query:widget.query })
      const { rows, error:err } = parseAnalyzeRows(res)
      if (err) {
        updateWidget_state(widget.widget_id, { fetching:false, fetchError:err })
        toast.error("Query error: " + (isSparkDown(err) ? "Spark offline" : err.slice(0,60)))
      } else {
        updateWidget_state(widget.widget_id, { fetching:false, liveData:rows ?? [], fetchError:undefined })
      }
    } catch(e:any) {
      updateWidget_state(widget.widget_id, { fetching:false, fetchError:e.message })
    }
  }

  function updateWidget_state(wid: number, patch: Partial<Widget>) {
    setPages(ps => ps.map((p, i) => i !== pageIdx ? p : {
      ...p,
      widgets: p.widgets.map(w => w.widget_id === wid ? { ...w, ...patch } : w)
    }))
  }

  function handleDataUpdate(wid: number, rows: any[], error?: string) {
    updateWidget_state(wid, { liveData:rows, fetchError:error, fetching:false })
  }

  // ── Add widget ──
  async function handleAddWidget(data: Partial<Widget>) {
    if (!activePage) return
    setSaving(true)
    try {
      const maxY = activePage.widgets.reduce((m,w) => Math.max(m, w.pos_y + w.height), 0)
      const payload = {
        chart_type:   data.chart_type  || "bar",
        title:        data.title,
        query:        data.query,
        dataset_name: data.dataset_name,
        x_axis:       data.x_axis,
        y_axis:       data.y_axis,
        pos_x:        0,
        pos_y:        maxY,
        width:        data.width  || 6,
        height:       data.height || 3,
      }
      const res = await addWidget(activePage.page_id, payload)
      const newW: Widget = {
        ...payload,
        widget_id:  res.widget_id || res.id || Date.now(),
        layout:     { x:0, y:maxY, w:payload.width, h:payload.height },
        data:       null,
        pos_x:      0,
        pos_y:      maxY,
        width:      payload.width,
        height:     payload.height,
        x_axis:     payload.x_axis,
        y_axis:     payload.y_axis,
      }
      setPages(ps => ps.map((p,i) => i!==pageIdx?p:{ ...p, widgets:[...p.widgets, newW] }))
      toast.success("Widget added!")
      setShowAdd(false)
      // Auto-run if query is set
      if (newW.query && newW.dataset_name) runWidget(newW)
    } catch(e:any) {
      toast.error("Failed: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Edit widget ──
  async function handleEditWidget(data: Partial<Widget>) {
    if (!editWidget) return
    setSaving(true)
    try {
      await updateWidget(editWidget.widget_id, data)
      const updated = { ...editWidget, ...data, liveData:undefined, fetchError:undefined }
      setPages(ps => ps.map((p,i) => i!==pageIdx?p:{
        ...p, widgets:p.widgets.map(w => w.widget_id===editWidget.widget_id ? updated : w)
      }))
      toast.success("Widget updated!")
      setEditWidget(null)
      if (updated.query && updated.dataset_name) runWidget(updated)
    } catch(e:any) {
      toast.error("Failed: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete widget ──
  async function handleDeleteWidget(wid: number) {
    if (!confirm("Delete this widget?")) return
    try {
      await deleteWidget(wid)
      setPages(ps => ps.map((p,i) => i!==pageIdx?p:{ ...p, widgets:p.widgets.filter(w=>w.widget_id!==wid) }))
      toast.success("Widget deleted")
    } catch(e:any) {
      toast.error("Failed: " + e.message)
    }
  }

  // ── Save layout (silent) ──
  const saveLayout = useCallback(async () => {
    if (!activePage) return
    try {
      await updatePageLayout(activePage.page_id, activePage.widgets.map(w => ({
        widget_id:w.widget_id, pos_x:w.pos_x, pos_y:w.pos_y, width:w.width, height:w.height
      })))
    } catch { /* silent */ }
  }, [activePage])

  // ── Drag ──
  function onDragStart(e: React.MouseEvent, wid: number) {
    e.preventDefault()
    const w = activePage?.widgets.find(w=>w.widget_id===wid)
    if (!w) return
    dragRef.current = { wid, sx:e.clientX, sy:e.clientY, ox:w.pos_x, oy:w.pos_y }
    const onMove = (me:MouseEvent) => {
      if (!dragRef.current || !gridRef.current) return
      const cw = gridRef.current.offsetWidth / COLS
      const dx = Math.round((me.clientX - dragRef.current.sx) / cw)
      const dy = Math.round((me.clientY - dragRef.current.sy) / ROW_H)
      const ww = activePage?.widgets.find(w2=>w2.widget_id===wid)?.width ?? 4
      const nx = Math.max(0, Math.min(COLS - ww, dragRef.current.ox + dx))
      const ny = Math.max(0, dragRef.current.oy + dy)
      setPages(ps => ps.map((p,i) => i!==pageIdx?p:{ ...p, widgets:p.widgets.map(w2=>w2.widget_id===wid?{...w2,pos_x:nx,pos_y:ny}:w2) }))
    }
    const onUp = () => { document.removeEventListener("mousemove",onMove); document.removeEventListener("mouseup",onUp); saveLayout() }
    document.addEventListener("mousemove",onMove)
    document.addEventListener("mouseup",onUp)
  }

  // ── Resize ──
  function onResizeStart(e: React.MouseEvent, wid: number) {
    e.preventDefault(); e.stopPropagation()
    const w = activePage?.widgets.find(w=>w.widget_id===wid)
    if (!w) return
    resizeRef.current = { wid, sx:e.clientX, sy:e.clientY, ow:w.width, oh:w.height }
    const onMove = (me:MouseEvent) => {
      if (!resizeRef.current || !gridRef.current) return
      const cw = gridRef.current.offsetWidth / COLS
      const dw = Math.round((me.clientX - resizeRef.current.sx) / cw)
      const dh = Math.round((me.clientY - resizeRef.current.sy) / ROW_H)
      const nw = Math.max(2, Math.min(COLS, resizeRef.current.ow + dw))
      const nh = Math.max(2, Math.min(10, resizeRef.current.oh + dh))
      setPages(ps => ps.map((p,i) => i!==pageIdx?p:{ ...p, widgets:p.widgets.map(w2=>w2.widget_id===wid?{...w2,width:nw,height:nh}:w2) }))
    }
    const onUp = () => { document.removeEventListener("mousemove",onMove); document.removeEventListener("mouseup",onUp); saveLayout() }
    document.addEventListener("mousemove",onMove)
    document.addEventListener("mouseup",onUp)
  }

  // ── Add page ──
  async function handleAddPage() {
    if (!dashboard) return
    try {
      const res = await addPage(dashboard.dashboard_id, { name:`Page ${pages.length+1}`, page_order:pages.length })
      const np: Page = { page_id:res.page_id||res.id||Date.now(), name:res.name||`Page ${pages.length+1}`, widgets:[] }
      setPages(ps=>[...ps,np])
      setPageIdx(pages.length)
      toast.success("Page added!")
    } catch(e:any) { toast.error("Failed: "+e.message) }
  }

  // ── Rename page ──
  async function handleRenamePage(pid:number) {
    if (!newPageName.trim()) { setRenamingPage(null); return }
    try {
      await updatePage(pid, { name:newPageName.trim() })
      setPages(ps=>ps.map(p=>p.page_id===pid?{...p,name:newPageName.trim()}:p))
    } catch{} finally { setRenamingPage(null) }
  }

  // ── Rename dashboard ──
  async function handleRenameDash() {
    if (!dashName.trim() || !dashboard) { setRenamingDash(false); return }
    try {
      await renameDashboard(dashboard.dashboard_id, { name:dashName.trim() })
      setDashboard(d=>d?{...d,name:dashName.trim()}:d)
    } catch{} finally { setRenamingDash(false) }
  }

  const canvasH = (activePage?.widgets.reduce((m,w)=>Math.max(m,(w.pos_y+w.height)*ROW_H),400)??400) + 80

  // ── Loading ──
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", gap:12, fontFamily:"'Geist',sans-serif", background:dark?"#0d0d14":"#f0f0f8" }}>
      <Loader2 size={20} color={accent} style={{ animation:"db-spin 1s linear infinite" }} />
      <span style={{ color:textSub, fontSize:14 }}>Loading dashboard…</span>
    </div>
  )

  if (!dashboard) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:12, fontFamily:"'Geist',sans-serif" }}>
      <p style={{ color:textSub }}>Dashboard not found</p>
      <Link href={`/project/${projectId}`} style={{ fontSize:13, color:accent, textDecoration:"none" }}>← Back</Link>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap');
        @keyframes db-spin      { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes db-fadeUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes db-slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes db-slideIn   { from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:translateX(0)} }
        *, *::before, *::after { box-sizing:border-box }
        input[type=range]{ width:100% }
      `}</style>

      <div style={{ fontFamily:"'Geist',sans-serif", display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", background:dark?"#0d0d14":"#f0f0f8", transition:"background 0.3s" }}>

        {/* ── TOP BAR ── */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 22px", borderBottom:`1px solid ${border}`, background:surface, flexShrink:0 }}>
          <Link href={`/project/${projectId}`}
            style={{ display:"flex", alignItems:"center", gap:5, color:textSub, textDecoration:"none", fontSize:13, transition:"color 0.15s", flexShrink:0 }}
            onMouseEnter={e=>(e.currentTarget.style.color=accent)}
            onMouseLeave={e=>(e.currentTarget.style.color=textSub)}
          >
            <ChevronLeft size={14} /> Project
          </Link>

          <span style={{ color:dark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.15)", fontSize:16 }}>/</span>

          {/* Dashboard name */}
          {renamingDash ? (
            <input autoFocus value={dashName}
              onChange={e=>setDashName(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")handleRenameDash();if(e.key==="Escape")setRenamingDash(false)}}
              onBlur={handleRenameDash}
              style={{ background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)", border:`1px solid ${accent}50`, borderRadius:7, padding:"4px 10px", fontSize:14, fontWeight:600, color:textMain, outline:"none", fontFamily:"'Geist',sans-serif", width:200 }}
            />
          ) : (
            <button onClick={()=>setRenamingDash(true)}
              style={{ display:"flex", alignItems:"center", gap:7, background:"none", border:"none", cursor:"pointer", padding:"4px 8px", borderRadius:7, transition:"background 0.15s" }}
              onMouseEnter={e=>(e.currentTarget.style.background=dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)")}
              onMouseLeave={e=>(e.currentTarget.style.background="none")}
            >
              <span style={{ fontSize:14, fontWeight:600, color:textMain, letterSpacing:"-0.3px" }}>{dashboard.name}</span>
              <Pencil size={11} color={textSub} />
            </button>
          )}

          <div style={{ flex:1 }} />

          {/* Edit toggle */}
          <button onClick={()=>setEditMode(p=>!p)}
            style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"7px 15px", borderRadius:9, border:`1px solid ${editMode?`${accent}50`:border}`, background:editMode?`${accent}14`:"none", color:editMode?accent:textSub, fontSize:13, fontWeight:500, fontFamily:"'Geist',sans-serif", cursor:"pointer", transition:"all 0.2s" }}
          >
            <LayoutGrid size={13} /> {editMode ? "Done editing" : "Edit layout"}
          </button>

          {editMode && (
            <button onClick={()=>setShowAdd(true)}
              style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"7px 15px", borderRadius:9, border:"none", background:`linear-gradient(135deg,${accent},#a78bfa)`, color:"white", fontSize:13, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:"pointer", boxShadow:`0 3px 12px ${accent}40` }}
            >
              <Plus size={13} /> Add widget
            </button>
          )}

          <button onClick={load}
            style={{ display:"flex", alignItems:"center", padding:"7px", borderRadius:8, border:`1px solid ${border}`, background:"none", cursor:"pointer", color:textSub }}
            title="Reload dashboard"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {/* ── PAGE TABS ── */}
        <div style={{ display:"flex", alignItems:"center", gap:1, padding:"0 22px", borderBottom:`1px solid ${border}`, background:surface, flexShrink:0, overflowX:"auto" }}>
          {pages.map((page, idx) => (
            <div key={page.page_id} style={{ display:"flex", alignItems:"center" }}>
              {renamingPage === page.page_id ? (
                <input autoFocus value={newPageName}
                  onChange={e=>setNewPageName(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")handleRenamePage(page.page_id);if(e.key==="Escape")setRenamingPage(null)}}
                  onBlur={()=>handleRenamePage(page.page_id)}
                  style={{ background:"none", border:"none", borderBottom:`1px solid ${accent}`, outline:"none", fontSize:13, fontFamily:"'Geist',sans-serif", color:textMain, padding:"10px 12px", width:120 }}
                />
              ) : (
                <button
                  onClick={()=>setPageIdx(idx)}
                  onDoubleClick={()=>{ setRenamingPage(page.page_id); setNewPageName(page.name) }}
                  style={{ padding:"11px 16px", background:"none", border:"none", cursor:"pointer", fontSize:13, fontWeight:pageIdx===idx?500:400, color:pageIdx===idx?accent:textSub, borderBottom:pageIdx===idx?`2px solid ${accent}`:"2px solid transparent", transition:"all 0.15s", whiteSpace:"nowrap" }}
                >
                  {page.name}
                </button>
              )}
            </div>
          ))}
          {editMode && (
            <button onClick={handleAddPage}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"10px 13px", background:"none", border:"none", cursor:"pointer", fontSize:13, color:textSub, transition:"color 0.15s", flexShrink:0 }}
              onMouseEnter={e=>(e.currentTarget.style.color=accent)}
              onMouseLeave={e=>(e.currentTarget.style.color=textSub)}
            >
              <Plus size={12} /> Page
            </button>
          )}
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* Canvas */}
          <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:"20px 22px" }}>

            {editMode && (
              <div style={{ marginBottom:14, padding:"9px 14px", background:`${accent}0e`, border:`1px solid ${accent}22`, borderRadius:10, display:"flex", alignItems:"center", gap:9, animation:"db-fadeUp 0.2s ease" }}>
                <LayoutGrid size={13} color={accent} />
                <span style={{ fontSize:12.5, color:accent }}>Edit mode — drag ⠿ to move, drag ⤡ corner to resize. Double-click a tab to rename it.</span>
              </div>
            )}

            {/* Grid */}
            <div ref={gridRef} style={{ position:"relative", width:"100%", height:canvasH, minHeight:400 }}>

              {editMode && (
                <div style={{ position:"absolute", inset:0, backgroundImage:`linear-gradient(${dark?"rgba(124,107,255,0.05)":"rgba(0,0,0,0.04)"} 1px,transparent 1px),linear-gradient(90deg,${dark?"rgba(124,107,255,0.05)":"rgba(0,0,0,0.04)"} 1px,transparent 1px)`, backgroundSize:`${100/COLS}% ${ROW_H}px`, pointerEvents:"none", borderRadius:12 }} />
              )}

              {activePage?.widgets.length === 0 && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:360, gap:14, animation:"db-fadeUp 0.4s ease" }}>
                  <div style={{ width:52, height:52, borderRadius:16, background:`${accent}12`, border:`1px solid ${accent}22`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <BarChart3 size={22} color={accent} />
                  </div>
                  <h3 style={{ fontSize:17, fontWeight:600, color:textMain, margin:0 }}>Empty page</h3>
                  <p style={{ fontSize:13.5, color:textSub, margin:0, textAlign:"center", maxWidth:260, lineHeight:1.6 }}>
                    {editMode ? 'Click "Add widget" to get started.' : 'Enable "Edit layout" to add widgets.'}
                  </p>
                  {editMode && (
                    <button onClick={()=>setShowAdd(true)}
                      style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"9px 18px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${accent},#a78bfa)`, color:"white", fontSize:13, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:"pointer" }}
                    >
                      <Plus size={13} /> Add first widget
                    </button>
                  )}
                </div>
              )}

              {activePage?.widgets.map(widget => (
                <div key={widget.widget_id} style={{
                  position:"absolute",
                  left:`${(widget.pos_x/COLS)*100}%`,
                  top: widget.pos_y * ROW_H,
                  width:`${(widget.width/COLS)*100}%`,
                  height: widget.height * ROW_H,
                  display:"flex", flexDirection:"column",
                  background:surface, border:`1px solid ${editMode?`${accent}30`:border}`,
                  borderRadius:14, overflow:"hidden",
                  boxShadow:editMode?`0 0 0 2px ${accent}14`:(dark?"0 2px 12px rgba(0,0,0,0.2)":"0 2px 8px rgba(0,0,0,0.07)"),
                  userSelect:"none",
                  transition:"border-color 0.2s, box-shadow 0.2s",
                }}>
                  {/* Widget header */}
                  <div style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 12px", borderBottom:`1px solid ${border}`, background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)", flexShrink:0 }}>
                    {editMode && (
                      <div onMouseDown={e=>onDragStart(e, widget.widget_id)} style={{ cursor:"grab", color:textSub, flexShrink:0, display:"flex" }}>
                        <GripVertical size={13} />
                      </div>
                    )}

                    {/* Type icon */}
                    <div style={{ width:20, height:20, borderRadius:6, background:`${accent}16`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {widget.chart_type==="kpi"   && <Zap      size={11} color={accent} />}
                      {widget.chart_type==="bar"   && <BarChart3 size={11} color={accent} />}
                      {widget.chart_type==="line"  && <LineIcon  size={11} color={accent} />}
                      {widget.chart_type==="area"  && <LineIcon  size={11} color={accent} />}
                      {widget.chart_type==="pie"   && <PieIcon   size={11} color={accent} />}
                      {widget.chart_type==="table" && <Table2    size={11} color={accent} />}
                    </div>

                    <span style={{ fontSize:12.5, fontWeight:600, color:textMain, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {widget.title || widget.chart_type.toUpperCase()}
                    </span>

                    {/* Inline query editor toggle */}
                    <button
                      onClick={()=>setQueryWidget(queryWidget===widget.widget_id ? null : widget.widget_id)}
                      style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", padding:"2px 5px", borderRadius:5, color:queryWidget===widget.widget_id?accent:textSub, transition:"all 0.15s", flexShrink:0 }}
                      title="Edit & run query"
                    >
                      <Edit3 size={12} />
                    </button>

                    {/* Refresh */}
                    <button onClick={()=>runWidget(widget)} disabled={widget.fetching}
                      style={{ background:"none", border:"none", cursor:widget.fetching?"not-allowed":"pointer", display:"flex", alignItems:"center", padding:"2px 5px", borderRadius:5, color:textSub, transition:"all 0.15s", flexShrink:0, opacity:widget.fetching?0.4:1 }}
                      title="Re-run query"
                    >
                      {widget.fetching ? <Loader2 size={12} style={{ animation:"db-spin 1s linear infinite" }} /> : <RefreshCw size={12} />}
                    </button>

                    {editMode && (
                      <div style={{ position:"relative", flexShrink:0 }}>
                        <button
                          onClick={()=>{/* handled by inner menu */}}
                          style={{ display:"flex" }}
                        >
                          <span style={{ display:"none" }} />
                        </button>
                        {/* Menu inline */}
                        <WidgetMenu
                          dark={dark} border={border} textMain={textMain} textSub={textSub}
                          onEdit={()=>setEditWidget(widget)}
                          onDelete={()=>handleDeleteWidget(widget.widget_id)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Chart area */}
                  <div style={{ flex:1, padding:widget.chart_type==="table"?0:"10px 12px 8px", minHeight:0, overflow:"hidden" }}>
                    <ChartRenderer widget={widget} dark={dark} accent={accent} />
                  </div>

                  {/* Inline query editor */}
                  {queryWidget === widget.widget_id && (
                    <QueryEditor
                      widget={widget} projectId={projectId}
                      {...shared}
                      onDataUpdate={handleDataUpdate}
                      onClose={()=>setQueryWidget(null)}
                    />
                  )}

                  {/* Resize handle */}
                  {editMode && (
                    <div onMouseDown={e=>onResizeStart(e, widget.widget_id)}
                      style={{ position:"absolute", bottom:4, right:4, width:16, height:16, cursor:"se-resize", display:"flex", alignItems:"center", justifyContent:"center", color:`${accent}55` }}
                    >
                      <Maximize2 size={10} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── SIDE PANEL ── */}
          {(showAdd || editWidget) && (
            <div style={{ width:360, borderLeft:`1px solid ${border}`, background:surface, overflowY:"auto", flexShrink:0, animation:"db-slideIn 0.22s ease" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 20px", borderBottom:`1px solid ${border}` }}>
                <h3 style={{ fontSize:14, fontWeight:600, color:textMain, margin:0 }}>
                  {editWidget ? "Edit widget" : "Add widget"}
                </h3>
                <button onClick={()=>{setShowAdd(false);setEditWidget(null)}}
                  style={{ background:"none", border:"none", cursor:"pointer", color:textSub, display:"flex", padding:"4px", borderRadius:6 }}
                >
                  <X size={15} />
                </button>
              </div>
              <div style={{ padding:"18px 20px" }}>
                <WidgetForm
                  initial={editWidget||undefined}
                  onSave={editWidget?handleEditWidget:handleAddWidget}
                  onCancel={()=>{setShowAdd(false);setEditWidget(null)}}
                  saving={saving}
                  {...shared}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Tiny widget menu component to avoid closure stale state ──
function WidgetMenu({ dark, border, textMain, textSub, onEdit, onDelete }: {
  dark:boolean; border:string; textMain:string; textSub:string
  onEdit:()=>void; onDelete:()=>void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={()=>setOpen(p=>!p)}
        style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", padding:"2px 5px", borderRadius:5, color:textSub }}
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div style={{ position:"absolute", right:0, top:"calc(100% + 4px)", background:dark?"#1a1a28":"#ffffff", border:`1px solid ${border}`, borderRadius:10, overflow:"hidden", boxShadow:dark?"0 8px 24px rgba(0,0,0,0.5)":"0 8px 24px rgba(0,0,0,0.12)", minWidth:130, zIndex:300, animation:"db-slideDown 0.12s ease" }}>
          <button onClick={()=>{onEdit();setOpen(false)}}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"9px 14px", background:"none", border:"none", cursor:"pointer", fontSize:13, color:textMain, fontFamily:"'Geist',sans-serif" }}
            onMouseEnter={e=>(e.currentTarget.style.background=dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.04)")}
            onMouseLeave={e=>(e.currentTarget.style.background="none")}
          >
            <Pencil size={12} /> Edit
          </button>
          <button onClick={()=>{onDelete();setOpen(false)}}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"9px 14px", background:"none", border:"none", cursor:"pointer", fontSize:13, color:"#f87171", fontFamily:"'Geist',sans-serif" }}
            onMouseEnter={e=>(e.currentTarget.style.background="rgba(248,113,113,0.08)")}
            onMouseLeave={e=>(e.currentTarget.style.background="none")}
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </>
  )
}
