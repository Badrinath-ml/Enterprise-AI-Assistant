package com.enterprise.knowledge.ai;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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

@Service
public class SentenceTransformersRerankerService implements CrossEncoderRerankerService {
    private static final Logger log = LoggerFactory.getLogger(SentenceTransformersRerankerService.class);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final String model;

    public SentenceTransformersRerankerService(
            ObjectMapper objectMapper,
            @Value("${app.ai.embedding.service-url:http://127.0.0.1:8001}") String serviceUrl,
            @Value("${app.ai.reranker.model:cross-encoder/ms-marco-MiniLM-L-6-v2}") String model) {

        this.objectMapper = objectMapper;
        this.model = model;
        this.baseUrl = serviceUrl.endsWith("/") ? serviceUrl.substring(0, serviceUrl.length() - 1) : serviceUrl;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public List<Double> rerank(String query, List<String> documents) {
        if (query == null || documents == null || documents.isEmpty()) {
            return List.of();
        }

        try {
            String jsonBody = objectMapper.writeValueAsString(
                    Map.of("query", query, "documents", documents));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/rerank"))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode scoresNode = root.get("scores");
                if (scoresNode != null && scoresNode.isArray()) {
                    List<Double> scores = new ArrayList<>(scoresNode.size());
                    for (JsonNode s : scoresNode) {
                        scores.add(s.asDouble());
                    }
                    return scores;
                }
            } else {
                log.warn("Reranker returned HTTP {}: {}", response.statusCode(), response.body());
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            log.warn("Reranker request interrupted");
        } catch (Exception e) {
            log.warn("Cross-encoder reranking service call failed ({}): falling back to pass-through rank", e.getMessage());
        }

        // Fallback: assign decreasing placeholder scores based on original rank
        List<Double> fallbackScores = new ArrayList<>(documents.size());
        for (int i = 0; i < documents.size(); i++) {
            fallbackScores.add(1.0 - (i * 0.05));
        }
        return fallbackScores;
    }

    @Override
    public String model() {
        return model;
    }
}
