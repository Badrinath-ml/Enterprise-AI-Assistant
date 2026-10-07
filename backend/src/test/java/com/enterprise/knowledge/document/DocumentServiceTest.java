package com.enterprise.knowledge.document;

import com.enterprise.knowledge.common.exception.ResourceNotFoundException;
import com.enterprise.knowledge.department.Department;
import com.enterprise.knowledge.department.DepartmentRepository;
import com.enterprise.knowledge.document.dto.DocumentResponse;
import com.enterprise.knowledge.document.dto.DocumentStatsResponse;
import com.enterprise.knowledge.document.ingestion.DocumentIngestionRequestedEvent;
import com.enterprise.knowledge.document.storage.FileStorageService;
import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.tenant.TenantRepository;
import com.enterprise.knowledge.user.AppUser;
import com.enterprise.knowledge.user.UserRole;
import com.enterprise.knowledge.user.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private UserService userService;

    @Mock
    private FileStorageService storage;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private DocumentService documentService;

    private UUID tenantId;
    private UUID actorId;
    private Tenant tenant;
    private Department department;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        actorId = UUID.randomUUID();
        tenant = new Tenant(tenantId, "Acme Corp", "acme-corp");
        department = new Department(UUID.randomUUID(), tenant, "Engineering");
    }

    @Test
    @DisplayName("Employee role cannot upload documents")
    void employeeCannotUpload() {
        AppUser employee = new AppUser(actorId, tenant, department, "Emp", "emp@acme.com", "hash", UserRole.EMPLOYEE);
        when(userService.findByIdAndTenant(actorId, tenantId)).thenReturn(employee);

        MockMultipartFile file = new MockMultipartFile("file", "doc.pdf", "application/pdf", "content".getBytes());

        assertThatThrownBy(() -> documentService.create(tenantId, actorId, file, "Title", "Desc", null))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Only administrators and managers can upload documents");
    }

    @Test
    @DisplayName("Admin can upload valid document")
    void adminCanUpload() throws IOException {
        AppUser admin = new AppUser(actorId, tenant, null, "Admin", "admin@acme.com", "hash", UserRole.ADMIN);
        when(userService.findByIdAndTenant(actorId, tenantId)).thenReturn(admin);
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));

        MockMultipartFile file = new MockMultipartFile("file", "handbook.pdf", "application/pdf", "PDF test data".getBytes());
        FileStorageService.StoredFile stored = new FileStorageService.StoredFile(
                "tenants/test/handbook.pdf", "handbook.pdf", "application/pdf", 13L
        );
        when(storage.store(eq(tenantId), any(UUID.class), eq(1), eq(file))).thenReturn(stored);
        when(documentRepository.save(any(Document.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DocumentResponse response = documentService.create(tenantId, actorId, file, "Employee Handbook", "Handbook notes", null);

        assertThat(response).isNotNull();
        assertThat(response.title()).isEqualTo("Employee Handbook");
        assertThat(response.originalFileName()).isEqualTo("handbook.pdf");
        verify(eventPublisher).publishEvent(any(DocumentIngestionRequestedEvent.class));
    }

    @Test
    @DisplayName("Manager cannot upload to a different department than their assigned department")
    void managerCannotUploadToDifferentDepartment() {
        AppUser manager = new AppUser(actorId, tenant, department, "Manager", "manager@acme.com", "hash", UserRole.MANAGER);
        when(userService.findByIdAndTenant(actorId, tenantId)).thenReturn(manager);

        MockMultipartFile file = new MockMultipartFile("file", "spec.pdf", "application/pdf", "data".getBytes());
        UUID otherDeptId = UUID.randomUUID();

        assertThatThrownBy(() -> documentService.create(tenantId, actorId, file, "Spec", null, otherDeptId))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Managers can only use their own department");
    }

    @Test
    @DisplayName("Upload rejects unsupported file types")
    void uploadRejectsUnsupportedFileType() {
        AppUser admin = new AppUser(actorId, tenant, null, "Admin", "admin@acme.com", "hash", UserRole.ADMIN);
        when(userService.findByIdAndTenant(actorId, tenantId)).thenReturn(admin);

        MockMultipartFile file = new MockMultipartFile("file", "script.exe", "application/octet-stream", "bad binary".getBytes());

        assertThatThrownBy(() -> documentService.create(tenantId, actorId, file, "Malware", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only PDF, DOCX, and TXT files are supported");
    }

    @Test
    @DisplayName("Upload rejects files exceeding 25 MB")
    void uploadRejectsOversizedFile() {
        AppUser admin = new AppUser(actorId, tenant, null, "Admin", "admin@acme.com", "hash", UserRole.ADMIN);
        when(userService.findByIdAndTenant(actorId, tenantId)).thenReturn(admin);

        byte[] bigData = new byte[26 * 1024 * 1024];
        MockMultipartFile file = new MockMultipartFile("file", "big.pdf", "application/pdf", bigData);

        assertThatThrownBy(() -> documentService.create(tenantId, actorId, file, "Huge", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("File size must be 25 MB or less");
    }

    @Test
    @DisplayName("Accessing non-existent document or document in another tenant throws ResourceNotFoundException")
    void nonExistentDocumentThrows404() {
        AppUser admin = new AppUser(actorId, tenant, null, "Admin", "admin@acme.com", "hash", UserRole.ADMIN);
        when(userService.findByIdAndTenant(actorId, tenantId)).thenReturn(admin);

        UUID docId = UUID.randomUUID();
        when(documentRepository.findByIdAndTenantId(docId, tenantId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> documentService.get(tenantId, actorId, docId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Document not found");
    }

    @Test
    @DisplayName("Employee cannot approve documents")
    void employeeCannotApproveDocument() {
        AppUser employee = new AppUser(actorId, tenant, department, "Emp", "emp@acme.com", "hash", UserRole.EMPLOYEE);
        when(userService.findByIdAndTenant(actorId, tenantId)).thenReturn(employee);

        UUID docId = UUID.randomUUID();
        Document doc = new Document(docId, tenant, department, employee, "Doc", null, "doc.pdf", "key", "application/pdf", 100);
        when(documentRepository.findByIdAndTenantId(docId, tenantId)).thenReturn(Optional.of(doc));

        assertThatThrownBy(() -> documentService.approve(tenantId, actorId, docId))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Only administrators and managers can manage documents");
    }

    @Test
    @DisplayName("Manager cannot approve document belonging to another department")
    void managerCannotApproveOtherDeptDocument() {
        AppUser manager = new AppUser(actorId, tenant, department, "Mgr", "mgr@acme.com", "hash", UserRole.MANAGER);
        when(userService.findByIdAndTenant(actorId, tenantId)).thenReturn(manager);

        Department otherDept = new Department(UUID.randomUUID(), tenant, "Sales");
        UUID docId = UUID.randomUUID();
        Document doc = new Document(docId, tenant, otherDept, manager, "Doc", null, "doc.pdf", "key", "application/pdf", 100);
        when(documentRepository.findByIdAndTenantId(docId, tenantId)).thenReturn(Optional.of(doc));

        assertThatThrownBy(() -> documentService.approve(tenantId, actorId, docId))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("You do not have access to this document");
    }

    @Test
    @DisplayName("Replace content increments version and publishes ingestion event")
    void replaceContentIncrementsVersion() throws IOException {
        AppUser admin = new AppUser(actorId, tenant, null, "Admin", "admin@acme.com", "hash", UserRole.ADMIN);
        when(userService.findByIdAndTenant(actorId, tenantId)).thenReturn(admin);

        UUID docId = UUID.randomUUID();
        Document doc = new Document(docId, tenant, null, admin, "Doc", null, "doc_v1.pdf", "key_v1", "application/pdf", 100);
        assertThat(doc.getVersion()).isEqualTo(1);

        when(documentRepository.findByIdAndTenantId(docId, tenantId)).thenReturn(Optional.of(doc));

        MockMultipartFile newFile = new MockMultipartFile("file", "doc_v2.pdf", "application/pdf", "version 2 content".getBytes());
        FileStorageService.StoredFile stored = new FileStorageService.StoredFile("key_v2", "doc_v2.pdf", "application/pdf", 15L);
        when(storage.store(tenantId, docId, 2, newFile)).thenReturn(stored);
        when(documentRepository.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));

        DocumentResponse response = documentService.replaceContent(tenantId, actorId, docId, newFile);

        assertThat(response).isNotNull();
        assertThat(response.version()).isEqualTo(2);
        assertThat(response.originalFileName()).isEqualTo("doc_v2.pdf");
        verify(storage).delete("key_v1");
        verify(eventPublisher).publishEvent(any(DocumentIngestionRequestedEvent.class));
    }

    @Test
    @DisplayName("Document stats aggregates counts accurately")
    void getStatsReturnsAccurateCounts() {
        when(documentRepository.countByTenantId(tenantId)).thenReturn(10L);
        when(documentRepository.countByTenantIdAndStatus(tenantId, DocumentStatus.APPROVED)).thenReturn(8L);
        when(documentRepository.countByTenantIdAndIngestionStatus(tenantId, IngestionStatus.INDEXED)).thenReturn(7L);
        when(documentRepository.countByTenantIdAndIngestionStatus(tenantId, IngestionStatus.FAILED)).thenReturn(1L);

        DocumentStatsResponse stats = documentService.getStats(tenantId);

        assertThat(stats.totalDocuments()).isEqualTo(10L);
        assertThat(stats.approvedDocuments()).isEqualTo(8L);
        assertThat(stats.indexedDocuments()).isEqualTo(7L);
        assertThat(stats.failedDocuments()).isEqualTo(1L);
    }
}
