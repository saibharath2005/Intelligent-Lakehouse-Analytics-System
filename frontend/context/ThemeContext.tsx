"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

export type ThemeMode = "dark" | "light" | "system"
export type EffectiveTheme = "dark" | "light"
export type Density = "compact" | "default" | "comfortable"

interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
  effective: EffectiveTheme
  accentColor: string
  setAccentColor: (c: string) => void
  density: Density
  setDensity: (d: Density) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  effective: "dark",
  accentColor: "#7c6bff",
  setAccentColor: () => {},
  density: "default",
  setDensity: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system")
  const [effective, setEffective] = useState<EffectiveTheme>("dark")
  const [accentColor, setAccentColorState] = useState("#7c6bff")
  const [density, setDensityState] = useState<Density>("default")

  const resolveEffective = (t: ThemeMode): EffectiveTheme => {
    if (t !== "system") return t
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark" : "light"
  }

  const setTheme = (t: ThemeMode) => {
    setThemeState(t)
    localStorage.setItem("app-theme", t)
  }

  const setAccentColor = (c: string) => {
    setAccentColorState(c)
    localStorage.setItem("app-accent", c)
    document.documentElement.style.setProperty("--accent", c)
  }

  const setDensity = (d: Density) => {
    setDensityState(d)
    localStorage.setItem("app-density", d)
    document.documentElement.setAttribute("data-density", d)
  }

  // Load persisted preferences
  useEffect(() => {
    const savedTheme = (localStorage.getItem("app-theme") as ThemeMode) || "system"
    const savedAccent = localStorage.getItem("app-accent") || "#7c6bff"
    const savedDensity = (localStorage.getItem("app-density") as Density) || "default"

    setThemeState(savedTheme)
    setAccentColorState(savedAccent)
    setDensityState(savedDensity)
    setEffective(resolveEffective(savedTheme))

    document.documentElement.style.setProperty("--accent", savedAccent)
    document.documentElement.setAttribute("data-density", savedDensity)
  }, [])

  // React to theme changes + system media query
  useEffect(() => {
    const update = () => {
      const eff = resolveEffective(theme)
      setEffective(eff)
      document.documentElement.setAttribute("data-theme", eff)
    }
    update()
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effective, accentColor, setAccentColor, density, setDensity }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
