package com.enterprise.knowledge.user;

import com.enterprise.knowledge.common.exception.ResourceNotFoundException;
import com.enterprise.knowledge.department.Department;
import com.enterprise.knowledge.department.DepartmentRepository;
import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.tenant.TenantRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       TenantRepository tenantRepository,
                       DepartmentRepository departmentRepository,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.departmentRepository = departmentRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public AppUser findByTenantAndEmail(UUID tenantId, String email) {
        return userRepository.findByTenantIdAndEmail(tenantId, email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
    }

    @Transactional(readOnly = true)
    public AppUser findByIdAndTenant(UUID userId, UUID tenantId) {
        return userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @Transactional(readOnly = true)
    public List<AppUser> findUsers(UUID tenantId, UUID departmentId) {
        return departmentId == null
                ? userRepository.findAllByTenantIdOrderByCreatedAtDesc(tenantId)
                : userRepository.findAllByTenantIdAndDepartmentIdOrderByCreatedAtDesc(tenantId, departmentId);
    }

    @Transactional(readOnly = true)
    public List<AppUser> findEmployees(UUID tenantId, UUID departmentId) {
        return userRepository.findAllByTenantIdAndDepartmentIdAndRoleOrderByCreatedAtDesc(tenantId, departmentId, UserRole.EMPLOYEE);
    }

    @Transactional(readOnly = true)
    public Department findDepartment(UUID tenantId, UUID departmentId) {
        return departmentRepository.findById(departmentId)
                .filter(d -> d.getTenant().getId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("Department does not belong to this organization"));
    }

    @Transactional
    public AppUser createUser(UUID tenantId, String name, String email, String rawPassword, UUID departmentId, UserRole role) {
        String normalizedEmail = email.toLowerCase().trim();
        if (userRepository.existsByTenantIdAndEmail(tenantId, normalizedEmail)) {
            throw new IllegalArgumentException("A user with this email already exists");
        }
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));
        Department department = departmentId == null ? null : findDepartment(tenantId, departmentId);
        return userRepository.save(new AppUser(tenant, department, name.trim(), normalizedEmail, passwordEncoder.encode(rawPassword), role));
    }

    @Transactional
    public AppUser updateUser(UUID tenantId, AppUser user, String name, String email, UUID departmentId, UserRole role, boolean active) {
        String normalizedEmail = email.toLowerCase().trim();
        if (userRepository.existsByTenantIdAndEmailAndIdNot(tenantId, normalizedEmail, user.getId())) {
            throw new IllegalArgumentException("A user with this email already exists");
        }
        Department department = departmentId == null ? null : findDepartment(tenantId, departmentId);
        user.setName(name.trim());
        user.setEmail(normalizedEmail);
        user.setDepartment(department);
        user.setRole(role);
        user.setActive(active);
        return userRepository.save(user);
    }

    @Transactional
    public void changePassword(UUID tenantId, UUID userId, String currentPassword, String newPassword) {
        AppUser user = findByIdAndTenant(userId, tenantId);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    public boolean matchesPassword(AppUser user, String rawPassword) {
        return passwordEncoder.matches(rawPassword, user.getPasswordHash());
    }
}