package com.enterprise.knowledge.document;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID>, JpaSpecificationExecutor<Document> {

    Optional<Document> findByIdAndTenantId(UUID id, UUID tenantId);

    long countByTenantId(UUID tenantId);

    long countByTenantIdAndStatus(UUID tenantId, DocumentStatus status);

    long countByTenantIdAndIngestionStatus(UUID tenantId, IngestionStatus ingestionStatus);

    boolean existsByTenantIdAndOriginalFileName(UUID tenantId, String originalFileName);
}
