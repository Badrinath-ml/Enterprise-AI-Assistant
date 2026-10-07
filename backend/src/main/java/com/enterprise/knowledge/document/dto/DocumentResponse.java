package com.enterprise.knowledge.document.dto;

import com.enterprise.knowledge.document.Document;
import com.enterprise.knowledge.document.DocumentStatus;
import com.enterprise.knowledge.document.IngestionStatus;

import java.time.Instant;
import java.util.UUID;

public record DocumentResponse(
        UUID id,
        String title,
        String description,
        String originalFileName,
        String mimeType,
        long fileSize,
        DocumentStatus status,
        IngestionStatus ingestionStatus,
        int indexedChunkCount,
        String ingestionError,
        int version,
        UUID departmentId,
        String departmentName,
        UUID uploadedBy,
        String uploadedByName,
        Instant createdAt,
        Instant updatedAt
) {
    public static DocumentResponse from(Document d) {
        return new DocumentResponse(
                d.getId(),
                d.getTitle(),
                d.getDescription(),
                d.getOriginalFileName(),
                d.getMimeType(),
                d.getFileSize(),
                d.getStatus(),
                d.getIngestionStatus(),
                d.getIndexedChunkCount(),
                d.getIngestionError(),
                d.getVersion(),
                d.getDepartment() == null ? null : d.getDepartment().getId(),
                d.getDepartment() == null ? null : d.getDepartment().getName(),
                d.getUploadedBy().getId(),
                d.getUploadedBy().getName(),
                d.getCreatedAt(),
                d.getUpdatedAt()
        );
    }
}
