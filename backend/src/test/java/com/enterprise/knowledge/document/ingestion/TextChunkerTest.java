package com.enterprise.knowledge.document.ingestion;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TextChunkerTest {

    @Test
    @DisplayName("Invalid configuration values should throw IllegalArgumentException")
    void invalidConfigThrowsException() {
        assertThatThrownBy(() -> new TextChunker(0, 10))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> new TextChunker(100, 100))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> new TextChunker(100, -1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Small document should result in a single chunk with correct locator")
    void smallDocumentReturnsSingleChunk() {
        TextChunker chunker = new TextChunker(500, 50);

        List<ExtractedDocument.ExtractedPage> pages = List.of(
                new ExtractedDocument.ExtractedPage(1, "Introduction", "Welcome to Enterprise AI Assistant. It powers corporate knowledge search.")
        );

        List<TextChunker.DocumentChunkItem> chunks = chunker.chunkPages(pages);

        assertThat(chunks).hasSize(1);
        TextChunker.DocumentChunkItem chunk = chunks.getFirst();
        assertThat(chunk.chunkIndex()).isEqualTo(0);
        assertThat(chunk.pageNumber()).isEqualTo(1);
        assertThat(chunk.sectionTitle()).isEqualTo("Introduction");
        assertThat(chunk.sourceLocator()).isEqualTo("Introduction (Page 1)");
        assertThat(chunk.content()).contains("Welcome to Enterprise AI Assistant.");
        assertThat(chunk.tokenCount()).isPositive();
    }

    @Test
    @DisplayName("Empty or whitespace-only pages should be ignored")
    void emptyOrWhitespacePagesAreIgnored() {
        TextChunker chunker = new TextChunker(500, 50);

        List<ExtractedDocument.ExtractedPage> pages = List.of(
                new ExtractedDocument.ExtractedPage(1, "Blank Section", "   \n\n  \t  "),
                new ExtractedDocument.ExtractedPage(2, null, "Valid page content here.")
        );

        List<TextChunker.DocumentChunkItem> chunks = chunker.chunkPages(pages);

        assertThat(chunks).hasSize(1);
        assertThat(chunks.getFirst().pageNumber()).isEqualTo(2);
        assertThat(chunks.getFirst().sourceLocator()).isEqualTo("Page 2");
    }

    @Test
    @DisplayName("Multi-page extraction maintains sequence and chunk indices")
    void multiPageExtractionMaintainsSequentialIndices() {
        TextChunker chunker = new TextChunker(500, 50);

        List<ExtractedDocument.ExtractedPage> pages = List.of(
                new ExtractedDocument.ExtractedPage(1, "Section 1", "Content of page 1."),
                new ExtractedDocument.ExtractedPage(2, "Section 2", "Content of page 2."),
                new ExtractedDocument.ExtractedPage(3, null, "Content of page 3.")
        );

        List<TextChunker.DocumentChunkItem> chunks = chunker.chunkPages(pages);

        assertThat(chunks).hasSize(3);
        assertThat(chunks.get(0).chunkIndex()).isEqualTo(0);
        assertThat(chunks.get(0).sourceLocator()).isEqualTo("Section 1 (Page 1)");
        assertThat(chunks.get(1).chunkIndex()).isEqualTo(1);
        assertThat(chunks.get(1).sourceLocator()).isEqualTo("Section 2 (Page 2)");
        assertThat(chunks.get(2).chunkIndex()).isEqualTo(2);
        assertThat(chunks.get(2).sourceLocator()).isEqualTo("Page 3");
    }

    @Test
    @DisplayName("Long text splits across boundaries with configured overlap")
    void longTextSplitsWithOverlap() {
        // 15 tokens * 4 = 60 chars max per chunk
        TextChunker chunker = new TextChunker(15, 3);

        String longText = "First sentence is informative.\n\nSecond sentence adds more detail.\n\n" +
                "Third sentence continues explanation.\n\nFourth sentence concludes the paragraph.";

        List<ExtractedDocument.ExtractedPage> pages = List.of(
                new ExtractedDocument.ExtractedPage(1, "Overview", longText)
        );

        List<TextChunker.DocumentChunkItem> chunks = chunker.chunkPages(pages);

        assertThat(chunks.size()).isGreaterThan(1);
        for (int i = 0; i < chunks.size(); i++) {
            assertThat(chunks.get(i).chunkIndex()).isEqualTo(i);
            assertThat(chunks.get(i).content()).isNotBlank();
        }
    }

    @Test
    @DisplayName("Exceedingly long unbroken sentence is sliced without crashing")
    void longUnbrokenSentenceHandledSafely() {
        TextChunker chunker = new TextChunker(10, 2); // 40 chars max
        String unbrokenSentence = "A".repeat(100);

        List<String> chunks = chunker.split(unbrokenSentence);

        assertThat(chunks).isNotEmpty();
        for (String chunk : chunks) {
            assertThat(chunk.length()).isLessThanOrEqualTo(40);
        }
    }
}
