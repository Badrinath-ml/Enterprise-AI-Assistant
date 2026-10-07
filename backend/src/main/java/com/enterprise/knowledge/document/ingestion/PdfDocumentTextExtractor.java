package com.enterprise.knowledge.document.ingestion;

import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class PdfDocumentTextExtractor implements DocumentTextExtractor {
    private static final Logger log = LoggerFactory.getLogger(PdfDocumentTextExtractor.class);
    private static final long MAX_RAM_BYTES = 10L * 1024 * 1024; // 10MB RAM buffer, scratch to disk for large PDFs

    @Override
    public boolean supports(String fileName, String mimeType) {
        if (fileName != null && fileName.toLowerCase(Locale.ROOT).endsWith(".pdf")) return true;
        return mimeType != null && mimeType.equalsIgnoreCase("application/pdf");
    }

    @Override
    public ExtractedDocument extract(InputStream inputStream, String fileName, String mimeType) throws IOException {
        MemoryUsageSetting memorySetting = MemoryUsageSetting.setupMixed(MAX_RAM_BYTES);
        try (PDDocument document = PDDocument.load(inputStream, memorySetting)) {
            if (document.isEncrypted()) {
                throw new IllegalArgumentException("PDF is password protected or encrypted and cannot be indexed");
            }

            int totalPages = document.getNumberOfPages();
            if (totalPages == 0) {
                throw new IllegalArgumentException("PDF document has 0 pages");
            }

            List<ExtractedDocument.ExtractedPage> pages = new ArrayList<>();
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            stripper.setLineSeparator("\n");
            stripper.setParagraphEnd("\n\n");

            for (int page = 1; page <= totalPages; page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                try {
                    String pageText = stripper.getText(document).trim();
                    if (!pageText.isBlank()) {
                        pages.add(new ExtractedDocument.ExtractedPage(page, null, pageText));
                    }
                } catch (Exception pageEx) {
                    log.warn("Failed extracting text from page {} of PDF '{}': {}", page, fileName, pageEx.getMessage());
                }
            }

            if (pages.isEmpty()) {
                throw new IllegalArgumentException("PDF contains no extractable text. Scanned PDFs or image-only documents require OCR, which is not supported.");
            }

            return new ExtractedDocument(pages);
        }
    }
}
