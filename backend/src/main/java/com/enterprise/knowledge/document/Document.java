package com.enterprise.knowledge.document;

import com.enterprise.knowledge.department.Department;
import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.user.AppUser;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "documents", indexes = {
        @Index(name = "idx_documents_tenant_id", columnList = "tenant_id"),
        @Index(name = "idx_documents_department_id", columnList = "department_id"),
        @Index(name = "idx_documents_status", columnList = "status")
})
public class Document {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uploaded_by", nullable = false)
    private AppUser uploadedBy;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(length = 2000)
    private String description;

    @Column(name = "original_file_name", nullable = false, length = 255)
    private String originalFileName;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "mime_type", nullable = false, length = 180)
    private String mimeType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DocumentStatus status = DocumentStatus.DRAFT;

    @Column(nullable = false)
    private int version = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "ingestion_status", nullable = false, length = 30)
    private IngestionStatus ingestionStatus = IngestionStatus.NOT_INDEXED;

    @Column(name = "ingestion_error", length = 2000)
    private String ingestionError;

    @Column(name = "indexed_at")
    private Instant indexedAt;

    @Column(name = "indexed_chunk_count", nullable = false)
    private int indexedChunkCount = 0;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    protected Document() {}

    public Document(UUID id, Tenant tenant, Department department, AppUser uploadedBy,
                    String title, String description, String originalFileName,
                    String storageKey, String mimeType, long fileSize) {
        this.id = id;
        this.tenant = tenant;
        this.department = department;
        this.uploadedBy = uploadedBy;
        this.title = title;
        this.description = description;
        this.originalFileName = originalFileName;
        this.storageKey = storageKey;
        this.mimeType = mimeType;
        this.fileSize = fileSize;
    }

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Tenant getTenant() { return tenant; }
    public Department getDepartment() { return department; }
    public AppUser getUploadedBy() { return uploadedBy; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getOriginalFileName() { return originalFileName; }
    public String getStorageKey() { return storageKey; }
    public String getMimeType() { return mimeType; }
    public long getFileSize() { return fileSize; }
    public DocumentStatus getStatus() { return status; }
    public int getVersion() { return version; }
    public IngestionStatus getIngestionStatus() { return ingestionStatus; }
    public String getIngestionError() { return ingestionError; }
    public Instant getIndexedAt() { return indexedAt; }
    public int getIndexedChunkCount() { return indexedChunkCount; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void setDepartment(Department department) { this.department = department; }
    public void setTitle(String title) { this.title = title; }
    public void setDescription(String description) { this.description = description; }
    public void setStatus(DocumentStatus status) { this.status = status; }
    public void setIngestionStatus(IngestionStatus status) { this.ingestionStatus = status; }
    public void setIngestionError(String error) { this.ingestionError = error; }
    public void setIndexedAt(Instant indexedAt) { this.indexedAt = indexedAt; }
    public void setIndexedChunkCount(int count) { this.indexedChunkCount = count; }
    public void replaceFile(String originalFileName, String storageKey, String mimeType, long fileSize) {
        this.originalFileName = originalFileName;
        this.storageKey = storageKey;
        this.mimeType = mimeType;
        this.fileSize = fileSize;
        this.version++;
        this.ingestionStatus = IngestionStatus.NOT_INDEXED;
        this.ingestionError = null;
        this.indexedAt = null;
        this.indexedChunkCount = 0;
    }
}
