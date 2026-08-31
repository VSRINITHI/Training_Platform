import { apiClient } from './client';
import { UserInterest } from '../types';

export const interestsApi = {
  // GET /api/v1/interests/me
  getMyInterests: async (): Promise<UserInterest[]> => {
    const res = await apiClient.get<UserInterest[]>('/interests/me');
    return res.data;
  },

  // PUT /api/v1/interests/me
  setMyInterests: async (subDomainIds: string[]): Promise<UserInterest[]> => {
    const res = await apiClient.put<UserInterest[]>('/interests/me', { sub_domain_ids: subDomainIds });
    return res.data;
  },

  // DELETE /api/v1/interests/me/{sub_domain_id}
  removeInterest: async (subDomainId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/interests/me/${subDomainId}`);
    return res.data;
  },
};
