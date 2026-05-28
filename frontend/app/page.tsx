"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "@/context/ThemeContext"

// ─── ANIMATED COUNTER ────────────────────────────────────
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      observer.disconnect()
      let start = 0
      const step = to / 60
      const tick = () => {
        start += step
        if (start >= to) { setVal(to); return }
        setVal(Math.floor(start))
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [to])
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

// ─── DATA STREAM CANVAS ──────────────────────────────────
function DataStream({ dark }: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    let raf: number
    const cols = Math.floor(canvas.offsetWidth / 20)
    const drops = Array.from({ length: cols }, () => Math.random() * -50)
    const chars = "01アイウエオABCDEF∑∫∂∇⊕⊗"
    const draw = () => {
      ctx.fillStyle = dark ? "rgba(8,8,16,0.06)" : "rgba(240,240,248,0.06)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font = "13px 'Geist Mono', monospace"
      drops.forEach((y, i) => {
        const c = chars[Math.floor(Math.random() * chars.length)]
        const alpha = Math.random() * 0.3 + 0.04
        ctx.fillStyle = `rgba(124,107,255,${alpha})`
        ctx.fillText(c, i * 20, y * 20)
        if (y * 20 > canvas.height && Math.random() > 0.975) drops[i] = 0
        drops[i] += 0.4
      })
      raf = requestAnimationFrame(draw)
    }
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    draw()
    return () => cancelAnimationFrame(raf)
  }, [dark])
  return <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.4 }} />
}

// ─── MOCK CHART ───────────────────────────────────────────
function MockChart({ accent }: { accent: string }) {
  const bars = [42, 68, 55, 85, 63, 91, 74, 82, 58, 94, 71, 88]
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:72, padding:"0 4px" }}>
      {bars.map((h, i) => (
        <div key={i} style={{ flex:1, height:`${h}%`, borderRadius:"3px 3px 0 0",
          background: i === bars.length-1 ? accent : `${accent}${Math.floor(40+i*5).toString(16).padStart(2,"0")}`,
          transition:"height 0.5s ease"
        }} />
      ))}
    </div>
  )
}

// ─── FEATURE CARD ────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay=0, dark, accent }: { icon:string; title:string; desc:string; delay?:number; dark:boolean; accent:string }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov
          ? dark ? `${accent}10` : `${accent}09`
          : dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
        border: `1px solid ${hov ? `${accent}40` : dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}`,
        borderRadius:16, padding:"28px 26px",
        transition:"all 0.25s ease",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        animation:`fadeUp 0.6s ease ${delay}ms both`,
      }}
    >
      <div style={{ width:44, height:44, borderRadius:12, background:`${accent}20`, border:`1px solid ${accent}30`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:18, fontSize:20 }}>
        {icon}
      </div>
      <h3 style={{ fontFamily:"'Geist',sans-serif", fontSize:16, fontWeight:600, color:dark?"#f0f0f8":"#0f0f1a", margin:"0 0 10px", letterSpacing:"-0.2px" }}>{title}</h3>
      <p style={{ fontSize:14, color:dark?"rgba(240,240,248,0.5)":"rgba(15,15,26,0.55)", margin:0, lineHeight:1.7 }}>{desc}</p>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const { effective, accentColor, theme, setTheme } = useTheme()
  const dark = effective === "dark"

  const [scrolled,    setScrolled]    = useState(false)
  const [mobileMenu,  setMobileMenu]  = useState(false)
  const [loggedIn,    setLoggedIn]    = useState(false)
  const [user,        setUser]        = useState<{ username:string; email:string } | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const accent = accentColor

  // ── Auth detection ──
  useEffect(() => {
    const token = localStorage.getItem("token")
    const stored = localStorage.getItem("user")
    if (token) {
      setLoggedIn(true)
      if (stored) { try { setUser(JSON.parse(stored)) } catch {} }
    }
  }, [])

  // ── Scroll detection ──
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  // ── Close user menu on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setLoggedIn(false)
    setUser(null)
    setUserMenuOpen(false)
  }

  // ── Theme-aware tokens ──
  const pageBg     = dark ? "#080810"                 : "#f8f8fc"
  const textPrimary = dark ? "#f0f0f8"                : "#0f0f1a"
  const textMuted  = dark ? "rgba(240,240,248,0.5)"  : "rgba(15,15,26,0.5)"
  const textFaint  = dark ? "rgba(240,240,248,0.25)" : "rgba(15,15,26,0.28)"
  const sectionBg  = dark ? "rgba(124,107,255,0.03)" : "rgba(124,107,255,0.03)"
  const cardBg     = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"
  const cardBorder = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const navBg      = scrolled
    ? dark ? "rgba(8,8,16,0.9)" : "rgba(248,248,252,0.92)"
    : "transparent"
  const navBorder  = scrolled
    ? dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
    : "transparent"
  const btnGhostBorder = dark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.13)"
  const btnGhostBg     = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"
  const btnGhostColor  = dark ? "rgba(240,240,248,0.75)" : "rgba(15,15,26,0.7)"
  const mockBg         = dark ? "rgba(13,13,20,0.95)"    : "rgba(255,255,255,0.95)"
  const mockBorder     = dark ? `${accent}30`             : `${accent}25`
  const popupBg        = dark ? "#13131e"                 : "#ffffff"
  const popupBorder    = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"

  const features = [
    { icon:"⚡", title:"AI-powered analysis",      desc:"Ask questions in plain English and get instant insights, trends and anomalies surfaced automatically from your data." },
    { icon:"🗄", title:"Dataset management",        desc:"Upload CSV, Excel or JSON files. Preview columns, inspect schemas and manage versions in one clean workspace." },
    { icon:"📊", title:"Auto-generated dashboards", desc:"Describe what you want to see and watch charts, KPIs and tables materialise in seconds without writing a single query." },
    { icon:"👥", title:"Team collaboration",        desc:"Invite colleagues, assign roles and work on projects together. Everyone stays in sync, always." },
    { icon:"🔑", title:"API key management",        desc:"Connect your own AI model providers — OpenAI, Gemini and more — with encrypted, project-scoped keys." },
    { icon:"🔒", title:"Enterprise-grade security", desc:"JWT authentication, role-based access control and end-to-end encryption keep your data where it belongs." },
  ]

  const steps = [
    { num:"01", title:"Upload a dataset", desc:"Drag in a CSV or connect your database. InsightLake parses structure automatically." },
    { num:"02", title:"Ask the AI",       desc:"Type a question. The AI analyst reads your data and replies with charts, tables and explanations." },
    { num:"03", title:"Build dashboards", desc:"Pin answers to a dashboard. Reshape, rename and share with your team in one click." },
  ]

  const testimonials = [
    { name:"Priya Sharma",  role:"Head of Analytics · Razorpay",    text:"We replaced a week of manual reporting with a 10-minute InsightLake session. The AI caught a revenue anomaly our BI team had missed for two quarters.", avatar:"PS" },
    { name:"Marcus Chen",   role:"Co-founder · Kairon Labs",        text:"The auto-dashboard feature is genuinely magic. I describe what I need and it builds the chart. It's like having a senior data scientist on demand.",  avatar:"MC" },
    { name:"Amara Osei",    role:"Product Lead · Flutterwave",      text:"Collaboration is seamless. My PM, engineer and I all live in the same project, each pulling the insights we need without stepping on each other.",    avatar:"AO" },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html { scroll-behavior:smooth; }

        body {
          background: ${pageBg};
          color: ${textPrimary};
          font-family: 'Geist', sans-serif;
          -webkit-font-smoothing: antialiased;
          transition: background 0.3s, color 0.3s;
        }

        @keyframes fadeUp    { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes shimmer   { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes float     { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-12px)} }
        @keyframes pulseRing { 0%{transform:scale(0.9);opacity:0.8} 100%{transform:scale(1.6);opacity:0} }
        @keyframes ticker    { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes popIn     { from{opacity:0;transform:translateY(8px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }

        .hero-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(42px, 6vw, 80px);
          font-weight: 400;
          color: ${textPrimary};
          line-height: 1.08;
          letter-spacing: -1.5px;
        }
        .hero-title em {
          font-style: italic;
          background: linear-gradient(90deg, #c4b8ff 0%, ${accent} 40%, #a78bfa 80%, #c4b8ff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 5s linear infinite;
        }

        .mono {
          font-family: 'Geist Mono', monospace;
          font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
        }

        .grid-bg {
          position:absolute; inset:0; pointer-events:none;
          background-image:
            linear-gradient(${dark?"rgba(124,107,255,0.05)":"rgba(124,107,255,0.04)"} 1px, transparent 1px),
            linear-gradient(90deg, ${dark?"rgba(124,107,255,0.05)":"rgba(124,107,255,0.04)"} 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 100%);
        }

        .noise {
          position:fixed; inset:0; pointer-events:none; z-index:100; opacity:0.018;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        .orb { position:absolute; border-radius:50%; pointer-events:none; filter:blur(80px); }

        .ticker-track {
          display:flex; gap:48px; white-space:nowrap;
          animation:ticker 28s linear infinite;
        }

        .glass {
          background: ${cardBg};
          border: 1px solid ${cardBorder};
          border-radius: 20px;
          backdrop-filter: blur(8px);
        }

        .btn-primary {
          display:inline-flex; align-items:center; gap:8px;
          padding:13px 26px; border-radius:12px; border:none;
          background:linear-gradient(135deg, ${accent} 0%, #a78bfa 100%);
          color:white; font-size:14px; font-weight:600;
          font-family:'Geist',sans-serif; cursor:pointer; text-decoration:none;
          box-shadow:0 4px 24px ${accent}66, 0 1px 0 rgba(255,255,255,0.12) inset;
          transition:all 0.22s ease; position:relative; overflow:hidden;
        }
        .btn-primary::after { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.12),transparent); opacity:0; transition:opacity 0.22s; }
        .btn-primary:hover::after { opacity:1; }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 10px 36px ${accent}80; }

        .btn-ghost {
          display:inline-flex; align-items:center; gap:8px;
          padding:13px 26px; border-radius:12px;
          border:1px solid ${btnGhostBorder};
          background:${btnGhostBg};
          color:${btnGhostColor}; font-size:14px; font-weight:500;
          font-family:'Geist',sans-serif; cursor:pointer; text-decoration:none;
          transition:all 0.2s ease;
        }
        .btn-ghost:hover { background:${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.07)"}; color:${textPrimary}; border-color:${dark?"rgba(255,255,255,0.22)":"rgba(0,0,0,0.18)"}; }

        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background:${dark?"#0d0d18":"#f0f0f8"}; }
        ::-webkit-scrollbar-thumb { background:${accent}55; border-radius:3px; }

        @media (max-width:768px) {
          .hero-title { font-size:clamp(34px,10vw,52px); letter-spacing:-1px; }
          .features-grid { grid-template-columns:1fr !important; }
          .steps-grid    { grid-template-columns:1fr !important; }
          .testimonials-grid { grid-template-columns:1fr !important; }
          .stats-grid    { grid-template-columns:repeat(2,1fr) !important; }
          .nav-links     { display:none !important; }
          .footer-grid   { grid-template-columns:1fr !important; }
        }
      `}</style>

      <div className="noise" style={{ background: dark ? undefined : "none" }} />

      {/* ── NAVBAR ── */}
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:50,
        padding:"0 32px", height:64,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        background: navBg,
        borderBottom: `1px solid ${navBorder}`,
        backdropFilter: scrolled ? "blur(18px)" : "none",
        transition:"all 0.3s ease",
      }}>

        {/* Logo */}
        <Link href="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none" }}>
          <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg,${accent},#a78bfa)`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 20px ${accent}66` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontFamily:"'Geist',sans-serif", fontWeight:700, fontSize:16, color:textPrimary, letterSpacing:"-0.3px" }}>InsightLake AI</span>
        </Link>

        {/* Nav links */}
        <div className="nav-links" style={{ display:"flex", alignItems:"center", gap:32 }}>
          {["Features","How it works"].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g,"-")}`}
              style={{ fontSize:14, color:textMuted, textDecoration:"none", transition:"color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={e => (e.currentTarget.style.color = textMuted)}
            >{l}</a>
          ))}
        </div>

        {/* Auth area */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>

          {loggedIn ? (
            /* ── Logged in: avatar + dropdown ── */
            <div ref={userMenuRef} style={{ position:"relative" }}>
              <button
                onClick={() => setUserMenuOpen(p => !p)}
                style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 10px 6px 6px", borderRadius:10, border:`1px solid ${btnGhostBorder}`, background:btnGhostBg, cursor:"pointer", transition:"all 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.07)")}
                onMouseLeave={e => (e.currentTarget.style.background = btnGhostBg)}
              >
                <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg,${accent},#a78bfa)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"white" }}>
                  {(user?.username?.[0] || "G").toUpperCase()}
                </div>
                <span style={{ fontSize:13, fontWeight:500, color:textPrimary, maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {user?.username || "Account"}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition:"transform 0.2s", transform: userMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, background:popupBg, border:`1px solid ${popupBorder}`, borderRadius:13, overflow:"hidden", minWidth:200, boxShadow: dark?"0 12px 40px rgba(0,0,0,0.5)":"0 12px 40px rgba(0,0,0,0.12)", zIndex:200, animation:"popIn 0.18s cubic-bezier(0.16,1,0.3,1)" }}>
                  <div style={{ padding:"12px 16px", borderBottom:`1px solid ${popupBorder}`, background: dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)" }}>
                    <div style={{ fontSize:13, fontWeight:600, color:textPrimary }}>{user?.username || "User"}</div>
                    <div style={{ fontSize:11, color:textMuted, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.email || ""}</div>
                  </div>

                  {/* Theme switcher */}
                  <div style={{ padding:"10px 14px", borderBottom:`1px solid ${popupBorder}` }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:textMuted, marginBottom:8 }}>Theme</div>
                    <div style={{ display:"flex", gap:6 }}>
                      {([
                        { id:"light" as const,  label:"Light",  icon:"☀" },
                        { id:"dark"  as const,  label:"Dark",   icon:"🌙" },
                        { id:"system" as const, label:"System", icon:"💻" },
                      ]).map(({ id, label, icon }) => (
                        <button key={id} onClick={() => setTheme(id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"6px 4px", borderRadius:8, border:`1px solid ${theme===id?`${accent}55`:btnGhostBorder}`, background:theme===id?`${accent}14`:"none", cursor:"pointer", fontFamily:"'Geist',sans-serif", transition:"all 0.15s" }}>
                          <span style={{ fontSize:13 }}>{icon}</span>
                          <span style={{ fontSize:10, fontWeight:500, color:theme===id?accent:textMuted }}>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Link href="/projects" onClick={() => setUserMenuOpen(false)}
                    style={{ display:"flex", alignItems:"center", gap:9, padding:"10px 16px", textDecoration:"none", fontSize:13, color:textPrimary, transition:"background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                    Go to app
                  </Link>
                  <Link href="/settings" onClick={() => setUserMenuOpen(false)}
                    style={{ display:"flex", alignItems:"center", gap:9, padding:"10px 16px", textDecoration:"none", fontSize:13, color:textPrimary, transition:"background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    Settings
                  </Link>
                  <button onClick={handleLogout}
                    style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"10px 16px", background:"none", border:"none", cursor:"pointer", fontSize:13, color:"#f87171", fontFamily:"'Geist',sans-serif", transition:"background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── Not logged in: Login + Get started ── */
            <>
              <Link href="/auth/login" className="btn-ghost" style={{ padding:"8px 18px", fontSize:13 }}>Log in</Link>
              <Link href="/auth/signup" className="btn-primary" style={{ padding:"8px 18px", fontSize:13 }}>Get started free</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position:"relative", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", paddingTop:64 }}>
        <div className="grid-bg" />
        <DataStream dark={dark} />
        <div className="orb" style={{ width:600, height:600, background:`radial-gradient(circle, ${accent}20 0%, transparent 70%)`, top:-100, left:"50%", transform:"translateX(-50%)" }} />
        <div className="orb" style={{ width:400, height:400, background:`radial-gradient(circle, ${accent}14 0%, transparent 70%)`, bottom:0, right:-100 }} />

        <div style={{ position:"relative", zIndex:2, textAlign:"center", maxWidth:860, padding:"0 24px", animation:"fadeUp 0.7s ease both" }}>

          {/* Badge */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:`${accent}18`, border:`1px solid ${accent}40`, borderRadius:100, padding:"6px 14px", marginBottom:36 }}>
            <div style={{ position:"relative" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#34d399" }} />
              <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"#34d399", animation:"pulseRing 1.8s ease-out infinite" }} />
            </div>
            <span className="mono" style={{ color:dark?"rgba(167,139,250,0.85)":"rgba(100,80,220,0.85)", fontSize:11 }}>Now in public beta — free to try</span>
          </div>

          <h1 className="hero-title" style={{ marginBottom:28 }}>
            Your data,<br />
            <em>finally intelligent</em>
          </h1>

          <p style={{ fontSize:18, color:textMuted, lineHeight:1.7, maxWidth:560, margin:"0 auto 44px", fontWeight:300 }}>
            Upload a dataset, ask a question, get a dashboard. InsightLake AI turns raw data into boardroom-ready insights in minutes — no SQL required.
          </p>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14, flexWrap:"wrap" }}>
            {loggedIn ? (
              <>
                <Link href="/projects" className="btn-primary" style={{ fontSize:15, padding:"14px 30px" }}>
                  Go to workspace
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/settings" className="btn-ghost" style={{ fontSize:15, padding:"14px 30px" }}>Settings</Link>
              </>
            ) : (
              <>
                <Link href="/auth/signup" className="btn-primary" style={{ fontSize:15, padding:"14px 30px" }}>
                  Start for free
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/auth/login" className="btn-ghost" style={{ fontSize:15, padding:"14px 30px" }}>Sign in</Link>
              </>
            )}
          </div>

          {!loggedIn && <p style={{ fontSize:12, color:textFaint, marginTop:18 }}>No credit card required · Free forever on starter plan</p>}
          {loggedIn  && <p style={{ fontSize:12, color:textMuted, marginTop:18 }}>Welcome back, <strong style={{ color:accent }}>{user?.username || "there"}</strong> 👋</p>}

          {/* Hero mockup */}
          <div style={{ marginTop:72, position:"relative", animation:"float 6s ease-in-out infinite" }}>
            <div style={{ background:mockBg, border:`1px solid ${mockBorder}`, borderRadius:20, overflow:"hidden", boxShadow:`0 0 80px ${accent}20, 0 40px 120px rgba(0,0,0,${dark?0.6:0.12})`, maxWidth:780, margin:"0 auto" }}>
              {/* Window chrome */}
              <div style={{ display:"flex", alignItems:"center", gap:7, padding:"14px 20px", borderBottom:`1px solid ${dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)"}`, background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)" }}>
                {["#f87171","#fbbf24","#34d399"].map((c,i) => <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:c, opacity:0.8 }}/>)}
                <div style={{ flex:1, height:8, background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)", borderRadius:4, maxWidth:200, margin:"0 auto" }} />
              </div>
              {/* Dashboard grid */}
              <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", minHeight:320 }}>
                {/* Sidebar */}
                <div style={{ borderRight:`1px solid ${dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)"}`, padding:"20px 14px", display:"flex", flexDirection:"column", gap:6, background:dark?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.01)" }}>
                  {["Dashboard","Datasets","AI Chat","Members","Settings"].map((item,i) => (
                    <div key={item} style={{ padding:"8px 10px", borderRadius:8, fontSize:13, color:i===0?accent:textMuted, background:i===0?`${accent}18`:"none", fontWeight:i===0?500:400, display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:14, height:14, borderRadius:3, background:i===0?`${accent}40`:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)" }} />
                      {item}
                    </div>
                  ))}
                </div>
                {/* Main */}
                <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                    {[["3.2M","Data points"],["98%","AI accuracy"],["0.4s","Avg query"]].map(([n,l]) => (
                      <div key={l} style={{ background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.04)", border:`1px solid ${dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.07)"}`, borderRadius:10, padding:"12px 14px" }}>
                        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:20, fontWeight:600, color:textPrimary, marginBottom:3 }}>{n}</div>
                        <div style={{ fontSize:11, color:textMuted }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.03)", border:`1px solid ${dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)"}`, borderRadius:12, padding:"14px 16px" }}>
                    <div style={{ fontSize:11, color:textMuted, marginBottom:10, fontFamily:"'Geist Mono',monospace", textTransform:"uppercase", letterSpacing:"0.06em" }}>Revenue by month</div>
                    <MockChart accent={accent} />
                  </div>
                  <div style={{ background:`${accent}0d`, border:`1px solid ${accent}28`, borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    <span style={{ fontSize:12, color:textMuted, fontFamily:"'Geist Mono',monospace" }}>Which product had the highest growth in Q1?</span>
                    <div style={{ marginLeft:"auto", width:22, height:22, borderRadius:6, background:accent, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Floating badge */}
            <div style={{ position:"absolute", top:32, right:-20, background:mockBg, border:"1px solid rgba(52,211,153,0.3)", borderRadius:12, padding:"10px 14px", boxShadow:`0 8px 24px rgba(0,0,0,${dark?0.4:0.1})` }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:"#34d399", boxShadow:"0 0 8px rgba(52,211,153,0.6)" }}/>
                <span style={{ fontSize:12, color:"#34d399", fontFamily:"'Geist Mono',monospace", fontWeight:500 }}>+24.8% MoM</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div style={{ borderTop:`1px solid ${cardBorder}`, borderBottom:`1px solid ${cardBorder}`, padding:"14px 0", overflow:"hidden", background:dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.02)" }}>
        <div style={{ display:"flex", overflow:"hidden" }}>
          <div className="ticker-track">
            {["AI Data Analysis","Auto Dashboards","Real-time Insights","CSV · Excel · JSON","Team Collaboration","OpenAI · Gemini","No-code Analytics","Instant Visualisation","AI Data Analysis","Auto Dashboards","Real-time Insights","CSV · Excel · JSON","Team Collaboration","OpenAI · Gemini","No-code Analytics","Instant Visualisation"].map((t,i) => (
              <span key={i} className="mono" style={{ color:textMuted, flexShrink:0, display:"flex", alignItems:"center", gap:48 }}>
                {t}<span style={{ color:accent, marginLeft:-24 }}>·</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <section style={{ padding:"100px 24px", maxWidth:1080, margin:"0 auto" }}>
        <div className="stats-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:2 }}>
          {[
            { num:180, suffix:"+", label:"Natural language queries processed" },
            { num:89,  suffix:"%", label:"Query-to-SQL accuracy" },
            { num:35,  suffix:"+", label:"Datasets analyzed" },
            { num:5,   suffix:"x", label:"Faster analytics" },
          ].map((s,i) => (
            <div key={i} style={{ padding:"36px 28px", borderLeft:i>0?`1px solid ${cardBorder}`:"none", textAlign:"center" }}>
              <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:52, fontWeight:400, color:textPrimary, letterSpacing:"-2px", lineHeight:1 }}>
                <Counter to={s.num} suffix={s.suffix} />
              </div>
              <div style={{ fontSize:13, color:textMuted, marginTop:10, fontWeight:300 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding:"80px 24px 120px", maxWidth:1080, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:64 }}>
          <div className="mono" style={{ color:`${accent}99`, marginBottom:16 }}>Everything you need</div>
          <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:"clamp(32px,4vw,50px)", fontWeight:400, color:textPrimary, letterSpacing:"-0.8px", lineHeight:1.12, marginBottom:18 }}>
            Built for analysts,<br /><em style={{ fontStyle:"italic" }}>loved by everyone</em>
          </h2>
          <p style={{ fontSize:16, color:textMuted, maxWidth:480, margin:"0 auto", lineHeight:1.7, fontWeight:300 }}>
            Every feature designed to cut the distance between raw data and clear decisions.
          </p>
        </div>
        <div className="features-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
          {features.map((f,i) => <FeatureCard key={f.title} {...f} delay={i*80} dark={dark} accent={accent} />)}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding:"80px 24px 120px", borderTop:`1px solid ${cardBorder}`, borderBottom:`1px solid ${cardBorder}`, background:sectionBg }}>
        <div style={{ maxWidth:1080, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:72 }}>
            <div className="mono" style={{ color:`${accent}99`, marginBottom:16 }}>How it works</div>
            <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:"clamp(30px,3.5vw,46px)", fontWeight:400, color:textPrimary, letterSpacing:"-0.6px" }}>
              From data to dashboard<br />in three steps
            </h2>
          </div>
          <div className="steps-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:48 }}>
            {steps.map((s,i) => (
              <div key={i} style={{ animation:`fadeUp 0.6s ease ${i*100}ms both` }}>
                <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:22 }}>
                  <div style={{ width:52, height:52, borderRadius:14, background:`${accent}18`, border:`1px solid ${accent}30`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Geist Mono',monospace", fontSize:16, fontWeight:700, color:accent, flexShrink:0 }}>
                    {s.num}
                  </div>
                  {i < 2 && <div style={{ flex:1, height:1, background:`linear-gradient(90deg, ${accent}35, transparent)` }} />}
                </div>
                <h3 style={{ fontFamily:"'Geist',sans-serif", fontSize:18, fontWeight:600, color:textPrimary, marginBottom:12, letterSpacing:"-0.2px" }}>{s.title}</h3>
                <p style={{ fontSize:14, color:textMuted, lineHeight:1.75, fontWeight:300 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      
      {/* ── CTA ── */}
      <section style={{ padding:"120px 24px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div className="orb" style={{ width:800, height:400, background:`radial-gradient(ellipse, ${accent}16 0%, transparent 70%)`, top:"50%", left:"50%", transform:"translate(-50%,-50%)" }} />
        <div style={{ position:"relative", zIndex:1 }}>
          <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:"clamp(36px,5vw,64px)", fontWeight:400, color:textPrimary, letterSpacing:"-1.2px", marginBottom:22, lineHeight:1.1 }}>
            Ready to stop guessing<br />and start knowing?
          </h2>
          <p style={{ fontSize:16, color:textMuted, maxWidth:440, margin:"0 auto 44px", lineHeight:1.7, fontWeight:300 }}>
            Join 2,400+ teams already using InsightLake AI to make faster, smarter decisions.
          </p>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14, flexWrap:"wrap" }}>
            {loggedIn ? (
              <Link href="/projects" className="btn-primary" style={{ fontSize:15, padding:"15px 36px" }}>
                Go to workspace
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            ) : (
              <Link href="/auth/signup" className="btn-primary" style={{ fontSize:15, padding:"15px 36px" }}>
                Create free account
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            )}
          </div>
          {!loggedIn && <p style={{ fontSize:12, color:textFaint, marginTop:16 }}>No credit card · Free forever on Starter · Cancel Pro anytime</p>}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop:`1px solid ${cardBorder}`, padding:"56px 32px 40px", background:dark?"rgba(5,5,10,0.8)":"rgba(0,0,0,0.02)" }}>
        <div style={{ maxWidth:1080, margin:"0 auto" }}>
          <div className="footer-grid" style={{ display:"grid", gridTemplateColumns:"1.5fr repeat(3,1fr)", gap:48, marginBottom:56 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                <div style={{ width:30, height:30, borderRadius:8, background:`linear-gradient(135deg,${accent},#a78bfa)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </div>
                <span style={{ fontWeight:700, fontSize:15, color:textPrimary }}>InsightLake AI</span>
              </div>
              <p style={{ fontSize:13, color:textMuted, lineHeight:1.7, maxWidth:220 }}>AI-powered analytics for teams that move fast.</p>
            </div>
            {[
              { heading:"Product",   links:["Features","Changelog","Roadmap"] },
              { heading:"Developers",links:["API Docs","SDK","Integrations","Status"]   },
              { heading:"Company",   links:["About","Blog","Careers","Contact"]         },
            ].map(col => (
              <div key={col.heading}>
                <div className="mono" style={{ color:textMuted, marginBottom:16 }}>{col.heading}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {col.links.map(l => (
                    <a key={l} href="#" style={{ fontSize:13, color:textMuted, textDecoration:"none", transition:"color 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = textPrimary)}
                      onMouseLeave={e => (e.currentTarget.style.color = textMuted)}
                    >{l}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop:`1px solid ${cardBorder}`, paddingTop:28, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
            <p className="mono" style={{ color:textFaint, fontSize:11 }}>© {new Date().getFullYear()} InsightLake AI — All rights reserved</p>
            <div style={{ display:"flex", gap:20 }}>
              {["Privacy policy","Terms of service"].map(l => (
                <a key={l} href="#" style={{ fontSize:12, color:textFaint, textDecoration:"none" }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
