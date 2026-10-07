package com.enterprise.knowledge.document.ingestion;

import org.springframework.stereotype.Service;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;

@Service
public class DocumentTextExtractorService {
    private final List<DocumentTextExtractor> extractors;

    public DocumentTextExtractorService(List<DocumentTextExtractor> extractors) {
        this.extractors = extractors;
    }

    public ExtractedDocument extract(InputStream inputStream, String fileName, String mimeType) throws IOException {
        return extractors.stream()
                .filter(e -> e.supports(fileName, mimeType))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported document type: " + fileName))
                .extract(inputStream, fileName, mimeType);
    }

    public ExtractedDocument extract(byte[] content, String fileName, String mimeType) throws IOException {
        return extract(new ByteArrayInputStream(content), fileName, mimeType);
    }
}
