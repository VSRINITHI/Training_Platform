import { apiClient } from './client';
import { SubDomain, SubDomainCreatePayload, SubDomainUpdatePayload } from '../types';

export const subDomainsApi = {
  // GET /api/v1/sub-domains
  list: async (domainId?: string): Promise<SubDomain[]> => {
    const params = domainId ? { domain_id: domainId } : undefined;
    const res = await apiClient.get<SubDomain[]>('/sub-domains', { params });
    return res.data;
  },

  // GET /api/v1/sub-domains/{sub_domain_identifier}
  get: async (identifier: string): Promise<SubDomain> => {
    const res = await apiClient.get<SubDomain>(`/sub-domains/${identifier}`);
    return res.data;
  },

  // POST /api/v1/sub-domains (Admin only)
  create: async (payload: SubDomainCreatePayload): Promise<SubDomain> => {
    const res = await apiClient.post<SubDomain>('/sub-domains', payload);
    return res.data;
  },

  // PATCH /api/v1/sub-domains/{sub_domain_id} (Admin only)
  update: async (id: string, payload: SubDomainUpdatePayload): Promise<SubDomain> => {
    const res = await apiClient.patch<SubDomain>(`/sub-domains/${id}`, payload);
    return res.data;
  },

  // DELETE /api/v1/sub-domains/{sub_domain_id} (Admin only)
  delete: async (id: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/sub-domains/${id}`);
    return res.data;
  },
};
