"use client"

import { useState } from "react"
import Link from "next/link"
import { signup } from "@/api/user"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/ToastProvider"
import { useTheme } from "@/context/ThemeContext"
import { Eye, EyeOff, ArrowRight, Loader2, Check } from "lucide-react"

export default function SignupForm() {
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const toast  = useToast()
  const router = useRouter()

  const { effective, accentColor } = useTheme()
  const dark = effective === "dark"
  const accent = accentColor

  // ── All colours derived from theme ──────────────────────
  const pageBg   = dark ? "#080810"                : "#f4f4fb"
  const rightBg  = dark ? "#0d0d16"                : "#ffffff"
  const dividerC = dark ? `${accent}22`            : `${accent}18`
  const leftBg   = dark ? "#05050d"                : "#eeeefc"

  const leftText = dark ? "#f0f0f8"                : "#0f0f1a"
  const leftSub  = dark ? "rgba(240,240,248,0.42)" : "rgba(15,15,26,0.5)"
  const gridLine = dark ? `${accent}12`            : `${accent}0e`

  const formTitle = dark ? "#f0f0f8"               : "#0f0f1a"
  const formSub   = dark ? "rgba(240,240,248,0.4)" : "rgba(15,15,26,0.45)"
  const labelC    = dark ? "rgba(240,240,248,0.52)" : "rgba(15,15,26,0.55)"
  const inputBg   = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"
  const inputBdr  = dark ? "rgba(255,255,255,0.1)"  : "rgba(0,0,0,0.12)"
  const inputC    = dark ? "#e8e8f0"               : "#0f0f1a"
  const inputPh   = dark ? "rgba(240,240,248,0.22)" : "rgba(15,15,26,0.28)"
  const eyeC      = dark ? "rgba(240,240,248,0.3)"  : "rgba(15,15,26,0.3)"
  const eyeHov    = dark ? "rgba(240,240,248,0.65)" : "rgba(15,15,26,0.6)"
  const orTextC   = dark ? "rgba(240,240,248,0.22)" : "rgba(15,15,26,0.3)"
  const orLineC   = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)"
  const linkBodyC = dark ? "rgba(240,240,248,0.4)"  : "rgba(15,15,26,0.5)"
  const linkAC    = dark ? "#a78bfa"               : accent
  const termsC    = dark ? "rgba(240,240,248,0.28)" : "rgba(15,15,26,0.38)"
  const termsLC   = dark ? `${accent}bb`            : `${accent}dd`
  const featC     = dark ? "rgba(240,240,248,0.6)"  : "rgba(15,15,26,0.62)"
  const proofCardBg  = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"
  const proofCardBdr = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
  const proofTextC   = dark ? "rgba(240,240,248,0.4)"  : "rgba(15,15,26,0.45)"
  const proofBoldC   = dark ? "rgba(240,240,248,0.78)" : "rgba(15,15,26,0.78)"
  const avatarBdr    = dark ? "#080810"            : "#f4f4fb"
  const statNumC     = dark ? "#f0f0f8"            : "#0f0f1a"

  // Password strength
  const pwStrength = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8)          s++
    if (/[A-Z]/.test(password))        s++
    if (/[0-9]/.test(password))        s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  })()
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][pwStrength]
  const strengthColor = ["", "#f87171", "#f59e0b", "#34d399", "#a78bfa"][pwStrength]

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response: any = await signup({ email, password, username })
      if (response.status) toast.success("Account created! Please sign in.")
      router.push("/auth/login")
    } catch (err: any) {
      toast.error("Signup failed: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const features = [
    "AI-powered dashboard generation",
    "Connect unlimited data sources",
    "Real-time analytics & alerts",
    "Collaborative workspaces",
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap');

        @keyframes sf-fadeUp   { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sf-grid     { from{transform:translateY(0)} to{transform:translateY(-50%)} }
        @keyframes sf-orb1     { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-25px,20px) scale(1.06)} }
        @keyframes sf-orb2     { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,-18px) scale(0.95)} }
        @keyframes sf-spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes sf-shimmer  { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes sf-featIn   { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes sf-checkPop { 0%{transform:scale(0)} 70%{transform:scale(1.2)} 100%{transform:scale(1)} }

        *, *::before, *::after { box-sizing: border-box; }

        .sf-page {
          min-height: 100vh; display: flex;
          font-family: 'Geist', sans-serif;
          background: ${pageBg}; overflow: hidden;
          transition: background 0.3s;
        }

        /* ── LEFT ── */
        .sf-left {
          flex: 1; position: relative;
          display: none; overflow: hidden;
          background: ${leftBg}; transition: background 0.3s;
        }
        @media (min-width: 900px) { .sf-left { display: flex; } }

        .sf-grid {
          position: absolute; inset: 0; height: 200%;
          background-image:
            linear-gradient(${gridLine} 1px, transparent 1px),
            linear-gradient(90deg, ${gridLine} 1px, transparent 1px);
          background-size: 48px 48px;
          animation: sf-grid 24s linear infinite;
        }
        .sf-orb1 {
          position: absolute; width: 480px; height: 480px; border-radius: 50%;
          background: radial-gradient(circle at 45% 45%, ${accent}28, transparent 70%);
          top: -60px; right: -100px;
          animation: sf-orb1 10s ease-in-out infinite; filter: blur(2px);
        }
        .sf-orb2 {
          position: absolute; width: 360px; height: 360px; border-radius: 50%;
          background: radial-gradient(circle at 55% 55%, ${accent}1e, transparent 70%);
          bottom: 40px; left: -40px;
          animation: sf-orb2 13s ease-in-out infinite; filter: blur(1px);
        }

        .sf-left-content {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; justify-content: space-between;
          padding: 52px 56px; width: 100%;
        }

        .sf-brand { display: flex; align-items: center; gap: 12px; }
        .sf-brand-mark {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, ${accent}, #a78bfa);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 24px ${accent}66;
        }
        .sf-brand-name { font-size: 17px; font-weight: 600; color: ${leftText}; letter-spacing: -0.3px; }

        .sf-pitch { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px 0; }
        .sf-pitch h2 {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(36px, 3.2vw, 50px); font-weight: 400; color: ${leftText};
          line-height: 1.18; margin: 0 0 20px; letter-spacing: -0.4px;
        }
        .sf-pitch h2 em {
          font-style: italic;
          background: linear-gradient(90deg, #c4b8ff, ${accent}, #a78bfa);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; animation: sf-shimmer 4s linear infinite;
        }
        .sf-pitch p { font-size: 14.5px; color: ${leftSub}; margin: 0 0 36px; line-height: 1.65; max-width: 320px; }

        .sf-features { display: flex; flex-direction: column; gap: 13px; }
        .sf-feature {
          display: flex; align-items: center; gap: 12px;
          animation: sf-featIn 0.4s ease both;
        }
        .sf-feature:nth-child(1){animation-delay:0.1s}
        .sf-feature:nth-child(2){animation-delay:0.2s}
        .sf-feature:nth-child(3){animation-delay:0.3s}
        .sf-feature:nth-child(4){animation-delay:0.4s}
        .sf-feature-check {
          width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
          background: ${accent}22; border: 1px solid ${accent}44;
          display: flex; align-items: center; justify-content: center;
          animation: sf-checkPop 0.4s ease both;
        }
        .sf-feature-text { font-size: 13.5px; color: ${featC}; }

        .sf-social-proof {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 20px;
          background: ${proofCardBg}; border: 1px solid ${proofCardBdr};
          border-radius: 12px; transition: background 0.3s, border-color 0.3s;
        }
        .sf-avatars { display: flex; }
        .sf-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          border: 2px solid ${avatarBdr}; margin-left: -8px;
          font-size: 11px; font-weight: 600; color: white;
          display: flex; align-items: center; justify-content: center;
          transition: border-color 0.3s;
        }
        .sf-avatars .sf-avatar:first-child { margin-left: 0; }
        .sf-proof-text { font-size: 12px; color: ${proofTextC}; line-height: 1.5; }
        .sf-proof-text strong { color: ${proofBoldC}; font-weight: 500; }

        /* ── VERTICAL DIVIDER ── */
        .sf-vdivider {
          width: 1px; flex-shrink: 0;
          background: linear-gradient(to bottom, transparent, ${dividerC} 30%, ${dividerC} 70%, transparent);
          transition: background 0.3s;
        }

        /* ── RIGHT ── */
        .sf-right {
          width: 100%; max-width: 500px;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 32px; position: relative;
          background: ${rightBg}; transition: background 0.3s;
        }
        @media (min-width: 900px) { .sf-right { width: 480px; } }

        .sf-form-wrap { width: 100%; max-width: 380px; animation: sf-fadeUp 0.45s ease both; }

        .sf-form-header { margin-bottom: 32px; }
        .sf-form-tag {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: ${accent}cc; margin-bottom: 14px;
        }
        .sf-form-tag::before { content: ''; display: block; width: 18px; height: 1px; background: ${accent}88; }
        .sf-form-title { font-family: 'Instrument Serif', serif; font-size: 34px; font-weight: 400; color: ${formTitle}; margin: 0 0 8px; letter-spacing: -0.5px; line-height: 1.1; }
        .sf-form-sub   { font-size: 14px; color: ${formSub}; margin: 0; }

        .sf-fields { display: flex; flex-direction: column; gap: 15px; margin-bottom: 16px; }
        .sf-field  { display: flex; flex-direction: column; gap: 7px; }
        .sf-label  { font-size: 12px; font-weight: 500; color: ${labelC}; letter-spacing: 0.04em; }

        .sf-input-wrap { position: relative; }
        .sf-input {
          width: 100%; box-sizing: border-box;
          background: ${inputBg}; border: 1px solid ${inputBdr};
          border-radius: 11px; padding: 12px 14px;
          font-size: 14px; font-family: 'Geist', sans-serif;
          color: ${inputC}; outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .sf-input::placeholder { color: ${inputPh}; }
        .sf-input:focus {
          border-color: ${accent}70; background: ${accent}0a;
          box-shadow: 0 0 0 3px ${accent}18;
        }
        .sf-input-pr { padding-right: 42px; }

        .sf-eye {
          position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: ${eyeC}; display: flex; align-items: center;
          transition: color 0.15s; padding: 0;
        }
        .sf-eye:hover { color: ${eyeHov}; }

        /* Strength bar */
        .sf-pw-strength { display: flex; flex-direction: column; gap: 5px; margin-top: 6px; }
        .sf-pw-bars     { display: flex; gap: 4px; }
        .sf-pw-bar      { height: 3px; flex: 1; border-radius: 2px; background: ${dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}; transition: background 0.3s; }
        .sf-pw-hint     { font-size: 11px; }

        /* Terms */
        .sf-terms {
          font-size: 12px; color: ${termsC};
          text-align: center; margin-bottom: 16px; line-height: 1.55;
        }
        .sf-terms a { color: ${termsLC}; text-decoration: none; transition: color 0.15s; }
        .sf-terms a:hover { color: ${accent}; }

        /* Submit */
        .sf-submit {
          width: 100%; padding: 13px; border-radius: 11px; border: none;
          background: linear-gradient(135deg, ${accent} 0%, #a78bfa 100%);
          color: white; font-size: 14px; font-weight: 600;
          font-family: 'Geist', sans-serif; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 20px ${accent}55, 0 1px 0 rgba(255,255,255,0.12) inset;
          transition: all 0.2s; position: relative; overflow: hidden;
        }
        .sf-submit::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent); opacity: 0; transition: opacity 0.2s; }
        .sf-submit:hover::after { opacity: 1; }
        .sf-submit:hover   { transform: translateY(-1px); box-shadow: 0 8px 28px ${accent}66; }
        .sf-submit:active  { transform: translateY(0); }
        .sf-submit:disabled{ opacity: 0.65; cursor: not-allowed; transform: none; }

        .sf-login-link {
          text-align: center; font-size: 13.5px;
          color: ${linkBodyC}; margin-top: 20px;
        }
        .sf-login-link a { color: ${linkAC}; font-weight: 500; text-decoration: none; transition: color 0.15s; }
        .sf-login-link a:hover { color: #c4b8ff; }

        .sf-top-mobile {
          display: flex; align-items: center; justify-content: center;
          gap: 10px; margin-bottom: 36px;
        }
        @media (min-width: 900px) { .sf-top-mobile { display: none; } }
      `}</style>

      <div className="sf-page">

        {/* ── LEFT PANEL ── */}
        <div className="sf-left">
          <div className="sf-grid" />
          <div className="sf-orb1" />
          <div className="sf-orb2" />

          <div className="sf-left-content">
            <div className="sf-brand">
              <div className="sf-brand-mark">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <span className="sf-brand-name">InsightLake AI</span>
            </div>

            <div className="sf-pitch">
              <h2>Your data,<br /><em>finally speaking</em><br />your language</h2>
              <p>Join thousands of teams who let AI do the heavy lifting — from raw data to boardroom-ready insights.</p>

              <div className="sf-features">
                {features.map((f, i) => (
                  <div key={f} className="sf-feature" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
                    <div className="sf-feature-check">
                      <Check size={11} color={accent} strokeWidth={2.5} />
                    </div>
                    <span className="sf-feature-text">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sf-social-proof">
              <div className="sf-avatars">
                {[["#7c6bff","A"],["#10b981","S"],["#f59e0b","R"],["#ec4899","M"]].map(([bg,l]) => (
                  <div key={l} className="sf-avatar" style={{ background: bg as string }}>{l}</div>
                ))}
              </div>
              <div className="sf-proof-text">
                <strong>2,400+ analysts</strong> trust InsightLake<br />for their daily data workflows
              </div>
            </div>
          </div>
        </div>

        <div className="sf-vdivider" />

        {/* ── RIGHT PANEL ── */}
        <div className="sf-right">
          <div className="sf-form-wrap">

            {/* Mobile logo */}
            <div className="sf-top-mobile">
              <div className="sf-brand-mark">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <span className="sf-brand-name">InsightLake AI</span>
            </div>

            <div className="sf-form-header">
              <div className="sf-form-tag">Free forever</div>
              <h1 className="sf-form-title">Create account</h1>
              <p className="sf-form-sub">Start analysing in under 2 minutes</p>
            </div>

            <form onSubmit={handleSignup}>
              <div className="sf-fields">

                <div className="sf-field">
                  <label className="sf-label">Username</label>
                  <div className="sf-input-wrap">
                    <input
                      className="sf-input" type="text" required
                      placeholder="Jane Smith"
                      value={username} onChange={e => setUsername(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="sf-field">
                  <label className="sf-label">Work email</label>
                  <div className="sf-input-wrap">
                    <input
                      className="sf-input" type="email" required
                      placeholder="jane@company.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="sf-field">
                  <label className="sf-label">Password</label>
                  <div className="sf-input-wrap">
                    <input
                      className="sf-input sf-input-pr"
                      type={showPw ? "text" : "password"} required
                      placeholder="8+ characters"
                      value={password} onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button type="button" className="sf-eye" onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {password.length > 0 && (
                    <div className="sf-pw-strength">
                      <div className="sf-pw-bars">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="sf-pw-bar"
                            style={{ background: i <= pwStrength ? strengthColor : undefined }}
                          />
                        ))}
                      </div>
                      <span className="sf-pw-hint" style={{ color: strengthColor }}>
                        {strengthLabel} password
                      </span>
                    </div>
                  )}
                </div>

              </div>

              <div className="sf-terms">
                By creating an account you agree to our{" "}
                <a href="#">Terms of Service</a> and{" "}
                <a href="#">Privacy Policy</a>
              </div>

              <button type="submit" className="sf-submit" disabled={loading}>
                {loading
                  ? <><Loader2 size={15} style={{ animation: "sf-spin 1s linear infinite" }} /> Creating account…</>
                  : <>Create free account <ArrowRight size={15} /></>
                }
              </button>
            </form>

            <div className="sf-login-link">
              Already have an account?{" "}
              <Link href="/auth/login">Sign in</Link>
            </div>

          </div>
        </div>

      </div>
    </>
  )
}
