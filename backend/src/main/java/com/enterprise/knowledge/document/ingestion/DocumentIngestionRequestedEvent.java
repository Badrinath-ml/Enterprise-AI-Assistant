package com.enterprise.knowledge.document.ingestion;

import java.util.UUID;

public record DocumentIngestionRequestedEvent(UUID tenantId, UUID documentId) {}
