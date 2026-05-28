"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { getProjectDetails, type ProjectDetails } from "@/api/project"

interface ProjectContextValue {
  project:  ProjectDetails | null
  loading:  boolean
  error:    string | null
  refetch:  () => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue>({
  project: null, loading: true, error: null, refetch: async () => {},
})

export function ProjectProvider({ projectId, children }: { projectId: number; children: ReactNode }) {
  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const refetch = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getProjectDetails(projectId)
      setProject(data)
    } catch (err: any) {
      setError(err.message || "Failed to load project")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refetch() }, [projectId])

  return (
    <ProjectContext.Provider value={{ project, loading, error, refetch }}>
      {children}
    </ProjectContext.Provider>
  )
}

export const useProject = () => useContext(ProjectContext)
