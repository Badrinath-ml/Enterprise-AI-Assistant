package com.enterprise.knowledge.document.ingestion;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
// Not @Service — GoogleEmbeddingService is the active EmbeddingService (see EmbeddingConfiguration).
// This class is kept for local/offline fallback. To activate it, remove @Primary from EmbeddingConfiguration.

import org.springframework.web.client.RestClient;

import java.io.File;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Sentence Transformers embedding implementation.
 *
 * Connects to the local embedding service endpoint, with bounded batching,
 * dimension validation, empty text handling, and automatic retry.
 */
public class SentenceTransformersEmbeddingService implements EmbeddingService {
    private static final Logger log = LoggerFactory.getLogger(SentenceTransformersEmbeddingService.class);

    private final RestClient restClient;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String serviceUrl;
    private final String model;
    private final int dimensions;
    private final int batchSize;
    private final int maxRetries;

    public SentenceTransformersEmbeddingService(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${app.ai.embedding.service-url:http://127.0.0.1:8001}") String serviceUrl,
            @Value("${app.ai.embedding.model:all-mpnet-base-v2}") String model,
            @Value("${app.ai.embedding.dimensions:768}") int dimensions,
            @Value("${app.ai.embedding.batch-size:32}") int batchSize,
            @Value("${app.ai.embedding.max-retries:3}") int maxRetries) {

        this.objectMapper = objectMapper;
        this.serviceUrl = serviceUrl.endsWith("/") ? serviceUrl.substring(0, serviceUrl.length() - 1) : serviceUrl;
        this.model = model;
        this.dimensions = dimensions;
        this.batchSize = Math.max(1, batchSize);
        this.maxRetries = Math.max(1, maxRetries);

        this.restClient = restClientBuilder
                .baseUrl(this.serviceUrl)
                .defaultHeader("Content-Type", "application/json")
                .build();

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        ensureServiceRunning();
    }

    private void ensureServiceRunning() {
        try {
            JsonNode health = restClient.get()
                    .uri("/health")
                    .retrieve()
                    .body(JsonNode.class);
            if (health != null && "UP".equals(health.path("status").asString())) {
                log.info("Sentence Transformers embedding service is active at {} (model: {}, dim: {})",
                        serviceUrl, health.path("model").asString(), health.path("dimensions").asInt());
            }
        } catch (Exception e) {
            log.debug("Local embedding service at {} is not running: {}", serviceUrl, e.getMessage());
        }
    }

    /**
     * Spawns the Python embedding sidecar and polls for readiness in a background daemon thread.
     * Loading sentence-transformer models can take 30-60 s, so we must not block the main startup thread.
     * The backend starts immediately; embedding requests will retry/wait until the sidecar is healthy.
     */
    private void startAndWaitInBackground() {
        Thread t = new Thread(() -> {
            try {
                Path scriptPath = Paths.get("scripts", "embedding_service.py").toAbsolutePath();
                if (!Files.exists(scriptPath)) {
                    scriptPath = Paths.get("backend", "scripts", "embedding_service.py").toAbsolutePath();
                }
                if (!Files.exists(scriptPath)) {
                    log.warn("embedding_service.py not found — start the embedding sidecar manually before ingesting documents.");
                    return;
                }

                String pythonExe = findPython();
                ProcessBuilder pb = new ProcessBuilder(pythonExe, scriptPath.toString());
                pb.redirectErrorStream(true);
                pb.directory(scriptPath.getParent().getParent().toFile());
                Process proc = pb.start();
                log.info("Embedding sidecar launched (PID: {}). Waiting up to 120 s for models to load...", proc.pid());

                // Poll until healthy — models can take 30-60 s to load
                for (int i = 0; i < 120; i++) {
                    Thread.sleep(1000);
                    try {
                        JsonNode health = restClient.get().uri("/health").retrieve().body(JsonNode.class);
                        if (health != null && "UP".equals(health.path("status").asString())) {
                            log.info("Embedding sidecar ready at {} (model: {}, dim: {})",
                                    serviceUrl, health.path("model").asString(), health.path("dimensions").asInt());
                            return;
                        }
                    } catch (Exception ignored) {}
                }
                log.warn("Embedding sidecar did not become healthy within 120 s. Start it manually: python scripts/embedding_service.py");
            } catch (Exception ex) {
                log.warn("Unable to auto-start embedding sidecar: {}", ex.getMessage());
            }
        }, "embedding-sidecar-starter");
        t.setDaemon(true);
        t.start();
    }

    private String findPython() {
        String[] candidates = {
                "C:\\Users\\badri\\AppData\\Local\\Programs\\Python\\Python311\\python.exe",
                "python",
                "python3"
        };
        for (String c : candidates) {
            if (new File(c).exists()) return c;
        }
        return "python";
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
            result.addAll(batchEmbedWithRetry(batch));
        }
        return result;
    }

    @Override
    public float[] embedQuery(String query) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Query text cannot be blank for embedding");
        }
        List<float[]> vectors = batchEmbedWithRetry(List.of(query.trim()));
        if (vectors.isEmpty()) {
            throw new IllegalStateException("Embedding service returned no vector for query");
        }
        return vectors.getFirst();
    }

    private List<float[]> batchEmbedWithRetry(List<String> texts) {
        List<String> cleanTexts = texts.stream()
                .map(t -> (t == null || t.isBlank()) ? " " : t.trim())
                .toList();

        Exception lastException = null;
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                String jsonBody = objectMapper.writeValueAsString(Map.of("texts", cleanTexts));

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(serviceUrl + "/embed"))
                        .timeout(Duration.ofSeconds(30))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new IllegalStateException("Embedding service returned HTTP " +
                            response.statusCode() + ": " + response.body());
                }

                JsonNode root = objectMapper.readTree(response.body());

                int respDimensions = root.path("dimensions").asInt(0);
                if (respDimensions > 0 && respDimensions != this.dimensions) {
                    throw new IllegalStateException("Embedding response dimension (" + respDimensions +
                            ") does not match configured pgvector column dimension (" + this.dimensions + ")");
                }

                JsonNode embeddingsNode = root.get("embeddings");
                if (embeddingsNode == null || !embeddingsNode.isArray() || embeddingsNode.size() != cleanTexts.size()) {
                    throw new IllegalStateException("Embedding response length does not match input batch size");
                }

                List<float[]> vectors = new ArrayList<>(embeddingsNode.size());
                for (JsonNode vectorNode : embeddingsNode) {
                    if (!vectorNode.isArray() || vectorNode.size() != this.dimensions) {
                        throw new IllegalStateException("Vector dimension (" + vectorNode.size() +
                                ") does not match required dimensions (" + this.dimensions + ")");
                    }

                    float[] vec = new float[this.dimensions];
                    for (int i = 0; i < this.dimensions; i++) {
                        vec[i] = (float) vectorNode.get(i).asDouble();
                    }
                    vectors.add(vec);
                }
                return vectors;

            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Embedding request interrupted", ie);
            } catch (Exception e) {
                lastException = e;
                log.warn("Embedding batch attempt {}/{} failed: {}", attempt, maxRetries, e.getMessage());
                if (attempt < maxRetries) {
                    try {
                        Thread.sleep(attempt * 500L);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException("Embedding retry interrupted", ie);
                    }
                }
            }
        }

        throw new IllegalStateException("Embedding batch failed after " + maxRetries + " attempts: " +
                (lastException != null ? lastException.getMessage() : "Unknown error"), lastException);
    }

    @Override
    public String provider() {
        return "sentence-transformers";
    }

    @Override
    public String model() {
        return model;
    }

    @Override
    public int dimensions() {
        return dimensions;
    }
}
