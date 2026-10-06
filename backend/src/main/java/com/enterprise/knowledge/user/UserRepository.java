package com.enterprise.knowledge.user;
import java.util.List;import java.util.Optional;import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;import org.springframework.data.jpa.repository.JpaRepository;
public interface UserRepository extends JpaRepository<AppUser,UUID>{
@EntityGraph(attributePaths={"tenant","department"}) Optional<AppUser> findByTenantIdAndEmail(UUID tenantId,String email);
@EntityGraph(attributePaths={"tenant","department"}) Optional<AppUser> findByIdAndTenantId(UUID id,UUID tenantId);
@EntityGraph(attributePaths={"tenant","department"}) List<AppUser> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
@EntityGraph(attributePaths={"tenant","department"}) List<AppUser> findAllByTenantIdAndDepartmentIdOrderByCreatedAtDesc(UUID tenantId,UUID departmentId);
@EntityGraph(attributePaths={"tenant","department"}) List<AppUser> findAllByTenantIdAndDepartmentIdAndRoleOrderByCreatedAtDesc(UUID tenantId,UUID departmentId,UserRole role);
boolean existsByTenantIdAndEmail(UUID tenantId,String email); boolean existsByTenantIdAndEmailAndIdNot(UUID tenantId,String email,UUID id);
long countByDepartmentId(UUID departmentId); long countByTenantIdAndRoleAndActiveTrue(UUID tenantId,UserRole role);
}