package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.document.Document;
import com.enterprise.knowledge.document.DocumentService;
import com.enterprise.knowledge.user.AppUser;
import com.enterprise.knowledge.user.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ChatPersistenceService {
    private final ChatConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final ChatCitationRepository citations;
    private final UserService userService;
    private final DocumentService documentService;

    public ChatPersistenceService(ChatConversationRepository conversations,
                                  ChatMessageRepository messages,
                                  ChatCitationRepository citations,
                                  UserService userService,
                                  DocumentService documentService) {
        this.conversations = conversations;
        this.messages = messages;
        this.citations = citations;
        this.userService = userService;
        this.documentService = documentService;
    }

    @Transactional
    public ChatMessage saveUserMessage(UUID tenantId, UUID userId, UUID conversationId, String prompt) {
        ChatConversation conversation = conversation(tenantId, userId, conversationId);
        ChatMessage userMessage = new ChatMessage(
                UUID.randomUUID(), conversation, ChatMessageRole.USER, prompt.trim(), null, null);
        return messages.save(userMessage);
    }

    @Transactional(readOnly = true)
    public List<ChatMessage> history(UUID tenantId, UUID userId, UUID conversationId) {
        ChatConversation conversation = conversation(tenantId, userId, conversationId);
        return messages.findByConversationIdOrderByCreatedAtAsc(conversation.getId());
    }

    @Transactional
    public ChatMessage saveAssistant(UUID tenantId, UUID userId, UUID conversationId,
                                      String text, String provider, String model,
                                      List<ChatRetrievalService.RetrievedChunk> chunks) {
        ChatConversation conversation = conversation(tenantId, userId, conversationId);
        ChatMessage assistant = new ChatMessage(
                UUID.randomUUID(), conversation, ChatMessageRole.ASSISTANT, text, provider, model);
        messages.save(assistant);

        for (ChatRetrievalService.RetrievedChunk chunk : chunks) {
            Document document = documentService.getEntity(tenantId, userId, chunk.documentId());
            citations.save(new ChatCitation(
                    UUID.randomUUID(), assistant, document,
                    chunk.documentVersion(), chunk.chunkId(), chunk.chunkIndex(),
                    chunk.similarity(), chunk.content(), chunk.pageNumber(), chunk.locatorLabel()));
        }

        conversation.touchNow();
        if ("New conversation".equals(conversation.getTitle())) {
            String title = text.length() > 60 ? text.substring(0, 60) : text;
            // Keep the original question as the title when the caller supplies it separately.
            conversation.setTitle(title);
        }
        conversations.save(conversation);
        return assistant;
    }

    @Transactional
    public void touchWithTitle(UUID tenantId, UUID userId, UUID conversationId, String userPrompt) {
        ChatConversation conversation = conversation(tenantId, userId, conversationId);
        conversation.touchNow();
        if ("New conversation".equals(conversation.getTitle())) {
            String title = userPrompt.trim();
            conversation.setTitle(title.length() > 60 ? title.substring(0, 60) : title);
        }
        conversations.save(conversation);
    }

    private ChatConversation conversation(UUID tenantId, UUID userId, UUID id) {
        return conversations.findByIdAndTenantIdAndUserId(id, tenantId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
    }
}
