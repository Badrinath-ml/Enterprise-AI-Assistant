package com.enterprise.knowledge.document.ingestion;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class TxtDocumentTextExtractor implements DocumentTextExtractor {
    public boolean supports(String fileName, String mimeType) {
        return fileName != null && fileName.toLowerCase().endsWith(".txt");
    }

    public ExtractedDocument extract(byte[] content, String fileName, String mimeType) {
        return new ExtractedDocument(List.of(
                new ExtractedDocument.ExtractedPage(1, new String(content, StandardCharsets.UTF_8))
        ));
    }
}
