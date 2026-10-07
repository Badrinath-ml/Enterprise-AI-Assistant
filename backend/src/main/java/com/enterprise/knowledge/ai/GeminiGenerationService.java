package com.enterprise.knowledge.ai;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.function.Consumer;

@Service
public class GeminiGenerationService implements GenerationService, StreamingGenerationService {
    private final RestClient client;
    private final HttpClient streamingClient;
    private final ObjectMapper objectMapper;
    private final String model;
    private final String apiKey;

    public GeminiGenerationService(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${app.ai.gemini.api-key:}") String apiKey,
            @Value("${app.ai.generation.gemini-model:gemini-3.8-flash}") String model) {

        this.apiKey = apiKey;
        this.model = model;
        this.objectMapper = objectMapper;
        this.client = restClientBuilder
                .baseUrl("https://generativelanguage.googleapis.com")
                .defaultHeader("x-goog-api-key", apiKey)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
        this.streamingClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    @Override
    public GenerationResponse generate(GenerationRequest request) {
        requireApiKey();

        JsonNode root = client.post()
                .uri("/v1beta/models/{model}:generateContent", model)
                .contentType(MediaType.APPLICATION_JSON)
                .body(buildRequest(request))
                .retrieve()
                .body(JsonNode.class);

        String text = extractAnswerText(root);

        if (text.isBlank()) {
            throw new IllegalStateException("Gemini returned no generated text");
        }

        return new GenerationResponse(text, "gemini", model);
    }

    @Override
    public GenerationResponse stream(GenerationRequest request, Consumer<String> onToken) {
        requireApiKey();

        try {
            String body = objectMapper.writeValueAsString(buildRequest(request));
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(
                            "https://generativelanguage.googleapis.com/v1beta/models/"
                                    + model + ":streamGenerateContent?alt=sse"))
                    .timeout(Duration.ofMinutes(3))
                    .header("x-goog-api-key", apiKey)
                    .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                    .header("Accept", MediaType.TEXT_EVENT_STREAM_VALUE)
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<java.util.stream.Stream<String>> response =
                    streamingClient.send(httpRequest, HttpResponse.BodyHandlers.ofLines());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String errorBody = response.body().reduce("", (a, b) -> a + b);
                throw new IllegalStateException(
                        "Gemini streaming request failed (HTTP "
                                + response.statusCode() + "): " + errorBody);
            }

            StringBuilder full = new StringBuilder();

            StringBuilder full = new StringBuilder();

            try (java.util.stream.Stream<String> lines = response.body()) {
                java.util.Iterator<String> iterator = lines.iterator();

                while (iterator.hasNext()) {
                    String line = iterator.next();

                    if (!line.startsWith("data:")) {
                        continue;
                    }

                    String data = line.substring(5).trim();
                    if (data.isBlank() || "[DONE]".equals(data)) {
                        continue;
                    }

                    JsonNode root = objectMapper.readTree(data);
                    appendAnswerText(root, full, onToken);
                }
            }

            if (full.isEmpty()) {
                throw new IllegalStateException("Gemini returned no streamed text");
            }

            return new GenerationResponse(full.toString(), "gemini", model);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Gemini streaming request was interrupted", e);
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Gemini streaming request failed: " + e.getMessage(), e);
        }
    }

    private GenerateRequest buildRequest(GenerationRequest request) {
        return new GenerateRequest(
                java.util.List.of(
                        new Content(
                                "user",
                                java.util.List.of(new Part(request.userPrompt()))
                        )
                ),
                request.systemInstruction().isBlank()
                        ? null
                        : new Content(
                                "system",
                                java.util.List.of(new Part(request.systemInstruction()))
                        ),
                new GenerationConfig(
                        new ThinkingConfig("low")
                )
        );
    }

    private String extractAnswerText(JsonNode root) {
        StringBuilder text = new StringBuilder();
        appendAnswerText(root, text, ignored -> {});
        return text.toString();
    }

    private void appendAnswerText(JsonNode root, StringBuilder full, Consumer<String> onToken) {
        JsonNode parts = root == null
                ? null
                : root.path("candidates").path(0).path("content").path("parts");

        if (parts == null || !parts.isArray()) {
            return;
        }

        for (JsonNode part : parts) {
            if (part.path("thought").asBoolean(false)) {
                continue;
            }

            String text = part.path("text").asString(null);
            if (text == null || text.isEmpty()) {
                continue;
            }

            full.append(text);
            onToken.accept(text);
        }
    }

    private void requireApiKey() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("GEMINI_API_KEY is required for Gemini generation");
        }
    }

    private record GenerateRequest(
            java.util.List<Content> contents,
            Content systemInstruction,
            GenerationConfig generationConfig
    ) {}

    private record GenerationConfig(ThinkingConfig thinkingConfig) {}

    private record ThinkingConfig(String thinkingLevel) {}

    private record Content(String role, java.util.List<Part> parts) {}

    private record Part(String text) {}
}
