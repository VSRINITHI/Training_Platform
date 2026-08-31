import { apiClient } from './client';
import { UserProfile, UserRole, UserUpdatePayload } from '../types';

export const authApi = {
  // GET /api/v1/auth/me
  getMe: async (): Promise<UserProfile> => {
    const res = await apiClient.get<UserProfile>('/auth/me');
    return res.data;
  },

  // POST /api/v1/auth/sync
  syncProfile: async (): Promise<UserProfile> => {
    const res = await apiClient.post<UserProfile>('/auth/sync');
    return res.data;
  },

  // PATCH /api/v1/auth/me
  updateProfile: async (payload: UserUpdatePayload): Promise<UserProfile> => {
    const res = await apiClient.patch<UserProfile>('/auth/me', payload);
    return res.data;
  },

  // PATCH /api/v1/auth/users/{user_id}/role (Admin only)
  assignRole: async (userId: string, role: UserRole): Promise<UserProfile> => {
    const res = await apiClient.patch<UserProfile>(`/auth/users/${userId}/role`, { role });
    return res.data;
  },
};
