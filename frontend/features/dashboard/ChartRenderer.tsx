"use client"

import React, { useMemo } from "react"
import {
  BarChart, Bar,
  LineChart as ReLineChart, Line,
  PieChart as RePieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts"
import { AlertCircle, WifiOff, TrendingUp, TrendingDown, BarChart3 } from "lucide-react"

const COLORS = ["#7c6bff", "#34d399", "#f59e0b", "#ef4444"]

const isErr = (d: any) => d && typeof d === "object" && !Array.isArray(d) && "error" in d
const isSparkOff = (d: any) => isErr(d) && d.error.includes("refused")

const getRows = (d: any) => {
  if (!d || isErr(d)) return null
  if (Array.isArray(d)) return d
  return d.rows ?? d.data ?? null
}

const ChartRenderer = React.memo(function ChartRenderer({ w, dark, accent, cw }: any) {
  const rows = useMemo(() => getRows(w.data), [w.data])

  const tc = dark ? "#aaa" : "#555"
  const gc = dark ? "#222" : "#eee"

  // 🚀 KPI FIX (CLEAN)
  if (w.chart_type === "kpi") {
    let value = 0

    if (w.data && typeof w.data === "object" && "value" in w.data) {
      value = Number(w.data.value ?? 0)
    }

    const fmt = (n: number) =>
      n >= 1e6 ? (n / 1e6).toFixed(1) + "M"
      : n >= 1e3 ? (n / 1e3).toFixed(1) + "K"
      : n.toLocaleString()

    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <span style={{ fontSize: 12, color: tc }}>{w.title || "KPI"}</span>
        <span style={{ fontSize: 42 }}>{fmt(value)}</span>
      </div>
    )
  }

  if (!rows || !rows.length) {
    return <div style={{ textAlign: "center", padding: 20, color: tc }}>No Data</div>
  }

  const xk = w.x_axis ?? Object.keys(rows[0])[0]
  const yk = w.y_axis ?? Object.keys(rows[0])[1]

  const parsed = useMemo(() => {
    return rows.map((r: any) => ({
      ...r,
      [yk]: Number(r[yk]) || 0,
    }))
  }, [rows, yk])

  // BAR
  if (w.chart_type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={parsed}>
          <CartesianGrid stroke={gc} />
          <XAxis dataKey={xk} />
          <YAxis />
          <Tooltip />
          <Bar dataKey={yk} fill={accent} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // LINE
  if (w.chart_type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ReLineChart data={parsed}>
          <CartesianGrid stroke={gc} />
          <XAxis dataKey={xk} />
          <YAxis />
          <Tooltip />
          <Line dataKey={yk} stroke={accent} />
        </ReLineChart>
      </ResponsiveContainer>
    )
  }

  // PIE
  if (w.chart_type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart>
          <Pie data={parsed} dataKey={yk} nameKey={xk}>
            {parsed.map((_: any, i: number) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
        </RePieChart>
      </ResponsiveContainer>
    )
  }

  return null
})

export default ChartRenderer