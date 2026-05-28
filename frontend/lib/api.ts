const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || 'API request failed');
  }

  return { status: response.ok, status_code: response.status, ...await response.json() };
}

export const api = {
  
  auth: {
    signup: (data: any) =>
      request('/api/v1/auth/signup', { method: 'POST', body: JSON.stringify(data) }),

    login: (data: any) =>
      request<any>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(data) }),

    /** Delete own account and all associated data */
    deleteAccount: () =>
      request<any>('/api/v1/auth/me', { method: 'DELETE' }),
  },

  
  project: {
    create: (data: any) =>
      request('/api/v1/project/', { method: 'POST', body: JSON.stringify(data) }),

    /** List projects owned by the current user with summary counts */
    listOwned: () =>
      request<any>('/api/v1/project/owned'),

    /** List projects created by the current user, each with nested dashboards */
    listWithDashboards: () =>
      request<any>('/api/v1/project/my/projects-with-dashboards'),

    delete: (id: number) =>
      request(`/api/v1/project/${id}`, { method: 'DELETE' }),

    /** Change the role of a project member (owner only) */
    changeMemberRole: (projectId: number, data: { target_user_id: number; new_role: string }) =>
      request<any>(`/api/v1/project/${projectId}/members/role`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    /** Invite a user to a project (owner only) */
    inviteMember: (projectId: number, data: { user_id: number; role?: string }) =>
      request<any>(`/api/v1/project/${projectId}/members/invite`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    /** Accept a pending project invitation (called by the invited user) */
    acceptInvitation: (projectId: number) =>
      request<any>(`/api/v1/project/${projectId}/members/accept`, { method: 'POST' }),
  },

  
  chat: {
    addMessage: (data: any) =>
      request('/api/v1/chat/', { method: 'POST', body: JSON.stringify(data) }),
  },

    dataset: {
    upload: (projectId: number, file: File) => {
      const formData = new FormData();
      formData.append('project_id', projectId.toString());
      formData.append('file', file);
      return request('/api/v1/dataset/upload', { method: 'POST', body: formData });
    },

    /** Delete a dataset and its files from disk and the data lake */
    delete: (datasetId: number) =>
      request<any>(`/api/v1/dataset/${datasetId}`, { method: 'DELETE' }),
  },

 
  analyze: {
    post: (data: any) =>
      request('/api/v1/analyze', { method: 'POST', body: JSON.stringify(data) }),
  },

 
  keys: {
    set: (data: any) =>
      request('/api/v1/project-key/set', { method: 'POST', body: JSON.stringify(data) }),

    get: (projectId: number, provider: string) =>
      request(`/api/v1/project-key/${projectId}/${provider}`),

    delete: (projectId: number, provider: string) =>
      request(`/api/v1/project-key/${projectId}/${provider}`, { method: 'DELETE' }),
  },

   dashboard: {
    create: (data: any) =>
      request('/api/v1/dashboard/', { method: 'POST', body: JSON.stringify(data) }),

    get: (id: number) =>
      request<any>(`/api/v1/dashboard/${id}`),

    /** Rename a dashboard */
    update: (id: number, data: { name: string }) =>
      request<any>(`/api/v1/dashboard/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: number) =>
      request<any>(`/api/v1/dashboard/${id}`, { method: 'DELETE' }),

    /** AI-powered dashboard generation */
    generate: (data: any) =>
      request('/api/v1/dashboard/ai/', { method: 'POST', body: JSON.stringify(data) }),

      addPage: (dashboardId: number, data: any) =>
      request(`/api/v1/dashboard/${dashboardId}/page`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    /** Rename or reorder a page */
    updatePage: (pageId: number, data: { name?: string; page_order?: number }) =>
      request<any>(`/api/v1/dashboard/page/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deletePage: (pageId: number) =>
      request<any>(`/api/v1/dashboard/page/${pageId}`, { method: 'DELETE' }),

        addWidget: (pageId: number, data: any) =>
      request(`/api/v1/dashboard/page/${pageId}/widget`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateWidget: (
      widgetId: number,
      data: {
        dataset_name?: string;
        query?: string;
        chart_type?: string;
        x_axis?: string;
        y_axis?: string;
        pos_x?: number;
        pos_y?: number;
        width?: number;
        height?: number;
      }
    ) =>
      request<any>(`/api/v1/dashboard/widget/${widgetId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    /**
     * Bulk-update widget positions/sizes for a page in one request.
     * Ideal for saving a drag-and-drop grid layout.
     */
    updatePageLayout: (
      pageId: number,
      widgets: { widget_id: number; pos_x: number; pos_y: number; width: number; height: number }[]
    ) =>
      request<any>(`/api/v1/dashboard/page/${pageId}/layout`, {
        method: 'PATCH',
        body: JSON.stringify({ widgets }),
      }),

    deleteWidget: (widgetId: number) =>
      request<any>(`/api/v1/dashboard/widget/${widgetId}`, { method: 'DELETE' }),
  },
};