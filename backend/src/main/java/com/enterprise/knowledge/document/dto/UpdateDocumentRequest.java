package com.enterprise.knowledge.document.dto;

import com.enterprise.knowledge.document.DocumentStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record UpdateDocumentRequest(
        @NotBlank @Size(max = 180) String title,
        @Size(max = 2000) String description,
        UUID departmentId,
        @NotNull DocumentStatus status
) {}
