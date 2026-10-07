package com.enterprise.knowledge.document;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public final class DocumentSpecifications {

    private DocumentSpecifications() {}

    public static Specification<Document> forSearch(
            UUID tenantId,
            boolean isAdmin,
            UUID scopeDepartmentId,
            UUID departmentFilter,
            DocumentStatus status,
            String searchQuery) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 1. Mandatory Tenant Isolation
            predicates.add(cb.equal(root.get("tenant").get("id"), tenantId));

            // 2. Department Scoping / Filtering
            if (isAdmin) {
                if (departmentFilter != null) {
                    predicates.add(cb.equal(root.get("department").get("id"), departmentFilter));
                }
            } else {
                if (scopeDepartmentId != null) {
                    predicates.add(cb.or(
                            cb.isNull(root.get("department")),
                            cb.equal(root.get("department").get("id"), scopeDepartmentId)
                    ));
                } else {
                    predicates.add(cb.isNull(root.get("department")));
                }
            }

            // 3. Status Filter
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            // 4. Type-safe search query without parameter-type ambiguity (no :q IS NULL or lower(bytea))
            if (searchQuery != null && !searchQuery.isBlank()) {
                String pattern = "%" + searchQuery.trim().toLowerCase(Locale.ROOT) + "%";
                Predicate titleLike = cb.like(cb.lower(root.get("title")), pattern);
                Predicate fileNameLike = cb.like(cb.lower(root.get("originalFileName")), pattern);
                Predicate descLike = cb.like(cb.lower(cb.coalesce(root.get("description"), "")), pattern);
                predicates.add(cb.or(titleLike, fileNameLike, descLike));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
