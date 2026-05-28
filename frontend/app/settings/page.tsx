"use client"

import { useState, useEffect } from "react"
import {
  User, Bell, Shield, Palette,
  Camera, Check, Moon, Sun, Monitor,
  Lock, Eye, EyeOff, Trash2, AlertTriangle,
  Globe, Smartphone,
} from "lucide-react"
import { useTheme } from "@/context/ThemeContext"
import { getMe, deleteAccount } from "@/api/user"
import { useToast } from "@/components/ui/ToastProvider"
import { apiRequest } from "@/lib/apiClient"
import { useRouter } from "next/navigation"

type Tab = "profile" | "notifications" | "security" | "appearance"

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: "profile",       label: "Profile",       icon: User    },
  { id: "notifications", label: "Notifications", icon: Bell    },
  { id: "security",      label: "Security",      icon: Shield  },
  { id: "appearance",    label: "Appearance",    icon: Palette },
]

// ─── UI ATOMS ────────────────────────────────────────────
function Toggle({ enabled, onChange, accent }: { enabled: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <button onClick={() => onChange(!enabled)} style={{ position: "relative", display: "inline-flex", height: 20, width: 36, alignItems: "center", borderRadius: 9999, border: "none", cursor: "pointer", transition: "background 0.2s", background: enabled ? accent : "rgba(128,128,128,0.25)", flexShrink: 0 }}>
      <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.4)", transition: "transform 0.2s", transform: enabled ? "translateX(18px)" : "translateX(3px)" }} />
    </button>
  )
}

function Section({ title, description, children, dark, border, surface }: any) {
  return (
    <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden", transition: "background 0.3s, border-color 0.3s" }}>
      <div style={{ padding: "15px 20px 12px", borderBottom: `1px solid ${border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" }}>
        <h3 style={{ fontFamily: "'Geist',sans-serif", fontSize: 13, fontWeight: 700, color: dark ? "#f0f0f8" : "#0f0f1a", margin: "0 0 2px", letterSpacing: "-0.1px" }}>{title}</h3>
        {description && <p style={{ fontSize: 12, color: dark ? "rgba(240,240,248,0.38)" : "rgba(15,15,26,0.45)", margin: 0 }}>{description}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Row({ label, description, children, dark, border, last = false }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "13px 20px", borderBottom: last ? "none" : `1px solid ${border}`, transition: "background 0.1s" }}
      onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.018)" : "rgba(0,0,0,0.018)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: dark ? "rgba(240,240,248,0.85)" : "rgba(15,15,26,0.85)" }}>{label}</span>
        {description && <span style={{ fontSize: 11.5, color: dark ? "rgba(240,240,248,0.38)" : "rgba(15,15,26,0.42)" }}>{description}</span>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────
export default function UserSettingsPage() {
  const { theme, setTheme, effective, accentColor, setAccentColor, density, setDensity } = useTheme()
  const dark   = effective === "dark"
  const toast  = useToast()
  const router = useRouter()

  const surface  = dark ? "#13131e" : "#ffffff"
  const border   = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"
  const textMain = dark ? "#f0f0f8" : "#0f0f1a"
  const textSub  = dark ? "rgba(240,240,248,0.38)" : "rgba(15,15,26,0.45)"
  const inputBg  = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"
  const accent   = accentColor

  const [activeTab, setActiveTab] = useState<Tab>("profile")
  const [saved,     setSaved]     = useState(false)
  const [showPw,    setShowPw]    = useState(false)
  const [saving,    setSaving]    = useState(false)

  // Profile
  const [name,    setName]    = useState("")
  const [email,   setEmail]   = useState("")
  const [bio,     setBio]     = useState("")
  const [website, setWebsite] = useState("")

  // Notifications
  const [notifs, setNotifs] = useState({
    emailAlerts: true, weeklyDigest: false, marketing: false,
    pushNotifs: true, projectUpdates: true, apiAlerts: true,
  })

  // Security
  const [currentPw,  setCurrentPw]  = useState("")
  const [newPw,      setNewPw]      = useState("")
  const [confirmPw,  setConfirmPw]  = useState("")
  const [twoFA,      setTwoFA]      = useState(false)
  const [sessAlerts, setSessAlerts] = useState(true)

  // Appearance
  const accents  = ["#7c6bff","#3b82f6","#10b981","#f59e0b","#ef4444","#ec4899"]

  useEffect(() => { loadUser() }, [])

  async function loadUser() {
    try {
      const data = await getMe()
      setName(data.username || data.name || "")
      setEmail(data.email || "")
    } catch {
      const stored = localStorage.getItem("user")
      if (stored) {
        try { const u = JSON.parse(stored); setName(u.username || ""); setEmail(u.email || "") } catch {}
      }
    }
  }

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2200) }

  async function handleSaveProfile() {
    setSaving(true)
    try {
      await apiRequest("/auth/me", "PATCH", { username: name, email, bio, website })
      const stored = localStorage.getItem("user")
      if (stored) { try { localStorage.setItem("user", JSON.stringify({ ...JSON.parse(stored), username: name, email })) } catch {} }
      toast.success("Profile updated!"); flash()
    } catch (err: any) { toast.error("Failed: " + err.message) }
    finally { setSaving(false) }
  }

  async function handleUpdatePassword() {
    if (!newPw || newPw !== confirmPw) { toast.error("Passwords don't match"); return }
    setSaving(true)
    try {
      await apiRequest("/auth/password", "PUT", { current_password: currentPw, new_password: newPw })
      toast.success("Password updated!"); flash()
      setCurrentPw(""); setNewPw(""); setConfirmPw("")
    } catch (err: any) { toast.error("Failed: " + err.message) }
    finally { setSaving(false) }
  }

  async function handleDeleteAccount() {
    if (!confirm("Delete your account permanently? This cannot be undone.")) return
    try {
      await deleteAccount()
      localStorage.clear()
      router.push("/auth/login")
    } catch (err: any) { toast.error("Failed: " + err.message) }
  }

  // ── Shared input/label styles ──
  const inp = (extra = {}) => ({ width: "100%", boxSizing: "border-box" as const, background: inputBg, border: `1px solid ${border}`, borderRadius: 9, padding: "9px 12px", fontSize: 13, fontFamily: "'Geist',sans-serif", color: textMain, outline: "none", transition: "border-color 0.15s, box-shadow 0.15s", ...extra })
  const fo  = (e: any) => { e.currentTarget.style.borderColor = `${accent}55`; e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}12` }
  const bl  = (e: any) => { e.currentTarget.style.borderColor = border; e.currentTarget.style.boxShadow = "none" }
  const lbl = (t: string) => <span style={{ fontSize: 11, fontWeight: 700, color: textSub, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{t}</span>
  const field = (label: string, children: React.ReactNode) => (
    <div style={{ padding: "12px 20px", borderBottom: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 6 }}>
      {lbl(label)}{children}
    </div>
  )

  const savBtn = (label: string, onClick: () => void) => (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 20px 14px" }}>
      <button onClick={onClick} disabled={saving}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, border: "none", background: saved ? "linear-gradient(135deg,#10b981,#34d399)" : `linear-gradient(135deg,${accent},#a78bfa)`, color: "white", fontSize: 13, fontWeight: 600, fontFamily: "'Geist',sans-serif", cursor: saving ? "not-allowed" : "pointer", boxShadow: `0 3px 12px ${accent}35`, transition: "all 0.2s" }}
      >
        <Check size={13} /> {saved ? "Saved!" : label}
      </button>
    </div>
  )

  const tabBg = dark ? "#13131e" : "#ffffff"

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        *,*::before,*::after { box-sizing:border-box }
        input::placeholder, textarea::placeholder { color: ${dark?"rgba(240,240,248,0.22)":"rgba(15,15,26,0.28)"}; }
        textarea { resize:vertical; }
      `}</style>

      <div style={{ fontFamily: "'Geist',sans-serif", maxWidth: 860, margin: "0 auto", animation: "fadeUp 0.4s ease both" }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: textMain, margin: "0 0 5px", letterSpacing: "-0.4px" }}>Account Settings</h1>
          <p style={{ fontSize: 14, color: textSub, margin: 0 }}>Manage your profile, preferences and security</p>
        </div>

        <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>

          {/* ── Tab nav ── */}
          <nav style={{ width: 180, flexShrink: 0, background: tabBg, border: `1px solid ${border}`, borderRadius: 13, padding: 7, position: "sticky", top: 24, transition: "background 0.3s, border-color 0.3s" }}>
            {tabs.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 11px", borderRadius: 9, background: active ? `${accent}18` : "none", border: `1px solid ${active ? `${accent}40` : "transparent"}`, cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? accent : textSub, fontFamily: "'Geist',sans-serif", transition: "all 0.15s", marginBottom: 2, textAlign: "left" as const }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "none" }}
                >
                  <Icon size={14} color={active ? accent : textSub} />
                  {tab.label}
                </button>
              )
            })}
          </nav>

          {/* ── Content ── */}
          <div key={activeTab} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.2s ease both" }}>

            {/* ── PROFILE ── */}
            {activeTab === "profile" && <>
              <Section title="Avatar" dark={dark} border={border} surface={surface}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px" }}>
                  <div style={{ width: 54, height: 54, borderRadius: 13, background: `linear-gradient(135deg,${accent},#a78bfa)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Geist',sans-serif", fontWeight: 700, fontSize: 20, color: "white", flexShrink: 0, boxShadow: `0 0 18px ${accent}40` }}>
                    {(name?.[0] || "G").toUpperCase()}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, border: `1px solid ${border}`, background: "none", color: textSub, fontSize: 12, fontFamily: "'Geist',sans-serif", cursor: "pointer", transition: "all 0.14s" }}
                      onMouseEnter={e => { (e.currentTarget.style.background = dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)"); e.currentTarget.style.color = textMain }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = textSub }}
                    >
                      <Camera size={13} /> Upload photo
                    </button>
                    <span style={{ fontSize: 11, color: textSub }}>JPG, PNG · max 2 MB</span>
                  </div>
                </div>
              </Section>

              <Section title="Personal Information" description="Your public profile details" dark={dark} border={border} surface={surface}>
                <div style={{ display: "flex", gap: 12, padding: "14px 20px 0" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    {lbl("Username")}
                    <input style={inp()} value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" onFocus={fo} onBlur={bl} />
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    {lbl("Email")}
                    <input style={inp()} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" onFocus={fo} onBlur={bl} />
                  </div>
                </div>
                {field("Bio", <textarea style={{ ...inp(), minHeight: 68 }} value={bio} onChange={e => setBio(e.target.value)} placeholder="A short bio about you…" onFocus={fo} onBlur={bl} />)}
                {field("Website", <input style={inp()} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yoursite.com" onFocus={fo} onBlur={bl} />)}
                {savBtn("Save profile", handleSaveProfile)}
              </Section>

              {/* Danger */}
              <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.14)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px 12px", borderBottom: "1px solid rgba(239,68,68,0.09)" }}>
                  <AlertTriangle size={13} color="#f87171" />
                  <h3 style={{ fontFamily: "'Geist',sans-serif", fontSize: 13, fontWeight: 700, color: "#f87171", margin: 0 }}>Danger Zone</h3>
                </div>
                <Row label="Delete account" description="Permanently remove your account and all data" dark={dark} border="none" last>
                  <button onClick={handleDeleteAccount} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.07)", color: "#f87171", fontSize: 12, fontWeight: 500, fontFamily: "'Geist',sans-serif", cursor: "pointer", transition: "all 0.14s" }}
                    onMouseEnter={e => { (e.currentTarget.style.background = "rgba(239,68,68,0.14)"); e.currentTarget.style.borderColor = "rgba(239,68,68,0.45)" }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.07)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.28)" }}
                  >
                    <Trash2 size={12} /> Delete account
                  </button>
                </Row>
              </div>
            </>}

            {/* ── NOTIFICATIONS ── */}
            {activeTab === "notifications" && <>
              <Section title="Email Notifications" description="Choose what arrives in your inbox" dark={dark} border={border} surface={surface}>
                <Row label="Email alerts"     description="Critical errors and system alerts"   dark={dark} border={border}><Toggle enabled={notifs.emailAlerts}    onChange={v => setNotifs(p=>({...p,emailAlerts:v}))}    accent={accent}/></Row>
                <Row label="Weekly digest"    description="Analytics summary every Monday"      dark={dark} border={border}><Toggle enabled={notifs.weeklyDigest}   onChange={v => setNotifs(p=>({...p,weeklyDigest:v}))}   accent={accent}/></Row>
                <Row label="Marketing emails" description="Product updates and announcements"   dark={dark} border={border} last><Toggle enabled={notifs.marketing}     onChange={v => setNotifs(p=>({...p,marketing:v}))}      accent={accent}/></Row>
              </Section>
              <Section title="Push Notifications" description="Real-time browser alerts" dark={dark} border={border} surface={surface}>
                <Row label="Push notifications" description="Alerts when the tab is closed"        dark={dark} border={border}><Toggle enabled={notifs.pushNotifs}     onChange={v => setNotifs(p=>({...p,pushNotifs:v}))}     accent={accent}/></Row>
                <Row label="Project updates"     description="When collaborators make changes"     dark={dark} border={border}><Toggle enabled={notifs.projectUpdates} onChange={v => setNotifs(p=>({...p,projectUpdates:v}))} accent={accent}/></Row>
                <Row label="API usage alerts"    description="When usage exceeds 80% of limit"    dark={dark} border={border} last><Toggle enabled={notifs.apiAlerts}      onChange={v => setNotifs(p=>({...p,apiAlerts:v}))}      accent={accent}/></Row>
              </Section>
            </>}

            {/* ── SECURITY ── */}
            {activeTab === "security" && <>
              <Section title="Change Password" dark={dark} border={border} surface={surface}>
                {field("Current password",
                  <div style={{ position: "relative" }}>
                    <input style={{ ...inp(), paddingRight: 36 }} type={showPw ? "text" : "password"} placeholder="••••••••" value={currentPw} onChange={e => setCurrentPw(e.target.value)} onFocus={fo} onBlur={bl} />
                    <button onClick={() => setShowPw(p=>!p)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: textSub, display: "flex" }}>
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                )}
                {field("New password",     <input style={inp()} type="password" placeholder="8+ characters" value={newPw}      onChange={e => setNewPw(e.target.value)}      onFocus={fo} onBlur={bl} />)}
                {field("Confirm password", <input style={inp()} type="password" placeholder="Match above"   value={confirmPw}  onChange={e => setConfirmPw(e.target.value)}  onFocus={fo} onBlur={bl} />)}
                {savBtn("Update password", handleUpdatePassword)}
              </Section>

              <Section title="Two-Factor Authentication" description="Add an extra layer of security to your account" dark={dark} border={border} surface={surface}>
                <Row label="Enable 2FA"     description="Use an authenticator app at login"   dark={dark} border={border}><Toggle enabled={twoFA}      onChange={setTwoFA}      accent={accent}/></Row>
                <Row label="Session alerts" description="Notify when a new device signs in"   dark={dark} border={border} last><Toggle enabled={sessAlerts} onChange={setSessAlerts} accent={accent}/></Row>
              </Section>

              <Section title="Active Sessions" dark={dark} border={border} surface={surface}>
                {[
                  { device: "Chrome on macOS",  location: "Hyderabad, IN", current: true,  time: "Now",    Icon: Globe       },
                  { device: "Safari on iPhone", location: "Hyderabad, IN", current: false, time: "2h ago", Icon: Smartphone  },
                ].map((s,i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 20px", borderBottom: i===0 ? `1px solid ${border}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div style={{ width: 33, height: 33, borderRadius: 9, background: `${accent}12`, border: `1px solid ${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <s.Icon size={15} color={accent} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: textMain, display: "flex", alignItems: "center", gap: 7 }}>
                          {s.device}
                          {s.current && <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.22)" }}>Current</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: textSub, marginTop: 2 }}>{s.location} · {s.time}</div>
                      </div>
                    </div>
                    {!s.current && (
                      <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)", color: "#f87171", fontSize: 12, fontWeight: 500, fontFamily: "'Geist',sans-serif", cursor: "pointer", transition: "all 0.14s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.12)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.06)")}
                      >Revoke</button>
                    )}
                  </div>
                ))}
              </Section>
            </>}

            {/* ── APPEARANCE ── */}
            {activeTab === "appearance" && <>
              <Section title="Color Mode" description="Choose how InsightLake looks for you" dark={dark} border={border} surface={surface}>
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    {([
                      { id:"light"  as const, label:"Light",  Icon:Sun,     preview:"#f8f8fc" },
                      { id:"dark"   as const, label:"Dark",   Icon:Moon,    preview:"#0a0a0f" },
                      { id:"system" as const, label:"System", Icon:Monitor, preview:"linear-gradient(135deg,#0a0a0f 50%,#f8f8fc 50%)" },
                    ]).map(({ id, label, Icon, preview }) => (
                      <div key={id} onClick={() => setTheme(id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", flex: 1 }}>
                        <div style={{ width: "100%", height: 60, borderRadius: 10, background: preview, border: `2px solid ${theme===id ? accent : border}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", boxShadow: theme===id ? `0 0 0 3px ${accent}22` : "none" }}>
                          <Icon size={18} color={id==="light"?"#f59e0b": id==="dark"?accent:"#34d399"} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: theme===id ? accent : textSub }}>{label}</span>
                      </div>
                    ))}
                  </div>
                  {theme === "system" && (
                    <p style={{ fontSize: 11.5, color: textSub, marginTop: 10, textAlign: "center" }}>
                      Following system preference — currently <strong style={{ color: accent }}>{effective}</strong>
                    </p>
                  )}
                </div>
              </Section>

              <Section title="Accent Color" description="Used across buttons, active states and highlights" dark={dark} border={border} surface={surface}>
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {accents.map(c => (
                      <div key={c} onClick={() => setAccentColor(c)} style={{ width: 32, height: 32, borderRadius: "50%", background: c, cursor: "pointer", border: `3px solid ${accentColor===c?"white":c}`, boxShadow: accentColor===c?`0 0 0 2px ${c}`:"none", transition: "transform 0.15s", flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.18)")}
                        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                      />
                    ))}
                    {/* Custom color picker */}
                    <label style={{ width: 32, height: 32, borderRadius: "50%", border: `2px dashed ${border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: textSub, transition: "border-color 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = accent)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = border)}
                    >
                      +
                      <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                    </label>
                  </div>
                  <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: accentColor }} />
                    <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: textSub }}>{accentColor}</span>
                  </div>
                </div>
              </Section>

              <Section title="Interface Density" description="Controls spacing and element sizing throughout the UI" dark={dark} border={border} surface={surface}>
                <Row label="Density" description="Affects padding and spacing" dark={dark} border="none" last>
                  <div style={{ display: "flex", gap: 7 }}>
                    {(["compact","default","comfortable"] as const).map(d => (
                      <button key={d} onClick={() => setDensity(d)} style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${density===d?`${accent}55`:border}`, background: density===d?`${accent}14`:"none", color: density===d?accent:textSub, fontSize: 12, fontFamily: "'Geist',sans-serif", cursor: "pointer", transition: "all 0.14s", fontWeight: density===d?600:400 }}>
                        {d.charAt(0).toUpperCase()+d.slice(1)}
                      </button>
                    ))}
                  </div>
                </Row>
              </Section>
            </>}

          </div>
        </div>
      </div>
    </>
  )
}
