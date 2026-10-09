package com.enterprise.knowledge.document.ingestion;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Google Generative AI embedding implementation using text-embedding-004.
 *
 * Uses the REST API directly (no SDK needed). text-embedding-004 outputs 768-dimensional
 * vectors — matches the existing pgvector column exactly.
 *
 * API docs: https://ai.google.dev/api/embeddings
 */
@Service
@Primary
public class GoogleEmbeddingService implements EmbeddingService {
    private static final Logger log = LoggerFactory.getLogger(GoogleEmbeddingService.class);

    private static final String BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
    private static final int DIMENSIONS = 768;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final int batchSize;
    private final int maxRetries;

    public GoogleEmbeddingService(
            ObjectMapper objectMapper,
            @Value("${app.ai.google.api-key:${GOOGLE_API_KEY:}}") String apiKey,
            @Value("${app.ai.google.embedding-model:${EMBEDDING_MODEL:gemini-embedding-2}}") String model,
            @Value("${app.ai.embedding.batch-size:100}") int batchSize,
            @Value("${app.ai.embedding.max-retries:3}") int maxRetries) {

        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = (model == null || model.isBlank()) ? "gemini-embedding-2" : model.trim();
        this.batchSize = Math.max(1, batchSize);
        this.maxRetries = Math.max(1, maxRetries);

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        if (apiKey == null || apiKey.isBlank()) {
            log.warn("GOOGLE_API_KEY is not set — Google embedding service will fail at runtime. Set it in .env.");
        } else {
            log.info("Google embedding service configured (model: {}, dim: {})", this.model, DIMENSIONS);
        }
    }

    @Override
    public List<float[]> embedDocuments(List<String> texts) {
        if (texts == null || texts.isEmpty()) {
            return List.of();
        }

        List<float[]> result = new ArrayList<>(texts.size());
        for (int start = 0; start < texts.size(); start += batchSize) {
            int end = Math.min(start + batchSize, texts.size());
            List<String> batch = texts.subList(start, end);
            result.addAll(batchEmbed(batch, "RETRIEVAL_DOCUMENT"));
        }
        return result;
    }

    @Override
    public float[] embedQuery(String query) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Query text cannot be blank for embedding");
        }
        List<float[]> vectors = batchEmbed(List.of(query.trim()), "RETRIEVAL_QUERY");
        if (vectors.isEmpty()) {
            throw new IllegalStateException("Google embedding service returned no vector for query");
        }
        return vectors.getFirst();
    }

    /**
     * Calls the batchEmbedContents endpoint which handles up to 100 texts per request.
     * taskType improves retrieval quality — RETRIEVAL_DOCUMENT for chunks, RETRIEVAL_QUERY for queries.
     * outputDimensionality ensures exactly 768 dimensions matching pgvector vector(768).
     */
    private List<float[]> batchEmbed(List<String> texts, String taskType) {
        List<String> cleanTexts = texts.stream()
                .map(t -> (t == null || t.isBlank()) ? " " : t.trim())
                .toList();

        String apiModel = resolveApiModel(model);
        Exception lastException = null;
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Build requests array for batchEmbedContents
                List<Map<String, Object>> requests = cleanTexts.stream()
                        .map(text -> (Map<String, Object>) Map.of(
                                "model", "models/" + apiModel,
                                "content", Map.of("parts", List.of(Map.of("text", text))),
                                "taskType", taskType,
                                "outputDimensionality", DIMENSIONS
                        ))
                        .toList();

                String jsonBody = objectMapper.writeValueAsString(Map.of("requests", requests));

                String url = BASE_URL + "/" + apiModel + ":batchEmbedContents?key=" + apiKey;

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(30))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new IllegalStateException("Google Embedding API returned HTTP "
                            + response.statusCode() + ": " + response.body());
                }

                JsonNode root = objectMapper.readTree(response.body());
                JsonNode embeddingsNode = root.get("embeddings");

                if (embeddingsNode == null || !embeddingsNode.isArray()) {
                    throw new IllegalStateException("Google Embedding API response missing 'embeddings' field");
                }
                if (embeddingsNode.size() != cleanTexts.size()) {
                    throw new IllegalStateException("Google Embedding API returned " + embeddingsNode.size()
                            + " embeddings for " + cleanTexts.size() + " input texts");
                }

                List<float[]> vectors = new ArrayList<>(embeddingsNode.size());
                for (JsonNode embNode : embeddingsNode) {
                    JsonNode valuesNode = embNode.get("values");
                    if (valuesNode == null || !valuesNode.isArray()) {
                        throw new IllegalStateException("Google Embedding API: embedding missing 'values' array");
                    }
                    if (valuesNode.size() != DIMENSIONS) {
                        throw new IllegalStateException("Google Embedding API returned " + valuesNode.size()
                                + " dimensions but expected " + DIMENSIONS);
                    }
                    float[] vec = new float[DIMENSIONS];
                    for (int i = 0; i < DIMENSIONS; i++) {
                        vec[i] = (float) valuesNode.get(i).asDouble();
                    }
                    vectors.add(vec);
                }
                return vectors;

            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Google Embedding request interrupted", ie);
            } catch (Exception e) {
                lastException = e;
                log.warn("Google Embedding attempt {}/{} failed: {}", attempt, maxRetries, e.getMessage());
                if (attempt < maxRetries) {
                    try {
                        Thread.sleep(attempt * 500L);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException("Retry interrupted", ie);
                    }
                }
            }
        }

        throw new IllegalStateException("Google Embedding failed after " + maxRetries + " attempts: "
                + (lastException != null ? lastException.getMessage() : "unknown error"), lastException);
    }

    /**
     * Resolves human/config aliases (e.g. "google-embedding-2", "google-embedding -2")
     * to the exact Google Generative Language API model identifier ("gemini-embedding-2").
     */
    private String resolveApiModel(String modelName) {
        if (modelName == null || modelName.isBlank()) {
            return "gemini-embedding-2";
        }
        String clean = modelName.trim().replaceAll("[\\s_-]+", "-").toLowerCase();
        if (clean.contains("google-embedding-2") || clean.contains("gemini-embedding-2")) {
            return "gemini-embedding-2";
        }
        return modelName.trim();
    }

    @Override
    public String provider() {
        return "google";
    }

    @Override
    public String model() {
        return model;
    }

    @Override
    public int dimensions() {
        return DIMENSIONS;
    }
}
