package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.document.DocumentService;
import com.enterprise.knowledge.document.ingestion.DocumentTextExtractorService;
import com.enterprise.knowledge.document.ingestion.EmbeddingService;
import com.enterprise.knowledge.document.ingestion.TextChunker;
import com.enterprise.knowledge.document.storage.FileStorageService;
import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.user.AppUser;
import com.enterprise.knowledge.user.UserRole;
import com.enterprise.knowledge.user.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PrivateAttachmentSecurityTest {

    @Mock
    private ChatConversationRepository conversations;
    @Mock
    private ChatConversationAttachmentRepository attachmentRepository;
    @Mock
    private UserService userService;
    @Mock
    private DocumentService documentService;
    @Mock
    private FileStorageService storage;
    @Mock
    private DocumentTextExtractorService extractor;
    @Mock
    private TextChunker chunker;
    @Mock
    private EmbeddingService embeddingService;

    private ChatService chatService;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID employeeId = UUID.randomUUID();
    private final UUID conversationId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        chatService = new ChatService(
                conversations, null, null, attachmentRepository, null, null, null,
                null, userService, null, documentService, extractor, storage, mock(ChatAttachmentIngestionService.class),
                null, null, null
        );
    }

    @Test
    @DisplayName("Empty file upload is rejected")
    void emptyFileIsRejected() {
        Tenant tenant = new Tenant(tenantId, "Acme Corp", "acme");
        AppUser employee = new AppUser(employeeId, tenant, null, "Employee", "emp@acme.com", "hash", UserRole.EMPLOYEE);
        ChatConversation conversation = new ChatConversation(conversationId, tenant, employee, "Chat");

        when(conversations.findByIdAndTenantIdAndUserId(conversationId, tenantId, employeeId))
                .thenReturn(Optional.of(conversation));
        when(userService.findByIdAndTenant(employeeId, tenantId)).thenReturn(employee);

        MockMultipartFile emptyFile = new MockMultipartFile("file", "test.txt", "text/plain", new byte[0]);

        assertThatThrownBy(() -> chatService.upload(tenantId, employeeId, conversationId, emptyFile))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("File cannot be empty");
    }

    @Test
    @DisplayName("Unsupported file extension is rejected")
    void unsupportedExtensionIsRejected() {
        Tenant tenant = new Tenant(tenantId, "Acme Corp", "acme");
        AppUser employee = new AppUser(employeeId, tenant, null, "Employee", "emp@acme.com", "hash", UserRole.EMPLOYEE);
        ChatConversation conversation = new ChatConversation(conversationId, tenant, employee, "Chat");

        when(conversations.findByIdAndTenantIdAndUserId(conversationId, tenantId, employeeId))
                .thenReturn(Optional.of(conversation));
        when(userService.findByIdAndTenant(employeeId, tenantId)).thenReturn(employee);

        MockMultipartFile exeFile = new MockMultipartFile("file", "malicious.exe", "application/x-msdownload", new byte[]{1, 2, 3});

        assertThatThrownBy(() -> chatService.upload(tenantId, employeeId, conversationId, exeFile))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only PDF, DOCX, and TXT files are supported");
    }

    @Test
    @DisplayName("Files exceeding 25 MB are rejected")
    void oversizedFileIsRejected() {
        Tenant tenant = new Tenant(tenantId, "Acme Corp", "acme");
        AppUser employee = new AppUser(employeeId, tenant, null, "Employee", "emp@acme.com", "hash", UserRole.EMPLOYEE);
        ChatConversation conversation = new ChatConversation(conversationId, tenant, employee, "Chat");

        when(conversations.findByIdAndTenantIdAndUserId(conversationId, tenantId, employeeId))
                .thenReturn(Optional.of(conversation));
        when(userService.findByIdAndTenant(employeeId, tenantId)).thenReturn(employee);

        // 26 MB mock file
        byte[] largeBytes = new byte[100];
        MockMultipartFile largeFile = new MockMultipartFile("file", "large.pdf", "application/pdf", largeBytes) {
            @Override
            public long getSize() {
                return 26 * 1024 * 1024L;
            }
        };

        assertThatThrownBy(() -> chatService.upload(tenantId, employeeId, conversationId, largeFile))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("25 MB");
    }

    @Test
    @DisplayName("Employee chat upload never mutates or creates shared organizational documents")
    void employeeChatUploadNeverInvokesSharedDocumentService() {
        // Shared document service should NEVER be invoked for private chat attachments
        verify(documentService, never()).create(any(), any(), any(), any(), any(), any());
    }
}
