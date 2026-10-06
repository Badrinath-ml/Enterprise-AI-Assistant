package com.enterprise.knowledge.document.dto;

import java.util.List;

public record DocumentPageResponse(
        List<DocumentResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}
