package com.enterprise.knowledge.chat;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "chat_messages", indexes = {
        @Index(name = "idx_chat_messages_conversation", columnList = "conversation_id,created_at")
})
public class ChatMessage {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private ChatConversation conversation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ChatMessageRole role;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(length = 50)
    private String provider;

    @Column(length = 150)
    private String model;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected ChatMessage() {}

    public ChatMessage(UUID id, ChatConversation conversation, ChatMessageRole role,
                       String content, String provider, String model) {
        this.id = id;
        this.conversation = conversation;
        this.role = role;
        this.content = content;
        this.provider = provider;
        this.model = model;
    }

    public UUID getId() { return id; }
    public ChatConversation getConversation() { return conversation; }
    public ChatMessageRole getRole() { return role; }
    public String getContent() { return content; }
    public String getProvider() { return provider; }
    public String getModel() { return model; }
    public Instant getCreatedAt() { return createdAt; }
}
