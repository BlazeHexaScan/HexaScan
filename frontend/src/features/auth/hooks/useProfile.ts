import { useMutation } from '@tanstack/react-query';
import { apiClient, getErrorMessage } from '@/lib/api/client';
import { useAuthStore, User } from '../store/authStore';

interface UpdateProfileData {
  name: string;
}

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export const useUpdateProfile = () => {
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);

  const mutation = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const response = await apiClient.patch<{ success: boolean; data: User }>('/auth/profile', data);
      return response.data.data;
    },
    onSuccess: (updatedUser) => {
      if (user) {
        setUser({ ...user, ...updatedUser });
      }
    },
  });

  return {
    updateProfile: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error ? getErrorMessage(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
};

export const useChangePassword = () => {
  const mutation = useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      const response = await apiClient.post<{ success: boolean; message: string }>('/auth/change-password', data);
      return response.data;
    },
  });

  return {
    changePassword: mutation.mutateAsync,
    isChanging: mutation.isPending,
    error: mutation.error ? getErrorMessage(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
};
