package com.enterprise.knowledge.document.ingestion;

import org.springframework.stereotype.Service;
import java.io.IOException;
import java.util.List;

@Service
public class DocumentTextExtractorService {
    private final List<DocumentTextExtractor> extractors;
    public DocumentTextExtractorService(List<DocumentTextExtractor> extractors) { this.extractors = extractors; }
    public ExtractedDocument extract(byte[] content, String fileName, String mimeType) throws IOException {
        return extractors.stream().filter(e -> e.supports(fileName, mimeType)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported document type: " + fileName))
                .extract(content, fileName, mimeType);
    }
}
