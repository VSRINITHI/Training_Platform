import { apiClient } from './client';
import {
  ModuleDetail,
  ModuleItem,
  ModuleCreatePayload,
  ModuleUpdatePayload,
  ReorderPayload,
} from '../types';

export const modulesApi = {
  // GET /api/v1/courses/{course_id}/modules
  listByCourse: async (courseId: string): Promise<ModuleDetail[]> => {
    const res = await apiClient.get<ModuleDetail[]>(`/courses/${courseId}/modules`);
    return res.data;
  },

  // GET /api/v1/modules/{module_id}
  get: async (moduleId: string): Promise<ModuleDetail> => {
    const res = await apiClient.get<ModuleDetail>(`/modules/${moduleId}`);
    return res.data;
  },

  // POST /api/v1/courses/{course_id}/modules
  create: async (courseId: string, payload: ModuleCreatePayload): Promise<ModuleItem> => {
    const res = await apiClient.post<ModuleItem>(`/courses/${courseId}/modules`, payload);
    return res.data;
  },

  // PATCH /api/v1/modules/{module_id}
  update: async (moduleId: string, payload: ModuleUpdatePayload): Promise<ModuleItem> => {
    const res = await apiClient.patch<ModuleItem>(`/modules/${moduleId}`, payload);
    return res.data;
  },

  // DELETE /api/v1/modules/{module_id}
  delete: async (moduleId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/modules/${moduleId}`);
    return res.data;
  },

  // POST /api/v1/courses/{course_id}/modules/reorder
  reorder: async (courseId: string, payload: ReorderPayload): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>(`/courses/${courseId}/modules/reorder`, payload);
    return res.data;
  },
};
