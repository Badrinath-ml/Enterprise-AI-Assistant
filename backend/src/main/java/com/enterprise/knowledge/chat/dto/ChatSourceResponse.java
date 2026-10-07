package com.enterprise.knowledge.chat.dto;

import java.util.UUID;

public record ChatSourceResponse(UUID documentId, String title, String fileName,
                                 String mimeType, int version, String text) {}
