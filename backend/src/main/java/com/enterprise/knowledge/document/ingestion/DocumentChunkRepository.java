package com.enterprise.knowledge.document.ingestion;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public class DocumentChunkRepository {
    private final JdbcTemplate jdbcTemplate;

    public DocumentChunkRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void deleteForDocument(UUID documentId) {
        jdbcTemplate.update("DELETE FROM document_chunks WHERE document_id = ?", documentId);
    }

    public void deleteForDocumentVersion(UUID documentId, int version) {
        jdbcTemplate.update("DELETE FROM document_chunks WHERE document_id = ? AND document_version = ?", documentId, version);
    }

    public int countForDocumentVersion(UUID documentId, int version) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM document_chunks WHERE document_id = ? AND document_version = ?",
                Integer.class, documentId, version);
        return count == null ? 0 : count;
    }

    public void insert(UUID id, UUID tenantId, UUID documentId, int version, int index, String content,
                       int tokenCount, float[] embedding, String provider, String model,
                       Integer pageNumber, String sourceLocator) {
        jdbcTemplate.update("""
                INSERT INTO document_chunks
                (id, tenant_id, document_id, document_version, chunk_index, content, token_count,
                 embedding, embedding_provider, embedding_model, embedding_dimensions,
                 page_number, source_locator)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?::vector, ?, ?, ?, ?, ?)
                """,
                id, tenantId, documentId, version, index, content, tokenCount,
                toVectorLiteral(embedding), provider, model, embedding.length,
                pageNumber, sourceLocator);
    }

    public void insert(UUID tenantId, UUID documentId, int version, int index, String content,
                       int tokenCount, float[] embedding, String provider, String model,
                       Integer pageNumber, String sourceLocator) {
        insert(UUID.randomUUID(), tenantId, documentId, version, index, content,
                tokenCount, embedding, provider, model, pageNumber, sourceLocator);
    }

    private String toVectorLiteral(float[] embedding) {
        StringBuilder b = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) b.append(',');
            b.append(Float.toString(embedding[i]));
        }
        return b.append(']').toString();
    }
}
