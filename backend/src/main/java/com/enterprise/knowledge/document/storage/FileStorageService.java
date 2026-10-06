package com.enterprise.knowledge.document.storage;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

public interface FileStorageService {
    StoredFile store(UUID tenantId, UUID documentId, int version, MultipartFile file) throws IOException;
    Resource loadAsResource(String storageKey);
    void delete(String storageKey) throws IOException;

    record StoredFile(String storageKey, String originalFileName, String mimeType, long size) {}
}
