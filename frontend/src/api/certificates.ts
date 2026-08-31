import { apiClient } from './client';
import { Certificate, CertificateVerifyResult } from '../types';

export const certificatesApi = {
  // POST /api/v1/courses/{course_id}/certificate (Claim certificate)
  claim: async (courseId: string): Promise<Certificate> => {
    const res = await apiClient.post<Certificate>(`/courses/${courseId}/certificate`);
    return res.data;
  },

  // GET /api/v1/certificates/me (List my certificates)
  getMyCertificates: async (): Promise<Certificate[]> => {
    const res = await apiClient.get<Certificate[]>('/certificates/me');
    return res.data;
  },

  // GET /api/v1/certificates/{certificate_id}
  get: async (certificateId: string): Promise<Certificate> => {
    const res = await apiClient.get<Certificate>(`/certificates/${certificateId}`);
    return res.data;
  },

  // GET /api/v1/certificates/verify/{certificate_number_or_hash} (Public verification)
  verify: async (identifier: string): Promise<CertificateVerifyResult> => {
    const res = await apiClient.get<CertificateVerifyResult>(`/certificates/verify/${identifier}`);
    return res.data;
  },
};
