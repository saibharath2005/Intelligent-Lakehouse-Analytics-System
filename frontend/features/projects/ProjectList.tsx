"use client"

import { useEffect, useState } from "react"
import { getProjects, createProject, deleteProject } from "@/api/project"
import { useTheme } from "@/context/ThemeContext"
import { useToast } from "@/components/ui/ToastProvider"
import Link from "next/link"
import {
  Plus, Loader2, FolderOpen, Database, LayoutDashboard,
  Layers, Trash2, X, Search, MoreHorizontal, ArrowRight,
  TrendingUp, Clock
} from "lucide-react"

function SkeletonCard({ dark }: { dark: boolean }) {
  return (
    <div style={{
      background: dark ? "#13131e" : "#ffffff",
      border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
      borderRadius: 16, padding: 24, animation: "pulse 1.8s ease-in-out infinite",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
        <div style={{ width: 60, height: 20, borderRadius: 6, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} />
      </div>
      <div style={{ width: "65%", height: 14, borderRadius: 6, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", marginBottom: 10 }} />
      <div style={{ width: "40%", height: 11, borderRadius: 6, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", marginBottom: 20 }} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 80, height: 11, borderRadius: 6, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} />
        <div style={{ width: 80, height: 11, borderRadius: 6, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} />
      </div>
    </div>
  )
}

function ProjectCard({ project, dark, accentColor, onDelete }: {
  project: any; dark: boolean; accentColor: string; onDelete: (id: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const bg     = dark ? "#13131e" : "#ffffff"
  const border = hovered
    ? `1px solid ${accentColor}55`
    : `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`

  return (
    <div
      style={{
        background: bg, border, borderRadius: 16,
        padding: 22, position: "relative",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
        boxShadow: hovered ? `0 8px 32px ${accentColor}18` : "none",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false) }}
    >
      {/* Card header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11,
          background: `${accentColor}18`,
          border: `1px solid ${accentColor}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Layers size={18} color={accentColor} />
        </div>

        {/* More menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={e => { e.preventDefault(); setMenuOpen(p => !p) }}
            style={{
              background: menuOpen ? (dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") : "none",
              border: "none", cursor: "pointer", borderRadius: 7,
              padding: "4px 6px", display: "flex", alignItems: "center",
              color: dark ? "rgba(240,240,248,0.35)" : "rgba(15,15,26,0.35)",
              transition: "all 0.15s", opacity: hovered || menuOpen ? 1 : 0,
            }}
          >
            <MoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 4px)",
              background: dark ? "#1a1a28" : "#ffffff",
              border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              borderRadius: 10, overflow: "hidden",
              boxShadow: dark ? "0 8px 24px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.12)",
              minWidth: 140, zIndex: 10,
            }}>
              <button
                onClick={e => { e.preventDefault(); onDelete(project.id); setMenuOpen(false) }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 9,
                  padding: "10px 14px", background: "none", border: "none",
                  cursor: "pointer", fontSize: 13, color: "#f87171",
                  fontFamily: "'Geist',sans-serif", transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <Trash2 size={13} /> Delete project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Project name & meta */}
      <Link href={`/project/${project.id}`} style={{ textDecoration: "none", display: "block" }}>
        <h3 style={{
          fontSize: 15, fontWeight: 600, letterSpacing: "-0.2px",
          color: dark ? "#f0f0f8" : "#0f0f1a",
          margin: "0 0 5px",
        }}>
          {project.name}
        </h3>
        <p style={{
          fontSize: 12, color: dark ? "rgba(240,240,248,0.35)" : "rgba(15,15,26,0.4)",
          margin: "0 0 18px",
        }}>
          Project #{project.id}
        </p>

        {/* Stats row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Database size={12} color={dark ? "rgba(240,240,248,0.3)" : "rgba(15,15,26,0.35)"} />
            <span style={{ fontSize: 12, color: dark ? "rgba(240,240,248,0.45)" : "rgba(15,15,26,0.5)" }}>
              {project.dataset_count ?? 0} dataset{project.dataset_count !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <LayoutDashboard size={12} color={dark ? "rgba(240,240,248,0.3)" : "rgba(15,15,26,0.35)"} />
            <span style={{ fontSize: 12, color: dark ? "rgba(240,240,248,0.45)" : "rgba(15,15,26,0.5)" }}>
              {project.dashboard_count ?? 0} dashboard{project.dashboard_count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: 14,
          borderTop: `1px solid ${dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"}`,
        }}>
          <span style={{
            fontSize: 12, fontWeight: 500,
            color: hovered ? accentColor : (dark ? "rgba(240,240,248,0.3)" : "rgba(15,15,26,0.35)"),
            transition: "color 0.2s",
          }}>
            Open workspace
          </span>
          <div style={{
            width: 24, height: 24, borderRadius: 7,
            background: hovered ? `${accentColor}20` : (dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"),
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s",
          }}>
            <ArrowRight size={13} color={hovered ? accentColor : (dark ? "rgba(240,240,248,0.3)" : "rgba(15,15,26,0.3)")} style={{ transition: "color 0.2s" }} />
          </div>
        </div>
      </Link>
    </div>
  )
}

export default function ProjectList() {
  const { effective, accentColor } = useTheme()
  const dark = effective === "dark"
  const toast = useToast()

  const [projects, setProjects]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName]       = useState("")
  const [search, setSearch]         = useState("")

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await getProjects()
      const { status, status_code, ...rest } = data
      if (status) setProjects(Object.values(rest))
    } catch (err: any) {
      toast.error("Failed to load projects: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await createProject(newName.trim())
      toast.success("Project created!")
      setNewName("")
      setShowCreate(false)
      load()
    } catch (err: any) {
      toast.error("Failed: " + err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this project? This action cannot be undone.")) return
    try {
      await deleteProject(id)
      toast.success("Project deleted")
      setProjects(p => p.filter((x: any) => x.id !== id))
    } catch (err: any) {
      toast.error("Failed: " + err.message)
    }
  }

  const filtered = projects.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  )

  const surface  = dark ? "#13131e" : "#ffffff"
  const border   = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const textMain = dark ? "#f0f0f8" : "#0f0f1a"
  const textSub  = dark ? "rgba(240,240,248,0.38)" : "rgba(15,15,26,0.45)"
  const inputBg  = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes spin   { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .pl-input:focus { border-color: ${accentColor}80 !important; box-shadow: 0 0 0 3px ${accentColor}14 !important; }
        .pl-input::placeholder { color: ${dark ? "rgba(240,240,248,0.22)" : "rgba(15,15,26,0.28)"}; }
        .pl-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px,1fr)); gap: 16px; }
        @media (max-width: 640px) { .pl-card-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ fontFamily: "'Geist', sans-serif", maxWidth: 1100, margin: "0 auto", animation: "fadeUp 0.4s ease both" }}>

        {/* ── PAGE HEADER ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, fontWeight: 400, color: textMain, margin: "0 0 6px", letterSpacing: "-0.5px" }}>
                Projects
              </h1>
              <p style={{ fontSize: 14, color: textSub, margin: 0 }}>
                {loading ? "Loading…" : `${projects.length} project${projects.length !== 1 ? "s" : ""} in your workspace`}
              </p>
            </div>

            <button
              onClick={() => setShowCreate(p => !p)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 18px", borderRadius: 11, border: "none",
                background: `linear-gradient(135deg,${accentColor},#a78bfa)`,
                color: "white", fontSize: 13, fontWeight: 600,
                fontFamily: "'Geist',sans-serif", cursor: "pointer",
                boxShadow: `0 4px 16px ${accentColor}40`,
                transition: "all 0.2s", flexShrink: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as any).style.transform = "translateY(-1px)"; (e.currentTarget as any).style.boxShadow = `0 8px 24px ${accentColor}52` }}
              onMouseLeave={e => { (e.currentTarget as any).style.transform = "translateY(0)"; (e.currentTarget as any).style.boxShadow = `0 4px 16px ${accentColor}40` }}
            >
              <Plus size={15} />
              New Project
            </button>
          </div>

          {/* ── CREATE PANEL ── */}
          {showCreate && (
            <div style={{
              marginTop: 16,
              background: surface,
              border: `1px solid ${border}`,
              borderRadius: 14, padding: 18,
              animation: "slideDown 0.2s ease",
              boxShadow: dark ? "0 8px 32px rgba(0,0,0,0.3)" : "0 8px 32px rgba(0,0,0,0.08)",
            }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: textSub, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
                New project name
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  className="pl-input"
                  autoFocus
                  placeholder="e.g. Sales Analytics Q3"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false) }}
                  style={{
                    flex: 1, background: inputBg,
                    border: `1px solid ${border}`,
                    borderRadius: 10, padding: "10px 13px",
                    fontSize: 14, fontFamily: "'Geist',sans-serif",
                    color: textMain, outline: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                />
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "10px 16px", borderRadius: 10, border: "none",
                    background: `linear-gradient(135deg,${accentColor},#a78bfa)`,
                    color: "white", fontSize: 13, fontWeight: 600,
                    fontFamily: "'Geist',sans-serif",
                    cursor: creating || !newName.trim() ? "not-allowed" : "pointer",
                    opacity: creating || !newName.trim() ? 0.55 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  {creating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
                  Create
                </button>
                <button
                  onClick={() => { setShowCreate(false); setNewName("") }}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 40, height: 40, borderRadius: 10,
                    border: `1px solid ${border}`, background: "none",
                    color: textSub, cursor: "pointer", flexShrink: 0,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── SEARCH & FILTER BAR ── */}
        {!loading && projects.length > 0 && (
          <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: textSub, pointerEvents: "none" }} />
              <input
                className="pl-input"
                placeholder="Search projects…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: inputBg,
                  border: `1px solid ${border}`,
                  borderRadius: 10, padding: "9px 13px 9px 34px",
                  fontSize: 13, fontFamily: "'Geist',sans-serif",
                  color: textMain, outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: textSub, flexShrink: 0 }}>
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* ── LOADING SKELETONS ── */}
        {loading && (
          <div className="pl-card-grid">
            {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} dark={dark} />)}
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && projects.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "80px 24px", textAlign: "center",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: `${accentColor}18`,
              border: `1px solid ${accentColor}2e`,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}>
              <FolderOpen size={26} color={accentColor} />
            </div>
            <h3 style={{ fontFamily: "'Instrument Serif',serif", fontSize: 24, fontWeight: 400, color: textMain, margin: "0 0 8px", letterSpacing: "-0.3px" }}>
              No projects yet
            </h3>
            <p style={{ fontSize: 14, color: textSub, margin: "0 0 28px", maxWidth: 280, lineHeight: 1.6 }}>
              Create your first project to start connecting data and building dashboards.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "11px 22px", borderRadius: 11, border: "none",
                background: `linear-gradient(135deg,${accentColor},#a78bfa)`,
                color: "white", fontSize: 14, fontWeight: 600,
                fontFamily: "'Geist',sans-serif", cursor: "pointer",
                boxShadow: `0 4px 16px ${accentColor}40`,
              }}
            >
              <Plus size={16} /> Create first project
            </button>
          </div>
        )}

        {/* ── NO SEARCH RESULTS ── */}
        {!loading && projects.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <p style={{ fontSize: 14, color: textSub }}>No projects match "<strong style={{ color: textMain }}>{search}</strong>"</p>
            <button onClick={() => setSearch("")} style={{ marginTop: 10, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: accentColor, fontFamily: "'Geist',sans-serif" }}>
              Clear search
            </button>
          </div>
        )}

        {/* ── PROJECT GRID ── */}
        {!loading && filtered.length > 0 && (
          <div className="pl-card-grid">
            {filtered.map((p: any, i: number) => (
              <div key={p.id} style={{ animation: `fadeUp 0.35s ease ${i * 50}ms both` }}>
                <ProjectCard
                  project={p}
                  dark={dark}
                  accentColor={accentColor}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  )
}
