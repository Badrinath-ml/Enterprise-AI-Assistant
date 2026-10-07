package com.enterprise.knowledge.chat.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ChatMessageResponse(
        UUID id,
        String role,
        String content,
        Instant createdAt,
        String provider,
        String model,
        List<ChatCitationResponse> citations
) {}
