package com.enterprise.knowledge.document.ingestion;

import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;

@Component
public class TxtDocumentTextExtractor implements DocumentTextExtractor {
    public boolean supports(String fileName, String mimeType) { return fileName != null && fileName.toLowerCase().endsWith(".txt"); }
    public ExtractedDocument extract(byte[] content, String fileName, String mimeType) {
        return new ExtractedDocument(new String(content, StandardCharsets.UTF_8));
    }
}
