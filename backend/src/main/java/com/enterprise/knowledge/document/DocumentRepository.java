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
          and (:q = '' or lower(d.title) like concat('%', lower(:q), '%')
               or lower(coalesce(d.description, '')) like concat('%', lower(:q), '%')
               or lower(d.originalFileName) like concat('%', lower(:q), '%'))
        order by d.updatedAt desc
        """)
    Page<Document> searchAdmin(UUID tenantId, @Param("q") String q, Pageable pageable);

    @Query("""
        select d from Document d
        where d.tenant.id = :tenantId and d.status = :status
          and (:q = '' or lower(d.title) like concat('%', lower(:q), '%')
               or lower(coalesce(d.description, '')) like concat('%', lower(:q), '%')
               or lower(d.originalFileName) like concat('%', lower(:q), '%'))
        order by d.updatedAt desc
        """)
    Page<Document> searchAdminByStatus(UUID tenantId, @Param("status") DocumentStatus status,
                                       @Param("q") String q, Pageable pageable);

    @Query("""
        select d from Document d
        where d.tenant.id = :tenantId and d.department.id = :departmentId
          and (:q = '' or lower(d.title) like concat('%', lower(:q), '%')
               or lower(coalesce(d.description, '')) like concat('%', lower(:q), '%')
               or lower(d.originalFileName) like concat('%', lower(:q), '%'))
        order by d.updatedAt desc
        """)
    Page<Document> searchAdminByDepartment(UUID tenantId, @Param("departmentId") UUID departmentId,
                                           @Param("q") String q, Pageable pageable);

    @Query("""
        select d from Document d
        where d.tenant.id = :tenantId and d.department.id = :departmentId and d.status = :status
          and (:q = '' or lower(d.title) like concat('%', lower(:q), '%')
               or lower(coalesce(d.description, '')) like concat('%', lower(:q), '%')
               or lower(d.originalFileName) like concat('%', lower(:q), '%'))
        order by d.updatedAt desc
        """)
    Page<Document> searchAdminByDepartmentAndStatus(UUID tenantId, @Param("departmentId") UUID departmentId,
                                                    @Param("status") DocumentStatus status,
                                                    @Param("q") String q, Pageable pageable);

    @Query("""
        select d from Document d
        where d.tenant.id = :tenantId
          and (d.department is null or d.department.id = :departmentId)
          and (:q = '' or lower(d.title) like concat('%', lower(:q), '%')
               or lower(coalesce(d.description, '')) like concat('%', lower(:q), '%')
               or lower(d.originalFileName) like concat('%', lower(:q), '%'))
        order by d.updatedAt desc
        """)
    Page<Document> searchDepartment(UUID tenantId, @Param("departmentId") UUID departmentId,
                                   @Param("q") String q, Pageable pageable);

    @Query("""
        select d from Document d
        where d.tenant.id = :tenantId
          and (d.department is null or d.department.id = :departmentId)
          and d.status = :status
          and (:q = '' or lower(d.title) like concat('%', lower(:q), '%')
               or lower(coalesce(d.description, '')) like concat('%', lower(:q), '%')
               or lower(d.originalFileName) like concat('%', lower(:q), '%'))
        order by d.updatedAt desc
        """)
    Page<Document> searchDepartmentByStatus(UUID tenantId, @Param("departmentId") UUID departmentId,
                                            @Param("status") DocumentStatus status,
                                            @Param("q") String q, Pageable pageable);

    Optional<Document> findByIdAndTenantId(UUID id, UUID tenantId);
}
