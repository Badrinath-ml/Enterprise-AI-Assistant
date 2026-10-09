package com.enterprise.knowledge.chat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChatConversationAttachmentRepository extends JpaRepository<ChatConversationAttachment, UUID> {
    List<ChatConversationAttachment> findByConversationId(UUID conversationId);
    Optional<ChatConversationAttachment> findByIdAndConversationId(UUID id, UUID conversationId);
    Optional<ChatConversationAttachment> findByIdAndTenantIdAndUserId(UUID id, UUID tenantId, UUID userId);
    Optional<ChatConversationAttachment> findByIdAndTenantId(UUID id, UUID tenantId);
}
