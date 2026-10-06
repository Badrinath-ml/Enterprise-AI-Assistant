package com.enterprise.knowledge.department;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DepartmentRepository extends JpaRepository<Department, UUID> {
    List<Department> findAllByTenantId(UUID tenantId);
    boolean existsByIdAndTenantId(UUID id, UUID tenantId);
}
