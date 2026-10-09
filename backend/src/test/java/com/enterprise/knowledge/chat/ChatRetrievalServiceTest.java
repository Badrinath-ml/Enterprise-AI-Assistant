package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.document.ingestion.EmbeddingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("unchecked")
class ChatRetrievalServiceTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private EmbeddingService embeddingService;

    private ChatRetrievalService chatRetrievalService;

    @BeforeEach
    void setUp() {
        chatRetrievalService = new ChatRetrievalService(jdbcTemplate, embeddingService, 0.50);
        lenient().when(embeddingService.embedQuery(anyString())).thenReturn(new float[]{0.1f, 0.2f, 0.3f});
        lenient().when(embeddingService.provider()).thenReturn("sentence-transformers");
        lenient().when(embeddingService.model()).thenReturn("all-mpnet-base-v2");
        lenient().when(embeddingService.dimensions()).thenReturn(768);
    }

    @Test
    @DisplayName("Admin retrieval queries across tenant without department filtering in hybrid pipeline")
    void adminRetrievalAcrossTenant() {
        UUID tenantId = UUID.randomUUID();
        when(jdbcTemplate.query(anyString(), any(Object[].class), any(RowMapper.class)))
                .thenReturn(List.of());

        chatRetrievalService.retrieve(tenantId, null, true, "vacation policy", 5);

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> paramsCaptor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate, atLeastOnce()).query(sqlCaptor.capture(), paramsCaptor.capture(), any(RowMapper.class));

        List<String> allSql = sqlCaptor.getAllValues();
        assertThat(allSql).isNotEmpty();

        // First query is dense vector search
        String denseSql = allSql.getFirst();
        assertThat(denseSql).contains("c.tenant_id = ?");
        assertThat(denseSql).contains("d.tenant_id = ?");
        assertThat(denseSql).doesNotContain("d.department_id =");

        Object[] denseParams = paramsCaptor.getAllValues().getFirst();
        assertThat(denseParams[1]).isEqualTo(tenantId);
        assertThat(denseParams[2]).isEqualTo(tenantId);
    }

    @Test
    @DisplayName("User with department can retrieve department and company-wide documents")
    void userWithDepartmentRetrieval() {
        UUID tenantId = UUID.randomUUID();
        UUID deptId = UUID.randomUUID();
        when(jdbcTemplate.query(anyString(), any(Object[].class), any(RowMapper.class)))
                .thenReturn(List.of());

        chatRetrievalService.retrieve(tenantId, deptId, false, "engineering guides", 5);

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> paramsCaptor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate, atLeastOnce()).query(sqlCaptor.capture(), paramsCaptor.capture(), any(RowMapper.class));

        List<String> allSql = sqlCaptor.getAllValues();
        assertThat(allSql).isNotEmpty();
        String denseSql = allSql.getFirst();
        assertThat(denseSql).contains("(d.department_id IS NULL OR d.department_id = ?)");
        assertThat(paramsCaptor.getAllValues().getFirst()).contains(deptId);
    }

    @Test
    @DisplayName("User without department is restricted to organization-wide documents")
    void userWithoutDepartmentRetrieval() {
        UUID tenantId = UUID.randomUUID();
        when(jdbcTemplate.query(anyString(), any(Object[].class), any(RowMapper.class)))
                .thenReturn(List.of());

        chatRetrievalService.retrieve(tenantId, null, false, "company code of conduct", 5);

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, atLeastOnce()).query(sqlCaptor.capture(), any(Object[].class), any(RowMapper.class));

        List<String> allSql = sqlCaptor.getAllValues();
        assertThat(allSql).isNotEmpty();
        assertThat(allSql.getFirst()).contains("d.department_id IS NULL");
    }

    @Test
    @DisplayName("Chunks below minimum similarity threshold are filtered out")
    void similarityThresholdFiltersOutLowConfidenceChunks() {
        UUID tenantId = UUID.randomUUID();

        ChatRetrievalService.RetrievedChunk highMatch = new ChatRetrievalService.RetrievedChunk(
                UUID.randomUUID(), UUID.randomUUID(), 1, 0, "High relevance snippet", 1, "Page 1",
                "Policy", "policy.pdf", "application/pdf", 0.85
        );
        ChatRetrievalService.RetrievedChunk lowMatch = new ChatRetrievalService.RetrievedChunk(
                UUID.randomUUID(), UUID.randomUUID(), 1, 1, "Low relevance snippet", 2, "Page 2",
                "Policy", "policy.pdf", "application/pdf", 0.35 // below threshold 0.50
        );

        when(jdbcTemplate.query(anyString(), any(Object[].class), any(RowMapper.class)))
                .thenReturn(List.of(highMatch, lowMatch))
                .thenReturn(List.of());

        List<ChatRetrievalService.RetrievedChunk> results = chatRetrievalService.retrieve(tenantId, null, true, "query", 5);

        assertThat(results).hasSize(1);
        assertThat(results.getFirst().similarity()).isEqualTo(0.85);
        assertThat(results.getFirst().content()).isEqualTo("High relevance snippet");
    }
}
