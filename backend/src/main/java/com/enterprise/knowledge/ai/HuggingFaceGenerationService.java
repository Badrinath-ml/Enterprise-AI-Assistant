package com.enterprise.knowledge.ai;

import tools.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;

@Service
public class HuggingFaceGenerationService implements GenerationService, StreamingGenerationService {
    private final RestClient client;
    private final String model;
    private final String token;

    public HuggingFaceGenerationService(
            RestClient.Builder restClientBuilder,
            @Value("${app.ai.huggingface.token:}") String token,
            @Value("${app.ai.generation.huggingface-model:Qwen/Qwen3-30B-A3B-Instruct-2507}") String model) {

        this.model = model;
        this.token = token;
        this.client = restClientBuilder
                .baseUrl("https://router.huggingface.co")
                .defaultHeader("Authorization", "Bearer " + token)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public GenerationResponse generate(GenerationRequest request) {
        if (token == null || token.isBlank()) {
            throw new IllegalStateException("HF_TOKEN is required for Hugging Face generation");
        }
        String system = request.systemInstruction();
        JsonNode root = client.post()
                .uri("/v1/chat/completions")
                .header("Authorization", "Bearer " + token)
                .body(new ChatRequest(
                        model,
                        java.util.List.of(
                                new Message("system", system),
                                new Message("user", request.userPrompt())
                        )
                ))
                .retrieve()
                .body(JsonNode.class);

        String text = root == null
                ? null
                : root.path("choices").path(0).path("message").path("content").asString(null);

        if (text == null || text.isBlank()) {
            throw new IllegalStateException("Hugging Face returned no generated text");
        }

        return new GenerationResponse(text, "huggingface", model);
    }


    @Override
    public GenerationResponse stream(GenerationRequest request, Consumer<String> onToken) {
        if (token == null || token.isBlank()) {
            throw new IllegalStateException("HF_TOKEN is required for Hugging Face generation");
        }
        StringBuilder full = new StringBuilder();

        client.post()
                .uri("/v1/chat/completions")
                .header("Authorization", "Bearer " + token)
                .body(new StreamChatRequest(
                        model,
                        java.util.List.of(
                                new Message("system", request.systemInstruction()),
                                new Message("user", request.userPrompt())
                        ),
                        true
                ))
                .exchange((req, response) -> {
                    try (BufferedReader reader = new BufferedReader(
                            new InputStreamReader(response.getBody(), StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            if (!line.startsWith("data:")) continue;
                            String data = line.substring(5).trim();
                            if (data.isBlank() || "[DONE]".equals(data)) continue;

                            JsonNode root = new tools.jackson.databind.ObjectMapper().readTree(data);
                            String tokenText = root.path("choices").path(0)
                                    .path("delta").path("content").asString(null);
                            if (tokenText != null && !tokenText.isEmpty()) {
                                full.append(tokenText);
                                onToken.accept(tokenText);
                            }
                        }
                    }
                    return null;
                });

        if (full.isEmpty()) throw new IllegalStateException("Hugging Face returned no streamed text");
        return new GenerationResponse(full.toString(), "huggingface", model);
    }

    private record StreamChatRequest(String model, java.util.List<Message> messages, boolean stream) {}

    private record ChatRequest(String model, java.util.List<Message> messages) {}
    private record Message(String role, String content) {}
}
