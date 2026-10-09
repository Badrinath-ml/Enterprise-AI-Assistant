package com.enterprise.knowledge.document.ingestion;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GoogleEmbeddingServiceTest {

    @Test
    @DisplayName("Empty query throws IllegalArgumentException")
    void blankQueryThrowsException() {
        GoogleEmbeddingService service = new GoogleEmbeddingService(
                new ObjectMapper(), "fake-key", "google-embedding-2", 100, 3
        );

        assertThatThrownBy(() -> service.embedQuery(""))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.embedQuery("   "))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.embedQuery(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Empty document list returns empty vector list without hitting endpoint")
    void emptyDocumentsReturnsEmptyList() {
        GoogleEmbeddingService service = new GoogleEmbeddingService(
                new ObjectMapper(), "fake-key", "google-embedding-2", 100, 3
        );

        List<float[]> result = service.embedDocuments(List.of());
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Metadata reports google, google-embedding-2, and 768 dimensions")
    void metadataMatchesConfiguration() {
        GoogleEmbeddingService service = new GoogleEmbeddingService(
                new ObjectMapper(), "fake-key", "google-embedding-2", 100, 3
        );

        assertThat(service.provider()).isEqualTo("google");
        assertThat(service.model()).isEqualTo("google-embedding-2");
        assertThat(service.dimensions()).isEqualTo(768);
    }

    @Test
    @DisplayName("Default constructor uses gemini-embedding-2 when model is null or blank")
    void defaultModelFallback() {
        GoogleEmbeddingService service = new GoogleEmbeddingService(
                new ObjectMapper(), "fake-key", null, 100, 3
        );

        assertThat(service.model()).isEqualTo("gemini-embedding-2");
    }
}
