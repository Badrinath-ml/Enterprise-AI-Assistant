package com.enterprise.knowledge.ai;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GrokGenerationServiceTest {

    @Test
    @DisplayName("Missing API key throws IllegalStateException before request")
    void missingApiKeyThrowsException() {
        GrokGenerationService service = new GrokGenerationService(
                RestClient.builder(), new ObjectMapper(), "", "https://api.x.ai/v1",
                "grok-2-latest", 30, 1024, 0.2, 1
        );

        assertThatThrownBy(() -> service.generate(new GenerationRequest("System prompt", "User prompt")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("GROK_API_KEY");

        assertThatThrownBy(() -> service.stream(new GenerationRequest("System prompt", "User prompt"), token -> {}))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("GROK_API_KEY");
    }

    @Test
    @DisplayName("Sanitized error messages do not leak secret API key")
    void apiKeysAreRedactedFromErrors() {
        String secretKey = "xai-secret-key-1234567890";
        GrokGenerationService service = new GrokGenerationService(
                RestClient.builder(), new ObjectMapper(), secretKey, "http://127.0.0.1:54321", // non-existent port
                "grok-2-latest", 1, 1024, 0.2, 1
        );

        assertThatThrownBy(() -> service.generate(new GenerationRequest("System prompt", "User prompt")))
                .isInstanceOf(IllegalStateException.class)
                .satisfies(ex -> assertThat(ex.getMessage()).doesNotContain(secretKey));
    }

    @Test
    @DisplayName("Fallback service switches from primary Grok to secondary provider on error")
    void fallbackServiceSwitchesOnFailure() {
        GenerationService failingPrimary = request -> {
            throw new IllegalStateException("GROK_API_KEY is required");
        };
        GenerationService fallback = request -> new GenerationResponse("Fallback answer", "fallback-provider", "fallback-model");

        FallbackGenerationService service = new FallbackGenerationService(failingPrimary, fallback);
        GenerationResponse response = service.generate(new GenerationRequest("sys", "user"));

        assertThat(response.text()).isEqualTo("Fallback answer");
        assertThat(response.provider()).isEqualTo("fallback-provider");
    }

    @Test
    @DisplayName("Streaming fallback service switches to secondary streaming provider if primary fails before tokens")
    void streamingFallbackSwitchesBeforeTokens() {
        StreamingGenerationService failingPrimary = (request, onToken) -> {
            throw new IllegalStateException("Primary streaming unavailable");
        };
        StreamingGenerationService fallback = (request, onToken) -> {
            onToken.accept("Fallback ");
            onToken.accept("stream");
            return new GenerationResponse("Fallback stream", "fallback-provider", "fallback-model");
        };

        FallbackStreamingGenerationService service = new FallbackStreamingGenerationService(failingPrimary, fallback);
        List<String> tokens = new ArrayList<>();
        GenerationResponse response = service.stream(new GenerationRequest("sys", "user"), tokens::add);

        assertThat(tokens).containsExactly("Fallback ", "stream");
        assertThat(response.text()).isEqualTo("Fallback stream");
    }
}
