"use client"

import { useTheme } from "@/context/ThemeContext"
import { ReactNode } from "react"

export default function ThemeWrapper({ children }: { children: ReactNode }) {
  const { effective } = useTheme()
  const dark = effective === "dark"

  return (
    <div
      data-theme={effective}
      style={{
        display: "flex",
        minHeight: "100vh",
        background: dark ? "#0d0d14" : "#f0f0f8",
        color: dark ? "#e8e8f0" : "#0f0f1a",
        transition: "background 0.3s ease, color 0.3s ease",
      }}
    >
      {children}
    </div>
  )
}
