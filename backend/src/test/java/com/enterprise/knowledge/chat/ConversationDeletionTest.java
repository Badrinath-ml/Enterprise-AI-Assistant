package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.document.storage.FileStorageService;
import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.user.AppUser;
import com.enterprise.knowledge.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConversationDeletionTest {

    @Mock
    private ChatConversationRepository conversations;

    @Mock
    private ChatConversationAttachmentRepository attachmentRepository;

    @Mock
    private FileStorageService storage;

    private ChatService chatService;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID otherUserId = UUID.randomUUID();
    private final UUID conversationId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        chatService = new ChatService(
                conversations, null, null, attachmentRepository, null, null, null,
                null, null, null, null, null, storage, mock(ChatAttachmentIngestionService.class), null, null
        );
    }

    @Test
    @DisplayName("User can delete their own conversation and its private attachments are cleaned up")
    void userCanDeleteOwnConversation() throws Exception {
        Tenant tenant = new Tenant(tenantId, "Acme Corp", "acme");
        AppUser user = new AppUser(userId, tenant, null, "User", "user@acme.com", "hash", UserRole.EMPLOYEE);
        ChatConversation conversation = new ChatConversation(conversationId, tenant, user, "My Conversation");

        ChatConversationAttachment attachment = new ChatConversationAttachment(
                UUID.randomUUID(), tenant, conversation, user, "notes.txt", "text/plain", 100, "storage/path/notes.txt"
        );

        when(conversations.findByIdAndTenantIdAndUserId(conversationId, tenantId, userId))
                .thenReturn(Optional.of(conversation));
        when(attachmentRepository.findByConversationId(conversationId))
                .thenReturn(List.of(attachment));

        chatService.delete(tenantId, userId, conversationId);

        verify(storage).delete("storage/path/notes.txt");
        verify(conversations).delete(conversation);
    }

    @Test
    @DisplayName("Attempting to delete another user's conversation fails with not found / unauthorized")
    void cannotDeleteAnotherUsersConversation() {
        when(conversations.findByIdAndTenantIdAndUserId(conversationId, tenantId, otherUserId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> chatService.delete(tenantId, otherUserId, conversationId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Conversation not found");

        verify(conversations, never()).delete(any());
    }

    @Test
    @DisplayName("Deleting a nonexistent conversation fails")
    void deletingNonExistentConversationFails() {
        UUID nonExistentId = UUID.randomUUID();
        when(conversations.findByIdAndTenantIdAndUserId(nonExistentId, tenantId, userId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> chatService.delete(tenantId, userId, nonExistentId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Conversation not found");

        verify(conversations, never()).delete(any());
    }
}
