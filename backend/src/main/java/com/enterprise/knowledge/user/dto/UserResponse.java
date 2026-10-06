package com.enterprise.knowledge.user.dto;

import com.enterprise.knowledge.user.AppUser;
import java.time.Instant;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String name,
        String email,
        String role,
        UUID departmentId,
        boolean active,
        Instant createdAt
) {
    public static UserResponse from(AppUser user) {
        return new UserResponse(
                user.getId(), user.getName(), user.getEmail(), user.getRole().name(),
                user.getDepartment() == null ? null : user.getDepartment().getId(),
                user.isActive(), user.getCreatedAt()
        );
    }
}
