"use client"

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useTheme } from "@/context/ThemeContext"
import { useToast } from "@/components/ui/ToastProvider"
import { useProject } from "@/components/project/ProjectContext"
import ProjectPageShell from "@/components/project/ProjectPageShell"
import { uploadDataset, deleteDataset, previewDataset } from "@/api/dataset"
import type { Dataset } from "@/api/project"
import {
  Upload, Trash2, FileText, Clock, Loader2,
  Database, CheckCircle, AlertCircle, RefreshCw, X
} from "lucide-react"

function relTime(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  ready: { color: "#34d399", bg: "rgba(52,211,153,0.1)", label: "Ready" },
  processing: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Processing" },
  error: { color: "#f87171", bg: "rgba(248,113,113,0.1)", label: "Error" },
  pending: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Pending" },
}

export default function DatasetsPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { effective, accentColor } = useTheme()
  const { project, loading: projLoading, refetch } = useProject()
  const toast = useToast()
  const dark = effective === "dark"

  const surface = dark ? "#13131e" : "#ffffff"
  const border = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"
  const textMain = dark ? "#f0f0f8" : "#0f0f1a"
  const textSub = dark ? "rgba(240,240,248,0.4)" : "rgba(15,15,26,0.45)"

  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingPreviewId, setLoadingPreviewId] = useState<number | null>(null)
   const [previewLoading, setPreviewLoading] = useState(false)

  // Use datasets from project context
  const datasets: Dataset[] = project?.datasets ?? []

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadDataset(projectId, file)
      toast.success(`"${file.name}" uploaded!`)
      refetch() // refresh project context so datasets list updates
    } catch (err: any) {
      toast.error("Upload failed: " + err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }
  async function handlePreview(id: number) {
    setLoadingPreview(true)
    setLoadingPreviewId(id)
    setOpen(true)
    try {
      const data = await previewDataset(id)
      setPreview(data)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await deleteDataset(id)
      toast.success("Dataset deleted")
      refetch()
    } catch (err: any) {
      toast.error("Failed: " + err.message)
    } finally {
      setDeleting(null)
    }
  }

  const uploadBtn = (
    <>
      <input ref={fileRef} id="ds-upload" type="file" accept=".csv,.xlsx,.json,.tsv" onChange={handleUpload} style={{ display: "none" }} />
      <label htmlFor="ds-upload" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, background: `linear-gradient(135deg,${accentColor},#a78bfa)`, color: "white", fontSize: 13, fontWeight: 600, fontFamily: "'Geist',sans-serif", cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.65 : 1, boxShadow: `0 3px 12px ${accentColor}35`, transition: "all 0.15s", userSelect: "none" }}>
        {uploading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={13} />}
        {uploading ? "Uploading…" : "Upload dataset"}
      </label>
    </>
  )

  return (
    <ProjectPageShell projectId={projectId} section="Datasets" action={uploadBtn}>

      {/* Stats row */}
      {!projLoading && project && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total datasets", value: datasets.length },
            { label: "Ready", value: datasets.filter(d => d.status === "ready").length, color: "#34d399" },
            { label: "Processing", value: datasets.filter(d => d.status === "processing").length, color: "#f59e0b" },
          ].map(stat => (
            <div key={stat.label} style={{ flex: 1, background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 4, transition: "background 0.3s, border-color 0.3s" }}>
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 24, fontWeight: 600, color: stat.color || textMain, letterSpacing: "-1px" }}>{stat.value}</span>
              <span style={{ fontSize: 11, color: textSub, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden", transition: "background 0.3s, border-color 0.3s" }}>

        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 130px 80px 40px", padding: "10px 18px", borderBottom: `1px solid ${border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" }}>
          {["Name", "Status", "Uploaded", "ID", ""].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: dark ? "rgba(240,240,248,0.35)" : "rgba(15,15,26,0.4)", letterSpacing: "0.07em", textTransform: "uppercase" }}>{h}</span>
          ))}
        </div>

        {/* Loading skeletons */}
        {projLoading && [1, 2, 3].map(i => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 130px 80px 40px", padding: "14px 18px", borderBottom: `1px solid ${border}`, gap: 0 }}>
            {[["70%", "32px"], ["60px", "20px"], ["80px", "20px"], ["30px", "20px"], ["20px", "20px"]].map(([w, h], j) => (
              <div key={j} style={{ width: w, height: h, borderRadius: 6, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", animation: "pulse 1.5s ease infinite" }} />
            ))}
          </div>
        ))}

        {/* Empty */}
        {!projLoading && datasets.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center", gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `${accentColor}14`, border: `1px solid ${accentColor}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Database size={22} color={accentColor} />
            </div>
            <h3 style={{ fontFamily: "'Instrument Serif',serif", fontSize: 20, fontWeight: 400, color: textMain, margin: 0 }}>No datasets yet</h3>
            <p style={{ fontSize: 13, color: textSub, margin: 0, maxWidth: 260, lineHeight: 1.65 }}>Upload a CSV, Excel or JSON file to get started with AI analysis.</p>
            <label htmlFor="ds-upload" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 10, background: `linear-gradient(135deg,${accentColor},#a78bfa)`, color: "white", fontSize: 13, fontWeight: 600, fontFamily: "'Geist',sans-serif", cursor: "pointer", boxShadow: `0 4px 14px ${accentColor}40` }}>
              <Upload size={14} /> Upload first dataset
            </label>
          </div>
        )}

        {/* Rows */}
        {!projLoading && datasets.map((ds, i) => {
          const s = STATUS[ds.status] || STATUS.ready
          return (
            <div key={ds.id}
              style={{ display: "grid", gridTemplateColumns: "1fr 120px 130px 80px 40px", alignItems: "center", padding: "13px 18px", borderBottom: i < datasets.length - 1 ? `1px solid ${border}` : "none", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {/* Name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accentColor}14`, border: `1px solid ${accentColor}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FileText size={15} color={accentColor} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: textMain, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ds.name}</span>
              </div>

              {/* Status */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: s.bg, width: "fit-content" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, animation: ds.status === "processing" ? "pulse 1.2s ease infinite" : "none" }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{s.label}</span>
              </div>

              {/* Uploaded */}
              <span style={{ fontSize: 12, color: textSub, display: "flex", alignItems: "center", gap: 5 }}>
                <Clock size={11} />{relTime(ds.created_at)}
              </span>

              {/* ID */}
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: textSub }}>#{ds.id}</span>

            <div className="flex ">
              {/* Preview */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handlePreview(ds.id)
                }}
                disabled={loadingPreviewId === ds.id}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 5,
                  borderRadius: 6,
                  color: dark
                    ? "rgba(240,240,248,0.2)"
                    : "rgba(15,15,26,0.2)",
                  display: "flex",
                  alignItems: "center",
                  transition: "all 0.15s"
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as any).style.color = "#3b82f6"
                    ; (e.currentTarget as any).style.background =
                      "rgba(59,130,246,0.1)"
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as any).style.color = dark
                    ? "rgba(240,240,248,0.2)"
                    : "rgba(15,15,26,0.2)"
                    ; (e.currentTarget as any).style.background = "none"
                }}
              >
                {loadingPreviewId === ds.id ? (
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <FileText size={14} />
                )}
              </button>
              {/* Delete */}
              <button onClick={() => handleDelete(ds.id, ds.name)} disabled={deleting === ds.id}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 5, borderRadius: 6, color: dark ? "rgba(240,240,248,0.2)" : "rgba(15,15,26,0.2)", display: "flex", alignItems: "center", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as any).style.color = "#f87171"; (e.currentTarget as any).style.background = "rgba(248,113,113,0.1)" }}
                onMouseLeave={e => { (e.currentTarget as any).style.color = dark ? "rgba(240,240,248,0.2)" : "rgba(15,15,26,0.2)"; (e.currentTarget as any).style.background = "none" }}
              >
                {deleting === ds.id ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={14} />}
              </button>
              </div>

            </div>
          )
        })}
      </div>
      {open && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center">

    {/* BACKDROP */}
    <div className="absolute inset-0 bg-black/30 backdrop-blur-md transition-opacity" />

    {/* MODAL */}
    <div className="relative w-[95%] max-w-7xl h-[85%]
      rounded-2xl border
      bg-gradient-to-br from-[#0f0f1a] via-[#12121f] to-[#0f0f1a]
      shadow-[0_10px_40px_rgba(0,0,0,0.6)]
      flex flex-col overflow-hidden
      animate-in fade-in zoom-in-95">

      {/* HEADER */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">

        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-white tracking-tight">
            {preview?.name || "Dataset Preview"}
          </h3>

          <p className="text-[11px] text-white/50">
            {preview?.total_rows || 0} rows • {preview?.columns?.length || 0} columns
          </p>
        </div>

        <button
          onClick={() => setOpen(false)}
          className="p-1.5 rounded-md hover:bg-white/10 transition"
        >
          <X size={16} className="text-white/70" />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-auto">

        {/* LOADING */}
        {previewLoading && (
          <div className="flex items-center justify-center h-full flex-col gap-4">
            <Loader2 className="animate-spin text-violet-400" size={30} />
            <p className="text-sm text-white/50">
              Loading dataset preview...
            </p>
          </div>
        )}

        {/* TABLE */}
        {!previewLoading && preview && (
          <table className="w-full text-xs min-w-max">

            {/* HEADER */}
            <thead className="sticky top-0 backdrop-blur-md bg-white/5 border-b border-white/10">
              <tr>
                {preview.columns.map((c: any) => (
                  <th
                    key={c.name}
                    className="px-4 py-2 text-left font-medium text-white/80 whitespace-nowrap"
                  >
                    <div className="flex flex-col">
                      <span>{c.name}</span>
                      <span className="text-[10px] text-white/40">
                        {c.type}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* BODY */}
            <tbody>
              {preview.rows.map((row: any, i: number) => (
                <tr
                  key={i}
                  className="border-b border-white/5 hover:bg-white/5 transition"
                >
                  {preview.columns.map((c: any) => (
                    <td
                      key={c.name}
                      className="px-4 py-2 text-white/70 whitespace-nowrap"
                    >
                      {row[c.name] === null ? (
                        <span className="italic text-white/30">null</span>
                      ) : (
                        String(row[c.name])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>

          </table>
        )}
      </div>

      {/* FOOTER (Optional but 🔥) */}
      <div className="px-5 py-2 border-t border-white/10 text-[11px] text-white/40 flex justify-between">
        <span>Preview limited to first {preview?.rows?.length || 0} rows</span>
        <span className="text-violet-400">InsightLake AI</span>
      </div>

    </div>
  </div>
)}
    </ProjectPageShell>
  )
}
