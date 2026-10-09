package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.ai.CrossEncoderRerankerService;
import com.enterprise.knowledge.document.ingestion.EmbeddingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Hybrid retrieval service:
 * 1. Dense vector retrieval (PostgreSQL + pgvector)
 * 2. Sparse keyword retrieval (PostgreSQL FTS BM25-style ranking)
 * 3. Candidate fusion via Reciprocal Rank Fusion (RRF)
 * 4. Cross-encoder semantic reranking
 * 5. Bounded context selection and thresholding
 */
@Service
public class ChatRetrievalService {
    private static final Logger log = LoggerFactory.getLogger(ChatRetrievalService.class);
    private static final int RRF_K = 60;

    private final JdbcTemplate jdbcTemplate;
    private final EmbeddingService embeddingService;
    private final CrossEncoderRerankerService rerankerService;
    private final double minimumSimilarity;
    private final int denseCandidateLimit;
    private final int sparseCandidateLimit;
    private final int fusionCandidateLimit;
    private final int defaultTopK;
    private final int maxContextTokens;

    @org.springframework.beans.factory.annotation.Autowired
    public ChatRetrievalService(
            JdbcTemplate jdbcTemplate,
            EmbeddingService embeddingService,
            CrossEncoderRerankerService rerankerService,
            @Value("${app.ai.retrieval.minimum-similarity:0.40}") double minimumSimilarity,
            @Value("${app.ai.retrieval.dense-candidates:15}") int denseCandidateLimit,
            @Value("${app.ai.retrieval.sparse-candidates:15}") int sparseCandidateLimit,
            @Value("${app.ai.retrieval.fusion-candidates:12}") int fusionCandidateLimit,
            @Value("${app.ai.retrieval.top-k:5}") int defaultTopK,
            @Value("${app.ai.retrieval.max-context-tokens:3500}") int maxContextTokens) {

        this.jdbcTemplate = jdbcTemplate;
        this.embeddingService = embeddingService;
        this.rerankerService = rerankerService;
        this.minimumSimilarity = minimumSimilarity;
        this.denseCandidateLimit = Math.max(5, denseCandidateLimit);
        this.sparseCandidateLimit = Math.max(5, sparseCandidateLimit);
        this.fusionCandidateLimit = Math.max(5, fusionCandidateLimit);
        this.defaultTopK = Math.max(1, defaultTopK);
        this.maxContextTokens = Math.max(500, maxContextTokens);
    }

    public ChatRetrievalService(
            JdbcTemplate jdbcTemplate,
            EmbeddingService embeddingService,
            double minimumSimilarity) {
        this(jdbcTemplate, embeddingService, null, minimumSimilarity, 15, 15, 12, 5, 3500);
    }

    public List<RetrievedChunk> retrieve(UUID tenantId, UUID departmentId, boolean admin,
                                         String query, int topK) {
        return retrieve(tenantId, departmentId, admin, null, query, topK);
    }

    public List<RetrievedChunk> retrieve(UUID tenantId, UUID departmentId, boolean admin,
                                         UUID conversationId, String query, int topK) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        int targetK = topK > 0 ? topK : defaultTopK;

        // 1. Dense vector candidate retrieval
        List<RetrievedChunk> denseCandidates = retrieveDenseCandidates(
                tenantId, departmentId, admin, conversationId, query, denseCandidateLimit
        );

        // 2. Sparse BM25 keyword candidate retrieval
        List<RetrievedChunk> sparseCandidates = retrieveSparseCandidates(
                tenantId, departmentId, admin, conversationId, query, sparseCandidateLimit
        );

        // 3. Reciprocal Rank Fusion (RRF) & deduplication
        List<RetrievedChunk> fusedCandidates = reciprocalRankFusion(
                denseCandidates, sparseCandidates, fusionCandidateLimit
        );

        if (fusedCandidates.isEmpty()) {
            log.info("RAG retrieval: 0 candidates found for query: {}", query);
            return List.of();
        }

        // 4. Cross-Encoder Reranking
        List<RetrievedChunk> rerankedCandidates = applyCrossEncoderReranking(query, fusedCandidates);

        // 5. Threshold filtering and bounded context selection
        List<RetrievedChunk> boundedResults = selectBoundedContext(rerankedCandidates, targetK);

        log.info("Hybrid retrieval complete: dense={}, sparse={}, fused={}, reranked={}, returned={}, topScore={}, query={}",
                denseCandidates.size(), sparseCandidates.size(), fusedCandidates.size(),
                rerankedCandidates.size(), boundedResults.size(),
                boundedResults.isEmpty() ? null : boundedResults.getFirst().similarity(),
                query);

        return boundedResults;
    }

    private List<RetrievedChunk> retrieveDenseCandidates(
            UUID tenantId, UUID departmentId, boolean admin, UUID conversationId,
            String query, int limit) {

        float[] vector;
        try {
            vector = embeddingService.embedQuery(query);
        } catch (Exception e) {
            log.warn("Dense retrieval skipped — embedding service unavailable: {}", e.getMessage());
            return List.of();
        }
        String vectorLiteral = toVectorLiteral(vector);

        String sql = """
                SELECT c.id AS chunk_id, c.document_id, c.document_version, c.chunk_index,
                       c.content, c.page_number, c.source_locator,
                       d.title, d.original_file_name, d.mime_type,
                       1 - (c.embedding <=> ?::vector) AS similarity,
                       false AS is_private
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

        List<Object> params = new ArrayList<>();
        params.add(vectorLiteral);
        params.add(tenantId);
        params.add(tenantId);
        params.add(embeddingService.provider());
        params.add(embeddingService.model());
        params.add(embeddingService.dimensions());

        if (!admin) {
            if (departmentId != null) {
                sql += " AND (d.department_id IS NULL OR d.department_id = ?)";
                params.add(departmentId);
            } else {
                sql += " AND d.department_id IS NULL";
            }
        }

        sql += " ORDER BY c.embedding <=> ?::vector LIMIT ?";
        params.add(vectorLiteral);
        params.add(limit);

        List<RetrievedChunk> chunks = new ArrayList<>(jdbcTemplate.query(sql, params.toArray(), (rs, rowNum) -> new RetrievedChunk(
                rs.getObject("chunk_id", UUID.class),
                rs.getObject("document_id", UUID.class),
                rs.getInt("document_version"),
                rs.getInt("chunk_index"),
                rs.getString("content"),
                rs.getObject("page_number", Integer.class),
                rs.getString("source_locator"),
                rs.getString("title"),
                rs.getString("original_file_name"),
                rs.getString("mime_type"),
                rs.getDouble("similarity"),
                null,
                false
        )));

        // If conversation has private attachments, query private attachment chunks as well
        if (conversationId != null) {
            try {
                String privateSql = """
                        SELECT c.id AS chunk_id, c.attachment_id AS document_id, 1 AS document_version, c.chunk_index,
                               c.content, c.page_number, c.source_locator,
                               a.file_name AS title, a.file_name AS original_file_name, a.mime_type,
                               1 - (c.embedding <=> ?::vector) AS similarity,
                               true AS is_private
                        FROM chat_conversation_attachment_chunks c
                        JOIN chat_conversation_attachments a ON a.id = c.attachment_id
                        WHERE c.conversation_id = ?
                          AND c.tenant_id = ?
                        ORDER BY c.embedding <=> ?::vector LIMIT ?
                    """;
                List<RetrievedChunk> privateChunks = jdbcTemplate.query(
                        privateSql,
                        new Object[]{vectorLiteral, conversationId, tenantId, vectorLiteral, limit},
                        (rs, rowNum) -> new RetrievedChunk(
                                rs.getObject("chunk_id", UUID.class),
                                rs.getObject("document_id", UUID.class),
                                rs.getInt("document_version"),
                                rs.getInt("chunk_index"),
                                rs.getString("content"),
                                rs.getObject("page_number", Integer.class),
                                rs.getString("source_locator"),
                                rs.getString("title"),
                                rs.getString("original_file_name"),
                                rs.getString("mime_type"),
                                rs.getDouble("similarity"),
                                null,
                                true
                        )
                );
                chunks.addAll(privateChunks);
            } catch (Exception e) {
                log.debug("Private attachment chunks query skipped or failed: {}", e.getMessage());
            }
        }

        chunks.sort(Comparator.comparingDouble(RetrievedChunk::similarity).reversed());
        return chunks.stream().limit(limit).toList();
    }

    private List<RetrievedChunk> retrieveSparseCandidates(
            UUID tenantId, UUID departmentId, boolean admin, UUID conversationId,
            String query, int limit) {

        String cleaned = query.replaceAll("[^a-zA-Z0-9\\s]", " ").trim();
        if (cleaned.isBlank()) {
            return List.of();
        }

        String sql = """
                SELECT c.id AS chunk_id, c.document_id, c.document_version, c.chunk_index,
                       c.content, c.page_number, c.source_locator,
                       d.title, d.original_file_name, d.mime_type,
                       ts_rank_cd(to_tsvector('english', c.content), websearch_to_tsquery('english', ?)) AS bm25_score,
                       false AS is_private
                FROM document_chunks c
                JOIN documents d ON d.id = c.document_id
                WHERE c.tenant_id = ?
                  AND d.tenant_id = ?
                  AND d.status = 'APPROVED'
                  AND d.ingestion_status = 'INDEXED'
                  AND c.document_version = d.version
                  AND to_tsvector('english', c.content) @@ websearch_to_tsquery('english', ?)
            """;

        List<Object> params = new ArrayList<>();
        params.add(cleaned);
        params.add(tenantId);
        params.add(tenantId);
        params.add(cleaned);

        if (!admin) {
            if (departmentId != null) {
                sql += " AND (d.department_id IS NULL OR d.department_id = ?)";
                params.add(departmentId);
            } else {
                sql += " AND d.department_id IS NULL";
            }
        }

        sql += " ORDER BY bm25_score DESC LIMIT ?";
        params.add(limit);

        try {
            List<RetrievedChunk> chunks = new ArrayList<>(jdbcTemplate.query(sql, params.toArray(), (rs, rowNum) -> new RetrievedChunk(
                    rs.getObject("chunk_id", UUID.class),
                    rs.getObject("document_id", UUID.class),
                    rs.getInt("document_version"),
                    rs.getInt("chunk_index"),
                    rs.getString("content"),
                    rs.getObject("page_number", Integer.class),
                    rs.getString("source_locator"),
                    rs.getString("title"),
                    rs.getString("original_file_name"),
                    rs.getString("mime_type"),
                    rs.getDouble("bm25_score"),
                    null,
                    false
            )));

            if (conversationId != null) {
                try {
                    String privateSql = """
                            SELECT c.id AS chunk_id, c.attachment_id AS document_id, 1 AS document_version, c.chunk_index,
                                   c.content, c.page_number, c.source_locator,
                                   a.file_name AS title, a.file_name AS original_file_name, a.mime_type,
                                   ts_rank_cd(to_tsvector('english', c.content), websearch_to_tsquery('english', ?)) AS bm25_score,
                                   true AS is_private
                            FROM chat_conversation_attachment_chunks c
                            JOIN chat_conversation_attachments a ON a.id = c.attachment_id
                            WHERE c.conversation_id = ?
                              AND c.tenant_id = ?
                              AND to_tsvector('english', c.content) @@ websearch_to_tsquery('english', ?)
                            ORDER BY bm25_score DESC LIMIT ?
                        """;
                    List<RetrievedChunk> privateChunks = jdbcTemplate.query(
                            privateSql,
                            new Object[]{cleaned, conversationId, tenantId, cleaned, limit},
                            (rs, rowNum) -> new RetrievedChunk(
                                    rs.getObject("chunk_id", UUID.class),
                                    rs.getObject("document_id", UUID.class),
                                    rs.getInt("document_version"),
                                    rs.getInt("chunk_index"),
                                    rs.getString("content"),
                                    rs.getObject("page_number", Integer.class),
                                    rs.getString("source_locator"),
                                    rs.getString("title"),
                                    rs.getString("original_file_name"),
                                    rs.getString("mime_type"),
                                    rs.getDouble("bm25_score"),
                                    null,
                                    true
                            )
                    );
                    chunks.addAll(privateChunks);
                } catch (Exception ignored) {}
            }

            chunks.sort(Comparator.comparingDouble(RetrievedChunk::similarity).reversed());
            return chunks.stream().limit(limit).toList();
        } catch (Exception e) {
            log.debug("Sparse BM25 retrieval failed or query has no fulltext matches: {}", e.getMessage());
            return List.of();
        }
    }

    private List<RetrievedChunk> reciprocalRankFusion(
            List<RetrievedChunk> dense, List<RetrievedChunk> sparse, int limit) {

        Map<UUID, Double> rrfScores = new LinkedHashMap<>();
        Map<UUID, RetrievedChunk> chunkMap = new LinkedHashMap<>();

        for (int rank = 0; rank < dense.size(); rank++) {
            RetrievedChunk chunk = dense.get(rank);
            chunkMap.putIfAbsent(chunk.chunkId(), chunk);
            rrfScores.put(chunk.chunkId(), rrfScores.getOrDefault(chunk.chunkId(), 0.0) + (1.0 / (RRF_K + rank + 1)));
        }

        for (int rank = 0; rank < sparse.size(); rank++) {
            RetrievedChunk chunk = sparse.get(rank);
            chunkMap.putIfAbsent(chunk.chunkId(), chunk);
            rrfScores.put(chunk.chunkId(), rrfScores.getOrDefault(chunk.chunkId(), 0.0) + (1.0 / (RRF_K + rank + 1)));
        }

        List<Map.Entry<UUID, Double>> sorted = new ArrayList<>(rrfScores.entrySet());
        sorted.sort(Map.Entry.<UUID, Double>comparingByValue().reversed());

        List<RetrievedChunk> result = new ArrayList<>();
        for (int i = 0; i < Math.min(limit, sorted.size()); i++) {
            UUID id = sorted.get(i).getKey();
            result.add(chunkMap.get(id));
        }
        return result;
    }

    private List<RetrievedChunk> applyCrossEncoderReranking(String query, List<RetrievedChunk> candidates) {
        if (candidates.isEmpty() || rerankerService == null) {
            return candidates;
        }

        List<String> docs = candidates.stream().map(RetrievedChunk::content).toList();
        List<Double> scores = rerankerService.rerank(query, docs);

        List<RetrievedChunk> reranked = new ArrayList<>(candidates.size());
        for (int i = 0; i < candidates.size(); i++) {
            RetrievedChunk c = candidates.get(i);
            Double score = (scores != null && i < scores.size()) ? scores.get(i) : c.similarity();
            // Normalize score into [0, 1] range for citation display
            double displayConfidence = normalizeScore(score, c.similarity());
            reranked.add(new RetrievedChunk(
                    c.chunkId(), c.documentId(), c.documentVersion(), c.chunkIndex(),
                    c.content(), c.pageNumber(), c.locatorLabel(),
                    c.title(), c.fileName(), c.mimeType(),
                    displayConfidence, score, c.isPrivateAttachment()
            ));
        }

        reranked.sort(Comparator.comparingDouble(RetrievedChunk::similarity).reversed());
        return reranked;
    }

    private double normalizeScore(Double rerankScore, double originalSim) {
        if (rerankScore != null) {
            // Sigmoid mapping for CrossEncoder logit scores
            double sigmoid = 1.0 / (1.0 + Math.exp(-rerankScore));
            return Math.max(0.0, Math.min(1.0, sigmoid));
        }
        return Math.max(0.0, Math.min(1.0, originalSim));
    }

    private List<RetrievedChunk> selectBoundedContext(List<RetrievedChunk> candidates, int targetK) {
        List<RetrievedChunk> selected = new ArrayList<>();
        int approxChars = 0;
        int maxChars = maxContextTokens * 4;

        for (RetrievedChunk chunk : candidates) {
            if (chunk.similarity() < minimumSimilarity) {
                continue;
            }
            if (selected.size() >= targetK) {
                break;
            }
            int contentLen = chunk.content() != null ? chunk.content().length() : 0;
            if (approxChars + contentLen > maxChars && !selected.isEmpty()) {
                break;
            }
            selected.add(chunk);
            approxChars += contentLen;
        }

        return selected;
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
            String title, String fileName, String mimeType, double similarity,
            Double rerankScore, boolean isPrivateAttachment
    ) {
        public RetrievedChunk(UUID chunkId, UUID documentId, int documentVersion, int chunkIndex,
                              String content, Integer pageNumber, String locatorLabel,
                              String title, String fileName, String mimeType, double similarity) {
            this(chunkId, documentId, documentVersion, chunkIndex, content, pageNumber, locatorLabel,
                 title, fileName, mimeType, similarity, null, false);
        }
    }
}
