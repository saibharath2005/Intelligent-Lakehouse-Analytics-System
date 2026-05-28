"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useTheme } from "@/context/ThemeContext"
import { useToast } from "@/components/ui/ToastProvider"
import { useProject } from "@/components/project/ProjectContext"
import ProjectPageShell from "@/components/project/ProjectPageShell"
import { inviteMember, removeMember, updateMemberRole } from "@/api/project"
import type { ProjectMember } from "@/api/project"
import {
  UserPlus, Trash2, Loader2, Crown, Shield,
  Eye, User, ChevronDown, MoreHorizontal, Mail,
} from "lucide-react"

function relTime(d?: string) {
  if (!d) return "—"
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(d).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" })
}

const ROLE_META: Record<string, { Icon: any; color: string; bg: string; label: string }> = {
  owner:   { Icon:Crown,  color:"#f59e0b", bg:"rgba(245,158,11,0.12)",  label:"Owner"   },
  admin:   { Icon:Shield, color:"#7c6bff", bg:"rgba(124,107,255,0.12)", label:"Admin"   },
  editor:  { Icon:User,   color:"#34d399", bg:"rgba(52,211,153,0.12)",  label:"Editor"  },
  viewer:  { Icon:Eye,    color:"#94a3b8", bg:"rgba(148,163,184,0.12)", label:"Viewer"  },
}

const STATUS_META: Record<string, { color: string; bg: string }> = {
  active:  { color:"#34d399", bg:"rgba(52,211,153,0.1)"  },
  pending: { color:"#f59e0b", bg:"rgba(245,158,11,0.1)"  },
  invited: { color:"#7c6bff", bg:"rgba(124,107,255,0.1)" },
}

export default function MembersPage() {
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

  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole,  setInviteRole]  = useState("editor")
  const [inviting,    setInviting]    = useState(false)
  const [menuOpen,    setMenuOpen]    = useState<number|null>(null)
  const [removing,    setRemoving]    = useState<number|null>(null)

  const members: ProjectMember[] = project?.members ?? []
  const myRole = project?.your_role || "viewer"

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      await inviteMember(projectId, { email: inviteEmail.trim(), role: inviteRole })
      toast.success(`Invite sent to ${inviteEmail}`)
      setInviteEmail(""); setShowInvite(false)
      refetch()
    } catch (err: any) { toast.error("Failed: " + err.message) }
    finally { setInviting(false) }
  }

  async function handleRemove(userId: number, name?: string) {
    if (!confirm(`Remove ${name || `user #${userId}`} from this project?`)) return
    setRemoving(userId)
    try {
      await removeMember(projectId, userId)
      toast.success("Member removed"); refetch()
    } catch (err: any) { toast.error("Failed: " + err.message) }
    finally { setRemoving(null); setMenuOpen(null) }
  }

  async function handleRoleChange(userId: number, role: string) {
    try {
      await updateMemberRole(projectId, userId, role)
      toast.success("Role updated"); refetch()
    } catch (err: any) { toast.error("Failed: " + err.message) }
    finally { setMenuOpen(null) }
  }

  const inviteBtn = (myRole === "owner" || myRole === "admin") ? (
    <button onClick={() => setShowInvite(p=>!p)}
      style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"8px 16px", borderRadius:10, background:`linear-gradient(135deg,${accentColor},#a78bfa)`, border:"none", color:"white", fontSize:13, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:"pointer", boxShadow:`0 3px 12px ${accentColor}35` }}
    >
      <UserPlus size={13}/> Invite member
    </button>
  ) : undefined

  return (
    <ProjectPageShell projectId={projectId} section="Members" action={inviteBtn}>

      {/* Invite panel */}
      {showInvite && (
        <div style={{ background:surface, border:`1px solid ${accentColor}35`, borderRadius:14, padding:"16px 20px", marginBottom:20, animation:"fadeUp 0.2s ease" }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:textMain, margin:"0 0 14px" }}>Invite a member</h3>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <input autoFocus value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") handleInvite(); if(e.key==="Escape") setShowInvite(false) }}
              placeholder="colleague@company.com"
              style={{ flex:1, minWidth:200, background:dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)", border:`1px solid ${border}`, borderRadius:9, padding:"9px 13px", fontSize:13, fontFamily:"'Geist',sans-serif", color:textMain, outline:"none" }}
              onFocus={e=>(e.currentTarget.style.borderColor=`${accentColor}55`)}
              onBlur={e=>(e.currentTarget.style.borderColor=border)}
            />
            <div style={{ position:"relative" }}>
              <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}
                style={{ appearance:"none", padding:"9px 32px 9px 13px", borderRadius:9, border:`1px solid ${border}`, background:dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)", color:textMain, fontSize:13, fontFamily:"'Geist',sans-serif", cursor:"pointer", outline:"none" }}
              >
                {["viewer","editor","admin"].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
              </select>
              <ChevronDown size={12} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", color:textSub }}/>
            </div>
            <button onClick={handleInvite} disabled={inviting||!inviteEmail.trim()}
              style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:9, border:"none", background:`linear-gradient(135deg,${accentColor},#a78bfa)`, color:"white", fontSize:13, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:inviting||!inviteEmail.trim()?"not-allowed":"pointer", opacity:inviting||!inviteEmail.trim()?0.55:1 }}
            >
              {inviting?<Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/>:<Mail size={13}/>} Send invite
            </button>
            <button onClick={()=>setShowInvite(false)}
              style={{ padding:"9px 12px", borderRadius:9, border:`1px solid ${border}`, background:"none", color:textSub, fontSize:13, fontFamily:"'Geist',sans-serif", cursor:"pointer" }}
            >Cancel</button>
          </div>
        </div>
      )}

      {/* Members table */}
      <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, overflow:"visible", transition:"background 0.3s, border-color 0.3s" }}>

        {/* Table head */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 130px 110px 130px 44px", padding:"10px 18px", borderBottom:`1px solid ${border}`, background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)" }}>
          {["Member","Role","Status","Joined",""].map(h => (
            <span key={h} style={{ fontSize:11, fontWeight:700, color:dark?"rgba(240,240,248,0.35)":"rgba(15,15,26,0.4)", letterSpacing:"0.07em", textTransform:"uppercase" }}>{h}</span>
          ))}
        </div>

        {/* Skeletons */}
        {projLoading && [1,2].map(i => (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 130px 110px 130px 44px", padding:"14px 18px", borderBottom:`1px solid ${border}`, gap:0 }}>
            {["55%","80px","60px","90px","24px"].map((w,j) => (
              <div key={j} style={{ height:20, width:w, borderRadius:6, background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)", animation:"pulse 1.5s ease infinite" }}/>
            ))}
          </div>
        ))}

        {/* Empty */}
        {!projLoading && members.length === 0 && (
          <div style={{ padding:"40px 24px", textAlign:"center" }}>
            <p style={{ fontSize:13, color:textSub }}>No members found.</p>
          </div>
        )}

        {/* Rows */}
        {!projLoading && members.map((m, i) => {
          const rm = ROLE_META[m.role] || ROLE_META.viewer
          const sm = STATUS_META[m.status||"active"] || STATUS_META.active
          const isMe = m.user_id === project?.created_by
          const isOwner = m.role === "owner"
          const openUp = i >= members.length - 1

          return (
            <div key={m.user_id}
              style={{ display:"grid", gridTemplateColumns:"1fr 130px 110px 130px 44px", alignItems:"center", padding:"13px 18px", borderBottom:i<members.length-1?`1px solid ${border}`:"none", transition:"background 0.15s", position:"relative" }}
              onMouseEnter={e=>(e.currentTarget.style.background=dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)")}
              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
            >
              {/* Avatar + name */}
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:`linear-gradient(135deg,${accentColor},#a78bfa)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"white", flexShrink:0 }}>
                  {(m.username?.[0]||"?").toUpperCase()}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:textMain, display:"flex", alignItems:"center", gap:6, overflow:"hidden" }}>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.username||`User #${m.user_id}`}</span>
                    {isMe && <span style={{ fontSize:10, fontWeight:700, color:accentColor, background:`${accentColor}14`, padding:"1px 6px", borderRadius:4, flexShrink:0 }}>You</span>}
                  </div>
                  {m.email && <div style={{ fontSize:11, color:textSub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.email}</div>}
                </div>
              </div>

              {/* Role badge */}
              <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:20, background:rm.bg, width:"fit-content" }}>
                <rm.Icon size={11} color={rm.color}/>
                <span style={{ fontSize:11, fontWeight:700, color:rm.color }}>{rm.label}</span>
              </div>

              {/* Status */}
              <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:20, background:sm.bg, width:"fit-content" }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:sm.color }}/>
                <span style={{ fontSize:11, fontWeight:600, color:sm.color }}>{(m.status||"active").charAt(0).toUpperCase()+(m.status||"active").slice(1)}</span>
              </div>

              {/* Joined */}
              <span style={{ fontSize:12, color:textSub }}>{relTime(m.joined_at)}</span>

              {/* Actions */}
              {!isOwner && (myRole==="owner"||myRole==="admin") ? (
                <div style={{ position:"relative" }}>
                  <button onClick={()=>setMenuOpen(menuOpen===m.user_id?null:m.user_id)}
                    style={{ background:menuOpen===m.user_id?(dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.05)"):"none", border:"none", cursor:"pointer", padding:"5px 6px", borderRadius:6, color:textSub, display:"flex" }}
                  >
                    <MoreHorizontal size={14}/>
                  </button>
                  {menuOpen===m.user_id && (
                    <div style={{ position:"absolute", right:0, ...(openUp ? { bottom:"calc(100% + 4px)" } : { top:"calc(100% + 4px)" }), background:dark?"#1c1c2a":"#fff", border:`1px solid ${border}`, borderRadius:11, overflow:"hidden", boxShadow:dark?"0 8px 24px rgba(0,0,0,0.5)":"0 8px 24px rgba(0,0,0,0.12)", minWidth:150, zIndex:200, animation:"slideDown 0.12s ease" }}>
                      <div style={{ padding:"8px 12px 4px", fontSize:10, fontWeight:700, color:textSub, textTransform:"uppercase", letterSpacing:"0.07em" }}>Change role</div>
                      {["viewer","editor","admin"].map(r => (
                        <button key={r} onClick={()=>handleRoleChange(m.user_id,r)}
                          style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:m.role===r?(dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)"):"none", border:"none", cursor:"pointer", fontSize:12.5, color:m.role===r?accentColor:textMain, fontFamily:"'Geist',sans-serif" }}
                          onMouseEnter={e=>(e.currentTarget.style.background=dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)")}
                          onMouseLeave={e=>(e.currentTarget.style.background=m.role===r?(dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)"):"none")}
                        >
                          {r.charAt(0).toUpperCase()+r.slice(1)}
                          {m.role===r && <span style={{ marginLeft:"auto", color:accentColor, fontSize:11 }}>✓</span>}
                        </button>
                      ))}
                      <div style={{ margin:"4px 12px", height:1, background:border }}/>
                      <button onClick={()=>handleRemove(m.user_id,m.username)}
                        style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:"none", border:"none", cursor:"pointer", fontSize:12.5, color:"#f87171", fontFamily:"'Geist',sans-serif" }}
                        onMouseEnter={e=>(e.currentTarget.style.background="rgba(248,113,113,0.08)")}
                        onMouseLeave={e=>(e.currentTarget.style.background="none")}
                      >
                        <Trash2 size={12}/> Remove member
                      </button>
                    </div>
                  )}
                </div>
              ) : <div/>}
            </div>
          )
        })}
      </div>
    </ProjectPageShell>
  )
}
