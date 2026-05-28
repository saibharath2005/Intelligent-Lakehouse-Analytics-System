"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useTheme } from "@/context/ThemeContext"
import { useToast } from "@/components/ui/ToastProvider"
import { getDashboards, renameDashboard, addWidget } from "@/api/dashboard"
import { updateWidget, deleteWidget, updatePageLayout } from "@/api/widget"
import { addPage, updatePage } from "@/api/dashboardPage"
import { getDatasets } from "@/api/project"
import type { Dataset } from "@/api/project"
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

type ApiChartType = "bar" | "line" | "area" | "pie" | "table" | "kpi"

interface ApiLayout { x: number; y: number; w: number; h: number }

interface ApiWidget {
  widget_id:  number
  chart_type: ApiChartType
  title?:     string | null
  x_axis:     string | null
  y_axis:     string | null
  layout:     ApiLayout
  data:       any[] | { error: string } | null
}

interface ApiPage {
  page_id: number
  name:    string
  widgets: ApiWidget[]
}

interface ApiDashboard {
  dashboard_id: number
  name:  string
  pages: ApiPage[]
}

// ─── CONSTANTS ───────────────────────────────────────────
const COLS   = 12
const ROW_H  = 100
const COLORS = ["#7c6bff","#34d399","#f59e0b","#ef4444","#3b82f6","#ec4899","#a78bfa","#10b981"]

// ─── DATA HELPERS ────────────────────────────────────────
const isErr      = (d: any): d is { error: string } => d && !Array.isArray(d) && typeof d === "object" && "error" in d
const isSparkOff = (d: any) => isErr(d) && (d.error.includes("10061") || d.error.includes("refused"))
const getRows    = (d: any): any[] | null => {
  if (!d || isErr(d)) return null
  if (Array.isArray(d)) return d
  return d.rows ?? d.data ?? null
}

export default function WidgetForm({ initial, onSave, onCancel, dark, accent, border, textMain, textSub }: any) {
  const [ct, setCt] = useState<ApiChartType>(initial?.chart_type || "bar")
  const [title, setTitle] = useState(initial?.title || "")
  const [xAxis, setXAxis] = useState(initial?.x_axis || "")
  const [yAxis, setYAxis] = useState(initial?.y_axis || "")
  const [w, setW] = useState(initial?.layout?.w || 4)
  const [h, setH] = useState(initial?.layout?.h || 3)

  const types: { id: ApiChartType; label: string; I: any }[] = [
    {id:"bar",I:BarChart3,label:"Bar"},
    {id:"line",I:LineChart,label:"Line"},
    {id:"area",I:LineChart,label:"Area"},
    {id:"pie",I:PieChart,label:"Pie"},
    {id:"table",I:Table2,label:"Table"},
    {id:"kpi",I:Type,label:"KPI"},
  ]

  const inp = (extra={}) => ({ width:"100%", boxSizing:"border-box" as const, background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)", border:`1px solid ${border}`, borderRadius:9, padding:"9px 12px", fontSize:13, fontFamily:"'Geist',sans-serif", color:textMain, outline:"none", transition:"border-color 0.15s", ...extra })
  const fo  = (e:any) => (e.currentTarget.style.borderColor = `${accent}55`)
  const bl  = (e:any) => (e.currentTarget.style.borderColor = border)
  const lbl = (t:string) => <span style={{ fontSize:11, fontWeight:600, color:textSub, textTransform:"uppercase" as const, letterSpacing:"0.05em" }}>{t}</span>

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Chart type picker */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {lbl("Chart type")}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:5 }}>
          {types.map(({id,label,I}) => (
            <button key={id} onClick={()=>setCt(id)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding:"10px 3px", borderRadius:9, border:`1px solid ${ct===id?`${accent}55`:border}`, background:ct===id?`${accent}10`:"none", cursor:"pointer", transition:"all 0.15s" }}>
              <I size={14} color={ct===id?accent:textSub}/>
              <span style={{ fontSize:10, fontWeight:500, color:ct===id?accent:textSub }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {lbl("Title")}
        <input style={inp()} placeholder="e.g. Flights by Airline" value={title} onChange={e=>setTitle(e.target.value)} onFocus={fo} onBlur={bl}/>
      </div>

      {/* Axes */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {lbl("X axis")}
          <input style={inp()} placeholder="Reporting_Airline" value={xAxis} onChange={e=>setXAxis(e.target.value)} onFocus={fo} onBlur={bl}/>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {lbl("Y axis")}
          <input style={inp()} placeholder="flight_count" value={yAxis} onChange={e=>setYAxis(e.target.value)} onFocus={fo} onBlur={bl}/>
        </div>
      </div>

      {/* Size */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {lbl(`Width — ${w}/12`)}
          <input type="range" min={2} max={12} value={w} onChange={e=>setW(Number(e.target.value))} style={{ accentColor:accent }}/>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {lbl(`Height — ${h} rows`)}
          <input type="range" min={2} max={8}  value={h} onChange={e=>setH(Number(e.target.value))} style={{ accentColor:accent }}/>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:"flex", gap:10, paddingTop:4 }}>
        <button onClick={()=>onSave({ chart_type:ct, title:title||null, x_axis:xAxis||null, y_axis:yAxis||null, _w:w, _h:h })}
          style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${accent},#a78bfa)`, color:"white", fontSize:13, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, boxShadow:`0 3px 12px ${accent}35` }}
        ><Check size={13}/> {initial?.widget_id?"Update":"Add widget"}</button>
        <button onClick={onCancel} style={{ padding:"10px 14px", borderRadius:10, border:`1px solid ${border}`, background:"none", color:textSub, fontSize:13, fontFamily:"'Geist',sans-serif", cursor:"pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  )
}