package com.enterprise.knowledge.chat.dto;

import java.util.UUID;

public record ChatCitationResponse(
        UUID id,
        UUID documentId,
        String title,
        String fileName,
        String mimeType,
        int version,
        UUID chunkId,
        int chunkIndex,
        double similarity,
        double confidence,
        String snippet,
        Integer pageNumber,
        String locatorLabel
) {}
