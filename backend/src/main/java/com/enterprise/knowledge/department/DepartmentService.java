package com.enterprise.knowledge.department;

import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.tenant.TenantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final TenantRepository tenantRepository;

    public DepartmentService(
            DepartmentRepository departmentRepository,
            TenantRepository tenantRepository) {
        this.departmentRepository = departmentRepository;
        this.tenantRepository = tenantRepository;
    }

    @Transactional(readOnly = true)
    public List<Department> findAll(UUID tenantId) {
        return departmentRepository.findAllByTenantId(tenantId);
    }

    @Transactional
    public Department create(UUID tenantId, String name) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found"));

        return departmentRepository.save(new Department(tenant, name.trim()));
    }
}
