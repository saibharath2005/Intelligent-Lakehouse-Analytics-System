import { apiRequest } from "@/lib/apiClient"
export const updateWidget = (
      widgetId: number,
      data: {
        dataset_name?: string;
        query?: string;
        chart_type?: string;
        x_axis?: string|null;
        y_axis?: string|null;
        pos_x?: number;
        pos_y?: number;
        width?: number;
        height?: number;
      }
    ) =>{
      console.log(data);
      apiRequest(`/dashboard/widget/${widgetId}`,
         'PATCH',
         data,
      )
    }

export const updatePageLayout = (
      pageId: number,
      widgets: { widget_id: number; pos_x: number; pos_y: number; width: number; height: number }[]
    ) =>
      apiRequest(`/dashboard/page/${pageId}/layout`,
         'PATCH',
         {widgets},
      )

export const deleteWidget = (widgetId: number) =>
      apiRequest(`/dashboard/widget/${widgetId}`,'DELETE')

export const analyze = {
    post: (data: any) =>
      apiRequest('/analyze/query','POST',data)
  }