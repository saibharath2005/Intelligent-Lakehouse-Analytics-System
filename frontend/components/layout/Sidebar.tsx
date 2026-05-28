"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Menu, X, Zap, Bell, LogOut, ChevronUp,
  Moon, Sun, Monitor, UserCircle, Settings,
} from "lucide-react"
import { globalLinks, projectLinks } from "@/config/navigation"
import { useTheme } from "@/context/ThemeContext"

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { effective, accentColor, theme, setTheme } = useTheme()
  const dark = effective === "dark"

  const [open,         setOpen]         = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [user,         setUser]         = useState<{ username: string; email: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Route matching
  const projectMatch  = pathname.match(/\/project\/(\d+)/)
  const projectId     = projectMatch?.[1]
  const insideProject = Boolean(projectId)
  const projectTab    = pathname.match(/\/project\/\d+\/([^/]+)/)?.[1] ?? ""

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    const stored = localStorage.getItem("user")
    if (stored) { try { setUser(JSON.parse(stored)) } catch {} }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowUserMenu(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setUser(null)
    setShowUserMenu(false)
    router.push("/auth/login")
  }

  // ── Reactive theme tokens ──
  const bg        = dark ? "#0a0a0f"                 : "#ffffff"
  const bdr       = dark ? "rgba(255,255,255,0.06)"  : "rgba(0,0,0,0.08)"
  const tp        = dark ? "#f0f0f5"                 : "#0f0f1a"
  const tm        = dark ? "rgba(240,240,245,0.38)"  : "rgba(15,15,26,0.4)"
  const ts        = dark ? "rgba(240,240,245,0.62)"  : "rgba(15,15,26,0.62)"
  const hov       = dark ? "rgba(255,255,255,0.05)"  : "rgba(0,0,0,0.04)"
  const actBg     = dark ? `${accentColor}22`        : `${accentColor}14`
  const actBdr    = dark ? `${accentColor}55`        : `${accentColor}60`
  const popBg     = dark ? "#15151e"                 : "#ffffff"
  const popBdr    = dark ? "rgba(255,255,255,0.08)"  : "rgba(0,0,0,0.08)"
  const initials  = (user?.username?.[0] || "G").toUpperCase()

  // ── Nav link (global) ──
  const NavLink = ({ href, icon: Icon, label, delay = 0 }: any) => {
    const isActive = pathname === href || (href !== "/projects" && pathname.startsWith(href))
    return (
      <Link href={href} style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"9px 11px", borderRadius:10, textDecoration:"none",
        color: isActive ? accentColor : ts,
        background: isActive ? actBg : "none",
        border: `1px solid ${isActive ? actBdr : "transparent"}`,
        fontSize:13.5, fontWeight: isActive ? 600 : 400,
        transition:"all 0.15s", marginBottom:2, position:"relative",
        animationDelay: `${delay}ms`,
      }}
        onMouseEnter={e => { if (!isActive) { (e.currentTarget as any).style.background=hov; (e.currentTarget as any).style.color=tp } }}
        onMouseLeave={e => { if (!isActive) { (e.currentTarget as any).style.background="none"; (e.currentTarget as any).style.color=ts } }}
      >
        {isActive && <div style={{ position:"absolute", left:-12, top:"50%", transform:"translateY(-50%)", width:3, height:18, background:accentColor, borderRadius:"0 3px 3px 0", boxShadow:`2px 0 8px ${accentColor}55` }}/>}
        <Icon size={15} color={isActive ? accentColor : tm} style={{ flexShrink:0 }}/>
        {label}
        {isActive && <div style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%", background:accentColor, boxShadow:`0 0 6px ${accentColor}80`, flexShrink:0 }}/>}
      </Link>
    )
  }

  // ── Project-scoped link ──
  const ProjectLink = ({ path, icon: Icon, label, delay = 0 }: any) => {
    const href     = `/project/${projectId}/${path}`
    const isActive = projectTab === path || pathname.startsWith(href)
    const isSettings = path === "settings"
    const activeColor = isSettings ? "#f87171" : accentColor
    const activeBg2   = isSettings ? "rgba(239,68,68,0.1)"  : actBg
    const activeBdr2  = isSettings ? "rgba(239,68,68,0.28)" : actBdr
    const hoverColor  = isSettings ? "#f87171" : tp
    const hoverBg2    = isSettings ? "rgba(239,68,68,0.06)" : hov

    return (
      <Link href={href} style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"9px 11px", borderRadius:10, textDecoration:"none",
        color: isActive ? activeColor : ts,
        background: isActive ? activeBg2 : "none",
        border: `1px solid ${isActive ? activeBdr2 : "transparent"}`,
        fontSize:13.5, fontWeight: isActive ? 600 : 400,
        transition:"all 0.15s", marginBottom:2, position:"relative",
        animationDelay: `${delay}ms`,
      }}
        onMouseEnter={e => { if (!isActive) { (e.currentTarget as any).style.background=hoverBg2; (e.currentTarget as any).style.color=hoverColor } }}
        onMouseLeave={e => { if (!isActive) { (e.currentTarget as any).style.background="none"; (e.currentTarget as any).style.color=ts } }}
      >
        {isActive && <div style={{ position:"absolute", left:-12, top:"50%", transform:"translateY(-50%)", width:3, height:18, background:activeColor, borderRadius:"0 3px 3px 0", boxShadow:`2px 0 8px ${activeColor}55` }}/>}
        <Icon size={15} color={isActive ? activeColor : tm} style={{ flexShrink:0 }}/>
        {label}
        {isActive && <div style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%", background:activeColor, flexShrink:0 }}/>}
      </Link>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');
        .sb *, .sb *::before, .sb *::after { box-sizing: border-box; }
        .sb { font-family: 'Geist', sans-serif; }

        @keyframes sb-in   { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes sb-fade { from{opacity:0} to{opacity:1} }
        @keyframes sb-pop  { from{opacity:0;transform:translateY(8px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes sb-dot  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }

        .sb-link { animation: sb-in 0.3s ease backwards; }

        .sb-topbar {
          display: none; position: fixed; top:0; left:0; right:0; height:56px;
          background:${bg}; border-bottom:1px solid ${bdr};
          align-items:center; justify-content:space-between;
          padding:0 18px; z-index:30; backdrop-filter:blur(14px);
          transition: background 0.3s, border-color 0.3s;
        }
        @media (max-width:1023px) {
          .sb-topbar { display:flex; }
          .sb-offset { display:block !important; height:56px; }
        }

        .sb-ibtn { background:none; border:none; cursor:pointer; color:${tp}; display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:8px; transition:background 0.15s; }
        .sb-ibtn:hover { background:${hov}; }

        .sb-backdrop { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:30; backdrop-filter:blur(4px); animation:sb-fade 0.2s; }
        .sb-backdrop.on { display:block; }

        .sb-aside {
          position:fixed; top:0; left:0; height:100dvh; width:252px;
          background:${bg}; border-right:1px solid ${bdr};
          z-index:40; display:flex; flex-direction:column;
          transition:transform 0.3s cubic-bezier(0.16,1,0.3,1), background 0.3s, border-color 0.3s;
          transform:translateX(-100%); overflow:hidden;
        }
        .sb-aside::before { content:''; position:absolute; top:-80px; left:-80px; width:240px; height:240px; background:radial-gradient(circle,${accentColor}12 0%,transparent 70%); pointer-events:none; border-radius:50%; }
        @media (min-width:1024px) { .sb-aside { position:sticky; transform:translateX(0) !important; flex-shrink:0; } }
        .sb-aside.on { transform:translateX(0); }

        .sb-head { padding:24px 18px 18px; border-bottom:1px solid ${bdr}; flex-shrink:0; transition:border-color 0.3s; }

        .sb-scroll {
          flex:1; overflow-y:auto; overflow-x:hidden; padding:12px 12px 0;
          scrollbar-width:thin; scrollbar-color:${dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.08)"} transparent;
        }
        .sb-scroll::-webkit-scrollbar { width:4px; }
        .sb-scroll::-webkit-scrollbar-thumb { background:${dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.08)"}; border-radius:4px; }

        .sb-lbl { font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:${tm}; padding:8px 11px 6px; }
        .sb-div  { margin:10px 14px; height:1px; background:${bdr}; flex-shrink:0; }

        .sb-foot { padding:10px; border-top:1px solid ${bdr}; flex-shrink:0; position:relative; transition:border-color 0.3s; }

        .sb-card { display:flex; align-items:center; gap:10px; width:100%; padding:9px 11px; border-radius:10px; cursor:pointer; background:none; border:1px solid transparent; text-align:left; transition:all 0.15s; }
        .sb-card:hover, .sb-card.on { background:${hov}; border-color:${bdr}; }

        .sb-ava { width:32px; height:32px; border-radius:9px; flex-shrink:0; background:linear-gradient(135deg,${accentColor},#a78bfa); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; color:white; box-shadow:0 0 10px ${accentColor}44; }

        .sb-popup {
          position:absolute; bottom:calc(100% + 6px); left:10px; right:10px;
          background:${popBg}; border:1px solid ${popBdr}; border-radius:14px; overflow:hidden;
          box-shadow:${dark?"0 -8px 32px rgba(0,0,0,0.48)":"0 -8px 32px rgba(0,0,0,0.12)"};
          z-index:50; animation:sb-pop 0.18s cubic-bezier(0.16,1,0.3,1); transition:background 0.3s;
        }

        .sb-pu-head { padding:12px 14px; border-bottom:1px solid ${popBdr}; background:${dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)"}; transition:background 0.3s, border-color 0.3s; }

        /* Theme pills */
        .sb-th-row { padding:10px 14px; border-bottom:1px solid ${popBdr}; transition:border-color 0.3s; }
        .sb-th-lbl { font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${tm}; margin-bottom:7px; }
        .sb-th-btns { display:flex; gap:6px; }
        .sb-th-btn { flex:1; display:flex; align-items:center; justify-content:center; gap:5px; padding:6px 4px; border-radius:8px; border:1px solid transparent; background:none; cursor:pointer; font-size:11.5px; font-weight:500; font-family:'Geist',sans-serif; transition:all 0.15s; }

        /* Popup actions */
        .sb-pu-link { display:flex; align-items:center; gap:9px; padding:10px 14px; font-size:13px; text-decoration:none; transition:background 0.15s; }
        .sb-pu-link:hover { background:${hov}; }
        .sb-pu-btn { width:100%; display:flex; align-items:center; gap:9px; padding:10px 14px; background:none; border:none; cursor:pointer; font-size:13px; font-family:'Geist',sans-serif; transition:background 0.15s; }

        /* Project context */
        .sb-proj-badge { display:flex; align-items:center; gap:8px; padding:8px 11px; margin-bottom:4px; }
        .sb-proj-dot { width:7px; height:7px; border-radius:50%; background:#34d399; box-shadow:0 0 6px rgba(52,211,153,0.5); flex-shrink:0; animation:sb-dot 2.5s ease-in-out infinite; }
        .sb-proj-chip { margin-left:auto; font-size:10px; font-weight:700; color:${accentColor}; background:${accentColor}1a; padding:2px 7px; border-radius:4px; font-family:'Geist',monospace; }

        .sb-close { display:flex; justify-content:flex-end; padding:14px 14px 0; flex-shrink:0; }
        @media (min-width:1024px) { .sb-close { display:none; } }
        .sb-offset { display:none; }
      `}</style>

      <div className="sb">

        {/* Mobile topbar */}
        <div className="sb-topbar">
          <Link href="/" style={{ display:"flex", alignItems:"center", gap:9, textDecoration:"none" }}>
            <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg,${accentColor},#a78bfa)`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 14px ${accentColor}40` }}>
              <Zap size={14} color="white" strokeWidth={2.5}/>
            </div>
            <span style={{ fontWeight:700, fontSize:15, color:tp, letterSpacing:"-0.3px" }}>InsightLake AI</span>
          </Link>
          <div style={{ display:"flex", gap:4 }}>
            <button className="sb-ibtn"><Bell size={17}/></button>
            <button className="sb-ibtn" onClick={() => setOpen(true)}><Menu size={17}/></button>
          </div>
        </div>

        <div className={`sb-backdrop ${open?"on":""}`} onClick={() => setOpen(false)}/>

        {/* Sidebar */}
        <aside className={`sb-aside ${open?"on":""}`}>

          <div className="sb-close">
            <button className="sb-ibtn" onClick={() => setOpen(false)}><X size={17}/></button>
          </div>

          {/* Logo */}
          <div className="sb-head">
            <Link href="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none" }}>
              <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg,${accentColor},#a78bfa)`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 16px ${accentColor}40`, flexShrink:0 }}>
                <Zap size={15} color="white" strokeWidth={2.5}/>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:tp, letterSpacing:"-0.4px", lineHeight:1.2 }}>InsightLake AI</div>
                <div style={{ fontSize:10, color:tm }}>Analytics Platform</div>
              </div>
            </Link>
          </div>

          {/* Nav */}
          <div className="sb-scroll">

            {/* Global — just Projects */}
            <div style={{ marginBottom:4 }}>
              <div className="sb-lbl">Navigation</div>
              {globalLinks.map((link, i) => (
                <div key={link.name} className="sb-link" style={{ animationDelay:`${i*40}ms` }}>
                  <NavLink href={link.href} icon={link.icon} label={link.name}/>
                </div>
              ))}
            </div>

            {/* Project tabs — shown when inside /project/[id] */}
            {insideProject && (
              <>
                <div className="sb-div"/>
                <div>
                  <div className="sb-proj-badge">
                    <span className="sb-proj-dot"/>
                    <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:tm }}>Project</span>
                    <span className="sb-proj-chip">#{projectId}</span>
                  </div>
                  {projectLinks.map((link, i) => (
                    <div key={link.path} className="sb-link" style={{ animationDelay:`${i*45}ms` }}>
                      <ProjectLink path={link.path} icon={link.icon} label={link.name}/>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ height:12 }}/>
          </div>

          {/* ── User card ── */}
          <div className="sb-foot" ref={menuRef}>

            {/* Popup — slides up */}
            {showUserMenu && (
              <div className="sb-popup">

                {/* User identity */}
                <div className="sb-pu-head">
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div className="sb-ava">{initials}</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:tp, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.username||"Gowtham"}</div>
                      <div style={{ fontSize:11, color:tm, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:1 }}>{user?.email||"gowtham@domain.com"}</div>
                    </div>
                  </div>
                </div>

                {/* Theme switcher */}
                <div className="sb-th-row">
                  <div className="sb-th-lbl">Appearance</div>
                  <div className="sb-th-btns">
                    {([
                      { id:"light"  as const, Icon:Sun,     label:"Light"  },
                      { id:"dark"   as const, Icon:Moon,    label:"Dark"   },
                      { id:"system" as const, Icon:Monitor, label:"System" },
                    ]).map(({ id, Icon, label }) => {
                      const active = theme === id
                      return (
                        <button key={id} className="sb-th-btn" onClick={() => setTheme(id)}
                          style={{ background:active?`${accentColor}18`:"none", border:`1px solid ${active?`${accentColor}50`:popBdr}`, color:active?accentColor:ts }}
                        >
                          <Icon size={12}/>{label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Account settings → /settings (user settings only) */}
                <Link href="/settings" onClick={() => setShowUserMenu(false)} className="sb-pu-link"
                  style={{ color:ts, borderTop:`1px solid ${popBdr}` }}
                >
                  <UserCircle size={13} color={ts}/> Account settings
                </Link>

                {/* Sign out */}
                <button className="sb-pu-btn" onClick={handleLogout}
                  style={{ color:"#f87171", borderTop:`1px solid ${popBdr}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <LogOut size={13}/> Sign out
                </button>

              </div>
            )}

            {/* Card button */}
            <button className={`sb-card ${showUserMenu?"on":""}`} onClick={() => setShowUserMenu(p=>!p)}>
              <div className="sb-ava">{initials}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, color:tp, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.username||"Gowtham"}</div>
                <div style={{ fontSize:11, color:tm, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:1 }}>{user?.email||"gowtham@domain.com"}</div>
              </div>
              <ChevronUp size={13} color={tm} style={{ flexShrink:0, transition:"transform 0.2s", transform:showUserMenu?"rotate(0deg)":"rotate(180deg)" }}/>
            </button>

          </div>
        </aside>

        <div className="sb-offset"/>
      </div>
    </>
  )
}
