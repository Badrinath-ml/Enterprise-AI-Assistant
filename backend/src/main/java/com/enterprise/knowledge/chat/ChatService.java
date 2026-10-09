package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.ai.GenerationRequest;
import com.enterprise.knowledge.ai.GenerationResponse;
import com.enterprise.knowledge.ai.GenerationService;
import com.enterprise.knowledge.ai.StreamingGenerationService;
import com.enterprise.knowledge.chat.dto.*;
import com.enterprise.knowledge.document.Document;
import com.enterprise.knowledge.document.DocumentService;
import com.enterprise.knowledge.document.DocumentStatus;
import com.enterprise.knowledge.document.IngestionStatus;
import com.enterprise.knowledge.document.dto.DocumentResponse;
import com.enterprise.knowledge.document.ingestion.DocumentTextExtractorService;
import com.enterprise.knowledge.document.ingestion.EmbeddingService;
import com.enterprise.knowledge.document.ingestion.ExtractedDocument;
import com.enterprise.knowledge.document.ingestion.TextChunker;
import com.enterprise.knowledge.document.storage.FileStorageService;
import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.tenant.TenantRepository;
import com.enterprise.knowledge.user.AppUser;
import com.enterprise.knowledge.user.UserRole;
import com.enterprise.knowledge.user.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class ChatService {
    private static final Logger log = LoggerFactory.getLogger(ChatService.class);
    private static final int TOP_K = 5;
    private static final long MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024L; // 25 MB

    private final ChatConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final ChatCitationRepository citations;
    private final ChatConversationAttachmentRepository attachmentRepository;
    private final ChatRetrievalService retrieval;
    private final GenerationService generation;
    private final StreamingGenerationService streamingGeneration;
    private final IntentRoutingService intentRouter;
    private final UserService userService;
    private final TenantRepository tenantRepository;
    private final DocumentService documentService;
    private final DocumentTextExtractorService extractor;
    private final TextChunker chunker;
    private final EmbeddingService embeddingService;
    private final FileStorageService storage;
    private final JdbcTemplate jdbcTemplate;
    private final ChatPersistenceService persistence;
    private final ThreadPoolTaskExecutor chatStreamExecutor;

    public ChatService(ChatConversationRepository conversations,
                       ChatMessageRepository messages,
                       ChatCitationRepository citations,
                       ChatConversationAttachmentRepository attachmentRepository,
                       ChatRetrievalService retrieval,
                       GenerationService generation,
                       StreamingGenerationService streamingGeneration,
                       IntentRoutingService intentRouter,
                       UserService userService,
                       TenantRepository tenantRepository,
                       DocumentService documentService,
                       DocumentTextExtractorService extractor,
                       TextChunker chunker,
                       EmbeddingService embeddingService,
                       FileStorageService storage,
                       JdbcTemplate jdbcTemplate,
                       ChatPersistenceService persistence,
                       @Qualifier("chatStreamExecutor") ThreadPoolTaskExecutor chatStreamExecutor) {
        this.conversations = conversations;
        this.messages = messages;
        this.citations = citations;
        this.attachmentRepository = attachmentRepository;
        this.retrieval = retrieval;
        this.generation = generation;
        this.streamingGeneration = streamingGeneration;
        this.intentRouter = intentRouter;
        this.userService = userService;
        this.tenantRepository = tenantRepository;
        this.documentService = documentService;
        this.extractor = extractor;
        this.chunker = chunker;
        this.embeddingService = embeddingService;
        this.storage = storage;
        this.jdbcTemplate = jdbcTemplate;
        this.persistence = persistence;
        this.chatStreamExecutor = chatStreamExecutor;
    }

    @Transactional
    public ChatConversationResponse create(UUID tenantId, UUID userId, String title) {
        AppUser user = userService.findByIdAndTenant(userId, tenantId);
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found"));
        ChatConversation c = new ChatConversation(UUID.randomUUID(), tenant, user,
                title == null || title.isBlank() ? "New conversation" : title.trim());
        return toConversation(conversations.save(c));
    }

    @Transactional(readOnly = true)
    public List<ChatConversationResponse> list(UUID tenantId, UUID userId) {
        return conversations.findByTenantIdAndUserIdOrderByUpdatedAtDesc(tenantId, userId)
                .stream().map(this::toConversation).toList();
    }

    @Transactional(readOnly = true)
    public ChatHistoryResponse history(UUID tenantId, UUID userId, UUID conversationId) {
        ChatConversation c = getConversation(tenantId, userId, conversationId);
        return new ChatHistoryResponse(
                messages.findByConversationIdOrderByCreatedAtAsc(c.getId()).stream()
                        .map(this::toMessage).toList());
    }

    @Transactional
    public void delete(UUID tenantId, UUID userId, UUID conversationId) {
        ChatConversation c = getConversation(tenantId, userId, conversationId);

        // Delete physical attachment files stored locally for this conversation
        List<ChatConversationAttachment> atts = attachmentRepository.findByConversationId(conversationId);
        for (ChatConversationAttachment att : atts) {
            try {
                storage.delete(att.getStorageKey());
            } catch (Exception e) {
                log.warn("Could not delete attachment file from storage (key: {}): {}", att.getStorageKey(), e.getMessage());
            }
        }

        // Deleting conversation cascades messages, citations, attachments, and attachment chunks in DB.
        // It NEVER deletes shared organizational documents.
        conversations.delete(c);
        log.info("Deleted conversation: id={}, tenant={}, user={}", conversationId, tenantId, userId);
    }

    @Transactional
    public ChatSendResponse send(UUID tenantId, UUID userId, UUID conversationId, String prompt) {
        if (prompt == null || prompt.isBlank()) throw new IllegalArgumentException("Message cannot be blank");

        ChatConversation conversation = getConversation(tenantId, userId, conversationId);
        AppUser user = userService.findByIdAndTenant(userId, tenantId);

        ChatMessage userMessage = new ChatMessage(UUID.randomUUID(), conversation,
                ChatMessageRole.USER, prompt.trim(), null, null);
        messages.save(userMessage);

        List<ChatMessage> previous = messages.findByConversationIdOrderByCreatedAtAsc(conversationId);
        QueryIntent intent = intentRouter.classify(prompt.trim());

        List<ChatRetrievalService.RetrievedChunk> chunks = List.of();
        String systemInstruction;
        String promptWithContext;

        if (intent == QueryIntent.GREETING || intent == QueryIntent.IDENTITY) {
            systemInstruction = """
                    You are the Enterprise AI Assistant.
                    Respond warmly, politely, and professionally.
                    Explain that you can assist with questions regarding authorized organizational policies, documents, procedures, and general knowledge.
                    Do not search or fabricate any private documents.
                    """;
            promptWithContext = formatSimplePrompt(previous, prompt.trim());
        } else if (intent == QueryIntent.GENERAL) {
            systemInstruction = """
                    You are the Enterprise AI Assistant.
                    The user is asking a general knowledge, technical, or educational question.
                    Answer clearly, helpfully, and accurately using general knowledge.
                    Do not reference, fabricate, or expose internal organizational documents or private metadata.
                    """;
            promptWithContext = formatSimplePrompt(previous, prompt.trim());
        } else {
            // ENTERPRISE or MIXED intent
            chunks = retrieval.retrieve(
                    tenantId,
                    user.getDepartment() == null ? null : user.getDepartment().getId(),
                    user.getRole() == UserRole.ADMIN,
                    conversationId,
                    prompt.trim(),
                    TOP_K
            );

            String context = formatContext(chunks);
            systemInstruction = buildEnterpriseSystemPrompt(intent);
            promptWithContext = formatRAGPrompt(previous, context, prompt.trim());
        }

        GenerationResponse generated = generation.generate(new GenerationRequest(systemInstruction, promptWithContext));
        ChatMessage assistant = new ChatMessage(UUID.randomUUID(), conversation,
                ChatMessageRole.ASSISTANT, generated.text(), generated.provider(), generated.model());
        messages.save(assistant);

        // Ground citations only for enterprise/mixed responses that have chunks and did not encounter insufficient evidence
        if (!chunks.isEmpty() && !generated.text().contains("do not contain enough information")) {
            for (ChatRetrievalService.RetrievedChunk chunk : chunks) {
                if (chunk.isPrivateAttachment()) {
                    ChatConversationAttachment att = attachmentRepository.findById(chunk.documentId()).orElse(null);
                    citations.save(new ChatCitation(UUID.randomUUID(), assistant, null, att,
                            chunk.documentVersion(), chunk.chunkId(), chunk.chunkIndex(),
                            chunk.similarity(), chunk.content(), chunk.pageNumber(), chunk.locatorLabel()));
                } else {
                    citations.save(new ChatCitation(UUID.randomUUID(), assistant,
                            documentService.getEntity(tenantId, userId, chunk.documentId()), null,
                            chunk.documentVersion(), chunk.chunkId(), chunk.chunkIndex(),
                            chunk.similarity(), chunk.content(), chunk.pageNumber(), chunk.locatorLabel()));
                }
            }
        }

        conversation.touchNow();
        if ("New conversation".equals(conversation.getTitle())) {
            String title = prompt.trim();
            conversation.setTitle(title.length() > 60 ? title.substring(0, 60) : title);
        }
        conversations.save(conversation);

        return new ChatSendResponse(conversationId, toMessage(userMessage), toMessage(assistant));
    }

    public SseEmitter stream(UUID tenantId, UUID userId, UUID conversationId, String prompt) {
        if (prompt == null || prompt.isBlank()) throw new IllegalArgumentException("Message cannot be blank");

        SseEmitter emitter = new SseEmitter(180_000L);
        AtomicBoolean completed = new AtomicBoolean(false);

        emitter.onCompletion(() -> completed.set(true));
        emitter.onTimeout(() -> {
            completed.set(true);
            emitter.complete();
        });
        emitter.onError(ex -> completed.set(true));

        chatStreamExecutor.submit(() -> {
            try {
                persistence.saveUserMessage(tenantId, userId, conversationId, prompt.trim());

                AppUser user = userService.findByIdAndTenant(userId, tenantId);
                List<ChatMessage> previous = persistence.history(tenantId, userId, conversationId);
                QueryIntent intent = intentRouter.classify(prompt.trim());

                List<ChatRetrievalService.RetrievedChunk> chunks = List.of();
                String systemInstruction;
                String promptWithContext;

                if (intent == QueryIntent.GREETING || intent == QueryIntent.IDENTITY) {
                    systemInstruction = """
                            You are the Enterprise AI Assistant.
                            Respond warmly, politely, and professionally.
                            Explain that you can assist with questions regarding authorized organizational policies, documents, procedures, and general knowledge.
                            Do not search or fabricate any private documents.
                            """;
                    promptWithContext = formatSimplePrompt(previous, prompt.trim());
                } else if (intent == QueryIntent.GENERAL) {
                    systemInstruction = """
                            You are the Enterprise AI Assistant.
                            The user is asking a general knowledge, technical, or educational question.
                            Answer clearly, helpfully, and accurately using general knowledge.
                            Do not reference, fabricate, or expose internal organizational documents or private metadata.
                            """;
                    promptWithContext = formatSimplePrompt(previous, prompt.trim());
                } else {
                    // ENTERPRISE or MIXED intent
                    chunks = retrieval.retrieve(
                            tenantId,
                            user.getDepartment() == null ? null : user.getDepartment().getId(),
                            user.getRole() == UserRole.ADMIN,
                            conversationId,
                            prompt.trim(),
                            TOP_K
                    );

                    String context = formatContext(chunks);
                    systemInstruction = buildEnterpriseSystemPrompt(intent);
                    promptWithContext = formatRAGPrompt(previous, context, prompt.trim());
                }

                // Incremental token streaming
                GenerationResponse generated = streamingGeneration.stream(
                        new GenerationRequest(systemInstruction, promptWithContext),
                        token -> {
                            if (!completed.get()) {
                                try {
                                    emitter.send(SseEmitter.event().name("token").data(new StreamTokenResponse(token)));
                                } catch (IOException e) {
                                    completed.set(true);
                                    log.debug("Client disconnected during SSE token streaming: {}", e.getMessage());
                                    throw new RuntimeException("Client disconnected", e);
                                }
                            }
                        });

                if (completed.get()) {
                    return;
                }

                // Emit citations only for verified grounded answers with retrieved enterprise sources
                boolean insufficient = generated.text() != null && generated.text().contains("do not contain enough information");
                List<ChatRetrievalService.RetrievedChunk> finalChunks = insufficient ? List.of() : chunks;

                for (ChatRetrievalService.RetrievedChunk chunk : finalChunks) {
                    ChatCitationResponse citation = new ChatCitationResponse(
                            UUID.randomUUID(),
                            chunk.documentId(),
                            chunk.title(),
                            chunk.fileName(),
                            chunk.mimeType(),
                            chunk.documentVersion(),
                            chunk.chunkId(),
                            chunk.chunkIndex(),
                            chunk.similarity(),
                            Math.max(0, Math.min(1, chunk.similarity())),
                            chunk.content(),
                            chunk.pageNumber(),
                            chunk.locatorLabel()
                    );
                    try {
                        emitter.send(SseEmitter.event().name("citation").data(citation));
                    } catch (IOException e) {
                        completed.set(true);
                        break;
                    }
                }

                persistence.saveAssistant(
                        tenantId, userId, conversationId,
                        generated.text(), generated.provider(), generated.model(), finalChunks);
                persistence.touchWithTitle(tenantId, userId, conversationId, prompt.trim());

                if (!completed.get()) {
                    emitter.send(SseEmitter.event().name("done").data(
                            new StreamDoneResponse(conversationId, generated.provider(), generated.model())));
                    emitter.complete();
                }

            } catch (Exception e) {
                if (!completed.get()) {
                    try {
                        String errorMsg = e.getMessage() == null || e.getMessage().isBlank()
                                ? "Unable to generate an answer right now." : e.getMessage();
                        // Sanitize message: never leak secrets or stack traces
                        if (errorMsg.contains("Exception")) {
                            errorMsg = "Unable to complete request with AI provider. Please try again.";
                        }
                        emitter.send(SseEmitter.event().name("error").data(new StreamErrorResponse(errorMsg)));
                    } catch (Exception ignored) {}
                    try {
                        emitter.complete();
                    } catch (Exception ignored) {}
                }
            }
        });

        return emitter;
    }

    public record StreamTokenResponse(String text) {}
    public record StreamErrorResponse(String message) {}
    public record StreamDoneResponse(UUID conversationId, String provider, String model) {}

    @Transactional
    public DocumentResponse upload(UUID tenantId, UUID userId, UUID conversationId, MultipartFile file) {
        ChatConversation conversation = getConversation(tenantId, userId, conversationId);
        AppUser user = userService.findByIdAndTenant(userId, tenantId);

        validateAttachment(file);

        UUID attachmentId = UUID.randomUUID();
        FileStorageService.StoredFile stored;
        try {
            stored = storage.store(tenantId, attachmentId, 1, file);
        } catch (IOException e) {
            throw new IllegalArgumentException("Unable to store attachment file: " + e.getMessage(), e);
        }

        String mimeType = file.getContentType() != null && !file.getContentType().isBlank()
                ? file.getContentType() : "application/octet-stream";

        ChatConversationAttachment attachment = new ChatConversationAttachment(
                attachmentId, conversation.getTenant(), conversation, user,
                stored.originalFileName(), mimeType, stored.size(), stored.storageKey()
        );
        attachment = attachmentRepository.saveAndFlush(attachment);

        // Synchronously extract and embed private attachment chunks
        try {
            Resource resource = storage.loadAsResource(stored.storageKey());
            ExtractedDocument extracted;
            try (InputStream is = resource.getInputStream()) {
                extracted = extractor.extract(is, stored.originalFileName(), attachment.getMimeType());
            }

            List<TextChunker.DocumentChunkItem> chunkItems = chunker.chunkPages(extracted.pages());
            if (chunkItems.isEmpty()) {
                attachment.setIngestionStatus(IngestionStatus.FAILED);
                attachment.setIngestionError("No extractable text found in file");
                attachmentRepository.save(attachment);
            } else {
                List<String> chunkTexts = chunkItems.stream().map(TextChunker.DocumentChunkItem::content).toList();
                List<float[]> embeddings = embeddingService.embedDocuments(chunkTexts);

                for (int i = 0; i < chunkItems.size(); i++) {
                    TextChunker.DocumentChunkItem item = chunkItems.get(i);
                    float[] emb = embeddings.get(i);
                    UUID chunkId = UUID.randomUUID();
                    String vectorLiteral = toVectorLiteral(emb);

                    jdbcTemplate.update("""
                            INSERT INTO chat_conversation_attachment_chunks
                            (id, tenant_id, conversation_id, attachment_id, chunk_index, content, token_count,
                             embedding, embedding_provider, embedding_model, embedding_dimensions, page_number, source_locator)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?::vector, ?, ?, ?, ?, ?)
                            """,
                            chunkId, tenantId, conversationId, attachmentId, item.chunkIndex(), item.content(),
                            item.tokenCount(), vectorLiteral, embeddingService.provider(), embeddingService.model(),
                            embeddingService.dimensions(), item.pageNumber(), item.sourceLocator());
                }

                attachment.setIngestionStatus(IngestionStatus.INDEXED);
                attachment.setIndexedChunkCount(chunkItems.size());
                attachmentRepository.save(attachment);
            }
        } catch (Exception e) {
            log.error("Failed to index private attachment {}: {}", attachmentId, e.getMessage(), e);
            attachment.setIngestionStatus(IngestionStatus.FAILED);
            attachment.setIngestionError(e.getMessage() != null ? e.getMessage() : "Extraction failed");
            attachmentRepository.save(attachment);
        }

        return new DocumentResponse(
                attachment.getId(),
                attachment.getFileName(),
                "Private chat attachment",
                attachment.getFileName(),
                attachment.getMimeType(),
                attachment.getFileSize(),
                DocumentStatus.APPROVED,
                attachment.getIngestionStatus(),
                attachment.getIndexedChunkCount(),
                attachment.getIngestionError(),
                1,
                null,
                null,
                user.getId(),
                user.getName(),
                attachment.getCreatedAt(),
                attachment.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public ChatSourceResponse source(UUID tenantId, UUID userId, UUID documentId) {
        // First check shared organization documents
        try {
            Document document = documentService.getEntity(tenantId, userId, documentId);
            Resource resource = documentService.content(tenantId, userId, documentId);
            try (InputStream is = resource.getInputStream()) {
                byte[] bytes = is.readAllBytes();
                String text = extractor.extract(bytes, document.getOriginalFileName(), document.getMimeType()).text();
                return new ChatSourceResponse(document.getId(), document.getTitle(),
                        document.getOriginalFileName(), document.getMimeType(), document.getVersion(), text);
            }
        } catch (Exception e) {
            log.debug("Document {} not found in shared documents, checking private attachments", documentId);
        }

        // Check private chat attachments
        ChatConversationAttachment attachment = attachmentRepository.findByIdAndTenantId(documentId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Source document or attachment not found"));

        try {
            Resource resource = storage.loadAsResource(attachment.getStorageKey());
            try (InputStream is = resource.getInputStream()) {
                byte[] bytes = is.readAllBytes();
                String text = extractor.extract(bytes, attachment.getFileName(), attachment.getMimeType()).text();
                return new ChatSourceResponse(attachment.getId(), attachment.getFileName(),
                        attachment.getFileName(), attachment.getMimeType(), 1, text);
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("Unable to read attachment content: " + e.getMessage());
        }
    }

    private void validateAttachment(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File cannot be empty");
        }
        if (file.getSize() > MAX_ATTACHMENT_SIZE) {
            throw new IllegalArgumentException("Attachment file exceeds 25 MB size limit");
        }
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.matches("(?i).*\\.(pdf|docx|txt)$")) {
            throw new IllegalArgumentException("Only PDF, DOCX, and TXT files are supported for chat attachments");
        }
    }

    private String buildEnterpriseSystemPrompt(QueryIntent intent) {
        if (intent == QueryIntent.MIXED) {
            return """
                    You are the Enterprise Knowledge Assistant.
                    The user is asking a question that involves both internal organizational policy/practices and general concepts.

                    Guidelines:
                    1. Distinct evidence: Clearly separate the organization's specific policy/rules from general explanations or industry background.
                    2. Grounding: Ground internal policy claims strictly in the provided retrieved enterprise sources.
                    3. Insufficient evidence: If the retrieved sources do not contain internal policy regarding a claimed enterprise aspect, explicitly state: "The available organizational documents do not contain information regarding [specific internal topic]."
                    4. General explanation: Answer the general knowledge component clearly and accurately without claiming company policy.
                    5. Tone: Professional, clear, objective, and helpful.
                    """;
        }

        return """
                You are the Enterprise Knowledge Assistant, an enterprise AI assistant dedicated to answering questions accurately and professionally based strictly on authorized organizational knowledge.

                Guidelines:
                1. Grounding: Answer strictly using the provided retrieved enterprise sources.
                2. Citations: Reference source documents and page numbers where available.
                3. Insufficient evidence: If the retrieved sources do not contain enough information to answer the question, clearly state: "The available organizational documents do not contain enough information to answer this question." Do not invent company policy or facts.
                4. Tone: Professional, clear, concise, and helpful.
                """;
    }

    private String formatContext(List<ChatRetrievalService.RetrievedChunk> chunks) {
        return chunks.stream()
                .map(c -> "[SOURCE] " + c.title() + " (" + c.fileName() + ")"
                        + (c.pageNumber() == null ? "" : ", page " + c.pageNumber())
                        + "\n" + c.content())
                .collect(java.util.stream.Collectors.joining("\n\n"));
    }

    private String formatSimplePrompt(List<ChatMessage> previous, String prompt) {
        String history = previous.stream()
                .limit(Math.max(0, previous.size() - 1))
                .skip(Math.max(0, previous.size() - 7))
                .map(m -> (m.getRole() == ChatMessageRole.USER ? "User: " : "Assistant: ") + m.getContent())
                .collect(java.util.stream.Collectors.joining("\n"));

        return """
                Conversation history:
                %s

                User message:
                %s
                """.formatted(history.isBlank() ? "(none)" : history, prompt);
    }

    private String formatRAGPrompt(List<ChatMessage> previous, String context, String prompt) {
        String history = previous.stream()
                .limit(Math.max(0, previous.size() - 1))
                .skip(Math.max(0, previous.size() - 11))
                .map(m -> (m.getRole() == ChatMessageRole.USER ? "User: " : "Assistant: ") + m.getContent())
                .collect(java.util.stream.Collectors.joining("\n"));

        return """
                Conversation history:
                %s

                Retrieved sources:
                %s

                User question:
                %s
                """.formatted(
                history.isBlank() ? "(none)" : history,
                context.isBlank() ? "(no matching approved indexed source)" : context,
                prompt);
    }

    private String toVectorLiteral(float[] vector) {
        StringBuilder b = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) b.append(',');
            b.append(Float.toString(vector[i]));
        }
        return b.append(']').toString();
    }

    private ChatConversation getConversation(UUID tenantId, UUID userId, UUID id) {
        return conversations.findByIdAndTenantIdAndUserId(id, tenantId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
    }

    private ChatConversationResponse toConversation(ChatConversation c) {
        return new ChatConversationResponse(c.getId(), c.getTitle(), c.getCreatedAt(), c.getUpdatedAt(),
                messages.countByConversationId(c.getId()));
    }

    private ChatMessageResponse toMessage(ChatMessage m) {
        List<ChatCitationResponse> refs = citations.findByMessageIdOrderBySimilarityDesc(m.getId())
                .stream().map(c -> {
                    UUID docId = c.getDocument() != null ? c.getDocument().getId() :
                            (c.getAttachment() != null ? c.getAttachment().getId() : null);
                    String title = c.getDocument() != null ? c.getDocument().getTitle() :
                            (c.getAttachment() != null ? c.getAttachment().getFileName() : "Attachment");
                    String originalFile = c.getDocument() != null ? c.getDocument().getOriginalFileName() :
                            (c.getAttachment() != null ? c.getAttachment().getFileName() : "attachment");
                    String mime = c.getDocument() != null ? c.getDocument().getMimeType() :
                            (c.getAttachment() != null ? c.getAttachment().getMimeType() : "application/octet-stream");

                    return new ChatCitationResponse(
                            c.getId(), docId, title, originalFile, mime,
                            c.getDocumentVersion(), c.getChunkId(), c.getChunkIndex(),
                            c.getSimilarity(), Math.max(0, Math.min(1, c.getSimilarity())),
                            c.getSnippet(), c.getPageNumber(), c.getLocatorLabel()
                    );
                }).toList();

        return new ChatMessageResponse(m.getId(), m.getRole().name(), m.getContent(), m.getCreatedAt(),
                m.getProvider(), m.getModel(), refs);
    }
}
