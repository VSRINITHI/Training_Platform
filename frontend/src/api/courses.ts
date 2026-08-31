import { apiClient } from './client';
import {
  Course,
  CourseCreatePayload,
  CourseUpdatePayload,
  DifficultyLevel,
  PersonalizedDiscoveryResponse,
} from '../types';

export const coursesApi = {
  // GET /api/v1/courses (Lists published catalog or instructor/admin drafts)
  list: async (params?: {
    sub_domain_id?: string;
    difficulty_level?: DifficultyLevel;
    search?: string;
  }): Promise<Course[]> => {
    const res = await apiClient.get<Course[]>('/courses', { params });
    return res.data;
  },

  // GET /api/v1/discovery/courses (Personalized recommendation)
  discover: async (params?: {
    domain_id?: string;
    sub_domain_id?: string;
    difficulty?: DifficultyLevel;
    search?: string;
    personalized?: boolean;
  }): Promise<PersonalizedDiscoveryResponse> => {
    const res = await apiClient.get<PersonalizedDiscoveryResponse>('/discovery/courses', { params });
    return res.data;
  },

  // GET /api/v1/courses/{course_identifier}
  get: async (identifier: string): Promise<Course> => {
    const res = await apiClient.get<Course>(`/courses/${identifier}`);
    return res.data;
  },

  // POST /api/v1/courses (Instructor / Admin)
  create: async (payload: CourseCreatePayload): Promise<Course> => {
    const res = await apiClient.post<Course>('/courses', payload);
    return res.data;
  },

  // PATCH /api/v1/courses/{course_id} (Owner Instructor / Admin)
  update: async (id: string, payload: CourseUpdatePayload): Promise<Course> => {
    const res = await apiClient.patch<Course>(`/courses/${id}`, payload);
    return res.data;
  },

  // DELETE /api/v1/courses/{course_id} (Owner Instructor / Admin)
  delete: async (id: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/courses/${id}`);
    return res.data;
  },

  // POST /api/v1/courses/{course_id}/publish
  publish: async (id: string): Promise<{ id: string; is_published: boolean; message: string }> => {
    const res = await apiClient.post<{ id: string; is_published: boolean; message: string }>(
      `/courses/${id}/publish`
    );
    return res.data;
  },

  // POST /api/v1/courses/{course_id}/unpublish
  unpublish: async (id: string): Promise<{ id: string; is_published: boolean; message: string }> => {
    const res = await apiClient.post<{ id: string; is_published: boolean; message: string }>(
      `/courses/${id}/unpublish`
    );
    return res.data;
  },
};
