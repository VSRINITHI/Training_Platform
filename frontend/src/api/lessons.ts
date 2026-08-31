import { apiClient } from './client';
import {
  LessonItem,
  LessonCreatePayload,
  LessonUpdatePayload,
  ReorderPayload,
} from '../types';

export const lessonsApi = {
  // GET /api/v1/modules/{module_id}/lessons
  listByModule: async (moduleId: string): Promise<LessonItem[]> => {
    const res = await apiClient.get<LessonItem[]>(`/modules/${moduleId}/lessons`);
    return res.data;
  },

  // GET /api/v1/lessons/{lesson_id}
  get: async (lessonId: string): Promise<LessonItem> => {
    const res = await apiClient.get<LessonItem>(`/lessons/${lessonId}`);
    return res.data;
  },

  // POST /api/v1/modules/{module_id}/lessons
  create: async (moduleId: string, payload: LessonCreatePayload): Promise<LessonItem> => {
    const res = await apiClient.post<LessonItem>(`/modules/${moduleId}/lessons`, payload);
    return res.data;
  },

  // PATCH /api/v1/lessons/{lesson_id}
  update: async (lessonId: string, payload: LessonUpdatePayload): Promise<LessonItem> => {
    const res = await apiClient.patch<LessonItem>(`/lessons/${lessonId}`, payload);
    return res.data;
  },

  // DELETE /api/v1/lessons/{lesson_id}
  delete: async (lessonId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/lessons/${lessonId}`);
    return res.data;
  },

  // POST /api/v1/modules/{module_id}/lessons/reorder
  reorder: async (moduleId: string, payload: ReorderPayload): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>(`/modules/${moduleId}/lessons/reorder`, payload);
    return res.data;
  },

  // POST /api/v1/lessons/{lesson_id}/progress
  markProgress: async (lessonId: string, isCompleted: boolean): Promise<any> => {
    const res = await apiClient.post(`/lessons/${lessonId}/progress`, { is_completed: isCompleted });
    return res.data;
  },
};
