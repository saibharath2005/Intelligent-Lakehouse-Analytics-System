"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useTheme } from "@/context/ThemeContext"
import { useToast } from "@/components/ui/ToastProvider"
import { useProject } from "@/components/project/ProjectContext"
import ProjectPageShell from "@/components/project/ProjectPageShell"
import { createDashboard, deleteDashboard } from "@/api/dashboard"
import type { Dashboard } from "@/api/project"
import {
  Plus, Trash2, LayoutDashboard, Loader2,
  Clock, Layers, MoreHorizontal, ExternalLink,
} from "lucide-react"

function relTime(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(d).toLocaleDateString(undefined, { month:"short", day:"numeric" })
}

export default function DashboardsPage() {
  const params    = useParams()
  const projectId = Number(params.id)
  const { effective, accentColor } = useTheme()
  const { project, loading: projLoading, refetch } = useProject()
  const toast = useToast()
  const dark = effective === "dark"

  const surface  = dark ? "#13131e" : "#ffffff"
  const border   = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"
  const textMain = dark ? "#f0f0f8" : "#0f0f1a"
  const textSub  = dark ? "rgba(240,240,248,0.4)" : "rgba(15,15,26,0.45)"

  const [creating, setCreating] = useState(false)
  const [newName,  setNewName]  = useState("")
  const [deleting, setDeleting] = useState<number|null>(null)
  const [menuOpen, setMenuOpen] = useState<number|null>(null)
  const [showForm, setShowForm] = useState(false)

  const dashboards: Dashboard[] = project?.dashboards ?? []

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await createDashboard({ project_id: projectId, name: newName.trim() })
      toast.success(`"${newName}" created!`)
      setNewName(""); setShowForm(false)
      refetch()
    } catch (err: any) { toast.error("Failed: " + err.message) }
    finally { setCreating(false) }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    setDeleting(id)
    try {
      await deleteDashboard(id)
      toast.success("Dashboard deleted")
      refetch()
    } catch (err: any) { toast.error("Failed: " + err.message) }
    finally { setDeleting(null); setMenuOpen(null) }
  }

  const createBtn = (
    <button onClick={() => setShowForm(p=>!p)}
      style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"8px 16px", borderRadius:10, background:`linear-gradient(135deg,${accentColor},#a78bfa)`, border:"none", color:"white", fontSize:13, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:"pointer", boxShadow:`0 3px 12px ${accentColor}35` }}
    >
      <Plus size={13}/> New dashboard
    </button>
  )

  return (
    <ProjectPageShell projectId={projectId} section="Dashboards" action={createBtn}>

      {/* Create form */}
      {showForm && (
        <div style={{ background:surface, border:`1px solid ${accentColor}35`, borderRadius:14, padding:"16px 20px", marginBottom:20, display:"flex", gap:10, alignItems:"center", animation:"fadeUp 0.2s ease" }}>
          <input autoFocus
            value={newName}
            onChange={e=>setNewName(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter") handleCreate(); if(e.key==="Escape") setShowForm(false) }}
            placeholder="Dashboard name…"
            style={{ flex:1, background:dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)", border:`1px solid ${border}`, borderRadius:9, padding:"9px 13px", fontSize:13, fontFamily:"'Geist',sans-serif", color:textMain, outline:"none", transition:"border-color 0.15s" }}
            onFocus={e=>(e.currentTarget.style.borderColor=`${accentColor}55`)}
            onBlur={e=>(e.currentTarget.style.borderColor=border)}
          />
          <button onClick={handleCreate} disabled={creating||!newName.trim()}
            style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:9, border:"none", background:`linear-gradient(135deg,${accentColor},#a78bfa)`, color:"white", fontSize:13, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:creating||!newName.trim()?"not-allowed":"pointer", opacity:creating||!newName.trim()?0.55:1 }}
          >
            {creating?<Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/>:<Plus size={13}/>} Create
          </button>
          <button onClick={()=>setShowForm(false)}
            style={{ padding:"9px 12px", borderRadius:9, border:`1px solid ${border}`, background:"none", color:textSub, fontSize:13, fontFamily:"'Geist',sans-serif", cursor:"pointer" }}
          >Cancel</button>
        </div>
      )}

      {/* Grid */}
      {projLoading ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height:140, borderRadius:14, background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)", animation:"pulse 1.5s ease infinite" }}/>
          ))}
        </div>
      ) : dashboards.length === 0 ? (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 24px", textAlign:"center", gap:12 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:`${accentColor}14`, border:`1px solid ${accentColor}22`, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <LayoutDashboard size={22} color={accentColor}/>
          </div>
          <h3 style={{ fontFamily:"'Instrument Serif',serif", fontSize:20, fontWeight:400, color:textMain, margin:0 }}>No dashboards yet</h3>
          <p style={{ fontSize:13, color:textSub, margin:0, maxWidth:260, lineHeight:1.65 }}>Create a dashboard to start visualising your data.</p>
          <button onClick={()=>setShowForm(true)}
            style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:10, background:`linear-gradient(135deg,${accentColor},#a78bfa)`, border:"none", color:"white", fontSize:13, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:"pointer", boxShadow:`0 4px 14px ${accentColor}40` }}
          ><Plus size={14}/> Create first dashboard</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
          {dashboards.map(db => (
            <div key={db.id}
              style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, overflow:"hidden", transition:"all 0.2s", cursor:"pointer", position:"relative" }}
              onMouseEnter={e=>{(e.currentTarget as any).style.borderColor=`${accentColor}45`;(e.currentTarget as any).style.boxShadow=`0 6px 24px rgba(0,0,0,${dark?0.25:0.08})`}}
              onMouseLeave={e=>{(e.currentTarget as any).style.borderColor=border;(e.currentTarget as any).style.boxShadow="none"}}
            >
              <Link href={`/project/${projectId}/dashboard/${db.id}`} style={{ display:"block", padding:"20px 20px 16px", textDecoration:"none" }}>
                <div style={{ width:40, height:40, borderRadius:11, background:`${accentColor}16`, border:`1px solid ${accentColor}25`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
                  <LayoutDashboard size={18} color={accentColor}/>
                </div>
                <h3 style={{ fontSize:15, fontWeight:600, color:textMain, margin:"0 0 6px", letterSpacing:"-0.2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{db.name}</h3>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:11, color:textSub, display:"flex", alignItems:"center", gap:4 }}>
                    <Clock size={10}/>{relTime(db.created_at)}
                  </span>
                  <span style={{ fontSize:10, color:textSub }}>·</span>
                  <span style={{ fontSize:11, color:textSub }}>
                    {db.page_count} page{db.page_count!==1?"s":""}
                  </span>
                </div>
              </Link>

              {/* Actions */}
              <div style={{ borderTop:`1px solid ${border}`, padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", background:dark?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.01)" }}>
                <Link href={`/project/${projectId}/dashboard/${db.id}`}
                  style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, color:accentColor, textDecoration:"none", fontWeight:500 }}
                >
                  Open <ExternalLink size={11}/>
                </Link>
                <button onClick={()=>handleDelete(db.id,db.name)} disabled={deleting===db.id}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:5, borderRadius:6, color:dark?"rgba(240,240,248,0.2)":"rgba(15,15,26,0.2)", display:"flex", alignItems:"center", transition:"all 0.15s" }}
                  onMouseEnter={e=>{(e.currentTarget as any).style.color="#f87171";(e.currentTarget as any).style.background="rgba(248,113,113,0.1)"}}
                  onMouseLeave={e=>{(e.currentTarget as any).style.color=dark?"rgba(240,240,248,0.2)":"rgba(15,15,26,0.2)";(e.currentTarget as any).style.background="none"}}
                >
                  {deleting===db.id?<Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/>:<Trash2 size={14}/>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ProjectPageShell>
  )
}
