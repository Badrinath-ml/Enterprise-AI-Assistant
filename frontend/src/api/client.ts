import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { storage } from '../utils/storage';
import { ApiError } from '../types/api';

const rawBaseURL = import.meta.env.VITE_API_URL || '';
export const API_BASE_URL = rawBaseURL.trim().replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Attach Authorization header if token exists
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = storage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // The shared Axios default is JSON. Remove it for FormData so the browser
    // supplies multipart/form-data with the correct boundary.
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      config.headers.delete('Content-Type');
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth failures and normalize error format
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    if (error.response) {
      // 401 Unauthorized: token expired or invalid
      if (error.response.status === 401) {
        storage.clear();
        // Dispatch custom event so AuthContext can clean up state without circular imports
        window.dispatchEvent(new CustomEvent('eka:unauthorized'));
      }

      let data: ApiError | undefined = error.response.data as ApiError | undefined;
      // Axios returns Blob bodies for document preview/download requests, including
      // JSON error responses. Decode those bodies so the UI can show the real API error.
      if (typeof Blob !== 'undefined' && data instanceof Blob) {
        try {
          const body = await data.text();
          data = body ? JSON.parse(body) as ApiError : undefined;
        } catch {
          data = undefined;
        }
      }

      const normalizedError: ApiError = {
        status: error.response.status,
        message:
          data?.message ||
          (error.response.status === 403
            ? 'You do not have permission to perform this action.'
            : error.response.status === 404
              ? 'The requested document or file was not found.'
              : 'An unexpected error occurred.'),
        validationErrors: data?.validationErrors || {},
        error: data?.error,
        path: data?.path,
      };

      return Promise.reject(normalizedError);
    } else if (error.request) {
      // Network error / backend down
      const networkError: ApiError = {
        status: 0,
        message: 'Unable to connect to the server. Please check your connection or backend status.',
      };
      return Promise.reject(networkError);
    } else {
      const genericError: ApiError = {
        message: error.message || 'An unknown error occurred.',
      };
      return Promise.reject(genericError);
    }
  }
);
