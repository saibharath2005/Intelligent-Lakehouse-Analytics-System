"use client"

import { ProjectProvider } from "@/components/project/ProjectContext"
import { ReactNode } from "react"

export default function ProjectLayoutClient({ projectId, children }: { projectId: number; children: ReactNode }) {
  return (
    <ProjectProvider projectId={projectId}>
      {children}
    </ProjectProvider>
  )
}
