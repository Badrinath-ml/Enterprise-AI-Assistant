package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.ai.StreamingGenerationService;

import com.enterprise.knowledge.ai.GenerationRequest;
import com.enterprise.knowledge.ai.GenerationResponse;
import com.enterprise.knowledge.ai.GenerationService;
import com.enterprise.knowledge.chat.dto.*;
import com.enterprise.knowledge.document.Document;
import com.enterprise.knowledge.document.DocumentService;
import com.enterprise.knowledge.document.dto.DocumentResponse;
import com.enterprise.knowledge.document.ingestion.DocumentTextExtractorService;
import com.enterprise.knowledge.tenant.Tenant;
import com.enterprise.knowledge.tenant.TenantRepository;
import com.enterprise.knowledge.user.AppUser;
import com.enterprise.knowledge.user.UserRole;
import com.enterprise.knowledge.user.UserService;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

import java.util.List;
import java.util.UUID;

@Service
public class ChatService {
    private static final int TOP_K = 6;

    private final ChatConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final ChatCitationRepository citations;
    private final ChatRetrievalService retrieval;
    private final GenerationService generation;
    private final UserService userService;
    private final TenantRepository tenantRepository;
    private final DocumentService documentService;
    private final DocumentTextExtractorService extractor;
    private final ChatPersistenceService persistence;
    private final StreamingGenerationService streamingGeneration;

    public ChatService(ChatConversationRepository conversations,
                       ChatMessageRepository messages,
                       ChatCitationRepository citations,
                       ChatRetrievalService retrieval,
                       GenerationService generation,
                       UserService userService,
                       TenantRepository tenantRepository,
                       DocumentService documentService,
                       DocumentTextExtractorService extractor,
                       ChatPersistenceService persistence,
                       StreamingGenerationService streamingGeneration) {
        this.conversations = conversations;
        this.messages = messages;
        this.citations = citations;
        this.retrieval = retrieval;
        this.generation = generation;
        this.userService = userService;
        this.tenantRepository = tenantRepository;
        this.documentService = documentService;
        this.extractor = extractor;
        this.persistence = persistence;
        this.streamingGeneration = streamingGeneration;
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
    public ChatSendResponse send(UUID tenantId, UUID userId, UUID conversationId, String prompt) {
        if (prompt == null || prompt.isBlank()) throw new IllegalArgumentException("Message cannot be blank");

        ChatConversation conversation = getConversation(tenantId, userId, conversationId);
        AppUser user = userService.findByIdAndTenant(userId, tenantId);

        ChatMessage userMessage = new ChatMessage(UUID.randomUUID(), conversation,
                ChatMessageRole.USER, prompt.trim(), null, null);
        messages.save(userMessage);

        List<ChatMessage> previous = messages.findByConversationIdOrderByCreatedAtAsc(conversationId);
        List<ChatRetrievalService.RetrievedChunk> chunks = retrieval.retrieve(
                tenantId,
                user.getDepartment() == null ? null : user.getDepartment().getId(),
                user.getRole() == UserRole.ADMIN,
                prompt.trim(),
                TOP_K
        );

        String context = chunks.stream()
                .map(c -> "[SOURCE] " + c.title() + " (" + c.fileName() + ")"
                        + (c.pageNumber() == null ? "" : ", page " + c.pageNumber())
                        + "\n" + c.content())
                .collect(java.util.stream.Collectors.joining("\n\n"));

        String history = previous.stream()
                .limit(Math.max(0, previous.size() - 1))
                .map(m -> (m.getRole() == ChatMessageRole.USER ? "User: " : "Assistant: ") + m.getContent())
                .collect(java.util.stream.Collectors.joining("\n"));

        String system = """
                You are the Enterprise Knowledge Assistant.
                Answer using the supplied enterprise sources. Do not invent facts.
                If the sources do not contain enough evidence, say that clearly.
                Prefer concise, useful answers.
                """;

        String promptWithContext = """
                Conversation history:
                %s

                Retrieved sources:
                %s

                User question:
                %s
                """.formatted(history.isBlank() ? "(none)" : history,
                context.isBlank() ? "(no matching approved indexed source)" : context,
                prompt.trim());

        GenerationResponse generated = generation.generate(new GenerationRequest(system, promptWithContext));
        ChatMessage assistant = new ChatMessage(UUID.randomUUID(), conversation,
                ChatMessageRole.ASSISTANT, generated.text(), generated.provider(), generated.model());
        messages.save(assistant);

        for (ChatRetrievalService.RetrievedChunk chunk : chunks) {
            double confidence = Math.max(0, Math.min(1, chunk.similarity()));
            citations.save(new ChatCitation(UUID.randomUUID(), assistant,
                    documentService.getEntity(tenantId, userId, chunk.documentId()),
                    chunk.documentVersion(), chunk.chunkId(), chunk.chunkIndex(),
                    chunk.similarity(), chunk.content(), chunk.pageNumber(), chunk.locatorLabel()));
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
        ExecutorService executor = Executors.newSingleThreadExecutor();

        executor.submit(() -> {
            try {
                persistence.saveUserMessage(tenantId, userId, conversationId, prompt.trim());

                AppUser user = userService.findByIdAndTenant(userId, tenantId);
                List<ChatMessage> previous = persistence.history(tenantId, userId, conversationId);
                List<ChatRetrievalService.RetrievedChunk> chunks = retrieval.retrieve(
                        tenantId,
                        user.getDepartment() == null ? null : user.getDepartment().getId(),
                        user.getRole() == UserRole.ADMIN,
                        prompt.trim(),
                        TOP_K
                );

                String context = chunks.stream()
                        .map(c -> "[SOURCE] " + c.title() + " (" + c.fileName() + ")"
                                + (c.pageNumber() == null ? "" : ", page " + c.pageNumber())
                                + "\n" + c.content())
                        .collect(java.util.stream.Collectors.joining("\n\n"));

                String history = previous.stream()
                        .limit(Math.max(0, previous.size() - 1))
                        .skip(Math.max(0, previous.size() - 13))
                        .map(m -> (m.getRole() == ChatMessageRole.USER ? "User: " : "Assistant: ") + m.getContent())
                        .collect(java.util.stream.Collectors.joining("\n"));

                String system = """
                        You are the Enterprise Knowledge Assistant.
                        Answer using the supplied enterprise sources. Do not invent facts.
                        If the sources do not contain enough evidence, say that clearly.
                        Prefer concise, useful answers.
                        """;

                String promptWithContext = """
                        Conversation history:
                        %s

                        Retrieved sources:
                        %s

                        User question:
                        %s
                        """.formatted(
                        history.isBlank() ? "(none)" : history,
                        context.isBlank() ? "(no matching approved indexed source)" : context,
                        prompt.trim());

                GenerationResponse generated = streamingGeneration.stream(
                        new GenerationRequest(system, promptWithContext),
                        token -> {
                            try {
                                emitter.send(SseEmitter.event().name("token").data(token));
                            } catch (Exception e) {
                                throw new RuntimeException(e);
                            }
                        });

                persistence.saveAssistant(
                        tenantId, userId, conversationId,
                        generated.text(), generated.provider(), generated.model(), chunks);
                persistence.touchWithTitle(tenantId, userId, conversationId, prompt.trim());

                emitter.send(SseEmitter.event().name("done").data(
                        new StreamDoneResponse(conversationId, generated.provider(), generated.model())));
                emitter.complete();
            } catch (Exception e) {
                try {
                    emitter.send(SseEmitter.event().name("error").data(
                            e.getMessage() == null ? "Unable to generate an answer." : e.getMessage()));
                } catch (Exception ignored) {}
                // The error has already been delivered as an SSE event.
                // Completing normally avoids Spring MVC trying to serialize ApiError
                // into an already-committed text/event-stream response.
                emitter.complete();
            } finally {
                executor.shutdown();
            }
        });
        return emitter;
    }

    public record StreamDoneResponse(UUID conversationId, String provider, String model) {}

    @Transactional
    public DocumentResponse upload(UUID tenantId, UUID userId, UUID conversationId, MultipartFile file) {
        getConversation(tenantId, userId, conversationId);
        return documentService.createChatAttachment(tenantId, userId, file);
    }

    @Transactional(readOnly = true)
    public ChatSourceResponse source(UUID tenantId, UUID userId, UUID documentId) {
        Document document = documentService.getEntity(tenantId, userId, documentId);
        try {
            Resource resource = documentService.content(tenantId, userId, documentId);
            byte[] bytes = resource.getInputStream().readAllBytes();
            String text = extractor.extract(bytes, document.getOriginalFileName(), document.getMimeType()).text();
            return new ChatSourceResponse(document.getId(), document.getTitle(),
                    document.getOriginalFileName(), document.getMimeType(), document.getVersion(), text);
        } catch (Exception e) {
            throw new IllegalArgumentException("Unable to read document source");
        }
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
                .stream().map(c -> new ChatCitationResponse(
                        c.getId(), c.getDocument().getId(), c.getDocument().getTitle(),
                        c.getDocument().getOriginalFileName(), c.getDocument().getMimeType(),
                        c.getDocumentVersion(), c.getChunkId(), c.getChunkIndex(),
                        c.getSimilarity(), Math.max(0, Math.min(1, c.getSimilarity())),
                        c.getSnippet(), c.getPageNumber(), c.getLocatorLabel()
                )).toList();
        return new ChatMessageResponse(m.getId(), m.getRole().name(), m.getContent(), m.getCreatedAt(),
                m.getProvider(), m.getModel(), refs);
    }
}
