package com.enterprise.knowledge.document.dto;

public record DocumentStatsResponse(
        long totalDocuments,
        long approvedDocuments,
        long indexedDocuments,
        long failedDocuments
) {}
