"use client"

import { useTheme } from "@/context/ThemeContext"
import { useProject } from "@/components/project/ProjectContext"
import Link from "next/link"
import { ChevronRight, Loader2, RefreshCw } from "lucide-react"
import { ReactNode } from "react"

interface Props {
  projectId: number
  section:   string
  children:  ReactNode
  action?:   ReactNode   // optional top-right button
}

export default function ProjectPageShell({ projectId, section, children, action }: Props) {
  const { effective, accentColor } = useTheme()
  const { project, loading, refetch } = useProject()
  const dark = effective === "dark"

  const textMain = dark ? "#f0f0f8" : "#0f0f1a"
  const textSub  = dark ? "rgba(240,240,248,0.4)" : "rgba(15,15,26,0.45)"
  const border   = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"
  const surface  = dark ? "#13131e" : "#ffffff"

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        *, *::before, *::after { box-sizing: border-box; }
        select option { background: ${dark?"#13131e":"#fff"}; }
        input::placeholder, textarea::placeholder { color: ${dark?"rgba(240,240,248,0.22)":"rgba(15,15,26,0.28)"}; }
        textarea { resize: vertical; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}; border-radius:3px; }
      `}</style>

      <div style={{ fontFamily:"'Geist',sans-serif", maxWidth:1020, margin:"0 auto", padding:"28px 28px 60px", animation:"fadeUp 0.35s ease both" }}>

        {/* Breadcrumb */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:22 }}>
          <Link href="/projects" style={{ fontSize:13, color:textSub, textDecoration:"none", transition:"color 0.15s" }}
            onMouseEnter={e=>(e.currentTarget.style.color=accentColor)}
            onMouseLeave={e=>(e.currentTarget.style.color=textSub)}
          >
            Projects
          </Link>
          <ChevronRight size={12} color={textSub}/>
          {loading ? (
            <span style={{ fontSize:13, color:textSub }}>Loading…</span>
          ) : (
            <Link href={`/project/${projectId}/datasets`} style={{ fontSize:13, color:textSub, textDecoration:"none", transition:"color 0.15s" }}
              onMouseEnter={e=>(e.currentTarget.style.color=accentColor)}
              onMouseLeave={e=>(e.currentTarget.style.color=textSub)}
            >
              {project?.name || `Project #${projectId}`}
            </Link>
          )}
          <ChevronRight size={12} color={textSub}/>
          <span style={{ fontSize:13, color:textMain, fontWeight:600 }}>{section}</span>
        </div>

        {/* Page header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:28 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
              {loading
                ? <div style={{ width:160, height:28, borderRadius:7, background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)", animation:"pulse 1.5s ease infinite" }}/>
                : <h1 style={{ fontFamily:"'Instrument Serif',serif", fontSize:26, fontWeight:400, color:textMain, margin:0, letterSpacing:"-0.4px" }}>
                    {project?.name || `Project #${projectId}`}
                  </h1>
              }
              {!loading && project && (
                <span style={{ fontSize:11, fontWeight:700, color:accentColor, background:`${accentColor}14`, padding:"2px 8px", borderRadius:20, fontFamily:"'Geist Mono',monospace", letterSpacing:"0.03em" }}>
                  {project.your_role}
                </span>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <p style={{ fontSize:13, color:textSub, margin:0 }}>{section}</p>
              {!loading && project && (
                <>
                  <span style={{ color:textSub, fontSize:10 }}>·</span>
                  <span style={{ fontSize:12, color:textSub, fontFamily:"'Geist Mono',monospace" }}>#{projectId}</span>
                  <span style={{ color:textSub, fontSize:10 }}>·</span>
                  <span style={{ fontSize:12, color:textSub }}>
                    {project.datasets.length} dataset{project.datasets.length!==1?"s":""}
                  </span>
                  <span style={{ color:textSub, fontSize:10 }}>·</span>
                  <span style={{ fontSize:12, color:textSub }}>
                    {project.members.length} member{project.members.length!==1?"s":""}
                  </span>
                </>
              )}
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            {action}
            <button onClick={refetch}
              style={{ display:"flex", alignItems:"center", padding:8, borderRadius:8, border:`1px solid ${border}`, background:"none", cursor:"pointer", color:textSub, transition:"all 0.15s" }}
              onMouseEnter={e=>{(e.currentTarget as any).style.background=dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)";(e.currentTarget as any).style.color=textMain}}
              onMouseLeave={e=>{(e.currentTarget as any).style.background="none";(e.currentTarget as any).style.color=textSub}}
              title="Refresh project data"
            >
              <RefreshCw size={13} style={{ animation: loading?"spin 1s linear infinite":"none" }}/>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ animation:"fadeUp 0.25s ease both" }}>
          {children}
        </div>

      </div>
    </>
  )
}
