package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.ai.GenerationRequest;
import com.enterprise.knowledge.ai.GenerationResponse;
import com.enterprise.knowledge.ai.GenerationService;
import com.enterprise.knowledge.ai.StreamingGenerationService;
import com.enterprise.knowledge.chat.dto.ChatSendResponse;
import com.enterprise.knowledge.document.DocumentService;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatStreamingAndGroundedRagTest {

    @Mock
    private ChatConversationRepository conversations;
    @Mock
    private ChatMessageRepository messages;
    @Mock
    private ChatCitationRepository citations;
    @Mock
    private ChatRetrievalService retrieval;
    @Mock
    private GenerationService generation;
    @Mock
    private StreamingGenerationService streamingGeneration;
    @Mock
    private UserService userService;
    @Mock
    private DocumentService documentService;
    @Mock
    private FileStorageService storage;
    @Mock
    private ChatPersistenceService persistence;

    private IntentRoutingService intentRouter;
    private ChatService chatService;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID conversationId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        intentRouter = new IntentRoutingService();
        chatService = new ChatService(
                conversations, messages, citations, null, retrieval, generation,
                streamingGeneration, intentRouter, userService, null, documentService,
                null, null, null, storage, null, persistence, null
        );

        Tenant tenant = new Tenant(tenantId, "Acme Corp", "acme");
        AppUser user = new AppUser(userId, tenant, null, "User", "user@acme.com", "hash", UserRole.EMPLOYEE);
        ChatConversation conversation = new ChatConversation(conversationId, tenant, user, "Chat");

        lenient().when(conversations.findByIdAndTenantIdAndUserId(conversationId, tenantId, userId))
                .thenReturn(Optional.of(conversation));
        lenient().when(userService.findByIdAndTenant(userId, tenantId)).thenReturn(user);
        lenient().when(messages.findByConversationIdOrderByCreatedAtAsc(conversationId))
                .thenReturn(List.of());
    }

    @Test
    @DisplayName("Greeting query generates friendly response without document retrieval and emits 0 citations")
    void greetingBypassesRetrieval() {
        when(generation.generate(any(GenerationRequest.class)))
                .thenReturn(new GenerationResponse("Hello! How can I assist you with your organization's knowledge today?", "grok", "grok-2-latest"));

        ChatSendResponse response = chatService.send(tenantId, userId, conversationId, "Hello");

        assertThat(response.assistantMessage().content()).contains("Hello!");
        assertThat(response.assistantMessage().citations()).isEmpty();

        // Retrieval must NEVER be called for greetings!
        verify(retrieval, never()).retrieve(any(), any(), anyBoolean(), any(), anyString(), anyInt());
        verify(citations, never()).save(any());
    }

    @Test
    @DisplayName("General knowledge query generates response without searching private documents")
    void generalKnowledgeBypassesRetrieval() {
        when(generation.generate(any(GenerationRequest.class)))
                .thenReturn(new GenerationResponse("The capital of France is Paris.", "grok", "grok-2-latest"));

        ChatSendResponse response = chatService.send(tenantId, userId, conversationId, "What is the capital of France?");

        assertThat(response.assistantMessage().content()).contains("Paris");
        assertThat(response.assistantMessage().citations()).isEmpty();

        // Retrieval must NEVER be called for general queries!
        verify(retrieval, never()).retrieve(any(), any(), anyBoolean(), any(), anyString(), anyInt());
        verify(citations, never()).save(any());
    }

    @Test
    @DisplayName("Unanswerable / missing evidence query explicitly states insufficient evidence with 0 false citations")
    void missingEvidenceProducesNoFalseCitations() {
        when(retrieval.retrieve(any(), any(), anyBoolean(), any(), anyString(), anyInt()))
                .thenReturn(List.of()); // No matching evidence found

        when(generation.generate(any(GenerationRequest.class)))
                .thenReturn(new GenerationResponse(
                        "The available organizational documents do not contain enough information to answer this question.",
                        "grok", "grok-2-latest"
                ));

        ChatSendResponse response = chatService.send(tenantId, userId, conversationId, "What is our pet policy?");

        assertThat(response.assistantMessage().content()).contains("do not contain enough information");
        assertThat(response.assistantMessage().citations()).isEmpty();
        verify(citations, never()).save(any());
    }
}
