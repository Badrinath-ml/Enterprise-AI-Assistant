package com.enterprise.knowledge.ai;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class HuggingFaceGenerationService implements GenerationService {
    private final RestClient client;
    private final String model;

    public HuggingFaceGenerationService(
            RestClient.Builder restClientBuilder,
            @Value("${app.ai.huggingface.token:}") String token,
            @Value("${app.ai.generation.huggingface-model:Qwen/Qwen3-30B-A3B-Instruct-2507}") String model) {

        if (token == null || token.isBlank()) {
            throw new IllegalStateException("HF_TOKEN is required for Hugging Face generation");
        }

        this.model = model;
        this.client = restClientBuilder
                .baseUrl("https://router.huggingface.co")
                .defaultHeader("Authorization", "Bearer " + token)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public GenerationResponse generate(GenerationRequest request) {
        String system = request.systemInstruction();
        JsonNode root = client.post()
                .uri("/v1/chat/completions")
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
                : root.path("choices").path(0).path("message").path("content").asText(null);

        if (text == null || text.isBlank()) {
            throw new IllegalStateException("Hugging Face returned no generated text");
        }

        return new GenerationResponse(text, "huggingface", model);
    }

    private record ChatRequest(String model, java.util.List<Message> messages) {}
    private record Message(String role, String content) {}
}
