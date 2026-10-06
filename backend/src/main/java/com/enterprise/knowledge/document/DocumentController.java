package com.enterprise.knowledge.document;

import com.enterprise.knowledge.common.tenant.TenantContext;
import com.enterprise.knowledge.document.dto.DocumentResponse;
import com.enterprise.knowledge.document.dto.DocumentPageResponse;
import com.enterprise.knowledge.document.dto.UpdateDocumentRequest;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {
    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public DocumentPageResponse search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UUID departmentId,
            @RequestParam(required = false) DocumentStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal Jwt jwt) {
        return documentService.search(
                TenantContext.getRequired(), UUID.fromString(jwt.getSubject()),
                q, departmentId, status, page, size
        );
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public DocumentResponse get(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return documentService.get(TenantContext.getRequired(), UUID.fromString(jwt.getSubject()), id);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) UUID departmentId,
            @AuthenticationPrincipal Jwt jwt) {
        return documentService.create(
                TenantContext.getRequired(), UUID.fromString(jwt.getSubject()),
                file, title, description, departmentId
        );
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public DocumentResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateDocumentRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return documentService.update(
                TenantContext.getRequired(), UUID.fromString(jwt.getSubject()), id, request
        );
    }

    @PutMapping("/{id}/content")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public DocumentResponse replaceContent(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt) {
        return documentService.replaceContent(
                TenantContext.getRequired(), UUID.fromString(jwt.getSubject()), id, file
        );
    }

    @GetMapping("/{id}/content")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Resource> content(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt) {
        UUID tenantId = TenantContext.getRequired();
        UUID actorId = UUID.fromString(jwt.getSubject());
        Document document = documentService.getEntity(tenantId, actorId, id);
        Resource resource = documentService.content(tenantId, actorId, id);
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(document.getMimeType());
        } catch (Exception e) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(document.getOriginalFileName()).build().toString())
                .body(resource);
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Resource> download(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt) {
        UUID tenantId = TenantContext.getRequired();
        UUID actorId = UUID.fromString(jwt.getSubject());
        Document document = documentService.getEntity(tenantId, actorId, id);
        Resource resource = documentService.content(tenantId, actorId, id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(document.getOriginalFileName()).build().toString())
                .body(resource);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        documentService.delete(TenantContext.getRequired(), UUID.fromString(jwt.getSubject()), id);
    }
}
