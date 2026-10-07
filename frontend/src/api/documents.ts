import { apiClient } from './client';
import { DocumentPageResponse, DocumentResponse, DocumentStatus, UpdateDocumentRequest } from '../types/document';

export const documentApi = {
  async getDocuments(params: {
    q?: string;
    departmentId?: string;
    status?: DocumentStatus;
    page?: number;
    size?: number;
  } = {}): Promise<DocumentPageResponse> {
    const response = await apiClient.get<DocumentPageResponse>('/api/v1/documents', { params });
    return response.data;
  },

  async getDocument(id: string): Promise<DocumentResponse> {
    const response = await apiClient.get<DocumentResponse>(`/api/v1/documents/${id}`);
    return response.data;
  },

  async upload(file: File, title: string, description: string, departmentId?: string | null): Promise<DocumentResponse> {
    const form = new FormData();
    form.append('file', file);
    if (title.trim()) form.append('title', title.trim());
    if (description.trim()) form.append('description', description.trim());
    if (departmentId) form.append('departmentId', departmentId);
    const response = await apiClient.post<DocumentResponse>('/api/v1/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async update(id: string, payload: UpdateDocumentRequest): Promise<DocumentResponse> {
    const response = await apiClient.put<DocumentResponse>(`/api/v1/documents/${id}`, payload);
    return response.data;
  },

  async approve(id: string): Promise<DocumentResponse> {
    const response = await apiClient.post<DocumentResponse>(`/api/v1/documents/${id}/approve`);
    return response.data;
  },

  async replaceContent(id: string, file: File): Promise<DocumentResponse> {
    const form = new FormData();
    form.append('file', file);
    const response = await apiClient.put<DocumentResponse>(`/api/v1/documents/${id}/content`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async deleteDocument(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/documents/${id}`);
  },

  async fetchContent(id: string, download = false): Promise<Blob> {
    const response = await apiClient.get<Blob>(
      `/api/v1/documents/${id}/${download ? 'download' : 'content'}`,
      { responseType: 'blob' }
    );
    return response.data;
  },
};
