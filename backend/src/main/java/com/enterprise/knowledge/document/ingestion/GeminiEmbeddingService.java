package com.enterprise.knowledge.document.ingestion;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;

/**
 * Gemini Embedding 2 integration.
 *
 * Uses 768 dimensions so the existing pgvector vector(768) schema remains unchanged.
 * The model is explicitly formatted for asymmetric retrieval:
 *   documents -> title/text structure
 *   queries   -> search-result task instruction
 */
@Service
public class GeminiEmbeddingService implements EmbeddingService {
    private static final int DIMENSIONS = 768;
    private static final int BATCH_SIZE = 32;

    private final RestClient client;
    private final ObjectMapper objectMapper;
    private final String model;

    public GeminiEmbeddingService(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${app.ai.gemini.api-key:}") String apiKey,
            @Value("${app.ai.embedding.model:gemini-embedding-2}") String model) {

        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("GEMINI_API_KEY is required for Gemini embeddings");
        }

        this.objectMapper = objectMapper;
        this.model = model;
        this.client = restClientBuilder
                .baseUrl("https://generativelanguage.googleapis.com")
                .defaultHeader("x-goog-api-key", apiKey)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public List<float[]> embedDocuments(List<String> texts) {
        if (texts == null || texts.isEmpty()) return List.of();

        List<float[]> result = new ArrayList<>(texts.size());
        for (int start = 0; start < texts.size(); start += BATCH_SIZE) {
            int end = Math.min(start + BATCH_SIZE, texts.size());
            result.addAll(batchEmbed(
                    texts.subList(start, end),
                    false
            ));
        }
        return result;
    }

    @Override
    public float[] embedQuery(String query) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Embedding query cannot be blank");
        }

        return batchEmbed(List.of(query), true).getFirst();
    }

    private List<float[]> batchEmbed(List<String> texts, boolean query) {
        List<Object> requests = new ArrayList<>(texts.size());

        for (String text : texts) {
            String prepared = query
                    ? "task: search result | query: " + text
                    : "title: none | text: " + text;

            requests.add(new EmbedRequest(
                    "models/" + model,
                    new Content(new Part(prepared))
            ));
        }

        try {
            JsonNode root = client.post()
                    .uri("/v1beta/models/{model}:batchEmbedContents", model)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new BatchEmbedRequest(requests))
                    .retrieve()
                    .body(JsonNode.class);

            JsonNode embeddings = root == null ? null : root.get("embeddings");
            if (embeddings == null || !embeddings.isArray() || embeddings.size() != texts.size()) {
                throw new IllegalStateException("Gemini returned an unexpected embedding response");
            }

            List<float[]> vectors = new ArrayList<>(embeddings.size());
            for (JsonNode embedding : embeddings) {
                JsonNode values = embedding.get("values");
                if (values == null || !values.isArray() || values.size() != DIMENSIONS) {
                    throw new IllegalStateException(
                            "Gemini embedding dimension does not match pgvector dimension " + DIMENSIONS
                    );
                }

                float[] vector = new float[DIMENSIONS];
                for (int i = 0; i < DIMENSIONS; i++) {
                    vector[i] = (float) values.get(i).asDouble();
                }
                vectors.add(vector);
            }
            return vectors;
        } catch (RuntimeException e) {
            throw new IllegalStateException("Gemini embedding request failed: " + safeMessage(e), e);
        }
    }

    private String safeMessage(Exception e) {
        String message = e.getMessage();
        return message == null || message.isBlank() ? e.getClass().getSimpleName() : message;
    }

    @Override
    public String provider() {
        return "gemini";
    }

    @Override
    public String model() {
        return model;
    }

    @Override
    public int dimensions() {
        return DIMENSIONS;
    }

    private record BatchEmbedRequest(List<Object> requests) {}
    private record EmbedRequest(String model, Content content) {}
    private record Content(Part parts) {}
    private record Part(String text) {}
}
