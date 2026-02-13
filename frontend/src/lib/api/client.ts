import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/features/auth/store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Axios client instance with authentication and error handling
 */
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token refresh lock to prevent concurrent refresh attempts
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

/**
 * Subscribe to token refresh completion
 */
const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

/**
 * Notify all subscribers that token has been refreshed
 */
const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

/**
 * Decode JWT and check if it's about to expire (within 2 minutes)
 */
const isTokenExpiringSoon = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const twoMinutes = 2 * 60 * 1000;
    return exp - now < twoMinutes;
  } catch {
    return true; // If we can't decode, assume it's expired
  }
};

/**
 * Refresh tokens
 */
const refreshTokens = async (): Promise<string | null> => {
  const refreshToken = useAuthStore.getState().refreshToken;

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await axios.post<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(`${API_URL}/auth/refresh`, {
      refreshToken,
    });

    const { accessToken, refreshToken: newRefreshToken } = response.data.data;
    useAuthStore.getState().setTokens(accessToken, newRefreshToken);
    return accessToken;
  } catch {
    useAuthStore.getState().logout();
    return null;
  }
};

/**
 * Request interceptor to attach access token and proactively refresh if needed
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    let token = useAuthStore.getState().accessToken;

    // Proactively refresh token if it's about to expire
    if (token && isTokenExpiringSoon(token)) {
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshTokens();
        isRefreshing = false;

        if (newToken) {
          token = newToken;
          onTokenRefreshed(newToken);
        } else {
          return Promise.reject(new Error('Token refresh failed'));
        }
      } else {
        // Wait for the ongoing refresh to complete
        token = await new Promise<string>((resolve) => {
          subscribeTokenRefresh(resolve);
        });
      }
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle token refresh and errors
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Wait for the ongoing refresh to complete
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          });
          // Set a timeout in case refresh fails
          setTimeout(() => reject(error), 10000);
        });
      }

      isRefreshing = true;
      const newToken = await refreshTokens();
      isRefreshing = false;

      if (newToken) {
        onTokenRefreshed(newToken);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      }

      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

/**
 * API error response type (matches backend structure)
 */
export interface ApiError {
  success: false;
  error: string;
  errors?: string[]; // Validation errors from Zod
}

/**
 * Extract error message from API error response
 */
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError;

    // Handle validation errors
    if (apiError?.errors && Array.isArray(apiError.errors) && apiError.errors.length > 0) {
      return apiError.errors[0];
    }

    // Handle regular error message
    return apiError?.error || error.message || 'An unexpected error occurred';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
};

/**
 * Extract validation errors from API error response
 * Converts array of "field: message" strings to object
 */
export const getValidationErrors = (error: unknown): Record<string, string> | null => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError;
    if (apiError?.errors && Array.isArray(apiError.errors)) {
      const validationErrors: Record<string, string> = {};

      apiError.errors.forEach((errorString) => {
        // Parse "field: message" format
        const colonIndex = errorString.indexOf(':');
        if (colonIndex > -1) {
          const field = errorString.substring(0, colonIndex).trim();
          const message = errorString.substring(colonIndex + 1).trim();
          validationErrors[field] = message;
        }
      });

      return Object.keys(validationErrors).length > 0 ? validationErrors : null;
    }
  }
  return null;
};
