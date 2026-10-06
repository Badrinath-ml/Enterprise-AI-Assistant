import { UserRole } from './auth';

export type DocumentStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface DocumentResponse {
  id: string;
  title: string;
  description?: string | null;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  status: DocumentStatus;
  version: number;
  departmentId: string | null;
  departmentName: string | null;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPageResponse {
  content: DocumentResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface UpdateDocumentRequest {
  title: string;
  description: string;
  departmentId: string | null;
  status: DocumentStatus;
}
