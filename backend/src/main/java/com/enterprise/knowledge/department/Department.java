package com.enterprise.knowledge.department;

import com.enterprise.knowledge.tenant.Tenant;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(
        name = "departments",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_department_tenant_name",
                columnNames = {"tenant_id", "name"}
        )
)
public class Department {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, length = 100)
    private String name;

    protected Department() {}

    public Department(Tenant tenant, String name) {
        this.tenant = tenant;
        this.name = name;
    }

    public UUID getId() { return id; }
    public Tenant getTenant() { return tenant; }
    public String getName() { return name; }
}
