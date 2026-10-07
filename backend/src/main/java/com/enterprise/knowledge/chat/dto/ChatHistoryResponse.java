package com.enterprise.knowledge.chat.dto;

import java.util.List;

public record ChatHistoryResponse(
        List<ChatMessageResponse> messages
) {}
