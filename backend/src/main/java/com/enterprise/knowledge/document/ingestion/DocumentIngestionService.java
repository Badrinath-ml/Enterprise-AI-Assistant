package com.enterprise.knowledge.document.ingestion;

import com.enterprise.knowledge.document.Document;
import com.enterprise.knowledge.document.DocumentRepository;
import com.enterprise.knowledge.document.IngestionStatus;
import com.enterprise.knowledge.document.dto.DocumentIngestionResponse;
import com.enterprise.knowledge.document.storage.FileStorageService;
import org.springframework.core.io.Resource;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class DocumentIngestionService {
    private final DocumentRepository documentRepository;
    private final DocumentChunkRepository chunkRepository;
    private final FileStorageService storage;
    private final DocumentTextExtractorService extractor;
    private final TextChunker chunker;
    private final EmbeddingService embeddingService;
    private final TransactionTemplate transactionTemplate;

    public DocumentIngestionService(DocumentRepository documentRepository, DocumentChunkRepository chunkRepository,
                                    FileStorageService storage, DocumentTextExtractorService extractor,
                                    TextChunker chunker, EmbeddingService embeddingService,
                                    PlatformTransactionManager transactionManager) {
        this.documentRepository=documentRepository; this.chunkRepository=chunkRepository; this.storage=storage;
        this.extractor=extractor; this.chunker=chunker; this.embeddingService=embeddingService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Async("documentIngestionExecutor")
    public void queue(UUID tenantId, UUID documentId) { process(tenantId, documentId); }

    @Transactional
    public void markQueued(UUID tenantId, UUID documentId) {
        Document d = find(tenantId, documentId); d.setIngestionStatus(IngestionStatus.QUEUED); d.setIngestionError(null);
    }

    public void process(UUID tenantId, UUID documentId) {
        Document d = find(tenantId, documentId); int version = d.getVersion();
        try {
            markProcessing(tenantId, documentId);
            Resource resource = storage.loadAsResource(d.getStorageKey());
            byte[] bytes = resource.getInputStream().readAllBytes();
            List<String> chunks = chunker.split(extractor.extract(bytes, d.getOriginalFileName(), d.getMimeType()).text());
            if (chunks.isEmpty()) throw new IllegalArgumentException("Document contains no extractable text");
            replaceChunks(tenantId, documentId, version, chunks);
            markIndexed(tenantId, documentId, version, chunks.size());
        } catch (Exception e) { markFailed(tenantId, documentId, e.getMessage()); }
    }

    protected void markProcessing(UUID tenantId, UUID documentId) { Document d=find(tenantId,documentId); d.setIngestionStatus(IngestionStatus.PROCESSING); d.setIngestionError(null); documentRepository.save(d); }

    protected void replaceChunks(UUID tenantId, UUID documentId, int version, List<String> chunks) {
        // Never hold a database transaction open while waiting on an external embedding API.
        List<float[]> embeddings = embeddingService.embedDocuments(chunks);
        if (embeddings.size() != chunks.size()) {
            throw new IllegalStateException("Embedding provider returned an unexpected number of vectors");
        }

        transactionTemplate.executeWithoutResult(status -> {
            chunkRepository.deleteForDocument(documentId);
            for (int i=0;i<chunks.size();i++) {
                float[] embedding=embeddings.get(i);
                if (embedding.length != embeddingService.dimensions()) {
                    throw new IllegalStateException(
                            "Embedding dimension " + embedding.length +
                            " does not match configured dimension " + embeddingService.dimensions()
                    );
                }
                chunkRepository.insert(tenantId,documentId,version,i,chunks.get(i),estimateTokenCount(chunks.get(i)),embedding);
            }
        });
    }

    protected void markIndexed(UUID tenantId, UUID documentId, int version, int chunkCount) {
        Document d=find(tenantId,documentId);
        if (d.getVersion()!=version) throw new IllegalStateException("Document changed while it was being indexed; retry ingestion");
        d.setIngestionStatus(IngestionStatus.INDEXED); d.setIngestionError(null); d.setIndexedAt(Instant.now()); d.setIndexedChunkCount(chunkCount);
        documentRepository.save(d);
    }

    protected void markFailed(UUID tenantId, UUID documentId, String message) {
        Document d=find(tenantId,documentId); d.setIngestionStatus(IngestionStatus.FAILED);
        String error=message==null?"Ingestion failed":message; d.setIngestionError(error.substring(0,Math.min(error.length(),1900)));
        documentRepository.save(d);
    }

    @Transactional(readOnly=true)
    public DocumentIngestionResponse status(UUID tenantId, UUID documentId) {
        Document d=find(tenantId,documentId);
        return new DocumentIngestionResponse(d.getId(),d.getVersion(),d.getIngestionStatus(),d.getIndexedChunkCount(),d.getIndexedAt(),d.getIngestionError());
    }

    private Document find(UUID tenantId, UUID documentId) { return documentRepository.findByIdAndTenantId(documentId,tenantId).orElseThrow(() -> new IllegalArgumentException("Document not found")); }
    private int estimateTokenCount(String text) { return Math.max(1,text.trim().split("\\s+").length); }
}
