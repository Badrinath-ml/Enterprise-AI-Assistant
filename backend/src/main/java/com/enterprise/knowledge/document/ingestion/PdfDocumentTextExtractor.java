package com.enterprise.knowledge.document.ingestion;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;
import java.io.ByteArrayInputStream;
import java.io.IOException;

@Component
public class PdfDocumentTextExtractor implements DocumentTextExtractor {
    public boolean supports(String fileName, String mimeType) { return fileName != null && fileName.toLowerCase().endsWith(".pdf"); }
    public ExtractedDocument extract(byte[] content, String fileName, String mimeType) throws IOException {
        try (PDDocument document = PDDocument.load(new ByteArrayInputStream(content))) {
            return new ExtractedDocument(new PDFTextStripper().getText(document));
        }
    }
}
