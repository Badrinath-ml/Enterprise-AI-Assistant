package com.enterprise.knowledge.document;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.jpa.domain.Specification;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@SuppressWarnings({"rawtypes", "unchecked"})
class DocumentSpecificationsTest {

    @Mock
    private Root<Document> root;

    @Mock
    private CriteriaQuery<?> query;

    @Mock
    private CriteriaBuilder cb;

    @Mock
    private Path tenantPath;

    @Mock
    private Path departmentPath;

    @Mock
    private Path statusPath;

    @Mock
    private Path titlePath;

    @Mock
    private Path fileNamePath;

    @Mock
    private Path descPath;

    @Mock
    private Predicate tenantPredicate;

    @Mock
    private Predicate statusPredicate;

    @Mock
    private Predicate deptPredicate;

    @Mock
    private Predicate searchPredicate;

    @BeforeEach
    void setUp() {
        lenient().doReturn(tenantPath).when(root).get("tenant");
        lenient().doReturn(mock(Path.class)).when(tenantPath).get("id");
        lenient().doReturn(departmentPath).when(root).get("department");
        lenient().doReturn(mock(Path.class)).when(departmentPath).get("id");
        lenient().doReturn(statusPath).when(root).get("status");
        lenient().doReturn(titlePath).when(root).get("title");
        lenient().doReturn(fileNamePath).when(root).get("originalFileName");
        lenient().doReturn(descPath).when(root).get("description");

        lenient().when(cb.equal(any(), any())).thenReturn(tenantPredicate);
        lenient().when(cb.isNull(any())).thenReturn(deptPredicate);
        lenient().when(cb.or(any(Predicate[].class))).thenReturn(searchPredicate);
        lenient().when(cb.or(any(Predicate.class), any(Predicate.class))).thenReturn(deptPredicate);
        lenient().when(cb.and(any(Predicate[].class))).thenReturn(mock(Predicate.class));
    }

    @Test
    @DisplayName("Admin search with no optional filters adds only tenant predicate")
    void adminSearchWithNoFilters() {
        UUID tenantId = UUID.randomUUID();
        Specification<Document> spec = DocumentSpecifications.forSearch(
                tenantId, true, null, null, null, null
        );

        spec.toPredicate(root, query, cb);

        verify(cb).equal(any(), eq(tenantId));
        verify(cb, never()).isNull(departmentPath);
    }

    @Test
    @DisplayName("Admin search with department filter and status filter")
    void adminSearchWithDeptAndStatus() {
        UUID tenantId = UUID.randomUUID();
        UUID deptId = UUID.randomUUID();
        Specification<Document> spec = DocumentSpecifications.forSearch(
                tenantId, true, null, deptId, DocumentStatus.APPROVED, null
        );

        spec.toPredicate(root, query, cb);

        verify(cb).equal(any(), eq(tenantId));
        verify(cb).equal(any(), eq(deptId));
        verify(cb).equal(any(), eq(DocumentStatus.APPROVED));
    }

    @Test
    @DisplayName("Non-admin search scopes to user department or organization-wide documents")
    void nonAdminSearchScopesToDepartment() {
        UUID tenantId = UUID.randomUUID();
        UUID userDeptId = UUID.randomUUID();
        Specification<Document> spec = DocumentSpecifications.forSearch(
                tenantId, false, userDeptId, null, null, null
        );

        spec.toPredicate(root, query, cb);

        verify(cb).equal(any(), eq(tenantId));
        verify(cb).isNull(departmentPath);
        verify(cb).equal(any(), eq(userDeptId));
    }

    @Test
    @DisplayName("Search query generates case-insensitive like predicates without parameter errors")
    void searchQueryGeneratesLikePredicates() {
        UUID tenantId = UUID.randomUUID();
        Specification<Document> spec = DocumentSpecifications.forSearch(
                tenantId, true, null, null, null, "Financial Report"
        );

        spec.toPredicate(root, query, cb);

        verify(cb, atLeastOnce()).like(any(), eq("%financial report%"));
    }
}
