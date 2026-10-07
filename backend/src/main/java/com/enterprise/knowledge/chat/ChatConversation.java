package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.user.AppUser;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "chat_conversations", indexes = {
        @Index(name = "idx_chat_conversations_user", columnList = "tenant_id,user_id,updated_at")
})
public class ChatConversation {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    protected ChatConversation() {}

    public ChatConversation(UUID id, Tenant tenant, AppUser user, String title) {
        this.id = id;
        this.tenant = tenant;
        this.user = user;
        this.title = title;
    }

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Tenant getTenant() { return tenant; }
    public AppUser getUser() { return user; }
    public String getTitle() { return title; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void setTitle(String title) { this.title = title; }
    public void touchNow() { this.updatedAt = Instant.now(); }
}
