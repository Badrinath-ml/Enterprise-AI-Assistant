package com.enterprise.knowledge.ai;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Official xAI Grok generation provider implementing non-streaming and
 * genuine incremental token streaming via OpenAI-compatible chat completions API.
 */
@Service
public class GrokGenerationService implements GenerationService, StreamingGenerationService {
    private static final Logger log = LoggerFactory.getLogger(GrokGenerationService.class);

    private final RestClient restClient;
    private final HttpClient streamingClient;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final String apiKey;
    private final String model;
    private final int timeoutSeconds;
    private final int maxTokens;
    private final double temperature;
    private final int maxRetries;

    public GrokGenerationService(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${app.ai.grok.api-key:}") String apiKey,
            @Value("${app.ai.grok.base-url:${GROK_BASE_URL:https://api.x.ai/v1}}") String baseUrl,
            @Value("${app.ai.grok.model:${GROK_MODEL:grok-2-latest}}") String model,
            @Value("${app.ai.grok.timeout-seconds:${GROK_TIMEOUT_SECONDS:60}}") int timeoutSeconds,
            @Value("${app.ai.grok.max-tokens:${GROK_MAX_TOKENS:4096}}") int maxTokens,
            @Value("${app.ai.grok.temperature:${GROK_TEMPERATURE:0.2}}") double temperature,
            @Value("${app.ai.grok.max-retries:${GROK_MAX_RETRIES:3}}") int maxRetries) {

        this.objectMapper = objectMapper;
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.model = model;
        this.timeoutSeconds = timeoutSeconds;
        this.maxTokens = maxTokens;
        this.temperature = temperature;
        this.maxRetries = Math.max(1, maxRetries);

        this.restClient = restClientBuilder
                .baseUrl(this.baseUrl)
                .defaultHeader("Authorization", "Bearer " + this.apiKey)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("User-Agent", "EnterpriseKnowledgeAssistant/1.0")
                .build();

        this.streamingClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(Math.min(20, timeoutSeconds)))
                .build();
    }

    @Override
    public GenerationResponse generate(GenerationRequest request) {
        requireApiKey();

        List<MessagePayload> messages = buildMessages(request);
        ChatCompletionRequest payload = new ChatCompletionRequest(
                model, messages, false, maxTokens, temperature
        );

        int attempts = 0;
        Exception lastException = null;

        while (attempts < maxRetries) {
            attempts++;
            try {
                JsonNode root = restClient.post()
                        .uri("/chat/completions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(payload)
                        .retrieve()
                        .body(JsonNode.class);

                String text = extractAnswerText(root);
                if (text == null || text.isBlank()) {
                    throw new IllegalStateException("Grok returned an empty generation response");
                }
                return new GenerationResponse(text, "grok", model);
            } catch (Exception e) {
                lastException = e;
                log.warn("Grok generation attempt {}/{} failed: {}", attempts, maxRetries, sanitizeError(e));
                if (attempts < maxRetries) {
                    try {
                        Thread.sleep(attempts * 1000L);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException("Grok request retry was interrupted", ie);
                    }
                }
            }
        }

        throw new IllegalStateException("Grok generation failed after " + maxRetries + " attempts: " + sanitizeError(lastException), lastException);
    }

    @Override
    public GenerationResponse stream(GenerationRequest request, Consumer<String> onToken) {
        requireApiKey();

        List<MessagePayload> messages = buildMessages(request);
        ChatCompletionRequest payload = new ChatCompletionRequest(
                model, messages, true, maxTokens, temperature
        );

        try {
            String requestJson = objectMapper.writeValueAsString(payload);
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/chat/completions"))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                    .header("Accept", MediaType.TEXT_EVENT_STREAM_VALUE)
                    .header("User-Agent", "EnterpriseKnowledgeAssistant/1.0")
                    .POST(HttpRequest.BodyPublishers.ofString(requestJson, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<java.util.stream.Stream<String>> response =
                    streamingClient.send(httpRequest, HttpResponse.BodyHandlers.ofLines());

            int statusCode = response.statusCode();
            if (statusCode == 401 || statusCode == 403) {
                throw new IllegalStateException("Grok authentication failed: Invalid or unauthorized API key");
            }
            if (statusCode == 429) {
                throw new IllegalStateException("Grok rate limit exceeded; please retry shortly");
            }
            if (statusCode < 200 || statusCode >= 300) {
                throw new IllegalStateException("Grok streaming request failed (HTTP " + statusCode + ")");
            }

            StringBuilder full = new StringBuilder();

            try (java.util.stream.Stream<String> lines = response.body()) {
                java.util.Iterator<String> iterator = lines.iterator();

                while (iterator.hasNext()) {
                    String line = iterator.next();
                    if (line == null || !line.startsWith("data:")) {
                        continue;
                    }

                    String data = line.substring(5).trim();
                    if (data.isBlank() || "[DONE]".equals(data)) {
                        continue;
                    }

                    try {
                        JsonNode root = objectMapper.readTree(data);
                        JsonNode delta = root.path("choices").path(0).path("delta");
                        String tokenText = delta.path("content").asString(null);

                        if (tokenText != null && !tokenText.isEmpty()) {
                            full.append(tokenText);
                            onToken.accept(tokenText);
                        }
                    } catch (Exception parseEx) {
                        log.debug("Skipping unparseable SSE frame: {}", parseEx.getMessage());
                    }
                }
            }

            if (full.isEmpty()) {
                throw new IllegalStateException("Grok returned no streamed text");
            }

            return new GenerationResponse(full.toString(), "grok", model);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Grok streaming request was cancelled or interrupted", e);
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Grok streaming network error: " + sanitizeError(e), e);
        }
    }

    private List<MessagePayload> buildMessages(GenerationRequest request) {
        List<MessagePayload> messages = new ArrayList<>();
        if (request.systemInstruction() != null && !request.systemInstruction().isBlank()) {
            messages.add(new MessagePayload("system", request.systemInstruction().trim()));
        }
        messages.add(new MessagePayload("user", request.userPrompt() != null ? request.userPrompt().trim() : ""));
        return messages;
    }

    private String extractAnswerText(JsonNode root) {
        if (root == null) return null;
        JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
        return contentNode.isMissingNode() || contentNode.isNull() ? null : contentNode.asString();
    }

    private void requireApiKey() {
        if (apiKey.isBlank()) {
            throw new IllegalStateException("GROK_API_KEY (or XAI_API_KEY) is required for Grok generation");
        }
    }

    private String sanitizeError(Exception e) {
        if (e == null) return "Unknown error";
        String msg = e.getMessage();
        if (msg == null || msg.isBlank()) return e.getClass().getSimpleName();
        // Never leak API key in error message
        if (!apiKey.isBlank()) {
            msg = msg.replace(apiKey, "[REDACTED_API_KEY]");
        }
        return msg;
    }

    private record ChatCompletionRequest(
            String model,
            List<MessagePayload> messages,
            boolean stream,
            int max_tokens,
            double temperature
    ) {}

    private record MessagePayload(String role, String content) {}
}
