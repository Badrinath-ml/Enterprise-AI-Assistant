package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.document.Document;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "chat_message_citations", indexes = {
        @Index(name = "idx_chat_message_citations_message", columnList = "message_id")
})
public class ChatCitation {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "message_id", nullable = false)
    private ChatMessage message;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false)
    private Document document;

    @Column(nullable = false)
    private int documentVersion;

    @Column(nullable = false)
    private UUID chunkId;

    @Column(nullable = false)
    private int chunkIndex;

    @Column(nullable = false)
    private double similarity;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String snippet;

    private Integer pageNumber;

    @Column(length = 120)
    private String locatorLabel;

    protected ChatCitation() {}

    public ChatCitation(UUID id, ChatMessage message, Document document, int documentVersion,
                        UUID chunkId, int chunkIndex, double similarity, String snippet,
                        Integer pageNumber, String locatorLabel) {
        this.id = id;
        this.message = message;
        this.document = document;
        this.documentVersion = documentVersion;
        this.chunkId = chunkId;
        this.chunkIndex = chunkIndex;
        this.similarity = similarity;
        this.snippet = snippet;
        this.pageNumber = pageNumber;
        this.locatorLabel = locatorLabel;
    }

    public UUID getId() { return id; }
    public ChatMessage getMessage() { return message; }
    public Document getDocument() { return document; }
    public int getDocumentVersion() { return documentVersion; }
    public UUID getChunkId() { return chunkId; }
    public int getChunkIndex() { return chunkIndex; }
    public double getSimilarity() { return similarity; }
    public String getSnippet() { return snippet; }
    public Integer getPageNumber() { return pageNumber; }
    public String getLocatorLabel() { return locatorLabel; }
}
