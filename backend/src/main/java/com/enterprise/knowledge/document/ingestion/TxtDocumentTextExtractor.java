package com.enterprise.knowledge.document.ingestion;

import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class TxtDocumentTextExtractor implements DocumentTextExtractor {
    private static final int LINES_PER_VIRTUAL_PAGE = 80;

    @Override
    public boolean supports(String fileName, String mimeType) {
        if (fileName != null && fileName.toLowerCase(Locale.ROOT).endsWith(".txt")) return true;
        return mimeType != null && mimeType.toLowerCase(Locale.ROOT).startsWith("text/plain");
    }

    @Override
    public ExtractedDocument extract(InputStream inputStream, String fileName, String mimeType) throws IOException {
        List<ExtractedDocument.ExtractedPage> pages = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int lineCount = 0;
        int pageNumber = 1;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                current.append(line).append('\n');
                lineCount++;
                if (lineCount >= LINES_PER_VIRTUAL_PAGE) {
                    String pageText = current.toString().trim();
                    if (!pageText.isBlank()) {
                        pages.add(new ExtractedDocument.ExtractedPage(pageNumber++, pageText));
                    }
                    current.setLength(0);
                    lineCount = 0;
                }
            }
        }

        if (!current.isEmpty()) {
            String pageText = current.toString().trim();
            if (!pageText.isBlank()) {
                pages.add(new ExtractedDocument.ExtractedPage(pageNumber, pageText));
            }
        }

        if (pages.isEmpty()) {
            throw new IllegalArgumentException("TXT file is empty");
        }

        return new ExtractedDocument(pages);
    }
}
