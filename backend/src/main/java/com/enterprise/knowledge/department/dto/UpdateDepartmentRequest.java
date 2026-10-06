package com.enterprise.knowledge.department.dto;
import jakarta.validation.constraints.NotBlank;import jakarta.validation.constraints.Size;
public record UpdateDepartmentRequest(@NotBlank @Size(max=100) String name){}
