package com.enterprise.knowledge.chat.dto;

import java.time.Instant;
import java.util.UUID;

public record ChatConversationResponse(
        UUID id,
        String title,
        Instant createdAt,
        Instant updatedAt,
        long messageCount
) {}
