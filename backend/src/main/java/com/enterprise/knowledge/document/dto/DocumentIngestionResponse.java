package com.enterprise.knowledge.document.dto;

import com.enterprise.knowledge.document.IngestionStatus;
import java.time.Instant;
import java.util.UUID;

public record DocumentIngestionResponse(
        UUID documentId,
        int version,
        IngestionStatus status,
        int chunkCount,
        Instant indexedAt,
        String error
) {}
