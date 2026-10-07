package com.enterprise.knowledge.document.ingestion;

import org.apache.poi.xwpf.usermodel.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class DocxDocumentTextExtractor implements DocumentTextExtractor {
    private static final Logger log = LoggerFactory.getLogger(DocxDocumentTextExtractor.class);

    @Override
    public boolean supports(String fileName, String mimeType) {
        if (fileName != null && fileName.toLowerCase(Locale.ROOT).endsWith(".docx")) return true;
        return mimeType != null && mimeType.equalsIgnoreCase(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }

    @Override
    public ExtractedDocument extract(InputStream inputStream, String fileName, String mimeType) throws IOException {
        try (XWPFDocument document = new XWPFDocument(inputStream)) {
            List<ExtractedDocument.ExtractedPage> pages = new ArrayList<>();
            StringBuilder currentSection = new StringBuilder();
            String currentHeading = null;
            int sectionIndex = 1;

            for (IBodyElement element : document.getBodyElements()) {
                try {
                    if (element instanceof XWPFParagraph paragraph) {
                        String style = paragraph.getStyle();
                        String text = paragraph.getText() == null ? "" : paragraph.getText().trim();

                        if (text.isBlank()) continue;

                        boolean isHeading = isHeadingStyle(style);
                        if (isHeading) {
                            if (!currentSection.isEmpty()) {
                                pages.add(new ExtractedDocument.ExtractedPage(
                                        sectionIndex++, currentHeading, currentSection.toString().trim()
                                ));
                                currentSection.setLength(0);
                            }
                            currentHeading = text;
                            currentSection.append(text).append("\n\n");
                        } else {
                            currentSection.append(text).append("\n\n");
                        }
                    } else if (element instanceof XWPFTable table) {
                        String tableText = formatTable(table);
                        if (!tableText.isBlank()) {
                            currentSection.append(tableText).append("\n\n");
                        }
                    }
                } catch (Exception elementEx) {
                    log.warn("Skipping malformed element in DOCX '{}': {}", fileName, elementEx.getMessage());
                }
            }

            if (!currentSection.isEmpty()) {
                pages.add(new ExtractedDocument.ExtractedPage(
                        sectionIndex, currentHeading, currentSection.toString().trim()
                ));
            }

            if (pages.isEmpty()) {
                throw new IllegalArgumentException("DOCX contains no extractable text");
            }

            return new ExtractedDocument(pages);
        }
    }

    private boolean isHeadingStyle(String style) {
        if (style == null || style.isBlank()) return false;
        String lower = style.toLowerCase(Locale.ROOT);
        return lower.startsWith("heading") || lower.startsWith("title") || lower.contains("header");
    }

    private String formatTable(XWPFTable table) {
        StringBuilder sb = new StringBuilder();
        for (XWPFTableRow row : table.getRows()) {
            List<String> cells = new ArrayList<>();
            for (XWPFTableCell cell : row.getTableCells()) {
                String text = cell.getText() == null ? "" : cell.getText().trim().replace('\n', ' ');
                cells.add(text);
            }
            if (!cells.isEmpty() && cells.stream().anyMatch(c -> !c.isBlank())) {
                sb.append("| ").append(String.join(" | ", cells)).append(" |\n");
            }
        }
        return sb.toString().trim();
    }
}
