package com.enterprise.knowledge.chat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChatCitationRepository extends JpaRepository<ChatCitation, UUID> {
    List<ChatCitation> findByMessageIdOrderBySimilarityDesc(UUID messageId);
}
