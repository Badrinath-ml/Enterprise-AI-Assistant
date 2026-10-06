package com.enterprise.knowledge.document;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    @Query("""
        select d from Document d
        where d.tenant.id = :tenantId
          and (:status is null or d.status = :status)
          and (
              :q is null
              or lower(d.title) like lower(concat('%', :q, '%'))
              or lower(coalesce(d.description, '')) like lower(concat('%', :q, '%'))
              or lower(d.originalFileName) like lower(concat('%', :q, '%'))
          )
        order by d.updatedAt desc
        """)
    Page<Document> searchAdmin(
            @Param("tenantId") UUID tenantId,
            @Param("status") DocumentStatus status,
            @Param("q") String q,
            Pageable pageable
    );

    @Query("""
        select d from Document d
        where d.tenant.id = :tenantId
          and d.department.id = :departmentFilter
          and (:status is null or d.status = :status)
          and (
              :q is null
              or lower(d.title) like lower(concat('%', :q, '%'))
              or lower(coalesce(d.description, '')) like lower(concat('%', :q, '%'))
              or lower(d.originalFileName) like lower(concat('%', :q, '%'))
          )
        order by d.updatedAt desc
        """)
    Page<Document> searchAdminByDepartment(
            @Param("tenantId") UUID tenantId,
            @Param("departmentFilter") UUID departmentFilter,
            @Param("status") DocumentStatus status,
            @Param("q") String q,
            Pageable pageable
    );

    @Query("""
        select d from Document d
        where d.tenant.id = :tenantId
          and (d.department is null or d.department.id = :departmentId)
          and (:status is null or d.status = :status)
          and (
              :q is null
              or lower(d.title) like lower(concat('%', :q, '%'))
              or lower(coalesce(d.description, '')) like lower(concat('%', :q, '%'))
              or lower(d.originalFileName) like lower(concat('%', :q, '%'))
          )
        order by d.updatedAt desc
        """)
    Page<Document> searchDepartment(
            @Param("tenantId") UUID tenantId,
            @Param("departmentId") UUID departmentId,
            @Param("status") DocumentStatus status,
            @Param("q") String q,
            Pageable pageable
    );

    Optional<Document> findByIdAndTenantId(UUID id, UUID tenantId);
}
