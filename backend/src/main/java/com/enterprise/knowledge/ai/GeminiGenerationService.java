package com.enterprise.knowledge.ai;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class GeminiGenerationService implements GenerationService {
    private final RestClient client;
    private final String model;

    public GeminiGenerationService(
            RestClient.Builder restClientBuilder,
            @Value("${app.ai.gemini.api-key:}") String apiKey,
            @Value("${app.ai.generation.gemini-model:gemini-3.8-flash}") String model) {

        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("GEMINI_API_KEY is required for Gemini generation");
        }

        this.model = model;
        this.client = restClientBuilder
                .baseUrl("https://generativelanguage.googleapis.com")
                .defaultHeader("x-goog-api-key", apiKey)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public GenerationResponse generate(GenerationRequest request) {
        JsonNode root = client.post()
                .uri("/v1beta/models/{model}:generateContent", model)
                .contentType(MediaType.APPLICATION_JSON)
                .body(new GenerateRequest(
                        java.util.List.of(new Content(java.util.List.of(new Part(request.userPrompt())))),
                        request.systemInstruction().isBlank()
                                ? null
                                : new Content(java.util.List.of(new Part(request.systemInstruction())))
                ))
                .retrieve()
                .body(JsonNode.class);

        String text = root == null
                ? null
                : root.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText(null);

        if (text == null || text.isBlank()) {
            throw new IllegalStateException("Gemini returned no generated text");
        }

        return new GenerationResponse(text, "gemini", model);
    }

    private record GenerateRequest(java.util.List<Content> contents, Content systemInstruction) {}
    private record Content(java.util.List<Part> parts) {}
    private record Part(String text) {}
}
