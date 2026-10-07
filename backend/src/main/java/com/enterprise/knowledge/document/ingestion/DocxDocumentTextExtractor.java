package com.enterprise.knowledge.document.ingestion;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.List;

@Component
public class DocxDocumentTextExtractor implements DocumentTextExtractor {
    public boolean supports(String fileName, String mimeType) {
        return fileName != null && fileName.toLowerCase().endsWith(".docx");
    }

    public ExtractedDocument extract(byte[] content, String fileName, String mimeType) throws IOException {
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(content))) {
            StringBuilder text = new StringBuilder();
            for (XWPFParagraph paragraph : document.getParagraphs()) {
                if (!paragraph.getText().isBlank()) {
                    text.append(paragraph.getText().trim()).append("\n\n");
                }
            }
            return new ExtractedDocument(List.of(new ExtractedDocument.ExtractedPage(1, text.toString())));
        }
    }
}
