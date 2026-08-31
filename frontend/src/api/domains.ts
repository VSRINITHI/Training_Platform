import { apiClient } from './client';
import { Domain, DomainCreatePayload, DomainUpdatePayload } from '../types';

export const domainsApi = {
  // GET /api/v1/domains
  list: async (): Promise<Domain[]> => {
    const res = await apiClient.get<Domain[]>('/domains');
    return res.data;
  },

  // GET /api/v1/domains/{domain_identifier}
  get: async (identifier: string): Promise<Domain> => {
    const res = await apiClient.get<Domain>(`/domains/${identifier}`);
    return res.data;
  },

  // POST /api/v1/domains (Admin only)
  create: async (payload: DomainCreatePayload): Promise<Domain> => {
    const res = await apiClient.post<Domain>('/domains', payload);
    return res.data;
  },

  // PATCH /api/v1/domains/{domain_id} (Admin only)
  update: async (id: string, payload: DomainUpdatePayload): Promise<Domain> => {
    const res = await apiClient.patch<Domain>(`/domains/${id}`, payload);
    return res.data;
  },

  // DELETE /api/v1/domains/{domain_id} (Admin only)
  delete: async (id: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/domains/${id}`);
    return res.data;
  },
};
