import Sidebar from "@/components/layout/Sidebar"
import { ThemeProvider } from "@/context/ThemeContext"
import ThemeWrapper from "@/components/layout/ThemeWrapper"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ThemeWrapper>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </ThemeWrapper>
    </ThemeProvider>
  )
}
