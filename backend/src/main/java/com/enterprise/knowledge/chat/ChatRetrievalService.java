package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.document.ingestion.EmbeddingService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.UUID;

@Service
public class ChatRetrievalService {
    private static final Logger log = LoggerFactory.getLogger(ChatRetrievalService.class);
    private final JdbcTemplate jdbcTemplate;
    private final EmbeddingService embeddingService;
    private final double minimumSimilarity;

    public ChatRetrievalService(
            JdbcTemplate jdbcTemplate,
            EmbeddingService embeddingService,
            @Value("${app.ai.retrieval.minimum-similarity:0.20}") double minimumSimilarity) {
        this.jdbcTemplate = jdbcTemplate;
        this.embeddingService = embeddingService;
        this.minimumSimilarity = minimumSimilarity;
    }

    public List<RetrievedChunk> retrieve(UUID tenantId, UUID departmentId, boolean admin,
                                         String query, int topK) {
        float[] vector = embeddingService.embedQuery(query);
        String literal = toVectorLiteral(vector);
        String sql = """
                SELECT c.id AS chunk_id, c.document_id, c.document_version, c.chunk_index,
                       c.content, c.page_number, c.source_locator,
                       d.title, d.original_file_name, d.mime_type,
                       1 - (c.embedding <=> ?::vector) AS similarity
                FROM document_chunks c
                JOIN documents d ON d.id = c.document_id
                WHERE c.tenant_id = ?
                  AND d.tenant_id = ?
                  AND d.status = 'APPROVED'
                  AND d.ingestion_status = 'INDEXED'
                  AND c.document_version = d.version
                  AND c.embedding_provider = ?
                  AND c.embedding_model = ?
                  AND c.embedding_dimensions = ?
            """;
        Object[] params;
        if (admin) {
            sql += " ORDER BY c.embedding <=> ?::vector LIMIT ?";
            params = new Object[]{literal, tenantId, tenantId, embeddingService.provider(),
                    embeddingService.model(), embeddingService.dimensions(), literal, topK};
        } else {
            if (departmentId == null) return List.of();
            sql += " AND (d.department_id IS NULL OR d.department_id = ?)";
            sql += " ORDER BY c.embedding <=> ?::vector LIMIT ?";
            params = new Object[]{literal, tenantId, tenantId, embeddingService.provider(),
                    embeddingService.model(), embeddingService.dimensions(), departmentId, literal, topK};
        }
        List<RetrievedChunk> candidates = jdbcTemplate.query(sql, params, (rs, rowNum) -> new RetrievedChunk(
                rs.getObject("chunk_id", UUID.class),
                rs.getObject("document_id", UUID.class),
                rs.getInt("document_version"),
                rs.getInt("chunk_index"),
                rs.getString("content"),
                rs.getInt("page_number"),
                rs.getString("source_locator"),
                rs.getString("title"),
                rs.getString("original_file_name"),
                rs.getString("mime_type"),
                rs.getDouble("similarity")
        ));

        log.info("RAG retrieval: admin={}, department={}, candidates={}, threshold={}, topSimilarity={}, query={}",
                admin, departmentId, candidates.size(), minimumSimilarity,
                candidates.isEmpty() ? null : candidates.get(0).similarity(),
                query);

        return candidates.stream().filter(c -> c.similarity() >= minimumSimilarity).toList();
    }

    private String toVectorLiteral(float[] vector) {
        StringBuilder b = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) b.append(',');
            b.append(Float.toString(vector[i]));
        }
        return b.append(']').toString();
    }

    public record RetrievedChunk(
            UUID chunkId, UUID documentId, int documentVersion, int chunkIndex,
            String content, Integer pageNumber, String locatorLabel,
            String title, String fileName, String mimeType, double similarity
    ) {}
}
