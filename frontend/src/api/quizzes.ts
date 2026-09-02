import { apiClient } from './client';
import {
  QuizPublic,
  QuizAuthoring,
  QuizCreatePayload,
  QuizUpdatePayload,
  QuestionAuthoring,
  QuestionCreatePayload,
  QuestionUpdatePayload,
  QuestionOptionAuthoring,
  QuestionOptionCreatePayload,
  QuestionOptionUpdatePayload,
  QuizSubmissionPayload,
  QuizSubmissionResult,
  QuizAttemptRecord,
  ReorderPayload,
} from '../types';

export const quizzesApi = {
  // GET /api/v1/quizzes/{quiz_id} (Learner: answers masked)
  getPublic: async (quizId: string): Promise<QuizPublic> => {
    const res = await apiClient.get<QuizPublic>(`/quizzes/${quizId}`);
    return res.data;
  },

  // GET /api/v1/quizzes/{quiz_id}/authoring (Instructor / Admin: answers included)
  getAuthoring: async (quizId: string): Promise<QuizAuthoring> => {
    const res = await apiClient.get<QuizAuthoring>(`/quizzes/${quizId}/authoring`);
    return res.data;
  },

  // GET /api/v1/modules/{module_id}/quiz (Authoring mode)
  getModuleQuiz: async (moduleId: string): Promise<QuizAuthoring> => {
    const res = await apiClient.get<QuizAuthoring>(`/modules/${moduleId}/quiz`);
    return res.data;
  },

  // GET /api/v1/courses/{course_id}/final-quiz (Authoring mode)
  getCourseFinalQuiz: async (courseId: string): Promise<QuizAuthoring> => {
    const res = await apiClient.get<QuizAuthoring>(`/courses/${courseId}/final-quiz`);
    return res.data;
  },

  // GET /api/v1/courses/{course_id}/quizzes
  getCourseQuizzes: async (courseId: string): Promise<QuizAuthoring[]> => {
    const res = await apiClient.get<QuizAuthoring[]>(`/courses/${courseId}/quizzes`);
    return res.data;
  },

  // POST /api/v1/quizzes (Create quiz)
  create: async (payload: QuizCreatePayload): Promise<QuizAuthoring> => {
    const res = await apiClient.post<QuizAuthoring>('/quizzes', payload);
    return res.data;
  },

  // PATCH /api/v1/quizzes/{quiz_id}
  update: async (quizId: string, payload: QuizUpdatePayload): Promise<QuizAuthoring> => {
    const res = await apiClient.patch<QuizAuthoring>(`/quizzes/${quizId}`, payload);
    return res.data;
  },

  // DELETE /api/v1/quizzes/{quiz_id}
  delete: async (quizId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/quizzes/${quizId}`);
    return res.data;
  },

  // POST /api/v1/quizzes/{quiz_id}/questions
  addQuestion: async (quizId: string, payload: QuestionCreatePayload): Promise<QuestionAuthoring> => {
    const res = await apiClient.post<QuestionAuthoring>(`/quizzes/${quizId}/questions`, payload);
    return res.data;
  },

  // PATCH /api/v1/quizzes/questions/{question_id}
  updateQuestion: async (questionId: string, payload: QuestionUpdatePayload): Promise<QuestionAuthoring> => {
    const res = await apiClient.patch<QuestionAuthoring>(`/quizzes/questions/${questionId}`, payload);
    return res.data;
  },

  // DELETE /api/v1/quizzes/questions/{question_id}
  deleteQuestion: async (questionId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/quizzes/questions/${questionId}`);
    return res.data;
  },

  // POST /api/v1/quizzes/{quiz_id}/questions/reorder
  reorderQuestions: async (quizId: string, payload: ReorderPayload): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>(`/quizzes/${quizId}/questions/reorder`, payload);
    return res.data;
  },

  // POST /api/v1/quizzes/questions/{question_id}/options
  addOption: async (questionId: string, payload: QuestionOptionCreatePayload): Promise<QuestionOptionAuthoring> => {
    const res = await apiClient.post<QuestionOptionAuthoring>(`/quizzes/questions/${questionId}/options`, payload);
    return res.data;
  },

  // PATCH /api/v1/quizzes/options/{option_id}
  updateOption: async (optionId: string, payload: QuestionOptionUpdatePayload): Promise<QuestionOptionAuthoring> => {
    const res = await apiClient.patch<QuestionOptionAuthoring>(`/quizzes/options/${optionId}`, payload);
    return res.data;
  },

  // DELETE /api/v1/quizzes/options/{option_id}
  deleteOption: async (optionId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/quizzes/options/${optionId}`);
    return res.data;
  },

  // POST /api/v1/quizzes/{quiz_id}/submit (Learner submission & scoring)
  submit: async (quizId: string, payload: QuizSubmissionPayload): Promise<QuizSubmissionResult> => {
    const res = await apiClient.post<QuizSubmissionResult>(`/quizzes/${quizId}/submit`, payload);
    return res.data;
  },

  // GET /api/v1/quizzes/{quiz_id}/attempts
  getMyAttempts: async (quizId: string): Promise<QuizAttemptRecord[]> => {
    const res = await apiClient.get<QuizAttemptRecord[]>(`/quizzes/${quizId}/attempts`);
    return res.data;
  },

  // GET /api/v1/attempts/{attempt_id}
  getAttemptDetail: async (attemptId: string): Promise<QuizAttemptRecord> => {
    const res = await apiClient.get<QuizAttemptRecord>(`/attempts/${attemptId}`);
    return res.data;
  },
};
