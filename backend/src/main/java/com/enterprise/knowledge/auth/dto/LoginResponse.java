package com.enterprise.knowledge.auth.dto;

import java.util.UUID;

public record LoginResponse(
        String accessToken,
        String tokenType,
        UUID userId,
        UUID tenantId,
        String name,
        String email,
        String role
) {}
