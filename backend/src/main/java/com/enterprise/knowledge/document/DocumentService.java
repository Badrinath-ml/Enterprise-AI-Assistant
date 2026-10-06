package com.enterprise.knowledge.document;

import com.enterprise.knowledge.department.Department;
import com.enterprise.knowledge.department.DepartmentRepository;
import com.enterprise.knowledge.document.dto.DocumentPageResponse;
import com.enterprise.knowledge.document.dto.DocumentResponse;
import com.enterprise.knowledge.document.dto.UpdateDocumentRequest;
import com.enterprise.knowledge.document.storage.FileStorageService;
import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.tenant.TenantRepository;
import com.enterprise.knowledge.user.AppUser;
import com.enterprise.knowledge.user.UserRole;
import com.enterprise.knowledge.user.UserService;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Locale;
import java.util.UUID;

@Service
public class DocumentService {
    private static final long MAX_FILE_SIZE = 25L * 1024 * 1024;

    private final DocumentRepository documentRepository;
    private final DepartmentRepository departmentRepository;
    private final TenantRepository tenantRepository;
    private final UserService userService;
    private final FileStorageService storage;

    public DocumentService(DocumentRepository documentRepository,
                           DepartmentRepository departmentRepository,
                           TenantRepository tenantRepository,
                           UserService userService,
                           FileStorageService storage) {
        this.documentRepository = documentRepository;
        this.departmentRepository = departmentRepository;
        this.tenantRepository = tenantRepository;
        this.userService = userService;
        this.storage = storage;
    }

    @Transactional(readOnly = true)
    public DocumentPageResponse search(UUID tenantId, UUID actorId, String q,
                                       UUID departmentFilter, DocumentStatus status,
                                       int page, int size) {
        AppUser actor = userService.findByIdAndTenant(actorId, tenantId);
        int safeSize = Math.min(Math.max(size, 1), 50);
        int safePage = Math.max(page, 0);
        boolean admin = actor.getRole() == UserRole.ADMIN;
        UUID scopeDepartment = actor.getDepartment() == null ? null : actor.getDepartment().getId();

        if (!admin && departmentFilter != null && !departmentFilter.equals(scopeDepartment)) {
            throw new IllegalArgumentException("You can only browse documents in your department");
        }

        Pageable pageable = PageRequest.of(safePage, safeSize);
        String search = q == null || q.isBlank() ? null : q.trim();
        Page<Document> result;

        if (admin) {
            result = departmentFilter == null
                    ? documentRepository.searchAdmin(tenantId, status, search, pageable)
                    : documentRepository.searchAdminByDepartment(
                            tenantId, departmentFilter, status, search, pageable);
        } else {
            if (scopeDepartment == null) {
                result = Page.empty(pageable);
            } else {
                result = documentRepository.searchDepartment(
                        tenantId, scopeDepartment, status, search, pageable);
            }
        }
        return new DocumentPageResponse(
                result.getContent().stream().map(DocumentResponse::from).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()
        );
    }

    @Transactional
    public DocumentResponse create(UUID tenantId, UUID actorId, MultipartFile file,
                                   String title, String description, UUID departmentId) {
        AppUser actor = userService.findByIdAndTenant(actorId, tenantId);
        requireManagerOrAdmin(actor);
        validateFile(file);

        Department department = resolveDepartment(tenantId, actor, departmentId);
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found"));

        UUID documentId = UUID.randomUUID();
        FileStorageService.StoredFile stored = null;
        try {
            stored = storage.store(tenantId, documentId, 1, file);
            String cleanTitle = title == null || title.isBlank()
                    ? stripExtension(stored.originalFileName()) : title.trim();

            Document document = new Document(
                    tenant, department, actor, cleanTitle, blankToNull(description),
                    stored.originalFileName(), stored.storageKey(), normalizedMime(file, stored.originalFileName()),
                    stored.size()
            );
            documentRepository.save(document);
            return DocumentResponse.from(document);
        } catch (IOException | RuntimeException e) {
            if (stored != null) {
                try { storage.delete(stored.storageKey()); } catch (IOException ignored) {}
            }
            throw e instanceof RuntimeException runtime ? runtime : new IllegalArgumentException("Unable to store document");
        }
    }

    @Transactional
    public DocumentResponse update(UUID tenantId, UUID actorId, UUID documentId,
                                   UpdateDocumentRequest request) {
        AppUser actor = userService.findByIdAndTenant(actorId, tenantId);
        Document document = getAccessible(tenantId, actor, documentId);
        requireCanManage(actor, document);

        Department department = resolveDepartment(tenantId, actor, request.departmentId());
        document.setTitle(request.title().trim());
        document.setDescription(blankToNull(request.description()));
        document.setDepartment(department);
        document.setStatus(request.status());
        return DocumentResponse.from(documentRepository.save(document));
    }

    @Transactional
    public DocumentResponse replaceContent(UUID tenantId, UUID actorId, UUID documentId,
                                           MultipartFile file) {
        AppUser actor = userService.findByIdAndTenant(actorId, tenantId);
        Document document = getAccessible(tenantId, actor, documentId);
        requireCanManage(actor, document);
        validateFile(file);

        int nextVersion = document.getVersion() + 1;
        FileStorageService.StoredFile stored = null;
        String oldKey = document.getStorageKey();
        try {
            stored = storage.store(tenantId, document.getId(), nextVersion, file);
            document.replaceFile(
                    stored.originalFileName(), stored.storageKey(),
                    normalizedMime(file, stored.originalFileName()), stored.size()
            );
            DocumentResponse response = DocumentResponse.from(documentRepository.save(document));
            try { storage.delete(oldKey); } catch (IOException ignored) {}
            return response;
        } catch (IOException | RuntimeException e) {
            if (stored != null) {
                try { storage.delete(stored.storageKey()); } catch (IOException ignored) {}
            }
            throw e instanceof RuntimeException runtime ? runtime : new IllegalArgumentException("Unable to replace document");
        }
    }

    @Transactional
    public void delete(UUID tenantId, UUID actorId, UUID documentId) {
        AppUser actor = userService.findByIdAndTenant(actorId, tenantId);
        Document document = getAccessible(tenantId, actor, documentId);
        requireCanManage(actor, document);
        String key = document.getStorageKey();
        documentRepository.delete(document);
        try { storage.delete(key); } catch (IOException ignored) {}
    }

    @Transactional(readOnly = true)
    public DocumentResponse get(UUID tenantId, UUID actorId, UUID documentId) {
        AppUser actor = userService.findByIdAndTenant(actorId, tenantId);
        return DocumentResponse.from(getAccessible(tenantId, actor, documentId));
    }

    @Transactional(readOnly = true)
    public Resource content(UUID tenantId, UUID actorId, UUID documentId) {
        AppUser actor = userService.findByIdAndTenant(actorId, tenantId);
        Document document = getAccessible(tenantId, actor, documentId);
        return storage.loadAsResource(document.getStorageKey());
    }

    @Transactional(readOnly = true)
    public Document getEntity(UUID tenantId, UUID actorId, UUID documentId) {
        AppUser actor = userService.findByIdAndTenant(actorId, tenantId);
        return getAccessible(tenantId, actor, documentId);
    }

    private Document getAccessible(UUID tenantId, AppUser actor, UUID documentId) {
        Document document = documentRepository.findByIdAndTenantId(documentId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        if (actor.getRole() == UserRole.ADMIN) return document;
        UUID actorDept = actor.getDepartment() == null ? null : actor.getDepartment().getId();
        UUID documentDept = document.getDepartment() == null ? null : document.getDepartment().getId();
        if (documentDept != null && !documentDept.equals(actorDept)) {
            throw new IllegalArgumentException("You do not have access to this document");
        }
        return document;
    }

    private void requireCanManage(AppUser actor, Document document) {
        if (actor.getRole() == UserRole.ADMIN) return;
        if (actor.getRole() != UserRole.MANAGER) {
            throw new IllegalArgumentException("Only administrators and managers can manage documents");
        }
        UUID actorDept = actor.getDepartment() == null ? null : actor.getDepartment().getId();
        UUID documentDept = document.getDepartment() == null ? null : document.getDepartment().getId();
        if (actorDept == null || documentDept == null || !actorDept.equals(documentDept)) {
            throw new IllegalArgumentException("Managers can only manage documents in their own department");
        }
    }

    private Department resolveDepartment(UUID tenantId, AppUser actor, UUID departmentId) {
        if (actor.getRole() == UserRole.MANAGER) {
            if (actor.getDepartment() == null) {
                throw new IllegalArgumentException("Manager is not assigned to a department");
            }
            if (departmentId != null && !departmentId.equals(actor.getDepartment().getId())) {
                throw new IllegalArgumentException("Managers can only use their own department");
            }
            return actor.getDepartment();
        }
        if (departmentId == null) return null;
        return departmentRepository.findByIdAndTenantId(departmentId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Department not found"));
    }

    private void requireManagerOrAdmin(AppUser actor) {
        if (actor.getRole() != UserRole.ADMIN && actor.getRole() != UserRole.MANAGER) {
            throw new IllegalArgumentException("Only administrators and managers can upload documents");
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Please select a file");
        if (file.getSize() > MAX_FILE_SIZE) throw new IllegalArgumentException("File size must be 25 MB or less");

        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        String mime = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        boolean pdf = name.endsWith(".pdf") && (mime.isBlank() || mime.equals("application/pdf"));
        boolean docx = name.endsWith(".docx") && (mime.isBlank() || mime.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
        boolean txt = name.endsWith(".txt") && (mime.isBlank() || mime.startsWith("text/plain"));
        if (!(pdf || docx || txt)) {
            throw new IllegalArgumentException("Only PDF, DOCX, and TXT files are supported");
        }
    }

    private String normalizedMime(MultipartFile file, String name) {
        String mime = file.getContentType();
        if (mime != null && !mime.isBlank()) return mime;
        if (name.toLowerCase(Locale.ROOT).endsWith(".pdf")) return "application/pdf";
        if (name.toLowerCase(Locale.ROOT).endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        return "text/plain";
    }

    private static String stripExtension(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
