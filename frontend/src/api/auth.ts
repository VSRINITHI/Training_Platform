import { apiClient } from './client';
import {
  UserProfile,
  UserRole,
  UserUpdatePayload,
  UserInvitation,
  InviteUserPayload,
  InvitationListResponse,
} from '../types';

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

  // GET /api/v1/auth/users (Admin only)
  listUsers: async (params?: { search?: string; role?: UserRole }): Promise<UserProfile[]> => {
    const res = await apiClient.get<UserProfile[]>('/auth/users', { params });
    return res.data;
  },

  // POST /api/v1/auth/invite (Admin only)
  inviteUser: async (payload: InviteUserPayload): Promise<UserInvitation> => {
    const res = await apiClient.post<UserInvitation>('/auth/invite', payload);
    return res.data;
  },

  // GET /api/v1/auth/invitations (Admin only)
  listInvitations: async (statusFilter?: string): Promise<InvitationListResponse> => {
    const res = await apiClient.get<InvitationListResponse>('/auth/invitations', {
      params: statusFilter ? { status_filter: statusFilter } : undefined,
    });
    return res.data;
  },

  // POST /api/v1/auth/invitations/{id}/resend (Admin only)
  resendInvitation: async (invitationId: string): Promise<UserInvitation> => {
    const res = await apiClient.post<UserInvitation>(`/auth/invitations/${invitationId}/resend`);
    return res.data;
  },

  // DELETE /api/v1/auth/invitations/{id} (Admin only)
  cancelInvitation: async (invitationId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/auth/invitations/${invitationId}`);
    return res.data;
  },

  // DELETE /api/v1/auth/users/{id} (Admin only)
  deleteUser: async (userId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/auth/users/${userId}`);
    return res.data;
  },
};

