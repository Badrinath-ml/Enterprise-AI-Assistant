package com.enterprise.knowledge.document.ingestion;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Component
public class PdfDocumentTextExtractor implements DocumentTextExtractor {
    public boolean supports(String fileName, String mimeType) {
        return fileName != null && fileName.toLowerCase().endsWith(".pdf");
    }

    public ExtractedDocument extract(byte[] content, String fileName, String mimeType) throws IOException {
        try (PDDocument document = PDDocument.load(new ByteArrayInputStream(content))) {
            List<ExtractedDocument.ExtractedPage> pages = new ArrayList<>();
            PDFTextStripper stripper = new PDFTextStripper();
            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                String text = stripper.getText(document).trim();
                if (!text.isBlank()) {
                    pages.add(new ExtractedDocument.ExtractedPage(page, text));
                }
            }
            return new ExtractedDocument(pages);
        }
    }
}
