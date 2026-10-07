import { apiClient } from './client';
import { ChatConversation, ChatHistory, ChatSendResponse, ChatSource, IngestionResponse } from '../types/chat';

export const chatApi = {
  async getConversations(): Promise<ChatConversation[]> {
    const r = await apiClient.get<ChatConversation[]>('/api/v1/chat/conversations');
    return r.data;
  },
  async createConversation(title?: string): Promise<ChatConversation> {
    const r = await apiClient.post<ChatConversation>('/api/v1/chat/conversations', null, {
      params: title ? { title } : undefined,
    });
    return r.data;
  },
  async getHistory(id: string): Promise<ChatHistory> {
    const r = await apiClient.get<ChatHistory>(`/api/v1/chat/conversations/${id}/messages`);
    return r.data;
  },
  async send(id: string, message: string): Promise<ChatSendResponse> {
    const r = await apiClient.post<ChatSendResponse>(
      `/api/v1/chat/conversations/${id}/messages`,
      null,
      { params: { message } }
    );
    return r.data;
  },
  async upload(id: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const r = await apiClient.post(`/api/v1/chat/conversations/${id}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data as { id: string; title: string; originalFileName: string; version: number };
  },
  async ingestion(id: string): Promise<IngestionResponse> {
    const r = await apiClient.get<IngestionResponse>(`/api/v1/documents/${id}/ingestion`);
    return r.data;
  },
  async source(documentId: string): Promise<ChatSource> {
    const r = await apiClient.get<ChatSource>(`/api/v1/chat/sources/${documentId}`);
    return r.data;
  },
};
