import Sidebar from "@/components/layout/Sidebar"
import { ThemeProvider } from "@/context/ThemeContext"
import ThemeWrapper from "@/components/layout/ThemeWrapper"
import ProjectLayoutClient from "./ProjectLayoutClient"

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <ThemeProvider>
      <ThemeWrapper>
        <Sidebar />

        <main style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
          <ProjectLayoutClient projectId={Number(id)}>
            {children}
          </ProjectLayoutClient>
        </main>
      </ThemeWrapper>
    </ThemeProvider>
  )
}