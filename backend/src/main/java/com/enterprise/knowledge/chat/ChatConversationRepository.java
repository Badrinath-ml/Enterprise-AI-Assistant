package com.enterprise.knowledge.chat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChatConversationRepository extends JpaRepository<ChatConversation, UUID> {
    List<ChatConversation> findByTenantIdAndUserIdOrderByUpdatedAtDesc(UUID tenantId, UUID userId);
    Optional<ChatConversation> findByIdAndTenantIdAndUserId(UUID id, UUID tenantId, UUID userId);
    long countById(UUID id);
}
