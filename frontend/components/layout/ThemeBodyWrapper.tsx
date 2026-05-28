"use client"

import { useTheme } from "@/context/ThemeContext"
import { ReactNode, useEffect } from "react"

export default function ThemeBodyWrapper({ children }: { children: ReactNode }) {
  const { effective } = useTheme()
  const dark = effective === "dark"

  // Apply theme to <html> so Tailwind dark: classes work too
  useEffect(() => {
    const html = document.documentElement
    if (dark) {
      html.classList.add("dark")
      html.classList.remove("light")
    } else {
      html.classList.add("light")
      html.classList.remove("dark")
    }
    html.setAttribute("data-theme", effective)
  }, [dark, effective])

  return (
    <div
      style={{
        minHeight: "100vh",
        background: dark ? "#080810" : "#f8f8fc",
        color:      dark ? "#e8e8f0" : "#0f0f1a",
        transition: "background 0.3s ease, color 0.3s ease",
      }}
    >
      {children}
    </div>
  )
}
