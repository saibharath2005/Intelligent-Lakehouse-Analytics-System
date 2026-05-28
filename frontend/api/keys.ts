import { apiRequest } from "@/lib/apiClient"

export const setkey = (data: any) =>
    apiRequest('/project-key/set','POST', data);

export const getKey = (projectId: number, provider: string) =>
    apiRequest(`/project-key/${projectId}/${provider}`);

export const deleteKey = (projectId: number, provider: string) =>
    apiRequest(`/project-key/${projectId}/${provider}`, 'DELETE' );