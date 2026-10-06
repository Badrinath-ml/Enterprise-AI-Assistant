package com.enterprise.knowledge.department;

import com.enterprise.knowledge.common.tenant.TenantContext;
import com.enterprise.knowledge.department.dto.CreateDepartmentRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/departments")
public class DepartmentController {

    private final DepartmentService departmentService;

    public DepartmentController(DepartmentService departmentService) {
        this.departmentService = departmentService;
    }

    @GetMapping
    public List<DepartmentResponse> getDepartments() {
        return departmentService.findAll(TenantContext.getRequired())
                .stream()
                .map(d -> new DepartmentResponse(d.getId(), d.getName()))
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DepartmentResponse create(
            @Valid @RequestBody CreateDepartmentRequest request) {

        Department department = departmentService.create(
                TenantContext.getRequired(),
                request.name()
        );

        return new DepartmentResponse(department.getId(), department.getName());
    }

    public record DepartmentResponse(UUID id, String name) {}
}
