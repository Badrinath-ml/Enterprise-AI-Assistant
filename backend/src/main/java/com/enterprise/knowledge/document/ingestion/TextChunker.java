package com.enterprise.knowledge.document.ingestion;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;

@Component
public class TextChunker {
    private final int chunkSize;
    private final int overlap;
    public TextChunker(@Value("${app.ingestion.chunk-size:1200}") int chunkSize,
                       @Value("${app.ingestion.chunk-overlap:200}") int overlap) {
        if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) throw new IllegalArgumentException("Invalid chunk configuration");
        this.chunkSize = chunkSize; this.overlap = overlap;
    }
    public List<String> split(String input) {
        String text = normalize(input); if (text.isBlank()) return List.of();
        List<String> chunks = new ArrayList<>(); int start = 0;
        while (start < text.length()) {
            int end = Math.min(start + chunkSize, text.length());
            if (end < text.length()) {
                int boundary = Math.max(Math.max(text.lastIndexOf('\n', end), text.lastIndexOf(". ", end)), text.lastIndexOf(' ', end));
                if (boundary > start + chunkSize / 2) end = boundary + 1;
            }
            String chunk = text.substring(start, end).trim(); if (!chunk.isBlank()) chunks.add(chunk);
            if (end >= text.length()) break;
            start = Math.max(end - overlap, start + 1);
        }
        return chunks;
    }
    private String normalize(String input) {
        if (input == null) return "";
        return input.replace("\r\n", "\n").replace('\r', '\n')
                .replaceAll("[\\t ]+", " ").replaceAll("\n{3,}", "\n\n").trim();
    }
}
