"use client"

import { useState } from "react"
import Link from "next/link"
import { getMe, login } from "@/api/user"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/ToastProvider"
import { useTheme } from "@/context/ThemeContext"
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react"

export default function LoginForm() {
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()
  const toast  = useToast()

  const { effective, accentColor } = useTheme()
  const dark = effective === "dark"

  // ── All colours derived from theme ──────────────────────
  const accent = accentColor

  // Page / structure
  const pageBg     = dark ? "#080810"               : "#f4f4fb"
  const rightBg    = dark ? "#0d0d16"               : "#ffffff"
  const dividerC   = dark ? `${accent}22`           : `${accent}18`

  // Left panel
  const leftText   = dark ? "#f0f0f8"               : "#0f0f1a"
  const leftSub    = dark ? "rgba(240,240,248,0.42)" : "rgba(15,15,26,0.5)"
  const gridLine   = dark ? `${accent}12`           : `${accent}0e`

  // Form chrome
  const cardBg     = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)"
  const inputBg    = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"
  const inputBdr   = dark ? "rgba(255,255,255,0.1)"  : "rgba(0,0,0,0.12)"
  const formTitle  = dark ? "#f0f0f8"               : "#0f0f1a"
  const formSub    = dark ? "rgba(240,240,248,0.4)"  : "rgba(15,15,26,0.45)"
  const labelC     = dark ? "rgba(240,240,248,0.52)" : "rgba(15,15,26,0.55)"
  const inputC     = dark ? "#e8e8f0"               : "#0f0f1a"
  const inputPh    = dark ? "rgba(240,240,248,0.22)" : "rgba(15,15,26,0.28)"
  const eyeC       = dark ? "rgba(240,240,248,0.3)"  : "rgba(15,15,26,0.3)"
  const forgotC    = dark ? `${accent}88`            : `${accent}cc`
  const orTextC    = dark ? "rgba(240,240,248,0.22)" : "rgba(15,15,26,0.3)"
  const orLineC    = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)"
  const linkBodyC  = dark ? "rgba(240,240,248,0.4)"  : "rgba(15,15,26,0.5)"
  const linkAC     = dark ? "#a78bfa"               : accent
  const statNumC   = dark ? "#f0f0f8"               : "#0f0f1a"
  const statLblC   = dark ? "rgba(240,240,248,0.35)" : "rgba(15,15,26,0.4)"

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await login({ email, password })
      localStorage.setItem("token", response.access_token)
      const userdetails = await getMe()
      localStorage.setItem("user", JSON.stringify(userdetails))
      toast.success("Welcome back!")
      router.push("/projects")
    } catch (err: any) {
      toast.error("Login failed: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap');

        @keyframes lf-fadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lf-gridMove  { from{transform:translateY(0)} to{transform:translateY(-50%)} }
        @keyframes lf-orb1      { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-20px) scale(1.08)} }
        @keyframes lf-orb2      { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-20px,25px) scale(0.94)} }
        @keyframes lf-spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes lf-shimmer   { 0%{background-position:-200% center} 100%{background-position:200% center} }

        *, *::before, *::after { box-sizing: border-box; }

        .lf-page {
          min-height: 100vh; display: flex;
          font-family: 'Geist', sans-serif;
          background: ${pageBg};
          overflow: hidden;
          transition: background 0.3s;
        }

        /* ── LEFT ── */
        .lf-left {
          flex: 1; position: relative;
          display: none; overflow: hidden;
          background: ${dark ? "#05050d" : "#eeeefc"};
          transition: background 0.3s;
        }
        @media (min-width: 900px) { .lf-left { display: flex; } }

        .lf-grid {
          position: absolute; inset: 0; height: 200%;
          background-image:
            linear-gradient(${gridLine} 1px, transparent 1px),
            linear-gradient(90deg, ${gridLine} 1px, transparent 1px);
          background-size: 48px 48px;
          animation: lf-gridMove 20s linear infinite;
        }
        .lf-orb1 {
          position: absolute; width: 520px; height: 520px; border-radius: 50%;
          background: radial-gradient(circle at 40% 40%, ${accent}30, ${accent}08 60%, transparent 80%);
          top: -80px; left: -100px;
          animation: lf-orb1 8s ease-in-out infinite; filter: blur(1px);
        }
        .lf-orb2 {
          position: absolute; width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle at 60% 60%, ${accent}22, ${accent}06 60%, transparent 80%);
          bottom: 60px; right: -60px;
          animation: lf-orb2 11s ease-in-out infinite; filter: blur(2px);
        }
        .lf-left-content {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; justify-content: space-between;
          padding: 52px 56px; width: 100%;
        }

        /* Brand */
        .lf-brand { display: flex; align-items: center; gap: 12px; }
        .lf-brand-mark {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, ${accent}, #a78bfa);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 24px ${accent}66;
        }
        .lf-brand-name { font-size: 17px; font-weight: 600; color: ${leftText}; letter-spacing: -0.3px; }

        /* Headline */
        .lf-headline { margin-bottom: 80px; }
        .lf-headline h2 {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(38px, 3.5vw, 54px); font-weight: 400; font-style: italic;
          color: ${leftText}; line-height: 1.15; margin: 0 0 18px; letter-spacing: -0.5px;
        }
        .lf-headline h2 em {
          font-style: normal;
          background: linear-gradient(90deg, #a78bfa, ${accent}, #c4b8ff);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; animation: lf-shimmer 4s linear infinite;
        }
        .lf-headline p { font-size: 15px; color: ${leftSub}; margin: 0; line-height: 1.6; max-width: 340px; }

        /* Stats */
        .lf-stats { display: flex; gap: 40px; }
        .lf-stat-num  { font-family: 'Instrument Serif', serif; font-size: 32px; color: ${statNumC}; letter-spacing: -1px; }
        .lf-stat-label{ font-size: 12px; color: ${statLblC}; margin-top: 3px; letter-spacing: 0.02em; }

        /* ── VERTICAL DIVIDER ── */
        .lf-vdivider {
          width: 1px; flex-shrink: 0;
          background: linear-gradient(to bottom, transparent, ${dividerC} 30%, ${dividerC} 70%, transparent);
          transition: background 0.3s;
        }

        /* ── RIGHT ── */
        .lf-right {
          width: 100%; max-width: 500px;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 32px; position: relative;
          background: ${rightBg}; transition: background 0.3s;
        }
        @media (min-width: 900px) { .lf-right { width: 480px; } }

        .lf-form-wrap { width: 100%; max-width: 380px; animation: lf-fadeUp 0.45s ease both; }

        /* Form header */
        .lf-form-header { margin-bottom: 36px; }
        .lf-form-tag {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: ${accent}cc; margin-bottom: 14px;
        }
        .lf-form-tag::before { content: ''; display: block; width: 18px; height: 1px; background: ${accent}88; }
        .lf-form-title { font-family: 'Instrument Serif', serif; font-size: 34px; font-weight: 400; color: ${formTitle}; margin: 0 0 8px; letter-spacing: -0.5px; line-height: 1.1; }
        .lf-form-sub   { font-size: 14px; color: ${formSub}; margin: 0; }

        /* Fields */
        .lf-fields { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
        .lf-field  { display: flex; flex-direction: column; gap: 7px; }
        .lf-label  { font-size: 12px; font-weight: 500; color: ${labelC}; letter-spacing: 0.04em; }
        .lf-input-wrap { position: relative; }
        .lf-input {
          width: 100%; box-sizing: border-box;
          background: ${inputBg}; border: 1px solid ${inputBdr};
          border-radius: 11px; padding: 12px 14px;
          font-size: 14px; font-family: 'Geist', sans-serif;
          color: ${inputC}; outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .lf-input::placeholder { color: ${inputPh}; }
        .lf-input:focus {
          border-color: ${accent}70;
          background: ${accent}0a;
          box-shadow: 0 0 0 3px ${accent}18;
        }
        .lf-input-pr { padding-right: 42px; }
        .lf-eye {
          position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: ${eyeC}; display: flex; align-items: center;
          transition: color 0.15s; padding: 0;
        }
        .lf-eye:hover { color: ${dark ? "rgba(240,240,248,0.65)" : "rgba(15,15,26,0.6)"}; }

        .lf-forgot { text-align: right; margin-top: -4px; }
        .lf-forgot a { font-size: 12px; color: ${forgotC}; text-decoration: none; transition: color 0.15s; }
        .lf-forgot a:hover { color: ${accent}; }

        /* Submit */
        .lf-submit {
          width: 100%; padding: 13px; border-radius: 11px; border: none;
          background: linear-gradient(135deg, ${accent} 0%, #a78bfa 100%);
          color: white; font-size: 14px; font-weight: 600;
          font-family: 'Geist', sans-serif; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 20px ${accent}55, 0 1px 0 rgba(255,255,255,0.12) inset;
          transition: all 0.2s; position: relative; overflow: hidden;
        }
        .lf-submit::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent); opacity: 0; transition: opacity 0.2s; }
        .lf-submit:hover::after { opacity: 1; }
        .lf-submit:hover { transform: translateY(-1px); box-shadow: 0 8px 28px ${accent}66; }
        .lf-submit:active  { transform: translateY(0); }
        .lf-submit:disabled{ opacity: 0.65; cursor: not-allowed; transform: none; }

        /* Divider text */
        .lf-divider-row {
          display: flex; align-items: center; gap: 12px;
          margin: 22px 0; color: ${orTextC}; font-size: 12px;
        }
        .lf-divider-row::before, .lf-divider-row::after { content: ''; flex: 1; height: 1px; background: ${orLineC}; }

        /* Signup link */
        .lf-signup-link { text-align: center; font-size: 13.5px; color: ${linkBodyC}; }
        .lf-signup-link a { color: ${linkAC}; font-weight: 500; text-decoration: none; transition: color 0.15s; }
        .lf-signup-link a:hover { color: #c4b8ff; }

        /* Mobile logo */
        .lf-top-mobile {
          display: flex; align-items: center; justify-content: center;
          gap: 10px; margin-bottom: 36px;
        }
        @media (min-width: 900px) { .lf-top-mobile { display: none; } }
      `}</style>

      <div className="lf-page">

        {/* ── LEFT PANEL ── */}
        <div className="lf-left">
          <div className="lf-grid" />
          <div className="lf-orb1" />
          <div className="lf-orb2" />
          <div className="lf-left-content">
            <div className="lf-brand">
              <div className="lf-brand-mark">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <span className="lf-brand-name">InsightLake AI</span>
            </div>

            <div className="lf-headline">
              <h2>Turn your data into<br /><em>actionable insight</em></h2>
              <p>Connect datasets, build dashboards, and let AI surface the patterns that matter to your business.</p>
            </div>

            <div className="lf-stats">
              {[
                { num:180, suffix:"+", label:"Natural language queries processed" },
                { num:89,  suffix:"%", label:"Query-to-SQL accuracy" },
                { num:35,  suffix:"+", label:"Datasets analyzed" },
                { num:5,   suffix:"x", label:"Faster analytics" },
              ].map(s => (
                <div key={s.label}>
                  <div className="lf-stat-num">{s.num}</div>
                  <div className="lf-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lf-vdivider" />

        {/* ── RIGHT PANEL ── */}
        <div className="lf-right">
          <div className="lf-form-wrap">

            {/* Mobile logo */}
            <div className="lf-top-mobile">
              <div className="lf-brand-mark">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <span className="lf-brand-name">InsightLake AI</span>
            </div>

            <div className="lf-form-header">
              <div className="lf-form-tag">Secure Access</div>
              <h1 className="lf-form-title">Welcome back</h1>
              <p className="lf-form-sub">Sign in to continue to your workspace</p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="lf-fields">
                <div className="lf-field">
                  <label className="lf-label">Email address</label>
                  <div className="lf-input-wrap">
                    <input
                      className="lf-input"
                      type="email" required
                      placeholder="you@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="lf-field">
                  <label className="lf-label">Password</label>
                  <div className="lf-input-wrap">
                    <input
                      className="lf-input lf-input-pr"
                      type={showPw ? "text" : "password"} required
                      placeholder="••••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button type="button" className="lf-eye" onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <div className="lf-forgot">
                    <Link href="/forgot-password">Forgot password?</Link>
                  </div>
                </div>
              </div>

              <button type="submit" className="lf-submit" disabled={loading}>
                {loading
                  ? <><Loader2 size={15} style={{ animation: "lf-spin 1s linear infinite" }} /> Signing in…</>
                  : <>Sign in <ArrowRight size={15} /></>
                }
              </button>
            </form>

            <div className="lf-divider-row">or</div>

            <div className="lf-signup-link">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup">Create one free</Link>
            </div>

          </div>
        </div>

      </div>
    </>
  )
}
