import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

/**
 * Base API client for OxygenClaw backend
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: add auth token if present
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('oxygenclaw:auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => Promise.reject(error)
);

// Response interceptor: handle common errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ success: false; error: string }>) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login if needed
      localStorage.removeItem('oxygenclaw:auth_token');
      // In a future multi-user version, redirect to login page
    }

    // Extract backend error message
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      'An unknown error occurred';

    return Promise.reject(new Error(errorMessage));
  }
);

/**
 * Helper to extract data from ApiResponse wrapper
 */
export function unwrapResponse<T>(response: { data: { success: boolean; data?: T; error?: string } }): T {
  if (!response.data.success) {
    throw new Error(response.data.error || 'Request failed');
  }
  if (response.data.data === undefined) {
    throw new Error('Response data is undefined');
  }
  return response.data.data;
}
