package com.enterprise.knowledge.auth;

import com.enterprise.knowledge.auth.dto.LoginRequest;
import com.enterprise.knowledge.auth.dto.LoginResponse;
import com.enterprise.knowledge.auth.dto.RegisterRequest;
import com.enterprise.knowledge.auth.dto.RegisterResponse;
import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.tenant.TenantRepository;
import com.enterprise.knowledge.user.AppUser;
import com.enterprise.knowledge.user.UserRole;
import com.enterprise.knowledge.user.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final TenantRepository tenantRepository;
    private final UserService userService;
    private final JwtTokenService jwtTokenService;

    public AuthController(TenantRepository tenantRepository, UserService userService,
                          JwtTokenService jwtTokenService) {
        this.tenantRepository = tenantRepository;
        this.userService = userService;
        this.jwtTokenService = jwtTokenService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterResponse register(@Valid @RequestBody RegisterRequest request) {
        if (tenantRepository.findBySlug(request.tenantSlug()).isPresent()) {
            throw new IllegalArgumentException(
                    "This organization already exists. Public registration can only create a new organization."
            );
        }

        Tenant tenant = tenantRepository.save(
                new Tenant(request.tenantName(), request.tenantSlug())
        );

        AppUser user = userService.createUser(
                tenant.getId(), request.name(), request.email(), request.password(),
                null, UserRole.ADMIN
        );

        return new RegisterResponse(
                user.getId(), tenant.getId(), user.getName(), user.getEmail(), user.getRole().name()
        );
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        Tenant tenant = tenantRepository.findBySlug(request.tenantSlug())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        AppUser user = userService.findByTenantAndEmail(
                tenant.getId(), request.email().toLowerCase().trim()
        );

        if (!user.isActive() || !userService.matchesPassword(user, request.password())) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        return new LoginResponse(
                jwtTokenService.createAccessToken(user), "Bearer", user.getId(),
                user.getTenant().getId(), user.getName(), user.getEmail(), user.getRole().name()
        );
    }
}
