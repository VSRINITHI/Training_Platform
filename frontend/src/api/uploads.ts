import { apiClient } from './client';
import { UploadResponse } from '../types';

export const uploadsApi = {
  // POST /api/v1/uploads/video
  uploadVideo: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<UploadResponse>('/uploads/video', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  // POST /api/v1/uploads/material
  uploadMaterial: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<UploadResponse>('/uploads/material', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
};
