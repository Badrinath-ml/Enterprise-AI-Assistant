package com.enterprise.knowledge.document.ingestion;

import com.enterprise.knowledge.document.Document;
import com.enterprise.knowledge.document.DocumentRepository;
import com.enterprise.knowledge.document.IngestionStatus;
import com.enterprise.knowledge.document.dto.DocumentIngestionResponse;
import com.enterprise.knowledge.document.storage.FileStorageService;
import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.user.AppUser;
import com.enterprise.knowledge.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentIngestionServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private DocumentChunkRepository chunkRepository;

    @Mock
    private FileStorageService storage;

    @Mock
    private DocumentTextExtractorService extractor;

    @Mock
    private TextChunker chunker;

    @Mock
    private EmbeddingService embeddingService;

    @Mock
    private PlatformTransactionManager transactionManager;

    private DocumentIngestionService ingestionService;

    private UUID tenantId;
    private UUID documentId;
    private Document document;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        documentId = UUID.randomUUID();
        Tenant tenant = new Tenant(tenantId, "Acme", "acme");
        AppUser actor = new AppUser(UUID.randomUUID(), tenant, null, "User", "user@acme.com", "hash", UserRole.ADMIN);
        document = new Document(documentId, tenant, null, actor, "Architecture Doc", "Desc", "arch.pdf", "key1", "application/pdf", 1024L);

        lenient().when(transactionManager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
        ingestionService = new DocumentIngestionService(
                documentRepository, chunkRepository, storage, extractor, chunker, embeddingService, transactionManager
        );
    }

    @Test
    @DisplayName("Successful ingestion creates deterministic chunk IDs and marks document INDEXED")
    void successfulIngestionGeneratesDeterministicIds() throws Exception {
        when(documentRepository.findByIdAndTenantId(documentId, tenantId)).thenReturn(Optional.of(document));
        when(storage.loadAsResource("key1")).thenReturn(new ByteArrayResource("dummy file content".getBytes()));

        ExtractedDocument extracted = new ExtractedDocument(List.of(
                new ExtractedDocument.ExtractedPage(1, "Page 1 text")
        ));
        when(extractor.extract(any(InputStream.class), eq("arch.pdf"), eq("application/pdf"))).thenReturn(extracted);

        List<TextChunker.DocumentChunkItem> chunkItems = List.of(
                new TextChunker.DocumentChunkItem(0, "First chunk text", 10, 1, null, "Page 1")
        );
        when(chunker.chunkPages(anyList())).thenReturn(chunkItems);

        float[] vector = new float[]{0.1f, 0.2f};
        when(embeddingService.embedDocuments(anyList())).thenReturn(List.of(vector));
        when(embeddingService.dimensions()).thenReturn(2);
        when(embeddingService.provider()).thenReturn("google");
        when(embeddingService.model()).thenReturn("text-embedding-004");

        ingestionService.process(tenantId, documentId);

        // Verify old chunks deleted before insert
        verify(chunkRepository).deleteForDocument(documentId);

        // Verify deterministic chunk UUID calculation
        UUID expectedChunkId = UUID.nameUUIDFromBytes(
                (documentId.toString() + ":v1:c0").getBytes(StandardCharsets.UTF_8)
        );
        ArgumentCaptor<UUID> chunkIdCaptor = ArgumentCaptor.forClass(UUID.class);
        verify(chunkRepository).insert(
                chunkIdCaptor.capture(), eq(tenantId), eq(documentId), eq(1), eq(0),
                eq("First chunk text"), eq(10), eq(vector), eq("google"), eq("text-embedding-004"),
                eq(1), eq("Page 1")
        );
        assertThat(chunkIdCaptor.getValue()).isEqualTo(expectedChunkId);

        assertThat(document.getIngestionStatus()).isEqualTo(IngestionStatus.INDEXED);
        assertThat(document.getIndexedChunkCount()).isEqualTo(1);
        assertThat(document.getIndexedAt()).isNotNull();
        assertThat(document.getIngestionError()).isNull();
    }

    @Test
    @DisplayName("Extraction failure marks document FAILED with descriptive error")
    void extractionFailureMarksDocumentFailed() throws Exception {
        when(documentRepository.findByIdAndTenantId(documentId, tenantId)).thenReturn(Optional.of(document));
        when(storage.loadAsResource("key1")).thenReturn(new ByteArrayResource("scanned image".getBytes()));
        when(extractor.extract(any(InputStream.class), anyString(), anyString()))
                .thenThrow(new IllegalArgumentException("PDF contains no extractable text. Scanned PDFs require OCR."));

        ingestionService.process(tenantId, documentId);

        assertThat(document.getIngestionStatus()).isEqualTo(IngestionStatus.FAILED);
        assertThat(document.getIngestionError()).contains("PDF contains no extractable text");
        assertThat(document.getIndexedChunkCount()).isEqualTo(0);
        assertThat(document.getIndexedAt()).isNull();
    }

    @Test
    @DisplayName("Status query returns current document ingestion state")
    void statusReturnsIngestionResponse() {
        document.setIngestionStatus(IngestionStatus.INDEXED);
        document.setIndexedChunkCount(42);
        when(documentRepository.findByIdAndTenantId(documentId, tenantId)).thenReturn(Optional.of(document));

        DocumentIngestionResponse response = ingestionService.status(tenantId, documentId);

        assertThat(response.status()).isEqualTo(IngestionStatus.INDEXED);
        assertThat(response.chunkCount()).isEqualTo(42);
        assertThat(response.error()).isNull();
    }
}
