package com.enterprise.knowledge.user;

import com.enterprise.knowledge.common.tenant.TenantContext;
import com.enterprise.knowledge.user.dto.CreateUserRequest;
import com.enterprise.knowledge.user.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    private final UserAdminService userAdminService;
    private final UserService userService;

    public UserController(UserAdminService userAdminService, UserService userService) {
        this.userAdminService = userAdminService;
        this.userService = userService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public List<UserResponse> getUsers(
            @RequestParam(required = false) String departmentId,
            @AuthenticationPrincipal Jwt jwt) {
        UUID tenantId = TenantContext.getRequired();
        AppUser actor = userService.findByIdAndTenant(UUID.fromString(jwt.getSubject()), tenantId);

        UUID requestedDepartment = departmentId == null || departmentId.isBlank()
                ? null : UUID.fromString(departmentId);

        if (actor.getRole() == UserRole.MANAGER) {
            requestedDepartment = actor.getDepartment() == null
                    ? null : actor.getDepartment().getId();
        }

        if (actor.getRole() == UserRole.MANAGER && actor.getDepartment() == null) {
            return List.of();
        }

        return userService.findUsers(tenantId, requestedDepartment)
                .stream().map(UserResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public UserResponse create(@Valid @RequestBody CreateUserRequest request,
                               @AuthenticationPrincipal Jwt jwt) {
        return UserResponse.from(userAdminService.create(
                TenantContext.getRequired(), UUID.fromString(jwt.getSubject()), request
        ));
    }
}
