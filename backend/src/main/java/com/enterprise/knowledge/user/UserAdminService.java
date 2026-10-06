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
    public AppUser create(UUID tenantId, CreateUserRequest request) {
        return userService.createUser(
                tenantId,
                request.name(),
                request.email(),
                request.password(),
                request.departmentId(),
                request.role()
        );
    }
}
