package com.enterprise.knowledge.document.ingestion;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SentenceTransformersEmbeddingServiceTest {

    @Test
    @DisplayName("Empty query throws IllegalArgumentException")
    void blankQueryThrowsException() {
        SentenceTransformersEmbeddingService service = new SentenceTransformersEmbeddingService(
                RestClient.builder(), new tools.jackson.databind.ObjectMapper(), "http://127.0.0.1:8001", "all-mpnet-base-v2", 768, 32, 1
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
        SentenceTransformersEmbeddingService service = new SentenceTransformersEmbeddingService(
                RestClient.builder(), new tools.jackson.databind.ObjectMapper(), "http://127.0.0.1:8001", "all-mpnet-base-v2", 768, 32, 1
        );

        List<float[]> result = service.embedDocuments(List.of());
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Service returns expected provider, model, and dimension metadata matching pgvector schema")
    void metadataMatchesPgVectorColumn() {
        SentenceTransformersEmbeddingService service = new SentenceTransformersEmbeddingService(
                RestClient.builder(), new tools.jackson.databind.ObjectMapper(), "http://127.0.0.1:8001", "all-mpnet-base-v2", 768, 32, 1
        );

        assertThat(service.provider()).isEqualTo("sentence-transformers");
        assertThat(service.model()).isEqualTo("all-mpnet-base-v2");
        assertThat(service.dimensions()).isEqualTo(768);
    }
}
