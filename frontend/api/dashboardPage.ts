import { apiRequest } from "@/lib/apiClient";

export const addPage = (dashboardId: number, data: any) =>
      apiRequest(`/dashboard/${dashboardId}/page`,
         'POST',
         JSON.stringify(data)
        )

    /** Rename or reorder a page */
export const updatePage = (pageId: number, data: { name?: string; page_order?: number }) =>
      apiRequest(`/dashboard/page/${pageId}`,
         'PATCH',
         data
        )

export const deletePage = (pageId: number) =>
      apiRequest(`/dashboard/page/${pageId}`, 'DELETE')