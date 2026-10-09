import { apiClient } from './client';
import { storage } from '../utils/storage';
import { ChatCitation, ChatConversation, ChatHistory, ChatSendResponse, ChatSource, IngestionResponse } from '../types/chat';

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
  async deleteConversation(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/chat/conversations/${id}`);
  },
  async getHistory(id: string): Promise<ChatHistory> {
    const r = await apiClient.get<ChatHistory>(`/api/v1/chat/conversations/${id}/messages`);
    return r.data;
  },
  async send(id: string, message: string): Promise<ChatSendResponse> {
    const r = await apiClient.post<ChatSendResponse>(
      `/api/v1/chat/conversations/${id}/messages`,
      null,
      { params: { message }, timeout: 120000 }
    );
    return r.data;
  },
  async stream(
    id: string,
    message: string,
    onToken: (token: string) => void,
    onCitation?: (citation: ChatCitation) => void,
  ): Promise<void> {
    const token = storage.getToken();
    const base = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${base}/api/v1/chat/conversations/${id}/stream?message=${encodeURIComponent(message)}`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok || !response.body) {
      throw new Error(`Unable to start chat stream (HTTP ${response.status}).`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';

      for (const event of events) {
        const lines = event.split(/\r?\n/);
        const eventType = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message';
        const data = lines
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).replace(/^ /, ''))
          .join('\n');

        if (!data) continue;

        let parsed: unknown = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }

        if (eventType === 'token') {
          const text = typeof parsed === 'object' && parsed !== null && 'text' in parsed
            ? String((parsed as { text: unknown }).text)
            : data;
          onToken(text);
        } else if (eventType === 'citation') {
          if (onCitation && typeof parsed === 'object' && parsed !== null) {
            onCitation(parsed as ChatCitation);
          }
        } else if (eventType === 'error') {
          const msg = typeof parsed === 'object' && parsed !== null && 'message' in parsed
            ? String((parsed as { message: unknown }).message)
            : data;
          throw new Error(msg);
        }
      }
    }
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
