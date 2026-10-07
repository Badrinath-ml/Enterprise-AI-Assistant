package com.enterprise.knowledge.document.ingestion;

import java.util.List;

public record ExtractedDocument(List<ExtractedPage> pages) {
    public ExtractedDocument {
        pages = pages == null ? List.of() : List.copyOf(pages);
    }

    public String text() {
        return String.join("\n\n", pages.stream().map(ExtractedPage::text).toList());
    }

    public record ExtractedPage(int pageNumber, String text) {}
}
