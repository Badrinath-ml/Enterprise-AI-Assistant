package com.enterprise.knowledge.document.ingestion;

import java.io.IOException;

public interface DocumentTextExtractor {
    boolean supports(String fileName, String mimeType);
    ExtractedDocument extract(byte[] content, String fileName, String mimeType) throws IOException;
}
