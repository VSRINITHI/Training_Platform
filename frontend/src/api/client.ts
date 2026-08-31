import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { supabase } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request Interceptor: Attach Supabase JWT Bearer token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.error('Error attaching auth token to request', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Normalized error extraction
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string | { msg: string; loc: string[] }[] }>) => {
    let message = 'An unexpected error occurred. Please try again.';

    if (error.response?.data) {
      const { detail } = error.response.data;
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        // FastAPI / Pydantic validation error array
        message = detail.map((d) => d.msg).join(', ');
      }
    } else if (error.message) {
      message = error.message;
    }

    // Attach humanized message
    const customError = new Error(message) as Error & {
      status?: number;
      originalError?: AxiosError;
    };
    customError.status = error.response?.status;
    customError.originalError = error;

    return Promise.reject(customError);
  }
);
