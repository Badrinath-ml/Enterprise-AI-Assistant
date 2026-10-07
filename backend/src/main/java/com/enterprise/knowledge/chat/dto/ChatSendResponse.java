package com.enterprise.knowledge.chat.dto;

import java.util.UUID;

public record ChatSendResponse(
        UUID conversationId,
        ChatMessageResponse userMessage,
        ChatMessageResponse assistantMessage
) {}
