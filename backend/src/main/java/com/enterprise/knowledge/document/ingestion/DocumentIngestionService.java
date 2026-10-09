package com.enterprise.knowledge.document.ingestion;

import com.enterprise.knowledge.chat.ChatConversationAttachment;
import com.enterprise.knowledge.chat.ChatConversationAttachmentRepository;
import com.enterprise.knowledge.common.exception.ResourceNotFoundException;
import com.enterprise.knowledge.document.Document;
import com.enterprise.knowledge.document.DocumentRepository;
import com.enterprise.knowledge.document.IngestionStatus;
import com.enterprise.knowledge.document.dto.DocumentIngestionResponse;
import com.enterprise.knowledge.document.storage.FileStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class DocumentIngestionService {
    private static final Logger log = LoggerFactory.getLogger(DocumentIngestionService.class);

    private final DocumentRepository documentRepository;
    private final DocumentChunkRepository chunkRepository;
    private final FileStorageService storage;
    private final DocumentTextExtractorService extractor;
    private final TextChunker chunker;
    private final EmbeddingService embeddingService;
    private final TransactionTemplate transactionTemplate;

    @Autowired(required = false)
    private ChatConversationAttachmentRepository attachmentRepository;

    public DocumentIngestionService(DocumentRepository documentRepository, DocumentChunkRepository chunkRepository,
                                    FileStorageService storage, DocumentTextExtractorService extractor,
                                    TextChunker chunker, EmbeddingService embeddingService,
                                    PlatformTransactionManager transactionManager) {
        this.documentRepository = documentRepository;
        this.chunkRepository = chunkRepository;
        this.storage = storage;
        this.extractor = extractor;
        this.chunker = chunker;
        this.embeddingService = embeddingService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Async("documentIngestionExecutor")
    public void queue(UUID tenantId, UUID documentId) {
        process(tenantId, documentId);
    }

    @Transactional
    public void markQueued(UUID tenantId, UUID documentId) {
        Document d = find(tenantId, documentId);
        d.setIngestionStatus(IngestionStatus.QUEUED);
        d.setIngestionError(null);
        documentRepository.save(d);
    }

    public void process(UUID tenantId, UUID documentId) {
        Document d = find(tenantId, documentId);
        int version = d.getVersion();
        try {
            markProcessing(tenantId, documentId);
            Resource resource = storage.loadAsResource(d.getStorageKey());
            ExtractedDocument extracted;
            try (InputStream inputStream = resource.getInputStream()) {
                extracted = extractor.extract(inputStream, d.getOriginalFileName(), d.getMimeType());
            }

            List<TextChunker.DocumentChunkItem> chunkItems = chunker.chunkPages(extracted.pages());
            if (chunkItems.isEmpty()) {
                throw new IllegalArgumentException("Document contains no extractable text");
            }

            replaceChunks(tenantId, documentId, version, d.getTitle(), chunkItems);
            markIndexed(tenantId, documentId, version, chunkItems.size());
            log.info("Document successfully indexed: id={}, version={}, chunks={}", documentId, version, chunkItems.size());
        } catch (Exception e) {
            String errorMsg = e.getMessage() != null && !e.getMessage().isBlank()
                    ? e.getMessage() : e.getClass().getSimpleName();
            log.error("Document ingestion failed for id={}: {}", documentId, errorMsg, e);
            markFailed(tenantId, documentId, errorMsg);
        }
    }

    protected void markProcessing(UUID tenantId, UUID documentId) {
        Document d = find(tenantId, documentId);
        d.setIngestionStatus(IngestionStatus.PROCESSING);
        d.setIngestionError(null);
        documentRepository.save(d);
    }

    protected void replaceChunks(UUID tenantId, UUID documentId, int version, String title,
                                 List<TextChunker.DocumentChunkItem> chunkItems) {
        String documentTitle = title == null || title.isBlank() ? "none" : title.trim();
        List<float[]> embeddings = embeddingService.embedDocuments(
                chunkItems.stream()
                        .map(item -> "title: " + documentTitle + " | text: " + item.content())
                        .toList()
        );
        if (embeddings.size() != chunkItems.size()) {
            throw new IllegalStateException("Embedding provider returned an unexpected number of vectors");
        }
        transactionTemplate.executeWithoutResult(status -> {
            chunkRepository.deleteForDocument(documentId);
            for (int i = 0; i < chunkItems.size(); i++) {
                float[] embedding = embeddings.get(i);
                if (embedding.length != embeddingService.dimensions()) {
                    throw new IllegalStateException("Embedding dimension does not match configured dimension");
                }
                TextChunker.DocumentChunkItem item = chunkItems.get(i);
                UUID chunkId = UUID.nameUUIDFromBytes(
                        (documentId.toString() + ":v" + version + ":c" + item.chunkIndex()).getBytes(StandardCharsets.UTF_8)
                );
                chunkRepository.insert(chunkId, tenantId, documentId, version, item.chunkIndex(), item.content(),
                        item.tokenCount(), embedding,
                        embeddingService.provider(), embeddingService.model(),
                        item.pageNumber(), item.sourceLocator());
            }
        });
    }

    protected void markIndexed(UUID tenantId, UUID documentId, int version, int chunkCount) {
        Document d = find(tenantId, documentId);
        if (d.getVersion() != version) {
            throw new IllegalStateException("Document changed while it was being indexed; retry ingestion");
        }
        d.setIngestionStatus(IngestionStatus.INDEXED);
        d.setIngestionError(null);
        d.setIndexedAt(Instant.now());
        d.setIndexedChunkCount(chunkCount);
        documentRepository.save(d);
    }

    protected void markFailed(UUID tenantId, UUID documentId, String message) {
        Document d = find(tenantId, documentId);
        d.setIngestionStatus(IngestionStatus.FAILED);
        String error = message == null ? "Ingestion failed" : message;
        d.setIngestionError(error.substring(0, Math.min(error.length(), 1900)));
        d.setIndexedAt(null);
        d.setIndexedChunkCount(0);
        documentRepository.save(d);
    }

    @Transactional(readOnly = true)
    public DocumentIngestionResponse status(UUID tenantId, UUID documentId) {
        var optDoc = documentRepository.findByIdAndTenantId(documentId, tenantId);
        if (optDoc.isPresent()) {
            Document d = optDoc.get();
            return new DocumentIngestionResponse(d.getId(), d.getVersion(), d.getIngestionStatus(),
                    d.getIndexedChunkCount(), d.getIndexedAt(), d.getIngestionError());
        }

        if (attachmentRepository != null) {
            var optAtt = attachmentRepository.findByIdAndTenantId(documentId, tenantId);
            if (optAtt.isPresent()) {
                ChatConversationAttachment a = optAtt.get();
                return new DocumentIngestionResponse(a.getId(), 1, a.getIngestionStatus(),
                        a.getIndexedChunkCount(), a.getCreatedAt(), a.getIngestionError());
            }
        }

        throw new ResourceNotFoundException("Document not found");
    }

    private Document find(UUID tenantId, UUID documentId) {
        return documentRepository.findByIdAndTenantId(documentId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));
    }
}
