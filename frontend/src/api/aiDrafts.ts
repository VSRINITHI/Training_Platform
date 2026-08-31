import { apiClient } from './client';
import {
  AIQuizDraft,
  AIQuizDraftCreatePayload,
  AIQuizDraftReviewPayload,
} from '../types';

export const aiDraftsApi = {
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

  // POST /api/v1/ai-drafts/{draft_id}/review
  reviewDraft: async (draftId: string, payload: AIQuizDraftReviewPayload): Promise<AIQuizDraft> => {
    const res = await apiClient.post<AIQuizDraft>(`/ai-drafts/${draftId}/review`, payload);
    return res.data;
  },
};
