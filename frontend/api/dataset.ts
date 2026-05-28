import { apiRequest } from "@/lib/apiClient"

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1"

export async function uploadDataset(projectId: number, file: File) {
  const token = localStorage.getItem("token")

  const form = new FormData()
  form.append("project_id", String(projectId))
  form.append("file", file)
 
  const res = await fetch(`${API_URL}/dataset/upload`, {
    method: "POST",
    headers: {
      // ✅ Do NOT set Content-Type — browser sets it automatically with the correct
      //    multipart boundary when body is FormData. Setting it manually breaks the boundary.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  })

  if (!res.ok) {
    let detail = `Upload failed (${res.status})`
    try {
      const err = await res.json()
      detail = err.detail || err.message || JSON.stringify(err)
    } catch {}
    throw new Error(detail)
  }

  return res.json()
}

export async function deleteDataset(datasetId: number) {
  const token = localStorage.getItem("token")

  const res = await fetch(`${API_URL}/dataset/${datasetId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) {
    let detail = `Delete failed (${res.status})`
    try {
      const err = await res.json()
      detail = err.detail || err.message || JSON.stringify(err)
    } catch {}
    throw new Error(detail)
  }

  // Some DELETE endpoints return 204 No Content
  if (res.status === 204) return { success: true }
  return res.json().catch(() => ({ success: true }))
}
export async function previewDataset(id: number, limit = 50) {
  try {
    const res = await apiRequest(`/dataset/${id}/preview?limit=${limit}`)
    return res
  } catch (err: any) {
    throw new Error(err.message || "Failed to fetch preview")
  }
}