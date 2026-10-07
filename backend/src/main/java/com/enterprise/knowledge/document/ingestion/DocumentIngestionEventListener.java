package com.enterprise.knowledge.document.ingestion;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class DocumentIngestionEventListener {
    private final DocumentIngestionService ingestionService;
    public DocumentIngestionEventListener(DocumentIngestionService ingestionService) { this.ingestionService = ingestionService; }
    @Async("documentIngestionExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(DocumentIngestionRequestedEvent event) {
        ingestionService.process(event.tenantId(), event.documentId());
    }
}
