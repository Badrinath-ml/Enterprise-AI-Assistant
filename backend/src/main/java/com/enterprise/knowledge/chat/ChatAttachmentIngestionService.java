package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.document.IngestionStatus;
import com.enterprise.knowledge.document.ingestion.DocumentTextExtractorService;
import com.enterprise.knowledge.document.ingestion.EmbeddingService;
import com.enterprise.knowledge.document.ingestion.ExtractedDocument;
import com.enterprise.knowledge.document.ingestion.TextChunker;
import com.enterprise.knowledge.document.storage.FileStorageService;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.util.List;
import java.util.UUID;

/**
 * Indexes private chat attachments in a transaction separate from attachment metadata persistence.
 * Any failed chunk insert rolls back the complete chunk batch, allowing the caller to retain the
 * uploaded file and record a useful FAILED ingestion status without poisoning its transaction.
 */
@Service
public class ChatAttachmentIngestionService {
    private final ChatConversationAttachmentRepository attachments;
    private final DocumentTextExtractorService extractor;
    private final TextChunker chunker;
    private final EmbeddingService embeddings;
    private final FileStorageService storage;
    private final JdbcTemplate jdbc;

    public ChatAttachmentIngestionService(
            ChatConversationAttachmentRepository attachments,
            DocumentTextExtractorService extractor,
            TextChunker chunker,
            EmbeddingService embeddings,
            FileStorageService storage,
            JdbcTemplate jdbc) {
        this.attachments = attachments;
        this.extractor = extractor;
        this.chunker = chunker;
        this.embeddings = embeddings;
        this.storage = storage;
        this.jdbc = jdbc;
    }

    @Transactional
    public void index(UUID tenantId, UUID conversationId, UUID attachmentId, String storageKey,
                      String fileName, String mimeType) throws Exception {
        ChatConversationAttachment attachment = attachments.findByIdAndConversationId(attachmentId, conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Chat attachment not found"));

        Resource resource = storage.loadAsResource(storageKey);
        ExtractedDocument extracted;
        try (InputStream input = resource.getInputStream()) {
            extracted = extractor.extract(input, fileName, mimeType);
        }

        List<TextChunker.DocumentChunkItem> chunks = chunker.chunkPages(extracted.pages());
        if (chunks.isEmpty()) {
            throw new IllegalArgumentException("No extractable text found in file");
        }

        List<String> texts = chunks.stream().map(TextChunker.DocumentChunkItem::content).toList();
        List<float[]> vectors = embeddings.embedDocuments(texts);
        if (vectors.size() != chunks.size()) {
            throw new IllegalStateException("Embedding provider returned a different number of vectors than chunks");
        }

        for (int i = 0; i < chunks.size(); i++) {
            TextChunker.DocumentChunkItem chunk = chunks.get(i);
            float[] vector = vectors.get(i);
            if (vector == null || vector.length != embeddings.dimensions()) {
                throw new IllegalStateException("Embedding dimension mismatch: expected "
                        + embeddings.dimensions() + " but received "
                        + (vector == null ? 0 : vector.length));
            }

            jdbc.update("""
                    INSERT INTO chat_conversation_attachment_chunks
                    (id, tenant_id, conversation_id, attachment_id, chunk_index, content, token_count,
                     embedding, embedding_provider, embedding_model, embedding_dimensions, page_number, source_locator)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?::vector, ?, ?, ?, ?, ?)
                    """,
                    UUID.randomUUID(), tenantId, conversationId, attachmentId, chunk.chunkIndex(), chunk.content(),
                    chunk.tokenCount(), toVectorLiteral(vector), embeddings.provider(), embeddings.model(),
                    embeddings.dimensions(), chunk.pageNumber(), chunk.sourceLocator());
        }

        attachment.setIngestionStatus(IngestionStatus.INDEXED);
        attachment.setIngestionError(null);
        attachment.setIndexedChunkCount(chunks.size());
        attachments.save(attachment);
    }

    private String toVectorLiteral(float[] vector) {
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) builder.append(',');
            builder.append(Float.toString(vector[i]));
        }
        return builder.append(']').toString();
    }
}
