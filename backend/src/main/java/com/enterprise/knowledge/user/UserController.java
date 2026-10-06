package com.enterprise.knowledge.user;

import com.enterprise.knowledge.common.tenant.TenantContext;
import com.enterprise.knowledge.user.dto.CreateUserRequest;
import com.enterprise.knowledge.user.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserAdminService userAdminService;

    public UserController(UserAdminService userAdminService) {
        this.userAdminService = userAdminService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse create(@Valid @RequestBody CreateUserRequest request) {

        AppUser user = userAdminService.create(
                TenantContext.getRequired(),
                request
        );

        return UserResponse.from(user);
    }
}
