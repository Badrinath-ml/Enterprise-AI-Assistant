package com.enterprise.knowledge.document.ingestion;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;

public interface DocumentTextExtractor {
    boolean supports(String fileName, String mimeType);

    ExtractedDocument extract(InputStream inputStream, String fileName, String mimeType) throws IOException;

    default ExtractedDocument extract(byte[] content, String fileName, String mimeType) throws IOException {
        return extract(new ByteArrayInputStream(content), fileName, mimeType);
    }
}
