package com.enterprise.knowledge.user;

import com.enterprise.knowledge.user.dto.CreateUserRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
public class UserAdminService {
    private final UserService userService;

    public UserAdminService(UserService userService) {
        this.userService = userService;
    }

    @Transactional
    public AppUser create(UUID tenantId, UUID actorId, CreateUserRequest request) {
        AppUser actor = userService.findByIdAndTenant(actorId, tenantId);

        if (actor.getRole() == UserRole.MANAGER) {
            if (request.role() != UserRole.EMPLOYEE) {
                throw new IllegalArgumentException("Managers can create employees only");
            }
            if (actor.getDepartment() == null) {
                throw new IllegalArgumentException("Manager is not assigned to a department");
            }
            if (request.departmentId() != null
                    && !actor.getDepartment().getId().equals(request.departmentId())) {
                throw new IllegalArgumentException("Managers can only add employees to their own department");
            }

            return userService.createUser(
                    tenantId, request.name(), request.email(), request.password(),
                    actor.getDepartment().getId(), UserRole.EMPLOYEE
            );
        }

        if (actor.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("You do not have permission to create users");
        }

        if (request.role() == UserRole.MANAGER && request.departmentId() == null) {
            throw new IllegalArgumentException("Managers must be assigned to a department");
        }

        return userService.createUser(
                tenantId, request.name(), request.email(), request.password(),
                request.departmentId(), request.role()
        );
    }
}
