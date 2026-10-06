package com.enterprise.knowledge.document.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.UUID;

@Service
public class LocalFileStorageService implements FileStorageService {
    private final Path root;

    public LocalFileStorageService(
            @Value("${app.storage.documents-path:storage/documents}") String rootPath) {
        this.root = Paths.get(rootPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new IllegalStateException("Unable to initialize document storage", e);
        }
    }

    @Override
    public StoredFile store(UUID tenantId, UUID documentId, int version, MultipartFile file) throws IOException {
        String original = sanitize(file.getOriginalFilename());
        String extension = extensionOf(original);
        String storedName = "v" + version + "-" + UUID.randomUUID() + extension;
        Path directory = root.resolve(tenantId.toString()).resolve(documentId.toString()).normalize();
        if (!directory.startsWith(root)) {
            throw new IOException("Invalid storage path");
        }
        Files.createDirectories(directory);
        Path target = directory.resolve(storedName).normalize();
        if (!target.startsWith(root)) {
            throw new IOException("Invalid storage path");
        }
        try (InputStream input = file.getInputStream()) {
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        }
        String storageKey = root.relativize(target).toString().replace('\'', '/');
        return new StoredFile(storageKey, original, file.getContentType(), file.getSize());
    }

    @Override
    public Resource loadAsResource(String storageKey) {
        Path path = resolve(storageKey);
        Resource resource = new FileSystemResource(path);
        if (!resource.exists() || !resource.isReadable()) {
            throw new IllegalArgumentException("Document content is not available");
        }
        return resource;
    }

    @Override
    public void delete(String storageKey) throws IOException {
        Path path = resolve(storageKey);
        Files.deleteIfExists(path);
        Path parent = path.getParent();
        if (parent != null && parent.startsWith(root) && Files.isDirectory(parent)) {
            try (var stream = Files.list(parent)) {
                if (!stream.findAny().isPresent()) {
                    Files.deleteIfExists(parent);
                    Path tenantDirectory = parent.getParent();
                    if (tenantDirectory != null && tenantDirectory.startsWith(root)) {
                        try (var tenantStream = Files.list(tenantDirectory)) {
                            if (!tenantStream.findAny().isPresent()) {
                                Files.deleteIfExists(tenantDirectory);
                            }
                        }
                    }
                }
            }
        }
    }

    private Path resolve(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            throw new IllegalArgumentException("Document storage key is missing");
        }
        Path resolved = root.resolve(storageKey).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("Invalid document storage key");
        }
        return resolved;
    }

    private static String sanitize(String name) {
        if (name == null || name.isBlank()) {
            return "document";
        }
        return java.nio.file.Paths.get(name).getFileName().toString().replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");

    }

    private static String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(dot).toLowerCase() : "";
    }
}
