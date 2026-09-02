import { apiClient } from './client';
import {
  AIQuizDraft,
  AIQuizDraftCreatePayload,
  AIQuizDraftReviewPayload,
  AIQuizGeneratePayload,
} from '../types';

export const aiDraftsApi = {
  // POST /api/v1/modules/{module_id}/ai-generate with 120s timeout
  generateModuleQuiz: async (moduleId: string, payload: AIQuizGeneratePayload = {}): Promise<AIQuizDraft> => {
    const res = await apiClient.post<AIQuizDraft>(`/modules/${moduleId}/ai-generate`, payload, {
      timeout: 120000,
    });
    return res.data;
  },

  // POST /api/v1/courses/{course_id}/ai-generate with 120s timeout
  generateCourseQuiz: async (courseId: string, payload: AIQuizGeneratePayload = {}): Promise<AIQuizDraft> => {
    const res = await apiClient.post<AIQuizDraft>(`/courses/${courseId}/ai-generate`, payload, {
      timeout: 120000,
    });
    return res.data;
  },

  // GET /api/v1/ai-drafts/{draft_id}
  getDraft: async (draftId: string): Promise<AIQuizDraft> => {
    const res = await apiClient.get<AIQuizDraft>(`/ai-drafts/${draftId}`);
    return res.data;
  },

  // POST /api/v1/lessons/{lesson_id}/ai-drafts
  createDraft: async (lessonId: string, payload: AIQuizDraftCreatePayload): Promise<AIQuizDraft> => {
    const res = await apiClient.post<AIQuizDraft>(`/lessons/${lessonId}/ai-drafts`, payload);
    return res.data;
  },

  // GET /api/v1/lessons/{lesson_id}/ai-drafts
  listByLesson: async (lessonId: string): Promise<AIQuizDraft[]> => {
    const res = await apiClient.get<AIQuizDraft[]>(`/lessons/${lessonId}/ai-drafts`);
    return res.data;
  },

  // GET /api/v1/modules/{module_id}/ai-drafts
  listByModule: async (moduleId: string): Promise<AIQuizDraft[]> => {
    const res = await apiClient.get<AIQuizDraft[]>(`/modules/${moduleId}/ai-drafts`);
    return res.data;
  },

  // GET /api/v1/courses/{course_id}/ai-drafts
  listByCourse: async (courseId: string): Promise<AIQuizDraft[]> => {
    const res = await apiClient.get<AIQuizDraft[]>(`/courses/${courseId}/ai-drafts`);
    return res.data;
  },

  // POST /api/v1/ai-drafts/{draft_id}/review
  reviewDraft: async (draftId: string, payload: AIQuizDraftReviewPayload): Promise<AIQuizDraft> => {
    const res = await apiClient.post<AIQuizDraft>(`/ai-drafts/${draftId}/review`, payload);
    return res.data;
  },
};
