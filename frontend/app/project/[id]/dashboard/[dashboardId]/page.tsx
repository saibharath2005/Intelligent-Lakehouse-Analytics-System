"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useTheme } from "@/context/ThemeContext"
import { useToast } from "@/components/ui/ToastProvider"
import { getDashboards, renameDashboard, addWidget } from "@/api/dashboard"
import { updateWidget, deleteWidget, updatePageLayout } from "@/api/widget"
import { addPage, updatePage } from "@/api/dashboardPage"
import {
  Plus, Trash2, Check, X, ChevronLeft,
  BarChart3, LineChart, PieChart, Table2, Type,
  GripVertical, Loader2, Maximize2,
  RefreshCw, ChevronDown,
  MoreHorizontal, LayoutGrid, Pencil,
  AlertCircle, TrendingUp, TrendingDown, WifiOff,
} from "lucide-react"
import {
  BarChart, Bar,
  LineChart as ReLineChart, Line,
  PieChart as RePieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts"

// ─── EXACT API TYPES ─────────────────────────────────────
// Mirrors GET /dashboard/{project_id}
type ApiChartType = "bar" | "line" | "area" | "pie" | "table" | "kpi"

interface ApiLayout { x: number; y: number; w: number; h: number }
interface ChartLabels { x: string | null; y: string | null }
interface ApiWidget {
  widget_id: number
  chart_type: ApiChartType
  title?: string | null
  dataset_name: string
  query: string
  labels: ChartLabels
  layout: ApiLayout
  data: any[] | any | { error: string } | null
}

interface ApiPage {
  page_id: number
  name: string
  widgets: ApiWidget[]
}

interface ApiDashboard {
  dashboard_id: number
  name: string
  pages: ApiPage[]
}

// ─── CONSTANTS ───────────────────────────────────────────
const COLS = 12
const ROW_H = 100
const COLORS = ["#7c6bff", "#34d399", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#a78bfa", "#10b981"]

// ─── DATA HELPERS ────────────────────────────────────────
const isErr = (d: any): d is { error: string } => d && !Array.isArray(d) && typeof d === "object" && "error" in d
const isSparkOff = (d: any) => isErr(d) && (d.error.includes("10061") || d.error.includes("refused"))
const getRows = (d: any): any[] | null => {
  if (!d || isErr(d)) return null
  if (Array.isArray(d)) return d
  return d.rows ?? d.data ?? null
}

const extractRows = (d: any) => {
  if (!d) return null
  if (Array.isArray(d)) return d
  return d.rows ?? d.data ?? null
}
// ─── CHART RENDERER ──────────────────────────────────────
function ChartRenderer({ w, dark, accent, cw }: { w: ApiWidget; dark: boolean; accent: string; cw: number }) {
  const tc = dark ? "rgba(240,240,248,0.42)" : "rgba(15,15,26,0.42)"
  const gc = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"
  const tbg = dark ? "#1c1c2a" : "#fff"
  const tb = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"

  if (isSparkOff(w.data)) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 6 }}>
      <WifiOff size={16} color={tc} />
      <span style={{ fontSize: 11, color: tc }}>Spark offline</span>
    </div>
  )
  if (isErr(w.data)) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 6, padding: 10, textAlign: "center" }}>
      <AlertCircle size={14} color="#f87171" />
      <span style={{ fontSize: 11, color: "#f87171", lineHeight: 1.5 }}>{w.data.error.slice(0, 100)}</span>
    </div>
  )

  const rows = getRows(w.data)

  const axis = {
    tick: { fill: tc, fontSize: 11, fontFamily: "'Geist',sans-serif" },
    axisLine: { stroke: gc }, tickLine: false,
  }
  const tip = {
    contentStyle: { background: tbg, border: `1px solid ${tb}`, borderRadius: 10, fontSize: 12, fontFamily: "'Geist',sans-serif", boxShadow: dark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.1)" },
    labelStyle: { color: dark ? "#f0f0f8" : "#0f0f1a", fontWeight: 600, marginBottom: 4 },
    cursor: { fill: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" },
  }

  // KPI
  if (w.chart_type === "kpi") {
    console.log(w)
    let value: number | string = "—"

    if (
      w.data &&
      typeof w.data === "object" &&
      !Array.isArray(w.data) &&
      "value" in w.data
    ) {
      value = Number(w.data?.value ?? 0)
    } else {
      const rows = extractRows(w.data)
      if (rows?.length) {
        const key =
          w.labels.y ||
          Object.keys(rows[0]).find(k => !isNaN(Number(rows[0][k]))) ||
          Object.keys(rows[0])[0]

        const last = rows[rows.length - 1][key]
        const num = Number(last)

        value = !isNaN(num) ? num : last
      }
    }

    const fmt = (n: number) =>
      n >= 1e6
        ? (n / 1e6).toFixed(1) + "M"
        : n >= 1e3
          ? (n / 1e3).toFixed(1) + "K"
          : n.toLocaleString()

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: tc, textTransform: "uppercase", letterSpacing: "0.07em" }}>{w.labels.y}</span>

        <span style={{ fontFamily: "'Instrument Serif',serif", fontSize: w.layout.h >= 3 ? 52 : 34, fontWeight: 400, color: dark ? "#f0f0f8" : "#0f0f1a", letterSpacing: "-2px", lineHeight: 1 }}>
          {typeof value === "number" ? fmt(value) : value}
        </span>

        {w.data > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {w.data > 1 ? <TrendingUp size={12} color="#34d399" /> : <TrendingDown size={12} color="#f87171" />}
            <span style={{ fontSize: 12, fontWeight: 600, color: w.data > 1 ? "#34d399" : "#f87171" }}>
              {w.data > 1 ? "+" : ""}
              {typeof value === "number" ? fmt(value) : value}%
            </span>
            <span style={{ fontSize: 11, color: tc }}>vs prev</span>
          </div>
        )}

        <span style={{ fontSize: 10, color: dark ? "rgba(240,240,248,0.22)" : "rgba(15,15,26,0.28)", marginTop: 1 }}>
          {w.labels.y}
        </span>
      </div>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 6
      }}>
        <BarChart3 size={18} color={tc} />
        <span style={{ fontSize: 11, color: tc }}>No data</span>
      </div>
    )
  }
  const xk = w.labels.x ?? Object.keys(rows[0])[0]
  const yk = w.labels.y ?? Object.keys(rows[0]).find(k => k !== xk) ?? Object.keys(rows[0])[1]
  const parsed = rows.map(r => ({ ...r, [yk]: isNaN(Number(r[yk])) ? r[yk] : Number(r[yk]) }))


  // Table
  if (w.chart_type === "table") {
    const cols = Object.keys(parsed[0])
    return (
      <div style={{ height: "100%", overflowY: "auto", overflowX: "auto", scrollbarWidth: "thin" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'Geist',sans-serif" }}>
          <thead>
            <tr style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", position: "sticky", top: 0 }}>
              {cols.map(c => <th key={c} style={{ padding: "7px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: tc, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {parsed.slice(0, 100).map((row: any, i: number) => (
              <tr key={i} style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {cols.map(c => <td key={c} style={{ padding: "6px 12px", color: dark ? "rgba(240,240,248,0.75)" : "rgba(15,15,26,0.75)", whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{String(row[c] ?? "—")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Pie
  if (w.chart_type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart>
          <Pie data={parsed} dataKey={yk} nameKey={xk} cx="50%" cy="50%" outerRadius="65%"
            label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={{ stroke: tc, strokeWidth: 0.8 }} fontSize={cw * w.layout.w < 260 ? 9 : 11}
          >
            {parsed.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip {...tip} />
        </RePieChart>
      </ResponsiveContainer>
    )
  }

  // Area
  if (w.chart_type === "area") {
    const gid = `ag${w.widget_id}`
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={parsed} margin={{ top: 4, right: 6, left: -10, bottom: 0 }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={accent} stopOpacity={0.28} />
            <stop offset="95%" stopColor={accent} stopOpacity={0} />
          </linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gc} />
          <XAxis dataKey={xk} {...axis} /><YAxis {...axis} />
          <Tooltip {...tip} />
          <Area type="monotone" dataKey={yk} stroke={accent} strokeWidth={2} fill={`url(#${gid})`} dot={false} activeDot={{ r: 4, fill: accent }} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // Line
  if (w.chart_type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ReLineChart data={parsed} margin={{ top: 4, right: 6, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gc} />
          <XAxis dataKey={xk} {...axis} /><YAxis {...axis} />
          <Tooltip {...tip} />
          <Line type="monotone" dataKey={yk} stroke={accent} strokeWidth={2.5} dot={{ fill: accent, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </ReLineChart>
      </ResponsiveContainer>
    )
  }

  // Bar (default)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={parsed} margin={{ top: 4, right: 6, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gc} />
        <XAxis dataKey={xk} {...axis} /><YAxis {...axis} />
        <Tooltip {...tip} />
        <Bar dataKey={yk} fill={accent} radius={[4, 4, 0, 0]} background={{ fill: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }} />{/* ,radius:[4,4,0,0] */}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── WIDGET CARD ─────────────────────────────────────────
function WidgetCard({ w, editMode, dark, accent, surface, border, textMain, textSub, cw, onEdit, onDelete, onDrag, onResize }: any) {
  const [menu, setMenu] = useState(false)
  const ICONS: Record<ApiChartType, React.ReactNode> = {
    bar: <BarChart3 size={12} color={accent} />,
    line: <LineChart size={12} color={accent} />,
    area: <LineChart size={12} color={accent} />,
    pie: <PieChart size={12} color={accent} />,
    table: <Table2 size={12} color={accent} />,
    kpi: <Type size={12} color={accent} />,
  }
  const label = w.title || `${w.chart_type.toUpperCase()}${w.y_axis ? " · " + w.y_axis : ""}`

  return (
    <div style={{
      position: "absolute",
      left: w.layout.x * cw,
      top: w.layout.y * ROW_H,
      width: w.layout.w * cw - 8,
      height: w.layout.h * ROW_H - 8,
      background: surface, borderRadius: 14, overflow: "hidden",
      display: "flex", flexDirection: "column",
      border: `1px solid ${editMode ? `${accent}30` : border}`,
      boxShadow: editMode
        ? `0 0 0 1px ${accent}14, 0 4px 20px rgba(0,0,0,${dark ? 0.28 : 0.07})`
        : `0 2px 10px rgba(0,0,0,${dark ? 0.2 : 0.06})`,
      transition: "border-color 0.2s, box-shadow 0.2s",
      userSelect: "none",
    }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 11px", borderBottom: `1px solid ${border}`, background: dark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.015)", flexShrink: 0 }}>
        {editMode && (
          <div onMouseDown={onDrag} style={{ cursor: "grab", color: textSub, display: "flex", flexShrink: 0, padding: "1px 2px" }}>
            <GripVertical size={13} />
          </div>
        )}
        <div style={{ width: 20, height: 20, borderRadius: 5, background: `${accent}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {ICONS[w.chart_type as ApiChartType]}
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: textMain, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.2px" }}>{label}</span>

        {isSparkOff(w.data) && <WifiOff size={10} color={dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"} />}
        {isErr(w.data) && !isSparkOff(w.data) && <AlertCircle size={10} color="#f87171" />}

        {w.layout.w >= 3 && w.x_axis && (
          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9.5, color: textSub, background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>{w.x_axis}</span>
        )}

        {editMode && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setMenu(p => !p)} style={{ background: menu ? (dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)") : "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: "3px 4px", borderRadius: 5, color: textSub }}>
              <MoreHorizontal size={13} />
            </button>
            {menu && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: dark ? "#1c1c2a" : "#fff", border: `1px solid ${border}`, borderRadius: 10, overflow: "hidden", boxShadow: dark ? "0 8px 24px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.12)", minWidth: 120, zIndex: 200, animation: "slideDown 0.12s ease" }}>
                <button onClick={() => { onEdit(); setMenu(false) }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: textMain, fontFamily: "'Geist',sans-serif" }}
                  onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                ><Pencil size={12} /> Edit</button>
                <button onClick={() => { onDelete(); setMenu(false) }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "#f87171", fontFamily: "'Geist',sans-serif" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                ><Trash2 size={12} /> Delete</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: w.chart_type === "table" ? 0 : w.chart_type === "kpi" ? "6px 10px" : "6px 8px 4px", minHeight: 0, overflow: "hidden" }}>
        <ChartRenderer w={w} dark={dark} accent={accent} cw={cw} />
      </div>

      {/* Resize */}
      {editMode && (
        <div onMouseDown={onResize} style={{ position: "absolute", bottom: 3, right: 3, width: 16, height: 16, cursor: "se-resize", display: "flex", alignItems: "center", justifyContent: "center", color: `${accent}45` }}>
          <Maximize2 size={9} />
        </div>
      )}
    </div>
  )
}

// ─── WIDGET FORM ─────────────────────────────────────────
function WidgetForm({ initial, onSave, onCancel, dark, accent, border, textMain, textSub }: any) {
  const [ct, setCt] = useState<ApiChartType>(initial?.chart_type || "bar")
  const [title, setTitle] = useState(initial?.title || "")
  const [xAxis, setXAxis] = useState(initial?.x_axis || "")
  const [yAxis, setYAxis] = useState(initial?.y_axis || "")
  const [w, setW] = useState(initial?.layout?.w || 4)
  const [h, setH] = useState(initial?.layout?.h || 3)
  const [query, setQuery] = useState(initial?.query || "")
  const [dataset, setDataset] = useState(initial?.dataset_name || "")
  const types: { id: ApiChartType; label: string; I: any }[] = [
    { id: "bar", I: BarChart3, label: "Bar" },
    { id: "line", I: LineChart, label: "Line" },
    { id: "area", I: LineChart, label: "Area" },
    { id: "pie", I: PieChart, label: "Pie" },
    { id: "table", I: Table2, label: "Table" },
    { id: "kpi", I: Type, label: "KPI" },
  ]

  const inp = (extra = {}) => ({ width: "100%", boxSizing: "border-box" as const, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${border}`, borderRadius: 9, padding: "9px 12px", fontSize: 13, fontFamily: "'Geist',sans-serif", color: textMain, outline: "none", transition: "border-color 0.15s", ...extra })
  const fo = (e: any) => (e.currentTarget.style.borderColor = `${accent}55`)
  const bl = (e: any) => (e.currentTarget.style.borderColor = border)
  const lbl = (t: string) => <span style={{ fontSize: 11, fontWeight: 600, color: textSub, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{t}</span>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Chart type picker */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lbl("Chart type")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5 }}>
          {types.map(({ id, label, I }) => (
            <button key={id} onClick={() => setCt(id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 3px", borderRadius: 9, border: `1px solid ${ct === id ? `${accent}55` : border}`, background: ct === id ? `${accent}10` : "none", cursor: "pointer", transition: "all 0.15s" }}>
              <I size={14} color={ct === id ? accent : textSub} />
              <span style={{ fontSize: 10, fontWeight: 500, color: ct === id ? accent : textSub }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lbl("Title")}
        <input style={inp()} placeholder="e.g. Flights by Airline" value={title} onChange={e => setTitle(e.target.value)} onFocus={fo} onBlur={bl} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lbl("Dataset")}
        <input
          style={inp()}
          placeholder="dataset name"
          value={dataset}
          onChange={e => setDataset(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lbl("SQL Query")}
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="SELECT * FROM your_table LIMIT 100"
          style={{
            ...inp({ height: 100 }),
            resize: "none",
            fontFamily: "monospace"
          }}
        />
      </div>
      {/* Axes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lbl("X axis")}
          <input style={inp()} placeholder="Reporting_Airline" value={xAxis} onChange={e => setXAxis(e.target.value)} onFocus={fo} onBlur={bl} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lbl("Y axis")}
          <input style={inp()} placeholder="flight_count" value={yAxis} onChange={e => setYAxis(e.target.value)} onFocus={fo} onBlur={bl} />
        </div>
      </div>

      {/* Size */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {lbl(`Width — ${w}/12`)}
          <input type="range" min={2} max={12} value={w} onChange={e => setW(Number(e.target.value))} style={{ accentColor: accent }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {lbl(`Height — ${h} rows`)}
          <input type="range" min={2} max={8} value={h} onChange={e => setH(Number(e.target.value))} style={{ accentColor: accent }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button onClick={() => onSave({ chart_type: ct, title: title || null, x_axis: xAxis || null, y_axis: yAxis || null, dataset_name: dataset, query, _w: w, _h: h })}
          style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${accent},#a78bfa)`, color: "white", fontSize: 13, fontWeight: 600, fontFamily: "'Geist',sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: `0 3px 12px ${accent}35` }}
        ><Check size={13} /> {initial?.widget_id ? "Update" : "Add widget"}</button>
        <button onClick={onCancel} style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${border}`, background: "none", color: textSub, fontSize: 13, fontFamily: "'Geist',sans-serif", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────
export default function DashboardViewPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const dashId = Number(params.dashboardId)

  const [history, setHistory] = useState<ApiPage[]>([])
  const [future, setFuture] = useState<ApiPage[]>([])
  const [dirty, setDirty] = useState(false)

  const { effective, accentColor: accent } = useTheme()
  const dark = effective === "dark"
  const toast = useToast()

  const surface = dark ? "#13131e" : "#ffffff"
  const border = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"
  const textMain = dark ? "#f0f0f8" : "#0f0f1a"
  const textSub = dark ? "rgba(240,240,248,0.38)" : "rgba(15,15,26,0.45)"

  const [dash, setDash] = useState<ApiDashboard | null>(null)
  const [page, setPage] = useState<ApiPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editW, setEditW] = useState<ApiWidget | null>(null)
  const [rPage, setRPage] = useState<number | null>(null)
  const [rPageV, setRPageV] = useState("")
  const [rDash, setRDash] = useState(false)
  const [dashN, setDashN] = useState("")

  const gridRef = useRef<HTMLDivElement>(null)
  const colW = useRef(80)

  useEffect(() => {
    const upd = () => { if (gridRef.current) colW.current = gridRef.current.offsetWidth / COLS }
    upd()
    const ro = new ResizeObserver(upd)
    if (gridRef.current) ro.observe(gridRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { load() }, [dashId])

  async function load() {
    setLoading(true)
    try {
      // GET /dashboard/{project_id} — find our dashboard_id
      const res = await getDashboards(projectId)
      let d: ApiDashboard | null = null
      if (Array.isArray(res)) {
        d = res.find((x: ApiDashboard) => x.dashboard_id === dashId) ?? res[0] ?? null
      } else if (res?.dashboard_id) {
        d = res as ApiDashboard
      } else if (res?.dashboards) {
        d = res.dashboards.find((x: ApiDashboard) => x.dashboard_id === dashId) ?? res.dashboards[0] ?? null
      }
      if (d) { setDash(d); setDashN(d.name); setPage(d.pages?.[0] ?? null) }
    } catch { toast.error("Failed to load dashboard") }
    finally { setLoading(false) }
  }

  function switchPage(p: ApiPage) { setPage(p) }
  function pushHistory(newPage: ApiPage) {
    setHistory(prev => [...prev, structuredClone(newPage)])
    setFuture([])
    setDirty(true)
  }

  function handleUndo() {
    if (!history.length || !page) return
    const prev = history[history.length - 1]

    setFuture(f => [page, ...f])
    setHistory(h => h.slice(0, -1))
    setPage(prev)
  }

  function handleRedo() {
    if (!future.length || !page) return
    const next = future[0]

    setHistory(h => [...h, page])
    setFuture(f => f.slice(1))
    setPage(next)
  }
  async function saveLayout(pg: ApiPage) {
    try {
      await updatePageLayout(pg.page_id, pg.widgets.map(w => ({
        widget_id: w.widget_id, pos_x: w.layout.x, pos_y: w.layout.y, width: w.layout.w, height: w.layout.h
      })))
    } catch { }
  }

  // Drag
  function onDrag(e: React.MouseEvent, wid: number) {
    e.preventDefault()

    if (page) pushHistory(page)

    const wg = page?.widgets.find(x => x.widget_id === wid); if (!wg) return
    const sx = e.clientX, sy = e.clientY, ox = wg.layout.x, oy = wg.layout.y

    const mv = (me: MouseEvent) => {
      const cw = colW.current
      const nx = Math.max(0, Math.min(COLS - wg.layout.w, ox + Math.round((me.clientX - sx) / cw)))
      const ny = Math.max(0, oy + Math.round((me.clientY - sy) / ROW_H))

      setPage(p => p ? {
        ...p,
        widgets: p.widgets.map(pw =>
          pw.widget_id === wid ? { ...pw, layout: { ...pw.layout, x: nx, y: ny } } : pw
        )
      } : p)
    }

    const up = () => {
      document.removeEventListener("mousemove", mv)
      document.removeEventListener("mouseup", up)
    }

    document.addEventListener("mousemove", mv)
    document.addEventListener("mouseup", up)
  }

  // Resize
  function onResize(e: React.MouseEvent, wid: number) {
    e.preventDefault()
    e.stopPropagation()

    if (page) pushHistory(page) // ✅ ADD

    const wg = page?.widgets.find(x => x.widget_id === wid); if (!wg) return
    const sx = e.clientX, sy = e.clientY, ow = wg.layout.w, oh = wg.layout.h

    const mv = (me: MouseEvent) => {
      const cw = colW.current
      const nw = Math.max(2, Math.min(COLS - wg.layout.x, ow + Math.round((me.clientX - sx) / cw)))
      const nh = Math.max(2, Math.min(8, oh + Math.round((me.clientY - sy) / ROW_H)))

      setPage(p => p ? {
        ...p,
        widgets: p.widgets.map(pw =>
          pw.widget_id === wid ? { ...pw, layout: { ...pw.layout, w: nw, h: nh } } : pw
        )
      } : p)
    }

    const up = () => {
      document.removeEventListener("mousemove", mv)
      document.removeEventListener("mouseup", up)
    }

    document.addEventListener("mousemove", mv)
    document.addEventListener("mouseup", up)
  }

  // Add widget
  async function handleAdd(data: any) {
    if (!page) return
    setSaving(true)
    try {
      const maxY = page.widgets.reduce((m, w) => Math.max(m, w.layout.y + w.layout.h), 0)
      const res = await addWidget(page.page_id, { chart_type: data.chart_type, title: data.title, dataset_name: data.dataset_name, query: data.query, x_axis: data.x_axis, y_axis: data.y_axis, pos_x: 0, pos_y: maxY, width: data._w, height: data._h })
      const nw: ApiWidget = { widget_id: res.widget_id || res.id || Date.now(), chart_type: data.chart_type, title: data.title, dataset_name: data.dataset_name, query: data.query, labels: { x: data.x_axis, y: data.y_axis }, layout: { x: 0, y: maxY, w: data._w, h: data._h }, data: null }
      setPage(p => {
        const np = p ? { ...p, widgets: [...p.widgets, nw] } : p
        if (np) pushHistory(np)
        return np
      })
      toast.success("Widget added!"); setShowAdd(false)
    } catch (err: any) { toast.error("Failed: " + err.message) }
    finally { setSaving(false) }
  }

  // Edit widget
  async function handleEditW(data: any) {
    if (!editW) return
    setSaving(true)
    try {
      await updateWidget(editW.widget_id, {
        chart_type: data.chart_type,
        dataset_name: data.dataset_name,
        query: data.query,
        x_axis: data.x_axis ?? undefined,
        y_axis: data.y_axis ?? undefined,
        width: data._w,
        height: data._h
      })
      setPage(p => p ? { ...p, widgets: p.widgets.map(w => w.widget_id === editW.widget_id ? { ...w, ...data, layout: { ...w.layout, w: data._w, h: data._h } } : w) } : p)
      toast.success("Updated!"); setEditW(null)
    } catch (err: any) { toast.error("Failed: " + err.message) }
    finally { setSaving(false) }
  }

  // Delete widget
  async function handleDelW(wid: number) {
    if (!confirm("Delete this widget?")) return
    try {
      await deleteWidget(wid)
      setPage(p => {
        const np = p ? { ...p, widgets: p.widgets.filter(w => w.widget_id !== wid) } : p
        if (np) pushHistory(np)
        return np
      })
      toast.success("Deleted")
    } catch (err: any) { toast.error("Failed: " + err.message) }
  }

  // Add page
  async function handleAddPage() {
    if (!dash) return
    try {
      const res = await addPage(dash.dashboard_id, { name: `Page ${(dash.pages?.length ?? 0) + 1}`, page_order: dash.pages?.length ?? 0 })
      const np: ApiPage = { page_id: res.page_id || res.id || Date.now(), name: res.name || "New page", widgets: [] }
      setDash(d => d ? { ...d, pages: [...(d.pages || []), np] } : d)
      setPage(np); toast.success("Page added")
    } catch (err: any) { toast.error("Failed: " + err.message) }
  }

  // Rename page
  async function handleRenPage(pid: number) {
    if (!rPageV.trim()) { setRPage(null); return }
    try {
      await updatePage(pid, { name: rPageV.trim() })
      setDash(d => d ? { ...d, pages: d.pages.map(p => p.page_id === pid ? { ...p, name: rPageV.trim() } : p) } : d)
      setPage(p => p?.page_id === pid ? { ...p, name: rPageV.trim() } : p)
    } catch { } finally { setRPage(null) }
  }

  // Rename dash
  async function handleRenDash() {
    if (!dashN.trim() || !dash) { setRDash(false); return }
    try {
      await renameDashboard(dash.dashboard_id, { name: dashN.trim() })
      setDash(d => d ? { ...d, name: dashN.trim() } : d)
    } catch { } finally { setRDash(false) }
  }

  const canvasH = useMemo(() => {
    return (page?.widgets.reduce(
      (m, w) => Math.max(m, (w.layout.y + w.layout.h) * ROW_H),
      0
    ) ?? 0) + 80
  }, [page])
  const sparkDown = page?.widgets.some(w => isSparkOff(w.data)) ?? false

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", gap: 12, fontFamily: "'Geist',sans-serif", background: dark ? "#0d0d14" : "#f0f0f8", color: textSub }}>
      <Loader2 size={20} color={accent} style={{ animation: "spin 1s linear infinite" }} />
      <span>Loading…</span>
    </div>
  )
  if (!dash) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 12, fontFamily: "'Geist',sans-serif", background: dark ? "#0d0d14" : "#f0f0f8" }}>
      <AlertCircle size={22} color="#f87171" />
      <p style={{ color: textSub, fontSize: 13 }}>Dashboard not found</p>
      <Link href={`/project/${projectId}`} style={{ fontSize: 13, color: accent, textDecoration: "none" }}>← Back</Link>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap');
        @keyframes fadeUp    {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin      {from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideDown {from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideRight{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
        *,*::before,*::after{box-sizing:border-box}
        input[type=range]{width:100%;accent-color:${accent}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"};border-radius:3px}
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", fontFamily: "'Geist',sans-serif", background: dark ? "#0d0d14" : "#f0f0f8", color: textMain, transition: "background 0.3s" }}>

        {/* ══ TOP BAR ══ */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 18px", height: 52, borderBottom: `1px solid ${border}`, background: surface, flexShrink: 0, transition: "background 0.3s, border-color 0.3s" }}>
          <Link href={`/project/${projectId}`}
            style={{ display: "flex", alignItems: "center", gap: 4, color: textSub, textDecoration: "none", fontSize: 13, padding: "5px 8px", borderRadius: 7, transition: "all 0.15s", flexShrink: 0 }}
            onMouseEnter={e => { (e.currentTarget as any).style.color = accent; (e.currentTarget as any).style.background = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
            onMouseLeave={e => { (e.currentTarget as any).style.color = textSub; (e.currentTarget as any).style.background = "none" }}
          >
            <ChevronLeft size={14} /> Project
          </Link>

          <span style={{ color: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)", fontSize: 16, flexShrink: 0 }}>/</span>

          {rDash ? (
            <input autoFocus value={dashN} onChange={e => setDashN(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleRenDash(); if (e.key === "Escape") setRDash(false) }}
              onBlur={handleRenDash}
              style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", border: `1px solid ${accent}50`, borderRadius: 7, padding: "5px 10px", fontSize: 14, fontWeight: 600, color: textMain, outline: "none", fontFamily: "'Geist',sans-serif", width: 200 }}
            />
          ) : (
            <button onClick={() => setRDash(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "5px 8px", borderRadius: 7, transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: textMain, letterSpacing: "-0.3px" }}>{dash.name}</span>
              <Pencil size={11} color={textSub} />
            </button>
          )}

          <div style={{ flex: 1 }} />

          {sparkDown && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: 8 }}>
              <WifiOff size={11} color="#f87171" />
              <span style={{ fontSize: 11.5, color: "#f87171", fontFamily: "'Geist Mono',monospace" }}>Spark offline — showing cached data</span>
            </div>
          )}

          <button onClick={() => { setEdit(p => !p); setShowAdd(false); setEditW(null) }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: `1px solid ${edit ? `${accent}50` : border}`, background: edit ? `${accent}12` : "none", color: edit ? accent : textSub, fontSize: 13, fontWeight: 500, fontFamily: "'Geist',sans-serif", cursor: "pointer", transition: "all 0.2s" }}
          >
            <LayoutGrid size={13} /> {edit ? "Editing" : "Edit"}
          </button>
          <button
            onClick={async () => {
              if (!page) return
              setSaving(true)
              try {
                await updatePageLayout(
                  page.page_id,
                  page.widgets.map(w => ({
                    widget_id: w.widget_id,
                    pos_x: w.layout.x,
                    pos_y: w.layout.y,
                    width: w.layout.w,
                    height: w.layout.h
                  }))
                )
                await Promise.all(
                  page.widgets.map(w =>
                    updateWidget(w.widget_id, {
                      chart_type: w.chart_type,
                      dataset_name: w.dataset_name,
                      query: w.query,
                      x_axis: w.labels.x,
                      y_axis: w.labels.y,
                      width: w.layout.w,
                      height: w.layout.h
                    })
                  )
                )
                setDirty(false)
                toast.success("Saved successfully")
              } catch {
                toast.error("Save failed")
              } finally {
                setSaving(false)
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 13px",
              borderRadius: 9,
              border: `1px solid ${dirty ? accent : border}`,
              background: dirty ? `${accent}12` : "none",
              color: dirty ? accent : textSub,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {saving ? <Loader2 size={13} /> : <Check size={13} />}
            {dirty ? "Save changes" : "Saved"}
          </button>

          {edit && (
            <button onClick={() => { setShowAdd(true); setEditW(null) }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${accent},#a78bfa)`, color: "white", fontSize: 13, fontWeight: 600, fontFamily: "'Geist',sans-serif", cursor: "pointer", boxShadow: `0 3px 12px ${accent}40`, animation: "fadeUp 0.18s ease" }}
            >
              <Plus size={13} /> Add widget
            </button>
          )}

          <button onClick={load}
            style={{ display: "flex", alignItems: "center", padding: 8, borderRadius: 8, border: `1px solid ${border}`, background: "none", cursor: "pointer", color: textSub, transition: "all 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={handleUndo}
            disabled={!history.length}
            style={{ opacity: history.length ? 1 : 0.4 }}
          >
            Undo
          </button>

          <button
            onClick={handleRedo}
            disabled={!future.length}
            style={{ opacity: future.length ? 1 : 0.4 }}
          >
            Redo
          </button>
        </div>

        {/* ══ PAGE TABS ══ */}
        <div style={{ display: "flex", alignItems: "stretch", padding: "0 18px", borderBottom: `1px solid ${border}`, background: surface, flexShrink: 0, overflowX: "auto", transition: "background 0.3s, border-color 0.3s" }}>
          {(dash.pages || []).map(pg => (
            <div key={pg.page_id} style={{ display: "flex", alignItems: "center" }}>
              {rPage === pg.page_id ? (
                <input autoFocus value={rPageV} onChange={e => setRPageV(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRenPage(pg.page_id); if (e.key === "Escape") setRPage(null) }}
                  onBlur={() => handleRenPage(pg.page_id)}
                  style={{ background: "none", border: "none", borderBottom: `1px solid ${accent}`, outline: "none", fontSize: 13, fontFamily: "'Geist',sans-serif", color: textMain, padding: "10px 12px", width: 110 }}
                />
              ) : (
                <button
                  onClick={() => switchPage(pg)}
                  onDoubleClick={() => { setRPage(pg.page_id); setRPageV(pg.name) }}
                  style={{ padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: page?.page_id === pg.page_id ? 600 : 400, color: page?.page_id === pg.page_id ? accent : textSub, borderBottom: page?.page_id === pg.page_id ? `2px solid ${accent}` : "2px solid transparent", transition: "all 0.15s", whiteSpace: "nowrap" }}
                >
                  {pg.name}
                </button>
              )}
            </div>
          ))}
          {edit && (
            <button onClick={handleAddPage}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 13px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: textSub, transition: "color 0.15s", flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = accent)}
              onMouseLeave={e => (e.currentTarget.style.color = textSub)}
            >
              <Plus size={12} /> Page
            </button>
          )}
        </div>

        {/* ══ CONTENT ══ */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Canvas */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "18px 18px 48px", background: dark ? "#0d0d14" : "#f0f0f8", transition: "background 0.3s" }}>

            {edit && (
              <div style={{ marginBottom: 12, padding: "8px 13px", background: `${accent}0c`, border: `1px solid ${accent}20`, borderRadius: 9, display: "flex", alignItems: "center", gap: 8, animation: "fadeUp 0.18s ease" }}>
                <LayoutGrid size={12} color={accent} />
                <span style={{ fontSize: 12, color: accent }}>Drag ⠿ to move · Drag ⤢ to resize · Double-click page tab to rename</span>
              </div>
            )}

            <div ref={gridRef} style={{ position: "relative", width: "100%", height: canvasH }}>

              {/* Grid overlay */}
              {edit && (
                <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${dark ? "rgba(124,107,255,0.04)" : "rgba(0,0,0,0.03)"} 1px,transparent 1px),linear-gradient(90deg,${dark ? "rgba(124,107,255,0.04)" : "rgba(0,0,0,0.03)"} 1px,transparent 1px)`, backgroundSize: `${100 / COLS}% ${ROW_H}px`, pointerEvents: "none", borderRadius: 10 }} />
              )}

              {!page?.widgets?.length && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 380, gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: `${accent}12`, border: `1px solid ${accent}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <BarChart3 size={22} color={accent} />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: textMain, margin: 0 }}>Empty dashboard</h3>
                  <p style={{ fontSize: 13, color: textSub, margin: 0, textAlign: "center", maxWidth: 240, lineHeight: 1.65 }}>
                    {edit ? 'Click "Add widget" to get started.' : "Enable Edit mode to add widgets."}
                  </p>
                  {edit && (
                    <button onClick={() => setShowAdd(true)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${accent},#a78bfa)`, color: "white", fontSize: 13, fontWeight: 600, fontFamily: "'Geist',sans-serif", cursor: "pointer", boxShadow: `0 4px 14px ${accent}40` }}
                    ><Plus size={14} /> Add first widget</button>
                  )}
                </div>
              )}

              {page?.widgets.map(w => (
                <WidgetCard
                  key={w.widget_id} w={w} editMode={edit}
                  dark={dark} accent={accent} surface={surface}
                  border={border} textMain={textMain} textSub={textSub}
                  cw={colW.current}
                  onEdit={() => { setEditW(w); setShowAdd(false) }}
                  onDelete={() => handleDelW(w.widget_id)}
                  onDrag={(e: React.MouseEvent) => onDrag(e, w.widget_id)}
                  onResize={(e: React.MouseEvent) => onResize(e, w.widget_id)}
                />
              ))}
            </div>
          </div>

          {/* Side panel */}
          {(showAdd || editW) && (
            <div style={{ width: 330, borderLeft: `1px solid ${border}`, background: surface, overflowY: "auto", flexShrink: 0, animation: "slideRight 0.2s ease", transition: "background 0.3s, border-color 0.3s", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: textMain, margin: 0 }}>{editW ? "Edit widget" : "Add widget"}</h3>
                  {editW && <p style={{ fontSize: 11, color: textSub, margin: "3px 0 0" }}>#{editW.widget_id} · {editW.chart_type}</p>}
                </div>
                <button onClick={() => { setShowAdd(false); setEditW(null) }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: textSub, display: "flex", padding: 5, borderRadius: 6, transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                ><X size={14} /></button>
              </div>
              <div style={{ padding: "16px 18px", flex: 1 }}>
                <WidgetForm
                  initial={editW || undefined}
                  onSave={editW ? handleEditW : handleAdd}
                  onCancel={() => { setShowAdd(false); setEditW(null) }}
                  dark={dark} accent={accent} border={border} textMain={textMain} textSub={textSub}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
