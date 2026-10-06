package com.enterprise.knowledge.department;
import com.enterprise.knowledge.common.tenant.TenantContext;import com.enterprise.knowledge.department.dto.CreateDepartmentRequest;import com.enterprise.knowledge.department.dto.UpdateDepartmentRequest;import jakarta.validation.Valid;import org.springframework.http.HttpStatus;import org.springframework.security.access.prepost.PreAuthorize;import org.springframework.web.bind.annotation.*;import java.util.List;import java.util.UUID;
@RestController @RequestMapping("/api/v1/departments") public class DepartmentController{private final DepartmentService departmentService;public DepartmentController(DepartmentService departmentService){this.departmentService=departmentService;}
@GetMapping public List<DepartmentResponse> getDepartments(){return departmentService.findAll(TenantContext.getRequired()).stream().map(d->new DepartmentResponse(d.getId(),d.getName())).toList();}
@PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('ADMIN')") public DepartmentResponse create(@Valid @RequestBody CreateDepartmentRequest request){Department d=departmentService.create(TenantContext.getRequired(),request.name());return new DepartmentResponse(d.getId(),d.getName());}
@PutMapping("/{id}") @PreAuthorize("hasRole('ADMIN')") public DepartmentResponse update(@PathVariable UUID id,@Valid @RequestBody UpdateDepartmentRequest request){Department d=departmentService.update(TenantContext.getRequired(),id,request.name());return new DepartmentResponse(d.getId(),d.getName());}
@DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @PreAuthorize("hasRole('ADMIN')") public void delete(@PathVariable UUID id){departmentService.delete(TenantContext.getRequired(),id);}
public record DepartmentResponse(UUID id,String name){}
}
