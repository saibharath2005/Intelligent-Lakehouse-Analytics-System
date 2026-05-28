"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTheme } from "@/context/ThemeContext"
import { useToast } from "@/components/ui/ToastProvider"
import { useProject } from "@/components/project/ProjectContext"
import ProjectPageShell from "@/components/project/ProjectPageShell"
import { getKey, setkey, deleteKey } from "@/api/keys"
import { deleteProject } from "@/api/project"
import { apiRequest } from "@/lib/apiClient"
import {
  Key, Trash2, Check, Eye, EyeOff, Copy,
  Loader2, AlertTriangle, ExternalLink,
  Layers, Shield, CheckCircle,
} from "lucide-react"

const PROVIDERS = [
  { id:"openai",    label:"OpenAI",        logo:"🤖", color:"#10a37f", placeholder:"sk-proj-...",    docsUrl:"https://platform.openai.com/api-keys"             },
  { id:"gemini",    label:"Google Gemini", logo:"✨", color:"#4285f4", placeholder:"AIzaSy...",      docsUrl:"https://aistudio.google.com/app/apikey"            },
  { id:"anthropic", label:"Anthropic",     logo:"🔬", color:"#d4a853", placeholder:"sk-ant-...",     docsUrl:"https://console.anthropic.com/settings/keys"       },
  { id:"mistral",   label:"Mistral AI",    logo:"🌊", color:"#ff7000", placeholder:"...",            docsUrl:"https://console.mistral.ai/api-keys/"              },
  { id:"groq",      label:"Groq",          logo:"⚡", color:"#f55036", placeholder:"gsk_...",        docsUrl:"https://console.groq.com/keys"                     },
  { id:"cohere",    label:"Cohere",        logo:"🌀", color:"#39594d", placeholder:"...",            docsUrl:"https://dashboard.cohere.com/api-keys"             },
]

type Section = "general" | "apikeys" | "danger"

// ─── PROVIDER KEY CARD ───────────────────────────────────
function ProviderKeyCard({ provider, projectId, maskedFromApi, onChanged, dark, accent, surface, border, textMain, textSub }: any) {
  const toast = useToast()
  const p = PROVIDERS.find(x=>x.id===provider)!

  const [keyVal,   setKeyVal]   = useState("")
  const [show,     setShow]     = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied,   setCopied]   = useState(false)
  const [isDirty,  setIsDirty]  = useState(false)

  // Key is active if we got a masked key from the project API
  const isActive = Boolean(maskedFromApi)
  const displayMask = maskedFromApi || ""

  async function handleSave() {
    if (!keyVal.trim()) return
    setSaving(true)
    try {
      await setkey({ project_id:projectId, provider, api_key:keyVal.trim() })
      setKeyVal("")
      setIsDirty(false)
      await onChanged?.()
      toast.success(`${p.label} key saved!`)
    } catch (err:any) { toast.error("Failed: "+err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirm(`Remove ${p.label} key from this project?`)) return
    setDeleting(true)
    try {
      await deleteKey(projectId, provider)
      setKeyVal("")
      await onChanged?.()
      toast.success(`${p.label} key removed`)
    } catch (err:any) { toast.error("Failed: "+err.message) }
    finally { setDeleting(false) }
  }

  return (
    <div style={{ background:surface, border:`1px solid ${isActive?`${p.color}30`:border}`, borderRadius:13, overflow:"hidden", transition:"border-color 0.2s" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderBottom:`1px solid ${border}`, background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)" }}>
        <div style={{ width:36, height:36, borderRadius:9, background:`${p.color}18`, border:`1px solid ${p.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
          {p.logo}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:600, color:textMain }}>{p.label}</div>
          <a href={p.docsUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontSize:11, color:textSub, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:3, transition:"color 0.15s" }}
            onMouseEnter={e=>(e.currentTarget.style.color=p.color)}
            onMouseLeave={e=>(e.currentTarget.style.color=textSub)}
          >Get API key <ExternalLink size={9}/></a>
        </div>
        {isActive ? (
          <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:20, background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.25)" }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:"#34d399", animation:"pulseDot 2s ease infinite" }}/>
            <span style={{ fontSize:10, fontWeight:700, color:"#34d399", letterSpacing:"0.04em" }}>ACTIVE</span>
          </div>
        ) : (
          <div style={{ padding:"3px 10px", borderRadius:20, background:dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.05)", border:`1px solid ${border}` }}>
            <span style={{ fontSize:10, fontWeight:700, color:textSub }}>NOT SET</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding:"12px 16px", display:"flex", gap:8, alignItems:"center" }}>
        {/* Masked display when active and not editing */}
        {isActive && !isDirty && !keyVal ? (
          <div style={{ flex:1, display:"flex", alignItems:"center", gap:8 }}>
            <code style={{ fontFamily:"'Geist Mono',monospace", fontSize:13, color:textSub, background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)", border:`1px solid ${border}`, borderRadius:8, padding:"8px 12px", flex:1 }}>
              {displayMask}
            </code>
            <button onClick={()=>setIsDirty(true)}
              style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${border}`, background:"none", color:textSub, fontSize:12, fontFamily:"'Geist',sans-serif", cursor:"pointer", whiteSpace:"nowrap" }}
            >Replace</button>
          </div>
        ) : (
          <div style={{ position:"relative", flex:1 }}>
            <input
              autoFocus={isDirty}
              type={show?"text":"password"}
              placeholder={p.placeholder}
              value={keyVal}
              onChange={e=>setKeyVal(e.target.value)}
              onFocus={e=>{e.currentTarget.style.borderColor=`${p.color}60`;e.currentTarget.style.boxShadow=`0 0 0 3px ${p.color}14`}}
              onBlur={e=>{e.currentTarget.style.borderColor=border;e.currentTarget.style.boxShadow="none"}}
              style={{ width:"100%", boxSizing:"border-box", background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)", border:`1px solid ${border}`, borderRadius:9, padding:"8px 36px 8px 12px", fontSize:13, fontFamily:"'Geist Mono',monospace", color:textMain, outline:"none", transition:"border-color 0.15s, box-shadow 0.15s" }}
            />
            <button onClick={()=>setShow(p=>!p)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:textSub, display:"flex" }}>
              {show?<EyeOff size={14}/>:<Eye size={14}/>}
            </button>
          </div>
        )}

        {/* Save */}
        {(!isActive || isDirty || keyVal) && (
          <button onClick={handleSave} disabled={saving||!keyVal.trim()}
            style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, border:"none", background:`linear-gradient(135deg,${accent},#a78bfa)`, color:"white", fontSize:12, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:saving||!keyVal.trim()?"not-allowed":"pointer", opacity:saving||!keyVal.trim()?0.45:1, flexShrink:0, boxShadow:`0 2px 8px ${accent}35` }}
          >
            {saving?<Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/>:<Check size={12}/>} Save
          </button>
        )}

        {/* Delete */}
        {isActive && (
          <button onClick={handleDelete} disabled={deleting}
            style={{ width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid rgba(239,68,68,0.22)", borderRadius:8, background:"rgba(239,68,68,0.06)", cursor:"pointer", color:"#f87171", transition:"all 0.15s", flexShrink:0 }}
            onMouseEnter={e=>(e.currentTarget as any).style.background="rgba(239,68,68,0.14)"}
            onMouseLeave={e=>(e.currentTarget as any).style.background="rgba(239,68,68,0.06)"}
          >
            {deleting?<Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/>:<Trash2 size={13}/>}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────
export default function ProjectSettingsPage() {
  const params    = useParams()
  const router    = useRouter()
  const projectId = Number(params.id)
  const { effective, accentColor } = useTheme()
  const { project, loading: projLoading, refetch } = useProject()
  const toast = useToast()
  const dark    = effective === "dark"
  const accent  = accentColor

  const surface  = dark ? "#13131e" : "#ffffff"
  const border   = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"
  const textMain = dark ? "#f0f0f8" : "#0f0f1a"
  const textSub  = dark ? "rgba(240,240,248,0.4)" : "rgba(15,15,26,0.45)"
  const inputBg  = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"

  const [section,    setSection]    = useState<Section>("general")
  const [projName,   setProjName]   = useState("")
  const [projDesc,   setProjDesc]   = useState("")
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [delConfirm, setDelConfirm] = useState("")
  const [deleting,   setDeleting]   = useState(false)

  // Populate form from project context
  const origName = project?.name || `Project #${projectId}`
  if (projName === "" && project?.name) { setProjName(project.name) }

  const apiKeysFromProject = project?.api_keys ?? []
  // Build a lookup: provider → masked_key
  const apiKeyMap = Object.fromEntries(apiKeysFromProject.map(k => [k.provider, k.masked_key]))

  const inp = (extra:any={}) => ({ width:"100%", boxSizing:"border-box" as const, background:inputBg, border:`1px solid ${border}`, borderRadius:9, padding:"9px 12px", fontSize:13, fontFamily:"'Geist',sans-serif", color:textMain, outline:"none", transition:"border-color 0.15s, box-shadow 0.15s", ...extra })
  const fo  = (e:any) => { e.currentTarget.style.borderColor=`${accent}55`; e.currentTarget.style.boxShadow=`0 0 0 3px ${accent}12` }
  const bl  = (e:any) => { e.currentTarget.style.borderColor=border; e.currentTarget.style.boxShadow="none" }
  const lbl = (t:string) => <span style={{ fontSize:11, fontWeight:700, color:textSub, textTransform:"uppercase" as const, letterSpacing:"0.06em" }}>{t}</span>

  async function handleSaveGeneral() {
    if (!projName.trim()) return
    setSaving(true)
    try {
      await apiRequest(`/project/${projectId}`, "PATCH", { name:projName.trim(), description:projDesc })
      refetch(); setSaved(true); setTimeout(()=>setSaved(false),2200)
      toast.success("Project updated!")
    } catch (err:any) { toast.error("Failed: "+err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (delConfirm !== origName) { toast.error("Name doesn't match"); return }
    setDeleting(true)
    try {
      await deleteProject(projectId)
      toast.success("Project deleted"); router.push("/projects")
    } catch (err:any) { toast.error("Failed: "+err.message); setDeleting(false) }
  }

  const SECTIONS = [
    { id:"general" as Section, label:"General", icon:Layers  },
    { id:"apikeys" as Section, label:"API Keys", icon:Key     },
    { id:"danger"  as Section, label:"Danger",   icon:Shield  },
  ]

  return (
    <ProjectPageShell projectId={projectId} section="Settings">
      <>
        <style>{`
          @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:0.35} }
          @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        `}</style>

        <div style={{ display:"flex", gap:22, alignItems:"flex-start" }}>

          {/* Side nav */}
          <nav style={{ width:172, flexShrink:0, background:surface, border:`1px solid ${border}`, borderRadius:13, padding:7, position:"sticky", top:24, transition:"background 0.3s, border-color 0.3s" }}>
            {SECTIONS.map(s => {
              const Icon   = s.icon
              const active = section === s.id
              const isDgr  = s.id === "danger"
              return (
                <button key={s.id} onClick={()=>setSection(s.id)} style={{ display:"flex", alignItems:"center", gap:9, width:"100%", padding:"9px 11px", borderRadius:9, marginBottom:2, background:active?(isDgr?"rgba(239,68,68,0.1)":`${accent}18`):"none", border:`1px solid ${active?(isDgr?"rgba(239,68,68,0.3)":`${accent}40`):"transparent"}`, color:active?(isDgr?"#f87171":accent):textSub, fontSize:13, fontWeight:active?600:400, fontFamily:"'Geist',sans-serif", cursor:"pointer", transition:"all 0.15s", textAlign:"left" as const }}
                  onMouseEnter={e=>{if(!active)(e.currentTarget.style.background=dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)")}}
                  onMouseLeave={e=>{if(!active)(e.currentTarget.style.background="none")}}
                >
                  <Icon size={14} color={active?(isDgr?"#f87171":accent):textSub}/>
                  {s.label}
                </button>
              )
            })}
          </nav>

          {/* Content */}
          <div key={section} style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:16, animation:"fadeUp 0.2s ease both" }}>

            {/* GENERAL */}
            {section === "general" && (
              <>
                <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, overflow:"hidden" }}>
                  <div style={{ padding:"14px 20px 12px", borderBottom:`1px solid ${border}`, background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)" }}>
                    <h3 style={{ fontFamily:"'Geist',sans-serif", fontSize:14, fontWeight:700, color:textMain, margin:"0 0 1px" }}>Project Information</h3>
                    <p style={{ fontSize:12, color:textSub, margin:0 }}>Edit the name and description</p>
                  </div>
                  <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:14 }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {lbl("Project name")}
                      <input style={inp()} value={projName} onChange={e=>setProjName(e.target.value)} onFocus={fo} onBlur={bl}/>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {lbl("Description (optional)")}
                      <textarea style={{ ...inp(), minHeight:72 }} placeholder="What is this project for?" onFocus={fo} onBlur={bl}/>
                    </div>
                    <div style={{ display:"flex", justifyContent:"flex-end" }}>
                      <button onClick={handleSaveGeneral} disabled={saving}
                        style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"9px 20px", borderRadius:10, border:"none", background:saved?"linear-gradient(135deg,#10b981,#34d399)":`linear-gradient(135deg,${accent},#a78bfa)`, color:"white", fontSize:13, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:saving?"not-allowed":"pointer", boxShadow:`0 3px 12px ${accent}35`, transition:"all 0.2s" }}
                      >
                        {saving?<Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/>:<Check size={13}/>}
                        {saved?"Saved!":"Save changes"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:14, overflow:"hidden" }}>
                  <div style={{ padding:"14px 20px 12px", borderBottom:`1px solid ${border}`, background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)" }}>
                    <h3 style={{ fontSize:14, fontWeight:700, color:textMain, margin:0 }}>Project Details</h3>
                  </div>
                  {projLoading ? (
                    <div style={{ padding:"16px 20px" }}>
                      {[1,2,3].map(i=><div key={i} style={{ height:18, marginBottom:10, borderRadius:6, background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)", animation:"pulse 1.5s ease infinite", width:["60%","80%","40%"][i-1] }}/>)}
                    </div>
                  ) : project && [
                    { label:"Project ID",    value:`#${project.id}`,                   mono:true  },
                    { label:"Created",       value:new Date(project.created_at).toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"}), mono:false },
                    { label:"Your role",     value:project.your_role,                  mono:false },
                    { label:"Datasets",      value:`${project.datasets.length} dataset${project.datasets.length!==1?"s":""}`, mono:false },
                    { label:"Dashboards",    value:`${project.dashboards.length} dashboard${project.dashboards.length!==1?"s":""}`, mono:false },
                    { label:"API endpoint",  value:`/api/v1/project/${project.id}`,   mono:true  },
                  ].map((row,i,arr) => (
                    <div key={row.label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, padding:"11px 20px", borderBottom:i<arr.length-1?`1px solid ${border}`:"none" }}>
                      <span style={{ fontSize:13, color:textSub }}>{row.label}</span>
                      <span style={{ fontSize:13, fontWeight:500, color:row.mono?accent:textMain, fontFamily:row.mono?"'Geist Mono',monospace":"inherit", background:row.mono?`${accent}10`:"none", padding:row.mono?"2px 8px":"0", borderRadius:row.mono?6:0 }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* API KEYS */}
            {section === "apikeys" && (
              <>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 16px", background:`${accent}0e`, border:`1px solid ${accent}22`, borderRadius:12 }}>
                  <Key size={14} color={accent} style={{ flexShrink:0, marginTop:1 }}/>
                  <div>
                    <p style={{ fontSize:13, fontWeight:600, color:textMain, margin:"0 0 3px" }}>Project-scoped AI keys</p>
                    <p style={{ fontSize:12, color:textSub, margin:0, lineHeight:1.6 }}>
                      Keys are encrypted per-project. AI Chat and dashboard generation will use the active provider.
                      {apiKeysFromProject.length > 0 && <span style={{ color:accent }}> {apiKeysFromProject.length} key{apiKeysFromProject.length!==1?"s":""} already configured.</span>}
                    </p>
                  </div>
                </div>

                {projLoading ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {[1,2,3].map(i=><div key={i} style={{ height:88, borderRadius:13, background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)", animation:"pulse 1.5s ease infinite" }}/>)}
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {PROVIDERS.map(p => (
                      <ProviderKeyCard
                        key={p.id}
                        provider={p.id}
                        projectId={projectId}
                        maskedFromApi={apiKeyMap[p.id] || null}
                        onChanged={refetch}
                        dark={dark} accent={accent}
                        surface={surface} border={border}
                        textMain={textMain} textSub={textSub}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* DANGER */}
            {section === "danger" && (
              <div style={{ background:"rgba(239,68,68,0.04)", border:"1px solid rgba(239,68,68,0.18)", borderRadius:14, overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", gap:9, padding:"14px 20px 12px", borderBottom:"1px solid rgba(239,68,68,0.12)", background:"none" }}>
                  <AlertTriangle size={14} color="#f87171"/>
                  <div>
                    <h3 style={{ fontFamily:"'Geist',sans-serif", fontSize:14, fontWeight:700, color:"#f87171", margin:0 }}>Danger Zone</h3>
                    <p style={{ fontSize:12, color:"rgba(248,113,113,0.65)", margin:0 }}>Irreversible actions — proceed with caution</p>
                  </div>
                </div>
                <div style={{ padding:"20px" }}>
                  <p style={{ fontSize:13, fontWeight:600, color:textMain, margin:"0 0 6px" }}>Delete this project permanently</p>
                  <p style={{ fontSize:13, color:textSub, margin:"0 0 18px", lineHeight:1.65 }}>
                    This will delete <strong style={{ color:textMain }}>{origName}</strong> along with all its datasets, dashboards and API keys.{" "}
                    <strong style={{ color:"#f87171" }}>This cannot be undone.</strong>
                  </p>
                  <div style={{ background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.12)", borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
                    <p style={{ fontSize:12, color:textSub, margin:"0 0 10px" }}>
                      Type <code style={{ fontFamily:"'Geist Mono',monospace", background:"rgba(239,68,68,0.12)", color:"#f87171", padding:"1px 7px", borderRadius:4 }}>{origName}</code> to confirm
                    </p>
                    <input style={{ ...inp({ borderColor:"rgba(239,68,68,0.25)", maxWidth:360 }) }}
                      placeholder="Type project name…"
                      value={delConfirm}
                      onChange={e=>setDelConfirm(e.target.value)}
                      onFocus={e=>{e.currentTarget.style.borderColor="rgba(239,68,68,0.6)";e.currentTarget.style.boxShadow="0 0 0 3px rgba(239,68,68,0.1)"}}
                      onBlur={e=>{e.currentTarget.style.borderColor="rgba(239,68,68,0.25)";e.currentTarget.style.boxShadow="none"}}
                    />
                  </div>
                  <button onClick={handleDelete} disabled={deleting||delConfirm!==origName}
                    style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:9, border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.1)", color:"#f87171", fontSize:13, fontWeight:600, fontFamily:"'Geist',sans-serif", cursor:deleting||delConfirm!==origName?"not-allowed":"pointer", opacity:delConfirm!==origName?0.45:1, transition:"all 0.15s" }}
                    onMouseEnter={e=>{if(delConfirm===origName)(e.currentTarget as any).style.background="rgba(239,68,68,0.18)"}}
                    onMouseLeave={e=>{(e.currentTarget as any).style.background="rgba(239,68,68,0.1)"}}
                  >
                    {deleting?<Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/>:<Trash2 size={13}/>}
                    Delete project permanently
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </>
    </ProjectPageShell>
  )
}
