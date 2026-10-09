package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.document.IngestionStatus;
import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.user.AppUser;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "chat_conversation_attachments", indexes = {
        @Index(name = "idx_chat_conversation_attachments_conv", columnList = "conversation_id,created_at"),
        @Index(name = "idx_chat_conversation_attachments_user", columnList = "tenant_id,user_id")
})
public class ChatConversationAttachment {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private ChatConversation conversation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "mime_type", nullable = false, length = 100)
    private String mimeType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "ingestion_status", nullable = false, length = 30)
    private IngestionStatus ingestionStatus = IngestionStatus.INDEXED;

    @Column(name = "ingestion_error", length = 2000)
    private String ingestionError;

    @Column(name = "indexed_chunk_count", nullable = false)
    private int indexedChunkCount = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected ChatConversationAttachment() {}

    public ChatConversationAttachment(UUID id, Tenant tenant, ChatConversation conversation, AppUser user,
                                      String fileName, String mimeType, long fileSize, String storageKey) {
        this.id = id;
        this.tenant = tenant;
        this.conversation = conversation;
        this.user = user;
        this.fileName = fileName;
        this.mimeType = mimeType;
        this.fileSize = fileSize;
        this.storageKey = storageKey;
        this.ingestionStatus = IngestionStatus.INDEXED;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Tenant getTenant() { return tenant; }
    public ChatConversation getConversation() { return conversation; }
    public AppUser getUser() { return user; }
    public String getFileName() { return fileName; }
    public String getMimeType() { return mimeType; }
    public long getFileSize() { return fileSize; }
    public String getStorageKey() { return storageKey; }
    public IngestionStatus getIngestionStatus() { return ingestionStatus; }
    public String getIngestionError() { return ingestionError; }
    public int getIndexedChunkCount() { return indexedChunkCount; }
    public Instant getCreatedAt() { return createdAt; }

    public void setIngestionStatus(IngestionStatus ingestionStatus) { this.ingestionStatus = ingestionStatus; }
    public void setIngestionError(String ingestionError) { this.ingestionError = ingestionError; }
    public void setIndexedChunkCount(int indexedChunkCount) { this.indexedChunkCount = indexedChunkCount; }
}
