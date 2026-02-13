import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getErrorMessage } from '@/lib/api/client';
import { useAuthStore, User } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

/**
 * Login credentials
 */
interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data
 */
interface RegisterData {
  email: string;
  password: string;
  name: string;
  organizationName: string;
}

/**
 * Authentication response
 */
interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Custom hook for authentication operations
 */
export const useAuth = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { login: loginStore, logout: logoutStore, user, isAuthenticated } = useAuthStore();

  /**
   * Login mutation
   */
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/login', credentials);
      return response.data.data;
    },
    onSuccess: (data) => {
      loginStore(data.user, data.accessToken, data.refreshToken);
      navigate('/dashboard');
    },
  });

  /**
   * Register mutation
   */
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/register', data);
      return response.data.data;
    },
    onSuccess: (data) => {
      loginStore(data.user, data.accessToken, data.refreshToken);
      navigate('/dashboard');
    },
  });

  /**
   * Logout function
   */
  const logout = () => {
    logoutStore();
    queryClient.clear();
    navigate('/login');
  };

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    loginError: loginMutation.error ? getErrorMessage(loginMutation.error) : null,
    registerError: registerMutation.error ? getErrorMessage(registerMutation.error) : null,
    loginMutationError: loginMutation.error,
    registerMutationError: registerMutation.error,
  };
};
