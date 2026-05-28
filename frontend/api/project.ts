import { apiRequest } from "@/lib/apiClient"

// ─── DATASET TYPE ─────────────────────────────────────────
export interface Dataset {
  id: number
  name: string
  status: "processing" | "ready" | "error"
  uploaded_by: number
  created_at: string
}

// ─── MEMBER TYPE ──────────────────────────────────────────
export interface ProjectMember {
  user_id: number
  username?: string
  email?: string
  role: "viewer" | "editor" | "owner"
  joined_at?: string
  status?: "active" | "pending"
}
export interface Dashboard {
  id: number
  name: string
  created_by: string
  created_at: string
  page_count:string
}

export interface ApiKey {
  provider:       string
  masked_key:     string
  model_name?:    string
  temperature?:   number
  is_default?:    boolean
  is_configured?: boolean
}

export interface ProjectDetails {
  id:          number
  name:        string
  created_by:  number
  created_at:  string
  your_role:   string
  members:     ProjectMember[]
  datasets:    Dataset[]
  dashboards:  Dashboard[]
  api_keys:    ApiKey[]
}

// ─── PROJECTS ─────────────────────────────────────────────
export const getProjects = () =>
  apiRequest("/project/owned")

export const getProjectDetails = (projectId:number): Promise<ProjectDetails>=>
  apiRequest(`/project/${projectId}`) as Promise<ProjectDetails>

export const createProject = (name: string) =>
  apiRequest("/project/", "POST", { name })

export const deleteProject = (id: number) =>
  apiRequest(`/project/${id}`, "DELETE")


export const getDatasets = (project_id: number): Promise<Dataset[]> =>
  apiRequest(`/project/datasets/${project_id}`).then((res) => { 
    const { status, status_code, ...rest } = res as any
    const values = Object.values(rest)
    
    return values.filter((v): v is Dataset =>
      typeof v === "object" && v !== null && "id" in (v as any)
    )
  })

export const getMembers = (projectId: number): Promise<ProjectMember[]> =>
  apiRequest(`/project/${projectId}`).then((res) => {
    const { status, status_code, ...rest } = res as any
    const values = Object.values(rest.members)
    return values.filter((v): v is ProjectMember =>
      typeof v === "object" && v !== null && "user_id" in (v as any)
    )
  })

export const getDashboards = (projectId: number): Promise<Dashboard[]> =>
  apiRequest(`/project/${projectId}`).then((res) => {
    const { status, status_code, ...rest } = res as any
    const values = Object.values(rest.dashboards)
    return values.filter((v): v is Dashboard =>
      typeof v === "object" && v !== null && "id" in (v as any)
    )
  })

export const inviteMember = (
  projectId: number,
  data: { user_id?: number; email?: string; role?: string }
) => {
  // alert(JSON.stringify(data));
  return apiRequest(`/project/${projectId}/members/invite`, "POST", data)
}

export const updateMemberRole = (
  projectId: number,
  userId: number,
  role: string
) => apiRequest(`/project/${projectId}/members/${userId}/role`, "PATCH", { role })

export const removeMember = (projectId: number, userId: number) =>
  apiRequest(`/project/${projectId}/members/${userId}`, "DELETE")

export const acceptInvitation = (projectId: number) =>
  apiRequest(`/project/${projectId}/members/accept`, "POST")
