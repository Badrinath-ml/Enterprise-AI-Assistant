export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatCitation {
  id: string;
  documentId: string;
  title: string;
  fileName: string;
  mimeType: string;
  version: number;
  chunkId: string;
  chunkIndex: number;
  similarity: number;
  confidence: number;
  snippet: string;
  pageNumber?: number | null;
  locatorLabel?: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
  provider?: string | null;
  model?: string | null;
  citations: ChatCitation[];
}

export interface ChatHistory {
  messages: ChatMessage[];
}

export interface ChatSendResponse {
  conversationId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export interface ChatSource {
  documentId: string;
  title: string;
  fileName: string;
  mimeType: string;
  version: number;
  text: string;
}

export interface IngestionResponse {
  id: string;
  version: number;
  ingestionStatus: 'NOT_INDEXED' | 'QUEUED' | 'PROCESSING' | 'INDEXED' | 'FAILED';
  indexedChunkCount: number;
  indexedAt?: string | null;
  ingestionError?: string | null;
}
