package com.enterprise.knowledge.tenant;

import com.enterprise.knowledge.common.tenant.TenantContext;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tenant")
public class TenantController {

    private final TenantRepository tenantRepository;

    public TenantController(TenantRepository tenantRepository) {
        this.tenantRepository = tenantRepository;
    }

    @GetMapping("/me")
    public TenantResponse currentTenant() {
        Tenant tenant = tenantRepository.findById(TenantContext.getRequired())
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found"));

        return new TenantResponse(
                tenant.getId(),
                tenant.getName(),
                tenant.getSlug()
        );
    }

    public record TenantResponse(
            java.util.UUID id,
            String name,
            String slug
    ) {}
}
