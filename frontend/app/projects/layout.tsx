import Sidebar from "@/components/layout/Sidebar"
import { ThemeProvider } from "@/context/ThemeContext"
import ThemeWrapper from "@/components/layout/ThemeWrapper"

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ThemeWrapper>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0, padding: "32px 28px", overflowX: "hidden" }}>
          {children}
        </main>
      </ThemeWrapper>
    </ThemeProvider>
  )
}
