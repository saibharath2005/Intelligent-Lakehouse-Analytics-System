import { apiRequest } from "@/lib/apiClient";

export const chat = {
    addMessage: (data: any) =>
      apiRequest('/chat/','POST',data)
  }

export const analyze = {
    post: (data: any) =>
      apiRequest('/analyze','POST',data)
  }

export const generateDashboard = (data: any) =>
      apiRequest('/dashboard/ai/', 'POST', data)