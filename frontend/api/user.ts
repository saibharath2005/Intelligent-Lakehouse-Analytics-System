import { apiRequest } from "@/lib/apiClient";

export const login = (data:any) => apiRequest("/auth/login","POST",data);
export const signup = (data:any) => apiRequest("/auth/signup","POST",data);
export const getMe = () => apiRequest("/auth/me");
export const deleteAccount =() => apiRequest('/api/v1/auth/me','DELETE');