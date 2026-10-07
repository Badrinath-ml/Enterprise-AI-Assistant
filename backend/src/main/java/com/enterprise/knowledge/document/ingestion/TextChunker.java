package com.enterprise.knowledge.document.ingestion;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Production structure-aware chunker.
 * Hierarchy: Document -> Page/Section -> Paragraph -> Sentence -> Token/Character limit.
 */
@Component
public class TextChunker {
    private static final Pattern PARAGRAPH_SPLIT = Pattern.compile("\n{2,}");
    private static final Pattern SENTENCE_SPLIT = Pattern.compile("(?<=[.!?])\\s+");

    private final int targetChunkTokens;
    private final int overlapTokens;
    private final int maxChunkCharacters;
    private final int overlapCharacters;

    public TextChunker(
            @Value("${app.ingestion.chunk-size:1000}") int chunkSize,
            @Value("${app.ingestion.chunk-overlap:150}") int overlap) {
        if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
            throw new IllegalArgumentException("Invalid chunk configuration: chunkSize=" + chunkSize + ", overlap=" + overlap);
        }
        this.targetChunkTokens = chunkSize;
        this.overlapTokens = overlap;
        // Conservative character bounds assuming ~4 chars per token average in English / technical text
        this.maxChunkCharacters = chunkSize * 4;
        this.overlapCharacters = overlap * 4;
    }

    public List<DocumentChunkItem> chunkPages(List<ExtractedDocument.ExtractedPage> pages) {
        if (pages == null || pages.isEmpty()) return List.of();

        List<DocumentChunkItem> result = new ArrayList<>();
        int chunkIndex = 0;

        for (ExtractedDocument.ExtractedPage page : pages) {
            String pageText = normalize(page.text());
            if (pageText.isBlank()) continue;

            List<String> pageChunks = chunkText(pageText);
            for (String chunkContent : pageChunks) {
                if (chunkContent.isBlank()) continue;

                int tokenCount = estimateTokenCount(chunkContent);
                String locator = page.sectionTitle() != null && !page.sectionTitle().isBlank()
                        ? page.sectionTitle() + " (Page " + page.pageNumber() + ")"
                        : "Page " + page.pageNumber();

                result.add(new DocumentChunkItem(
                        chunkIndex++,
                        chunkContent,
                        tokenCount,
                        page.pageNumber(),
                        page.sectionTitle(),
                        locator
                ));
            }
        }

        return result;
    }

    public List<String> split(String input) {
        return chunkText(normalize(input));
    }

    private List<String> chunkText(String text) {
        if (text == null || text.isBlank()) return List.of();

        List<String> chunks = new ArrayList<>();
        String[] paragraphs = PARAGRAPH_SPLIT.split(text);

        List<String> currentSentences = new ArrayList<>();
        int currentLength = 0;

        for (String paragraph : paragraphs) {
            String trimmedPara = paragraph.trim();
            if (trimmedPara.isBlank()) continue;

            List<String> sentences = splitIntoSentences(trimmedPara);
            for (String sentence : sentences) {
                int sentenceLength = sentence.length();

                if (currentLength + sentenceLength > maxChunkCharacters && !currentSentences.isEmpty()) {
                    String built = String.join(" ", currentSentences).trim();
                    if (!built.isBlank()) {
                        chunks.add(built);
                    }

                    // Create sentence-aware overlap
                    List<String> overlapList = new ArrayList<>();
                    int overlapAcc = 0;
                    for (int i = currentSentences.size() - 1; i >= 0; i--) {
                        String s = currentSentences.get(i);
                        if (overlapAcc + s.length() <= overlapCharacters) {
                            overlapList.add(0, s);
                            overlapAcc += s.length();
                        } else {
                            break;
                        }
                    }

                    currentSentences = new ArrayList<>(overlapList);
                    currentLength = overlapAcc;
                }

                currentSentences.add(sentence);
                currentLength += sentenceLength + 1;
            }
        }

        if (!currentSentences.isEmpty()) {
            String built = String.join(" ", currentSentences).trim();
            if (!built.isBlank()) {
                chunks.add(built);
            }
        }

        return chunks;
    }

    private List<String> splitIntoSentences(String paragraph) {
        String[] raw = SENTENCE_SPLIT.split(paragraph);
        List<String> result = new ArrayList<>();
        for (String s : raw) {
            String clean = s.trim();
            if (clean.isBlank()) continue;

            // If a single sentence is exceedingly long (e.g. huge unpunctuated string), hard slice
            if (clean.length() > maxChunkCharacters) {
                int start = 0;
                while (start < clean.length()) {
                    int end = Math.min(start + maxChunkCharacters, clean.length());
                    result.add(clean.substring(start, end));
                    start = end;
                }
            } else {
                result.add(clean);
            }
        }
        return result;
    }

    public int estimateTokenCount(String text) {
        if (text == null || text.isBlank()) return 0;
        return Math.max(1, text.trim().split("\\s+").length);
    }

    private String normalize(String input) {
        if (input == null) return "";
        return input.replace("\r\n", "\n")
                .replace('\r', '\n')
                .replaceAll("[\\t ]+", " ")
                .replaceAll("\n{3,}", "\n\n")
                .trim();
    }

    public record DocumentChunkItem(
            int chunkIndex,
            String content,
            int tokenCount,
            int pageNumber,
            String sectionTitle,
            String sourceLocator
    ) {}
}
