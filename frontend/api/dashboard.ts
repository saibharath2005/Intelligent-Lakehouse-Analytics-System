import { apiRequest } from "@/lib/apiClient"

export const createDashboard = (data: any) =>
      apiRequest('/dashboard/', 'POST',data);

export const getDashboards = (id: number) => apiRequest(`/dashboard/${id}`);

export const renameDashboard = (id: number, data: { name: string }) => apiRequest(`/dashboard/${id}`,
    'PATCH',
    data,
);

export const deleteDashboard = (id: number) =>
      apiRequest(`/dashboard/${id}`,'DELETE')

export const addWidget = (pageId: number, data: any) =>
      apiRequest(`/dashboard/page/${pageId}/widget`,
         'POST',
         data)
