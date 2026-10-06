package com.enterprise.knowledge.auth.dto;

import java.util.UUID;

public record RegisterResponse(
        UUID userId,
        UUID tenantId,
        String name,
        String email,
        String role
) {}
