const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

export async function apiRequest(
  path: string,
  method: string = "GET",
  body?: any
) {
  const token = localStorage.getItem("token")

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` })
    },
    body: body ? JSON.stringify(body) : undefined
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || 'API request failed');
  }

  return { status: res.ok, status_code: res.status, ...await res.json() }
}