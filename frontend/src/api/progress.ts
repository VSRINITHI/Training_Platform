import { apiClient } from './client';
import {
  Enrollment,
  CourseProgressHierarchy,
} from '../types';

export const progressApi = {
  // POST /api/v1/enrollments (Enroll current user in course)
  enroll: async (courseId: string): Promise<Enrollment> => {
    const res = await apiClient.post<Enrollment>('/enrollments', { course_id: courseId });
    return res.data;
  },

  // GET /api/v1/enrollments/me (List current user's enrollments)
  getMyEnrollments: async (): Promise<Enrollment[]> => {
    const res = await apiClient.get<Enrollment[]>('/enrollments/me');
    return res.data;
  },

  // GET /api/v1/enrollments/{enrollment_id}
  getEnrollment: async (enrollmentId: string): Promise<Enrollment> => {
    const res = await apiClient.get<Enrollment>(`/enrollments/${enrollmentId}`);
    return res.data;
  },

  // POST /api/v1/enrollments/{enrollment_id}/drop
  dropEnrollment: async (enrollmentId: string): Promise<Enrollment> => {
    const res = await apiClient.post<Enrollment>(`/enrollments/${enrollmentId}/drop`);
    return res.data;
  },

  // GET /api/v1/courses/{course_id}/progress
  getCourseProgress: async (courseId: string): Promise<CourseProgressHierarchy> => {
    const res = await apiClient.get<CourseProgressHierarchy>(`/courses/${courseId}/progress`);
    return res.data;
  },

  // POST /api/v1/modules/{module_id}/relearning/reset
  resetRelearning: async (moduleId: string): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>(`/modules/${moduleId}/relearning/reset`);
    return res.data;
  },
};
